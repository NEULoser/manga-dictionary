import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
export async function integration(browser, fixtureURL) {
  const context = browser.contexts()[0];
  const page = await context.newPage(); await page.setViewportSize({width:1280,height:900});
  await page.goto(fixtureURL);
  const failures = []; page.on('pageerror', e=>failures.push(e.message));
  let sw;
  for (const w of context.serviceWorkers()) if (await w.evaluate(()=>chrome.runtime.getManifest().name).catch(()=>'' ) === '漫画伴读 · 离线查词') {sw=w;break;}
  assert(sw, 'Extension service worker must load');
  const id = sw.url().split('/')[2];
  const cdp = await browser.newBrowserCDPSession();
  await page.bringToFront();
  const target = (await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]})).targetInfos.find(t=>t.url===page.url() && t.embedderData?.tabActive);
  assert(target,'Active tab target must exist');
  await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
  await page.locator('#language').waitFor();
  const select = async (canvas, rect) => {
    await page.locator(canvas).scrollIntoViewIfNeeded();
    const b = await page.locator(canvas).boundingBox();
    const sx = b.width/762, sy = b.height/(canvas === '#english' ? 262 : 452);
    await page.locator('#select').click();
    await page.mouse.move(b.x+rect.x*sx,b.y+rect.y*sy); await page.mouse.down();
    await page.mouse.move(b.x+(rect.x+rect.w)*sx,b.y+(rect.y+rect.h)*sy,{steps:8}); await page.mouse.up();
  };
  await page.locator('#language').selectOption('en');
  await select('#english',{x:35,y:50,w:685,h:160});
  await page.getByRole('button',{name:'beautiful',exact:true}).waitFor({timeout:60000});
  const englishText = await page.locator('#text').inputValue(); assert(englishText.includes('beautiful book. We went'));
  await page.getByRole('button',{name:'beautiful',exact:true}).click();
  await page.locator('#result').filter({hasText:'美丽'}).waitFor();
  await page.screenshot({path:'artifacts/english-lookup.png'});
  await page.getByRole('button',{name:'went',exact:true}).click();
  await page.locator('#result').filter({hasText:'去, 走'}).waitFor();
  await page.locator('#text').fill('beau-\ntiful');
  assert.equal(await page.locator('.token').count(),0,'Editing invalidates old tokens');
  await page.locator('#analyse').click(); await page.getByRole('button',{name:'beautiful',exact:true}).waitFor();
  await page.locator('#text').fill('zzqxyznonexistent'); await page.locator('#analyse').click();
  await page.getByRole('button',{name:'zzqxyznonexistent',exact:true}).click();
  await page.locator('#result').filter({hasText:'没有中文释义'}).waitFor();
  await page.locator('#language').selectOption('ja');
  // Cold start offline: no preloaded dictionary/OCR worker is used.
  await sw.evaluate(()=>chrome.offscreen.closeDocument());
  await context.setOffline(true);
  await select('#japanese',{x:415,y:42,w:285,h:322});
  await page.getByRole('button',{name:'食べ',exact:true}).waitFor({timeout:60000});
  const japaneseText = await page.locator('#text').inputValue();
  assert.equal(japaneseText,'昨日学校で食べました');
  await page.getByRole('button',{name:'食べ',exact:true}).click();
  await page.locator('#result').filter({hasText:'吃'}).waitFor();
  assert((await page.locator('#result').innerText()).includes('たべる · 动词'));
  const wasSidebar=await page.locator('.panel').evaluate(e=>e.classList.contains('sidebar'));
  await page.locator('#display').click(); assert.equal(await page.locator('.panel').evaluate(e=>e.classList.contains('sidebar')),!wasSidebar);
  if(wasSidebar)await page.locator('#display').click();
  await page.screenshot({path:'artifacts/japanese-lookup.png'});
  await page.locator('#text').fill('昨日、学校で食べました。'); await page.locator('#analyse').click();
  await page.getByRole('button',{name:'食べ',exact:true}).waitFor();
  await page.getByRole('button',{name:'食べ',exact:true}).click();
  await page.locator('#result').filter({hasText:'原形：食べる'}).waitFor();
  await page.locator('#select').click(); await page.mouse.move(200,200); await page.mouse.down(); await page.mouse.move(203,203); await page.mouse.up();
  await page.locator('#status').filter({hasText:'选区太小'}).waitFor();
  await page.locator('#select').click(); await page.keyboard.press('Escape');
  assert(await page.locator('.overlay').evaluate(e=>e.classList.contains('hidden')));
  assert(await page.locator('.panel').evaluate(e=>e.classList.contains('hidden')));
  await cdp.send('Extensions.triggerAction',{id,targetId:target.targetId});
  await page.locator('#clear').click(); assert.equal(await page.locator('#text').inputValue(),'');
  const storage=await sw.evaluate(()=>chrome.storage.local.get(null));
  assert.deepEqual(Object.keys(storage),['preferences']);
  assert.deepEqual(failures,[]);
  await context.setOffline(false);
  const result={passed:true,browser:await browser.version(),englishText,japaneseText,checks:['real action / activeTab permission','captureVisibleTab region crop','English OCR and definitions','irregular English lemma','edited text invalidates tokens','line-break normalization','missing dictionary result','cold offline vertical Japanese OCR','Japanese base form / reading / part of speech','sidebar toggle','small-region error','Escape and clear','preferences-only storage'],screenshots:['artifacts/english-lookup.png','artifacts/japanese-lookup.png']};
  await fs.writeFile('artifacts/integration-result.json',JSON.stringify(result,null,2));
  await page.close(); return result;
}
export async function startFixture() {
  const base=path.resolve('.');
  const server=http.createServer(async(req,res)=>{
    try {const file=path.resolve(base,'.'+decodeURIComponent(req.url.split('?')[0])); if(!file.startsWith(base+path.sep))throw new Error('Invalid path'); res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await fs.readFile(file));}
    catch{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:`http://127.0.0.1:${server.address().port}/tests/reader.html`};
}
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('integration.mjs')) {
  const require=createRequire(import.meta.url);
  const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
  if(!process.env.CHROME_PATH)throw new Error('Set CHROME_PATH to Chrome for Testing / Chromium executable');
  await fs.mkdir('artifacts',{recursive:true});
  const dir=path.resolve('extension');
  const context=await chromium.launchPersistentContext(path.resolve('artifacts/integration-profile'),{executablePath:process.env.CHROME_PATH,headless:true,args:[`--load-extension=${dir}`,`--disable-extensions-except=${dir}`,'--enable-unsafe-extension-debugging']});
  const fixture=await startFixture();
  try {console.log(await integration(context.browser(),fixture.url));}
  finally{await context.close();fixture.server.close();}
}
