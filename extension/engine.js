const root = chrome.runtime.getURL('');
let tokenizerPromise;
let worker;
let workerLanguage;
let serial = Promise.resolve();
const dictionaries = new Map();
async function dictionary(language) {
  if (!dictionaries.has(language)) dictionaries.set(language, fetch(root + `data/${language}.json`).then(r => {
    if (!r.ok) throw new Error('词典资源缺失，请重新解压完整扩展包。');
    return r.json();
  }).catch(e => { dictionaries.delete(language); throw e; }));
  return dictionaries.get(language);
}
async function tokenizer() {
  // kuromoji uses path.join, which corrupts URL schemes; resolve relative to engine.html.
  if (!tokenizerPromise) tokenizerPromise = new Promise((resolve, reject) => kuromoji.builder({dicPath: 'vendor/dict/'}).build((e, t) => e ? reject(new Error('本地分词词典加载失败，请检查 vendor/dict 文件。')) : resolve(t))).catch(e => {tokenizerPromise = null; throw e;});
  return tokenizerPromise;
}
async function analyse(text, language) {
  if (!['ja', 'en'].includes(language)) throw new Error('请选择日语或英语。');
  text = MangaLogic.normalize(text, language);
  if (text.length > 6000) throw new Error('文字过长，请缩小选区。');
  if (language === 'en') return {text, tokens: MangaLogic.englishTokens(text)};
  const t = await tokenizer();
  const positions = {'名詞':'名词','動詞':'动词','形容詞':'形容词','副詞':'副词','助詞':'助词','助動詞':'助动词','接続詞':'连词','感動詞':'感叹词','連体詞':'连体词','接頭詞':'前缀','記号':'符号','フィラー':'填充词','その他':'其他'};
  return {text, tokens: t.tokenize(text).map(x => ({surface: x.surface_form, base: x.basic_form === '*' ? x.surface_form : x.basic_form, reading: MangaLogic.kana(x.reading === '*' ? '' : x.reading), pos: positions[x.pos] || x.pos, clickable: x.pos !== '記号'}))};
}
async function lookup(token, language) {
  const dict = await dictionary(language);
  const keys = [...new Set([token.base, token.surface, token.reading].filter(Boolean).map(x => language === 'en' ? x.toLowerCase() : x))];
  let entries = [];
  for (const key of keys) {
    if (Object.hasOwn(dict.entries, key)) entries.push(...dict.entries[key]);
    if (dict.aliases && Object.hasOwn(dict.aliases, key)) for (const base of dict.aliases[key]) if (Object.hasOwn(dict.entries, base)) entries.push(...dict.entries[base]);
  }
  entries = [...new Map(entries.map(e => [JSON.stringify(e), e])).values()].slice(0, 12);
  return {entries, source: dict.source, count: dict.count};
}
async function ocr(m) {
  if (!['ja', 'en'].includes(m.language)) throw new Error('请选择原文语言。');
  const lang = m.language === 'en' ? 'eng' : m.vertical ? 'jpn_vert' : 'jpn';
  const progress = text => chrome.runtime.sendMessage({route: 'progress', tabId: m.tabId, text}).catch(() => {});
  if (!m.image?.startsWith('data:image/png;base64,')) throw new Error('截图格式无效。');
  const bytes = Uint8Array.from(atob(m.image.slice(22)), c => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
  let canvas;
  try {
    const r = MangaLogic.crop(m.rect, m.viewport, bitmap.width, bitmap.height);
    if (r.w * r.h > 12000000) throw new Error('选区过大，请只框选一个对话框。');
    // Upscale small text, add a white margin; do not binarize away thin strokes.
    const scale = Math.min(2, Math.max(1, 1000 / Math.max(r.w, r.h)));
    canvas = document.createElement('canvas');
    canvas.width = Math.round(r.w * scale) + 40; canvas.height = Math.round(r.h * scale) + 40;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 20, 20, canvas.width - 40, canvas.height - 40);
  } finally {bitmap.close(); m.image = null;}
  try {
    progress('正在加载本地 OCR 模型…');
    if (!worker || workerLanguage !== lang) {
      if (worker) await worker.terminate();
      worker = null; workerLanguage = null;
      worker = await Tesseract.createWorker(lang, 1, {workerPath: root + 'vendor/worker.min.js', corePath: root + 'vendor/core/', langPath: root + 'data/', workerBlobURL: false, gzip: false, cacheMethod: 'none'});
      workerLanguage = lang;
    }
    progress('正在本地识别，复杂字体可能需要手动修正…');
    await worker.setParameters({tessedit_pageseg_mode: m.language === 'ja' && m.vertical ? '5' : '6', preserve_interword_spaces: '1'});
    const result = await worker.recognize(canvas);
    progress('正在分词…');
    return {...await analyse(result.data.text, m.language), confidence: Math.round(result.data.confidence)};
  } catch (e) {
    if (worker) await worker.terminate().catch(() => {});
    worker = null; workerLanguage = null;
    throw new Error('本地识别失败：' + e.message + '。可修正原文后重新分词，或缩小选区重试。');
  } finally {canvas.width = canvas.height = 0;}
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.route !== 'engine' || sender.id !== chrome.runtime.id || sender.tab) return;
  const run = async () => {
    if (m.type === 'analyse') return analyse(m.text, m.language);
    if (m.type === 'lookup') return lookup(m.token, m.language);
    if (m.type === 'ocr') return ocr(m);
    throw new Error('未知引擎操作');
  };
  const job = serial.then(run);
  serial = job.catch(() => {});
  job.then(data => reply({ok: true, data}), e => reply({ok: false, error: String(e.message)}));
  return true;
});
