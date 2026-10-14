import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
export async function build(base = '.') {
  const context = {console}; vm.createContext(context);
  vm.runInContext(await fs.readFile(path.join(base, 'extension/vendor/t2cn.js'), 'utf8'), context);
  const simplify = context.OpenCC.Converter({from: 'tw', to: 'cn'});
  const ja = {source: '中文维基词典 / Kaikki（CC BY-SA 4.0）；释义经 OpenCC 转简体', entries: Object.create(null), aliases: Object.create(null)};
  const add = (dict, key, entry) => {
    if (!dict.entries[key]) dict.entries[key] = [];
    if (!dict.entries[key].some(x => JSON.stringify(x) === JSON.stringify(entry))) dict.entries[key].push(entry);
  };
  const alias = (dict, key, word) => {
    if (!key || key === word) return;
    if (!dict.aliases[key]) dict.aliases[key] = [];
    if (!dict.aliases[key].includes(word)) dict.aliases[key].push(word);
  };
  for (const file of ['ja-s.jsonl', 'ja-t.jsonl']) {
    for (const line of (await fs.readFile(path.join(base, 'downloads', file), 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      const x = JSON.parse(line);
      const glosses = [...new Set((x.senses || []).flatMap(s => s.glosses || []).map(simplify))];
      if (!x.word || !glosses.length || ['romanization', 'soft-redirect'].includes(x.pos)) continue;
      const form = (x.forms || []).find(f => f.tags?.includes('canonical'));
      let reading = '';
      if (form?.ruby?.length) {
        let offset = 0;
        for (const [written, ruby] of form.ruby) {
          const i = x.word.indexOf(written, offset);
          if (i < 0) continue;
          reading += x.word.slice(offset, i) + ruby; offset = i + written.length;
        }
        reading += x.word.slice(offset);
      } else if (/^[ぁ-ゖァ-ヶー]+$/.test(x.word)) reading = x.word;
      reading = reading.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
      const pos = simplify(x.pos_title || ({noun:'名词',verb:'动词',adj:'形容词',adv:'副词',name:'专有名词',pron:'代词',particle:'助词',intj:'感叹词',conj:'连词',suffix:'后缀',prefix:'前缀',phrase:'短语'}[x.pos] || '词性未标注'));
      add(ja, x.word, {word: x.word, reading, pos, glosses});
      alias(ja, reading, x.word);
    }
  }
  const en = {source: 'ECDICT 常用词子集（MIT）', entries: Object.create(null), aliases: Object.create(null)};
  const input = await fs.readFile(path.join(base, 'downloads/ecdict.csv'), 'utf8');
  let field = '', row = [], quoted = false, headers, kept = 0;
  const flush = () => {
    row.push(field); field = '';
    if (!headers) {headers = row; row = []; return;}
    const x = Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])); row = [];
    const word = x.word.toLowerCase();
    if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word) || !x.translation || !(Number(x.bnc) > 0 || Number(x.frq) > 0 || Number(x.collins) > 0 || x.oxford === '1' || x.tag)) return;
    const glosses = x.translation.split(/\\n|\n/).filter(Boolean).map(simplify);
    const labels = {'n.':'名词','v.':'动词','vt.':'及物动词','vi.':'不及物动词','a.':'形容词','adj.':'形容词','adv.':'副词','pron.':'代词','prep.':'介词','conj.':'连词','interj.':'感叹词','num.':'数词','art.':'冠词'};
    const pos = [...new Set(glosses.flatMap(g => (g.match(/\b(?:n|v|vt|vi|a|adj|adv|pron|prep|conj|interj|num|art)\./g) || []).map(p => labels[p])))].join('／') || x.pos || '词性未标注';
    add(en, word, {word, reading: x.phonetic ? '/' + x.phonetic + '/' : '', pos, glosses}); kept++;
    for (const item of x.exchange.split('/')) {
      const [tag, value] = item.split(':');
      if (!value) continue;
      if (tag === '0') alias(en, word, value); else alias(en, value, word);
    }
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {if (quoted && input[i+1] === '"') {field += '"'; i++;} else quoted = !quoted;}
    else if (c === ',' && !quoted) {row.push(field); field = '';}
    else if (c === '\n' && !quoted) flush();
    else if (c !== '\r') field += c;
  }
  if (field || row.length) flush();
  if (quoted) throw new Error('Invalid CSV: unterminated field');
  const counts = {};
  for (const [lang, dict] of [['ja', ja], ['en', en]]) {
    dict.count = Object.keys(dict.entries).length;
    counts[lang] = dict.count;
    await fs.writeFile(path.join(base, `extension/data/${lang}.json`), JSON.stringify(dict));
  }
  await fs.writeFile(path.join(base, 'extension/data/catalog.json'), JSON.stringify({built: '2026-10-13', counts, japaneseLicense: 'CC-BY-SA-4.0', englishLicense: 'MIT'}, null, 2));
  return counts;
}
