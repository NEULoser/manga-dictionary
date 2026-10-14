let creating;
let busy = false;
async function engine(message) {
  if (!(await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']})).length) {
    if (!creating) creating = chrome.offscreen.createDocument({url: 'engine.html', reasons: ['WORKERS', 'BLOBS'], justification: '本地 OCR、截图裁剪与离线词典分词'}).finally(() => { creating = null; });
    await creating;
  }
  const result = await chrome.runtime.sendMessage({...message, route: 'engine'});
  if (!result?.ok) throw new Error(result?.error || '本地引擎没有响应，请重新加载扩展。');
  return result.data;
}
async function activate(tab, select = false) {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['content.js']});
    await chrome.tabs.sendMessage(tab.id, {type: 'activate', select});
  } catch (e) {
    console.warn('无法在此页面启用漫画伴读', e);
    await chrome.action.setBadgeText({tabId: tab.id, text: '!'});
    await chrome.action.setTitle({tabId: tab.id, title: '无法注入此页面。请打开普通漫画网页，Chrome 内部页面和内置 PDF 不受支持。'});
  }
}
chrome.action.onClicked.addListener(tab => activate(tab));
chrome.commands.onCommand.addListener(async command => {
  if (command === 'select-region') await activate((await chrome.tabs.query({active: true, currentWindow: true}))[0], true);
});
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.route === 'progress' && sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('engine.html') && !sender.tab) {
    chrome.tabs.sendMessage(m.tabId, {type: 'progress', text: m.text}).catch(() => {});
    return;
  }
  if (m.route !== 'background' || sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return;
  (async () => {
    if (m.type === 'analyse') return await engine({type: 'analyse', text: String(m.text || '').slice(0, 6000), language: m.language});
    if (m.type === 'lookup') return await engine({type: 'lookup', token: m.token, language: m.language});
    if (m.type !== 'ocr') throw new Error('未知操作');
    if (busy) throw new Error('另一个识别任务正在运行，请稍后重试。');
    busy = true;
    try {
      const active = (await chrome.tabs.query({active: true, windowId: sender.tab.windowId}))[0];
      if (active?.id !== sender.tab.id) throw new Error('页面已切换，请回到原页面重新框选。');
      const image = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {format: 'png'});
      await chrome.tabs.sendMessage(sender.tab.id, {type: 'captured'});
      return await engine({type: 'ocr', image, rect: m.rect, viewport: m.viewport, language: m.language, vertical: m.vertical, tabId: sender.tab.id});
    } finally { busy = false; }
  })().then(data => reply({ok: true, data}), e => reply({ok: false, error: e.message}));
  return true;
});
