const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {fixture} = require('./browser.test.cjs');
const moduleRoot = process.env.SELENIUM_MODULE_ROOT || 'selenium-webdriver';
const {Builder,By} = require(moduleRoot);
const firefox = require(moduleRoot+'/firefox');
const catalogFixture=fixture.replace('app.load().then', `
window.apiFs=apiFs;window.fileSizes={'/etc/dnscrypt-proxy2/adb_list.overall':4949216};
files['/etc/dnscrypt-proxy2/adb_list.overall']='not read';
files[primary] += "\\n[blocked_names]\\nblocked_names_file = '/etc/dnscrypt-proxy2/adb_list.overall'\\n";
app.load().then`);
async function main() {
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(catalogFixture);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let driver;
  try {
    const options=new firefox.Options().addArguments('-headless');
    if(process.env.FIREFOX_BINARY)options.setBinary(process.env.FIREFOX_BINARY);
    const builder=new Builder().forBrowser('firefox').setFirefoxOptions(options);
    if(process.env.GECKODRIVER)builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER));
    driver=await builder.build();
    await driver.manage().window().setRect({width:1400,height:1100});
    await driver.get('http://127.0.0.1:'+server.address().port);
    await driver.wait(()=>driver.executeScript('return window.ready||false'),10000);
    await driver.findElement(By.css('#tab-filters a')).click();
    await driver.findElement(By.css('#panel-filters details summary')).click();
    assert.equal(await driver.findElement(By.css('#panel-filters .rules-enabled')).isSelected(),true);
    assert.match(await driver.findElement(By.css('#panel-filters .rule-settings')).getText(),/adb_list.overall/);
    await driver.findElement(By.xpath('//div[@id="panel-filters"]//button[text()="Загрузить файл"]')).click();
    await driver.wait(()=>driver.executeScript('return document.getElementById("notifications").textContent.includes("SSH")'),3000);
    assert.equal(await driver.executeScript('return (window.fileReads||[]).includes("/etc/dnscrypt-proxy2/adb_list.overall")'),false,'Oversize file is never read');
    assert.equal(await driver.findElement(By.css('#panel-filters textarea')).isEnabled(),false);
    assert.equal(await driver.findElement(By.css('#panel-filters .rules-enabled')).isSelected(),true,'Refusing a load must keep configured rules enabled');
    await driver.executeScript(`apiFs.exec=async()=>({code:0,stdout:'[NOTICE] reading sources\\n["not resolvers"]\\n[ {"name":"resolver-one","proto":"DoH","addrs":["192.0.2.1:443"]}, {"name":"resolver-two","proto":"DNSCrypt","addrs":["192.0.2.2:443"]} ]\\n[NOTICE] finished',stderr:''})`);
    await driver.findElement(By.css('#tab-catalog a')).click();
    await driver.findElement(By.id('catalog-select')).click();
    await driver.wait(()=>driver.executeScript('return document.querySelectorAll("#catalog-results .server-row").length===2'),3000);
    assert.equal((await driver.findElements(By.id('modal'))).length,0,'Catalog displays inline, without hidden-button dispatch or modal');
    const first=await driver.findElement(By.css('#catalog-results .server-row input'));
    await first.click();
    await driver.findElement(By.xpath('//div[@id="catalog-results"]//button[text()="Добавить в список"]')).click();
    assert.equal(await driver.findElement(By.css('[name="server_names"]')).getAttribute('value'),'resolver-one');
    assert.equal((await driver.findElements(By.css('#catalog-results .server-row'))).length,2);
    const feedback=await driver.findElement(By.id('catalog-selection-feedback'));
    assert.match(await feedback.getText(),/resolver-one/);
    assert.match(await feedback.getText(),/ещё не сохранены/);
    assert.equal(await feedback.getAttribute('role'),'status');
    assert.equal(await driver.executeScript('return writes.length'),0,'Selecting servers does not save configuration');
    await first.click();
    await driver.findElement(By.xpath('//div[@id="catalog-results"]//button[text()="Добавить в список"]')).click();
    assert.match(await feedback.getText(),/Выбор очищен/);
    assert.deepEqual(await driver.executeScript('return errors'),[]);
    if(process.env.FORGE_SCREENSHOT)fs.writeFileSync(process.env.FORGE_SCREENSHOT,await driver.takeScreenshot(),'base64');
    console.log('Passed large files/catalog: metadata-only refusal, SSH warning, enabled state kept, mixed-output JSON, inline choices and selection');
  } finally {if(driver)await driver.quit();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
