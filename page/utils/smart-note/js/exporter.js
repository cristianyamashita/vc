/* Smart Note — export (md, html, txt, pdf, json) and import helpers. */
window.SNExport = (function () {
  const M = window.SNMarkdown;
  const esc = M.esc;

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function safeName(title) {
    return (String(title || 'untitled').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80)) || 'untitled';
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  /** Clone of the page content with image assets inlined as data URLs. */
  async function inlined(html, getAssetBlob, titleOf) {
    const box = document.createElement('div');
    box.innerHTML = html || '';
    const imgs = Array.from(box.querySelectorAll('figure[data-asset] img, img[data-asset]'));
    for (const img of imgs) {
      const fig = img.closest('figure[data-asset]');
      const id = fig ? fig.dataset.asset : img.dataset.asset;
      try {
        const blob = await getAssetBlob(id);
        if (blob) img.setAttribute('src', await blobToDataUrl(blob));
      } catch (err) { /* leave as is */ }
    }
    if (titleOf) box.querySelectorAll('.page-link[data-page] .pl-title').forEach((s) => { const t = titleOf(s.parentNode.dataset.page); if (t !== undefined) s.textContent = t; });
    return box;
  }

  const EXPORT_CSS = `
    body { font: 15px/1.6 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; color: #1b2423; background: #fff; margin: 0; padding: 32px; max-width: 820px; margin: 0 auto; }
    h1.doc-title { font-size: 30px; margin: 0 0 18px; }
    h1 { font-size: 26px; margin: 22px 0 8px; } h2 { font-size: 21px; margin: 18px 0 6px; } h3 { font-size: 17px; margin: 14px 0 4px; }
    p { margin: 6px 0; } ul, ol { margin: 6px 0; padding-left: 26px; }
    blockquote { margin: 8px 0; padding: 4px 14px; border-left: 3px solid #008f7d; color: #3d4b49; }
    pre { background: #f1f4f3; border: 1px solid #d7e0de; border-radius: 6px; padding: 10px 12px; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap; }
    code { font-family: ui-monospace, Menlo, Consolas, monospace; background: #eef3f2; padding: 0 4px; border-radius: 4px; font-size: .92em; }
    hr { border: 0; border-top: 1px solid #c9d4d2; margin: 16px 0; }
    .todo { position: relative; padding-left: 26px; margin: 4px 0; }
    .todo::before { content: ""; position: absolute; left: 2px; top: 4px; width: 14px; height: 14px; border: 1.5px solid #6b7a78; border-radius: 3px; }
    .todo[data-checked]::before { background: #008f7d; border-color: #008f7d; }
    .todo[data-checked]::after { content: ""; position: absolute; left: 7px; top: 6px; width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
    .todo[data-checked] { color: #6b7a78; text-decoration: line-through; }
    .callout { position: relative; padding: 10px 14px 10px 42px; margin: 8px 0; border-radius: 8px; background: #eef6f4; border: 1px solid #cfe3df; }
    .callout::before { content: attr(data-icon); position: absolute; left: 12px; top: 9px; font-size: 18px; }
    table.tbl { border-collapse: collapse; width: 100%; margin: 8px 0; }
    table.tbl td, table.tbl th { border: 1px solid #c9d4d2; padding: 6px 9px; vertical-align: top; text-align: left; }
    table.tbl th { background: #eef3f2; font-weight: 600; }
    figure.img { margin: 12px 0; text-align: center; }
    figure.img[data-align="left"] { text-align: left; } figure.img[data-align="right"] { text-align: right; }
    figure.img img { max-width: 100%; height: auto; border-radius: 6px; }
    figure.img[data-w="25"] img { width: 25%; } figure.img[data-w="50"] img { width: 50%; } figure.img[data-w="75"] img { width: 75%; } figure.img[data-w="100"] img { width: 100%; }
    figcaption { font-size: 13px; color: #62716e; margin-top: 4px; }
    .page-link { display: inline-flex; gap: 6px; align-items: center; padding: 4px 8px; border: 1px solid #c9d4d2; border-radius: 6px; margin: 4px 0; }
    a { color: #008f7d; }
    @media print { body { padding: 0; } figure.img, table.tbl, pre, .callout { break-inside: avoid; } h1, h2, h3 { break-after: avoid; } }
  `;

  function standaloneHtml(title, box) {
    return `<!DOCTYPE html>\n<html lang="${esc(document.documentElement.lang || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${EXPORT_CSS}</style></head><body><h1 class="doc-title">${esc(title)}</h1>\n${box.innerHTML}\n</body></html>`;
  }

  function printPdf(title, box) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
    document.body.appendChild(frame);
    const cleanup = () => { setTimeout(() => frame.remove(), 1000); };
    frame.onload = () => {
      const win = frame.contentWindow;
      const run = () => { try { win.focus(); win.print(); } catch (err) { /* ignore */ } };
      win.addEventListener('afterprint', cleanup);
      const imgs = Array.from(win.document.images);
      const pending = imgs.filter((i) => !i.complete);
      if (!pending.length) { run(); return; }
      let left = pending.length;
      const done = () => { if (--left <= 0) run(); };
      pending.forEach((i) => { i.addEventListener('load', done); i.addEventListener('error', done); });
      setTimeout(run, 4000);
    };
    frame.srcdoc = standaloneHtml(title, box);
    setTimeout(cleanup, 120000);
  }

  async function exportJson(docs, getAssetBlob) {
    const ids = new Set();
    docs.forEach((d) => {
      const box = document.createElement('div');
      box.innerHTML = d.html || '';
      box.querySelectorAll('[data-asset]').forEach((el) => ids.add(el.dataset.asset));
    });
    const assets = [];
    for (const id of ids) {
      try {
        const blob = await getAssetBlob(id);
        if (blob) assets.push({ id, type: blob.type, data: await blobToDataUrl(blob) });
      } catch (err) { /* skip */ }
    }
    return JSON.stringify({ app: 'smart-note', version: 1, exportedAt: new Date().toISOString(), docs: docs.map((d) => ({ id: d.id, parentId: d.parentId || null, title: d.title, html: d.html, createdAt: d.createdAt, updatedAt: d.updatedAt, order: d.order || 0 })), assets }, null, 1);
  }

  /** Parses a Smart Note JSON export; returns {docs, assets} with fresh ids (page links remapped). */
  async function parseJson(text, uid, parentId) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'smart-note' || !Array.isArray(data.docs)) throw new Error('not a Smart Note file');
    const docMap = new Map();
    data.docs.forEach((d) => docMap.set(d.id, uid()));
    const assetMap = new Map();
    const assets = [];
    for (const a of data.assets || []) {
      const id = uid();
      assetMap.set(a.id, id);
      assets.push({ id, blob: await dataUrlToBlob(a.data), type: a.type, createdAt: Date.now() });
    }
    const docs = data.docs.map((d) => {
      const box = document.createElement('div');
      box.innerHTML = d.html || '';
      box.querySelectorAll('[data-asset]').forEach((el) => { const n = assetMap.get(el.dataset.asset); if (n) el.dataset.asset = n; else el.removeAttribute('data-asset'); });
      box.querySelectorAll('[data-page]').forEach((el) => { const n = docMap.get(el.dataset.page); if (n) el.dataset.page = n; });
      const parentKnown = d.parentId && docMap.has(d.parentId);
      return {
        id: docMap.get(d.id), parentId: parentKnown ? docMap.get(d.parentId) : (parentId || null), title: d.title || '',
        html: M.normalizeHtml(box.innerHTML), createdAt: d.createdAt || Date.now(), updatedAt: Date.now(), order: d.order || 0,
      };
    });
    return { docs, assets };
  }

  return { download, safeName, inlined, standaloneHtml, printPdf, exportJson, parseJson, blobToDataUrl, dataUrlToBlob };
})();
