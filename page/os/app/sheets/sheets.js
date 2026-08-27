window.OSSheets = (function () {
  const E = window.OSSheetsEngine;
  const I = window.OSSheetsIcons;
  const ROW_HDR = 46;
  const COL_HDR = 24;
  const DEF_W = 84;
  const DEF_H = 24;
  const MIN_ROWS = 60;
  const MIN_COLS = 26;
  const GROW = 40;
  const PALETTE = [
    "#ffffff",
    "#f4f4f4",
    "#d0d0d0",
    "#9aa0a6",
    "#5f6368",
    "#3c4043",
    "#1b1b1b",
    "#000000",
    "#fce8e6",
    "#fde7c2",
    "#fff3c4",
    "#d4edda",
    "#c8efe8",
    "#d2e3fc",
    "#e8def8",
    "#fad2e8",
    "#e74c3c",
    "#e67e22",
    "#f1c40f",
    "#27ae60",
    "#008f7d",
    "#2980b9",
    "#8e44ad",
    "#e91e63",
    "#c0392b",
    "#d35400",
    "#b7950b",
    "#1e8449",
    "#006056",
    "#1a5276",
    "#6c3483",
    "#922b21",
  ];

  let root = null;
  let api = null;
  let sel = { r: 0, c: 0, r1: 0, c1: 0, r2: 0, c2: 0 };
  let visRows = MIN_ROWS;
  let visCols = MIN_COLS;
  let editing = null;
  let clipboard = null;
  let menu = null;
  let dragging = null;
  let fillDrag = null;
  let bound = false;
  let fileInput = null;
  let status = "";
  let fsFileId = null;
  let fsSaveTimer = null;
  let openingFile = false;
  let pendingOpenId = null;
  const VCSH_MIME = "application/vnd.vc.sheets+json";
  const VCSH_EXT = ".vcsh";

  function hostWin() {
    try {
      if (window.parent && window.parent !== window) return window.parent;
    } catch (_err) {}
    return window;
  }
  function t(key, vars) {
    const i18n = hostWin().OSI18n || window.OSI18n;
    return i18n.t(key, vars);
  }
  function osfs() {
    const host = hostWin();
    return host.OSFS || window.OSFS || null;
  }
  function extOf(name) {
    const i = String(name || "").lastIndexOf(".");
    if (i <= 0) return "";
    return name.slice(i + 1).toLowerCase();
  }
  function stripExt(name) {
    const i = String(name || "").lastIndexOf(".");
    if (i <= 0) return String(name || "");
    return name.slice(0, i);
  }
  function safeFileBase(name) {
    return String(name || "Book")
      .replace(/[\\/:*?"<>|]/g, "_")
      .trim() || "Book";
  }
  function ensureVcsh(name) {
    const base = safeFileBase(stripExt(name) || name || "Book");
    return base + VCSH_EXT;
  }
  function fileNameForNode(node, bookName) {
    const ext = extOf(node && node.name) || "vcsh";
    return safeFileBase(bookName || (node && stripExt(node.name)) || "Book") + "." + ext;
  }
  function pendingHostFileId() {
    const host = hostWin();
    if (!host.OSWindows || !host.OSWindows.list) return null;
    const win = host.OSWindows.list().find(function (w) {
      return w.appId === "sheets" || w.id === "sheets";
    });
    return (win && win.fileId) || null;
  }
  function rememberFsFile(id) {
    fsFileId = id || null;
    const host = hostWin();
    if (host.OSWindows && host.OSWindows.list) {
      const win = host.OSWindows.list().find(function (w) {
        return w.appId === "sheets" || w.id === "sheets";
      });
      if (win) win.fileId = fsFileId;
    }
    if (id) E.putMeta({ lastFsFileId: id, lastWorkbookId: api && api.data && api.data.id }).catch(function () {});
  }
  function vcshBlob() {
    const data = api.toJSON();
    data.format = "vcsh";
    data.version = 1;
    data.updatedAt = Date.now();
    api.data.updatedAt = data.updatedAt;
    return new Blob([JSON.stringify(data)], { type: VCSH_MIME });
  }
  function blobForNode(node) {
    const ext = extOf(node && node.name);
    if (ext === "csv") return new Blob([E.exportCsv(api, sheetId())], { type: "text/csv" });
    if (ext === "xlsx" || ext === "xls") {
      const buf = E.exportXlsx(api);
      return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    return vcshBlob();
  }
  function persistSoon() {
    const fs = osfs();
    if (!fs) {
      E.scheduleSave(api);
      return;
    }
    E.scheduleSave(api);
    clearTimeout(fsSaveTimer);
    fsSaveTimer = setTimeout(function () {
      persistNow().catch(function () {});
    }, 400);
  }
  async function persistNow() {
    if (!api) return null;
    const fs = osfs();
    if (!fs) {
      await E.saveWorkbook(api);
      return null;
    }
    await fs.ready();
    let node = fsFileId ? await fs.get(fsFileId) : null;
    if (!node || node.kind !== "file") {
      const folder = await fs.ensureSheetsFolder();
      node = await fs.createFile(folder.id, {
        name: ensureVcsh(api.data.name),
        mime: VCSH_MIME,
        blob: vcshBlob(),
      });
      rememberFsFile(node.id);
      return node;
    }
    try {
      node = await fs.writeFile(node.id, blobForNode(node));
    } catch (_err) {
      const folder = await fs.ensureSheetsFolder();
      node = await fs.createFile(folder.id, {
        name: ensureVcsh(api.data.name),
        mime: VCSH_MIME,
        blob: vcshBlob(),
      });
      rememberFsFile(node.id);
      return node;
    }
    const want = fileNameForNode(node, api.data.name);
    if (want !== node.name) {
      try {
        node = await fs.rename(node.id, want);
      } catch (_err) {}
    }
    rememberFsFile(node.id);
    return node;
  }
  async function saveAsTo(parentId, fileName) {
    const fs = osfs();
    if (!fs) return null;
    const name = ensureVcsh(fileName || api.data.name);
    const kids = await fs.list(parentId);
    const existing = kids.find(function (n) {
      return n.kind === "file" && n.name.toLowerCase() === name.toLowerCase();
    });
    const blob = vcshBlob();
    let node;
    if (existing) {
      node = await fs.writeFile(existing.id, blob, { mime: VCSH_MIME });
    } else {
      node = await fs.createFile(parentId, { name: name, mime: VCSH_MIME, blob: blob });
    }
    api.data.name = stripExt(node.name) || api.data.name;
    rememberFsFile(node.id);
    return node;
  }
  function applyLoadedBook() {
    visRows = Math.max(MIN_ROWS, api.usedRange(api.data.activeSheetId).r + GROW);
    visCols = Math.max(MIN_COLS, api.usedRange(api.data.activeSheetId).c + 8);
    setSel(0, 0);
    hookWorkbook();
  }
  async function loadFromFs(fileId) {
    const fs = osfs();
    if (!fs || !fileId) return false;
    const node = await fs.get(fileId);
    if (!node || node.kind !== "file") return false;
    const blob = await fs.getBlob(fileId);
    if (!blob) return false;
    const ext = extOf(node.name);
    const mime = node.mime || blob.type || "";
    if (ext === "xlsx" || ext === "xls" || mime.indexOf("spreadsheet") >= 0 || mime.indexOf("ms-excel") >= 0) {
      api = E.importXlsx(await blob.arrayBuffer());
      api.data.name = stripExt(node.name) || api.data.name;
    } else if (ext === "csv" || mime === "text/csv" || mime === "application/csv") {
      api = E.importCsv(await blob.text());
      api.data.name = stripExt(node.name) || api.data.name;
    } else {
      const text = await blob.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.sheets)) throw new Error("vcsh");
      api = E.fromData(data);
      if (!api.data.name) api.data.name = stripExt(node.name);
    }
    rememberFsFile(node.id);
    applyLoadedBook();
    if (root) paint();
    return true;
  }
  async function migrateWorkbooksToFs(fs) {
    const meta = (await E.getMeta()) || {};
    if (meta.migratedFs) return;
    const folder = await fs.ensureSheetsFolder();
    const existing = await fs.list(folder.id);
    const hasVcsh = existing.some(function (n) {
      return n.kind === "file" && extOf(n.name) === "vcsh";
    });
    const books = await E.listWorkbooks();
    let lastFs = meta.lastFsFileId || null;
    const lastId = await E.lastWorkbookId();
    if (!hasVcsh) {
      for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const blob = new Blob([JSON.stringify(book)], { type: VCSH_MIME });
        const node = await fs.createFile(folder.id, {
          name: ensureVcsh(book.name || t("sheetsBook")),
          mime: VCSH_MIME,
          blob: blob,
        });
        if (book.id === lastId) lastFs = node.id;
      }
    }
    await E.putMeta({ migratedFs: true, lastFsFileId: lastFs || null });
  }
  async function openFsFile(fileId) {
    if (!fileId) return;
    if (openingFile) {
      pendingOpenId = fileId;
      return;
    }
    if (fsFileId === fileId && api) return;
    openingFile = true;
    pendingOpenId = null;
    try {
      if (editing) commitEdit();
      if (api && fsFileId && fsFileId !== fileId) {
        try {
          await persistNow();
        } catch (_err) {}
      }
      await loadFromFs(fileId);
    } catch (_err) {
      status = t("sheetsImportFail");
      if (root) updateStatus();
    } finally {
      openingFile = false;
      if (pendingOpenId && pendingOpenId !== fsFileId) {
        const next = pendingOpenId;
        pendingOpenId = null;
        openFsFile(next);
      }
    }
  }
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function sheetId() {
    return api.data.activeSheetId;
  }
  function active() {
    return api.sheetById(sheetId());
  }
  function a1Sel() {
    const a = E.a1(sel.r1, sel.c1);
    if (sel.r1 === sel.r2 && sel.c1 === sel.c2) return a;
    return a + ":" + E.a1(sel.r2, sel.c2);
  }
  function setSel(r, c, r2, c2) {
    r = Math.max(0, Math.min(E.MAX_ROWS - 1, r));
    c = Math.max(0, Math.min(E.MAX_COLS - 1, c));
    if (r2 == null) r2 = r;
    if (c2 == null) c2 = c;
    r2 = Math.max(0, Math.min(E.MAX_ROWS - 1, r2));
    c2 = Math.max(0, Math.min(E.MAX_COLS - 1, c2));
    sel.r = r;
    sel.c = c;
    sel.r1 = Math.min(r, r2);
    sel.c1 = Math.min(c, c2);
    sel.r2 = Math.max(r, r2);
    sel.c2 = Math.max(c, c2);
    visRows = Math.max(visRows, sel.r2 + GROW);
    visCols = Math.max(visCols, sel.c2 + 8);
    visRows = Math.min(E.MAX_ROWS, visRows);
    visCols = Math.min(E.MAX_COLS, visCols);
  }
  function snapSel() {
    if (!api) return;
    const originR = sel.r;
    const originC = sel.c;
    const e = api.expandToMerges(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2);
    sel.r1 = e.r1;
    sel.c1 = e.c1;
    sel.r2 = e.r2;
    sel.c2 = e.c2;
    sel.r = originR;
    sel.c = originC;
  }
  function styleOf(r, c) {
    return api.getStyle(sheetId(), r, c) || {};
  }
  function editEl() {
    if (!editing || !root) return null;
    if (editing.source === "bar") return root.querySelector(".sheets-bar");
    return root.querySelector(".sheets-edit") || root.querySelector(".sheets-bar");
  }
  function isFormulaEdit() {
    if (!editing) return false;
    const el = editEl();
    const text = el ? el.value : editing.value;
    return String(text || "").charAt(0) === "=";
  }
  function inQuoted(text) {
    let q = false;
    for (let i = 0; i < text.length; i++) if (text.charAt(i) === '"') q = !q;
    return q;
  }
  function wantsPoint() {
    if (!isFormulaEdit()) return false;
    if (editing.pointing) return true;
    const el = editEl();
    const text = el ? el.value : String(editing.value || "");
    const pos = el && el.selectionStart != null ? el.selectionStart : text.length;
    const before = text.slice(0, pos).replace(/\s+$/, "");
    if (inQuoted(before)) return false;
    if (before === "=") return true;
    return /[+\-*/^&=<>,;:(]$/.test(before);
  }
  function sheetRefPrefix(targetSheetId) {
    if (!editing || targetSheetId === editing.sheetId) return "";
    const sh = api.sheetById(targetSheetId);
    if (!sh) return "";
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sh.name)) return sh.name + "!";
    return "'" + String(sh.name).replace(/'/g, "''") + "'!";
  }
  function pointRefText(r1, c1, r2, c2) {
    const a = E.a1(Math.min(r1, r2), Math.min(c1, c2));
    const b = E.a1(Math.max(r1, r2), Math.max(c1, c2));
    return sheetRefPrefix(sheetId()) + (a === b ? a : a + ":" + b);
  }
  function captureCaret() {
    if (!editing || !root) return;
    const el = editEl();
    if (!el) return;
    editing.value = el.value;
    if (typeof el.selectionStart === "number") {
      editing.caretStart = el.selectionStart;
      editing.caretEnd = el.selectionEnd;
    }
  }
  function clearPointMode() {
    if (!editing) return;
    editing.pointing = false;
    editing.pointSpan = null;
  }
  function focusEditor() {
    const el = editEl();
    if (!el) return;
    el.focus();
    const pos = editing && editing.caretEnd != null ? editing.caretEnd : el.value.length;
    const start = editing && editing.caretStart != null ? editing.caretStart : pos;
    try {
      el.setSelectionRange(start, pos);
    } catch (_err) {}
  }
  function insertPointRef(r1, c1, r2, c2) {
    if (!editing) return;
    const el = editEl();
    const text = el ? el.value : String(editing.value || "");
    let start;
    let end;
    if (editing.pointSpan) {
      start = editing.pointSpan.start;
      end = editing.pointSpan.end;
    } else if (el && el.selectionStart != null) {
      start = el.selectionStart;
      end = el.selectionEnd;
    } else {
      start = text.length;
      end = text.length;
    }
    const ref = pointRefText(r1, c1, r2, c2);
    const next = text.slice(0, start) + ref + text.slice(end);
    editing.value = next;
    editing.pointing = true;
    editing.pointSpan = { start: start, end: start + ref.length };
    editing.caretStart = start + ref.length;
    editing.caretEnd = start + ref.length;
    const bar = root.querySelector(".sheets-bar");
    const cell = root.querySelector(".sheets-edit");
    if (bar) bar.value = next;
    if (cell) cell.value = next;
    focusEditor();
  }
  function switchSheetKeepFormula(id) {
    if (!editing || id === sheetId()) return;
    editing.ignoreBlur = true;
    editing.source = "bar";
    const input = root.querySelector(".sheets-edit");
    if (input) input.remove();
    const bar = root.querySelector(".sheets-bar");
    if (bar) bar.value = editing.value;
    api.setActive(id);
    editing.ignoreBlur = false;
    focusEditor();
  }
  function btn(name, key, extra) {
    return (
      '<button type="button" class="sheets-btn" data-act="' +
      name +
      '" data-i18n-title="' +
      key +
      '" title="' +
      escapeHtml(t(key)) +
      '">' +
      I.get(name) +
      (extra || "") +
      "</button>"
    );
  }

  async function ensureLoaded() {
    if (api) return;
    openingFile = true;
    const fs = osfs();
    const pending = pendingOpenId || pendingHostFileId();
    pendingOpenId = null;
    try {
      if (fs) {
        try {
          await fs.ready();
          await migrateWorkbooksToFs(fs);
        } catch (_err) {}
      }
      if (pending) {
        try {
          if (await loadFromFs(pending)) return;
        } catch (_err) {}
      }
      if (fs) {
        try {
          const lastFs = await E.lastFsFileId();
          if (lastFs && (await loadFromFs(lastFs))) return;
        } catch (_err) {}
      }
      try {
        const last = await E.lastWorkbookId();
        if (last) api = await E.loadWorkbook(last);
      } catch (_err) {}
      if (!api) api = E.createWorkbook(t("sheetsBook") + " 1");
      hookWorkbook();
      try {
        await persistNow();
      } catch (_err) {
        try {
          await E.saveWorkbook(api);
        } catch (_e) {}
      }
    } finally {
      openingFile = false;
      if (pendingOpenId && pendingOpenId !== fsFileId) {
        const next = pendingOpenId;
        pendingOpenId = null;
        openFsFile(next);
      }
    }
  }
  function hookWorkbook() {
    api.onChange(function () {
      persistSoon();
      if (root) paintLive();
    });
  }
  async function newBook() {
    commitEdit();
    api = E.createWorkbook(t("sheetsBook") + " " + (1 + Math.floor(Math.random() * 90)));
    visRows = MIN_ROWS;
    visCols = MIN_COLS;
    setSel(0, 0);
    fsFileId = null;
    hookWorkbook();
    await persistNow();
    paint();
  }
  async function openBook(id) {
    commitEdit();
    const next = await E.loadWorkbook(id);
    if (!next) return;
    api = next;
    visRows = Math.max(MIN_ROWS, api.usedRange(api.data.activeSheetId).r + GROW);
    visCols = Math.max(MIN_COLS, api.usedRange(api.data.activeSheetId).c + 8);
    setSel(0, 0);
    fsFileId = null;
    hookWorkbook();
    await persistNow();
    closeMenu();
    paint();
  }

  function mount(el) {
    root = el;
    if (!root) return;
    ensureLoaded().then(function () {
      if (root) paint();
    });
  }
  function remountOpen() {
    if (!root) {
      const el = document.getElementById("sheets-root");
      if (el) mount(el);
      return;
    }
    bound = false;
    if (api) paint();
    else mount(root);
  }

  function paint() {
    if (!root || !api) return;
    const sh = active();
    const used = api.usedRange(sh.id);
    visRows = Math.max(visRows, used.r + GROW, MIN_ROWS);
    visCols = Math.max(visCols, used.c + 8, MIN_COLS);
    root.innerHTML =
      '<div class="sheets-shell">' +
      ribbonHtml() +
      formulaHtml() +
      '<div class="sheets-grid-wrap">' +
      '<div class="sheets-corner"></div>' +
      '<div class="sheets-colhead"></div>' +
      '<div class="sheets-rowhead"></div>' +
      '<div class="sheets-body" tabindex="0">' +
      '<div class="sheets-sizer"></div>' +
      '<div class="sheets-layer"></div>' +
      "</div></div>" +
      tabsHtml() +
      statusHtml() +
      '<input class="sheets-file" type="file" accept=".vcsh,.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.vc.sheets+json" hidden>' +
      "</div>";
    bound = false;
    bind();
    renderGrid();
    syncFormula();
  }
  function paintLive() {
    if (!root || !root.querySelector(".sheets-shell")) {
      paint();
      return;
    }
    const tabs = root.querySelector(".sheets-tabs");
    if (tabs) tabs.outerHTML = tabsHtml();
    const name = root.querySelector(".sheets-book-name");
    if (name && document.activeElement !== name) name.value = api.data.name;
    renderGrid();
    syncFormula();
    bindTabs();
  }

  function ribbonHtml() {
    return (
      '<div class="sheets-ribbon">' +
      '<div class="sheets-ribbon-row">' +
      '<label class="sheets-book-label">' +
      escapeHtml(t("sheetsWorkbook")) +
      ' <input class="sheets-book-name" value="' +
      escapeHtml(api.data.name) +
      '" maxlength="80">' +
      "</label>" +
      '<div class="sheets-group">' +
      btn("fileNew", "sheetsNew") +
      btn("fileOpen", "sheetsOpen") +
      btn("fileSave", "sheetsSave") +
      btn("fileSaveAs", "sheetsSaveAs") +
      btn("fileImport", "sheetsImport") +
      btn("fileExport", "sheetsExport") +
      "</div>" +
      '<div class="sheets-group">' +
      btn("undo", "sheetsUndo") +
      btn("redo", "sheetsRedo") +
      btn("cut", "sheetsCut") +
      btn("copy", "sheetsCopy") +
      btn("paste", "sheetsPaste") +
      "</div>" +
      '<div class="sheets-group">' +
      btn("bold", "sheetsBold") +
      btn("italic", "sheetsItalic") +
      btn("underline", "sheetsUnderline") +
      btn("alignLeft", "sheetsAlignLeft") +
      btn("alignCenter", "sheetsAlignCenter") +
      btn("alignRight", "sheetsAlignRight") +
      btn("merge", "sheetsMerge") +
      btn("fillColor", "sheetsFill") +
      btn("fontColor", "sheetsFontColor") +
      "</div>" +
      '<div class="sheets-group">' +
      btn("percent", "sheetsPercent") +
      btn("currency", "sheetsCurrency") +
      btn("decMore", "sheetsDecMore") +
      btn("decLess", "sheetsDecLess") +
      '<select class="sheets-format" title="' +
      escapeHtml(t("sheetsFormat")) +
      '">' +
      '<option value="general">' +
      escapeHtml(t("sheetsFmtGeneral")) +
      "</option>" +
      '<option value="number">' +
      escapeHtml(t("sheetsFmtNumber")) +
      "</option>" +
      '<option value="currency">' +
      escapeHtml(t("sheetsFmtCurrency")) +
      "</option>" +
      '<option value="percent">' +
      escapeHtml(t("sheetsFmtPercent")) +
      "</option>" +
      '<option value="date">' +
      escapeHtml(t("sheetsFmtDate")) +
      "</option>" +
      '<option value="text">' +
      escapeHtml(t("sheetsFmtText")) +
      "</option>" +
      "</select>" +
      "</div>" +
      '<div class="sheets-group">' +
      btn("fx", "sheetsFx") +
      btn("insertRow", "sheetsInsertRow") +
      btn("deleteRow", "sheetsDeleteRow") +
      btn("insertCol", "sheetsInsertCol") +
      btn("deleteCol", "sheetsDeleteCol") +
      "</div>" +
      "</div></div>"
    );
  }
  function formulaHtml() {
    return (
      '<div class="sheets-formula">' +
      '<input class="sheets-namebox" spellcheck="false" value="' +
      E.a1(sel.r, sel.c) +
      '">' +
      '<button type="button" class="sheets-fx-mini" data-act="fx" title="' +
      escapeHtml(t("sheetsFx")) +
      '">fx</button>' +
      '<input class="sheets-bar" spellcheck="false" placeholder="' +
      escapeHtml(t("sheetsFormulaHint")) +
      '">' +
      "</div>"
    );
  }
  function tabsHtml() {
    const items = api.data.sheets
      .map(function (sh) {
        const on = sh.id === sheetId() ? " active" : "";
        return (
          '<button type="button" class="sheets-tab' +
          on +
          '" data-sheet="' +
          sh.id +
          '">' +
          escapeHtml(sh.name) +
          "</button>"
        );
      })
      .join("");
    return (
      '<div class="sheets-tabs">' +
      items +
      '<button type="button" class="sheets-tab-add" data-act="addSheet" title="' +
      escapeHtml(t("sheetsAddSheet")) +
      '">' +
      I.get("addSheet") +
      "</button>" +
      "</div>"
    );
  }
  function statusHtml() {
    return '<div class="sheets-status"><span class="sheets-status-text"></span></div>';
  }

  function colX(c) {
    let x = 0;
    const sh = active();
    for (let i = 0; i < c; i++) x += (sh.colWidths[i] || DEF_W);
    return x;
  }
  function colW(c) {
    return active().colWidths[c] || DEF_W;
  }
  function totalW() {
    return colX(visCols);
  }
  function totalH() {
    return visRows * DEF_H;
  }

  function renderGrid() {
    if (!root) return;
    const body = root.querySelector(".sheets-body");
    const layer = root.querySelector(".sheets-layer");
    const sizer = root.querySelector(".sheets-sizer");
    const colhead = root.querySelector(".sheets-colhead");
    const rowhead = root.querySelector(".sheets-rowhead");
    if (!body || !layer) return;
    const sl = body.scrollLeft;
    const st = body.scrollTop;
    const vw = body.clientWidth;
    const vh = body.clientHeight;
    visRows = Math.min(E.MAX_ROWS, Math.max(visRows, Math.floor((st + vh) / DEF_H) + GROW));
    let tw = totalW();
    while (visCols < E.MAX_COLS && tw < sl + vw + DEF_W * 8) {
      tw += colW(visCols);
      visCols++;
    }
    sizer.style.width = totalW() + "px";
    sizer.style.height = totalH() + "px";
    const xs = new Array(visCols + 1);
    xs[0] = 0;
    for (let i = 0; i < visCols; i++) xs[i + 1] = xs[i] + colW(i);
    function cx(c) {
      return xs[c] || 0;
    }
    const startR = Math.max(0, Math.floor(st / DEF_H) - 1);
    const endR = Math.min(visRows - 1, Math.ceil((st + vh) / DEF_H) + 1);
    let startC = 0;
    let acc = 0;
    while (startC < visCols && acc + colW(startC) < sl) {
      acc += colW(startC);
      startC++;
    }
    startC = Math.max(0, startC - 1);
    let endC = startC;
    let x = cx(startC);
    while (endC < visCols && x < sl + vw + DEF_W) {
      x += colW(endC);
      endC++;
    }
    endC = Math.min(visCols - 1, endC + 1);

    let cols = "";
    for (let c = startC; c <= endC; c++) {
      const on = c >= sel.c1 && c <= sel.c2 ? " on" : "";
      cols +=
        '<div class="sheets-hcell' +
        on +
        '" data-col="' +
        c +
        '" style="left:' +
        (cx(c) - sl) +
        "px;top:0;width:" +
        colW(c) +
        "px;height:" +
        COL_HDR +
        'px">' +
        E.colName(c) +
        '<span class="sheets-col-resizer" data-col="' +
        c +
        '"></span></div>';
    }
    colhead.style.transform = "";
    colhead.innerHTML = cols;

    let rows = "";
    for (let r = startR; r <= endR; r++) {
      const on = r >= sel.r1 && r <= sel.r2 ? " on" : "";
      rows +=
        '<div class="sheets-hcell' +
        on +
        '" data-row="' +
        r +
        '" style="left:0;top:' +
        (r * DEF_H - st) +
        "px;width:" +
        ROW_HDR +
        "px;height:" +
        DEF_H +
        'px">' +
        (r + 1) +
        "</div>";
    }
    rowhead.style.transform = "";
    rowhead.innerHTML = rows;

    let cells = "";
    const sid = sheetId();
    const mergeList = (api.sheetById(sid) && api.sheetById(sid).merges) || [];
    function appendCell(r, c) {
      const merged = api.mergeAt(sid, r, c);
      if (merged && (merged.r1 !== r || merged.c1 !== c)) return;
      const stl = api.getStyle(sid, r, c) || {};
      const val = api.display(sid, r, c);
      const raw = api.getRaw(sid, r, c);
      const cls = ["sheets-cell"];
      let left = cx(c);
      let top = r * DEF_H;
      let width = colW(c);
      let height = DEF_H;
      if (merged) {
        cls.push("merged");
        left = cx(merged.c1);
        top = merged.r1 * DEF_H;
        width = cx(merged.c2) + colW(merged.c2) - left;
        height = (merged.r2 - merged.r1 + 1) * DEF_H;
      }
      if (r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2) cls.push("sel");
      if (r === sel.r && c === sel.c) cls.push("active");
      if (editing && editing.sheetId === sid && r === editing.r && c === editing.c) cls.push("edit");
      if (E.isErr(api.getValue(sid, r, c))) cls.push("err");
      const css = [];
      if (stl.bold) css.push("font-weight:700");
      if (stl.italic) css.push("font-style:italic");
      if (stl.underline) css.push("text-decoration:underline");
      if (stl.align) css.push("text-align:" + stl.align);
      if (stl.fill) css.push("background:" + stl.fill);
      if (stl.color) css.push("color:" + stl.color);
      if (stl.wrap) css.push("white-space:pre-wrap");
      cells +=
        '<div class="' +
        cls.join(" ") +
        '" data-r="' +
        r +
        '" data-c="' +
        c +
        '" style="left:' +
        left +
        "px;top:" +
        top +
        "px;width:" +
        width +
        "px;height:" +
        height +
        "px;" +
        css.join(";") +
        '" title="' +
        escapeHtml(raw) +
        '">' +
        escapeHtml(val) +
        "</div>";
    }
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) appendCell(r, c);
    }
    mergeList.forEach(function (m) {
      if (m.r2 < startR || m.r1 > endR || m.c2 < startC || m.c1 > endC) return;
      if (m.r1 >= startR && m.r1 <= endR && m.c1 >= startC && m.c1 <= endC) return;
      appendCell(m.r1, m.c1);
    });
    const x1 = cx(sel.c1);
    const y1 = sel.r1 * DEF_H;
    const x2 = cx(sel.c2) + colW(sel.c2);
    const y2 = (sel.r2 + 1) * DEF_H;
    cells +=
      '<div class="sheets-sel' +
      (editing && editing.pointing ? " pointing" : "") +
      '" style="left:' +
      x1 +
      "px;top:" +
      y1 +
      "px;width:" +
      (x2 - x1) +
      "px;height:" +
      (y2 - y1) +
      'px"></div>';
    if (!isFormulaEdit()) {
      cells +=
        '<div class="sheets-fill" data-fill="1" style="left:' +
        (x2 - 5) +
        "px;top:" +
        (y2 - 5) +
        'px"></div>';
    }
    if (editing) {
      captureCaret();
      editing.ignoreBlur = true;
    }
    layer.innerHTML = cells;
    updateStatus();
    if (editing && sheetId() === editing.sheetId && editing.source === "cell") placeEditor();
    else if (editing) {
      editing.ignoreBlur = false;
      focusEditor();
    }
  }

  function updateStatus() {
    const el = root && root.querySelector(".sheets-status-text");
    if (!el) return;
    const sid = sheetId();
    let sum = 0;
    let count = 0;
    let n = 0;
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        n++;
        const merged = api.mergeAt(sid, r, c);
        if (merged && (merged.r1 !== r || merged.c1 !== c)) continue;
        const v = api.getValue(sid, r, c);
        if (typeof v === "number") {
          sum += v;
          count++;
        }
      }
    }
    const parts = [a1Sel()];
    if (count) {
      parts.push("SUM=" + (Math.round(sum * 1e8) / 1e8));
      parts.push("AVG=" + Math.round((sum / count) * 1e8) / 1e8);
      parts.push("COUNT=" + count);
    } else parts.push("N=" + n);
    if (status) parts.push(status);
    el.textContent = parts.join("   ");
  }

  function syncFormula() {
    if (!root) return;
    const box = root.querySelector(".sheets-namebox");
    const bar = root.querySelector(".sheets-bar");
    const fmt = root.querySelector(".sheets-format");
    if (box && document.activeElement !== box) box.value = a1Sel();
    if (bar && document.activeElement !== bar && !editing) bar.value = api.getRaw(sheetId(), sel.r, sel.c);
    if (fmt) fmt.value = styleOf(sel.r, sel.c).format || "general";
    ["bold", "italic", "underline"].forEach(function (k) {
      const b = root.querySelector('[data-act="' + k + '"]');
      if (b) b.classList.toggle("on", !!styleOf(sel.r, sel.c)[k]);
    });
    const mergeBtn = root.querySelector('[data-act="merge"]');
    if (mergeBtn) {
      const m = api.mergeAt(sheetId(), sel.r, sel.c);
      const on = !!(m && m.r1 === sel.r1 && m.c1 === sel.c1 && m.r2 === sel.r2 && m.c2 === sel.c2);
      mergeBtn.classList.toggle("on", on);
      mergeBtn.setAttribute("data-i18n-title", on ? "sheetsUnmerge" : "sheetsMerge");
      mergeBtn.title = t(on ? "sheetsUnmerge" : "sheetsMerge");
    }
  }

  function bind() {
    if (!root || bound) return;
    bound = true;
    fileInput = root.querySelector(".sheets-file");
    root.addEventListener("click", onClick);
    root.addEventListener("dblclick", onDbl);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKey);
    root.addEventListener("pointerdown", onPointerDown);
    const body = root.querySelector(".sheets-body");
    body.addEventListener("scroll", onScroll);
    body.addEventListener("contextmenu", onContext);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(function () {
        renderGrid();
      });
      ro.observe(body);
    }
    const bar = root.querySelector(".sheets-bar");
    bar.addEventListener("focus", function () {
      if (!editing) startEdit("bar");
    });
    bar.addEventListener("pointerdown", function () {
      if (editing) clearPointMode();
    });
    bar.addEventListener("blur", function () {
      if (editing && editing.ignoreBlur) return;
      if (editing && (editing.pointing || dragging === "point")) {
        focusEditor();
        return;
      }
      if (editing && editing.source === "bar") commitEdit(bar.value);
    });
    fileInput.addEventListener("change", onFile);
    bindTabs();
  }
  function bindTabs() {
    const tabs = root.querySelector(".sheets-tabs");
    if (!tabs) return;
    tabs.querySelectorAll(".sheets-tab").forEach(function (tab) {
      tab.addEventListener("dblclick", function (e) {
        e.stopPropagation();
        renameSheet(tab.getAttribute("data-sheet"));
      });
      tab.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        e.stopPropagation();
        showSheetMenu(tab.getAttribute("data-sheet"), e.clientX, e.clientY);
      });
    });
  }

  function onScroll() {
    const body = root.querySelector(".sheets-body");
    if (body.scrollTop + body.clientHeight > totalH() - 200) {
      visRows = Math.min(E.MAX_ROWS, visRows + GROW);
    }
    if (body.scrollLeft + body.clientWidth > totalW() - 200) {
      visCols = Math.min(E.MAX_COLS, visCols + 12);
    }
    renderGrid();
  }

  function cellFromPoint(x, y) {
    const body = root.querySelector(".sheets-body");
    const rect = body.getBoundingClientRect();
    const px = x - rect.left + body.scrollLeft;
    const py = y - rect.top + body.scrollTop;
    const r = Math.max(0, Math.min(visRows - 1, Math.floor(py / DEF_H)));
    let acc = 0;
    let c = 0;
    while (c < visCols - 1 && acc + colW(c) <= px) {
      acc += colW(c);
      c++;
    }
    return { r: r, c: c };
  }

  function onClick(e) {
    const act = e.target.closest("[data-act]");
    if (act) {
      run(act.getAttribute("data-act"));
      return;
    }
    const tab = e.target.closest(".sheets-tab");
    if (tab && tab.getAttribute("data-sheet")) {
      if (isFormulaEdit()) {
        switchSheetKeepFormula(tab.getAttribute("data-sheet"));
        return;
      }
      commitEdit();
      api.setActive(tab.getAttribute("data-sheet"));
      const used = api.usedRange(sheetId());
      visRows = Math.max(MIN_ROWS, used.r + GROW);
      visCols = Math.max(MIN_COLS, used.c + 8);
      paint();
      return;
    }
    const hcol = e.target.closest(".sheets-hcell[data-col]");
    if (hcol && !e.target.classList.contains("sheets-col-resizer")) {
      if (isFormulaEdit()) return;
      const c = Number(hcol.getAttribute("data-col"));
      setSel(0, c, visRows - 1, c);
      snapSel();
      renderGrid();
      syncFormula();
      return;
    }
    const hrow = e.target.closest(".sheets-hcell[data-row]");
    if (hrow) {
      if (isFormulaEdit()) return;
      const r = Number(hrow.getAttribute("data-row"));
      setSel(r, 0, r, visCols - 1);
      snapSel();
      renderGrid();
      syncFormula();
    }
  }
  function onDbl(e) {
    if (isFormulaEdit()) return;
    const cell = e.target.closest(".sheets-cell");
    if (cell) startEdit("cell");
  }
  function onInput(e) {
    if (e.target.classList.contains("sheets-book-name")) {
      api.setName(e.target.value);
    }
    if (editing && (e.target.classList.contains("sheets-bar") || e.target.classList.contains("sheets-edit"))) {
      const wasPointing = editing.pointing;
      editing.value = e.target.value;
      clearPointMode();
      if (typeof e.target.selectionStart === "number") {
        editing.caretStart = e.target.selectionStart;
        editing.caretEnd = e.target.selectionEnd;
      }
      if (e.target.classList.contains("sheets-edit")) {
        const bar = root.querySelector(".sheets-bar");
        if (bar) bar.value = editing.value;
      }
      if (wasPointing) renderGrid();
    }
  }
  function onChange(e) {
    if (e.target.classList.contains("sheets-format")) {
      api.applyStyleRange(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2, { format: e.target.value });
    }
  }

  function onPointerDown(e) {
    if (e.target.closest(".sheets-col-resizer")) {
      const c = Number(e.target.getAttribute("data-col"));
      const startX = e.clientX;
      const startW = colW(c);
      const move = function (ev) {
        api.setColWidth(sheetId(), c, startW + (ev.clientX - startX));
        renderGrid();
      };
      const up = function () {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      e.preventDefault();
      return;
    }
    if (e.target.closest(".sheets-tab") && isFormulaEdit()) {
      e.preventDefault();
      return;
    }
    if (e.target.closest(".sheets-fill")) {
      if (isFormulaEdit()) return;
      fillDrag = { r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 };
      const move = function (ev) {
        const p = cellFromPoint(ev.clientX, ev.clientY);
        setSel(fillDrag.r1, fillDrag.c1, p.r, p.c);
        sel.r = fillDrag.r1;
        sel.c = fillDrag.c1;
        renderGrid();
      };
      const up = function (ev) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!fillDrag) return;
        const p = cellFromPoint(ev.clientX, ev.clientY);
        api.fill(sheetId(), fillDrag.r1, fillDrag.c1, fillDrag.r2, fillDrag.c2, p.r, p.c);
        fillDrag = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      e.preventDefault();
      return;
    }
    const cell = e.target.closest(".sheets-cell");
    if (!cell || e.button !== 0) return;
    const r = Number(cell.getAttribute("data-r"));
    const c = Number(cell.getAttribute("data-c"));
    if (isFormulaEdit() && wantsPoint()) {
      e.preventDefault();
      editing.ignoreBlur = true;
      const hit = api.mergeAt(sheetId(), r, c);
      const pr1 = hit ? hit.r1 : r;
      const pc1 = hit ? hit.c1 : c;
      const pr2 = hit ? hit.r2 : r;
      const pc2 = hit ? hit.c2 : c;
      setSel(pr1, pc1, pr2, pc2);
      snapSel();
      insertPointRef(sel.r1, sel.c1, sel.r2, sel.c2);
      dragging = "point";
      renderGrid();
      const originR = pr1;
      const originC = pc1;
      const move = function (ev) {
        if (dragging !== "point") return;
        const p = cellFromPoint(ev.clientX, ev.clientY);
        setSel(originR, originC, p.r, p.c);
        sel.r = originR;
        sel.c = originC;
        snapSel();
        insertPointRef(sel.r1, sel.c1, sel.r2, sel.c2);
        renderGrid();
      };
      const up = function () {
        dragging = false;
        if (editing) editing.ignoreBlur = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        focusEditor();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    root.querySelector(".sheets-body").focus();
    commitEdit();
    if (e.shiftKey) setSel(sel.r, sel.c, r, c);
    else setSel(r, c);
    snapSel();
    dragging = true;
    renderGrid();
    syncFormula();
    const move = function (ev) {
      if (!dragging) return;
      const p = cellFromPoint(ev.clientX, ev.clientY);
      setSel(sel.r, sel.c, p.r, p.c);
      snapSel();
      renderGrid();
    };
    const up = function () {
      dragging = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onContext(e) {
    const cell = e.target.closest(".sheets-cell");
    if (!cell) return;
    e.preventDefault();
    const r = Number(cell.getAttribute("data-r"));
    const c = Number(cell.getAttribute("data-c"));
    if (!(r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2)) setSel(r, c);
    showMenu(e.clientX, e.clientY, [
      [t("sheetsCut"), function () {
        run("cut");
      }],
      [t("sheetsCopy"), function () {
        run("copy");
      }],
      [t("sheetsPaste"), function () {
        run("paste");
      }],
      [t("sheetsMerge"), function () {
        run("merge");
      }],
      [t("sheetsInsertRow"), function () {
        run("insertRow");
      }],
      [t("sheetsDeleteRow"), function () {
        run("deleteRow");
      }],
      [t("sheetsInsertCol"), function () {
        run("insertCol");
      }],
      [t("sheetsDeleteCol"), function () {
        run("deleteCol");
      }],
    ]);
  }

  function onKey(e) {
    if (e.target.classList.contains("sheets-book-name")) return;
    if (e.target.classList.contains("sheets-search")) return;
    const inBar = e.target.classList.contains("sheets-bar") || e.target.classList.contains("sheets-edit");
    const inName = e.target.classList.contains("sheets-namebox");
    if (inName && e.key === "Enter") {
      e.preventDefault();
      gotoA1(e.target.value);
      return;
    }
    if (inBar) {
      if (isFormulaEdit() && (wantsPoint() || editing.pointing) && e.key.slice(0, 5) === "Arrow") {
        e.preventDefault();
        e.stopPropagation();
        pointByKey(e);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (editing) commitEdit(e.target.value, e.shiftKey ? -1 : 1, 0);
        else {
          api.setCell(sheetId(), sel.r, sel.c, e.target.value);
          move(e.shiftKey ? -1 : 1, 0);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (editing) commitEdit(e.target.value, 0, e.shiftKey ? -1 : 1);
        else {
          api.setCell(sheetId(), sel.r, sel.c, e.target.value);
          move(0, e.shiftKey ? -1 : 1);
        }
      }
      return;
    }
    if (editing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      api.undo();
      return;
    }
    if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      api.redo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "c") {
      e.preventDefault();
      run("copy");
      return;
    }
    if (ctrl && e.key.toLowerCase() === "x") {
      e.preventDefault();
      run("cut");
      return;
    }
    if (ctrl && e.key.toLowerCase() === "v") {
      e.preventDefault();
      run("paste");
      return;
    }
    if (ctrl && e.key.toLowerCase() === "b") {
      e.preventDefault();
      run("bold");
      return;
    }
    if (ctrl && e.key.toLowerCase() === "i") {
      e.preventDefault();
      run("italic");
      return;
    }
    if (ctrl && e.key.toLowerCase() === "u") {
      e.preventDefault();
      run("underline");
      return;
    }
    if (ctrl && e.key.toLowerCase() === "s") {
      e.preventDefault();
      run("fileSave");
      return;
    }
    if (e.key === "F2") {
      e.preventDefault();
      startEdit("cell");
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      api.clearRange(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      move(e.shiftKey ? -1 : 1, 0);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      move(0, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSel(-1, 0, e.shiftKey);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSel(1, 0, e.shiftKey);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveSel(0, -1, e.shiftKey);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      moveSel(0, 1, e.shiftKey);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      if (e.ctrlKey) setSel(0, 0);
      else setSel(sel.r, 0);
      renderGrid();
      syncFormula();
      return;
    }
    if (!ctrl && !e.altKey && !e.metaKey && e.key.length === 1) {
      e.preventDefault();
      startEdit("cell", e.key);
    }
  }

  function move(dr, dc) {
    const bar = root.querySelector(".sheets-bar");
    if (bar && document.activeElement === bar) bar.blur();
    const m = api.mergeAt(sheetId(), sel.r, sel.c);
    let nr = sel.r + dr;
    let nc = sel.c + dc;
    if (m) {
      if (dr > 0) nr = m.r2 + 1;
      else if (dr < 0) nr = m.r1 - 1;
      if (dc > 0) nc = m.c2 + 1;
      else if (dc < 0) nc = m.c1 - 1;
    }
    setSel(nr, nc);
    snapSel();
    ensureVisible();
    renderGrid();
    syncFormula();
    root.querySelector(".sheets-body").focus();
  }
  function moveSel(dr, dc, extend) {
    if (extend) setSel(sel.r, sel.c, sel.r2 + dr, sel.c2 + dc);
    else {
      const m = api.mergeAt(sheetId(), sel.r, sel.c);
      let nr = sel.r + dr;
      let nc = sel.c + dc;
      if (m) {
        if (dr > 0) nr = m.r2 + 1;
        else if (dr < 0) nr = m.r1 - 1;
        if (dc > 0) nc = m.c2 + 1;
        else if (dc < 0) nc = m.c1 - 1;
      }
      setSel(nr, nc);
    }
    snapSel();
    ensureVisible();
    renderGrid();
    syncFormula();
  }
  function ensureVisible() {
    const body = root.querySelector(".sheets-body");
    const y = sel.r * DEF_H;
    const x = colX(sel.c);
    if (y < body.scrollTop) body.scrollTop = y;
    if (y + DEF_H > body.scrollTop + body.clientHeight) body.scrollTop = y + DEF_H - body.clientHeight;
    if (x < body.scrollLeft) body.scrollLeft = x;
    if (x + colW(sel.c) > body.scrollLeft + body.clientWidth) body.scrollLeft = x + colW(sel.c) - body.clientWidth;
  }
  function gotoA1(text) {
    const parsed = E.parseA1(String(text).split(":")[0]);
    if (!parsed) return;
    setSel(parsed.r, parsed.c);
    visRows = Math.max(visRows, parsed.r + GROW);
    visCols = Math.max(visCols, parsed.c + 8);
    renderGrid();
    ensureVisible();
    syncFormula();
    root.querySelector(".sheets-body").focus();
  }

  function pointByKey(e) {
    const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!editing.pointing) {
      setSel(Math.max(0, editing.r + dr), Math.max(0, editing.c + dc));
    } else if (e.shiftKey) {
      setSel(sel.r, sel.c, sel.r2 + dr, sel.c2 + dc);
    } else {
      setSel(sel.r + dr, sel.c + dc);
    }
    snapSel();
    insertPointRef(sel.r1, sel.c1, sel.r2, sel.c2);
    ensureVisible();
    renderGrid();
  }
  function startEdit(source, seed) {
    if (editing && editing.source === source && source === "bar") return;
    if (editing) commitEdit();
    const m = api.mergeAt(sheetId(), sel.r, sel.c);
    const er = m ? m.r1 : sel.r;
    const ec = m ? m.c1 : sel.c;
    editing = {
      r: er,
      c: ec,
      sheetId: sheetId(),
      source: source,
      value: seed != null ? seed : api.getRaw(sheetId(), er, ec),
      pointing: false,
      pointSpan: null,
    };
    if (source === "bar") {
      const bar = root.querySelector(".sheets-bar");
      bar.focus();
      bar.value = editing.value;
      return;
    }
    placeEditor();
  }
  function commitEdit(value, dr, dc) {
    if (!editing) return;
    const r = editing.r;
    const c = editing.c;
    const originSheet = editing.sheetId;
    const bar = root.querySelector(".sheets-bar");
    const v = value != null ? value : editing.source === "bar" && bar ? bar.value : editing.value;
    editing = null;
    const input = root.querySelector(".sheets-edit");
    if (input) input.remove();
    if (originSheet && originSheet !== sheetId()) api.setActive(originSheet);
    api.setCell(originSheet || sheetId(), r, c, v);
    setSel(r, c);
    snapSel();
    if (dr || dc) move(dr || 0, dc || 0);
    else {
      renderGrid();
      syncFormula();
    }
  }
  function placeEditor() {
    if (!editing) return;
    let input = root.querySelector(".sheets-edit");
    if (!input) {
      input = document.createElement("input");
      input.className = "sheets-edit";
      input.spellcheck = false;
      root.querySelector(".sheets-layer").appendChild(input);
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if ((wantsPoint() || (editing && editing.pointing)) && e.key.slice(0, 5) === "Arrow") {
          e.preventDefault();
          pointByKey(e);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          commitEdit(input.value, e.shiftKey ? -1 : 1, 0);
        } else if (e.key === "Tab") {
          e.preventDefault();
          commitEdit(input.value, 0, e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelEdit();
        }
      });
      input.addEventListener("mousedown", function () {
        clearPointMode();
      });
      input.addEventListener("blur", function () {
        if (!editing) return;
        if (editing.ignoreBlur || editing.pointing || dragging === "point") return;
        commitEdit(input.value);
      });
    }
    input.value = editing.value;
    const merged = api.mergeAt(editing.sheetId || sheetId(), editing.r, editing.c);
    let ew = colW(editing.c);
    let eh = DEF_H;
    if (merged && merged.r1 === editing.r && merged.c1 === editing.c) {
      ew = colX(merged.c2) + colW(merged.c2) - colX(merged.c1);
      eh = (merged.r2 - merged.r1 + 1) * DEF_H;
    }
    input.style.left = colX(editing.c) + "px";
    input.style.top = editing.r * DEF_H + "px";
    input.style.width = ew + "px";
    input.style.height = eh + "px";
    input.focus();
    if (editing.caretStart != null) {
      try {
        input.setSelectionRange(editing.caretStart, editing.caretEnd != null ? editing.caretEnd : editing.caretStart);
      } catch (_err) {}
    } else {
      const n = input.value.length;
      input.selectionStart = input.selectionEnd = n;
    }
    editing.ignoreBlur = false;
  }
  function cancelEdit() {
    if (!editing) return;
    const originSheet = editing.sheetId;
    const r = editing.r;
    const c = editing.c;
    editing = null;
    const input = root.querySelector(".sheets-edit");
    if (input) input.remove();
    if (originSheet && originSheet !== sheetId()) api.setActive(originSheet);
    setSel(r, c);
    renderGrid();
    syncFormula();
    root.querySelector(".sheets-body").focus();
  }

  function toggleStyle(key) {
    const cur = !styleOf(sel.r, sel.c)[key];
    const patch = {};
    patch[key] = cur;
    api.applyStyleRange(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2, patch);
  }

  function run(name) {
    closeMenu();
    const sid = sheetId();
    if (name === "fileNew") return newBook();
    if (name === "fileOpen") return showOpen();
    if (name === "fileSave") {
      persistNow()
        .then(function () {
          status = t("sheetsSaved");
          updateStatus();
        })
        .catch(function () {
          status = t("sheetsExportFail");
          updateStatus();
        });
      return;
    }
    if (name === "fileSaveAs") return showSaveAs();
    if (name === "fileImport") {
      fileInput.click();
      return;
    }
    if (name === "fileExport") return showExport();
    if (name === "undo") return api.undo();
    if (name === "redo") return api.redo();
    if (name === "cut") {
      clipboard = { block: api.copyRange(sid, sel.r1, sel.c1, sel.r2, sel.c2), merges: api.copyMerges(sid, sel.r1, sel.c1, sel.r2, sel.c2), cut: true };
      writeClip();
      api.clearRange(sid, sel.r1, sel.c1, sel.r2, sel.c2);
      return;
    }
    if (name === "copy") {
      clipboard = { block: api.copyRange(sid, sel.r1, sel.c1, sel.r2, sel.c2), merges: api.copyMerges(sid, sel.r1, sel.c1, sel.r2, sel.c2), cut: false };
      writeClip();
      return;
    }
    if (name === "paste") return paste();
    if (name === "bold") return toggleStyle("bold");
    if (name === "italic") return toggleStyle("italic");
    if (name === "underline") return toggleStyle("underline");
    if (name === "alignLeft") return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { align: "left" });
    if (name === "alignCenter") return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { align: "center" });
    if (name === "alignRight") return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { align: "right" });
    if (name === "merge") {
      api.toggleMerge(sid, sel.r1, sel.c1, sel.r2, sel.c2);
      snapSel();
      return;
    }
    if (name === "fillColor") return showPalette("fill");
    if (name === "fontColor") return showPalette("color");
    if (name === "percent") return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { format: "percent" });
    if (name === "currency") return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { format: "currency" });
    if (name === "decMore") {
      const d = (styleOf(sel.r, sel.c).decimals != null ? styleOf(sel.r, sel.c).decimals : 2) + 1;
      return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { decimals: Math.min(8, d), format: styleOf(sel.r, sel.c).format || "number" });
    }
    if (name === "decLess") {
      const d = (styleOf(sel.r, sel.c).decimals != null ? styleOf(sel.r, sel.c).decimals : 2) - 1;
      return api.applyStyleRange(sid, sel.r1, sel.c1, sel.r2, sel.c2, { decimals: Math.max(0, d), format: styleOf(sel.r, sel.c).format || "number" });
    }
    if (name === "fx") return showFx();
    if (name === "insertRow") return api.insertRows(sid, sel.r1, sel.r2 - sel.r1 + 1);
    if (name === "deleteRow") return api.deleteRows(sid, sel.r1, sel.r2 - sel.r1 + 1);
    if (name === "insertCol") return api.insertCols(sid, sel.c1, sel.c2 - sel.c1 + 1);
    if (name === "deleteCol") return api.deleteCols(sid, sel.c1, sel.c2 - sel.c1 + 1);
    if (name === "addSheet") {
      api.addSheet();
      paint();
    }
  }

  function writeClip() {
    const text = clipboard.block
      .map(function (row) {
        return row.map(function (c) {
          return c.raw;
        }).join("\t");
      })
      .join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function () {});
  }
  async function paste() {
    let block = clipboard && clipboard.block;
    if (!block && navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        block = text.split(/\r?\n/).map(function (line) {
          return line.split("\t").map(function (raw) {
            return { raw: raw, style: {} };
          });
        });
      } catch (_err) {}
    }
    if (!block) return;
    api.pasteRange(sheetId(), sel.r, sel.c, block, false, clipboard && clipboard.merges);
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".vcsh") || name.endsWith(".json")) {
        const data = JSON.parse(await file.text());
        api = E.fromData(data);
        api.setName(file.name.replace(/\.(vcsh|json)$/i, "") || api.data.name);
      } else if (name.endsWith(".csv") || file.type.indexOf("csv") >= 0) {
        const text = await file.text();
        api = E.importCsv(text);
        api.setName(file.name.replace(/\.csv$/i, ""));
      } else {
        const buf = await file.arrayBuffer();
        api = E.importXlsx(buf);
        api.setName(file.name.replace(/\.xlsx?$/i, ""));
      }
      setSel(0, 0);
      visRows = Math.max(MIN_ROWS, api.usedRange(api.data.activeSheetId).r + GROW);
      visCols = Math.max(MIN_COLS, api.usedRange(api.data.activeSheetId).c + 8);
      fsFileId = null;
      hookWorkbook();
      await persistNow();
      paint();
    } catch (_err) {
      status = t("sheetsImportFail");
      updateStatus();
    }
  }
  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
  }
  function showExport() {
    showMenuFrom(root.querySelector('[data-act="fileExport"]'), [
      ["CSV", function () {
        const csv = E.exportCsv(api, sheetId());
        download((api.data.name || "sheet") + ".csv", new Blob([csv], { type: "text/csv" }));
      }],
      ["Excel (.xlsx)", function () {
        try {
          const buf = E.exportXlsx(api);
          download((api.data.name || "sheet") + ".xlsx", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        } catch (_err) {
          status = t("sheetsExportFail");
          updateStatus();
        }
      }],
    ]);
  }
  async function showOpen() {
    closeMenu();
    const fs = osfs();
    if (!fs) {
      const list = await E.listWorkbooks();
      const items = list.map(function (row) {
        return [
          row.name + "  ·  " + new Date(row.updatedAt || 0).toLocaleString(),
          function () {
            openBook(row.id);
          },
        ];
      });
      if (!items.length) items.push([t("sheetsNoBooks"), function () {}]);
      showMenuFrom(root.querySelector('[data-act="fileOpen"]'), items);
      return;
    }
    const files = await fs.listFilesByExt(fs.SHEETS_EXTS || ["vcsh", "xlsx", "xls", "csv"]);
    files.sort(function (a, b) {
      return (b.modifiedAt || 0) - (a.modifiedAt || 0);
    });
    const overlay = document.createElement("div");
    overlay.className = "sheets-overlay";
    let rows = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = await fs.pathOf(file.parentId || fs.ROOT_ID);
      rows +=
        '<button type="button" class="sheets-fx-item" data-id="' +
        escapeHtml(file.id) +
        '"><strong>' +
        escapeHtml(file.name) +
        "</strong><span>" +
        escapeHtml(path) +
        "</span></button>";
    }
    if (!rows) rows = "<p>" + escapeHtml(t("sheetsNoBooks")) + "</p>";
    overlay.innerHTML =
      '<div class="sheets-modal">' +
      "<h2>" +
      escapeHtml(t("sheetsOpen")) +
      "</h2>" +
      '<div class="sheets-fx-list sheets-picker-list">' +
      rows +
      "</div>" +
      '<div class="sheets-modal-actions"><button type="button" class="sheets-close-modal">' +
      escapeHtml(t("sheetsClose")) +
      "</button></div></div>";
    root.querySelector(".sheets-shell").appendChild(overlay);
    overlay.querySelector(".sheets-close-modal").addEventListener("click", function () {
      overlay.remove();
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelectorAll("[data-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        overlay.remove();
        openFsFile(btn.getAttribute("data-id"));
      });
    });
  }
  async function showSaveAs() {
    closeMenu();
    commitEdit();
    const fs = osfs();
    if (!fs) {
      download(ensureVcsh(api.data.name), vcshBlob());
      status = t("sheetsSaved");
      updateStatus();
      return;
    }
    await fs.ready();
    let selectedId = null;
    if (fsFileId) {
      const cur = await fs.get(fsFileId);
      selectedId = cur && cur.parentId;
    }
    if (!selectedId) {
      const folder = await fs.ensureSheetsFolder();
      selectedId = folder.id;
    }
    const folders = await fs.listFolders();
    const withPath = [];
    for (let i = 0; i < folders.length; i++) {
      withPath.push({ folder: folders[i], path: await fs.pathOf(folders[i].id) });
    }
    withPath.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { sensitivity: "base" });
    });
    const overlay = document.createElement("div");
    overlay.className = "sheets-overlay";
    overlay.innerHTML =
      '<div class="sheets-modal">' +
      "<h2>" +
      escapeHtml(t("sheetsSaveAs")) +
      "</h2>" +
      '<label class="sheets-field">' +
      escapeHtml(t("sheetsFileName")) +
      '<input class="sheets-save-name" value="' +
      escapeHtml(stripExt(ensureVcsh(api.data.name))) +
      '"></label>' +
      '<div class="sheets-field">' +
      escapeHtml(t("sheetsFolder")) +
      '<div class="sheets-fx-list sheets-picker-list"></div></div>' +
      '<div class="sheets-modal-actions">' +
      '<button type="button" class="sheets-close-modal">' +
      escapeHtml(t("feCancel")) +
      "</button>" +
      '<button type="button" class="sheets-save-confirm">' +
      escapeHtml(t("sheetsSave")) +
      "</button></div></div>";
    const listEl = overlay.querySelector(".sheets-picker-list");
    withPath.forEach(function (row) {
      const depth = String(row.path || "/").split("/").filter(Boolean).length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sheets-fx-item sheets-picker-item" + (row.folder.id === selectedId ? " active" : "");
      b.dataset.id = row.folder.id;
      b.style.paddingLeft = 8 + depth * 12 + "px";
      b.innerHTML = "<strong>" + escapeHtml(row.path || "/") + "</strong>";
      b.addEventListener("click", function () {
        selectedId = row.folder.id;
        listEl.querySelectorAll(".sheets-picker-item").forEach(function (el) {
          el.classList.toggle("active", el.dataset.id === selectedId);
        });
      });
      listEl.appendChild(b);
    });
    root.querySelector(".sheets-shell").appendChild(overlay);
    const nameInput = overlay.querySelector(".sheets-save-name");
    overlay.querySelector(".sheets-close-modal").addEventListener("click", function () {
      overlay.remove();
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      const name = nameInput.value.trim() || api.data.name;
      overlay.remove();
      saveAsTo(selectedId, name)
        .then(function () {
          status = t("sheetsSaved");
          if (root) paintLive();
          updateStatus();
        })
        .catch(function () {
          status = t("sheetsExportFail");
          updateStatus();
        });
    });
    nameInput.focus();
    nameInput.select();
  }

  function showPalette(kind) {
    closeMenu();
    const host = root.querySelector(".sheets-shell");
    const anchor = root.querySelector('[data-act="' + (kind === "fill" ? "fillColor" : "fontColor") + '"]');
    if (!host || !anchor) return;
    menu = document.createElement("div");
    menu.className = "sheets-menu sheets-palette";
    const grid = document.createElement("div");
    grid.className = "sheets-palette-grid";
    PALETTE.forEach(function (color) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sheets-swatch-btn";
      b.style.background = color;
      b.title = color;
      b.addEventListener("click", function () {
        closeMenu();
        const patch = {};
        patch[kind] = color;
        api.applyStyleRange(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2, patch);
      });
      grid.appendChild(b);
    });
    menu.appendChild(grid);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "sheets-palette-clear";
    clear.textContent = kind === "fill" ? t("sheetsNoFill") : t("sheetsAutoColor");
    clear.addEventListener("click", function () {
      closeMenu();
      const patch = {};
      patch[kind] = "";
      api.applyStyleRange(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2, patch);
    });
    menu.appendChild(clear);
    host.appendChild(menu);
    const rect = host.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let x = ar.left - rect.left;
    let y = ar.bottom - rect.top + 4;
    if (x + mw > rect.width - 4) x = Math.max(4, rect.width - mw - 4);
    if (y + mh > rect.height - 4) y = Math.max(4, ar.top - rect.top - mh - 4);
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    setTimeout(function () {
      document.addEventListener("mousedown", onDoc, true);
    }, 0);
  }

  function showFx() {
    closeMenu();
    const host = hostWin();
    const lang = (host.OS && host.OS.lang) || (window.OS && window.OS.lang) || "en";
    const idx = lang === "pt" ? 4 : lang === "ja" ? 5 : 3;
    const cats = {
      math: t("sheetsCatMath"),
      stat: t("sheetsCatStat"),
      logical: t("sheetsCatLogical"),
      lookup: t("sheetsCatLookup"),
      text: t("sheetsCatText"),
      date: t("sheetsCatDate"),
      info: t("sheetsCatInfo"),
      finance: t("sheetsCatFinance"),
      eng: t("sheetsCatEng"),
    };
    const overlay = document.createElement("div");
    overlay.className = "sheets-overlay";
    overlay.innerHTML =
      '<div class="sheets-modal">' +
      "<h2>" +
      escapeHtml(t("sheetsFx")) +
      "</h2>" +
      '<input class="sheets-search" placeholder="' +
      escapeHtml(t("sheetsFxSearch")) +
      '">' +
      '<div class="sheets-fx-list"></div>' +
      '<div class="sheets-modal-actions"><button type="button" class="sheets-close-modal">' +
      escapeHtml(t("sheetsClose")) +
      "</button></div></div>";
    root.querySelector(".sheets-shell").appendChild(overlay);
    const listEl = overlay.querySelector(".sheets-fx-list");
    function draw(q) {
      q = (q || "").toLowerCase();
      listEl.innerHTML = E.FUNCTION_LIST.filter(function (fn) {
        return !q || fn[0].toLowerCase().indexOf(q) >= 0 || fn[2].toLowerCase().indexOf(q) >= 0 || String(fn[idx]).toLowerCase().indexOf(q) >= 0;
      })
        .map(function (fn) {
          return (
            '<button type="button" class="sheets-fx-item" data-fn="' +
            fn[0] +
            '"><strong>' +
            escapeHtml(fn[0]) +
            "</strong><span>" +
            escapeHtml(fn[2]) +
            '</span><em>' +
            escapeHtml(fn[idx]) +
            " · " +
            escapeHtml(cats[fn[1]] || fn[1]) +
            "</em></button>"
          );
        })
        .join("");
    }
    draw("");
    overlay.querySelector(".sheets-search").addEventListener("input", function (e) {
      draw(e.target.value);
    });
    overlay.addEventListener("click", function (e) {
      const item = e.target.closest(".sheets-fx-item");
      if (item) {
        const name = item.getAttribute("data-fn");
        const raw = api.getRaw(sheetId(), sel.r, sel.c);
        const next = raw && String(raw).charAt(0) === "=" ? raw.replace(/=?$/, "") + name + "(" : "=" + name + "(";
        overlay.remove();
        api.setCell(sheetId(), sel.r, sel.c, next);
        startEdit("bar");
        const bar = root.querySelector(".sheets-bar");
        bar.value = next;
        bar.focus();
        return;
      }
      if (e.target === overlay || e.target.classList.contains("sheets-close-modal")) overlay.remove();
    });
    overlay.querySelector(".sheets-search").focus();
  }

  function renameSheet(id) {
    const sh = api.sheetById(id);
    if (!sh) return;
    const name = window.prompt(t("sheetsRename"), sh.name);
    if (name == null) return;
    api.renameSheet(id, name);
    paint();
  }
  function showSheetMenu(id, x, y) {
    showMenu(x, y, [
      [t("sheetsRename"), function () {
        renameSheet(id);
      }],
      [t("sheetsDuplicate"), function () {
        api.duplicateSheet(id);
        paint();
      }],
      [t("sheetsDeleteSheet"), function () {
        api.deleteSheet(id);
        paint();
      }],
    ]);
  }

  function showMenuFrom(el, items, html) {
    const r = el.getBoundingClientRect();
    showMenu(r.left, r.bottom, items, html);
  }
  function showMenu(clientX, clientY, items, html) {
    closeMenu();
    const host = root.querySelector(".sheets-shell");
    if (!host) return;
    menu = document.createElement("div");
    menu.className = "sheets-menu";
    items.forEach(function (item) {
      const b = document.createElement("button");
      b.type = "button";
      if (item[2] || html) b.innerHTML = item[0];
      else b.textContent = item[0];
      b.addEventListener("click", function () {
        closeMenu();
        item[1]();
      });
      menu.appendChild(b);
    });
    host.appendChild(menu);
    const rect = host.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    if (x + mw > rect.width - 4) x = Math.max(4, rect.width - mw - 4);
    if (y + mh > rect.height - 4) y = Math.max(4, rect.height - mh - 4);
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    setTimeout(function () {
      document.addEventListener("mousedown", onDoc, true);
    }, 0);
  }
  function onDoc(e) {
    if (menu && !menu.contains(e.target)) closeMenu();
  }
  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
    document.removeEventListener("mousedown", onDoc, true);
  }

  return { mount: mount, remountOpen: remountOpen, openFile: openFsFile };
})();
