// Run with selenium-webdriver installed and Firefox/geckodriver available.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const moduleRoot = process.env.SELENIUM_MODULE_ROOT || 'selenium-webdriver';
const {Builder, By, until} = require(moduleRoot);
const firefox = require(moduleRoot + '/firefox');
const root = path.resolve(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/dnscrypt-forge-v13r6.js'), 'utf8');
const view = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/view/dnscrypt-proxy2-forge/dnscrypt-proxy2-v13r6.js'), 'utf8');
const resolverParser = "function parseResolverList(output) {\n  for(var start=output.indexOf('[');start>=0;start=output.indexOf('[',start+1)) {\n    var depth=0, quoted=false, escaped=false;\n    for(var i=start;i<output.length;i++) {\n      var ch=output.charAt(i);\n      if(quoted) {if(escaped)escaped=false;else if(ch==='\\\\')escaped=true;else if(ch==='\"')quoted=false;continue;}\n      if(ch==='\"'){quoted=true;continue;}\n      if(ch==='[')depth++;\n      if(ch===']' && --depth===0) {\n        try {var value=JSON.parse(output.slice(start,i+1));\n          if(Array.isArray(value) && value.every(function(item){return item && typeof item.name==='string';}))return value;\n        } catch(error) {}\n        break;\n      }\n    }\n  }\n  throw new Error(editorLabel('DNSCrypt returned no readable resolver list. Check the configured sources and operation output.','DNSCrypt не вернул читаемый список DNS. Проверьте настроенные источники и вывод операций.'));\n}\n";
const hostileComment = '# literal &amp; ?a=1&region=eu </textarea><img src=x onerror="window.htmlInjected=true">\n';
const fixture = `<!doctype html><html><meta charset="utf-8"><title>Forge interface test</title>
<style>body{font-family:sans-serif;max-width:1100px;margin:20px auto}.cbi-value{display:flex;padding:8px}.cbi-value-title{width:240px}.cbi-section{padding:10px}.cbi-tabmenu{display:flex;flex-wrap:wrap;gap:20px;list-style:none}.table{width:100%;text-align:left}td,th{padding:8px}button,select{padding:6px}</style>
<body><div id="notifications"></div><div id="app"></div><script>
window.errors=[];window.addEventListener('error',e=>errors.push(e.message));
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const primary='/etc/dnscrypt-proxy2/dnscrypt-proxy.toml', backup='/etc/dnscrypt-proxy2/backup/dnscrypt-proxy.toml';
window.files={ [primary]: "server_names = ['resolver-a']\\nlisten_addresses = ['127.0.0.1:5300']\\ncache_min_ttl = 0\\n[sources.public]\\ncache_file = 'resolvers.md'\\n", [backup]: "server_names = ['resolver-b']\\nlisten_addresses = ['127.0.0.1:5400']\\nlog_file = 'backup.log'\\n[sources.public]\\ncache_file = 'resolvers.md'\\n" };
files[primary] += ${JSON.stringify(hostileComment)};
window.originalFiles=Object.assign({},files);window.writes=[];window.commands=[];window.reads=[];
const services={};['dnscrypt-proxy','dnscrypt-proxy-backup'].forEach((name,i)=>services[name]={instances:{instance1:{running:true,command:['/usr/sbin/dnscrypt-proxy','-config',i?backup:primary]}}});
function E(tag,attrs,children){
 if(!(attrs instanceof Object)||Array.isArray(attrs)){children=attrs;attrs=null;}
 const el=document.createElement(tag);Object.entries(attrs||{}).forEach(([k,v])=>{if(v==null)return;if(typeof v==='function')el.addEventListener(k,v);else el.setAttribute(k,v);});
 if(Array.isArray(children))children.forEach(v=>el.appendChild(v instanceof Node?v:document.createTextNode(String(v))));
 else if(children instanceof Node)el.appendChild(children);else if(children!=null)el.innerHTML=String(children);
 return el;
}
const apiFs={read:async file=>{reads.push(file);if(file.startsWith('/etc/init.d/'))return 'PROG=/usr/sbin/dnscrypt-proxy\\nCONFIGFILE='+ (file.endsWith('backup')?backup:primary);if(file.endsWith('.log'))return '[NOTICE] using resolver-b' + (commands.length ? '\\nServer with the lowest initial latency: resolver-b (rtt: 17ms), live servers: 3\\nStartup ' + commands.length : '');if(!(file in files))throw new Error('Missing fixture file');return files[file];},list:async()=>[{name:'dnscrypt-proxy'},{name:'dnscrypt-proxy-backup'}],write:async(file,data)=>{writes.push(file);files[file]=data;},exec:async(file,args)=>{commands.push([file,args]);if(file.startsWith('/etc/init.d/'))services[file.split('/').pop()].instances.instance1.running=args[0]!=='stop';return {code:0,stdout:file.startsWith('/etc/init.d/')?'action accepted':'[]',stderr:''};}};
window.histories={};const rpc={declare:({object,method})=>object==='dnscrypt-forge-files'?async(config,path,content,expected,exists)=>{if(method==='resolvers'){if(window.resolverError)return {error:window.resolverError};const result=await apiFs.exec('/usr/sbin/dnscrypt-proxy',['-config',config,path?'-list-all':'-list','-json']);try {const servers=new Function('editorLabel', ${JSON.stringify(resolverParser)}+';return parseResolverList(arguments[1]);')((a)=>a,(result.stdout||'')+'\\n'+(result.stderr||''));return {servers};}catch(error){return {error:error.message};}}if(method==='stat'){const size=(window.fileSizes||{})[path]??new TextEncoder().encode(files[path]||'').length;return {exists:path in files,size,limit:1048576,editable:size<=1048576};}if(method==='read'){(window.fileReads||=[]).push(path);return {content:files[path]||'',exists:path in files};}if(method==='versions')return {versions:(histories[path]||[]).map((x,i)=>({id:String(i),time:1700000000+i}))};if(method==='version')return {content:histories[path][Number(content)]};if((files[path]||'')!==expected || (path in files)!==exists)return {error:'File changed externally'};if(exists){histories[path]=[files[path],...(histories[path]||[])].slice(0,10);}writes.push(path);files[path]=content;return {saved:true};}: object==='dnscrypt-forge'?async(service)=>({running:services[service].instances.instance1.running,pid:999,log:commands.length?'Server with the lowest initial latency: resolver-b (rtt: 17ms), live servers: 3\\nStartup '+commands.length:''}):object==='uci'?async()=>({value:'ru'}):object==='service'?async name=>name?{[name]:services[name]}:services:async file=>({data:await apiFs.read(file)})};
const ui={createHandlerFn:(obj,name)=>e=>{e.preventDefault();return obj[name]();},addNotification:(_,node)=>document.getElementById('notifications').appendChild(node),showModal:(_,nodes)=>{window.modal=E('div',{id:'modal'},nodes);document.body.appendChild(modal);},hideModal:()=>window.modal?.remove()};
const poll={add:callback=>window.refreshStatus=callback};
const L={resolveDefault:(promise,fallback)=>promise.catch(()=>fallback)};
class BaseClass {static extend(properties){class Child extends this{}Object.assign(Child.prototype,properties);return Child;}}
const Forge=new Function('baseclass',${JSON.stringify(helper)})(BaseClass);const forge=new Forge();
window.app=new Function('fs','form','view','poll','rpc','ui','forge','E','L',${JSON.stringify(view)})(apiFs,{}, {extend:o=>o},poll,rpc,ui,forge,E,L);
app.load().then(status=>{document.getElementById('app').appendChild(app.render(status));window.ready=true;}).catch(e=>errors.push(e.message));
</script></body></html>`;
const server = http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);});
async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const options = new firefox.Options().addArguments('-headless');
  if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
  const builder = new Builder().forBrowser('firefox').setFirefoxOptions(options);
  if (process.env.GECKODRIVER) builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER));
  let driver;
  try {
    driver = await builder.build();
    await driver.manage().window().setRect({width:1280,height:1000});
    const url = 'http://127.0.0.1:'+server.address().port;
    await driver.get(url);
    await driver.wait(async()=>driver.executeScript('return window.ready || false'),10000);
    assert.equal(await driver.executeScript('return document.getElementById("config-textarea").value === app.configContent'),true,'TOML must remain literal, including HTML entities and closing tags');
    assert.match(await driver.findElement(By.id('forge-version')).getText(),/1\.3-r6/);
    assert.equal(await driver.findElement(By.css('#forge-version a')).getAttribute('href'),'https://github.com/numbereleven-a/luci-app-dnscrypt-proxy2_forge');
    assert.equal((await driver.findElements(By.css('#instance-overview th'))).length,4);
    assert.equal(await driver.findElement(By.id('instance-listen-dnscrypt-proxy/instance1')).getText(),'127.0.0.1:5300');
    assert.equal(await driver.findElement(By.id('instance-listen-dnscrypt-proxy-backup/instance1')).getText(),'127.0.0.1:5400');
    assert.equal(await driver.executeScript("return Array.from(document.querySelectorAll('#instance-overview th, #instance-overview td')).every(el=>getComputedStyle(el).textAlign==='left')"),true);
    const selection = await driver.findElement(By.css('#dnscrypt-proxy-form > .cbi-section select'));
    assert.equal((await selection.findElements(By.css('option'))).length,2);
    assert.equal(await selection.getAttribute('value'),'dnscrypt-proxy/instance1');
    assert.equal(await driver.findElement(By.css('[name="server_names"]')).getAttribute('value'),'resolver-a');
    await driver.executeScript('return app.handleSave()');
    assert.equal(await driver.executeScript('return files[Object.keys(files)[0]]===originalFiles[Object.keys(files)[0]]'),true);
    await driver.executeScript("const s=document.querySelector('#dnscrypt-proxy-form > .cbi-section select');s.value='dnscrypt-proxy-backup/instance1';s.dispatchEvent(new Event('change'));");
    await driver.wait(until.urlContains('instance='),10000);
    await driver.wait(async()=>driver.executeScript('return window.ready || false'),10000);
    assert.equal(await driver.findElement(By.css('[name="server_names"]')).getAttribute('value'),'resolver-b');
    assert.equal(await driver.findElement(By.id('instance-selector')).getAttribute('value'),'dnscrypt-proxy-backup/instance1');
    await driver.executeScript("const s=document.getElementById('instance-selector');s.value='dnscrypt-proxy/instance1';s.dispatchEvent(new Event('change'));");
    await driver.wait(async()=>driver.executeScript('return window.ready && document.getElementById("instance-selector").value==="dnscrypt-proxy/instance1"'),10000);
    assert.equal(await driver.findElement(By.css('[name="server_names"]')).getAttribute('value'),'resolver-a');
    await driver.navigate().refresh();
    await driver.wait(async()=>driver.executeScript('return window.ready || false'),10000);
    assert.equal(await driver.findElement(By.id('instance-selector')).getAttribute('value'),'dnscrypt-proxy/instance1');
    await driver.executeScript("const s=document.getElementById('instance-selector');s.value='dnscrypt-proxy-backup/instance1';s.dispatchEvent(new Event('change'));");
    await driver.wait(async()=>driver.executeScript('return window.ready && document.getElementById("instance-selector").value==="dnscrypt-proxy-backup/instance1"'),10000);

    await driver.executeScript("document.querySelector('[name=server_names]').value='resolver-c';document.querySelector('[name=listen_addresses]').value='127.0.0.1:5401, [::1]:5401';return app.handleSaveApply();");
    assert.equal(await driver.executeScript('return files[Object.keys(files)[0]]===originalFiles[Object.keys(files)[0]]'),true);
    assert.deepEqual(await driver.executeScript('return commands.at(-1)'),['/etc/init.d/dnscrypt-proxy-backup',['restart']]);
    assert.equal(await driver.executeScript('return writes.every(file=>file.includes("/backup/"))'),true);
    assert.equal(await driver.findElement(By.id('instance-listen-dnscrypt-proxy-backup/instance1')).getText(),'127.0.0.1:5401, [::1]:5401');
    assert.match(await driver.findElement(By.id('operation-output')).getText(), /rtt: 17ms/);
    assert.match(await driver.findElement(By.id('operation-output')).getText(), /action accepted/);
    assert.match(await driver.findElement(By.id('operation-output')).getText(), /готовности/);
    await driver.wait(async()=>driver.executeScript('return typeof refreshStatus==="function"'),5000);
    await driver.findElement(By.id('btn_stop')).click();
    await driver.executeScript('refreshStatus()');
    await driver.wait(async()=>driver.findElement(By.id('btn_start')).isEnabled(),3000);
    assert.equal(await driver.findElement(By.id('btn_stop')).isEnabled(),false);
    const commandsAfterStop = await driver.executeScript('return commands.length');
    await driver.executeScript("document.querySelector('[name=server_names]').value='resolver-stopped';return app.handleSaveApply();");
    assert.equal(await driver.executeScript('return commands.length'),commandsAfterStop,'Save & Apply must not start a stopped service');
    await driver.executeScript('return refreshStatus()');
    assert.equal(await driver.findElement(By.id('btn_start')).isEnabled(),true);
    assert.equal(await driver.findElement(By.id('btn_stop')).isEnabled(),false);
    assert.match(await driver.executeScript('return files["/etc/dnscrypt-proxy2/backup/dnscrypt-proxy.toml"]'),/resolver-stopped/);
    await driver.findElement(By.css('#tab-logging a')).click();
    await driver.findElement(By.id('btn_refresh_log')).click();
    await driver.wait(until.elementTextContains(await driver.findElement(By.id('log-view-content')),'resolver-b'),3000);
    assert.equal(await driver.executeScript('return reads.includes("/etc/dnscrypt-proxy2/backup/backup.log")'),true);
    assert.deepEqual(await driver.executeScript('return errors'),[]);
    if (process.env.FORGE_SCREENSHOT) fs.writeFileSync(process.env.FORGE_SCREENSHOT,await driver.takeScreenshot(),'base64');
    console.log('Passed browser: both instances, switching, independent save/restart/stop, polling, relative backup log, Russian interface');
  } finally {
    if (driver) await driver.quit();
    await new Promise(resolve=>server.close(resolve));
  }
}
module.exports = {fixture};
if (require.main === module) main().catch(error=>{console.error(error);process.exitCode=1;});
