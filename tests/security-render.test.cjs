// Use the same LuCI-compatible E() fixture as the ordinary browser checks.
const assert = require('node:assert/strict');
const http = require('node:http');
const {fixture} = require('./browser.test.cjs');
const moduleRoot = process.env.SELENIUM_MODULE_ROOT || 'selenium-webdriver';
const {Builder, By, until} = require(moduleRoot);
const firefox = require(moduleRoot + '/firefox');
const markup = '<img src=x onerror="window.htmlInjected=true">';
const compactMarkup = '<svg/onload=window.htmlInjected=true>';
const config = "server_names = ['resolver-a']\nlisten_addresses = ['127.0.0.1:5300', '" + markup + "']\nlog_file = '" + markup + ".log'\n# &amp; ?a=1&region=eu </textarea> " + markup + '\n';
const page = fixture.replace('app.load().then', 'files[primary]=' + JSON.stringify(config) + ';originalFiles[primary]=files[primary];window.apiFs=apiFs;window.fixtureUi=ui;window.htmlInjected=false;app.load().then');
const testPage = page.replaceAll('window.location.reload()', 'window.rawReloaded=true');
const server = http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(testPage);});

async function main() {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const options = new firefox.Options().addArguments('-headless');
  if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
  const builder = new Builder().forBrowser('firefox').setFirefoxOptions(options);
  if (process.env.GECKODRIVER) builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER));
  let driver;
  try {
    driver = await builder.build();
    await driver.get('http://127.0.0.1:' + server.address().port);
    await driver.wait(async()=>driver.executeScript('return window.ready || false'),10000);
    assert.equal(await driver.executeScript('return document.getElementById("config-textarea").value'),config);
    assert.equal(await driver.findElement(By.id('instance-listen-dnscrypt-proxy/instance1')).getText(),'127.0.0.1:5300, ' + markup);
    assert.equal(await driver.executeScript('return document.getElementById("panel-logging").textContent.includes(arguments[0])',markup + '.log'),true);
    await driver.executeScript('return app.handleSave()');
    assert.equal(await driver.executeScript('return files[Object.keys(files)[0]]'),config,'Unchanged form save preserves every character');
    // Exercise the raw Save button; prevent only its navigation in the fixture.
    await driver.executeScript('window.rawReloaded=false;document.querySelector("#panel-config_view").style.display="block"');
    await driver.findElement(By.id('btn_save_config')).click();
    await driver.wait(async()=>driver.executeScript('return window.rawReloaded || false'),3000);
    assert.equal(await driver.executeScript('return files[Object.keys(files)[0]]'),config,'Raw save preserves every character');
    await driver.wait(async()=>driver.executeScript('return typeof refreshStatus==="function"'),5000);
    await driver.executeScript('const originalRead=apiFs.read;apiFs.read=async file=>file.endsWith(".log")?"[NOTICE] using " + arguments[0]:originalRead(file);refreshStatus()',compactMarkup);
    await driver.wait(until.elementTextContains(await driver.findElement(By.id('current_servers')),compactMarkup),3000);

    const resolver = {name:markup, proto:compactMarkup, addrs:['&amp; ?a=1&region=eu',markup]};
    await driver.executeScript('apiFs.exec=async()=>({code:0,stdout:JSON.stringify(arguments[0])})',[resolver]);
    for (const field of ['server_names','disabled_server_names']) {
      const input = await driver.findElement(By.css('[name="' + field + '"]'));
      const tab = await driver.executeScript('return arguments[0].closest("[id^=panel-]").getAttribute("data-tab")',input);
      await driver.findElement(By.css('#tab-' + tab + ' a')).click();
      const button = await input.findElement(By.xpath('following-sibling::button'));
      await button.click();
      await driver.wait(until.elementLocated(By.css('#modal .server-row')),3000);
      const cells = await driver.findElements(By.css('#modal .server-row td'));
      assert.equal(await cells[1].getText(),markup);
      assert.equal(await cells[2].getText(),compactMarkup);
      assert.equal(await cells[3].getText(),resolver.addrs.join(', '));
      await driver.executeScript('const search=document.querySelector("#modal .cbi-input-text");search.value="no matching resolver";search.dispatchEvent(new Event("input"))');
      assert.equal(await driver.findElement(By.css('#modal .server-row')).isDisplayed(),false);
      await driver.executeScript('const search=document.querySelector("#modal .cbi-input-text");search.value="";search.dispatchEvent(new Event("input"))');
      await cells[0].findElement(By.css('input')).click();
      await driver.findElement(By.css('#modal .cbi-button-save')).click();
      assert.equal(await input.getAttribute('value'),markup,'Modal selection remains functional');
    }
    // The same modal error boundary handles empty lists and command stderr.
    for (const field of ['server_names','disabled_server_names']) {
      for (const output of [{code:0,stdout:'[]'},{code:1,stderr:markup}]) {
        await driver.executeScript('window.resolverError=arguments[0].code?arguments[0].stderr:null;apiFs.exec=async()=>arguments[0]',output);
        const input = await driver.findElement(By.css('[name="' + field + '"]'));
        const tab = await driver.executeScript('return arguments[0].closest("[id^=panel-]").getAttribute("data-tab")',input);
        await driver.findElement(By.css('#tab-' + tab + ' a')).click();
        await input.findElement(By.xpath('following-sibling::button')).click();
        const listId = field === 'server_names' ? 'server-list-modal' : 'server-list-modal-disabled';
        await driver.wait(async()=>driver.executeScript('return document.getElementById(arguments[0])?.textContent.includes("Ошибка")',listId),3000);
        const message = await driver.findElement(By.id(listId)).getText();
        assert.ok(!message.includes('[object HTMLDivElement]'));
        if (output.code) assert.ok(message.includes(markup));
        await driver.executeScript('fixtureUi.hideModal()');
      }
    }
    assert.equal(await driver.executeScript('return document.querySelectorAll("#app img,#app svg,#modal img,#modal svg,#notifications img,#notifications svg").length'),0);
    assert.equal(await driver.executeScript('return window.htmlInjected'),false);
    // Re-render original form to remove deliberate modal selection edits.
    await driver.get('http://127.0.0.1:' + server.address().port);
    await driver.wait(async()=>driver.executeScript('return window.ready || false'),10000);
    await driver.executeScript('apiFs.exec=async()=>({code:1,stderr:arguments[0]});return app.handleSaveApply()',markup);
    assert.ok((await driver.findElement(By.id('notifications')).getText()).includes(markup),'Command errors remain literal notification text');
    assert.equal(await driver.executeScript('return document.querySelectorAll("#app img,#app svg,#modal img,#modal svg,#notifications img,#notifications svg").length'),0);
    assert.equal(await driver.executeScript('return window.htmlInjected'),false);
    assert.deepEqual(await driver.executeScript('return errors'),[]);
    console.log('Passed security rendering: exact TOML form/raw saves, entities, listeners, paths, log names, both resolver modals, selections, empty/errors, stderr notifications; no injected elements or handlers');
  } finally {
    if (driver) await driver.quit();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
