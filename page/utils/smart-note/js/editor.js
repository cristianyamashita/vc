/* Smart Note — block editor with a Notion-style "/" command menu. */
window.SNEditor = function createEditor(opts) {
  const root = opts.root;
  const menu = opts.menu; // slash menu element
  const t = opts.t;
  const M = window.SNMarkdown;

  const LINE_SEL = 'p,h1,h2,h3,li,td,th,blockquote,pre,figcaption,div.todo,div.callout';
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'A', 'BR', 'SPAN', 'SUB', 'SUP', 'MARK', 'KBD', 'IMG', 'FONT', '#text']);
  const LIST_TYPES = { bullet: 'UL', number: 'OL' };
  const ITEMS = [
    { id: 'text', icon: 'fa-solid fa-font' },
    { id: 'h1', icon: 'fa-solid fa-heading', badge: '1' },
    { id: 'h2', icon: 'fa-solid fa-heading', badge: '2' },
    { id: 'h3', icon: 'fa-solid fa-heading', badge: '3' },
    { id: 'bullet', icon: 'fa-solid fa-list-ul' },
    { id: 'number', icon: 'fa-solid fa-list-ol' },
    { id: 'todo', icon: 'fa-solid fa-square-check' },
    { id: 'quote', icon: 'fa-solid fa-quote-left' },
    { id: 'code', icon: 'fa-solid fa-code' },
    { id: 'callout', icon: 'fa-solid fa-lightbulb' },
    { id: 'divider', icon: 'fa-solid fa-minus' },
    { id: 'table', icon: 'fa-solid fa-table' },
    { id: 'image', icon: 'fa-solid fa-image' },
    { id: 'link', icon: 'fa-solid fa-link' },
    { id: 'subpage', icon: 'fa-solid fa-file-circle-plus' },
    { id: 'pagelink', icon: 'fa-solid fa-file-lines' },
    { id: 'date', icon: 'fa-solid fa-calendar-day' },
    { id: 'time', icon: 'fa-solid fa-clock' },
  ];

  const esc = M.esc;
  const create = (tag) => document.createElement(tag);
  const newP = () => { const p = create('p'); p.innerHTML = '<br>'; return p; };
  const isVoid = (el) => !!el && el.nodeType === 1 && (el.tagName === 'HR' || el.tagName === 'FIGURE' || (el.tagName === 'DIV' && el.classList.contains('page-link')));
  const isListType = (type) => type in LIST_TYPES;
  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ---------------- selection helpers ---------------- */
  function getRange() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.commonAncestorContainer)) return null;
    return r;
  }
  function getLine(node) {
    if (!node) return null;
    const el = node.nodeType === 1 ? node : node.parentNode;
    if (!el || !root.contains(el) || el === root) return null;
    const line = el.closest(LINE_SEL);
    return line && root.contains(line) && line !== root ? line : null;
  }
  function getBlock(node) {
    if (!node || node === root) return null;
    while (node.parentNode && node.parentNode !== root) node = node.parentNode;
    return node.parentNode === root ? node : null;
  }
  function setCaret(node, offset) {
    const r = document.createRange();
    r.setStart(node, offset);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function caretIn(el, atEnd) {
    if (!el) return;
    if (atEnd) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let last = null; let n;
      while ((n = walker.nextNode())) last = n;
      if (last) { setCaret(last, last.length); return; }
      setCaret(el, el.childNodes.length && el.lastChild.tagName === 'BR' ? el.childNodes.length - 1 : el.childNodes.length);
      return;
    }
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) setCaret(first, 0); else setCaret(el, 0);
  }
  function textBefore(line, r) {
    const rr = document.createRange();
    rr.selectNodeContents(line);
    rr.setEnd(r.startContainer, r.startOffset);
    return rr.toString();
  }
  function textAfter(line, r) {
    const rr = document.createRange();
    rr.selectNodeContents(line);
    rr.setStart(r.endContainer, r.endOffset);
    return rr.toString();
  }
  function offsetToPos(line, offset) {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let n; let acc = 0; let last = null;
    while ((n = walker.nextNode())) {
      if (acc + n.length >= offset) return { node: n, offset: offset - acc };
      acc += n.length;
      last = n;
    }
    if (last) return { node: last, offset: last.length };
    return { node: line, offset: 0 };
  }
  function caretAt(line, offset) {
    const pos = offsetToPos(line, offset);
    setCaret(pos.node, pos.offset);
  }
  function getSelOffsets() {
    const r = getRange();
    if (!r) return null;
    const a = getLine(r.startContainer);
    const b = getLine(r.endContainer);
    if (!a || !b) return null;
    const lines = allLines();
    const er = document.createRange();
    er.selectNodeContents(b);
    er.setEnd(r.endContainer, r.endOffset);
    return { a: lines.indexOf(a), ao: textBefore(a, r).length, b: lines.indexOf(b), bo: er.toString().length };
  }
  function setSelOffsets(o) {
    if (!o) return;
    const lines = allLines();
    const a = lines[o.a]; const b = lines[o.b];
    if (!a || !b) return;
    const from = offsetToPos(a, o.ao); const to = offsetToPos(b, o.bo);
    const r = document.createRange();
    r.setStart(from.node, from.offset);
    r.setEnd(to.node, to.offset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function nodeBeforeCaret(r) {
    const c = r.startContainer;
    if (c.nodeType === 3) return r.startOffset > 0 ? c : c.previousSibling;
    return c.childNodes[r.startOffset - 1] || null;
  }
  function isEmptyLine(line) {
    return !line.textContent.replace(/\u200b/g, '').trim() && !line.querySelector('img');
  }
  function ensureContent(el) {
    // Chrome cannot place a caret in a block without a text node or <br>; empty text nodes do not count.
    Array.from(el.childNodes).forEach((n) => { if (n.nodeType === 3 && !n.nodeValue) n.remove(); });
    if (!el.childNodes.length) el.innerHTML = '<br>';
    return el;
  }
  function preText(pre) { return M.preText(pre); }
  function stripPreEnd(pre) {
    // Removes trailing line breaks (text "\n" or <br>) at the end of a code block.
    for (let guard = 0; guard < 50; guard++) {
      let last = pre.lastChild;
      while (last && last.nodeType === 1 && last.tagName !== 'BR' && last.lastChild) last = last.lastChild;
      if (!last) return;
      if (last.nodeType === 1 && last.tagName === 'BR') { last.remove(); continue; }
      if (last.nodeType === 3) {
        if (/\n$/.test(last.nodeValue)) { last.nodeValue = last.nodeValue.replace(/\n$/, ''); if (!last.nodeValue) { const p = last.parentNode; last.remove(); if (p !== pre && !p.childNodes.length) p.remove(); } continue; }
        if (!last.nodeValue) { const p = last.parentNode; last.remove(); if (p !== pre && !p.childNodes.length) p.remove(); continue; }
      }
      return;
    }
  }

  /* ---------------- history ---------------- */
  const hist = { stack: [], idx: -1 };
  let typing = null;
  function allLines() { return Array.from(root.querySelectorAll(LINE_SEL)); }
  function snapshot() {
    const r = getRange();
    let caret = null;
    if (r) {
      const line = getLine(r.startContainer);
      if (line) caret = { i: allLines().indexOf(line), o: textBefore(line, r).length };
    }
    return { html: root.innerHTML, caret };
  }
  function commit() {
    const snap = snapshot();
    const cur = hist.stack[hist.idx];
    if (cur && cur.html === snap.html) { cur.caret = snap.caret || cur.caret; return; }
    hist.stack.splice(hist.idx + 1);
    hist.stack.push(snap);
    if (hist.stack.length > 200) hist.stack.shift();
    hist.idx = hist.stack.length - 1;
  }
  function restore(snap) {
    root.innerHTML = snap.html;
    normalize();
    if (snap.caret && snap.caret.i >= 0) {
      const line = allLines()[snap.caret.i];
      if (line) { try { caretAt(line, snap.caret.o); } catch (e) { caretIn(line, true); } }
    }
    clearSelectedFigure();
    scheduleChange();
    notifyState();
  }
  function undo() {
    clearTimeout(typing); typing = null;
    commit();
    if (hist.idx <= 0) return;
    hist.idx -= 1;
    restore(hist.stack[hist.idx]);
  }
  function redo() {
    clearTimeout(typing); typing = null;
    if (hist.idx >= hist.stack.length - 1) return;
    hist.idx += 1;
    restore(hist.stack[hist.idx]);
  }
  function typingTick() {
    if (!typing) commit();
    clearTimeout(typing);
    typing = setTimeout(() => { typing = null; }, 800);
  }

  /* ---------------- structure ---------------- */
  function normalize() {
    Array.from(root.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        if (!n.nodeValue.trim()) { n.remove(); return; }
        const p = create('p'); n.replaceWith(p); p.appendChild(n); return;
      }
      if (n.nodeType !== 1) { n.remove(); return; }
      if (n.tagName === 'BR') { n.remove(); return; }
      if (INLINE.has(n.tagName)) { const p = create('p'); n.replaceWith(p); p.appendChild(n); return; }
      if (n.tagName === 'DIV' && !n.classList.contains('todo') && !n.classList.contains('callout') && !n.classList.contains('page-link')) {
        const p = create('p');
        while (n.firstChild) p.appendChild(n.firstChild);
        if (!p.childNodes.length) p.innerHTML = '<br>';
        n.replaceWith(p);
      }
    });
    if (!root.children.length) root.appendChild(newP());
    const last = root.lastElementChild;
    if (isVoid(last) || last.tagName === 'TABLE') root.appendChild(newP());
    root.querySelectorAll('li').forEach((li) => { if (!li.childNodes.length) li.innerHTML = '<br>'; });
  }

  function makeLine(type) {
    switch (type) {
      case 'h1': case 'h2': case 'h3': return create(type);
      case 'quote': return create('blockquote');
      case 'code': return create('pre');
      case 'callout': { const d = create('div'); d.className = 'callout'; d.dataset.icon = '💡'; return d; }
      case 'todo': { const d = create('div'); d.className = 'todo'; return d; }
      case 'bullet': case 'number': return create('li');
      default: return create('p');
    }
  }
  function lineType(line) {
    if (!line) return 'text';
    const tag = line.tagName;
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') return tag.toLowerCase();
    if (tag === 'LI') { const l = line.parentNode; return l && l.tagName === 'OL' ? 'number' : 'bullet'; }
    if (tag === 'BLOCKQUOTE') return 'quote';
    if (tag === 'PRE') return 'code';
    if (tag === 'DIV' && line.classList.contains('todo')) return 'todo';
    if (tag === 'DIV' && line.classList.contains('callout')) return 'callout';
    return 'text';
  }
  function splitListAround(li, node) {
    const list = li.parentNode;
    const after = list.cloneNode(false);
    let n = li.nextSibling;
    while (n) { const nx = n.nextSibling; after.appendChild(n); n = nx; }
    li.remove();
    list.after(node);
    if (after.childNodes.length) node.after(after);
    if (!list.childNodes.length) list.remove();
  }
  function convertLine(line, type) {
    if (!line) return null;
    const tag = line.tagName;
    if (tag === 'TD' || tag === 'TH' || tag === 'FIGCAPTION') return null;
    if (lineType(line) === type) return line;
    commit();
    const r = getRange();
    const offset = r && line.contains(r.startContainer) ? textBefore(line, r).length : null;
    const el = makeLine(type);
    if (type === 'code') {
      const tmp = create('div');
      Array.from(line.childNodes).forEach((c) => tmp.appendChild(c.cloneNode(true)));
      tmp.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      tmp.querySelectorAll('ul,ol').forEach((l) => l.remove());
      el.textContent = tmp.textContent.replace(/\n$/, '');
    } else if (tag === 'PRE') {
      el.innerHTML = esc(preText(line)).replace(/\n/g, '<br>');
    } else {
      Array.from(line.childNodes).forEach((c) => { if (!(c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL'))) el.appendChild(c); });
    }
    ensureContent(el);
    if (tag === 'LI') {
      const nested = Array.from(line.children).filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
      if (isListType(type)) {
        const list = create(LIST_TYPES[type]);
        list.appendChild(el);
        nested.forEach((n) => el.appendChild(n));
        splitListAround(line, list);
      } else {
        splitListAround(line, el);
        nested.forEach((n) => el.after(n));
      }
    } else if (isListType(type)) {
      const target = LIST_TYPES[type];
      const prev = line.previousElementSibling;
      const next = line.nextElementSibling;
      if (prev && prev.tagName === target) {
        prev.appendChild(el);
        if (next && next.tagName === target) { while (next.firstChild) prev.appendChild(next.firstChild); next.remove(); }
        line.remove();
      } else if (next && next.tagName === target) {
        next.insertBefore(el, next.firstChild);
        line.remove();
      } else {
        const list = create(target);
        list.appendChild(el);
        line.replaceWith(list);
      }
    } else {
      line.replaceWith(el);
    }
    if (offset !== null) caretAt(el, offset); else caretIn(el, true);
    scheduleChange();
    notifyState();
    return el;
  }

  function insertBlockAfterLine(line, node) {
    // Inserts a top-level node. Empty text lines are replaced; otherwise it goes after the line's block.
    let block = line ? getBlock(line) : null;
    const r = getRange();
    if (!block && r) block = getBlock(r.startContainer);
    if (!block) { root.appendChild(node); return node; }
    const plain = line && !['LI', 'TD', 'TH', 'FIGCAPTION'].includes(line.tagName);
    if (plain && isEmptyLine(line)) block.replaceWith(node);
    else block.after(node);
    return node;
  }
  function insertVoid(line, node) {
    commit();
    insertBlockAfterLine(line, node);
    let next = node.nextElementSibling;
    if (!next || isVoid(next) || next.tagName === 'TABLE') { next = newP(); node.after(next); }
    caretIn(next, false);
    scheduleChange();
    notifyState();
    return node;
  }

  function makeTable(rows, cols) {
    const table = create('table');
    table.className = 'tbl';
    const tbody = create('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = create('tr');
      for (let c = 0; c < cols; c++) { const cell = create(r === 0 ? 'th' : 'td'); cell.innerHTML = '<br>'; tr.appendChild(cell); }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }
  function makeFigure(src, assetId) {
    const fig = create('figure');
    fig.className = 'img';
    fig.setAttribute('contenteditable', 'false');
    fig.dataset.w = '100';
    fig.dataset.align = 'center';
    if (assetId) fig.dataset.asset = assetId;
    const img = create('img');
    img.src = src;
    img.alt = '';
    fig.appendChild(img);
    const cap = create('figcaption');
    cap.setAttribute('contenteditable', 'true');
    fig.appendChild(cap);
    return fig;
  }
  function makePageLink(id, title) {
    const d = create('div');
    d.className = 'page-link';
    d.setAttribute('contenteditable', 'false');
    d.dataset.page = id;
    d.innerHTML = `<span class="pl-icon">📄</span><span class="pl-title">${esc(title || t('untitled'))}</span>`;
    return d;
  }

  /* ---------------- slash menu ---------------- */
  const slash = { open: false, mode: 'items', line: null, start: 0, query: '', sel: 0, list: [] };
  function itemLabel(it) { return t('sl_' + it.id); }
  function filterItems(q) {
    const f = fold(q).trim();
    if (!f) return ITEMS.slice();
    return ITEMS.filter((it) => {
      const hay = fold(`${t('sl_' + it.id)} ${t('sld_' + it.id)} ${t('kw_' + it.id)} ${it.id} ${window.SN_I18N.en['sl_' + it.id]} ${window.SN_I18N.en['kw_' + it.id]}`);
      return f.split(/\s+/).every((w) => hay.includes(w));
    });
  }
  function filterPages(q) {
    const f = fold(q).trim();
    const pages = (opts.listPages ? opts.listPages() : []).filter((p) => !f || fold(p.title).includes(f));
    return pages.map((p) => ({ id: 'page:' + p.id, pageId: p.id, title: p.title, icon: 'fa-regular fa-file-lines', path: p.path }));
  }
  function openSlash(line, start, mode) {
    slash.open = true;
    slash.mode = mode || 'items';
    slash.line = line;
    slash.start = start;
    slash.query = '';
    slash.sel = 0;
    renderSlash();
  }
  function closeSlash() {
    if (!slash.open) return;
    slash.open = false;
    slash.line = null;
    menu.hidden = true;
    menu.innerHTML = '';
  }
  function renderSlash() {
    slash.list = slash.mode === 'pages' ? filterPages(slash.query) : filterItems(slash.query);
    if (slash.sel >= slash.list.length) slash.sel = 0;
    let html = '';
    if (slash.mode === 'pages') html += `<div class="sm-head">${esc(t('slashPagesTitle'))}</div>`;
    if (!slash.list.length) html += `<div class="sm-empty">${esc(slash.mode === 'pages' ? t('noOtherPages') : t('slashNoResults'))}</div>`;
    slash.list.forEach((it, i) => {
      const name = it.pageId ? it.title : itemLabel(it);
      const desc = it.pageId ? (it.path || '') : t('sld_' + it.id);
      html += `<div class="sm-item${i === slash.sel ? ' sel' : ''}" data-i="${i}"><span class="sm-ic"><i class="${it.icon}"></i>${it.badge ? `<b>${it.badge}</b>` : ''}</span><span class="sm-txt"><span class="sm-name">${esc(name)}</span><span class="sm-desc">${esc(desc)}</span></span></div>`;
    });
    menu.innerHTML = html;
    menu.hidden = false;
    positionSlash();
    const selEl = menu.querySelector('.sm-item.sel');
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }
  function positionSlash() {
    const r = getRange();
    let rect = r ? r.getBoundingClientRect() : null;
    if ((!rect || (!rect.width && !rect.height)) && slash.line) rect = slash.line.getBoundingClientRect();
    if (!rect) return;
    const mw = menu.offsetWidth || 300;
    const mh = menu.offsetHeight || 300;
    let left = Math.min(rect.left, window.innerWidth - mw - 8);
    let top = rect.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 4);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${top}px`;
  }
  function updateSlash() {
    const r = getRange();
    if (!r || !r.collapsed || !slash.line || !root.contains(slash.line) || !slash.line.contains(r.startContainer)) { closeSlash(); return; }
    const text = textBefore(slash.line, r);
    if (slash.mode === 'items') {
      if (text.length <= slash.start || text[slash.start] !== '/') { closeSlash(); return; }
      slash.query = text.slice(slash.start + 1);
    } else {
      if (text.length < slash.start) { closeSlash(); return; }
      slash.query = text.slice(slash.start);
    }
    if (slash.query.length > 40) { closeSlash(); return; }
    const list = slash.mode === 'pages' ? filterPages(slash.query) : filterItems(slash.query);
    if (!list.length && /\s$/.test(slash.query) && slash.query.trim().length > 1) { closeSlash(); return; }
    renderSlash();
  }
  function tryOpenSlash() {
    const r = getRange();
    if (!r || !r.collapsed) return;
    const line = getLine(r.startContainer);
    if (!line || line.tagName === 'PRE') return;
    const text = textBefore(line, r);
    if (!/(^|\s)\/$/.test(text)) return;
    openSlash(line, text.length - 1, 'items');
  }
  function removeSlashText() {
    const r = getRange();
    if (!r || !slash.line) return;
    const end = textBefore(slash.line, r).length;
    const from = offsetToPos(slash.line, slash.start);
    const to = offsetToPos(slash.line, end);
    const rr = document.createRange();
    rr.setStart(from.node, from.offset);
    rr.setEnd(to.node, to.offset);
    rr.deleteContents();
    setCaret(from.node, from.offset);
    if (!slash.line.textContent) { ensureContent(slash.line); setCaret(slash.line, 0); }
  }
  function chooseSlash(i) {
    const it = slash.list[i];
    if (!it) { closeSlash(); return; }
    const line = slash.line;
    commit();
    removeSlashText();
    if (it.pageId) { closeSlash(); insertVoid(line, makePageLink(it.pageId, it.title)); return; }
    if (it.id === 'pagelink') {
      const r = getRange();
      slash.mode = 'pages';
      slash.start = r ? textBefore(line, r).length : 0;
      slash.query = '';
      slash.sel = 0;
      renderSlash();
      return;
    }
    closeSlash();
    applyItem(it.id, line);
  }
  function applyItem(id, line) {
    switch (id) {
      case 'date': insertText(new Date().toLocaleDateString(opts.locale ? opts.locale() : undefined)); break;
      case 'time': insertText(new Date().toLocaleTimeString(opts.locale ? opts.locale() : undefined, { hour: '2-digit', minute: '2-digit' })); break;
      case 'link': saveSel(); if (opts.promptLink) opts.promptLink(); break;
      case 'image': saveSel(); if (opts.pickImage) opts.pickImage(line); break;
      case 'subpage':
        if (opts.createSubpage) Promise.resolve(opts.createSubpage()).then((page) => { if (page) { root.focus(); insertVoid(line, makePageLink(page.id, page.title)); } });
        break;
      case 'divider': { const hr = create('hr'); hr.setAttribute('contenteditable', 'false'); insertVoid(line, hr); break; }
      case 'table': {
        commit();
        const table = insertBlockAfterLine(line, makeTable(3, 3));
        if (!table.nextElementSibling) table.after(newP());
        caretIn(table.querySelector('th,td'), false);
        scheduleChange(); notifyState();
        break;
      }
      default: convertLine(line, id);
    }
  }
  menu.addEventListener('mousedown', (e) => { e.preventDefault(); });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.sm-item');
    if (item) chooseSlash(+item.dataset.i);
  });

  /* ---------------- markdown-style shortcuts ---------------- */
  function checkMdShortcut() {
    const r = getRange();
    if (!r || !r.collapsed) return;
    const line = getLine(r.startContainer);
    if (!line || line.tagName !== 'P') return;
    const text = textBefore(line, r);
    const m = text.match(/^(#{1,3}|[-*+]|1[.)]|\[ ?\]|\[x\]|>|```|---)\s$/);
    if (!m) return;
    const k = m[1];
    const map = { '#': 'h1', '##': 'h2', '###': 'h3', '-': 'bullet', '*': 'bullet', '+': 'bullet', '1.': 'number', '1)': 'number', '[]': 'todo', '[ ]': 'todo', '[x]': 'todo', '>': 'quote', '```': 'code' };
    commit();
    const pos = offsetToPos(line, 0);
    const to = offsetToPos(line, text.length);
    const rr = document.createRange(); rr.setStart(pos.node, pos.offset); rr.setEnd(to.node, to.offset); rr.deleteContents();
    ensureContent(line);
    setCaret(line, 0);
    if (k === '---') { const hr = create('hr'); hr.setAttribute('contenteditable', 'false'); insertVoid(line, hr); return; }
    const el = convertLine(line, map[k]);
    if (k === '[x]' && el) el.dataset.checked = '1';
  }

  /* ---------------- key handling ---------------- */
  function insertText(text) { document.execCommand('insertText', false, text); }
  function afterBlock(block, node) { block.after(node); caretIn(node, false); scheduleChange(); notifyState(); }

  function handleEnter(line, r) {
    if (!line) return false;
    const tag = line.tagName;
    if (tag === 'FIGCAPTION') { commit(); afterBlock(line.closest('figure'), newP()); return true; }
    if (tag === 'TD' || tag === 'TH') { document.execCommand('insertLineBreak'); return true; }
    if (tag === 'PRE') {
      // Chrome inserts "\n" (plus a trailing placeholder "\n") for line breaks inside <pre>.
      const beforeTxt = textBefore(line, r);
      const afterTxt = textAfter(line, r);
      const before = nodeBeforeCaret(r);
      const endsNl = /\n$/.test(beforeTxt) || (!!before && before.nodeType === 1 && before.tagName === 'BR');
      if (r.collapsed && /^\n?$/.test(afterTxt) && endsNl && beforeTxt.replace(/\n+$/, '').length) {
        commit();
        stripPreEnd(line);
        ensureContent(line);
        afterBlock(line, newP());
        return true;
      }
      commit();
      document.execCommand('insertLineBreak');
      return true;
    }
    const cls = line.classList;
    if (tag === 'BLOCKQUOTE' || cls.contains('callout')) {
      const before = nodeBeforeCaret(r);
      if (r.collapsed && textAfter(line, r) === '' && before && before.nodeType === 1 && before.tagName === 'BR') {
        commit();
        before.remove();
        ensureContent(line);
        afterBlock(line, newP());
        return true;
      }
      if (isEmptyLine(line)) { convertLine(line, 'text'); return true; }
      document.execCommand('insertLineBreak');
      return true;
    }
    if (cls.contains('todo')) {
      if (isEmptyLine(line)) { convertLine(line, 'text'); return true; }
      commit();
      const next = makeLine('todo');
      if (!r.collapsed) r.deleteContents();
      const rr = document.createRange();
      rr.setStart(r.startContainer, r.startOffset);
      rr.setEndAfter(line.lastChild);
      next.appendChild(rr.extractContents());
      ensureContent(next);
      ensureContent(line);
      line.after(next);
      caretIn(next, false);
      scheduleChange(); notifyState();
      return true;
    }
    if ((tag === 'H1' || tag === 'H2' || tag === 'H3') && r.collapsed && textAfter(line, r) === '') { commit(); afterBlock(line, newP()); return true; }
    if (tag === 'LI' && isEmptyLine(line) && !line.querySelector('ul,ol')) {
      const list = line.parentNode;
      if (list.parentNode === root) { convertLine(line, 'text'); return true; }
    }
    typingTick();
    return false;
  }
  function handleBackspace(line, r) {
    if (!line) return false;
    if (textBefore(line, r) !== '' || (r.startContainer.nodeType === 1 && r.startOffset > 0 && line.querySelector('img'))) return false;
    const tag = line.tagName;
    const type = lineType(line);
    if (['h1', 'h2', 'h3', 'quote', 'code', 'callout', 'todo'].includes(type)) { convertLine(line, 'text'); return true; }
    if (tag === 'P') {
      const block = getBlock(line);
      const prev = block && block.previousElementSibling;
      if (prev && isVoid(prev)) { commit(); prev.remove(); scheduleChange(); notifyState(); return true; }
      if (prev && prev.tagName === 'TABLE') { const cells = prev.querySelectorAll('td,th'); if (isEmptyLine(line)) { commit(); line.remove(); scheduleChange(); } caretIn(cells[cells.length - 1], true); return true; }
    }
    return false;
  }
  function handleTab(line, shift) {
    if (!line) return true;
    const tag = line.tagName;
    if (tag === 'TD' || tag === 'TH') {
      const cells = Array.from(line.closest('table').querySelectorAll('td,th'));
      const i = cells.indexOf(line);
      if (shift) { if (i > 0) caretIn(cells[i - 1], true); return true; }
      if (i < cells.length - 1) { caretIn(cells[i + 1], true); return true; }
      tableAction('rowBelow', line);
      return true;
    }
    if (tag === 'LI') { commit(); document.execCommand(shift ? 'outdent' : 'indent'); scheduleChange(); return true; }
    if (tag === 'PRE') { insertText('  '); return true; }
    return true;
  }

  root.addEventListener('keydown', (e) => {
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (slash.open) {
      if (k === 'ArrowDown') { e.preventDefault(); slash.sel = (slash.sel + 1) % Math.max(1, slash.list.length); renderSlash(); return; }
      if (k === 'ArrowUp') { e.preventDefault(); slash.sel = (slash.sel - 1 + Math.max(1, slash.list.length)) % Math.max(1, slash.list.length); renderSlash(); return; }
      if (k === 'Enter' || k === 'Tab') { e.preventDefault(); if (slash.list.length) chooseSlash(slash.sel); else closeSlash(); return; }
      if (k === 'Escape') { e.preventDefault(); closeSlash(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') { setTimeout(updateSlash, 0); }
    }
    if (mod && !e.altKey) {
      const lk = k.toLowerCase();
      if (lk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (lk === 'y' || (lk === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
      if (lk === 'b') { e.preventDefault(); exec('bold'); return; }
      if (lk === 'i') { e.preventDefault(); exec('italic'); return; }
      if (lk === 'u') { e.preventDefault(); exec('underline'); return; }
      if (lk === 'x' && e.shiftKey) { e.preventDefault(); exec('strikeThrough'); return; }
      if (lk === 'e') { e.preventDefault(); toggleCode(); return; }
      if (lk === 'k') { e.preventDefault(); saveSel(); if (opts.promptLink) opts.promptLink(); return; }
      if (lk === 's') { e.preventDefault(); if (opts.onSaveNow) opts.onSaveNow(); return; }
    }
    if (selectedFigure && (k === 'Delete' || k === 'Backspace')) { e.preventDefault(); removeFigure(selectedFigure); return; }
    if (k === 'Escape') { clearSelectedFigure(); return; }
    const r = getRange();
    if (!r) return;
    const line = getLine(r.startContainer);
    if (k === 'Enter' && !e.shiftKey) { if (handleEnter(line, r)) e.preventDefault(); return; }
    if (k === 'Enter' && e.shiftKey) { if (line && line.tagName === 'PRE') { e.preventDefault(); document.execCommand('insertLineBreak'); } return; }
    if (k === 'Backspace' && r.collapsed) { if (handleBackspace(line, r)) { e.preventDefault(); return; } typingTick(); return; }
    if (k === 'Tab') { if (handleTab(line, e.shiftKey)) e.preventDefault(); return; }
    if (!mod && (k.length === 1 || k === 'Delete')) typingTick();
  });

  root.addEventListener('input', (e) => {
    normalize();
    if (slash.open) updateSlash();
    else if (e.inputType === 'insertText' && e.data === '/') tryOpenSlash();
    else if (e.inputType === 'insertText' && e.data === ' ') checkMdShortcut();
    scheduleChange();
    notifyState();
  });

  root.addEventListener('mousedown', (e) => {
    const line = e.target.closest ? e.target.closest('.todo, .callout') : null;
    if (line && root.contains(line)) {
      const x = e.clientX - line.getBoundingClientRect().left;
      if (line.classList.contains('todo') && x < 26) {
        e.preventDefault();
        commit();
        if (line.dataset.checked) delete line.dataset.checked; else line.dataset.checked = '1';
        scheduleChange();
        return;
      }
      if (line.classList.contains('callout') && x < 34) {
        e.preventDefault();
        commit();
        const icons = M.CALLOUT_ICONS;
        line.dataset.icon = icons[(icons.indexOf(line.dataset.icon || '💡') + 1) % icons.length];
        scheduleChange();
        return;
      }
    }
    const fig = e.target.closest ? e.target.closest('figure.img') : null;
    if (fig && root.contains(fig) && !e.target.closest('figcaption')) { e.preventDefault(); selectFigure(fig); return; }
    if (selectedFigure) clearSelectedFigure();
  });
  root.addEventListener('click', (e) => {
    const pl = e.target.closest ? e.target.closest('.page-link, a.plink') : null;
    if (pl && root.contains(pl)) { e.preventDefault(); if (opts.openPage) opts.openPage(pl.dataset.page); return; }
    const a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a && root.contains(a) && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
  });

  /* ---------------- paste / drop ---------------- */
  function insertBlocksHtml(html, line) {
    const tmp = create('div');
    tmp.innerHTML = html;
    const blocks = Array.from(tmp.children);
    if (!blocks.length) return;
    const r = getRange();
    if (blocks.length === 1 && blocks[0].tagName === 'P' && line && !isVoid(line)) {
      document.execCommand('insertHTML', false, blocks[0].innerHTML);
      absorbImages(root);
      return;
    }
    let block = line ? getBlock(line) : (r ? getBlock(r.startContainer) : null);
    if (!block) block = root.lastElementChild;
    const replace = line && line.tagName === 'P' && isEmptyLine(line);
    let last = block;
    blocks.forEach((b) => { last.after(b); last = b; });
    if (replace) block.remove();
    absorbImages(root);
    const lines = last.matches(LINE_SEL) ? [last] : Array.from(last.querySelectorAll(LINE_SEL));
    if (isVoid(last) || last.tagName === 'TABLE' && !lines.length) { const p = newP(); last.after(p); caretIn(p, false); }
    else if (lines.length) caretIn(lines[lines.length - 1], true);
    else { const p = newP(); last.after(p); caretIn(p, false); }
    normalize();
  }
  function absorbImages(container) {
    if (!opts.storeImage) return;
    container.querySelectorAll('img[src^="data:image/"]').forEach(async (img) => {
      try {
        const res = await fetch(img.getAttribute('src'));
        const blob = await res.blob();
        const asset = await opts.storeImage(blob);
        img.src = asset.url;
        const fig = img.closest('figure');
        if (fig) fig.dataset.asset = asset.id; else img.dataset.asset = asset.id;
        scheduleChange();
      } catch (err) { /* keep data url */ }
    });
  }
  root.addEventListener('paste', (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = Array.from(cd.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); files.forEach((f) => insertImage(f)); return; }
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    e.preventDefault();
    commit();
    const r = getRange();
    const line = r ? getLine(r.startContainer) : null;
    if (line && line.tagName === 'PRE') { insertText(text); scheduleChange(); return; }
    if (html) insertBlocksHtml(M.normalizeHtml(html), line);
    else if (text) {
      if (/\n/.test(text)) insertBlocksHtml(M.toHtml(text), line);
      else insertText(text);
    }
    scheduleChange();
    notifyState();
  });
  root.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
  root.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer ? e.dataTransfer.files : []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    let range = null;
    if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(e.clientX, e.clientY);
    else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); } }
    if (range && root.contains(range.startContainer)) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
    files.forEach((f) => insertImage(f));
  });

  /* ---------------- images ---------------- */
  let selectedFigure = null;
  function selectFigure(fig) {
    clearSelectedFigure();
    selectedFigure = fig;
    fig.classList.add('sel');
    const sel = window.getSelection();
    sel.removeAllRanges();
    notifyState();
  }
  function clearSelectedFigure() {
    if (!selectedFigure) return;
    selectedFigure.classList.remove('sel');
    selectedFigure = null;
    notifyState();
  }
  function removeFigure(fig) {
    commit();
    const next = fig.nextElementSibling;
    fig.remove();
    clearSelectedFigure();
    normalize();
    if (next && next.matches(LINE_SEL)) caretIn(next, false);
    scheduleChange();
    notifyState();
  }
  async function insertImage(file, line) {
    if (!opts.storeImage) return;
    const asset = await opts.storeImage(file);
    if (!(line && root.contains(line))) restoreSel(); else root.focus();
    const r = getRange();
    const target = line && root.contains(line) ? line : (r ? getLine(r.startContainer) : null);
    const fig = makeFigure(asset.url, asset.id);
    insertVoid(target, fig);
  }
  function figureAction(action, fig) {
    fig = fig || selectedFigure;
    if (!fig) return;
    if (action === 'delete') { removeFigure(fig); return; }
    commit();
    if (action.startsWith('w:')) fig.dataset.w = action.slice(2);
    if (action.startsWith('align:')) fig.dataset.align = action.slice(6);
    scheduleChange();
    notifyState();
  }

  /* ---------------- tables ---------------- */
  function currentCell() {
    const r = getRange();
    if (!r) return null;
    const line = getLine(r.startContainer);
    return line && (line.tagName === 'TD' || line.tagName === 'TH') ? line : null;
  }
  function tableAction(action, cell) {
    cell = cell || currentCell();
    if (!cell) return;
    const row = cell.parentNode;
    const table = cell.closest('table');
    const idx = Array.from(row.children).indexOf(cell);
    const rows = Array.from(table.querySelectorAll('tr'));
    commit();
    const blank = (tag) => { const c = create(tag); c.innerHTML = '<br>'; return c; };
    switch (action) {
      case 'rowAbove': case 'rowBelow': {
        const tr = create('tr');
        Array.from(row.children).forEach(() => tr.appendChild(blank('td')));
        if (action === 'rowAbove') row.before(tr); else row.after(tr);
        caretIn(tr.children[Math.min(idx, tr.children.length - 1)], false);
        break;
      }
      case 'colLeft': case 'colRight': {
        rows.forEach((tr) => {
          const ref = tr.children[idx];
          const c = blank(ref && ref.tagName === 'TH' ? 'th' : 'td');
          if (!ref) tr.appendChild(c); else if (action === 'colLeft') ref.before(c); else ref.after(c);
        });
        caretIn(row.children[action === 'colLeft' ? idx : idx + 1], false);
        break;
      }
      case 'delRow': {
        if (rows.length <= 1) { table.remove(); normalize(); break; }
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        caretIn(next.children[Math.min(idx, next.children.length - 1)], false);
        break;
      }
      case 'delCol': {
        if (row.children.length <= 1) { table.remove(); normalize(); break; }
        rows.forEach((tr) => { if (tr.children[idx]) tr.children[idx].remove(); });
        caretIn(row.children[Math.min(idx, row.children.length - 1)], false);
        break;
      }
      case 'delTable': {
        const next = table.nextElementSibling;
        table.remove();
        normalize();
        if (next && next.matches(LINE_SEL)) caretIn(next, false);
        break;
      }
      case 'header': {
        const first = rows[0];
        const isHeader = first.children[0] && first.children[0].tagName === 'TH';
        Array.from(first.children).forEach((c) => {
          const n = create(isHeader ? 'td' : 'th');
          while (c.firstChild) n.appendChild(c.firstChild);
          c.replaceWith(n);
        });
        caretIn(first.children[0], false);
        break;
      }
      default: break;
    }
    scheduleChange();
    notifyState();
  }

  /* ---------------- formatting ---------------- */
  function exec(cmd, val) {
    root.focus();
    commit();
    document.execCommand(cmd, false, val);
    scheduleChange();
    notifyState();
  }
  function toggleCode() {
    const r = getRange();
    if (!r) return;
    const code = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode).closest('code');
    commit();
    if (code && root.contains(code)) {
      const text = document.createTextNode(code.textContent);
      code.replaceWith(text);
      setCaret(text, text.length);
    } else if (!r.collapsed) {
      const text = r.toString();
      document.execCommand('insertHTML', false, `<code>${esc(text)}</code>`);
    } else {
      document.execCommand('insertHTML', false, '<code>​</code>');
    }
    scheduleChange();
    notifyState();
  }
  function setFont(family) {
    root.focus();
    commit();
    const keep = getSelOffsets();
    if (family) document.execCommand('fontName', false, family);
    else {
      document.execCommand('fontName', false, '__default__');
      root.querySelectorAll('span,font').forEach((s) => {
        if (s.style && /__default__/.test(s.style.fontFamily)) { s.style.fontFamily = ''; if (!s.getAttribute('style')) unwrap(s); }
        if (s.tagName === 'FONT' && s.getAttribute('face') === '__default__') unwrap(s);
      });
      setSelOffsets(keep);
    }
    scheduleChange(); notifyState();
  }
  function setFontSize(px) {
    root.focus();
    commit();
    const keep = getSelOffsets();
    document.execCommand('fontSize', false, '7');
    root.querySelectorAll('font[size="7"]').forEach((f) => {
      const s = create('span');
      if (px) s.style.fontSize = `${px}px`;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.replaceWith(s);
      if (!px) unwrap(s);
    });
    root.querySelectorAll('[style]').forEach((s) => {
      if (s.style.fontSize === 'xxx-large') { s.style.fontSize = px ? `${px}px` : ''; if (!s.getAttribute('style')) { if (s.tagName === 'SPAN') unwrap(s); else s.removeAttribute('style'); } }
    });
    setSelOffsets(keep);
    scheduleChange(); notifyState();
  }
  function unwrap(el) { const parent = el.parentNode; while (el.firstChild) parent.insertBefore(el.firstChild, el); el.remove(); }
  let savedSel = null;
  function saveSel() { savedSel = getSelOffsets(); return savedSel; }
  function restoreSel() { root.focus(); if (savedSel) setSelOffsets(savedSel); savedSel = null; }
  function insertLink(url, text) {
    restoreSel();
    commit();
    const r = getRange();
    if (r && !r.collapsed && (!text || text === r.toString())) document.execCommand('createLink', false, url);
    else document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(text || url)}</a> `);
    scheduleChange(); notifyState();
  }
  function clearFormat() {
    root.focus();
    commit();
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    scheduleChange(); notifyState();
  }

  /* ---------------- state / change ---------------- */
  let changeTimer = null;
  function scheduleChange() {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => { changeTimer = null; if (opts.onChange) opts.onChange(); }, 400);
  }
  function flushChange() { if (changeTimer) { clearTimeout(changeTimer); changeTimer = null; if (opts.onChange) opts.onChange(); } }
  function getState() {
    const r = getRange();
    const line = r ? getLine(r.startContainer) : null;
    const anchor = r ? (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentNode) : null;
    const q = (c) => { try { return document.queryCommandState(c); } catch (e) { return false; } };
    let font = ''; let size = '';
    if (anchor && root.contains(anchor)) {
      const fs = anchor.closest('[style*="font-size"]');
      if (fs && root.contains(fs)) size = parseInt(fs.style.fontSize, 10) || '';
      const ff = anchor.closest('[style*="font-family"], font[face]');
      if (ff && root.contains(ff)) font = (ff.style.fontFamily || ff.getAttribute('face') || '').replace(/["']/g, '').split(',')[0].trim();
    }
    return {
      line, type: lineType(line), inEditor: !!r,
      bold: !!r && q('bold'), italic: !!r && q('italic'), underline: !!r && q('underline'), strike: !!r && q('strikeThrough'),
      code: !!anchor && !!anchor.closest('code') && root.contains(anchor.closest('code')),
      font, size,
      cell: line && (line.tagName === 'TD' || line.tagName === 'TH') ? line : null,
      figure: selectedFigure,
    };
  }
  let stateTimer = null;
  function notifyState() {
    if (stateTimer) return;
    stateTimer = requestAnimationFrame(() => { stateTimer = null; if (opts.onState) opts.onState(getState()); });
  }
  document.addEventListener('selectionchange', () => {
    if (document.activeElement !== root && !root.contains(document.activeElement)) return;
    if (slash.open) updateSlash();
    notifyState();
  });
  root.addEventListener('blur', () => { commit(); flushChange(); });
  root.addEventListener('focus', () => notifyState());

  /* ---------------- content ---------------- */
  function setHtml(html) {
    closeSlash();
    clearSelectedFigure();
    root.innerHTML = html || '';
    normalize();
    root.querySelectorAll('figure[data-asset] img, img[data-asset]').forEach((img) => {
      const id = img.closest('figure[data-asset]') ? img.closest('figure').dataset.asset : img.dataset.asset;
      if (opts.resolveAsset) Promise.resolve(opts.resolveAsset(id)).then((url) => { if (url) img.src = url; });
    });
    hist.stack = [{ html: root.innerHTML, caret: null }];
    hist.idx = 0;
    notifyState();
  }
  function getHtml() {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('.sel').forEach((el) => el.classList.remove('sel'));
    clone.querySelectorAll('figure[data-asset] img, img[data-asset]').forEach((img) => img.removeAttribute('src'));
    return clone.innerHTML;
  }
  function refreshPageLinks(titleOf) {
    root.querySelectorAll('.page-link[data-page]').forEach((el) => {
      const title = titleOf(el.dataset.page);
      const span = el.querySelector('.pl-title');
      if (title !== undefined && span && span.textContent !== title) span.textContent = title;
      el.classList.toggle('missing', title === undefined);
    });
  }
  function wordCount() {
    const text = root.innerText || root.textContent || '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }
  function openMenuAtCaret() {
    root.focus();
    let r = getRange();
    if (!r) { caretIn(root.lastElementChild, true); r = getRange(); }
    const line = r ? getLine(r.startContainer) : null;
    if (!line) return;
    if (line.tagName === 'PRE') return;
    const start = textBefore(line, r).length;
    insertText('/');
    openSlash(line, start, 'items');
  }
  function insertPageLinkBlock(id, title) {
    root.focus();
    const r = getRange();
    insertVoid(r ? getLine(r.startContainer) : null, makePageLink(id, title));
  }

  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.execCommand('styleWithCSS', false, true);
  if (!root.children.length) root.appendChild(newP());

  return {
    setHtml, getHtml, getState, convertLine: (type) => { const r = getRange(); if (!r) { root.focus(); return; } convertLine(getLine(r.startContainer), type); },
    exec, toggleCode, setFont, setFontSize, insertLink, clearFormat, undo, redo, insertImage, figureAction, tableAction,
    insertBlock: (id) => { root.focus(); const r = getRange(); applyItem(id, r ? getLine(r.startContainer) : null); },
    openMenuAtCaret, insertPageLinkBlock, refreshPageLinks, wordCount, flushChange, commit, saveSel, restoreSel,
    focus: () => root.focus(), closeSlash, positionSlash, isSlashOpen: () => slash.open,
    selectedText: () => { const r = getRange(); return r ? r.toString() : ''; },
    unlink: () => exec('unlink'),
  };
};
