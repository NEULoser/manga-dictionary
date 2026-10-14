(() => {
  if (globalThis.__mangaReaderInstalled) return;
  globalThis.__mangaReaderInstalled = true;
  const host = document.createElement('div'); host.id = 'manga-reader-extension';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host{color-scheme:light}*{box-sizing:border-box}button,select,textarea,input{font:inherit}button,select{cursor:pointer}
    .panel{position:fixed;pointer-events:auto;width:360px;max-width:calc(100vw - 20px);max-height:calc(100vh - 24px);overflow:auto;right:14px;top:12px;background:#fff;color:#23322d;border:1px solid #c8ddd2;border-radius:14px;box-shadow:0 12px 44px #142f3433;font:14px/1.5 system-ui,'Microsoft YaHei',sans-serif;padding:16px}
    .panel.sidebar{width:380px;height:calc(100vh - 24px)}header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px}h1{font-size:16px;margin:0}button{background:#eff5f1;color:#244338;border:1px solid #c8ddd2;border-radius:7px;padding:6px 10px}button:hover{background:#dceee3}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #267652;outline-offset:2px}button:disabled{opacity:.5;cursor:wait}.primary{background:#286749;color:white}.primary:hover{background:#1f553c}
    header{position:sticky;top:0;background:white;z-index:2;padding:4px 0;box-shadow:0 -16px 0 white}.controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}select{background:#fff;color:#23322d;border:1px solid #c8ddd2;border-radius:6px;padding:6px}textarea{width:100%;min-height:90px;max-height:200px;resize:vertical;border:1px solid #c8ddd2;border-radius:7px;padding:9px;color:#23322d;background:#fff}label{display:block;margin:8px 0 4px}.muted{font-size:12px;color:#586f63}.status{padding:9px;background:#f0f6f2;border-radius:7px;margin:10px 0;white-space:pre-wrap}.error{color:#9b301d;background:#fff1ed}.tokens{margin:12px 0;line-height:2.4;white-space:pre-wrap}.token{padding:3px 7px;margin:2px;border-radius:5px}.token.active{background:#286749;color:white}.entry{border-top:1px solid #dfebe3;padding:10px 0}.entry h2{font-size:17px;margin:0 0 4px}.entry p{margin:5px 0;white-space:pre-wrap}ol{padding-left:22px;margin:8px 0}.overlay{position:fixed;inset:0;pointer-events:auto;cursor:crosshair;background:#0000000d;touch-action:none}.hint{position:fixed;top:14px;left:50%;transform:translateX(-50%);padding:8px 16px;background:#244338;color:#fff;border-radius:8px;pointer-events:none;font:14px system-ui}.rectangle{position:absolute;border:2px solid #288657;background:#69bf8a22;pointer-events:none}.hidden{display:none!important}
  </style>
  <section class="panel hidden" aria-label="漫画伴读">
    <header><h1>漫画伴读 <span class="muted">离线</span></h1><button id="close" aria-label="关闭">✕</button></header>
    <div class="controls"><select id="language" aria-label="原文语言"><option value="ja">日语</option><option value="en">英语</option></select><label><input id="vertical" type="checkbox" checked>日语竖排</label><button id="display">切到侧边栏</button></div>
    <div class="controls"><button id="select" class="primary">框选图片</button><span class="muted">Alt+Shift+D · Esc 退出</span></div>
    <div id="status" class="status" role="status">框选一个对话框；也可直接输入原文查词。</div>
    <label for="text">识别原文 · 可以修改</label><textarea id="text" maxlength="6000" placeholder="日语：昨日、学校で食べました。&#10;英语：I found a beautiful book."></textarea>
    <div class="controls"><button id="analyse">重新分词</button><button id="clear">清空</button></div>
    <div id="tokens" class="tokens" aria-label="点击词汇查词"></div><div id="result" aria-live="polite"></div>
    <p class="muted">仅在本机识别和查词。简体中文释义来自离线词典；词义可能不完整。复杂字体、注音假名请手动修正。</p>
  </section>
  <div class="overlay hidden"><div class="hint">拖动框选可见对话框 · Esc 取消</div><div class="rectangle hidden"></div></div>`;
  document.documentElement.append(host);
  // Keep comic readers' page-turn handlers from receiving panel interactions.
  for (const type of ['click', 'dblclick', 'pointerdown', 'pointerup', 'contextmenu', 'keydown', 'keyup']) shadow.addEventListener(type, e => e.stopPropagation());
  const $ = id => shadow.getElementById(id);
  const panel = shadow.querySelector('.panel'), overlay = shadow.querySelector('.overlay'), rectangle = shadow.querySelector('.rectangle');
  let settings = {language: 'ja', vertical: true, sidebar: false};
  let busy = false, dismissed = false, start = null, selection = null, epoch = 0, lookupEpoch = 0, ready;
  let lastAnchor = {x: innerWidth - 380, y: 24};
  const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
  const controls = () => { for (const id of ['language', 'vertical', 'select', 'analyse', 'clear']) $(id).disabled = busy; $('vertical').disabled = busy || settings.language !== 'ja'; };
  const request = async data => {
    const r = await chrome.runtime.sendMessage({...data, route: 'background'});
    if (!r?.ok) throw new Error(r?.error || '扩展已断开，请刷新页面后重试。');
    return r.data;
  };
  function position() {
    panel.classList.toggle('sidebar', settings.sidebar);
    if (settings.sidebar) {panel.style.left = ''; panel.style.right = '14px'; panel.style.top = '12px';}
    else {panel.style.right = ''; panel.style.left = `${Math.max(10, Math.min(lastAnchor.x + 16, innerWidth - 380))}px`; panel.style.top = `${Math.max(12, Math.min(lastAnchor.y + 16, innerHeight - Math.min(panel.scrollHeight || 440, innerHeight - 24) - 12))}px`;}
    $('display').textContent = settings.sidebar ? '切到鼠标弹窗' : '切到侧边栏';
  }
  function show() {dismissed = false; panel.classList.remove('hidden'); position();}
  function cancelSelection() {overlay.classList.add('hidden'); rectangle.classList.add('hidden'); start = null; selection = null;}
  function begin() {
    if (busy) {show(); status('识别任务正在运行，请稍后重新框选。'); return;}
    cancelSelection(); panel.classList.add('hidden'); overlay.classList.remove('hidden');
  }
  async function save() {await chrome.storage.local.set({preferences: settings});}
  ready = chrome.storage.local.get('preferences').then(s => {
    const p = s.preferences || {};
    settings = {language: p.language === 'en' ? 'en' : 'ja', vertical: p.vertical !== false, sidebar: p.sidebar === true};
    $('language').value = settings.language; $('vertical').checked = settings.vertical; controls(); position();
  });
  $('close').onclick = () => {dismissed = true; panel.classList.add('hidden'); cancelSelection();};
  $('select').onclick = begin;
  $('display').onclick = () => {settings.sidebar = !settings.sidebar; position(); save().catch(e => status(e.message, true));};
  $('language').onchange = () => {
    settings.language = $('language').value; epoch++; lookupEpoch++; $('tokens').replaceChildren(); $('result').replaceChildren(); controls(); save().catch(e => status(e.message, true)); status('语言已切换，请重新识别或分词。');
  };
  $('vertical').onchange = () => {settings.vertical = $('vertical').checked; save().catch(e => status(e.message, true));};
  $('clear').onclick = () => {epoch++; lookupEpoch++; $('text').value = ''; $('tokens').replaceChildren(); $('result').replaceChildren(); status('原文与结果已清空。');};
  function render(data) {
    $('text').value = data.text; $('tokens').replaceChildren(); $('result').replaceChildren(); lookupEpoch++;
    for (const token of data.tokens) {
      if (!token.clickable) {$('tokens').append(document.createTextNode(token.surface)); continue;}
      const b = document.createElement('button'); b.className = 'token'; b.textContent = token.surface;
      b.title = [token.base, token.reading, token.pos].filter(Boolean).join(' · ');
      b.onclick = async () => {
        const id = ++lookupEpoch;
        shadow.querySelectorAll('.token.active').forEach(x => x.classList.remove('active')); b.classList.add('active');
        $('result').textContent = '正在读取离线词典…';
        try {
          const result = await request({type: 'lookup', token, language: settings.language});
          if (id !== lookupEpoch) return;
          $('result').replaceChildren();
          const meta = document.createElement('p'); meta.textContent = `原形：${token.base}${token.reading ? ' · ' + token.reading : ''}${token.pos ? ' · ' + token.pos : ''}`; $('result').append(meta);
          if (!result.entries.length) {const p = document.createElement('p'); p.textContent = '没有中文释义。请检查 OCR 原文，或尝试原形／汉字写法。'; $('result').append(p);}
          for (const entry of result.entries) {
            const el = document.createElement('article'); el.className = 'entry';
            const h = document.createElement('h2'); h.textContent = entry.word; el.append(h);
            const p = document.createElement('p'); p.className = 'muted'; p.textContent = [entry.reading || token.reading, entry.pos || token.pos].filter(Boolean).join(' · '); el.append(p);
            const ol = document.createElement('ol'); for (const gloss of entry.glosses) {const li = document.createElement('li'); li.textContent = gloss; ol.append(li);} el.append(ol); $('result').append(el);
          }
          const source = document.createElement('p'); source.className = 'muted'; source.textContent = '词典来源：' + result.source; $('result').append(source); position();
        } catch(e) {if (id === lookupEpoch) $('result').textContent = e.message;}
      }; $('tokens').append(b);
    }
    status(data.text ? `点击词汇查看中文释义${data.confidence !== undefined ? ' · OCR 置信度 ' + data.confidence + '%（仅供参考）' : ''}` : '没有识别出文字。请缩小选区、调整竖排选项，或手动输入原文后重新分词。', !data.text);
    position();
  }
  async function run(operation) {
    const id = ++epoch; busy = true; lookupEpoch++; $('tokens').replaceChildren(); $('result').replaceChildren(); controls();
    try {const result = await operation(); if (id === epoch) render(result);}
    catch (e) {if (id === epoch) status(e.message, true);}
    finally {busy = false; controls();}
  }
  $('analyse').onclick = () => {
    const text = $('text').value;
    if (!text.trim()) {status('请先输入或识别原文。', true); return;}
    status('正在本地分词…'); run(() => request({type: 'analyse', text, language: settings.language}));
  };
  $('text').addEventListener('input', () => {epoch++; lookupEpoch++; $('tokens').replaceChildren(); $('result').replaceChildren(); status('原文已修改，点击“重新分词”更新词汇。');});
  overlay.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); start = {x: e.clientX, y: e.clientY}; selection = {scrollX, scrollY, w: innerWidth, h: innerHeight}; overlay.setPointerCapture(e.pointerId);
    rectangle.classList.remove('hidden'); rectangle.style.cssText = `left:${start.x}px;top:${start.y}px;width:0;height:0;`;
  });
  overlay.addEventListener('pointermove', e => {
    if (!start) return;
    const x = Math.max(0, Math.min(innerWidth, e.clientX)), y = Math.max(0, Math.min(innerHeight, e.clientY));
    rectangle.style.cssText = `left:${Math.min(x,start.x)}px;top:${Math.min(y,start.y)}px;width:${Math.abs(x-start.x)}px;height:${Math.abs(y-start.y)}px;`;
  });
  overlay.addEventListener('pointerup', async e => {
    if (!start) return;
    const x = Math.max(0, Math.min(innerWidth, e.clientX)), y = Math.max(0, Math.min(innerHeight, e.clientY));
    const rect = {x: Math.min(start.x,x), y: Math.min(start.y,y), w: Math.abs(x-start.x), h: Math.abs(y-start.y)};
    const view = selection; lastAnchor = {x, y}; cancelSelection();
    if (rect.w < 8 || rect.h < 8) {show(); status('选区太小，请拖动框选文字区域。', true); return;}
    if (scrollX !== view.scrollX || scrollY !== view.scrollY || innerWidth !== view.w || innerHeight !== view.h) {show(); status('页面位置发生变化，请重新框选。', true); return;}
    await run(async () => {
      host.style.visibility = 'hidden';
      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 80));
        const pending = request({type: 'ocr', rect, viewport: {w: view.w, h: view.h}, language: settings.language, vertical: settings.vertical});
        // Keep the overlay hidden until captureVisibleTab has completed.
        const result = await pending;
        if (scrollX !== view.scrollX || scrollY !== view.scrollY || innerWidth !== view.w || innerHeight !== view.h) throw new Error('识别期间页面位置发生变化，请重新框选。');
        return result;
      } finally {host.style.visibility = ''; if (!dismissed) show();}
    });
  });
  overlay.addEventListener('pointercancel', () => {cancelSelection(); show();});
  overlay.addEventListener('wheel', e => e.preventDefault(), {passive:false});
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (!overlay.classList.contains('hidden') || !panel.classList.contains('hidden'))) {dismissed = true; cancelSelection(); panel.classList.add('hidden'); e.preventDefault(); e.stopPropagation();}
  }, true);
  addEventListener('resize', () => {if (start) {cancelSelection(); show(); status('窗口大小已变化，请重新框选。', true);} position();});
  chrome.runtime.onMessage.addListener(m => {
    if (m.type === 'activate') ready.then(() => {show(); if (m.select) begin();}).catch(e => {show(); status(e.message, true);});
    if (m.type === 'captured' && busy) {host.style.visibility = ''; if (!dismissed) show(); status('正在加载本地模型…');}
    if (m.type === 'progress' && busy) status(m.text);
  });
})();
