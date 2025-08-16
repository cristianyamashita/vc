const i18n = {
  en: {
    new: 'New', open: 'Open', save: 'Save', saveAs: 'Save As', import: 'Import', export: 'Export', help: 'Help', findReplace: 'Find/Replace',
    fontSize: 'Size', about: 'About', shortcuts: 'Shortcuts:', openRecent: 'Open recent', close: 'Close',
    find: 'Find', replace: 'Replace', matchCase: 'Match case', wholeWord: 'Whole word', replaceAll: 'Replace All', next: 'Next',
    aboutText: 'Single-file rich text editor. Imports .txt/.html and .docx (via Mammoth) with limitations. Exports .txt/.html/.docx. Autosaves to localStorage. Paste images supported. Keyboard shortcuts and accessibility included. Known limitations: HTML-based formatting; .docx import/export may alter layout/formatting.',
    exportHint: 'DOCX export uses client-side conversion and may not preserve complex formatting.',
    theme: 'Theme'
  },
  pt: {
    new: 'Novo', open: 'Abrir', save: 'Salvar', saveAs: 'Salvar como', import: 'Importar', export: 'Exportar', help: 'Ajuda', findReplace: 'Localizar/Substituir',
    fontSize: 'Tamanho', about: 'Sobre', shortcuts: 'Atalhos:', openRecent: 'Abrir recentes', close: 'Fechar',
    find: 'Localizar', replace: 'Substituir', matchCase: 'Diferenciar maiúsc./minúsc.', wholeWord: 'Palavra inteira', replaceAll: 'Substituir tudo', next: 'Próximo',
    aboutText: 'Editor de rich text em arquivo único. Importa .txt/.html e .docx (via Mammoth) com limitações. Exporta .txt/.html/.docx. Salva automaticamente no localStorage. Suporta colar imagens. Inclui atalhos e acessibilidade. Limitações: formatação baseada em HTML; importação/exportação .docx pode alterar layout/estilos.',
    exportHint: 'A exportação DOCX usa conversão no cliente e pode não preservar formatações complexas.',
    theme: 'Tema'
  },
  ja: {
    new: '新規', open: '開く', save: '保存', saveAs: '名前を付けて保存', import: 'インポート', export: 'エクスポート', help: 'ヘルプ', findReplace: '検索/置換',
    fontSize: 'サイズ', about: '概要', shortcuts: 'ショートカット:', openRecent: '最近のファイル', close: '閉じる',
    find: '検索', replace: '置換', matchCase: '大文字/小文字を区別', wholeWord: '完全一致', replaceAll: 'すべて置換', next: '次へ',
    aboutText: '単一ファイルのリッチテキストエディタ。.txt/.html と .docx (Mammoth 経由) をインポート可能。ただし制限あり。.txt/.html/.docx をエクスポート。localStorage に自動保存。画像の貼り付け対応。ショートカットとアクセシビリティ対応。制限: HTML ベースの書式、.docx の入出力でレイアウトや書式が変わる可能性あり。',
    exportHint: 'DOCX エクスポートはクライアント側変換のため、複雑な書式は保持されない場合があります。',
    theme: 'テーマ'
  }
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const editor = $('#editor');
const titleInput = $('#docTitle');
const statusDoc = $('#statusDoc');
const statusSaved = $('#statusSaved');
const openModal = $('#openModal');
const recentList = $('#recentList');
const exportModal = $('#exportModal');
const findModal = $('#findModal');
const aboutText = $('#aboutText');
const toolbar = document.querySelector('.toolbar');

let currentLanguage = localStorage.getItem('app_lang') || 'pt';
$('#lang').value = currentLanguage;

function applyI18n() {
  const dict = i18n[currentLanguage] || i18n.en;
  $$('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  aboutText.textContent = dict.aboutText;
  document.title = `WordPad - ${dict.about}`;
  titleInput.placeholder = dict.new + ' ' + 'Document';
}

$('#lang').addEventListener('change', (e) => {
  currentLanguage = e.target.value;
  localStorage.setItem('app_lang', currentLanguage);
  applyI18n();
});

applyI18n();

const STORAGE_KEY = 'wordpad_docs_v1'; // legacy localStorage migration
const AUTOSAVE_KEY = 'wordpad_autosave_v1';
const THEME_KEY = 'app_theme';
const IDB_NAME = 'wordpad_db_v1';
const IDB_STORE = 'documents';
let documents = loadDocuments();
let currentDocumentId = null;
let isDirty = false;
let autosaveTimer = null;
let savedSelection = null;
let db = null;

function loadDocuments() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
async function openDb() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(IDB_STORE)) {
        d.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}
async function idbPut(doc) {
  const d = await openDb();
  await new Promise((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(id) {
  const d = await openDb();
  await new Promise((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGetAll() {
  const d = await openDb();
  const results = await new Promise((resolve, reject) => {
    const tx = d.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return results.sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
async function migrateLocalStorageToIdbIfNeeded() {
  const existing = await idbGetAll();
  if (existing.length > 0) return;
  const legacy = loadDocuments();
  if (!legacy || legacy.length === 0) return;
  for (const doc of legacy) {
    await idbPut(doc);
  }
  localStorage.removeItem(STORAGE_KEY);
}
function createNewDocument(name = defaultDocName()) {
  const id = 'doc_' + Date.now();
  const now = new Date().toISOString();
  const doc = { id, name, contentHtml: '<p></p>', createdAt: now, updatedAt: now };
  documents.unshift(doc);
  idbPut(doc);
  openDocument(id);
}
function defaultDocName() {
  const dict = i18n[currentLanguage] || i18n.en;
  return `${dict.new} Document`;
}
function openDocument(id) {
  const doc = documents.find(d => d.id === id);
  if (!doc) return;
  currentDocumentId = id;
  titleInput.value = doc.name;
  editor.innerHTML = doc.contentHtml || '<p></p>';
  isDirty = false;
  updateStatus();
  focusEditor();
}
function updateCurrentDocContent() {
  const doc = documents.find(d => d.id === currentDocumentId);
  if (!doc) return;
  doc.contentHtml = editor.innerHTML;
  doc.updatedAt = new Date().toISOString();
}
async function saveCurrentDocument(force = false) {
  if (!currentDocumentId) return;
  if (!force && !isDirty) return;
  updateCurrentDocContent();
  const doc = documents.find(d => d.id === currentDocumentId);
  if (doc) await idbPut(doc);
  isDirty = false;
  updateStatus();
}
async function renameCurrentDocument(newName) {
  const doc = documents.find(d => d.id === currentDocumentId);
  if (!doc) return;
  doc.name = newName || defaultDocName();
  doc.updatedAt = new Date().toISOString();
  await idbPut(doc);
  updateStatus();
  renderTabs();
}
function updateStatus() {
  const doc = documents.find(d => d.id === currentDocumentId);
  statusDoc.textContent = doc ? `${doc.name}` : '';
  statusSaved.textContent = isDirty ? '• unsaved' : '• saved';
  statusSaved.style.color = isDirty ? 'var(--yellow)' : 'var(--muted)';
}
function focusEditor() {
  editor.focus();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount > 0) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    savedSelection = sel.getRangeAt(0).cloneRange();
  }
}
function restoreSelection() {
  if (!savedSelection) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedSelection);
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      const snapshot = { id: currentDocumentId, html: editor.innerHTML, name: titleInput.value, ts: Date.now() };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
      updateCurrentDocContent();
      const doc = documents.find(d => d.id === currentDocumentId);
      if (doc) await idbPut(doc);
      isDirty = false;
      updateStatus();
    } catch {}
  }, 800);
}

editor.addEventListener('input', () => {
  isDirty = true;
  scheduleAutosave();
  updateStatus();
});

titleInput.addEventListener('change', () => {
  renameCurrentDocument(titleInput.value.trim());
});

$('#btnNew').addEventListener('click', async () => {
  const ok = confirm('Apagar o conteúdo do documento atual? Esta ação não pode ser desfeita.');
  if (!ok) return;
  editor.innerHTML = '<p></p>';
  isDirty = true;
  await saveCurrentDocument(true);
});
$('#btnOpen').addEventListener('click', () => {
  renderRecent();
  openModal.showModal();
});
$('#btnOpenClose').addEventListener('click', () => openModal.close());
$('#btnExportClose').addEventListener('click', () => exportModal.close());
$('#btnFindClose').addEventListener('click', () => findModal.close());

$('#btnSave').addEventListener('click', () => saveCurrentDocument(true));
$('#btnSaveAs').addEventListener('click', async () => {
  const baseName = prompt('Save as:', titleInput.value || defaultDocName());
  if (!baseName) return;
  const id = 'doc_' + Date.now();
  const now = new Date().toISOString();
  const newDoc = { id, name: baseName, contentHtml: editor.innerHTML, createdAt: now, updatedAt: now };
  documents.unshift(newDoc);
  await idbPut(newDoc);
  openDocument(id);
  renderTabs();
});

$('#btnImport').addEventListener('click', () => $('#fileInput').click());
$('#btnExport').addEventListener('click', () => exportModal.showModal());
$('#exportTxt').addEventListener('click', () => exportTxt());
$('#exportHtml').addEventListener('click', () => exportHtml());
$('#exportDocx').addEventListener('click', () => exportDocx());

$('#fileInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    if (file.name.endsWith('.txt')) {
      const text = await file.text();
      editor.innerHTML = '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
      titleInput.value = file.name.replace(/\.[^.]+$/, '');
      renameCurrentDocument(titleInput.value);
      isDirty = true; updateStatus();
    } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const html = await file.text();
      editor.innerHTML = html;
      titleInput.value = file.name.replace(/\.[^.]+$/, '');
      renameCurrentDocument(titleInput.value);
      isDirty = true; updateStatus();
    } else if (file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.convertToHtml({ arrayBuffer });
      editor.innerHTML = result.value || '<p></p>';
      titleInput.value = file.name.replace(/\.[^.]+$/, '');
      renameCurrentDocument(titleInput.value);
      isDirty = true; updateStatus();
      if (result.messages && result.messages.length > 0) console.warn('Mammoth messages:', result.messages);
    } else {
      alert('Unsupported file type');
    }
  } catch (err) {
    console.error(err);
    alert('Import failed: ' + err.message);
  } finally {
    e.target.value = '';
  }
});

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = String(s ?? '');
  return div.innerHTML;
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportTxt() {
  const text = editor.innerText.replace(/\n{3,}/g, '\n\n');
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), safeFileName(titleInput.value || 'document') + '.txt');
}
function exportHtml() {
  const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(titleInput.value || 'document')}</title><body>${editor.innerHTML}</body>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), safeFileName(titleInput.value || 'document') + '.html');
}
function exportDocx() {
  try {
    if (!window.htmlDocx) throw new Error('html-docx-js not loaded');
    const pageHtml = `<html><head><meta charset="utf-8"></head><body>${editor.innerHTML}</body></html>`;
    const blob = window.htmlDocx.asBlob(pageHtml);
    downloadBlob(blob, safeFileName(titleInput.value || 'document') + '.docx');
  } catch (e) {
    alert('DOCX export unavailable. Exporting HTML instead.');
    exportHtml();
  }
}
function safeFileName(name) { return name.replace(/[^\w\-\s]+/g, '').trim() || 'document'; }

// Formatting
toolbar.addEventListener('mousedown', () => saveSelection());

$$('.group [data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.getAttribute('data-cmd');
    restoreSelection();
    document.execCommand(cmd, false, null);
    updateToggleStates();
    editor.focus();
  });
});
$('#foreColor').addEventListener('mousedown', () => saveSelection());
$('#foreColor').addEventListener('input', (e) => {
  applyInlineStyleToSelection({ color: e.target.value });
  editor.focus();
});
$('#fontSize').addEventListener('mousedown', () => saveSelection());
$('#fontSize').addEventListener('change', (e) => applyInlineStyleToSelection({ fontSize: parseInt(e.target.value, 10) + 'px' }));

function applyInlineStyleToSelection(styleObject) {
  restoreSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    // Insert styled zero-width span so subsequent typing inherits style
    const span = document.createElement('span');
    Object.assign(span.style, styleObject);
    span.appendChild(document.createTextNode('\u200b'));
    range.insertNode(span);
    const newRange = document.createRange();
    newRange.setStart(span.firstChild, 1);
    newRange.setEnd(span.firstChild, 1);
    selection.removeAllRanges();
    selection.addRange(newRange);
  } else {
    const fragment = range.extractContents();
    const span = document.createElement('span');
    Object.assign(span.style, styleObject);
    span.appendChild(fragment);
    range.insertNode(span);
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);
  }
  isDirty = true; updateStatus();
}
function updateToggleStates() {
  const toggles = [ ['bold','bold'], ['italic','italic'], ['underline','underline'] ];
  toggles.forEach(([cmd, sel]) => {
    const isActive = document.queryCommandState(cmd);
    const el = $(`.group [data-cmd="${sel}"]`);
    if (el) el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
document.addEventListener('selectionchange', () => { if (document.activeElement === editor) updateToggleStates(); });

// Undo/Redo
$('#btnUndo').addEventListener('click', () => { restoreSelection(); document.execCommand('undo'); });
$('#btnRedo').addEventListener('click', () => { restoreSelection(); document.execCommand('redo'); });

// Clipboard image paste
editor.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : [];
  const imageItem = items.find(i => i.type && i.type.startsWith('image/'));
  if (!imageItem) return;
  e.preventDefault();
  const blob = imageItem.getAsFile();
  const reader = new FileReader();
  reader.onload = () => {
    const img = document.createElement('img');
    img.src = reader.result;
    img.alt = '';
    insertNodeAtCaret(img);
  };
  reader.readAsDataURL(blob);
});
function insertNodeAtCaret(node) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) { editor.appendChild(node); return; }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node); range.setEndAfter(node);
  sel.removeAllRanges(); sel.addRange(range);
}

// Open recent
async function renderRecent() {
  recentList.innerHTML = '';
  documents.forEach(doc => {
    const row = document.createElement('div');
    row.className = 'row';
    const left = document.createElement('div');
    left.innerHTML = `<div class="name">${escapeHtml(doc.name)}</div><div class="meta">${new Date(doc.updatedAt).toLocaleString()}</div>`;
    const right = document.createElement('div');
    const openBtn = document.createElement('button'); openBtn.className = 'btn'; openBtn.textContent = i18n[currentLanguage].open;
    const delBtn = document.createElement('button'); delBtn.className = 'btn'; delBtn.style.borderColor = 'var(--danger)'; delBtn.textContent = 'Delete';
    right.append(openBtn, delBtn);
    row.append(left, right);
    openBtn.addEventListener('click', () => { openDocument(doc.id); openModal.close(); });
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this document?')) return;
      documents = documents.filter(d => d.id !== doc.id);
      await idbDelete(doc.id);
      if (currentDocumentId === doc.id) {
        currentDocumentId = null;
        if (documents[0]) openDocument(documents[0].id); else createNewDocument();
      }
      renderRecent();
      renderTabs();
    });
    recentList.appendChild(row);
  });
}

// Find / Replace
let findState = { matches: [], index: -1 };
$('#btnFind').addEventListener('click', () => { openFindModal(); });
function openFindModal() {
  $('#findInput').value = '';
  $('#replaceInput').value = '';
  $('#matchCase').checked = false;
  $('#wholeWord').checked = false;
  findModal.showModal();
  $('#findInput').focus();
}
$('#btnFindNext').addEventListener('click', () => findNext());
$('#btnReplace').addEventListener('click', () => replaceOne());
$('#btnReplaceAll').addEventListener('click', () => replaceAll());

function buildRegex() {
  const term = $('#findInput').value;
  if (!term) return null;
  const matchCase = $('#matchCase').checked;
  const wholeWord = $('#wholeWord').checked;
  const escaped = term.replace(/[-\\/^. $*+?.()|[\]{}]/g, '\\$&');
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  const flags = matchCase ? 'g' : 'gi';
  return new RegExp(pattern, flags);
}
function collectTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n; while ((n = walker.nextNode())) { if (n.nodeValue.trim() !== '') nodes.push(n); }
  return nodes;
}
function findAllMatches() {
  const regex = buildRegex();
  if (!regex) { findState = { matches: [], index: -1 }; return; }
  const matches = [];
  collectTextNodes(editor).forEach(node => {
    let m; regex.lastIndex = 0;
    while ((m = regex.exec(node.nodeValue)) !== null) {
      matches.push({ node, start: m.index, end: m.index + m[0].length });
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  });
  findState = { matches, index: matches.length ? 0 : -1 };
}
function selectMatch(idx) {
  if (idx < 0 || idx >= findState.matches.length) return;
  const { node, start, end } = findState.matches[idx];
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  node.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
  editor.focus();
}
function findNext() {
  if (!findState.matches.length) { findAllMatches(); }
  if (!findState.matches.length) return;
  findState.index = (findState.index + 1) % findState.matches.length;
  selectMatch(findState.index);
}
function replaceOne() {
  if (!findState.matches.length) { findAllMatches(); }
  if (!findState.matches.length) return;
  const { node, start, end } = findState.matches[findState.index];
  const repl = $('#replaceInput').value;
  const before = node.nodeValue.slice(0, start);
  const after = node.nodeValue.slice(end);
  node.nodeValue = before + repl + after;
  isDirty = true; updateStatus();
  findAllMatches();
  if (findState.matches.length) selectMatch(findState.index % findState.matches.length);
}
function replaceAll() {
  const regex = buildRegex();
  if (!regex) return;
  const repl = $('#replaceInput').value;
  collectTextNodes(editor).forEach(node => {
    node.nodeValue = node.nodeValue.replace(regex, repl);
  });
  isDirty = true; updateStatus();
  findAllMatches();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
  if (k === 'i') { e.preventDefault(); document.execCommand('italic'); return; }
  if (k === 'u') { e.preventDefault(); document.execCommand('underline'); return; }
  if (k === 'z') { /* default undo */ return; }
  if (k === 'y' || (e.shiftKey && k === 'z')) { e.preventDefault(); document.execCommand('redo'); return; }
  if (k === 's') { e.preventDefault(); saveCurrentDocument(true); return; }
  if (k === 'o') { e.preventDefault(); renderRecent(); openModal.showModal(); return; }
  if (k === 'f') { e.preventDefault(); openFindModal(); return; }
  if (k === 'n') { e.preventDefault(); $('#btnNew').click(); return; }
});

// Theme toggle
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = 'fas ' + (theme === 'light' ? 'fa-sun' : 'fa-moon');
  }
}
const initialTheme = localStorage.getItem(THEME_KEY) || 'dark';
applyTheme(initialTheme);
document.getElementById('btnTheme').addEventListener('click', () => {
  const next = (localStorage.getItem(THEME_KEY) || 'dark') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

// Tabs rendering
function renderTabs() {
  const tabbar = document.getElementById('tabbar');
  if (!tabbar) return;
  tabbar.innerHTML = '';
  const add = document.createElement('button');
  add.className = 'tab add';
  add.innerHTML = '<i class="fas fa-plus"></i>';
  add.title = 'New tab';
  add.addEventListener('click', () => createNewDocument());
  tabbar.appendChild(add);
  documents.forEach(doc => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (doc.id === currentDocumentId ? ' active' : '');
    tab.title = doc.name;
    tab.innerHTML = `<span class="name">${escapeHtml(doc.name)}</span>`;
    tab.addEventListener('click', async () => {
      await saveCurrentDocument(true);
      openDocument(doc.id);
      renderTabs();
    });
    tabbar.appendChild(tab);
  });
}

// Init
(async function init() {
  try {
    await openDb();
    await migrateLocalStorageToIdbIfNeeded();
    documents = await idbGetAll();
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back to localStorage', e);
    documents = loadDocuments();
  }
  const autosaved = (() => { try { return JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null'); } catch { return null; } })();
  if (documents.length === 0) {
    createNewDocument();
  } else {
    openDocument(documents[0].id);
  }
  if (autosaved && autosaved.id === currentDocumentId && autosaved.html && confirm('Restore autosaved content?')) {
    editor.innerHTML = autosaved.html;
    titleInput.value = autosaved.name || titleInput.value;
    await renameCurrentDocument(titleInput.value);
    isDirty = true; updateStatus();
  }
  renderTabs();
})();
