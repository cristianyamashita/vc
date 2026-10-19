/* Smart Note — application shell: pages tree, toolbar, dialogs, preferences. */
(() => {
  const $ = (id) => document.getElementById(id);
  const I18N = window.SN_I18N;
  const DB = window.SNDB;
  const M = window.SNMarkdown;
  const X = window.SNExport;
  const PREFS_KEY = 'smartnote.prefs.v1';
  const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Courier New', 'Noto Sans JP', 'Comic Sans MS'];
  const SIZES = [11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40];

  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
  let lang = I18N[prefs.lang] ? prefs.lang : ((navigator.language || 'en').slice(0, 2) === 'pt' ? 'pt' : (navigator.language || 'en').slice(0, 2) === 'ja' ? 'ja' : 'en');
  let theme = prefs.theme === 'light' ? 'light' : 'dark';
  const expanded = new Set(prefs.expanded || []);
  const t = (k, vars) => {
    let s = (I18N[lang] && I18N[lang][k] !== undefined) ? I18N[lang][k] : (I18N.en[k] !== undefined ? I18N.en[k] : k);
    if (typeof s === 'string' && vars) Object.keys(vars).forEach((v) => { s = s.replace(new RegExp(`\\{${v}\\}`, 'g'), vars[v]); });
    return s;
  };
  const locale = () => ({ en: 'en-US', pt: 'pt-BR', ja: 'ja-JP' })[lang];

  const docs = new Map();
  let currentId = null;
  let dirty = false;
  let saveTimer = null;
  const assetUrls = new Map();

  /* ---------------- assets ---------------- */
  async function resolveAsset(id) {
    if (assetUrls.has(id)) return assetUrls.get(id);
    const a = await DB.getAsset(id);
    if (!a || !a.blob) return '';
    const url = URL.createObjectURL(a.blob);
    assetUrls.set(id, url);
    return url;
  }
  async function storeImage(blob) {
    const id = DB.uid();
    await DB.putAsset({ id, blob, type: blob.type, name: blob.name || '', createdAt: Date.now() });
    const url = URL.createObjectURL(blob);
    assetUrls.set(id, url);
    return { id, url };
  }
  async function getAssetBlob(id) { const a = await DB.getAsset(id); return a ? a.blob : null; }
  async function collectGarbage() {
    const used = new Set();
    const box = document.createElement('div');
    docs.forEach((d) => { box.innerHTML = d.html || ''; box.querySelectorAll('[data-asset]').forEach((el) => used.add(el.dataset.asset)); });
    const all = await DB.allAssets();
    const orphan = all.filter((a) => !used.has(a.id)).map((a) => a.id);
    if (orphan.length) await DB.deleteAssets(orphan);
  }

  /* ---------------- editor ---------------- */
  const editorEl = $('editor');
  let pendingImageLine = null;
  const editor = window.SNEditor({
    root: editorEl,
    menu: $('slash-menu'),
    t, locale,
    onChange: () => markDirty(),
    onState: updateToolbar,
    onSaveNow: () => { saveNow(); toast(t('saved')); },
    resolveAsset, storeImage,
    listPages: () => docList().filter((d) => d.id !== currentId).map((d) => ({ id: d.id, title: d.title || t('untitled'), path: pathOf(d.id).slice(0, -1).map((p) => p.title || t('untitled')).join(' / ') })),
    openPage: (id) => { if (docs.has(id)) openDoc(id); else toast(t('noMatch')); },
    createSubpage: async () => { const d = await createDoc(currentId, ''); renderTree(); return { id: d.id, title: d.title || t('untitled') }; },
    pickImage: (line) => { pendingImageLine = line || null; $('image-input').click(); },
    promptLink: () => openLinkDialog(),
  });

  /* ---------------- documents ---------------- */
  function docList() { return Array.from(docs.values()).sort((a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt); }
  function childrenOf(pid) { return docList().filter((d) => (d.parentId || null) === (pid || null)); }
  function pathOf(id) { const out = []; let d = docs.get(id); let guard = 0; while (d && guard++ < 50) { out.unshift(d); d = d.parentId ? docs.get(d.parentId) : null; } return out; }
  function subtree(id) { const out = [id]; childrenOf(id).forEach((c) => out.push(...subtree(c.id))); return out; }
  async function createDoc(parentId, title, html) {
    const siblings = childrenOf(parentId);
    const d = { id: DB.uid(), parentId: parentId || null, title: title || '', html: html || '<p><br></p>', createdAt: Date.now(), updatedAt: Date.now(), order: siblings.length ? Math.max(...siblings.map((s) => s.order || 0)) + 1 : 1 };
    docs.set(d.id, d);
    await DB.putDoc(d);
    if (parentId) expanded.add(parentId);
    return d;
  }
  function markDirty() {
    dirty = true;
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
    updateWords();
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (!currentId || !docs.has(currentId)) return Promise.resolve();
    const d = docs.get(currentId);
    const html = editor.getHtml();
    const title = $('doc-title').value;
    if (!dirty && d.html === html && d.title === title) { setStatus('saved'); return Promise.resolve(); }
    d.html = html;
    d.title = title;
    d.updatedAt = Date.now();
    dirty = false;
    return DB.putDoc(d).then(() => { setStatus('saved'); renderTreeTitle(d); }).catch(() => setStatus('saving'));
  }
  function setStatus(s) { const el = $('status'); el.dataset.state = s; el.textContent = t(s); }
  function updateWords() { $('words').textContent = `${editor.wordCount()} ${t('words')}`; }

  async function openDoc(id) {
    if (!docs.has(id)) return;
    if (currentId && currentId !== id) { editor.flushChange(); await saveNow(); }
    currentId = id;
    prefs.lastDoc = id;
    savePrefs();
    const d = docs.get(id);
    $('doc-title').value = d.title;
    editor.setHtml(d.html);
    editor.refreshPageLinks((pid) => (docs.has(pid) ? (docs.get(pid).title || t('untitled')) : undefined));
    renderCrumbs();
    renderTree();
    updateWords();
    setStatus('saved');
    location.hash = id;
    $('editor-scroll').scrollTop = 0;
  }
  async function newPage(parentId) {
    await saveNow();
    const d = await createDoc(parentId || null, '');
    await openDoc(d.id);
    $('doc-title').focus();
  }
  async function deleteDoc(id) {
    const d = docs.get(id);
    if (!d) return;
    const ids = subtree(id);
    const ok = await confirmDialog(ids.length > 1 ? t('deleteConfirmChildren', { title: d.title || t('untitled'), n: ids.length - 1 }) : t('deleteConfirm', { title: d.title || t('untitled') }));
    if (!ok) return;
    const parent = d.parentId;
    ids.forEach((i) => docs.delete(i));
    await DB.deleteDocs(ids);
    if (ids.includes(currentId)) {
      currentId = null;
      const next = parent && docs.has(parent) ? parent : (docList()[0] ? docList()[0].id : null);
      if (next) await openDoc(next); else await newPage(null);
    }
    renderTree();
    collectGarbage();
  }

  /* ---------------- sidebar ---------------- */
  let search = '';
  function matches(d, q) {
    if (!q) return true;
    const f = (s) => String(s || '').toLowerCase();
    if (f(d.title).includes(q)) return true;
    const box = document.createElement('div');
    box.innerHTML = d.html || '';
    return f(box.textContent).includes(q);
  }
  function renderTree() {
    const tree = $('tree');
    const q = search.trim().toLowerCase();
    const list = docList();
    if (!list.length) { tree.innerHTML = `<div class="tree-empty">${M.esc(t('noPages'))}</div>`; return; }
    let visible = null;
    if (q) {
      visible = new Set();
      list.forEach((d) => { if (matches(d, q)) pathOf(d.id).forEach((p) => visible.add(p.id)); });
      if (!visible.size) { tree.innerHTML = `<div class="tree-empty">${M.esc(t('noMatch'))}</div>`; return; }
    }
    const build = (pid, depth) => {
      let html = '';
      childrenOf(pid).forEach((d) => {
        if (visible && !visible.has(d.id)) return;
        const kids = childrenOf(d.id).filter((k) => !visible || visible.has(k.id));
        const open = q ? true : expanded.has(d.id);
        html += `<div class="node" data-id="${d.id}" style="--depth:${depth}">
          <div class="node-row${d.id === currentId ? ' active' : ''}" data-id="${d.id}">
            <button class="tw${kids.length ? '' : ' none'}${open ? ' open' : ''}" data-act="toggle" tabindex="-1"><i class="fa-solid fa-chevron-right"></i></button>
            <span class="node-ic">📄</span>
            <span class="node-title">${M.esc(d.title || t('untitled'))}</span>
            <span class="node-acts">
              <button data-act="add" title="${M.esc(t('newSubPage'))}"><i class="fa-solid fa-plus"></i></button>
              <button data-act="del" title="${M.esc(t('deletePage'))}"><i class="fa-solid fa-trash-can"></i></button>
            </span>
          </div>
          ${kids.length && open ? `<div class="node-kids">${build(d.id, depth + 1)}</div>` : ''}
        </div>`;
      });
      return html;
    };
    tree.innerHTML = build(null, 0);
    const active = tree.querySelector('.node-row.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }
  function renderTreeTitle(d) {
    const row = $('tree').querySelector(`.node-row[data-id="${d.id}"] .node-title`);
    if (row) row.textContent = d.title || t('untitled');
    renderCrumbs();
  }
  function renderCrumbs() {
    const el = $('crumbs');
    if (!currentId) { el.innerHTML = ''; return; }
    const path = pathOf(currentId);
    el.innerHTML = path.map((p, i) => (i < path.length - 1 ? `<button data-id="${p.id}">${M.esc(p.title || t('untitled'))}</button><span class="sep">/</span>` : `<span class="cur">${M.esc(p.title || t('untitled'))}</span>`)).join('');
  }
  $('tree').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    const row = e.target.closest('.node-row');
    if (!row) return;
    const id = row.dataset.id;
    if (btn) {
      const act = btn.dataset.act;
      if (act === 'toggle') { if (expanded.has(id)) expanded.delete(id); else expanded.add(id); prefs.expanded = Array.from(expanded); savePrefs(); renderTree(); }
      else if (act === 'add') newPage(id);
      else if (act === 'del') deleteDoc(id);
      return;
    }
    openDoc(id);
    if (narrow()) document.body.classList.add('no-sidebar');
  });
  $('crumbs').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) openDoc(b.dataset.id); });
  $('search').addEventListener('input', (e) => { search = e.target.value; renderTree(); });
  $('doc-title').addEventListener('input', () => { markDirty(); const d = docs.get(currentId); if (d) { d.title = $('doc-title').value; renderTreeTitle(d); } });
  $('doc-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); editor.focus(); } });
  const narrow = () => window.innerWidth <= 720;
  $('btn-sidebar').addEventListener('click', () => { document.body.classList.toggle('no-sidebar'); prefs.sidebar = !document.body.classList.contains('no-sidebar'); savePrefs(); });
  if (prefs.sidebar === false || (prefs.sidebar === undefined && narrow())) document.body.classList.add('no-sidebar');
  $('btn-new').addEventListener('click', () => newPage(null));
  $('btn-new-root').addEventListener('click', () => newPage(null));

  /* ---------------- toolbar ---------------- */
  const tb = $('toolbar');
  tb.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  function runCmd(cmd, val, anchor) {
    switch (cmd) {
      case 'undo': editor.undo(); break;
      case 'redo': editor.redo(); break;
      case 'code': editor.toggleCode(); break;
      case 'link': editor.saveSel(); openLinkDialog(); break;
      case 'clear': editor.clearFormat(); break;
      case 'insert': editor.openMenuAtCaret(); break;
      case 'more': toggleMenu($('menu-more'), anchor); break;
      case 'color': case 'hilite': toggleMenu(cmd === 'color' ? $('menu-color') : $('menu-hilite'), anchor); break;
      default: editor.exec(cmd, val);
    }
  }
  tb.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (b) runCmd(b.dataset.cmd, b.dataset.val, b);
  });
  $('menu-more').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (!b) return;
    closeMenus();
    runCmd(b.dataset.cmd, b.dataset.val, b);
  });
  $('block-type').addEventListener('change', (e) => { editor.convertLine(e.target.value); editor.focus(); });
  $('font-family').addEventListener('change', (e) => editor.setFont(e.target.value));
  $('font-size').addEventListener('change', (e) => editor.setFontSize(e.target.value ? +e.target.value : 0));
  function fillSelects() {
    $('font-family').innerHTML = `<option value="">${M.esc(t('fontDefault'))}</option>` + FONTS.map((f) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('');
    $('font-size').innerHTML = `<option value="">${M.esc(t('sizeDefault'))}</option>` + SIZES.map((s) => `<option value="${s}">${s}</option>`).join('');
    $('block-type').innerHTML = ['text', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'code', 'callout'].map((b) => `<option value="${b}">${M.esc(t('bt_' + b))}</option>`).join('');
  }
  const COLORS = ['', '#e07a6a', '#e0a84a', '#d7c54b', '#3fb950', '#1fb5a0', '#388bfd', '#9b7bf5', '#d65db1', '#8a9a97', '#000000', '#ffffff'];
  const HILITES = ['', '#fde68a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#ddd6fe', '#fecaca', '#ccfbf1', '#e5e7eb'];
  function buildPalettes() {
    $('menu-color').innerHTML = COLORS.map((c) => `<button data-c="${c}" class="sw${c ? '' : ' none'}" style="--c:${c || 'transparent'}" title="${c || M.esc(t('none'))}"></button>`).join('');
    $('menu-hilite').innerHTML = HILITES.map((c) => `<button data-c="${c}" class="sw${c ? '' : ' none'}" style="--c:${c || 'transparent'}" title="${c || M.esc(t('none'))}"></button>`).join('');
  }
  $('menu-color').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (!b) return; closeMenus(); editor.exec('foreColor', b.dataset.c || 'inherit'); });
  $('menu-hilite').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (!b) return; closeMenus(); editor.exec('hiliteColor', b.dataset.c || 'transparent'); });
  document.querySelectorAll('.menu').forEach((m) => m.addEventListener('mousedown', (e) => { if (!e.target.closest('input')) e.preventDefault(); }));

  function updateToolbar(st) {
    tb.querySelectorAll('button[data-state]').forEach((b) => b.classList.toggle('on', !!st[b.dataset.state]));
    if (document.activeElement !== $('block-type')) $('block-type').value = st.type || 'text';
    if (document.activeElement !== $('font-family')) $('font-family').value = FONTS.includes(st.font) ? st.font : '';
    if (document.activeElement !== $('font-size')) $('font-size').value = st.size && SIZES.includes(+st.size) ? String(st.size) : '';
    positionBar($('table-bar'), st.cell ? st.cell.closest('table') : null);
    positionBar($('fig-bar'), st.figure);
    if (st.figure) {
      $('fig-bar').querySelectorAll('button[data-fig]').forEach((b) => {
        const v = b.dataset.fig;
        b.classList.toggle('on', (v.startsWith('w:') && st.figure.dataset.w === v.slice(2)) || (v.startsWith('align:') && st.figure.dataset.align === v.slice(6)));
      });
    }
  }
  function positionBar(bar, target) {
    if (!target) { bar.hidden = true; bar._target = null; return; }
    bar._target = target;
    bar.hidden = false;
    const scroll = $('editor-scroll');
    const sr = scroll.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    let top = r.top - sr.top + scroll.scrollTop - bar.offsetHeight - 6;
    if (r.top - sr.top < bar.offsetHeight + 8) top = r.bottom - sr.top + scroll.scrollTop + 6;
    const left = Math.max(8, Math.min(r.left - sr.left + scroll.scrollLeft, scroll.clientWidth - bar.offsetWidth - 8));
    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;
  }
  $('editor-scroll').addEventListener('scroll', () => {
    ['table-bar', 'fig-bar'].forEach((id) => { const bar = $(id); if (!bar.hidden && bar._target && bar._target.isConnected) positionBar(bar, bar._target); else if (!bar.hidden) bar.hidden = true; });
    if (editor.isSlashOpen()) editor.positionSlash();
  });
  $('table-bar').addEventListener('mousedown', (e) => e.preventDefault());
  $('table-bar').addEventListener('click', (e) => { const b = e.target.closest('button[data-tbl]'); if (b) editor.tableAction(b.dataset.tbl); });
  $('fig-bar').addEventListener('mousedown', (e) => e.preventDefault());
  $('fig-bar').addEventListener('click', (e) => { const b = e.target.closest('button[data-fig]'); if (b) editor.figureAction(b.dataset.fig); });
  $('image-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const line = pendingImageLine;
    pendingImageLine = null;
    for (const f of files) await editor.insertImage(f, line && line.isConnected ? line : null);
  });

  /* ---------------- menus ---------------- */
  let openMenu = null;
  function toggleMenu(menu, anchor) {
    if (openMenu === menu) { closeMenus(); return; }
    closeMenus();
    openMenu = menu;
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    const left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8);
    menu.style.left = `${Math.max(4, left)}px`;
  }
  function closeMenus() { document.querySelectorAll('.menu').forEach((m) => { m.hidden = true; }); openMenu = null; }
  document.addEventListener('mousedown', (e) => { if (openMenu && !e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openMenu) closeMenus(); });
  $('btn-export').addEventListener('click', (e) => toggleMenu($('menu-export'), e.currentTarget));
  $('menu-export').addEventListener('click', (e) => { const b = e.target.closest('button[data-exp]'); if (!b) return; closeMenus(); doExport(b.dataset.exp); });
  $('btn-import').addEventListener('click', () => $('import-input').click());
  $('import-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) await importFile(f);
  });

  /* ---------------- export / import ---------------- */
  const titleOf = (id) => (docs.has(id) ? (docs.get(id).title || t('untitled')) : undefined);
  async function doExport(kind) {
    await saveNow();
    const d = docs.get(currentId);
    if (!d && kind !== 'json-all') { toast(t('nothingToExport')); return; }
    const title = d ? (d.title || t('untitled')) : 'smart-note';
    const name = X.safeName(title);
    if (kind === 'json-all' || kind === 'json') {
      const list = kind === 'json' ? subtree(currentId).map((id) => docs.get(id)) : docList();
      const json = await X.exportJson(list, getAssetBlob);
      X.download(`${kind === 'json' ? name : 'smart-note-all'}.json`, json, 'application/json');
      toast(t('exportDone'));
      return;
    }
    const box = await X.inlined(d.html, getAssetBlob, titleOf);
    if (kind === 'md') { X.download(`${name}.md`, `# ${title}\n\n${M.toMarkdown(box)}`, 'text/markdown;charset=utf-8'); toast(t('exportDone')); }
    else if (kind === 'txt') { X.download(`${name}.txt`, `${title}\n\n${M.toText(box)}`); toast(t('exportDone')); }
    else if (kind === 'html') { X.download(`${name}.html`, X.standaloneHtml(title, box), 'text/html;charset=utf-8'); toast(t('exportDone')); }
    else if (kind === 'pdf') { X.printPdf(title, box); toast(t('pdfHint')); }
  }
  async function importFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const base = file.name.replace(/\.[^.]+$/, '');
    try {
      const text = await file.text();
      if (ext === 'json') {
        const { docs: list, assets } = await X.parseJson(text, DB.uid, null);
        for (const a of assets) await DB.putAsset(a);
        list.forEach((d) => docs.set(d.id, d));
        await DB.putDocs(list);
        toast(t('imported', { n: list.length }));
        renderTree();
        if (list.length) await openDoc(list[0].id);
        return;
      }
      let html;
      let title = base;
      if (ext === 'html' || ext === 'htm') {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const h = doc.querySelector('title, h1.doc-title, h1');
        if (h && h.textContent.trim()) { title = h.textContent.trim(); if (h.tagName === 'H1') h.remove(); }
        html = M.normalizeHtml(doc.body.innerHTML);
      } else {
        let md = text;
        const m = md.match(/^#\s+(.+)\n+/);
        if (m) { title = m[1].trim(); md = md.slice(m[0].length); }
        html = M.toHtml(md);
      }
      const box = document.createElement('div');
      box.innerHTML = html;
      const imgs = Array.from(box.querySelectorAll('img[src^="data:image/"]'));
      for (const img of imgs) {
        try {
          const asset = await storeImage(await X.dataUrlToBlob(img.getAttribute('src')));
          const fig = img.closest('figure');
          if (fig) fig.dataset.asset = asset.id; else img.dataset.asset = asset.id;
          img.removeAttribute('src');
        } catch (err) { /* keep data url */ }
      }
      await saveNow();
      const d = await createDoc(null, title, box.innerHTML);
      toast(t('imported', { n: 1 }));
      await openDoc(d.id);
    } catch (err) {
      console.error(err);
      toast(t('importFail'));
    }
  }

  /* ---------------- dialogs ---------------- */
  function confirmDialog(message) {
    const dlg = $('confirm');
    $('confirm-msg').textContent = message;
    return new Promise((resolve) => {
      const done = (v) => { dlg.close(); resolve(v); };
      $('confirm-ok').onclick = () => done(true);
      $('confirm-cancel').onclick = () => done(false);
      dlg.oncancel = (e) => { e.preventDefault(); done(false); };
      dlg.showModal();
    });
  }
  function openLinkDialog() {
    const dlg = $('link-dlg');
    const sel = editor.selectedText();
    $('link-url').value = '';
    $('link-text').value = sel;
    dlg.showModal();
    $('link-url').focus();
  }
  $('link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = $('link-url').value.trim();
    const text = $('link-text').value.trim();
    $('link-dlg').close();
    if (!url) return;
    editor.insertLink(/^(https?:|mailto:|tel:|#|\/)/i.test(url) ? url : `https://${url}`, text);
  });
  $('link-cancel').addEventListener('click', () => $('link-dlg').close());

  /* ---------------- help, lang, theme ---------------- */
  function renderHelp() {
    const blocks = ['text', 'h1', 'h2', 'h3', 'bullet', 'number', 'todo', 'quote', 'code', 'callout', 'divider', 'table', 'image', 'link', 'subpage', 'pagelink', 'date', 'time'];
    const li = (rows) => rows.map(([k, v]) => `<li><code>${M.esc(k)}</code> — ${M.esc(v)}</li>`).join('');
    $('help-title').textContent = t('helpTitle');
    $('help-body').innerHTML = `<p>${t('helpIntro')}</p>
      <h3>${M.esc(t('helpBlocks'))}</h3><ul class="cols">${blocks.map((b) => `<li><b>${M.esc(t('sl_' + b))}</b> — ${M.esc(t('sld_' + b))}</li>`).join('')}</ul>
      <h3>${M.esc(t('helpShortcuts'))}</h3><ul>${li(t('helpShortcutList'))}</ul>
      <h3>${M.esc(t('helpMarkdown'))}</h3><ul>${li(t('helpMdList'))}</ul>
      <h3>${M.esc(t('helpFiles'))}</h3><p>${M.esc(t('helpFilesText'))}</p>
      <h3>${M.esc(t('helpStorage'))}</h3><p>${M.esc(t('helpStorageText'))}</p>`;
  }
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    editorEl.dataset.ph = t('editorPh');
    document.documentElement.style.setProperty('--editor-ph', JSON.stringify(t('editorPh')));
    document.documentElement.style.setProperty('--caption-ph', JSON.stringify(t('captionPh')));
    $('lang-switcher').value = lang;
    fillSelects();
    buildPalettes();
    renderHelp();
    renderTree();
    renderCrumbs();
    updateWords();
    setStatus($('status').dataset.state || 'saved');
    updateToolbar(editor.getState());
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    $('theme-switcher').querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
  $('lang-switcher').addEventListener('change', (e) => { lang = I18N[e.target.value] ? e.target.value : 'en'; prefs.lang = lang; savePrefs(); applyLang(); });
  $('theme-switcher').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; prefs.theme = theme; savePrefs(); applyTheme(); });
  const help = $('help');
  $('help-btn').addEventListener('click', () => help.showModal());
  $('help-close').addEventListener('click', () => help.close());
  help.addEventListener('click', (e) => { if (e.target === help) help.close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !help.open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) help.showModal();
  });

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  window.addEventListener('beforeunload', () => { editor.flushChange(); saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { editor.flushChange(); saveNow(); } });
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== currentId && docs.has(id)) openDoc(id); });

  /* ---------------- boot ---------------- */
  async function boot() {
    applyTheme();
    applyLang();
    const all = await DB.allDocs();
    all.forEach((d) => docs.set(d.id, d));
    if (!docs.size) {
      await createDoc(null, t('welcomeTitle'), M.toHtml(t('welcomeMd').replace(/^#[^\n]*\n/, '')));
    }
    const fromHash = location.hash.slice(1);
    const start = (fromHash && docs.has(fromHash)) ? fromHash : (prefs.lastDoc && docs.has(prefs.lastDoc) ? prefs.lastDoc : docList()[0].id);
    await openDoc(start);
  }
  boot().catch((err) => { console.error(err); toast(String(err && err.message || err)); });
})();
