/* Also used by the acceptance tests. No network or DOM dependencies. */
globalThis.MangaLogic = {
  normalize(text, language) {
    text = String(text).normalize('NFKC').trim();
    return language === 'ja' ? text.replace(/\s+/g, '') : text.replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2').replace(/\s+/g, ' ');
  },
  crop(rect, viewport, width, height) {
    const values = [rect?.x, rect?.y, rect?.w, rect?.h, viewport?.w, viewport?.h, width, height];
    if (!values.every(Number.isFinite) || viewport.w <= 0 || viewport.h <= 0 || rect.w < 8 || rect.h < 8 || rect.x < 0 || rect.y < 0 || rect.x + rect.w > viewport.w + 1 || rect.y + rect.h > viewport.h + 1) throw new Error('选区无效，请重新框选。');
    const sx = width / viewport.w, sy = height / viewport.h;
    const x = Math.round(rect.x * sx), y = Math.round(rect.y * sy);
    return {x, y, w: Math.min(width - x, Math.round(rect.w * sx)), h: Math.min(height - y, Math.round(rect.h * sy))};
  },
  englishTokens(text) {
    return [...text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?|[^A-Za-z]+/g)].map(m => ({surface: m[0], base: m[0].toLowerCase(), reading: '', pos: '', clickable: /^[A-Za-z]/.test(m[0])}));
  },
  kana(text) { return String(text || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)); }
};
