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
  const UI_KEY = "os_sheets_ui";
  const PALETTE = [
    "#ffffff", "#f4f4f4", "#d0d0d0", "#9aa0a6", "#5f6368", "#3c4043", "#1b1b1b", "#000000",
    "#fce8e6", "#fde7c2", "#fff3c4", "#d4edda", "#c8efe8", "#d2e3fc", "#e8def8", "#fad2e8",
    "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#008f7d", "#2980b9", "#8e44ad", "#e91e63",
    "#c0392b", "#d35400", "#b7950b", "#1e8449", "#006056", "#1a5276", "#6c3483", "#922b21",
  ];
  const REF_COLORS = ["#2980b9", "#e74c3c", "#27ae60", "#8e44ad", "#e67e22", "#008f7d"];
  const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36];
  const FONTS = [
    ["", "Default"],
    ["Arial, Helvetica, sans-serif", "Arial"],
    ["Verdana, sans-serif", "Verdana"],
    ["Georgia, serif", "Georgia"],
    ["'Times New Roman', Times, serif", "Times New Roman"],
    ["'Courier New', monospace", "Courier New"],
    ["'Noto Sans JP', sans-serif", "Noto Sans JP"],
  ];
  const CURRENCIES = [["$", "USD $"], ["R$", "BRL R$"], ["€", "EUR €"], ["¥", "JPY ¥"], ["£", "GBP £"]];
  const FORMATS = ["general", "number", "integer", "currency", "accounting", "percent", "fraction", "scientific", "date", "dateIso", "dateLong", "datetime", "time", "text", "custom"];

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
  let painter = null;
  let ac = null;
  let xs = [0];
  let ys = [0];
  let condCache = new Map();
  let dialogs = null;
  let findState = null;
  const ui = loadUi();
  const VCSH_MIME = "application/vnd.vc.sheets+json";
  const VCSH_EXT = ".vcsh";

  function loadUi() {
    const def = { tab: "home", zoom: 1, showFormulas: false };
    try {
      const raw = localStorage.getItem(UI_KEY);
      return raw ? Object.assign(def, JSON.parse(raw)) : def;
    } catch (_err) {
      return def;
    }
  }
  function saveUi() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ tab: ui.tab, zoom: ui.zoom, showFormulas: ui.showFormulas }));
    } catch (_err) {}
  }
  function lang() {
    const host = hostWin();
    return (host.OS && host.OS.lang) || (window.OS && window.OS.lang) || "en";
  }
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
  function setStatus(msg) {
    status = msg || "";
    updateStatus();
    if (msg) {
      clearTimeout(setStatus.timer);
      setStatus.timer = setTimeout(function () {
        status = "";
        updateStatus();
      }, 4000);
    }
  }
  function applySel(patch) {
    api.applyStyleRange(sheetId(), sel.r1, sel.c1, sel.r2, sel.c2, patch);
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
  function setEditorText(next, caret) {
    if (!editing) return;
    editing.value = next;
    editing.caretStart = caret;
    editing.caretEnd = caret;
    const bar = root.querySelector(".sheets-bar");
    const cell = root.querySelector(".sheets-edit");
    if (bar) bar.value = next;
    if (cell) cell.value = next;
    focusEditor();
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
    editing.pointing = true;
    editing.pointSpan = { start: start, end: start + ref.length };
    setEditorText(next, start + ref.length);
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
  function btn(name, key, extra, icon) {
    return (
      '<button type="button" class="sheets-btn" data-act="' +
      name +
      '" data-i18n-title="' +
      key +
      '" title="' +
      escapeHtml(t(key)) +
      '">' +
      I.get(icon || name) +
      (extra || "") +
      "</button>"
    );
  }
  function tbtn(name, key, label) {
    return (
      '<button type="button" class="sheets-btn sheets-btn-text" data-act="' +
      name +
      '" title="' +
      escapeHtml(t(key)) +
      '">' +
      (I.get(name) || "") +
      "<span>" +
      escapeHtml(label || t(key)) +
      "</span></button>"
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
  function resetView() {
    visRows = Math.max(MIN_ROWS, api.usedRange(api.data.activeSheetId).r + GROW);
    visCols = Math.max(MIN_COLS, api.usedRange(api.data.activeSheetId).c + 8);
    setSel(0, 0);
  }
  async function newBook() {
    commitEdit();
    api = E.createWorkbook(t("sheetsBook") + " " + (1 + Math.floor(Math.random() * 90)));
    resetView();
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
    resetView();
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
    E.LOCALE.lang = lang();
    const sh = active();
    const used = api.usedRange(sh.id);
    visRows = Math.max(visRows, used.r + GROW, MIN_ROWS);
    visCols = Math.max(visCols, used.c + 8, MIN_COLS);
    root.innerHTML =
      '<div class="sheets-shell">' +
      ribbonHtml() +
      formulaHtml() +
      '<div class="sheets-grid-wrap" style="zoom:' +
      ui.zoom +
      '">' +
      '<div class="sheets-corner" data-act="selectAll"></div>' +
      '<div class="sheets-colhead"></div>' +
      '<div class="sheets-rowhead"></div>' +
      '<div class="sheets-body" tabindex="0">' +
      '<div class="sheets-sizer"></div>' +
      '<div class="sheets-layer"></div>' +
      '<div class="sheets-layer sheets-freeze sheets-freeze-cols"></div>' +
      '<div class="sheets-layer sheets-freeze sheets-freeze-rows"></div>' +
      '<div class="sheets-layer sheets-freeze sheets-freeze-corner"></div>' +
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
  function repaintRibbon() {
    const rib = root.querySelector(".sheets-ribbon");
    if (rib) rib.outerHTML = ribbonHtml();
    syncFormula();
  }

  function sel2(name, key, options, cls) {
    return (
      '<select class="sheets-select ' +
      (cls || "") +
      '" data-sel="' +
      name +
      '" title="' +
      escapeHtml(t(key)) +
      '">' +
      options
        .map(function (o) {
          return '<option value="' + escapeHtml(o[0]) + '">' + escapeHtml(o[1]) + "</option>";
        })
        .join("") +
      "</select>"
    );
  }
  function group(inner) {
    return '<div class="sheets-group">' + inner + "</div>";
  }
  function ribbonTabs() {
    const tabs = [
      ["file", "sheetsTabFile"],
      ["home", "sheetsTabHome"],
      ["insert", "sheetsTabInsert"],
      ["formulas", "sheetsTabFormulas"],
      ["data", "sheetsTabData"],
      ["view", "sheetsTabView"],
    ];
    return tabs
      .map(function (tb) {
        const on = tb[0] === ui.tab ? " active" : "";
        const cls = tb[0] === "file" ? " sheets-rtab-file" : "";
        return '<button type="button" class="sheets-rtab' + on + cls + '" data-tab="' + tb[0] + '">' + escapeHtml(t(tb[1])) + "</button>";
      })
      .join("");
  }
  function ribbonHtml() {
    let tools = "";
    if (ui.tab === "home") {
      tools =
        group(btn("undo", "sheetsUndo") + btn("redo", "sheetsRedo")) +
        group(btn("cut", "sheetsCut") + btn("copy", "sheetsCopy") + btn("paste", "sheetsPaste") + btn("pasteMenu", "sheetsPasteSpecial", "", "caret") + btn("paintFormat", "sheetsPaintFormat")) +
        group(
          sel2("font", "sheetsFont", FONTS, "sheets-font") +
            sel2(
              "size",
              "sheetsFontSize",
              FONT_SIZES.map(function (s) {
                return [String(s), String(s)];
              }),
              "sheets-size"
            ) +
            btn("bold", "sheetsBold") +
            btn("italic", "sheetsItalic") +
            btn("underline", "sheetsUnderline") +
            btn("strike", "sheetsStrike") +
            btn("borders", "sheetsBorders") +
            btn("fillColor", "sheetsFill") +
            btn("fontColor", "sheetsFontColor")
        ) +
        group(
          btn("alignLeft", "sheetsAlignLeft") +
            btn("alignCenter", "sheetsAlignCenter") +
            btn("alignRight", "sheetsAlignRight") +
            btn("valignTop", "sheetsValignTop") +
            btn("valignMiddle", "sheetsValignMiddle") +
            btn("valignBottom", "sheetsValignBottom") +
            btn("wrap", "sheetsWrap") +
            btn("merge", "sheetsMerge")
        ) +
        group(
          sel2(
            "format",
            "sheetsFormat",
            FORMATS.map(function (f) {
              return [f, t("sheetsFmt_" + f)];
            }),
            "sheets-format"
          ) +
            btn("currency", "sheetsCurrency") +
            btn("percent", "sheetsPercent") +
            btn("comma", "sheetsComma") +
            btn("decMore", "sheetsDecMore") +
            btn("decLess", "sheetsDecLess")
        ) +
        group(btn("condFormat", "sheetsCondFormat") + btn("insertMenu", "sheetsInsertCells", "", "insertRow") + btn("deleteMenu", "sheetsDeleteCells", "", "deleteRow") + btn("clearMenu", "sheetsClear", "", "clear")) +
        group(btn("sortAsc", "sheetsSortAsc") + btn("sortDesc", "sheetsSortDesc") + btn("filterToggle", "sheetsFilter") + btn("find", "sheetsFind"));
    } else if (ui.tab === "insert") {
      tools =
        group(tbtn("insertChart", "sheetsChart") + tbtn("insertNote", "sheetsNote") + tbtn("fx", "sheetsFx")) +
        group(tbtn("insertRow", "sheetsInsertRowAbove") + tbtn("insertRowBelow", "sheetsInsertRowBelow") + tbtn("insertCol", "sheetsInsertColLeft") + tbtn("insertColRight", "sheetsInsertColRight")) +
        group(tbtn("addSheet", "sheetsAddSheet") + tbtn("insertDate", "sheetsInsertDate") + tbtn("insertTime", "sheetsInsertTime") + tbtn("insertCheck", "sheetsInsertCheck"));
    } else if (ui.tab === "formulas") {
      tools =
        group(tbtn("fx", "sheetsFx") + tbtn("autosum", "sheetsAutoSum") + btn("autosumMenu", "sheetsAutoSumMore", "", "caret")) +
        group(tbtn("fxCat_math", "sheetsCatMath") + tbtn("fxCat_stat", "sheetsCatStat") + tbtn("fxCat_logical", "sheetsCatLogical") + tbtn("fxCat_lookup", "sheetsCatLookup") + tbtn("fxCat_text", "sheetsCatText") + tbtn("fxCat_date", "sheetsCatDate") + tbtn("fxCat_finance", "sheetsCatFinance")) +
        group(tbtn("names", "sheetsNames") + tbtn("defineName", "sheetsDefineName")) +
        group(tbtn("showFormulas", "sheetsShowFormulas") + tbtn("recalc", "sheetsRecalc") + tbtn("traceErrors", "sheetsTraceErrors"));
    } else if (ui.tab === "data") {
      tools =
        group(tbtn("sortAsc", "sheetsSortAsc") + tbtn("sortDesc", "sheetsSortDesc") + tbtn("sortDialog", "sheetsSortCustom")) +
        group(tbtn("filterToggle", "sheetsFilter") + tbtn("filterClear", "sheetsFilterClear")) +
        group(tbtn("removeDup", "sheetsRemoveDup") + tbtn("textToCols", "sheetsTextToCols") + tbtn("trimSpaces", "sheetsTrimSpaces")) +
        group(tbtn("fillDown", "sheetsFillDown") + tbtn("fillRight", "sheetsFillRight") + tbtn("fillSeries", "sheetsFillSeries")) +
        group(tbtn("fileImport", "sheetsImport") + tbtn("fileExport", "sheetsExport"));
    } else if (ui.tab === "view") {
      tools =
        group(tbtn("freezeTop", "sheetsFreezeTop") + tbtn("freezeFirstCol", "sheetsFreezeFirstCol") + tbtn("freezePanes", "sheetsFreezePanes") + tbtn("unfreeze", "sheetsUnfreeze")) +
        group(tbtn("gridlines", "sheetsGridlines") + tbtn("showFormulas", "sheetsShowFormulas")) +
        group(tbtn("zoomOut", "sheetsZoomOut") + tbtn("zoomReset", "sheetsZoomReset") + tbtn("zoomIn", "sheetsZoomIn")) +
        group(tbtn("hideRows", "sheetsHideRows") + tbtn("unhideRows", "sheetsUnhideRows") + tbtn("hideCols", "sheetsHideCols") + tbtn("unhideCols", "sheetsUnhideCols"));
    } else {
      tools =
        group(tbtn("fileNew", "sheetsNew") + tbtn("fileOpen", "sheetsOpen") + tbtn("fileSave", "sheetsSave") + tbtn("fileSaveAs", "sheetsSaveAs")) +
        group(tbtn("fileImport", "sheetsImport") + tbtn("fileExportCsv", "sheetsExportCsv") + tbtn("fileExportXlsx", "sheetsExportXlsx") + tbtn("fileExportVcsh", "sheetsExportVcsh")) +
        group(tbtn("print", "sheetsPrint") + tbtn("help", "sheetsHelp"));
    }
    return (
      '<div class="sheets-ribbon">' +
      '<div class="sheets-rtabs">' +
      '<img class="sheets-app-icon" src="../../../assets/icons/svg/os-sheets.svg" alt="">' +
      ribbonTabs() +
      '<span class="sheets-rtabs-spacer"></span>' +
      '<label class="sheets-book-label">' +
      escapeHtml(t("sheetsWorkbook")) +
      ' <input class="sheets-book-name" value="' +
      escapeHtml(api.data.name) +
      '" maxlength="80">' +
      "</label>" +
      '<button type="button" class="sheets-btn sheets-help-btn" data-act="help" title="' +
      escapeHtml(t("sheetsHelp")) +
      '">?</button>' +
      "</div>" +
      '<div class="sheets-ribbon-row">' +
      tools +
      "</div></div>"
    );
  }
  function formulaHtml() {
    return (
      '<div class="sheets-formula">' +
      '<input class="sheets-namebox" spellcheck="false" value="' +
      E.a1(sel.r, sel.c) +
      '" title="' +
      escapeHtml(t("sheetsNameBox")) +
      '">' +
      '<button type="button" class="sheets-fx-mini" data-act="cancelEdit" title="' +
      escapeHtml(t("sheetsCancel")) +
      '">✕</button>' +
      '<button type="button" class="sheets-fx-mini" data-act="confirmEdit" title="' +
      escapeHtml(t("sheetsConfirm")) +
      '">✓</button>' +
      '<button type="button" class="sheets-fx-mini sheets-fx-label" data-act="fx" title="' +
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
        const color = sh.tabColor ? ' style="border-bottom:3px solid ' + escapeHtml(sh.tabColor) + '"' : "";
        return '<button type="button" class="sheets-tab' + on + '" data-sheet="' + sh.id + '"' + color + ">" + escapeHtml(sh.name) + "</button>";
      })
      .join("");
    return (
      '<div class="sheets-tabs">' +
      '<button type="button" class="sheets-tab-nav" data-act="sheetPrev" title="' +
      escapeHtml(t("sheetsPrevSheet")) +
      '">‹</button>' +
      '<button type="button" class="sheets-tab-nav" data-act="sheetNext" title="' +
      escapeHtml(t("sheetsNextSheet")) +
      '">›</button>' +
      '<div class="sheets-tab-list">' +
      items +
      "</div>" +
      '<button type="button" class="sheets-tab-add" data-act="addSheet" title="' +
      escapeHtml(t("sheetsAddSheet")) +
      '">' +
      I.get("addSheet") +
      "</button>" +
      "</div>"
    );
  }
  function statusHtml() {
    return (
      '<div class="sheets-status">' +
      '<span class="sheets-status-mode"></span>' +
      '<span class="sheets-status-text"></span>' +
      '<span class="sheets-status-stats"></span>' +
      '<span class="sheets-zoom">' +
      '<button type="button" data-act="zoomOut" title="' +
      escapeHtml(t("sheetsZoomOut")) +
      '">−</button>' +
      '<button type="button" class="sheets-zoom-val" data-act="zoomReset" title="' +
      escapeHtml(t("sheetsZoomReset")) +
      '">' +
      Math.round(ui.zoom * 100) +
      "%</button>" +
      '<button type="button" data-act="zoomIn" title="' +
      escapeHtml(t("sheetsZoomIn")) +
      '">+</button>' +
      "</span></div>"
    );
  }

  function colW(c) {
    const sh = active();
    if (sh.hiddenCols && sh.hiddenCols[c]) return 0;
    return sh.colWidths[c] || DEF_W;
  }
  function rowH(r) {
    const sh = active();
    if (sh.hiddenRows && sh.hiddenRows[r]) return 0;
    return sh.rowHeights[r] || DEF_H;
  }
  function rebuildGeom() {
    xs = new Array(visCols + 1);
    xs[0] = 0;
    for (let i = 0; i < visCols; i++) xs[i + 1] = xs[i] + colW(i);
    ys = new Array(visRows + 1);
    ys[0] = 0;
    for (let i = 0; i < visRows; i++) ys[i + 1] = ys[i] + rowH(i);
  }
  function colX(c) {
    if (c < xs.length) return xs[c];
    return xs[xs.length - 1] + (c - xs.length + 1) * DEF_W;
  }
  function rowY(r) {
    if (r < ys.length) return ys[r];
    return ys[ys.length - 1] + (r - ys.length + 1) * DEF_H;
  }
  function totalW() {
    return colX(visCols);
  }
  function totalH() {
    return rowY(visRows);
  }
  function indexAt(arr, pos) {
    let lo = 0;
    let hi = arr.length - 2;
    if (hi < 0) return 0;
    if (pos >= arr[hi + 1]) return hi;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (arr[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  function rowAt(y) {
    return Math.max(0, Math.min(visRows - 1, indexAt(ys, Math.max(0, y))));
  }
  function colAt(x) {
    return Math.max(0, Math.min(visCols - 1, indexAt(xs, Math.max(0, x))));
  }
  function frozen() {
    const sh = active();
    return { r: Math.max(0, Math.min(sh.frozenRows || 0, visRows - 1)), c: Math.max(0, Math.min(sh.frozenCols || 0, visCols - 1)) };
  }
  function nextVisibleRow(r, dir) {
    let n = r + dir;
    while (n >= 0 && n < E.MAX_ROWS && rowH(n) === 0) n += dir;
    return n < 0 ? r : Math.min(E.MAX_ROWS - 1, n);
  }
  function nextVisibleCol(c, dir) {
    let n = c + dir;
    while (n >= 0 && n < E.MAX_COLS && colW(n) === 0) n += dir;
    return n < 0 ? c : Math.min(E.MAX_COLS - 1, n);
  }

  function cellValueText(sid, r, c) {
    if (ui.showFormulas) {
      const raw = api.getRaw(sid, r, c);
      return String(raw);
    }
    return api.display(sid, r, c);
  }
  function hexToRgb(h) {
    const m = String(h || "").match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return [128, 128, 128];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function mixColor(a, b, k) {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    const r = x.map(function (v, i) {
      return Math.round(v + (y[i] - v) * k);
    });
    return "rgb(" + r.join(",") + ")";
  }
  function ruleStats(sid, rule, idx) {
    if (condCache.has(idx)) return condCache.get(idx);
    const st = { min: Infinity, max: -Infinity, counts: new Map(), nums: [] };
    const limit = 50000;
    let n = 0;
    outer: for (let r = rule.r1; r <= rule.r2; r++) {
      for (let c = rule.c1; c <= rule.c2; c++) {
        if (++n > limit) break outer;
        const v = api.getValue(sid, r, c);
        if (typeof v === "number") {
          st.min = Math.min(st.min, v);
          st.max = Math.max(st.max, v);
          st.nums.push(v);
        }
        if (v != null && v !== "") {
          const k = typeof v + ":" + String(E.isErr(v) ? v.error : v).toLowerCase();
          st.counts.set(k, (st.counts.get(k) || 0) + 1);
        }
      }
    }
    if (rule.type === "top" || rule.type === "bottom") {
      const sorted = st.nums.slice().sort(function (a, b) {
        return rule.type === "top" ? b - a : a - b;
      });
      const k = Math.max(1, Math.floor(Number(rule.v1) || 10));
      st.threshold = sorted.length ? sorted[Math.min(k, sorted.length) - 1] : null;
    }
    condCache.set(idx, st);
    return st;
  }
  function condStyle(sid, r, c, val) {
    const rules = active().condFormats || [];
    let out = null;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (r < rule.r1 || r > rule.r2 || c < rule.c1 || c > rule.c2) continue;
      let hit = false;
      const num = typeof val === "number" ? val : null;
      const v1 = Number(rule.v1);
      const v2 = Number(rule.v2);
      const type = rule.type;
      if (type === "gt") hit = num != null && num > v1;
      else if (type === "lt") hit = num != null && num < v1;
      else if (type === "gte") hit = num != null && num >= v1;
      else if (type === "lte") hit = num != null && num <= v1;
      else if (type === "between") hit = num != null && num >= Math.min(v1, v2) && num <= Math.max(v1, v2);
      else if (type === "eq") hit = val != null && val !== "" && (num != null ? num === v1 : String(val).toLowerCase() === String(rule.v1).toLowerCase());
      else if (type === "neq") hit = val != null && val !== "" && (num != null ? num !== v1 : String(val).toLowerCase() !== String(rule.v1).toLowerCase());
      else if (type === "contains") hit = val != null && String(val).toLowerCase().indexOf(String(rule.v1).toLowerCase()) >= 0;
      else if (type === "starts") hit = val != null && String(val).toLowerCase().indexOf(String(rule.v1).toLowerCase()) === 0;
      else if (type === "blank") hit = val == null || val === "";
      else if (type === "notblank") hit = !(val == null || val === "");
      else if (type === "error") hit = E.isErr(val);
      else if (type === "dup") {
        if (val != null && val !== "") {
          const st = ruleStats(sid, rule, i);
          hit = (st.counts.get(typeof val + ":" + String(E.isErr(val) ? val.error : val).toLowerCase()) || 0) > 1;
        }
      } else if (type === "unique") {
        if (val != null && val !== "") {
          const st = ruleStats(sid, rule, i);
          hit = (st.counts.get(typeof val + ":" + String(val).toLowerCase()) || 0) === 1;
        }
      } else if (type === "top" || type === "bottom") {
        const st = ruleStats(sid, rule, i);
        hit = num != null && st.threshold != null && (type === "top" ? num >= st.threshold : num <= st.threshold);
      } else if (type === "aboveAvg" || type === "belowAvg") {
        const st = ruleStats(sid, rule, i);
        if (num != null && st.nums.length) {
          const avg = st.nums.reduce(function (a, b) {
            return a + b;
          }, 0) / st.nums.length;
          hit = type === "aboveAvg" ? num > avg : num < avg;
        }
      } else if (type === "scale") {
        if (num != null) {
          const st = ruleStats(sid, rule, i);
          const k = st.max === st.min ? 0.5 : (num - st.min) / (st.max - st.min);
          out = out || {};
          if (rule.v3) {
            out.fill = k < 0.5 ? mixColor(rule.v1 || "#f8696b", rule.v3 || "#ffeb84", k * 2) : mixColor(rule.v3 || "#ffeb84", rule.v2 || "#63be7b", (k - 0.5) * 2);
          } else out.fill = mixColor(rule.v1 || "#f8696b", rule.v2 || "#63be7b", k);
          out.color = "#1b1b1b";
        }
        continue;
      } else if (type === "bar") {
        if (num != null) {
          const st = ruleStats(sid, rule, i);
          const lo = Math.min(0, st.min);
          const hi = Math.max(0, st.max);
          const span = hi - lo || 1;
          out = out || {};
          out.bar = { pct: Math.max(2, Math.round((Math.abs(num - 0) / span) * 100)), color: rule.fill || "#638ec6" };
        }
        continue;
      }
      if (hit) {
        out = out || {};
        if (rule.fill) out.fill = rule.fill;
        if (rule.color) out.color = rule.color;
        if (rule.bold) out.bold = true;
      }
    }
    return out;
  }
  function refBoxes() {
    if (!editing || !isFormulaEdit()) return [];
    const text = String(editing.value || "");
    const out = [];
    const re = /(?:'((?:[^']|'')+)'!|([A-Za-z_][A-Za-z0-9_]*)!)?(\$?[A-Za-z]{1,3}\$?[1-9][0-9]{0,6})(?::(\$?[A-Za-z]{1,3}\$?[1-9][0-9]{0,6}))?(?![A-Za-z0-9_(])/g;
    let m;
    let i = 0;
    let q = false;
    while ((m = re.exec(text))) {
      const before = text.slice(0, m.index);
      q = inQuoted(before);
      if (q) continue;
      const sheetName = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
      const target = sheetName ? api.sheetByName(sheetName) : api.sheetById(editing.sheetId);
      const color = REF_COLORS[i++ % REF_COLORS.length];
      if (!target || target.id !== sheetId()) continue;
      const a = E.parseA1(m[3]);
      const b = m[4] ? E.parseA1(m[4]) : a;
      if (!a || !b) continue;
      out.push({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c), color: color });
    }
    return out;
  }

  function renderGrid() {
    if (!root || !api) return;
    const body = root.querySelector(".sheets-body");
    const layer = root.querySelector(".sheets-layer:not(.sheets-freeze)");
    const sizer = root.querySelector(".sheets-sizer");
    const colhead = root.querySelector(".sheets-colhead");
    const rowhead = root.querySelector(".sheets-rowhead");
    if (!body || !layer) return;
    condCache = new Map();
    const sl = body.scrollLeft;
    const st = body.scrollTop;
    const vw = body.clientWidth;
    const vh = body.clientHeight;
    const sh = active();
    const sid = sh.id;
    while (visRows < E.MAX_ROWS && rowY(visRows) < st + vh + DEF_H * GROW) visRows = Math.min(E.MAX_ROWS, visRows + GROW);
    while (visCols < E.MAX_COLS && colX(visCols) < sl + vw + DEF_W * 8) visCols = Math.min(E.MAX_COLS, visCols + 8);
    rebuildGeom();
    sizer.style.width = totalW() + "px";
    sizer.style.height = totalH() + "px";
    const fz = frozen();
    const fh = rowY(fz.r);
    const fw = colX(fz.c);
    const startR = Math.max(0, rowAt(st) - 1);
    const endR = Math.min(visRows - 1, rowAt(st + vh) + 1);
    const startC = Math.max(0, colAt(sl) - 1);
    const endC = Math.min(visCols - 1, colAt(sl + vw) + 1);
    const gridOff = sh.gridlines === false ? " nogrid" : "";
    body.className = "sheets-body" + gridOff;

    function hcol(c, fixed) {
      const on = c >= sel.c1 && c <= sel.c2 ? " on" : "";
      const full = sel.r1 === 0 && sel.r2 >= visRows - 1 ? " full" : "";
      const hidden = c > 0 && colW(c - 1) === 0 ? '<span class="sheets-hidden-mark left"></span>' : "";
      return (
        '<div class="sheets-hcell' +
        on +
        full +
        (fixed ? " fixed" : "") +
        '" data-col="' +
        c +
        '" style="left:' +
        (fixed ? colX(c) : colX(c) - sl) +
        "px;top:0;width:" +
        colW(c) +
        "px;height:" +
        COL_HDR +
        'px">' +
        hidden +
        E.colName(c) +
        '<span class="sheets-col-resizer" data-col="' +
        c +
        '"></span></div>'
      );
    }
    function hrow(r, fixed) {
      const on = r >= sel.r1 && r <= sel.r2 ? " on" : "";
      const full = sel.c1 === 0 && sel.c2 >= visCols - 1 ? " full" : "";
      return (
        '<div class="sheets-hcell' +
        on +
        full +
        (fixed ? " fixed" : "") +
        '" data-row="' +
        r +
        '" style="left:0;top:' +
        (fixed ? rowY(r) : rowY(r) - st) +
        "px;width:" +
        ROW_HDR +
        "px;height:" +
        rowH(r) +
        'px">' +
        (r + 1) +
        '<span class="sheets-row-resizer" data-row="' +
        r +
        '"></span></div>'
      );
    }
    let cols = "";
    for (let c = startC; c <= endC; c++) if (colW(c)) cols += hcol(c, false);
    for (let c = 0; c < fz.c; c++) if (colW(c)) cols += hcol(c, true);
    colhead.innerHTML = cols;
    let rows = "";
    for (let r = startR; r <= endR; r++) if (rowH(r)) rows += hrow(r, false);
    for (let r = 0; r < fz.r; r++) if (rowH(r)) rows += hrow(r, true);
    rowhead.innerHTML = rows;

    const filter = sh.filter;
    const mergeList = sh.merges || [];
    function cellHtml(r, c) {
      const merged = api.mergeAt(sid, r, c);
      if (merged && (merged.r1 !== r || merged.c1 !== c)) return "";
      if (!merged && (rowH(r) === 0 || colW(c) === 0)) return "";
      const stl = api.getStyle(sid, r, c) || {};
      const value = api.getValue(sid, r, c);
      const val = cellValueText(sid, r, c);
      const raw = api.getRaw(sid, r, c);
      const cls = ["sheets-cell"];
      let left = colX(c);
      let top = rowY(r);
      let width = colW(c);
      let height = rowH(r);
      if (merged) {
        cls.push("merged");
        left = colX(merged.c1);
        top = rowY(merged.r1);
        width = colX(merged.c2) + colW(merged.c2) - left;
        height = rowY(merged.r2) + rowH(merged.r2) - top;
      }
      if (r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2) cls.push("sel");
      if (r === sel.r && c === sel.c) cls.push("active");
      if (editing && editing.sheetId === sid && r === editing.r && c === editing.c) cls.push("edit");
      if (E.isErr(value)) cls.push("err");
      const cond = condStyle(sid, r, c, value);
      const css = [];
      if (stl.bold || (cond && cond.bold)) css.push("font-weight:700");
      if (stl.italic) css.push("font-style:italic");
      const deco = [];
      if (stl.underline) deco.push("underline");
      if (stl.strike) deco.push("line-through");
      if (deco.length) css.push("text-decoration:" + deco.join(" "));
      let align = stl.align;
      if (!align && !ui.showFormulas) {
        if (typeof value === "number" || E.isErr(value)) align = "right";
        else if (typeof value === "boolean") align = "center";
      }
      if (align) css.push("text-align:" + align);
      const fill = (cond && cond.fill) || stl.fill;
      if (fill) css.push("background:" + fill);
      const color = (cond && cond.color) || stl.color;
      if (color) css.push("color:" + color);
      if (stl.wrap) css.push("white-space:pre-wrap;word-break:break-word");
      if (stl.font) css.push("font-family:" + stl.font);
      if (stl.size) css.push("font-size:" + stl.size + "px");
      if (stl.valign === "top") css.push("justify-content:flex-start");
      else if (stl.valign === "middle") css.push("justify-content:center");
      if (stl.border) {
        const b = stl.border;
        const bc = b.color || "currentColor";
        if (b.t) css.push("border-top:1px solid " + bc);
        if (b.b) css.push("border-bottom:1px solid " + bc);
        if (b.l) css.push("border-left:1px solid " + bc);
        if (b.r) css.push("border-right:1px solid " + bc);
        if (b.t || b.b || b.l || b.r) cls.push("bordered");
      }
      if (stl.indent) css.push("padding-left:" + (5 + stl.indent * 10) + "px");
      let extra = "";
      if (cond && cond.bar) extra += '<i class="sheets-databar" style="width:' + cond.bar.pct + "%;background:" + cond.bar.color + '"></i>';
      if (stl.note) extra += '<i class="sheets-note-mark"></i>';
      if (filter && r === filter.r1 && c >= filter.c1 && c <= filter.c2) {
        const on = filter.cols && filter.cols[c] ? " on" : "";
        extra += '<i class="sheets-filter-btn' + on + '" data-fc="' + c + '">' + I.get("caret") + "</i>";
      }
      let title = "";
      if (stl.note) title = stl.note;
      else if (String(raw).charAt(0) === "=") title = raw;
      return (
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
        '"' +
        (title ? ' title="' + escapeHtml(title) + '"' : "") +
        ">" +
        extra +
        "<span>" +
        escapeHtml(val) +
        "</span></div>"
      );
    }
    function cellsFor(r1, c1, r2, c2) {
      let out = "";
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out += cellHtml(r, c);
      mergeList.forEach(function (m) {
        if (m.r2 < r1 || m.r1 > r2 || m.c2 < c1 || m.c1 > c2) return;
        if (m.r1 >= r1 && m.r1 <= r2 && m.c1 >= c1 && m.c1 <= c2) return;
        out += cellHtml(m.r1, m.c1);
      });
      return out;
    }
    function overlayHtml() {
      let out = "";
      refBoxes().forEach(function (b) {
        const x1 = colX(b.c1);
        const y1 = rowY(b.r1);
        const x2 = colX(b.c2) + colW(b.c2);
        const y2 = rowY(b.r2) + rowH(b.r2);
        out += '<div class="sheets-refbox" style="left:' + x1 + "px;top:" + y1 + "px;width:" + (x2 - x1) + "px;height:" + (y2 - y1) + "px;border-color:" + b.color + ";background:" + b.color + '14"></div>';
      });
      const x1 = colX(sel.c1);
      const y1 = rowY(sel.r1);
      const x2 = colX(sel.c2) + colW(sel.c2);
      const y2 = rowY(sel.r2) + rowH(sel.r2);
      const multi = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;
      out +=
        '<div class="sheets-sel' +
        (editing && editing.pointing ? " pointing" : "") +
        (multi ? " multi" : "") +
        '" style="left:' +
        x1 +
        "px;top:" +
        y1 +
        "px;width:" +
        (x2 - x1) +
        "px;height:" +
        (y2 - y1) +
        'px"></div>';
      if (!isFormulaEdit() && !painter) {
        out += '<div class="sheets-fill" data-fill="1" style="left:' + (x2 - 5) + "px;top:" + (y2 - 5) + 'px"></div>';
      }
      if (clipboard && clipboard.sheetId === sid && clipboard.marquee) {
        const m = clipboard.marquee;
        const mx1 = colX(m.c1);
        const my1 = rowY(m.r1);
        const mx2 = colX(m.c2) + colW(m.c2);
        const my2 = rowY(m.r2) + rowH(m.r2);
        out += '<div class="sheets-marquee" style="left:' + mx1 + "px;top:" + my1 + "px;width:" + (mx2 - mx1) + "px;height:" + (my2 - my1) + 'px"></div>';
      }
      return out;
    }
    if (editing) {
      captureCaret();
      editing.ignoreBlur = true;
    }
    const ov = overlayHtml();
    layer.innerHTML = cellsFor(startR, startC, endR, endC) + chartsHtml(sh) + ov;
    const fRows = root.querySelector(".sheets-freeze-rows");
    const fCols = root.querySelector(".sheets-freeze-cols");
    const fCorner = root.querySelector(".sheets-freeze-corner");
    if (fz.r > 0) {
      fRows.style.display = "";
      fRows.style.top = st + "px";
      fRows.style.left = "0";
      fRows.style.width = Math.max(totalW(), sl + vw) + "px";
      fRows.style.height = fh + "px";
      fRows.innerHTML = cellsFor(0, startC, fz.r - 1, endC) + ov;
    } else fRows.style.display = "none";
    if (fz.c > 0) {
      fCols.style.display = "";
      fCols.style.left = sl + "px";
      fCols.style.top = "0";
      fCols.style.width = fw + "px";
      fCols.style.height = Math.max(totalH(), st + vh) + "px";
      fCols.innerHTML = cellsFor(startR, 0, endR, fz.c - 1) + ov;
    } else fCols.style.display = "none";
    if (fz.r > 0 && fz.c > 0) {
      fCorner.style.display = "";
      fCorner.style.left = sl + "px";
      fCorner.style.top = st + "px";
      fCorner.style.width = fw + "px";
      fCorner.style.height = fh + "px";
      fCorner.innerHTML = cellsFor(0, 0, fz.r - 1, fz.c - 1) + ov;
    } else fCorner.style.display = "none";
    updateStatus();
    if (editing && sheetId() === editing.sheetId && editing.source === "cell") placeEditor();
    else if (editing) {
      editing.ignoreBlur = false;
      focusEditor();
    }
  }
  function chartsHtml(sh) {
    const list = sh.charts || [];
    if (!list.length || !dialogs) return "";
    return list
      .map(function (ch) {
        return (
          '<div class="sheets-chart" data-chart="' +
          ch.id +
          '" style="left:' +
          ch.x +
          "px;top:" +
          Math.max(ch.y, rowY(frozen().r)) +
          "px;width:" +
          ch.w +
          "px;height:" +
          ch.h +
          'px">' +
          '<div class="sheets-chart-head"><span>' +
          escapeHtml(ch.title || ch.range) +
          '</span><button type="button" data-chart-edit="' +
          ch.id +
          '" title="' +
          escapeHtml(t("sheetsChartEdit")) +
          '">✎</button><button type="button" data-chart-del="' +
          ch.id +
          '" title="' +
          escapeHtml(t("sheetsDeleteChart")) +
          '">✕</button></div>' +
          '<div class="sheets-chart-body">' +
          dialogs.chartSvg(ch, ch.w - 4, ch.h - 30) +
          "</div>" +
          '<span class="sheets-chart-resize" data-chart-resize="' +
          ch.id +
          '"></span></div>'
        );
      })
      .join("");
  }

  function updateStatus() {
    const el = root && root.querySelector(".sheets-status-text");
    if (!el) return;
    const sid = sheetId();
    let sum = 0;
    let count = 0;
    let n = 0;
    let min = Infinity;
    let max = -Infinity;
    let nonEmpty = 0;
    const limit = 200000;
    outer: for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        if (++n > limit) break outer;
        const merged = api.mergeAt(sid, r, c);
        if (merged && (merged.r1 !== r || merged.c1 !== c)) continue;
        const v = api.getValue(sid, r, c);
        if (v != null && v !== "") nonEmpty++;
        if (typeof v === "number") {
          sum += v;
          count++;
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    const mode = root.querySelector(".sheets-status-mode");
    if (mode) mode.textContent = (editing ? t("sheetsModeEdit") : painter ? t("sheetsModePaint") : t("sheetsModeReady")) + "  " + a1Sel();
    el.textContent = status;
    const stats = root.querySelector(".sheets-status-stats");
    if (stats) {
      const parts = [];
      const fmt = function (x) {
        return E.formatValue(Math.round(x * 1e8) / 1e8, {});
      };
      if (count) {
        parts.push(t("sheetsStatSum") + ": " + fmt(sum));
        parts.push(t("sheetsStatAvg") + ": " + fmt(sum / count));
        parts.push(t("sheetsStatMin") + ": " + fmt(min));
        parts.push(t("sheetsStatMax") + ": " + fmt(max));
      }
      if (nonEmpty > 1 || count) parts.push(t("sheetsStatCount") + ": " + nonEmpty);
      stats.textContent = parts.join("   ");
    }
    const zv = root.querySelector(".sheets-zoom-val");
    if (zv) zv.textContent = Math.round(ui.zoom * 100) + "%";
  }

  function syncFormula() {
    if (!root) return;
    const box = root.querySelector(".sheets-namebox");
    const bar = root.querySelector(".sheets-bar");
    if (box && document.activeElement !== box) {
      const nm = nameForSel();
      box.value = nm || a1Sel();
    }
    if (bar && document.activeElement !== bar && !editing) bar.value = api.getRaw(sheetId(), sel.r, sel.c);
    const stl = styleOf(sel.r, sel.c);
    const fmt = root.querySelector('[data-sel="format"]');
    if (fmt) fmt.value = stl.format === "yen" ? "currency" : stl.format || "general";
    const font = root.querySelector('[data-sel="font"]');
    if (font) font.value = stl.font || "";
    const size = root.querySelector('[data-sel="size"]');
    if (size) size.value = String(stl.size || 12);
    ["bold", "italic", "underline", "strike", "wrap"].forEach(function (k) {
      const b = root.querySelector('[data-act="' + k + '"]');
      if (b) b.classList.toggle("on", !!stl[k]);
    });
    const alignMap = { alignLeft: "left", alignCenter: "center", alignRight: "right" };
    Object.keys(alignMap).forEach(function (k) {
      const b = root.querySelector('[data-act="' + k + '"]');
      if (b) b.classList.toggle("on", stl.align === alignMap[k]);
    });
    const vMap = { valignTop: "top", valignMiddle: "middle", valignBottom: "bottom" };
    Object.keys(vMap).forEach(function (k) {
      const b = root.querySelector('[data-act="' + k + '"]');
      if (b) b.classList.toggle("on", (stl.valign || "bottom") === vMap[k]);
    });
    const sh = active();
    const toggles = { showFormulas: ui.showFormulas, gridlines: sh.gridlines !== false, filterToggle: !!sh.filter, paintFormat: !!painter };
    Object.keys(toggles).forEach(function (k) {
      root.querySelectorAll('[data-act="' + k + '"]').forEach(function (b) {
        b.classList.toggle("on", !!toggles[k]);
      });
    });
    const mergeBtn = root.querySelector('[data-act="merge"]');
    if (mergeBtn) {
      const m = api.mergeAt(sheetId(), sel.r, sel.c);
      const on = !!(m && m.r1 === sel.r1 && m.c1 === sel.c1 && m.r2 === sel.r2 && m.c2 === sel.c2);
      mergeBtn.classList.toggle("on", on);
      mergeBtn.title = t(on ? "sheetsUnmerge" : "sheetsMerge");
    }
    root.querySelectorAll('[data-act="cancelEdit"],[data-act="confirmEdit"]').forEach(function (b) {
      b.classList.toggle("show", !!editing);
    });
  }
  function nameForSel() {
    const names = api.names();
    const keys = Object.keys(names);
    for (let i = 0; i < keys.length; i++) {
      const ref = api.nameRef(keys[i], sheetId());
      if (!ref || ref.sheetId !== sheetId()) continue;
      const r1 = ref.r != null ? ref.r : ref.r1;
      const c1 = ref.c != null ? ref.c : ref.c1;
      const r2 = ref.r != null ? ref.r : ref.r2;
      const c2 = ref.c != null ? ref.c : ref.c2;
      if (r1 === sel.r1 && c1 === sel.c1 && r2 === sel.r2 && c2 === sel.c2) return keys[i];
    }
    return "";
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
    body.addEventListener("beforeinput", function (e) {
      if (editing || !e.data || e.target !== body) return;
      e.preventDefault();
      startEdit("cell", e.data);
    });
    root.querySelector(".sheets-colhead").addEventListener("contextmenu", onHeadContext);
    root.querySelector(".sheets-rowhead").addEventListener("contextmenu", onHeadContext);
    body.addEventListener(
      "wheel",
      function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom(ui.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
        }
      },
      { passive: false }
    );
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
      if (ac) return;
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
    const activeTab = tabs.querySelector(".sheets-tab.active");
    if (activeTab && activeTab.scrollIntoView) {
      try {
        activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch (_err) {}
    }
  }

  function onScroll() {
    renderGrid();
  }

  function cellFromPoint(x, y) {
    const body = root.querySelector(".sheets-body");
    const rect = body.getBoundingClientRect();
    const z = ui.zoom || 1;
    const fz = frozen();
    let px = (x - rect.left) / z;
    let py = (y - rect.top) / z;
    if (px >= colX(fz.c)) px += body.scrollLeft;
    if (py >= rowY(fz.r)) py += body.scrollTop;
    return { r: rowAt(py), c: colAt(px) };
  }

  function onClick(e) {
    const act = e.target.closest("[data-act]");
    if (act) {
      run(act.getAttribute("data-act"), act);
      return;
    }
    const rtab = e.target.closest(".sheets-rtab");
    if (rtab) {
      ui.tab = rtab.getAttribute("data-tab");
      saveUi();
      repaintRibbon();
      return;
    }
    const chartEdit = e.target.closest("[data-chart-edit]");
    if (chartEdit) {
      dialogs.chart(chartEdit.getAttribute("data-chart-edit"));
      return;
    }
    const chartDel = e.target.closest("[data-chart-del]");
    if (chartDel) {
      const id = chartDel.getAttribute("data-chart-del");
      api.setSheetProp(
        sheetId(),
        "charts",
        (active().charts || []).filter(function (c) {
          return c.id !== id;
        })
      );
      return;
    }
    const fbtn = e.target.closest(".sheets-filter-btn");
    if (fbtn) {
      e.stopPropagation();
      dialogs.filterMenu(Number(fbtn.getAttribute("data-fc")), fbtn);
      return;
    }
    const tab = e.target.closest(".sheets-tab");
    if (tab && tab.getAttribute("data-sheet")) {
      if (isFormulaEdit()) {
        switchSheetKeepFormula(tab.getAttribute("data-sheet"));
        return;
      }
      selectSheet(tab.getAttribute("data-sheet"));
      return;
    }
    const hcol = e.target.closest(".sheets-hcell[data-col]");
    if (hcol && !e.target.classList.contains("sheets-col-resizer")) {
      if (isFormulaEdit()) {
        const c = Number(hcol.getAttribute("data-col"));
        insertPointRef(0, c, Math.max(visRows - 1, 999), c);
        return;
      }
      commitEdit();
      root.querySelector(".sheets-body").focus();
      const c = Number(hcol.getAttribute("data-col"));
      if (e.shiftKey) setSel(0, Math.min(sel.c, c), visRows - 1, Math.max(sel.c, c));
      else setSel(0, c, visRows - 1, c);
      snapSel();
      renderGrid();
      syncFormula();
      return;
    }
    const hrow = e.target.closest(".sheets-hcell[data-row]");
    if (hrow && !e.target.classList.contains("sheets-row-resizer")) {
      if (isFormulaEdit()) {
        const r = Number(hrow.getAttribute("data-row"));
        insertPointRef(r, 0, r, Math.max(visCols - 1, 25));
        return;
      }
      commitEdit();
      root.querySelector(".sheets-body").focus();
      const r = Number(hrow.getAttribute("data-row"));
      if (e.shiftKey) setSel(Math.min(sel.r, r), 0, Math.max(sel.r, r), visCols - 1);
      else setSel(r, 0, r, visCols - 1);
      snapSel();
      renderGrid();
      syncFormula();
    }
  }
  function selectSheet(id) {
    commitEdit();
    api.setActive(id);
    const used = api.usedRange(sheetId());
    visRows = Math.max(MIN_ROWS, used.r + GROW);
    visCols = Math.max(MIN_COLS, used.c + 8);
    setSel(0, 0);
    paint();
  }
  function onDbl(e) {
    if (e.target.closest(".sheets-col-resizer")) {
      autofitCols(Number(e.target.getAttribute("data-col")), Number(e.target.getAttribute("data-col")));
      return;
    }
    if (e.target.closest(".sheets-row-resizer")) {
      const r = Number(e.target.getAttribute("data-row"));
      api.setRowHeight(sheetId(), r, DEF_H);
      return;
    }
    if (e.target.closest(".sheets-chart")) return;
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
      } else {
        const cell = root.querySelector(".sheets-edit");
        if (cell) cell.value = editing.value;
      }
      updateAutocomplete();
      if (wasPointing || isFormulaEdit()) renderGrid();
    }
  }
  function onChange(e) {
    const name = e.target.getAttribute && e.target.getAttribute("data-sel");
    if (!name) return;
    if (name === "format") {
      const v = e.target.value;
      if (v === "custom") return dialogs.customFormat();
      const patch = { format: v };
      if (v === "currency" || v === "accounting") patch.symbol = styleOf(sel.r, sel.c).symbol || defaultSymbol();
      applySel(patch);
    } else if (name === "font") applySel({ font: e.target.value });
    else if (name === "size") applySel({ size: Number(e.target.value) || 12 });
    root.querySelector(".sheets-body").focus();
  }
  function defaultSymbol() {
    const l = lang();
    return l === "pt" ? "R$" : l === "ja" ? "¥" : "$";
  }

  function onPointerDown(e) {
    if (e.target.closest(".sheets-menu") || e.target.closest(".sheets-overlay") || e.target.closest(".sheets-panel")) return;
    if (e.target.closest(".sheets-col-resizer")) {
      const c = Number(e.target.getAttribute("data-col"));
      const startX = e.clientX;
      const startW = colW(c) || DEF_W;
      const z = ui.zoom || 1;
      const move = function (ev) {
        api.setColWidth(sheetId(), c, startW + (ev.clientX - startX) / z);
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
    if (e.target.closest(".sheets-row-resizer")) {
      const r = Number(e.target.getAttribute("data-row"));
      const startY = e.clientY;
      const startH = rowH(r) || DEF_H;
      const z = ui.zoom || 1;
      const move = function (ev) {
        api.setRowHeight(sheetId(), r, startH + (ev.clientY - startY) / z);
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
    const chartResize = e.target.closest("[data-chart-resize]");
    const chartEl = e.target.closest(".sheets-chart");
    if (chartResize || (chartEl && e.target.closest(".sheets-chart-head") && !e.target.closest("button"))) {
      const id = chartEl.getAttribute("data-chart");
      const chart = (active().charts || []).find(function (c) {
        return c.id === id;
      });
      if (!chart) return;
      const start = { x: e.clientX, y: e.clientY, cx: chart.x, cy: chart.y, w: chart.w, h: chart.h };
      const z = ui.zoom || 1;
      const move = function (ev) {
        const dx = (ev.clientX - start.x) / z;
        const dy = (ev.clientY - start.y) / z;
        if (chartResize) {
          chartEl.style.width = Math.max(160, start.w + dx) + "px";
          chartEl.style.height = Math.max(120, start.h + dy) + "px";
        } else {
          chartEl.style.left = Math.max(0, start.cx + dx) + "px";
          chartEl.style.top = Math.max(0, start.cy + dy) + "px";
        }
      };
      const up = function (ev) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const dx = (ev.clientX - start.x) / z;
        const dy = (ev.clientY - start.y) / z;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        const next = (active().charts || []).map(function (c) {
          if (c.id !== id) return c;
          const out = Object.assign({}, c);
          if (chartResize) {
            out.w = Math.max(160, Math.round(start.w + dx));
            out.h = Math.max(120, Math.round(start.h + dy));
          } else {
            out.x = Math.max(0, Math.round(start.cx + dx));
            out.y = Math.max(0, Math.round(start.cy + dy));
          }
          return out;
        });
        api.setSheetProp(sheetId(), "charts", next);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      e.preventDefault();
      return;
    }
    if (chartEl) return;
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
        const fd = fillDrag;
        fillDrag = null;
        if (p.r >= fd.r1 && p.r <= fd.r2 && p.c >= fd.c1 && p.c <= fd.c2) {
          setSel(fd.r1, fd.c1, fd.r2, fd.c2);
          renderGrid();
          return;
        }
        api.fill(sheetId(), fd.r1, fd.c1, fd.r2, fd.c2, p.r, p.c);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      e.preventDefault();
      return;
    }
    const cell = e.target.closest(".sheets-cell");
    if (!cell || e.button !== 0) return;
    if (e.target.closest(".sheets-filter-btn")) return;
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
    if (painter) {
      e.preventDefault();
      const hit = api.mergeAt(sheetId(), r, c);
      setSel(hit ? hit.r1 : r, hit ? hit.c1 : c, hit ? hit.r2 : r, hit ? hit.c2 : c);
      dragging = "paint";
      renderGrid();
      const move = function (ev) {
        const p = cellFromPoint(ev.clientX, ev.clientY);
        setSel(r, c, p.r, p.c);
        snapSel();
        renderGrid();
      };
      const up = function () {
        dragging = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        applyPainter();
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
      updateStatus();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function applyPainter() {
    if (!painter) return;
    const style = painter.style;
    const sticky = painter.sticky;
    api.beginBatch();
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        const cur = api.getStyle(sheetId(), r, c) || {};
        const next = {};
        Object.keys(cur).forEach(function (k) {
          if (k !== "note") next[k] = "";
        });
        Object.assign(next, style);
        api.setStyle(sheetId(), r, c, next, true);
      }
    }
    api.endBatch();
    if (!sticky) painter = null;
    renderGrid();
    syncFormula();
  }

  function onContext(e) {
    const cell = e.target.closest(".sheets-cell");
    if (!cell) return;
    e.preventDefault();
    const r = Number(cell.getAttribute("data-r"));
    const c = Number(cell.getAttribute("data-c"));
    if (!(r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2)) {
      setSel(r, c);
      snapSel();
      renderGrid();
      syncFormula();
    }
    const hasNote = !!styleOf(sel.r, sel.c).note;
    const items = [
      [t("sheetsCut"), "cut"],
      [t("sheetsCopy"), "copy"],
      [t("sheetsPaste"), "paste"],
      [t("sheetsPasteValues"), "pasteValues"],
      [t("sheetsPasteFormats"), "pasteFormats"],
      [t("sheetsPasteTranspose"), "pasteTranspose"],
      null,
      [t("sheetsInsertRowAbove"), "insertRow"],
      [t("sheetsInsertColLeft"), "insertCol"],
      [t("sheetsDeleteRow"), "deleteRow"],
      [t("sheetsDeleteCol"), "deleteCol"],
      null,
      [t("sheetsMerge"), "merge"],
      [t("sheetsCondFormat"), "condFormat"],
      [hasNote ? t("sheetsEditNote") : t("sheetsNote"), "insertNote"],
      [t("sheetsClearContents"), "clearContents"],
      [t("sheetsClearFormats"), "clearFormats"],
      null,
      [t("sheetsSortAsc"), "sortAsc"],
      [t("sheetsSortDesc"), "sortDesc"],
      [t("sheetsFilter"), "filterToggle"],
      [t("sheetsDefineName"), "defineName"],
    ];
    showMenu(
      e.clientX,
      e.clientY,
      items.map(function (it) {
        if (!it) return null;
        return [
          it[0],
          function () {
            run(it[1]);
          },
        ];
      })
    );
  }
  function onHeadContext(e) {
    const hcol = e.target.closest(".sheets-hcell[data-col]");
    const hrow = e.target.closest(".sheets-hcell[data-row]");
    if (!hcol && !hrow) return;
    e.preventDefault();
    if (hcol) {
      const c = Number(hcol.getAttribute("data-col"));
      if (!(c >= sel.c1 && c <= sel.c2 && sel.r1 === 0)) setSel(0, c, visRows - 1, c);
      renderGrid();
      const items = [
        [t("sheetsCut"), "cut"],
        [t("sheetsCopy"), "copy"],
        [t("sheetsPaste"), "paste"],
        null,
        [t("sheetsInsertColLeft"), "insertCol"],
        [t("sheetsInsertColRight"), "insertColRight"],
        [t("sheetsDeleteCol"), "deleteCol"],
        [t("sheetsClearContents"), "clearContents"],
        null,
        [t("sheetsColWidth"), "colWidth"],
        [t("sheetsAutofit"), "autofit"],
        [t("sheetsHideCols"), "hideCols"],
        [t("sheetsUnhideCols"), "unhideCols"],
        null,
        [t("sheetsSortAsc"), "sortAsc"],
        [t("sheetsSortDesc"), "sortDesc"],
        [t("sheetsFreezePanes"), "freezePanes"],
      ];
      showMenu(
        e.clientX,
        e.clientY,
        items.map(function (it) {
          return it && [it[0], function () { run(it[1]); }];
        })
      );
    } else {
      const r = Number(hrow.getAttribute("data-row"));
      if (!(r >= sel.r1 && r <= sel.r2 && sel.c1 === 0)) setSel(r, 0, r, visCols - 1);
      renderGrid();
      const items = [
        [t("sheetsCut"), "cut"],
        [t("sheetsCopy"), "copy"],
        [t("sheetsPaste"), "paste"],
        null,
        [t("sheetsInsertRowAbove"), "insertRow"],
        [t("sheetsInsertRowBelow"), "insertRowBelow"],
        [t("sheetsDeleteRow"), "deleteRow"],
        [t("sheetsClearContents"), "clearContents"],
        null,
        [t("sheetsRowHeight"), "rowHeight"],
        [t("sheetsHideRows"), "hideRows"],
        [t("sheetsUnhideRows"), "unhideRows"],
        [t("sheetsFreezePanes"), "freezePanes"],
      ];
      showMenu(
        e.clientX,
        e.clientY,
        items.map(function (it) {
          return it && [it[0], function () { run(it[1]); }];
        })
      );
    }
  }

  function onKey(e) {
    if (e.target.classList.contains("sheets-book-name")) return;
    if (e.target.closest(".sheets-overlay") || e.target.closest(".sheets-panel") || e.target.closest(".sheets-menu")) {
      if (e.key === "Escape") {
        const ov = e.target.closest(".sheets-overlay");
        const pn = e.target.closest(".sheets-panel");
        if (ov) ov.remove();
        else if (pn) pn.remove();
        else closeMenu();
      }
      return;
    }
    if (e.target.classList.contains("sheets-search")) return;
    const inBar = e.target.classList.contains("sheets-bar") || e.target.classList.contains("sheets-edit");
    const inName = e.target.classList.contains("sheets-namebox");
    if (e.target.classList.contains("sheets-select")) {
      if (e.key === "Escape") root.querySelector(".sheets-body").focus();
      return;
    }
    if (inName && e.key === "Enter") {
      e.preventDefault();
      gotoA1(e.target.value);
      return;
    }
    if (inName && e.key === "Escape") {
      e.target.value = a1Sel();
      root.querySelector(".sheets-body").focus();
      return;
    }
    if (inBar) {
      if (editorKey(e, e.target)) return;
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
    if (menu && e.key === "Escape") {
      closeMenu();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (painter && e.key === "Escape") {
      painter = null;
      renderGrid();
      syncFormula();
      return;
    }
    if (ctrl && !e.shiftKey && key === "z") return prevent(e, "undo");
    if (ctrl && (key === "y" || (e.shiftKey && key === "z"))) return prevent(e, "redo");
    if (ctrl && key === "c") return prevent(e, "copy");
    if (ctrl && key === "x") return prevent(e, "cut");
    if (ctrl && key === "v") return prevent(e, "paste");
    if (ctrl && key === "b") return prevent(e, "bold");
    if (ctrl && key === "i") return prevent(e, "italic");
    if (ctrl && key === "u") return prevent(e, "underline");
    if (ctrl && key === "s") return prevent(e, "fileSave");
    if (ctrl && key === "o") return prevent(e, "fileOpen");
    if (ctrl && key === "a") return prevent(e, "selectAll");
    if (ctrl && key === "f") return prevent(e, "find");
    if (ctrl && key === "h") return prevent(e, "replace");
    if (ctrl && key === "d") return prevent(e, "fillDown");
    if (ctrl && key === "r") return prevent(e, "fillRight");
    if (ctrl && key === "k") return prevent(e, "insertNote");
    if (ctrl && e.shiftKey && key === "l") return prevent(e, "filterToggle");
    if (ctrl && key === "1") return prevent(e, "formatMenu");
    if (ctrl && e.shiftKey && (e.key === "5" || e.key === "%")) return prevent(e, "percent");
    if (ctrl && e.shiftKey && (e.key === "4" || e.key === "$")) return prevent(e, "currency");
    if (ctrl && e.shiftKey && (e.key === "1" || e.key === "!")) return prevent(e, "comma");
    if (ctrl && e.shiftKey && (e.key === "~" || e.key === "`")) return prevent(e, "formatGeneral");
    if (ctrl && e.key === "`") return prevent(e, "showFormulas");
    if (ctrl && e.shiftKey && (e.key === ";" || e.key === ":")) return prevent(e, "insertTime");
    if (ctrl && e.key === ";") return prevent(e, "insertDate");
    if (ctrl && (e.key === "+" || e.key === "=")) {
      if (e.altKey) return prevent(e, "autosum");
      return prevent(e, "insertMenu");
    }
    if (ctrl && e.key === "-") return prevent(e, "deleteMenu");
    if (e.altKey && e.key === "=") return prevent(e, "autosum");
    if (ctrl && e.key === "9") return prevent(e, "hideRows");
    if (ctrl && e.key === "0") return prevent(e, "hideCols");
    if (ctrl && e.shiftKey && e.key === "(") return prevent(e, "unhideRows");
    if (ctrl && e.shiftKey && e.key === ")") return prevent(e, "unhideCols");
    if (ctrl && e.key === "ArrowUp") return prevent(e, null, function () { jump(-1, 0, e.shiftKey); });
    if (ctrl && e.key === "ArrowDown") return prevent(e, null, function () { jump(1, 0, e.shiftKey); });
    if (ctrl && e.key === "ArrowLeft") return prevent(e, null, function () { jump(0, -1, e.shiftKey); });
    if (ctrl && e.key === "ArrowRight") return prevent(e, null, function () { jump(0, 1, e.shiftKey); });
    if (ctrl && e.key === "Home") return prevent(e, null, function () { go(0, 0, e.shiftKey); });
    if (ctrl && e.key === "End") {
      const used = api.usedRange(sheetId());
      return prevent(e, null, function () { go(used.r, used.c, e.shiftKey); });
    }
    if (ctrl && e.key === " ") return prevent(e, null, function () { setSel(0, sel.c1, visRows - 1, sel.c2); afterSel(); });
    if (e.shiftKey && e.key === " ") return prevent(e, null, function () { setSel(sel.r1, 0, sel.r2, visCols - 1); afterSel(); });
    if (ctrl && e.key === "PageDown") return prevent(e, "sheetNext");
    if (ctrl && e.key === "PageUp") return prevent(e, "sheetPrev");
    if (e.key === "F2") return prevent(e, null, function () { startEdit("cell"); });
    if (e.key === "F4") return prevent(e, "redoLast");
    if (e.key === "F5") return prevent(e, null, function () { root.querySelector(".sheets-namebox").focus(); });
    if (e.key === "F7" || e.key === "F3") return prevent(e, "fx");
    if (e.key === "F9") return prevent(e, "recalc");
    if (e.key === "F11") return prevent(e, "insertChart");
    if (e.key === "Delete") return prevent(e, "clearContents");
    if (e.key === "Backspace") {
      e.preventDefault();
      startEdit("cell", "");
      return;
    }
    if (e.key === "Enter") return prevent(e, null, function () { move(e.shiftKey ? -1 : 1, 0); });
    if (e.key === "Tab") return prevent(e, null, function () { move(0, e.shiftKey ? -1 : 1); });
    if (e.key === "ArrowUp") return prevent(e, null, function () { moveSel(-1, 0, e.shiftKey); });
    if (e.key === "ArrowDown") return prevent(e, null, function () { moveSel(1, 0, e.shiftKey); });
    if (e.key === "ArrowLeft") return prevent(e, null, function () { moveSel(0, -1, e.shiftKey); });
    if (e.key === "ArrowRight") return prevent(e, null, function () { moveSel(0, 1, e.shiftKey); });
    if (e.key === "Home") return prevent(e, null, function () { go(sel.r, 0, e.shiftKey); });
    if (e.key === "End") {
      const used = api.usedRange(sheetId());
      return prevent(e, null, function () { go(sel.r, used.c, e.shiftKey); });
    }
    if (e.key === "PageDown" || e.key === "PageUp") {
      const body = root.querySelector(".sheets-body");
      const n = Math.max(1, Math.floor(body.clientHeight / DEF_H) - 1);
      return prevent(e, null, function () { moveSel(e.key === "PageDown" ? n : -n, 0, e.shiftKey); });
    }
    if (e.key === "Escape") {
      if (clipboard && clipboard.marquee) {
        clipboard.marquee = null;
        renderGrid();
      }
      return;
    }
    if (!ctrl && !e.altKey && !e.metaKey && e.key.length === 1) {
      e.preventDefault();
      startEdit("cell", e.key);
    }
  }
  function prevent(e, act, fn) {
    e.preventDefault();
    if (fn) fn();
    else run(act);
  }
  function afterSel() {
    snapSel();
    ensureVisible();
    renderGrid();
    syncFormula();
  }
  function go(r, c, extend) {
    if (extend) setSel(sel.r, sel.c, r, c);
    else setSel(r, c);
    afterSel();
  }
  function jump(dr, dc, extend) {
    const sid = sheetId();
    const used = api.usedRange(sid);
    const otherR = sel.r2 !== sel.r ? sel.r2 : sel.r1;
    const otherC = sel.c2 !== sel.c ? sel.c2 : sel.c1;
    const r = extend ? otherR : sel.r;
    const c = extend ? otherC : sel.c;
    const has = function (rr, cc) {
      return rr >= 0 && cc >= 0 && api.getRaw(sid, rr, cc) !== "";
    };
    const maxR = Math.max(used.r, r);
    const maxC = Math.max(used.c, c);
    const inside = function (rr, cc) {
      return rr >= 0 && cc >= 0 && rr <= maxR && cc <= maxC;
    };
    let nr = r + dr;
    let nc = c + dc;
    if (!inside(nr, nc)) {
      nr = r;
      nc = c;
    } else if (has(r, c) && has(nr, nc)) {
      while (inside(nr + dr, nc + dc) && has(nr + dr, nc + dc)) {
        nr += dr;
        nc += dc;
      }
    } else {
      while (inside(nr, nc) && !has(nr, nc)) {
        nr += dr;
        nc += dc;
      }
      if (!inside(nr, nc)) {
        nr = dr > 0 ? maxR : dr < 0 ? 0 : r;
        nc = dc > 0 ? maxC : dc < 0 ? 0 : c;
      }
    }
    if (extend) setSel(sel.r, sel.c, nr, nc);
    else setSel(nr, nc);
    afterSel();
  }

  function move(dr, dc) {
    const bar = root.querySelector(".sheets-bar");
    if (bar && document.activeElement === bar) bar.blur();
    const m = api.mergeAt(sheetId(), sel.r, sel.c);
    let nr = sel.r;
    let nc = sel.c;
    if (dr > 0) nr = nextVisibleRow(m ? m.r2 : sel.r, 1);
    else if (dr < 0) nr = nextVisibleRow(m ? m.r1 : sel.r, -1);
    if (dc > 0) nc = nextVisibleCol(m ? m.c2 : sel.c, 1);
    else if (dc < 0) nc = nextVisibleCol(m ? m.c1 : sel.c, -1);
    setSel(nr, nc);
    afterSel();
    root.querySelector(".sheets-body").focus();
  }
  function moveSel(dr, dc, extend) {
    if (extend) {
      const anchorR = sel.r;
      const anchorC = sel.c;
      let er = sel.r2 === anchorR && sel.r1 !== anchorR ? sel.r1 : sel.r2;
      let ec = sel.c2 === anchorC && sel.c1 !== anchorC ? sel.c1 : sel.c2;
      if (dr) er = dr > 0 ? nextVisibleRow(er, 1) : nextVisibleRow(er, -1);
      if (dc) ec = dc > 0 ? nextVisibleCol(ec, 1) : nextVisibleCol(ec, -1);
      if (Math.abs(dr) > 1) er = Math.max(0, er + dr - Math.sign(dr));
      setSel(anchorR, anchorC, er, ec);
    } else {
      const m = api.mergeAt(sheetId(), sel.r, sel.c);
      let nr = sel.r;
      let nc = sel.c;
      if (dr > 0) nr = nextVisibleRow(m ? m.r2 : sel.r, 1);
      else if (dr < 0) nr = nextVisibleRow(m ? m.r1 : sel.r, -1);
      if (Math.abs(dr) > 1) nr = Math.max(0, sel.r + dr);
      if (dc > 0) nc = nextVisibleCol(m ? m.c2 : sel.c, 1);
      else if (dc < 0) nc = nextVisibleCol(m ? m.c1 : sel.c, -1);
      setSel(nr, nc);
    }
    afterSel();
  }
  function ensureVisible() {
    const body = root.querySelector(".sheets-body");
    const fz = frozen();
    const y = rowY(sel.r);
    const x = colX(sel.c);
    const fh = rowY(fz.r);
    const fw = colX(fz.c);
    if (sel.r >= fz.r) {
      if (y - fh < body.scrollTop) body.scrollTop = Math.max(0, y - fh);
      if (y + rowH(sel.r) > body.scrollTop + body.clientHeight) body.scrollTop = y + rowH(sel.r) - body.clientHeight;
    }
    if (sel.c >= fz.c) {
      if (x - fw < body.scrollLeft) body.scrollLeft = Math.max(0, x - fw);
      if (x + colW(sel.c) > body.scrollLeft + body.clientWidth) body.scrollLeft = x + colW(sel.c) - body.clientWidth;
    }
  }
  function gotoA1(text) {
    const s = String(text || "").trim();
    const parts = s.split(":");
    const a = E.parseA1(parts[0]);
    if (!a) {
      const ref = api.nameRef(s, sheetId());
      if (ref) {
        if (ref.sheetId !== sheetId()) api.setActive(ref.sheetId);
        if (ref.r != null) setSel(ref.r, ref.c);
        else setSel(ref.r1, ref.c1, ref.r2, ref.c2);
        afterSel();
        root.querySelector(".sheets-body").focus();
        return;
      }
      if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(s)) {
        if (api.defineName(s, "'" + active().name.replace(/'/g, "''") + "'!" + a1Sel())) setStatus(t("sheetsNameDefined", { name: s.toUpperCase() }));
        syncFormula();
      }
      return;
    }
    const b = parts[1] ? E.parseA1(parts[1]) : a;
    setSel(a.r, a.c, b ? b.r : a.r, b ? b.c : a.c);
    afterSel();
    root.querySelector(".sheets-body").focus();
  }
  function editText(raw, stl) {
    const s = String(raw == null ? "" : raw);
    if (s.charAt(0) === "=" || s === "") return s;
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    const f = stl && stl.format;
    if (f === "percent") return String(Math.round(n * 1e10) / 1e8) + "%";
    if (f === "date" || f === "dateIso" || f === "dateLong") return E.formatValue(n, { format: "dateIso" });
    if (f === "datetime") return E.formatValue(n, { format: "dateIso" }) + " " + E.formatValue(n, { format: "time" });
    if (f === "time") return E.formatValue(n, { format: "time" });
    return s;
  }
  function normalizeInput(text, stl) {
    const s = String(text == null ? "" : text);
    const out = { raw: s, style: null };
    if (s === "" || s.charAt(0) === "=" || s.charAt(0) === "'") return out;
    const trimmed = s.trim();
    const f = (stl && stl.format) || "";
    const dt = E.parseDateText(trimmed, lang());
    if (dt) {
      out.raw = String(dt.serial);
      if (!/^date|^datetime$/.test(f)) out.style = { format: dt.hasTime ? "datetime" : "date" };
      return out;
    }
    const tm = E.parseTimeText(trimmed);
    if (tm != null) {
      out.raw = String(tm);
      if (f !== "time") out.style = { format: "time" };
      return out;
    }
    const pct = trimmed.match(/^([+-]?[\d.,]+)\s*%$/);
    if (pct) {
      const n = parseLocaleNumber(pct[1]);
      if (n != null) {
        out.raw = String(n / 100);
        if (f !== "percent") out.style = { format: "percent", decimals: stl && stl.decimals != null ? stl.decimals : (String(n).split(".")[1] || "").length };
        return out;
      }
    }
    const cur = trimmed.match(/^(-)?(R\$|\$|€|¥|£)\s*([+-]?[\d.,]+)$/) || trimmed.match(/^([+-]?[\d.,]+)\s*(R\$|\$|€|¥|£)()$/);
    if (cur) {
      const sym = cur[2];
      const numText = cur[3] !== undefined && cur[3] !== "" ? cur[3] : cur[1];
      const n = parseLocaleNumber(numText);
      if (n != null) {
        const neg = cur[1] === "-" && cur[3] !== "";
        out.raw = String(neg ? -n : n);
        if (f !== "currency" && f !== "accounting") out.style = { format: "currency", symbol: sym, decimals: sym === "¥" ? 0 : 2 };
        return out;
      }
    }
    if (/^[+-]?\d{1,3}([.,]\d{3})+([.,]\d+)?$/.test(trimmed)) {
      const n = parseLocaleNumber(trimmed);
      if (n != null) {
        out.raw = String(n);
        if (!f || f === "general") out.style = { format: "number", decimals: (String(n).split(".")[1] || "").length };
        return out;
      }
    }
    if (lang() === "pt" && /^[+-]?\d+,\d+$/.test(trimmed)) {
      out.raw = trimmed.replace(",", ".");
      return out;
    }
    if (/^(true|false|verdadeiro|falso)$/i.test(trimmed)) {
      out.raw = /^(true|verdadeiro)$/i.test(trimmed) ? "TRUE" : "FALSE";
      return out;
    }
    return out;
  }
  function parseLocaleNumber(text) {
    let s = String(text).trim();
    const pt = lang() === "pt";
    if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || (pt && /^[+-]?\d+(,\d+)?$/.test(s))) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function startEdit(source, seed) {
    if (editing && editing.source === source && source === "bar") return;
    if (editing) commitEdit();
    if (painter) painter = null;
    const m = api.mergeAt(sheetId(), sel.r, sel.c);
    const er = m ? m.r1 : sel.r;
    const ec = m ? m.c1 : sel.c;
    const raw = api.getRaw(sheetId(), er, ec);
    editing = {
      r: er,
      c: ec,
      sheetId: sheetId(),
      source: source,
      value: seed != null ? seed : editText(raw, styleOf(er, ec)),
      pointing: false,
      pointSpan: null,
    };
    updateStatus();
    syncFormula();
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
    closeAutocomplete();
    const r = editing.r;
    const c = editing.c;
    const originSheet = editing.sheetId;
    const bar = root.querySelector(".sheets-bar");
    const v = value != null ? value : editing.source === "bar" && bar ? bar.value : editing.value;
    editing = null;
    const input = root.querySelector(".sheets-edit");
    if (input) input.remove();
    if (originSheet && originSheet !== sheetId()) api.setActive(originSheet);
    const sid = originSheet || sheetId();
    const norm = normalizeInput(v, api.getStyle(sid, r, c));
    if (norm.style) {
      api.beginBatch();
      api.setStyle(sid, r, c, norm.style, true);
      api.setCell(sid, r, c, norm.raw);
      api.endBatch();
    } else if (norm.raw !== api.getRaw(sid, r, c)) api.setCell(sid, r, c, norm.raw);
    setSel(r, c);
    snapSel();
    if (dr || dc) move(dr || 0, dc || 0);
    else {
      renderGrid();
      syncFormula();
    }
    updateStatus();
  }
  function editorLayer() {
    const fz = frozen();
    if (editing.r < fz.r && editing.c < fz.c) return root.querySelector(".sheets-freeze-corner");
    if (editing.r < fz.r) return root.querySelector(".sheets-freeze-rows");
    if (editing.c < fz.c) return root.querySelector(".sheets-freeze-cols");
    return root.querySelector(".sheets-layer:not(.sheets-freeze)");
  }
  function placeEditor() {
    if (!editing) return;
    let input = root.querySelector(".sheets-edit");
    const host = editorLayer();
    if (input && input.parentNode !== host) {
      input.remove();
      input = null;
    }
    if (!input) {
      input = document.createElement("textarea");
      input.className = "sheets-edit";
      input.spellcheck = false;
      input.rows = 1;
      host.appendChild(input);
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (editorKey(e, input)) return;
        if (e.key === "Enter" && e.altKey) {
          e.preventDefault();
          const pos = input.selectionStart;
          const next = input.value.slice(0, pos) + "\n" + input.value.slice(input.selectionEnd);
          input.value = next;
          input.selectionStart = input.selectionEnd = pos + 1;
          editing.value = next;
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
        if (ac) return;
        commitEdit(input.value);
      });
    }
    input.value = editing.value;
    const merged = api.mergeAt(editing.sheetId || sheetId(), editing.r, editing.c);
    let ew = colW(editing.c) || DEF_W;
    let eh = rowH(editing.r) || DEF_H;
    if (merged && merged.r1 === editing.r && merged.c1 === editing.c) {
      ew = colX(merged.c2) + colW(merged.c2) - colX(merged.c1);
      eh = rowY(merged.r2) + rowH(merged.r2) - rowY(merged.r1);
    }
    const stl = styleOf(editing.r, editing.c);
    const body = root.querySelector(".sheets-body");
    const maxW = Math.max(ew, Math.min(body.scrollLeft + body.clientWidth - colX(editing.c), 480));
    const textW = measureText(editing.value, stl) + 14;
    input.style.left = colX(editing.c) + "px";
    input.style.top = rowY(editing.r) + "px";
    input.style.width = Math.max(ew, Math.min(maxW, textW)) + "px";
    input.style.height = eh + "px";
    input.style.minHeight = eh + "px";
    input.style.fontFamily = stl.font || "";
    input.style.fontSize = stl.size ? stl.size + "px" : "";
    input.style.fontWeight = stl.bold ? "700" : "";
    input.style.textAlign = stl.align || "";
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
    closeAutocomplete();
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
    updateStatus();
    root.querySelector(".sheets-body").focus();
  }
  let measureCanvas = null;
  function measureText(text, stl) {
    if (!measureCanvas) measureCanvas = document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    const size = (stl && stl.size) || 12;
    ctx.font = (stl && stl.bold ? "700 " : "") + size + "px " + ((stl && stl.font) || "Segoe UI, Noto Sans JP, system-ui, sans-serif");
    let best = 0;
    String(text || "")
      .split("\n")
      .forEach(function (line) {
        best = Math.max(best, ctx.measureText(line).width);
      });
    return Math.ceil(best);
  }
  function autofitCols(c1, c2) {
    const sid = sheetId();
    const used = api.usedRange(sid);
    for (let c = c1; c <= c2; c++) {
      let w = 36;
      for (let r = 0; r <= Math.min(used.r, 5000); r++) {
        const raw = api.getRaw(sid, r, c);
        if (raw === "") continue;
        if (api.mergeAt(sid, r, c)) continue;
        const txt = cellValueText(sid, r, c);
        w = Math.max(w, measureText(txt, api.getStyle(sid, r, c)) + 14);
      }
      api.setColWidth(sid, c, Math.min(480, w));
    }
  }

  function editorKey(e, el) {
    if (ac && ac.items.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        ac.index = (ac.index + (e.key === "ArrowDown" ? 1 : -1) + ac.items.length) % ac.items.length;
        drawAutocomplete();
        return true;
      }
      if (e.key === "Tab" || (e.key === "Enter" && ac.prefix)) {
        e.preventDefault();
        acceptAutocomplete();
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeAutocomplete();
        return true;
      }
    }
    if (e.key === "F4" && isFormulaEdit()) {
      e.preventDefault();
      toggleAbsRef(el);
      return true;
    }
    if (isFormulaEdit() && (wantsPoint() || editing.pointing) && e.key.slice(0, 5) === "Arrow") {
      e.preventDefault();
      e.stopPropagation();
      pointByKey(e);
      return true;
    }
    return false;
  }
  function toggleAbsRef(el) {
    const text = el.value;
    const pos = el.selectionStart;
    const re = /(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]{0,6})/g;
    let m;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (pos >= start && pos <= end) {
        const states = ["", "$$", "$r", "$c"];
        const cur = m[1] && m[3] ? 1 : m[3] ? 2 : m[1] ? 3 : 0;
        const nextState = states[(cur + 1) % 4];
        const rep = (nextState === "$$" || nextState === "$c" ? "$" : "") + m[2].toUpperCase() + (nextState === "$$" || nextState === "$r" ? "$" : "") + m[4];
        const next = text.slice(0, start) + rep + text.slice(end);
        setEditorText(next, start + rep.length);
        renderGrid();
        return;
      }
    }
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

  function acContext() {
    if (!editing || !isFormulaEdit()) return null;
    const el = editEl();
    const text = el ? el.value : String(editing.value || "");
    const pos = el && el.selectionStart != null ? el.selectionStart : text.length;
    const before = text.slice(0, pos);
    if (inQuoted(before)) return null;
    const m = before.match(/([A-Za-z_][A-Za-z0-9_.]*)$/);
    const prefix = m && !E.parseA1(m[1]) ? m[1] : "";
    let depth = 0;
    let fnName = "";
    let argIndex = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before.charAt(i);
      if (ch === ")") depth++;
      else if (ch === "(") {
        if (depth === 0) {
          const mm = before.slice(0, i).match(/([A-Za-z_][A-Za-z0-9_.]*)$/);
          if (mm) {
            fnName = mm[1].toUpperCase();
            break;
          }
        } else depth--;
      } else if ((ch === "," || ch === ";") && depth === 0) argIndex++;
    }
    return { prefix: prefix, start: pos - prefix.length, pos: pos, fnName: fnName, argIndex: argIndex };
  }
  function updateAutocomplete() {
    const ctx = acContext();
    if (!ctx) {
      closeAutocomplete();
      return;
    }
    let items = [];
    if (ctx.prefix.length >= 1) {
      const p = ctx.prefix.toUpperCase();
      items = E.FUNCTION_LIST.filter(function (f) {
        return f[0].indexOf(p) === 0;
      }).slice(0, 10);
      const names = Object.keys(api.names()).filter(function (n) {
        return n.indexOf(p) === 0;
      });
      names.forEach(function (n) {
        items.push([n, "name", api.names()[n], "", "", ""]);
      });
    }
    let hint = null;
    if (ctx.fnName) {
      const f = E.FUNCTION_LIST.find(function (x) {
        return x[0] === ctx.fnName;
      });
      if (f) hint = { fn: f, argIndex: ctx.argIndex };
    }
    if (!items.length && !hint) {
      closeAutocomplete();
      return;
    }
    ac = { items: items, index: 0, prefix: ctx.prefix, start: ctx.start, pos: ctx.pos, hint: hint };
    drawAutocomplete();
  }
  function drawAutocomplete() {
    if (!ac) return;
    const host = root.querySelector(".sheets-shell");
    let box = root.querySelector(".sheets-ac");
    if (!box) {
      box = document.createElement("div");
      box.className = "sheets-ac";
      host.appendChild(box);
      box.addEventListener("mousedown", function (e) {
        e.preventDefault();
        const item = e.target.closest("[data-ac]");
        if (item) {
          ac.index = Number(item.getAttribute("data-ac"));
          acceptAutocomplete();
        }
      });
    }
    const idx = lang() === "pt" ? 4 : lang() === "ja" ? 5 : 3;
    let html = "";
    if (ac.hint) {
      const sig = ac.hint.fn[2];
      const open = sig.indexOf("(");
      const argsText = sig.slice(open + 1, sig.lastIndexOf(")"));
      const args = argsText.split(",").map(function (s) {
        return s.trim();
      });
      const parts = args.map(function (a, i) {
        const isVar = a === "...";
        const on = i === ac.hint.argIndex || (isVar && ac.hint.argIndex >= i) || (i === args.length - 1 && ac.hint.argIndex >= args.length && args[args.length - 1] === "...");
        return on ? "<b>" + escapeHtml(a) + "</b>" : escapeHtml(a);
      });
      html += '<div class="sheets-ac-hint"><strong>' + escapeHtml(ac.hint.fn[0]) + "</strong>(" + parts.join(", ") + ")<span>" + escapeHtml(ac.hint.fn[idx] || "") + "</span></div>";
    }
    ac.items.forEach(function (f, i) {
      html += '<div class="sheets-ac-item' + (i === ac.index ? " on" : "") + '" data-ac="' + i + '"><strong>' + escapeHtml(f[0]) + "</strong><span>" + escapeHtml(f[1] === "name" ? f[2] : f[idx] || "") + "</span></div>";
    });
    box.innerHTML = html;
    const el = editEl();
    const rect = host.getBoundingClientRect();
    const er = el ? el.getBoundingClientRect() : rect;
    let x = er.left - rect.left;
    let y = er.bottom - rect.top + 2;
    box.style.left = Math.max(4, Math.min(x, rect.width - box.offsetWidth - 4)) + "px";
    if (y + box.offsetHeight > rect.height - 4) y = Math.max(4, er.top - rect.top - box.offsetHeight - 2);
    box.style.top = y + "px";
  }
  function acceptAutocomplete() {
    if (!ac || !ac.items.length) return;
    const item = ac.items[ac.index];
    const el = editEl();
    const text = el ? el.value : String(editing.value || "");
    const isName = item[1] === "name";
    const rep = isName ? item[0] : item[0] + "(";
    let after = text.slice(ac.pos);
    if (!isName && after.charAt(0) === "(") after = after.slice(1);
    const start = ac.start;
    const next = text.slice(0, start) + rep + after;
    closeAutocomplete();
    setEditorText(next, start + rep.length);
    updateAutocomplete();
    renderGrid();
  }
  function closeAutocomplete() {
    ac = null;
    const box = root && root.querySelector(".sheets-ac");
    if (box) box.remove();
  }
  function toggleStyle(key) {
    const cur = !styleOf(sel.r, sel.c)[key];
    const patch = {};
    patch[key] = cur;
    applySel(patch);
  }
  function setZoom(z) {
    ui.zoom = Math.max(0.5, Math.min(2, Math.round(z * 10) / 10));
    saveUi();
    const wrap = root.querySelector(".sheets-grid-wrap");
    if (wrap) wrap.style.zoom = ui.zoom;
    renderGrid();
  }
  function dataRegion(r, c) {
    const sid = sheetId();
    const has = function (rr, cc) {
      return rr >= 0 && cc >= 0 && api.getRaw(sid, rr, cc) !== "";
    };
    let r1 = r;
    let r2 = r;
    let c1 = c;
    let c2 = c;
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 5000) {
      changed = false;
      const rowHas = function (rr) {
        for (let cc = c1; cc <= c2; cc++) if (has(rr, cc)) return true;
        return false;
      };
      const colHas = function (cc) {
        for (let rr = r1; rr <= r2; rr++) if (has(rr, cc)) return true;
        return false;
      };
      if (r1 > 0 && rowHas(r1 - 1)) {
        r1--;
        changed = true;
      }
      if (rowHas(r2 + 1)) {
        r2++;
        changed = true;
      }
      if (c1 > 0 && colHas(c1 - 1)) {
        c1--;
        changed = true;
      }
      if (colHas(c2 + 1)) {
        c2++;
        changed = true;
      }
    }
    return { r1: r1, c1: c1, r2: r2, c2: c2 };
  }
  function workRange() {
    if (sel.r1 !== sel.r2 || sel.c1 !== sel.c2) return { r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 };
    return dataRegion(sel.r, sel.c);
  }
  function looksLikeHeader(rg) {
    const sid = sheetId();
    if (rg.r2 <= rg.r1) return false;
    let textTop = 0;
    let numBelow = 0;
    for (let c = rg.c1; c <= rg.c2; c++) {
      if (typeof api.getValue(sid, rg.r1, c) === "string") textTop++;
      if (typeof api.getValue(sid, rg.r1 + 1, c) === "number") numBelow++;
    }
    return textTop > 0 && (numBelow > 0 || textTop === rg.c2 - rg.c1 + 1);
  }
  function sortRange(rg, keyCol, desc, hasHeader) {
    const sid = sheetId();
    const start = rg.r1 + (hasHeader ? 1 : 0);
    if (start >= rg.r2 && start !== rg.r1) return;
    const rows = [];
    for (let r = start; r <= rg.r2; r++) {
      const cells = [];
      for (let c = rg.c1; c <= rg.c2; c++) cells.push({ raw: api.getRaw(sid, r, c), style: Object.assign({}, api.getStyle(sid, r, c)) });
      rows.push({ cells: cells, key: api.getValue(sid, r, keyCol), idx: r });
    }
    const keyOf = function (v) {
      if (v == null || v === "") return [2, 0, ""];
      if (E.isErr(v)) return [3, 0, v.error];
      if (typeof v === "number") return [0, v, ""];
      if (typeof v === "boolean") return [1, v ? 1 : 0, ""];
      return [1, 0, String(v).toLowerCase()];
    };
    rows.sort(function (a, b) {
      const ka = keyOf(a.key);
      const kb = keyOf(b.key);
      let rel = 0;
      if (ka[0] === 2 && kb[0] !== 2) return 1;
      if (kb[0] === 2 && ka[0] !== 2) return -1;
      if (ka[0] !== kb[0]) rel = ka[0] - kb[0];
      else if (ka[0] === 0 || ka[0] === 1 && !ka[2] && !kb[2]) rel = ka[1] - kb[1];
      else rel = ka[2].localeCompare(kb[2], undefined, { numeric: true, sensitivity: "base" });
      if (rel === 0) rel = a.idx - b.idx;
      return desc ? -rel : rel;
    });
    const anyFormula = rows.some(function (row) {
      return row.cells.some(function (cell) {
        return String(cell.raw).charAt(0) === "=";
      });
    });
    api.beginBatch();
    rows.forEach(function (row, i) {
      const r = start + i;
      row.cells.forEach(function (cell, j) {
        let raw = cell.raw;
        if (anyFormula && String(raw).charAt(0) === "=") raw = api.adjustFormula(raw, r - row.idx, 0);
        api.setStyle(sid, r, rg.c1 + j, cell.style, true);
        api.setCell(sid, r, rg.c1 + j, raw, true);
      });
    });
    api.endBatch();
  }
  function quickSort(desc) {
    const rg = workRange();
    const header = looksLikeHeader(rg);
    const keyCol = Math.max(rg.c1, Math.min(rg.c2, sel.c));
    sortRange(rg, keyCol, desc, header);
    setSel(rg.r1, rg.c1, rg.r2, rg.c2);
    renderGrid();
    syncFormula();
  }
  function applyFilter(filter) {
    const sid = sheetId();
    const sh = active();
    const hidden = Object.assign({}, sh.hiddenRows || {});
    Object.keys(hidden).forEach(function (k) {
      if (hidden[k] === 2) delete hidden[k];
    });
    if (filter) {
      for (let r = filter.r1 + 1; r <= filter.r2; r++) {
        let show = true;
        Object.keys(filter.cols || {}).forEach(function (ck) {
          const allowed = filter.cols[ck];
          if (!allowed || !show) return;
          const v = api.display(sid, r, Number(ck));
          if (allowed.indexOf(v) < 0) show = false;
        });
        if (!show) hidden[r] = 2;
      }
    }
    api.beginBatch();
    api.setSheetProp(sid, "filter", filter, true);
    api.setSheetProp(sid, "hiddenRows", hidden, true);
    api.endBatch();
  }
  function toggleFilter() {
    const sh = active();
    if (sh.filter) {
      applyFilter(null);
      return;
    }
    const rg = workRange();
    if (rg.r1 === rg.r2 && rg.c1 === rg.c2 && api.getRaw(sheetId(), rg.r1, rg.c1) === "") {
      setStatus(t("sheetsFilterNeedData"));
      return;
    }
    applyFilter({ r1: rg.r1, c1: rg.c1, r2: rg.r2, c2: rg.c2, cols: {} });
    setSel(rg.r1, rg.c1, rg.r2, rg.c2);
    renderGrid();
  }
  function autosum(fnName) {
    const sid = sheetId();
    const fn = fnName || "SUM";
    const isNum = function (r, c) {
      return typeof api.getValue(sid, r, c) === "number";
    };
    if (sel.r1 !== sel.r2 || sel.c1 !== sel.c2) {
      api.beginBatch();
      let wrote = false;
      for (let c = sel.c1; c <= sel.c2; c++) {
        let hasNum = false;
        for (let r = sel.r1; r <= sel.r2; r++) if (isNum(r, c)) hasNum = true;
        if (!hasNum) continue;
        api.setCell(sid, sel.r2 + 1, c, "=" + fn + "(" + E.a1(sel.r1, c) + ":" + E.a1(sel.r2, c) + ")", true);
        wrote = true;
      }
      if (!wrote && sel.r1 === sel.r2) {
        api.setCell(sid, sel.r1, sel.c2 + 1, "=" + fn + "(" + E.a1(sel.r1, sel.c1) + ":" + E.a1(sel.r1, sel.c2) + ")", true);
      }
      api.endBatch();
      return;
    }
    let r = sel.r - 1;
    while (r >= 0 && isNum(r, sel.c)) r--;
    if (r < sel.r - 1) {
      api.setCell(sid, sel.r, sel.c, "=" + fn + "(" + E.a1(r + 1, sel.c) + ":" + E.a1(sel.r - 1, sel.c) + ")");
      return;
    }
    let c = sel.c - 1;
    while (c >= 0 && isNum(sel.r, c)) c--;
    if (c < sel.c - 1) {
      api.setCell(sid, sel.r, sel.c, "=" + fn + "(" + E.a1(sel.r, c + 1) + ":" + E.a1(sel.r, sel.c - 1) + ")");
      return;
    }
    startEdit("cell", "=" + fn + "(");
  }
  function hideRange(isRow, hide) {
    const sh = active();
    const key = isRow ? "hiddenRows" : "hiddenCols";
    const map = Object.assign({}, sh[key] || {});
    const a = isRow ? sel.r1 : sel.c1;
    const b = isRow ? sel.r2 : sel.c2;
    if (hide) for (let i = a; i <= b; i++) map[i] = 1;
    else {
      for (let i = Math.max(0, a - 1); i <= b + 1; i++) if (map[i] === 1 || (map[i] && !sh.filter)) delete map[i];
      if (a === 0 && b >= (isRow ? visRows : visCols) - 1) Object.keys(map).forEach(function (k) { if (map[k] === 1) delete map[k]; });
    }
    api.setSheetProp(sheetId(), key, map);
  }
  function setBorders(kind) {
    const sid = sheetId();
    api.beginBatch();
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        const cur = Object.assign({}, (api.getStyle(sid, r, c) || {}).border || {});
        let next = cur;
        if (kind === "none") next = {};
        else if (kind === "all") next = { t: 1, b: 1, l: 1, r: 1 };
        else if (kind === "outer") {
          next = Object.assign({}, cur);
          if (r === sel.r1) next.t = 1;
          if (r === sel.r2) next.b = 1;
          if (c === sel.c1) next.l = 1;
          if (c === sel.c2) next.r = 1;
        } else if (kind === "top") {
          if (r === sel.r1) next = Object.assign({}, cur, { t: 1 });
        } else if (kind === "bottom") {
          if (r === sel.r2) next = Object.assign({}, cur, { b: 1 });
        } else if (kind === "left") {
          if (c === sel.c1) next = Object.assign({}, cur, { l: 1 });
        } else if (kind === "right") {
          if (c === sel.c2) next = Object.assign({}, cur, { r: 1 });
        } else if (kind === "thickBottom") {
          if (r === sel.r2) next = Object.assign({}, cur, { b: 1, color: "var(--accent)" });
        }
        if (next !== cur || kind === "none") api.setStyle(sid, r, c, { border: Object.keys(next).length ? next : "" }, true);
      }
    }
    api.endBatch();
  }
  function clearRange(kind) {
    const sid = sheetId();
    api.beginBatch();
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        if (kind === "contents" || kind === "all") api.setCell(sid, r, c, "", true);
        if (kind === "formats" || kind === "all") {
          const cur = api.getStyle(sid, r, c) || {};
          const patch = {};
          Object.keys(cur).forEach(function (k) {
            if (kind === "all" || k !== "note") patch[k] = "";
          });
          if (Object.keys(patch).length) api.setStyle(sid, r, c, patch, true);
        }
        if (kind === "notes") api.setStyle(sid, r, c, { note: "" }, true);
      }
    }
    if (kind === "all") {
      const sh = active();
      const keep = (sh.condFormats || []).filter(function (rule) {
        return !(rule.r1 >= sel.r1 && rule.r2 <= sel.r2 && rule.c1 >= sel.c1 && rule.c2 <= sel.c2);
      });
      if (keep.length !== (sh.condFormats || []).length) api.setSheetProp(sid, "condFormats", keep, true);
    }
    api.endBatch();
    if (kind === "all") api.unmergeCells(sid, sel.r1, sel.c1, sel.r2, sel.c2);
  }
  function insertDateTime(withTime) {
    const now = new Date();
    const serial = E.dateToSerial(now.getFullYear(), now.getMonth() + 1, now.getDate()) + (withTime ? (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400 : 0);
    const sid = sheetId();
    api.beginBatch();
    api.setStyle(sid, sel.r, sel.c, { format: withTime ? "time" : "date" }, true);
    api.setCell(sid, sel.r, sel.c, String(withTime ? serial - Math.floor(serial) : serial), true);
    api.endBatch();
  }
  function fillDirection(down) {
    const sid = sheetId();
    if (sel.r1 === sel.r2 && sel.c1 === sel.c2) {
      if (down && sel.r > 0) api.fill(sid, sel.r - 1, sel.c, sel.r - 1, sel.c, sel.r, sel.c);
      else if (!down && sel.c > 0) api.fill(sid, sel.r, sel.c - 1, sel.r, sel.c - 1, sel.r, sel.c);
      return;
    }
    if (down) api.fill(sid, sel.r1, sel.c1, sel.r1, sel.c2, sel.r2, sel.c2);
    else api.fill(sid, sel.r1, sel.c1, sel.r2, sel.c1, sel.r2, sel.c2);
  }
  function removeDuplicates() {
    const sid = sheetId();
    const rg = workRange();
    const header = looksLikeHeader(rg);
    const start = rg.r1 + (header ? 1 : 0);
    const seen = new Set();
    const keep = [];
    let removed = 0;
    for (let r = start; r <= rg.r2; r++) {
      const vals = [];
      const cells = [];
      for (let c = rg.c1; c <= rg.c2; c++) {
        vals.push(api.display(sid, r, c));
        cells.push({ raw: api.getRaw(sid, r, c), style: Object.assign({}, api.getStyle(sid, r, c)) });
      }
      const key = vals.join("\u0001").toLowerCase();
      if (seen.has(key)) {
        removed++;
        continue;
      }
      seen.add(key);
      keep.push(cells);
    }
    if (!removed) {
      setStatus(t("sheetsNoDuplicates"));
      return;
    }
    api.beginBatch();
    for (let r = start; r <= rg.r2; r++) {
      const row = keep[r - start];
      for (let c = rg.c1; c <= rg.c2; c++) {
        const cell = row ? row[c - rg.c1] : { raw: "", style: {} };
        api.setStyle(sid, r, c, cell.style, true);
        api.setCell(sid, r, c, cell.raw, true);
      }
    }
    api.endBatch();
    setStatus(t("sheetsDuplicatesRemoved", { n: removed }));
  }
  function trimSpaces() {
    const sid = sheetId();
    api.beginBatch();
    for (let r = sel.r1; r <= sel.r2; r++) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        const raw = api.getRaw(sid, r, c);
        if (typeof raw === "string" && raw.charAt(0) !== "=") {
          const next = raw.replace(/\s+/g, " ").trim();
          if (next !== raw) api.setCell(sid, r, c, next, true);
        }
      }
    }
    api.endBatch();
  }
  function recalc() {
    api.invalidateAll();
    renderGrid();
    setStatus(t("sheetsRecalculated"));
  }
  function traceErrors() {
    const sid = sheetId();
    const used = api.usedRange(sid);
    const start = sel.r * (used.c + 1) + sel.c;
    const total = (used.r + 1) * (used.c + 1);
    for (let k = 1; k <= total; k++) {
      const idx = (start + k) % total;
      const r = Math.floor(idx / (used.c + 1));
      const c = idx % (used.c + 1);
      if (E.isErr(api.getValue(sid, r, c))) {
        setSel(r, c);
        afterSel();
        setStatus(String(api.getValue(sid, r, c).error));
        return;
      }
    }
    setStatus(t("sheetsNoErrors"));
  }
  function freeze(rows, cols) {
    const sid = sheetId();
    api.beginBatch();
    api.setSheetProp(sid, "frozenRows", rows, true);
    api.setSheetProp(sid, "frozenCols", cols, true);
    api.endBatch();
  }

  function run(name, el) {
    closeMenu();
    const sid = sheetId();
    if (name === "fileNew") return newBook();
    if (name === "fileOpen") return showOpen();
    if (name === "fileSave") {
      if (editing) commitEdit();
      persistNow()
        .then(function () {
          setStatus(t("sheetsSaved"));
        })
        .catch(function () {
          setStatus(t("sheetsExportFail"));
        });
      return;
    }
    if (name === "fileSaveAs") return showSaveAs();
    if (name === "fileImport") {
      fileInput.click();
      return;
    }
    if (name === "fileExport") return showExport(el);
    if (name === "fileExportCsv") return exportAs("csv");
    if (name === "fileExportXlsx") return exportAs("xlsx");
    if (name === "fileExportVcsh") return exportAs("vcsh");
    if (name === "print") return printSheet();
    if (name === "help") return dialogs.help();
    if (name === "undo") return api.undo();
    if (name === "redo") return api.redo();
    if (name === "redoLast") return api.redo();
    if (name === "cut") return copySel(true);
    if (name === "copy") return copySel(false);
    if (name === "paste") return paste("all");
    if (name === "pasteValues") return paste("values");
    if (name === "pasteFormats") return paste("formats");
    if (name === "pasteTranspose") return paste("transpose");
    if (name === "pasteMenu") {
      return showMenuFrom(el, [
        [t("sheetsPaste"), function () { paste("all"); }],
        [t("sheetsPasteValues"), function () { paste("values"); }],
        [t("sheetsPasteFormats"), function () { paste("formats"); }],
        [t("sheetsPasteTranspose"), function () { paste("transpose"); }],
      ]);
    }
    if (name === "paintFormat") {
      if (painter) painter = null;
      else {
        const stl = Object.assign({}, styleOf(sel.r, sel.c));
        delete stl.note;
        painter = { style: stl, sticky: false };
      }
      renderGrid();
      syncFormula();
      return;
    }
    if (name === "cancelEdit") return cancelEdit();
    if (name === "confirmEdit") return commitEdit();
    if (name === "selectAll") {
      const used = api.usedRange(sid);
      setSel(0, 0, Math.max(used.r, visRows - 1), Math.max(used.c, visCols - 1));
      renderGrid();
      syncFormula();
      return;
    }
    if (name === "bold") return toggleStyle("bold");
    if (name === "italic") return toggleStyle("italic");
    if (name === "underline") return toggleStyle("underline");
    if (name === "strike") return toggleStyle("strike");
    if (name === "wrap") return toggleStyle("wrap");
    if (name === "alignLeft") return applySel({ align: styleOf(sel.r, sel.c).align === "left" ? "" : "left" });
    if (name === "alignCenter") return applySel({ align: styleOf(sel.r, sel.c).align === "center" ? "" : "center" });
    if (name === "alignRight") return applySel({ align: styleOf(sel.r, sel.c).align === "right" ? "" : "right" });
    if (name === "valignTop") return applySel({ valign: "top" });
    if (name === "valignMiddle") return applySel({ valign: "middle" });
    if (name === "valignBottom") return applySel({ valign: "" });
    if (name === "indentMore") return applySel({ indent: Math.min(10, (styleOf(sel.r, sel.c).indent || 0) + 1) });
    if (name === "indentLess") return applySel({ indent: Math.max(0, (styleOf(sel.r, sel.c).indent || 0) - 1) || "" });
    if (name === "merge") {
      api.toggleMerge(sid, sel.r1, sel.c1, sel.r2, sel.c2);
      snapSel();
      return;
    }
    if (name === "borders") {
      return showMenuFrom(el, [
        [t("sheetsBorderAll"), function () { setBorders("all"); }],
        [t("sheetsBorderOuter"), function () { setBorders("outer"); }],
        [t("sheetsBorderTop"), function () { setBorders("top"); }],
        [t("sheetsBorderBottom"), function () { setBorders("bottom"); }],
        [t("sheetsBorderLeft"), function () { setBorders("left"); }],
        [t("sheetsBorderRight"), function () { setBorders("right"); }],
        [t("sheetsBorderThickBottom"), function () { setBorders("thickBottom"); }],
        [t("sheetsBorderNone"), function () { setBorders("none"); }],
      ]);
    }
    if (name === "fillColor") return showPalette("fill", el);
    if (name === "fontColor") return showPalette("color", el);
    if (name === "percent") return applySel({ format: "percent" });
    if (name === "formatGeneral") return applySel({ format: "general" });
    if (name === "currency") {
      return showMenuFrom(el, CURRENCIES.map(function (c) {
        return [c[1], function () { applySel({ format: "currency", symbol: c[0], decimals: c[0] === "¥" ? 0 : 2 }); }];
      }).concat([[t("sheetsFmt_accounting"), function () { applySel({ format: "accounting", symbol: styleOf(sel.r, sel.c).symbol || defaultSymbol() }); }]]));
    }
    if (name === "comma") {
      const cur = styleOf(sel.r, sel.c);
      return applySel({ format: "number", sep: cur.format === "number" && cur.sep !== false ? false : true, decimals: cur.decimals != null ? cur.decimals : 2 });
    }
    if (name === "decMore" || name === "decLess") {
      const cur = styleOf(sel.r, sel.c);
      const d = (cur.decimals != null ? cur.decimals : cur.format === "yen" ? 0 : 2) + (name === "decMore" ? 1 : -1);
      const fmt = cur.format && cur.format !== "general" && cur.format !== "text" ? (cur.format === "yen" ? "currency" : cur.format) : "number";
      const patch = { decimals: Math.max(0, Math.min(10, d)), format: fmt };
      if (cur.format === "yen") patch.symbol = "¥";
      return applySel(patch);
    }
    if (name === "formatMenu") {
      const fmtSel = root.querySelector('[data-sel="format"]');
      if (fmtSel) {
        fmtSel.focus();
        try {
          fmtSel.showPicker();
        } catch (_err) {}
      } else dialogs.customFormat();
      return;
    }
    if (name === "condFormat") return dialogs.condFormat();
    if (name === "insertMenu") {
      return showMenuFrom(el, [
        [t("sheetsInsertRowAbove"), function () { run("insertRow"); }],
        [t("sheetsInsertRowBelow"), function () { run("insertRowBelow"); }],
        [t("sheetsInsertColLeft"), function () { run("insertCol"); }],
        [t("sheetsInsertColRight"), function () { run("insertColRight"); }],
        [t("sheetsAddSheet"), function () { run("addSheet"); }],
      ]);
    }
    if (name === "deleteMenu") {
      return showMenuFrom(el, [
        [t("sheetsDeleteRow"), function () { run("deleteRow"); }],
        [t("sheetsDeleteCol"), function () { run("deleteCol"); }],
        [t("sheetsDeleteSheet"), function () { showSheetMenuDelete(); }],
      ]);
    }
    if (name === "clearMenu") {
      return showMenuFrom(el, [
        [t("sheetsClearAll"), function () { clearRange("all"); }],
        [t("sheetsClearContents"), function () { clearRange("contents"); }],
        [t("sheetsClearFormats"), function () { clearRange("formats"); }],
        [t("sheetsClearNotes"), function () { clearRange("notes"); }],
        [t("sheetsCondClear"), function () { run("condClear"); }],
      ]);
    }
    if (name === "clearAll") return clearRange("all");
    if (name === "clearContents") return clearRange("contents");
    if (name === "clearFormats") return clearRange("formats");
    if (name === "clearNotes") return clearRange("notes");
    if (name === "condClear") {
      const keep = (active().condFormats || []).filter(function (rule) {
        return rule.r2 < sel.r1 || rule.r1 > sel.r2 || rule.c2 < sel.c1 || rule.c1 > sel.c2;
      });
      return api.setSheetProp(sid, "condFormats", keep);
    }
    if (name === "sortAsc") return quickSort(false);
    if (name === "sortDesc") return quickSort(true);
    if (name === "sortDialog") return dialogs.sort();
    if (name === "filterToggle") return toggleFilter();
    if (name === "filterClear") {
      const f = active().filter;
      if (f) applyFilter({ r1: f.r1, c1: f.c1, r2: f.r2, c2: f.c2, cols: {} });
      return;
    }
    if (name === "removeDup") return removeDuplicates();
    if (name === "textToCols") return dialogs.textToCols();
    if (name === "trimSpaces") return trimSpaces();
    if (name === "fillDown") return fillDirection(true);
    if (name === "fillRight") return fillDirection(false);
    if (name === "fillSeries") return dialogs.fillSeries();
    if (name === "find") return dialogs.find(false);
    if (name === "replace") return dialogs.find(true);
    if (name === "fx") return dialogs.fx();
    if (name.indexOf("fxCat_") === 0) return dialogs.fx(name.slice(6));
    if (name === "autosum") return autosum("SUM");
    if (name === "autosumMenu") {
      return showMenuFrom(el, ["SUM", "AVERAGE", "COUNT", "MAX", "MIN"].map(function (fn) {
        return [fn, function () { autosum(fn); }];
      }));
    }
    if (name === "names") return dialogs.names();
    if (name === "defineName") return dialogs.names(true);
    if (name === "showFormulas") {
      ui.showFormulas = !ui.showFormulas;
      saveUi();
      renderGrid();
      syncFormula();
      return;
    }
    if (name === "recalc") return recalc();
    if (name === "traceErrors") return traceErrors();
    if (name === "insertRow") return api.insertRows(sid, sel.r1, sel.r2 - sel.r1 + 1);
    if (name === "insertRowBelow") return api.insertRows(sid, sel.r2 + 1, sel.r2 - sel.r1 + 1);
    if (name === "deleteRow") return api.deleteRows(sid, sel.r1, sel.r2 - sel.r1 + 1);
    if (name === "insertCol") return api.insertCols(sid, sel.c1, sel.c2 - sel.c1 + 1);
    if (name === "insertColRight") return api.insertCols(sid, sel.c2 + 1, sel.c2 - sel.c1 + 1);
    if (name === "deleteCol") return api.deleteCols(sid, sel.c1, sel.c2 - sel.c1 + 1);
    if (name === "insertChart") return dialogs.chart(null);
    if (name === "insertNote") return dialogs.note();
    if (name === "insertDate") return insertDateTime(false);
    if (name === "insertTime") return insertDateTime(true);
    if (name === "insertCheck") {
      const cur = api.getValue(sid, sel.r, sel.c);
      api.beginBatch();
      for (let r = sel.r1; r <= sel.r2; r++) for (let c = sel.c1; c <= sel.c2; c++) api.setCell(sid, r, c, cur === true ? "FALSE" : "TRUE", true);
      api.endBatch();
      return;
    }
    if (name === "addSheet") {
      api.addSheet();
      setSel(0, 0);
      paint();
      return;
    }
    if (name === "sheetNext" || name === "sheetPrev") {
      const list = api.data.sheets;
      const idx = list.findIndex(function (s) {
        return s.id === sid;
      });
      const next = list[(idx + (name === "sheetNext" ? 1 : -1) + list.length) % list.length];
      if (next && next.id !== sid) selectSheet(next.id);
      return;
    }
    if (name === "freezeTop") return freeze(1, 0);
    if (name === "freezeFirstCol") return freeze(0, 1);
    if (name === "freezePanes") return freeze(sel.r1, sel.c1);
    if (name === "unfreeze") return freeze(0, 0);
    if (name === "gridlines") return api.setSheetProp(sid, "gridlines", active().gridlines === false);
    if (name === "zoomIn") return setZoom(ui.zoom + 0.1);
    if (name === "zoomOut") return setZoom(ui.zoom - 0.1);
    if (name === "zoomReset") return setZoom(1);
    if (name === "hideRows") return hideRange(true, true);
    if (name === "unhideRows") return hideRange(true, false);
    if (name === "hideCols") return hideRange(false, true);
    if (name === "unhideCols") return hideRange(false, false);
    if (name === "autofit") return autofitCols(sel.c1, sel.c2);
    if (name === "colWidth") {
      const v = window.prompt(t("sheetsColWidth"), String(colW(sel.c1) || DEF_W));
      if (v == null) return;
      const w = Number(v);
      if (!Number.isFinite(w)) return;
      for (let c = sel.c1; c <= sel.c2; c++) api.setColWidth(sid, c, w);
      return;
    }
    if (name === "rowHeight") {
      const v = window.prompt(t("sheetsRowHeight"), String(rowH(sel.r1) || DEF_H));
      if (v == null) return;
      const h = Number(v);
      if (!Number.isFinite(h)) return;
      for (let r = sel.r1; r <= sel.r2; r++) api.setRowHeight(sid, r, h);
      return;
    }
  }
  function showSheetMenuDelete() {
    if (api.data.sheets.length <= 1) return;
    if (!window.confirm(t("sheetsConfirmDeleteSheet", { name: active().name }))) return;
    api.deleteSheet(sheetId());
    setSel(0, 0);
    paint();
  }

  function copySel(cut) {
    const sid = sheetId();
    const block = api.copyRange(sid, sel.r1, sel.c1, sel.r2, sel.c2);
    clipboard = {
      block: block,
      merges: api.copyMerges(sid, sel.r1, sel.c1, sel.r2, sel.c2),
      cut: cut,
      sheetId: sid,
      marquee: { r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 },
      text: block
        .map(function (row, i) {
          return row
            .map(function (cell, j) {
              const v = api.display(sid, sel.r1 + i, sel.c1 + j);
              return String(v).replace(/\t/g, " ");
            })
            .join("\t");
        })
        .join("\n"),
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(clipboard.text).catch(function () {});
    if (cut) {
      clipboard.cutRange = { r1: sel.r1, c1: sel.c1, r2: sel.r2, c2: sel.c2 };
    }
    renderGrid();
  }
  async function paste(mode) {
    let block = clipboard && clipboard.block;
    let external = null;
    if (navigator.clipboard && navigator.clipboard.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && (!clipboard || text !== clipboard.text)) external = text;
      } catch (_err) {}
    }
    if (external != null) {
      block = external.replace(/\r/g, "").split("\n").map(function (line) {
        return line.split("\t").map(function (raw) {
          return { raw: raw, style: {} };
        });
      });
      if (block.length > 1 && block[block.length - 1].length === 1 && block[block.length - 1][0].raw === "") block.pop();
      clipboard = { block: block, text: external, merges: [], cut: false };
    }
    if (!block || !block.length) return;
    const sid = sheetId();
    if (mode === "transpose") {
      const out = [];
      for (let j = 0; j < block[0].length; j++) {
        const row = [];
        for (let i = 0; i < block.length; i++) row.push(block[i][j] || { raw: "", style: {} });
        out.push(row);
      }
      block = out;
    }
    if (mode === "values") {
      const src = clipboard.marquee;
      block = block.map(function (row, i) {
        return row.map(function (cell, j) {
          let raw = cell.raw;
          if (String(raw).charAt(0) === "=" && src && clipboard.sheetId) {
            const v = api.getValue(clipboard.sheetId, src.r1 + i, src.c1 + j);
            raw = E.isErr(v) ? "" : v == null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
          }
          return { raw: raw, style: {} };
        });
      });
      api.beginBatch();
      for (let i = 0; i < block.length; i++) for (let j = 0; j < block[i].length; j++) api.setCell(sid, sel.r + i, sel.c + j, block[i][j].raw, true);
      api.endBatch();
      return;
    }
    if (mode === "formats") {
      api.beginBatch();
      for (let i = 0; i < block.length; i++) for (let j = 0; j < block[i].length; j++) {
        const cur = api.getStyle(sid, sel.r + i, sel.c + j) || {};
        const patch = {};
        Object.keys(cur).forEach(function (k) { if (k !== "note") patch[k] = ""; });
        Object.assign(patch, block[i][j].style || {});
        delete patch.note;
        api.setStyle(sid, sel.r + i, sel.c + j, patch, true);
      }
      api.endBatch();
      return;
    }
    let targetRows = block.length;
    let targetCols = block[0].length;
    const selH = sel.r2 - sel.r1 + 1;
    const selW = sel.c2 - sel.c1 + 1;
    const repeat = (selH > 1 || selW > 1) && selH % targetRows === 0 && selW % targetCols === 0 && block.length * block[0].length < 10000;
    api.beginBatch();
    if (repeat) {
      for (let i = 0; i < selH; i += targetRows) for (let j = 0; j < selW; j += targetCols) api.pasteRange(sid, sel.r1 + i, sel.c1 + j, block, false, clipboard && clipboard.merges);
    } else api.pasteRange(sid, sel.r, sel.c, block, false, mode === "transpose" ? [] : clipboard && clipboard.merges);
    if (clipboard && clipboard.cut && clipboard.cutRange) {
      const cr = clipboard.cutRange;
      api.clearRange(clipboard.sheetId, cr.r1, cr.c1, cr.r2, cr.c2);
      clipboard.cut = false;
      clipboard.cutRange = null;
      clipboard.marquee = null;
    }
    api.endBatch();
    if (!repeat) setSel(sel.r, sel.c, sel.r + targetRows - 1, sel.c + targetCols - 1);
    renderGrid();
    syncFormula();
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
      } else if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt") || file.type.indexOf("csv") >= 0) {
        const text = await file.text();
        api = E.importCsv(text);
        api.setName(file.name.replace(/\.(csv|tsv|txt)$/i, ""));
      } else {
        const buf = await file.arrayBuffer();
        api = E.importXlsx(buf);
        api.setName(file.name.replace(/\.xlsx?$/i, ""));
      }
      resetView();
      fsFileId = null;
      hookWorkbook();
      await persistNow();
      paint();
    } catch (_err) {
      setStatus(t("sheetsImportFail"));
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
  function exportAs(kind) {
    try {
      if (kind === "csv") download((api.data.name || "sheet") + ".csv", new Blob(["﻿" + E.exportCsv(api, sheetId())], { type: "text/csv" }));
      else if (kind === "xlsx") download((api.data.name || "sheet") + ".xlsx", new Blob([E.exportXlsx(api)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      else download(ensureVcsh(api.data.name), vcshBlob());
      setStatus(t("sheetsExported"));
    } catch (_err) {
      setStatus(t("sheetsExportFail"));
    }
  }
  function showExport(el) {
    showMenuFrom(el || root.querySelector('[data-act="fileExport"]'), [
      ["CSV", function () { exportAs("csv"); }],
      ["Excel (.xlsx)", function () { exportAs("xlsx"); }],
      ["Sheets (.vcsh)", function () { exportAs("vcsh"); }],
    ]);
  }
  function printSheet() {
    const sid = sheetId();
    const used = api.usedRange(sid);
    let html = "<table>";
    for (let r = 0; r <= used.r; r++) {
      if (rowH(r) === 0) continue;
      html += "<tr>";
      for (let c = 0; c <= used.c; c++) {
        if (colW(c) === 0) continue;
        const stl = api.getStyle(sid, r, c) || {};
        const css = [];
        if (stl.bold) css.push("font-weight:700");
        if (stl.align) css.push("text-align:" + stl.align);
        if (stl.fill) css.push("background:" + stl.fill);
        if (stl.color) css.push("color:" + stl.color);
        html += '<td style="' + css.join(";") + '">' + escapeHtml(api.display(sid, r, c)) + "</td>";
      }
      html += "</tr>";
    }
    html += "</table>";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write("<!doctype html><html><head><title>" + escapeHtml(api.data.name + " - " + active().name) + "</title><style>body{font:12px Segoe UI,sans-serif;margin:16px}table{border-collapse:collapse}td{border:1px solid #bbb;padding:2px 6px;white-space:nowrap}</style></head><body>" + html + "</body></html>");
    w.document.close();
    setTimeout(function () {
      w.print();
    }, 200);
  }
  function overlay(html) {
    closeMenu();
    const el = document.createElement("div");
    el.className = "sheets-overlay";
    el.innerHTML = '<div class="sheets-modal">' + html + "</div>";
    root.querySelector(".sheets-shell").appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el || e.target.classList.contains("sheets-close-modal")) el.remove();
    });
    const first = el.querySelector("input,select,textarea,button");
    if (first) first.focus();
    return el;
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
    let rows = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = await fs.pathOf(file.parentId || fs.ROOT_ID);
      rows += '<button type="button" class="sheets-fx-item" data-id="' + escapeHtml(file.id) + '"><strong>' + escapeHtml(file.name) + "</strong><span>" + escapeHtml(path) + "</span></button>";
    }
    if (!rows) rows = "<p>" + escapeHtml(t("sheetsNoBooks")) + "</p>";
    const el = overlay(
      "<h2>" +
        escapeHtml(t("sheetsOpen")) +
        "</h2>" +
        '<div class="sheets-fx-list sheets-picker-list">' +
        rows +
        "</div>" +
        '<div class="sheets-modal-actions"><button type="button" class="sheets-close-modal">' +
        escapeHtml(t("sheetsClose")) +
        "</button></div>"
    );
    el.querySelectorAll("[data-id]").forEach(function (b) {
      b.addEventListener("click", function () {
        el.remove();
        openFsFile(b.getAttribute("data-id"));
      });
    });
  }
  async function showSaveAs() {
    closeMenu();
    commitEdit();
    const fs = osfs();
    if (!fs) {
      download(ensureVcsh(api.data.name), vcshBlob());
      setStatus(t("sheetsSaved"));
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
    for (let i = 0; i < folders.length; i++) withPath.push({ folder: folders[i], path: await fs.pathOf(folders[i].id) });
    withPath.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { sensitivity: "base" });
    });
    const el = overlay(
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
        "</button></div>"
    );
    const listEl = el.querySelector(".sheets-picker-list");
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
        listEl.querySelectorAll(".sheets-picker-item").forEach(function (x) {
          x.classList.toggle("active", x.dataset.id === selectedId);
        });
      });
      listEl.appendChild(b);
    });
    const nameInput = el.querySelector(".sheets-save-name");
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      const name = nameInput.value.trim() || api.data.name;
      el.remove();
      saveAsTo(selectedId, name)
        .then(function () {
          setStatus(t("sheetsSaved"));
          if (root) paintLive();
        })
        .catch(function () {
          setStatus(t("sheetsExportFail"));
        });
    });
    nameInput.focus();
    nameInput.select();
  }

  function paletteHtml(current) {
    return (
      '<div class="sheets-palette-grid">' +
      PALETTE.map(function (color) {
        return '<button type="button" class="sheets-swatch-btn' + (current === color ? " on" : "") + '" data-color="' + color + '" style="background:' + color + '" title="' + color + '"></button>';
      }).join("") +
      "</div>" +
      '<label class="sheets-palette-custom">' +
      escapeHtml(t("sheetsCustomColor")) +
      ' <input type="color" value="' +
      (current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#008f7d") +
      '"></label>'
    );
  }
  function showPalette(kind, anchor) {
    closeMenu();
    const host = root.querySelector(".sheets-shell");
    anchor = anchor || root.querySelector('[data-act="' + (kind === "fill" ? "fillColor" : "fontColor") + '"]');
    if (!host || !anchor) return;
    menu = document.createElement("div");
    menu.className = "sheets-menu sheets-palette";
    menu.innerHTML = paletteHtml(styleOf(sel.r, sel.c)[kind] || "") + '<button type="button" class="sheets-palette-clear">' + escapeHtml(kind === "fill" ? t("sheetsNoFill") : t("sheetsAutoColor")) + "</button>";
    menu.addEventListener("click", function (e) {
      const sw = e.target.closest("[data-color]");
      if (sw) {
        closeMenu();
        const patch = {};
        patch[kind] = sw.getAttribute("data-color");
        applySel(patch);
        return;
      }
      if (e.target.closest(".sheets-palette-clear")) {
        closeMenu();
        const patch = {};
        patch[kind] = "";
        applySel(patch);
      }
    });
    menu.querySelector('input[type="color"]').addEventListener("change", function (e) {
      const patch = {};
      patch[kind] = e.target.value;
      applySel(patch);
      closeMenu();
    });
    host.appendChild(menu);
    positionMenu(anchor.getBoundingClientRect().left, anchor.getBoundingClientRect().bottom + 4);
    setTimeout(function () {
      document.addEventListener("mousedown", onDoc, true);
    }, 0);
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
    const list = api.data.sheets;
    const idx = list.findIndex(function (s) {
      return s.id === id;
    });
    showMenu(x, y, [
      [t("sheetsRename"), function () { renameSheet(id); }],
      [t("sheetsDuplicate"), function () { api.duplicateSheet(id); setSel(0, 0); paint(); }],
      [t("sheetsDeleteSheet"), function () {
        if (list.length <= 1) return;
        const sh = api.sheetById(id);
        if (!window.confirm(t("sheetsConfirmDeleteSheet", { name: sh ? sh.name : "" }))) return;
        api.deleteSheet(id);
        setSel(0, 0);
        paint();
      }],
      null,
      [t("sheetsMoveLeft"), function () { if (idx > 0) { api.moveSheet(id, idx - 1); paint(); } }],
      [t("sheetsMoveRight"), function () { if (idx < list.length - 1) { api.moveSheet(id, idx + 1); paint(); } }],
      null,
      [t("sheetsTabColor"), function () { showTabColor(id, x, y); }],
      [t("sheetsAddSheet"), function () { run("addSheet"); }],
    ]);
  }
  function showTabColor(id, x, y) {
    closeMenu();
    const host = root.querySelector(".sheets-shell");
    const sh = api.sheetById(id);
    menu = document.createElement("div");
    menu.className = "sheets-menu sheets-palette";
    menu.innerHTML = paletteHtml(sh.tabColor || "") + '<button type="button" class="sheets-palette-clear">' + escapeHtml(t("sheetsNoFill")) + "</button>";
    menu.addEventListener("click", function (e) {
      const sw = e.target.closest("[data-color]");
      if (sw) {
        closeMenu();
        api.setSheetProp(id, "tabColor", sw.getAttribute("data-color"));
      } else if (e.target.closest(".sheets-palette-clear")) {
        closeMenu();
        api.setSheetProp(id, "tabColor", "");
      }
    });
    menu.querySelector('input[type="color"]').addEventListener("change", function (e) {
      api.setSheetProp(id, "tabColor", e.target.value);
      closeMenu();
    });
    host.appendChild(menu);
    positionMenu(x, y);
    setTimeout(function () {
      document.addEventListener("mousedown", onDoc, true);
    }, 0);
  }

  function showMenuFrom(el, items, html) {
    if (!el) el = root.querySelector(".sheets-ribbon");
    const r = el.getBoundingClientRect();
    showMenu(r.left, r.bottom + 2, items, html);
  }
  function showMenu(clientX, clientY, items, html) {
    closeMenu();
    const host = root.querySelector(".sheets-shell");
    if (!host) return;
    menu = document.createElement("div");
    menu.className = "sheets-menu";
    items.forEach(function (item) {
      if (!item) {
        const sep = document.createElement("div");
        sep.className = "sheets-menu-sep";
        menu.appendChild(sep);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      if (item[2] || html) b.innerHTML = item[0];
      else b.textContent = item[0];
      if (item[3]) b.classList.add("on");
      b.addEventListener("click", function () {
        closeMenu();
        item[1]();
      });
      menu.appendChild(b);
    });
    host.appendChild(menu);
    positionMenu(clientX, clientY);
    setTimeout(function () {
      document.addEventListener("mousedown", onDoc, true);
    }, 0);
  }
  function positionMenu(clientX, clientY) {
    const host = root.querySelector(".sheets-shell");
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
  }
  function onDoc(e) {
    if (menu && !menu.contains(e.target)) closeMenu();
  }
  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
    document.removeEventListener("mousedown", onDoc, true);
  }

  const S = {
    get api() {
      return api;
    },
    get sel() {
      return sel;
    },
    get root() {
      return root;
    },
    get editing() {
      return editing;
    },
    E: E,
    I: I,
    t: t,
    lang: lang,
    escapeHtml: escapeHtml,
    sheetId: sheetId,
    active: active,
    setSel: setSel,
    snapSel: snapSel,
    afterSel: afterSel,
    renderGrid: renderGrid,
    paint: paint,
    paintLive: paintLive,
    syncFormula: syncFormula,
    setStatus: setStatus,
    showMenu: showMenu,
    showMenuFrom: showMenuFrom,
    closeMenu: closeMenu,
    positionMenu: positionMenu,
    overlay: overlay,
    startEdit: startEdit,
    commitEdit: commitEdit,
    applySel: applySel,
    a1Sel: a1Sel,
    workRange: workRange,
    looksLikeHeader: looksLikeHeader,
    sortRange: sortRange,
    applyFilter: applyFilter,
    styleOf: styleOf,
    colX: colX,
    rowY: rowY,
    colW: colW,
    rowH: rowH,
    PALETTE: PALETTE,
    paletteHtml: paletteHtml,
    setMenu: function (m) {
      closeMenu();
      menu = m;
      setTimeout(function () {
        document.addEventListener("mousedown", onDoc, true);
      }, 0);
    },
  };
  if (window.OSSheetsDialogs) dialogs = window.OSSheetsDialogs(S);

  return { mount: mount, remountOpen: remountOpen, openFile: openFsFile };
})();
