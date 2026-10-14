import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
export async function run() {
  for (const file of ['logic.js', 'content.js', 'background.js', 'engine.js']) new vm.Script(await fs.readFile('extension/' + file, 'utf8'), {filename:file});
  const ctx = {}; vm.createContext(ctx); vm.runInContext(await fs.readFile('extension/logic.js','utf8'),ctx);
  const logic = ctx.MangaLogic;
  assert.equal(logic.normalize('美し\nい 本。', 'ja'), '美しい本。');
  assert.equal(logic.normalize('I found a beau-\ntiful\nbook.', 'en'), 'I found a beautiful book.');
  assert.equal(logic.kana('タベマシタ'), 'たべました');
  const crop = logic.crop({x:10,y:20,w:30,h:40},{w:100,h:200},200,400);
  assert.deepEqual(JSON.parse(JSON.stringify(crop)), {x:20,y:40,w:60,h:80});
  assert.throws(() => logic.crop({x:-1,y:20,w:30,h:40},{w:100,h:200},200,400));
  assert.throws(() => logic.crop({x:90,y:20,w:30,h:40},{w:100,h:200},200,400));
  assert.throws(() => logic.crop({x:0,y:0,w:30,h:40},{w:0,h:200},200,400));
  assert.equal(logic.englishTokens("I can't wait!").filter(t=>t.clickable).length,3);
  const ja = JSON.parse(await fs.readFile('extension/data/ja.json','utf8'));
  const en = JSON.parse(await fs.readFile('extension/data/en.json','utf8'));
  assert(ja.count > 10000 && en.count > 10000);
  assert(ja.entries['食べる'].some(e => e.glosses.some(g => g.includes('吃'))));
  assert(en.entries.beautiful.some(e=>e.glosses.some(g=>g.includes('美丽'))));
  assert(en.aliases.went.includes('go'));
  const manifest = JSON.parse(await fs.readFile('extension/manifest.json','utf8'));
  assert(!manifest.host_permissions && !manifest.content_scripts);
  assert(manifest.permissions.includes('activeTab'));
  assert(manifest.content_security_policy.extension_pages.includes("connect-src 'self'"));
  for (const lang of ['eng','jpn','jpn_vert']) assert((await fs.stat(`extension/data/${lang}.traineddata`)).size > 1000000);
  return {passed: true, checks: 'JS syntax, OCR text normalization, crop validation, kana conversion, English tokenization, dictionary coverage/lemmas, permissions, model integrity', dictionaryCounts: {ja:ja.count,en:en.count}};
}
// CLI entry; importers call run() themselves.
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('unit.mjs')) console.log(await run());
