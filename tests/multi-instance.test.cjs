const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../htdocs/luci-static/resources/dnscrypt-forge-v13r8.js'), 'utf8');
class BaseClass {
  static extend(properties) {
    class Child extends this {}
    Object.assign(Child.prototype, properties);
    return Child;
  }
}
const Forge = new Function('baseclass', source)(BaseClass);
assert.ok(Forge.prototype instanceof BaseClass, 'LuCI requires a class constructor from each module');
const forge = new Forge();
const config = '/etc/dnscrypt-proxy2/dnscrypt-proxy.toml';
const backup = '/etc/dnscrypt-proxy2/backup/dnscrypt-proxy.toml';
const instance = (file, running = true) => ({ running, command: ['/usr/sbin/dnscrypt-proxy', '-config', file] });
const script = file => `PROG=/usr/sbin/dnscrypt-proxy\nCONFIGFILE="${file}"\n`;
const services = {
  'dnscrypt-proxy': { instances: { instance1: instance(config) } },
  'dnscrypt-proxy-backup': { instances: { instance1: instance(backup) } },
  'dnscrypt-failover': { instances: { instance1: { command: ['/usr/sbin/dnsmasq'] } } }
};
let rows = forge.discover(services, {});
assert.equal(rows.length, 2);
assert.equal(forge.discover({}, {'dnscrypt-proxy-backup': script(backup) + '\nprocd_open_instance reserve\n'})[0].instance, 'reserve');
assert.equal(rows[1].config, backup);
assert.ok(rows.every(row => row.running && !row.shared));
rows = forge.discover({ 'dnscrypt-proxy': services['dnscrypt-proxy'] }, { 'dnscrypt-proxy-backup': script(backup) });
assert.equal(rows[1].running, false);
assert.equal(rows.length, 2);
rows = forge.discover({ 'dnscrypt-proxy': { instances: { a: instance(config), b: instance(backup, false) } } }, {});
assert.ok(rows.every(row => row.shared));
assert.equal(rows[1].running, false);
assert.equal(forge.scriptConfig(script('/etc/dnscrypt-proxy2/../shadow.toml')), null);
assert.equal(forge.scriptConfig('PROG=/usr/sbin/dnscrypt-proxy\nCONFIGFILE=$(cat /etc/shadow)'), null);
assert.equal(forge.safeConfig('/etc/dnscrypt-proxy2/backup/config.toml'), true);
assert.equal(forge.safeConfig('/etc/shadow'), false);
assert.equal(forge.safeService('dnscrypt-proxy;reboot'), false);
assert.equal(forge.logDelta('old\nrepeat\n', 'repeat\nnew\nrepeat\n'), 'new\nrepeat');

const toml = `# [sources.example]\nserver_names = [\n  'resolver-a', # comment\n  "resolver-b",\n]\nlisten_addresses = ['127.0.0.1:5300'] # inline\ncache_min_ttl = 0\nproxy = 'socks5://example.test:1080#fragment'\n[sources.public-resolvers]\nurls = ['https://example.test/resolvers.md']\ncache_file = 'resolvers.md'\n[static.custom]\nstamp = 'synthetic'\n`;
const parsed = forge.parseToml(toml);
assert.deepEqual(parsed.server_names, ['resolver-a', 'resolver-b']);
assert.deepEqual(parsed.listen_addresses, ['127.0.0.1:5300']);
assert.equal(parsed.proxy, 'socks5://example.test:1080#fragment');
assert.equal(forge.updateToml(toml, {}), toml);
const changed = forge.updateToml(toml, { server_names: ["resolver'quote"], cache_min_ttl: 0, force_tcp: false });
assert.deepEqual(forge.parseToml(changed).server_names, ["resolver'quote"]);
assert.equal(forge.parseToml(changed).force_tcp, false);
assert.equal(changed.slice(changed.indexOf('[sources.public-resolvers]')), toml.slice(toml.indexOf('[sources.public-resolvers]')));
const disabled = forge.updateToml(toml, { server_names: null });
assert.equal(forge.parseToml(disabled).server_names, undefined);
assert.equal(forge.parseToml(forge.updateToml('proxy = "old"\n', { proxy: 'a\\b"c' })).proxy, 'a\\b"c');
assert.throws(() => forge.updateToml('server_names = [\n', { server_names: [] }));

// Exercise the actual view handlers with a DOM containing the editable fields.
const viewSource = fs.readFileSync(path.join(__dirname, '../htdocs/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v13r8.js'), 'utf8');
const elements = {};
const form = { querySelectorAll: () => Object.values(elements).filter(el => el.name) };
const files = { [config]: toml, [backup]: toml.replace('5300', '5400') };
const writes = [], commands = [];
const context = {
  forge, URL, Number, Promise, console,
  view: { extend: obj => obj },
  rpc: { declare: ({object,method}) => object === 'dnscrypt-forge-files' ? async (config,path,content,expected,exists) => { if(method==='write'){if(files[path]!==expected) return {error:'File changed externally'};writes.push(path);files[path]=content;return {saved:true};}return {content:files[path]||'',exists:path in files,versions:[]};} : object === 'dnscrypt-forge' ? async () => ({pid: 123, running: true, log: 'Ready ' + commands.length}) : object === 'uci' ? async () => ({value: 'en'}) : async name => name ? { [name]: services[name] } : services },
  fs: {
    read: async file => file.startsWith('/etc/init.d/') ? script(file.endsWith('backup') ? backup : config) : files[file],
    list: async () => [{name: 'dnscrypt-proxy'}, {name: 'dnscrypt-proxy-backup'}, {name: 'dnscrypt-failover'}],
    write: async (file, data) => { writes.push(file); files[file] = data; },
    exec: async (file, args) => { commands.push([file, args]); return {code: 0}; }
  },
  window: { location: {href: 'http://example.test/?instance=dnscrypt-proxy-backup%2Finstance1', search: ''} },
  navigator: {language: 'en'}, L: {resolveDefault: (promise, fallback) => promise.catch(() => fallback)},
  document: {
    querySelectorAll: () => [],
    cookie: '', getElementById: id => id === 'dnscrypt-proxy-form' ? form : elements[id],
    querySelector: selector => elements[(selector.match(/name="([^"]+)"/) || [])[1]]
  },
  ui: {addNotification: () => {}}, E: () => ({}), poll: {}
};
vm.createContext(context);
const app = vm.runInContext('(function() {\n' + viewSource + '\n})()', context);
async function main() {
  await app.load();
  assert.equal(app.configContent, files[backup]);
  // Provide all named fields as rendered by the view, with unchanged empty defaults.
  for (const match of viewSource.matchAll(/(?:getValue|getCheckbox|numberValue)\('([^']+)'/g)) {
    elements[match[1]] = {name: match[1], type: /getCheckbox/.test(match[0]) ? 'checkbox' : 'text', value: '', checked: false};
  }
  elements['config-textarea'] = {value: app.configContent};
  context.formForTest = form;
  // Top-level vars are enclosed in the module; expose state solely for the test.
  const instrumented = viewSource.replace('return view.extend({', 'globalThis.capture = function() { originalFields = snapshotFields(formForTest); }; return view.extend({');
  const tested = vm.runInContext('(function() {\n' + instrumented + '\n})()', context);
  await tested.load();
  context.capture();
  await tested.saveConfig();
  assert.equal(files[backup], tested.configContent);
  assert.equal(files[backup], toml.replace('5300', '5400'));
  elements.server_names.value = 'replacement';
  await tested.saveConfig();
  assert.deepEqual(forge.parseToml(files[backup]).server_names, ['replacement']);
  assert.equal(files[config], toml);
  assert.ok(writes.every(file => file === backup));
  await tested.handleSaveApply();
  assert.equal(commands.at(-1)[0], '/etc/init.d/dnscrypt-proxy-backup');
  assert.equal(commands.at(-1)[1][0], 'restart');
  files[backup] += '# external change\n';
  await assert.rejects(tested.saveConfig(), /changed externally/);
  elements['config-textarea'].value += '# raw edit\n';
  await assert.rejects(tested.saveConfig(), /Save raw edits/);
  console.log('Passed: discovery, stopped services, isolation, TOML preservation, selected restart, stale and raw edit guards');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
