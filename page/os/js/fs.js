window.OSFS = (function () {
  const ROOT_ID = "root";
  const DESKTOP_ID = "desktop";
  const DOCUMENTS_ID = "documents";
  const SHEETS_DIR_ID = "documents-sheets";
  const SHEETS_EXTS = ["vcsh", "xlsx", "xls", "csv"];
  const TEXT_MAX = 2 * 1024 * 1024;
  const MIME_BY_EXT = {
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    json: "application/json",
    js: "text/javascript",
    mjs: "text/javascript",
    cjs: "text/javascript",
    ts: "text/plain",
    tsx: "text/plain",
    jsx: "text/plain",
    css: "text/css",
    html: "text/html",
    htm: "text/html",
    xml: "application/xml",
    csv: "text/csv",
    vcsh: "application/vnd.vc.sheets+json",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    tsv: "text/tab-separated-values",
    log: "text/plain",
    ini: "text/plain",
    yaml: "text/yaml",
    yml: "text/yaml",
    py: "text/plain",
    rb: "text/plain",
    go: "text/plain",
    rs: "text/plain",
    java: "text/plain",
    c: "text/plain",
    h: "text/plain",
    cpp: "text/plain",
    hpp: "text/plain",
    sh: "text/plain",
    bat: "text/plain",
    sql: "text/plain",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    avif: "image/avif",
    ico: "image/x-icon",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    aac: "audio/aac",
    flac: "audio/flac",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    pdf: "application/pdf",
  };

  let readyPromise = null;
  let clipboard = null;
  const listeners = new Set();

  function nodesStore() {
    return window.OSState.FS_NODES;
  }
  function blobsStore() {
    return window.OSState.FS_BLOBS;
  }

  function now() {
    return Date.now();
  }

  function extOf(name) {
    const i = String(name || "").lastIndexOf(".");
    if (i <= 0) return "";
    return name.slice(i + 1).toLowerCase();
  }

  function mimeOf(name, fallback) {
    if (fallback && fallback !== "application/octet-stream") return fallback;
    return MIME_BY_EXT[extOf(name)] || fallback || "application/octet-stream";
  }

  function isSystem(node) {
    return !!(
      node &&
      (node.system ||
        node.id === ROOT_ID ||
        node.id === DESKTOP_ID ||
        node.id === DOCUMENTS_ID ||
        node.id === SHEETS_DIR_ID)
    );
  }

  function emit(detail) {
    listeners.forEach((fn) => {
      try {
        fn(detail);
      } catch (_err) {}
    });
    document.dispatchEvent(new CustomEvent("os-fs-change", { detail: detail || {} }));
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function tx(mode, stores) {
    return window.OSState.openDb().then((db) => db.transaction(stores, mode));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function waitTx(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("aborted"));
    });
  }

  function folderNode(id, parentId, name, system) {
    const t = now();
    return {
      id,
      parentId,
      name,
      kind: "folder",
      mime: "",
      size: 0,
      createdAt: t,
      modifiedAt: t,
      system: !!system,
    };
  }

  async function seed() {
    const db = await window.OSState.openDb();
    const readTx = db.transaction([nodesStore()], "readonly");
    const all = (await reqToPromise(readTx.objectStore(nodesStore()).getAll())) || [];
    const byId = new Map(all.map((n) => [n.id, n]));
    function kidsOf(parentId) {
      return all.filter((n) => n.parentId === parentId);
    }
    const write = db.transaction([nodesStore()], "readwrite");
    const store = write.objectStore(nodesStore());
    function ensure(id, parentId, name) {
      const existing = byId.get(id);
      if (existing) {
        const next = Object.assign({}, existing, {
          kind: "folder",
          system: true,
          parentId,
          name,
        });
        store.put(next);
        byId.set(id, next);
        return next;
      }
      const named = kidsOf(parentId).find(
        (n) => n.kind === "folder" && String(n.name || "").toLowerCase() === name.toLowerCase()
      );
      if (named) {
        const next = Object.assign({}, named, { system: true, name, kind: "folder" });
        store.put(next);
        byId.set(named.id, next);
        return next;
      }
      const node = folderNode(id, parentId, name, true);
      store.put(node);
      byId.set(id, node);
      all.push(node);
      return node;
    }
    ensure(ROOT_ID, null, "");
    ensure(DESKTOP_ID, ROOT_ID, "Desktop");
    const docs = ensure(DOCUMENTS_ID, ROOT_ID, "Documents");
    ensure(SHEETS_DIR_ID, docs.id, "Sheets");
    await waitTx(write);
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = seed().catch((err) => {
        readyPromise = null;
        throw err;
      });
    }
    return readyPromise;
  }

  async function get(id) {
    await ready();
    const db = await window.OSState.openDb();
    const store = db.transaction(nodesStore(), "readonly").objectStore(nodesStore());
    return reqToPromise(store.get(id));
  }

  async function list(parentId) {
    await ready();
    const db = await window.OSState.openDb();
    const store = db.transaction(nodesStore(), "readonly").objectStore(nodesStore());
    let rows = [];
    try {
      rows = (await reqToPromise(store.index("parentId").getAll(parentId))) || [];
    } catch (_err) {
      rows = ((await reqToPromise(store.getAll())) || []).filter((n) => n.parentId === parentId);
    }
    return rows.slice().sort(compareNodes);
  }

  async function listFolders() {
    await ready();
    const db = await window.OSState.openDb();
    const store = db.transaction(nodesStore(), "readonly").objectStore(nodesStore());
    try {
      return (await reqToPromise(store.index("kind").getAll("folder"))) || [];
    } catch (_err) {
      return ((await reqToPromise(store.getAll())) || []).filter((n) => n.kind === "folder");
    }
  }

  function compareNodes(a, b) {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
  }

  async function pathOf(id) {
    if (!id || id === ROOT_ID) return "/";
    const parts = [];
    let cur = await get(id);
    const guard = new Set();
    while (cur && cur.id !== ROOT_ID) {
      if (guard.has(cur.id)) break;
      guard.add(cur.id);
      if (cur.name) parts.unshift(cur.name);
      if (!cur.parentId) break;
      cur = await get(cur.parentId);
    }
    return "/" + parts.join("/");
  }

  async function nodeAtPath(path) {
    await ready();
    const clean = String(path || "/")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);
    let cur = await get(ROOT_ID);
    for (const part of clean) {
      const kids = await list(cur.id);
      const next = kids.find((n) => n.name.toLowerCase() === part.toLowerCase());
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  async function uniqueName(parentId, name) {
    const kids = await list(parentId);
    const taken = new Set(kids.map((n) => n.name.toLowerCase()));
    if (!taken.has(String(name).toLowerCase())) return name;
    const i = name.lastIndexOf(".");
    const hasExt = i > 0 && name.slice(i + 1).indexOf(" ") === -1;
    const base = hasExt ? name.slice(0, i) : name;
    const ext = hasExt ? name.slice(i) : "";
    let n = 2;
    let next = `${base} (${n})${ext}`;
    while (taken.has(next.toLowerCase())) {
      n += 1;
      next = `${base} (${n})${ext}`;
    }
    return next;
  }

  async function createFolder(parentId, name) {
    await ready();
    const parent = await get(parentId);
    if (!parent || parent.kind !== "folder") throw new Error("invalid parent");
    const label = (name || "").trim() || "New folder";
    const node = folderNode(crypto.randomUUID(), parentId, await uniqueName(parentId, label), false);
    parent.modifiedAt = now();
    const db = await window.OSState.openDb();
    const transaction = db.transaction(nodesStore(), "readwrite");
    const store = transaction.objectStore(nodesStore());
    store.put(node);
    store.put(parent);
    await waitTx(transaction);
    emit({ type: "create", id: node.id, parentId });
    return node;
  }

  async function createFile(parentId, spec) {
    await ready();
    const parent = await get(parentId);
    if (!parent || parent.kind !== "folder") throw new Error("invalid parent");
    const fileName = await uniqueName(parentId, spec.name || "New file.txt");
    const blob = spec.blob instanceof Blob ? spec.blob : new Blob([spec.blob || ""], { type: spec.mime || "text/plain" });
    const id = crypto.randomUUID();
    const t = now();
    const node = {
      id,
      parentId,
      name: fileName,
      kind: "file",
      mime: mimeOf(fileName, spec.mime || blob.type),
      size: blob.size,
      createdAt: t,
      modifiedAt: t,
    };
    const db = await window.OSState.openDb();
    const transaction = db.transaction([nodesStore(), blobsStore()], "readwrite");
    const nodes = transaction.objectStore(nodesStore());
    nodes.put(node);
    transaction.objectStore(blobsStore()).put({ id, blob });
    parent.modifiedAt = t;
    nodes.put(parent);
    await waitTx(transaction);
    emit({ type: "create", id, parentId });
    return node;
  }

  function createTextFile(parentId, name) {
    const label = (name || "New Text Document.txt").trim();
    const blob = new Blob([""], { type: "text/plain" });
    return createFile(parentId, { name: label, mime: "text/plain", blob });
  }

  async function writeFile(id, blob, spec) {
    await ready();
    const node = await get(id);
    if (!node || node.kind !== "file") throw new Error("missing");
    const nextBlob =
      blob instanceof Blob
        ? blob
        : new Blob([blob || ""], { type: (spec && spec.mime) || node.mime || "application/octet-stream" });
    const t = now();
    node.size = nextBlob.size;
    node.modifiedAt = t;
    if (spec && spec.mime) node.mime = spec.mime;
    if (spec && spec.name && spec.name !== node.name) {
      node.name = await uniqueName(node.parentId, spec.name);
      node.mime = mimeOf(node.name, node.mime);
    }
    const parent = node.parentId ? await get(node.parentId) : null;
    const db = await window.OSState.openDb();
    const transaction = db.transaction([nodesStore(), blobsStore()], "readwrite");
    const nodes = transaction.objectStore(nodesStore());
    nodes.put(node);
    transaction.objectStore(blobsStore()).put({ id, blob: nextBlob });
    if (parent) {
      parent.modifiedAt = t;
      nodes.put(parent);
    }
    await waitTx(transaction);
    emit({ type: "write", id, parentId: node.parentId });
    return node;
  }

  async function allNodes() {
    await ready();
    const db = await window.OSState.openDb();
    const store = db.transaction(nodesStore(), "readonly").objectStore(nodesStore());
    return (await reqToPromise(store.getAll())) || [];
  }

  async function listFilesByExt(exts) {
    const set = new Set((exts || []).map((e) => String(e).replace(/^\./, "").toLowerCase()));
    const nodes = await allNodes();
    return nodes.filter((n) => n.kind === "file" && set.has(extOf(n.name)));
  }

  async function ensureSheetsFolder() {
    await ready();
    let sheets = await get(SHEETS_DIR_ID);
    if (sheets && sheets.kind === "folder") return sheets;
    const byPath = await nodeAtPath("/Documents/Sheets");
    if (byPath && byPath.kind === "folder") return byPath;
    let docs = await get(DOCUMENTS_ID);
    if (!docs || docs.kind !== "folder") docs = await nodeAtPath("/Documents");
    if (!docs || docs.kind !== "folder") docs = await createFolder(ROOT_ID, "Documents");
    const kids = await list(docs.id);
    const named = kids.find((n) => n.kind === "folder" && n.name.toLowerCase() === "sheets");
    if (named) return named;
    return createFolder(docs.id, "Sheets");
  }

  async function rename(id, name) {
    const node = await get(id);
    if (!node) throw new Error("missing");
    if (isSystem(node)) throw new Error("system");
    const next = (name || "").trim();
    if (!next || next === node.name) return node;
    const unique = await uniqueName(node.parentId, next);
    node.name = unique;
    node.modifiedAt = now();
    if (node.kind === "file") node.mime = mimeOf(unique, node.mime);
    const db = await window.OSState.openDb();
    const transaction = db.transaction(nodesStore(), "readwrite");
    transaction.objectStore(nodesStore()).put(node);
    await waitTx(transaction);
    emit({ type: "rename", id, parentId: node.parentId });
    return node;
  }

  async function collectTree(id) {
    const node = await get(id);
    if (!node) return [];
    const out = [node];
    if (node.kind === "folder") {
      const kids = await list(id);
      for (const kid of kids) {
        out.push(...(await collectTree(kid.id)));
      }
    }
    return out;
  }

  async function isDescendant(id, maybeAncestorId) {
    let cur = await get(id);
    const guard = new Set();
    while (cur) {
      if (cur.id === maybeAncestorId) return true;
      if (!cur.parentId || guard.has(cur.id)) return false;
      guard.add(cur.id);
      cur = await get(cur.parentId);
    }
    return false;
  }

  async function remove(id) {
    const node = await get(id);
    if (!node) return;
    if (isSystem(node)) throw new Error("system");
    const tree = await collectTree(id);
    const parent = node.parentId ? await get(node.parentId) : null;
    const db = await window.OSState.openDb();
    const transaction = db.transaction([nodesStore(), blobsStore()], "readwrite");
    const nodes = transaction.objectStore(nodesStore());
    const blobs = transaction.objectStore(blobsStore());
    tree.forEach((n) => {
      nodes.delete(n.id);
      if (n.kind === "file") blobs.delete(n.id);
    });
    if (parent) {
      parent.modifiedAt = now();
      nodes.put(parent);
    }
    await waitTx(transaction);
    emit({ type: "remove", id, parentId: node.parentId });
  }

  async function move(ids, destParentId) {
    const dest = await get(destParentId);
    if (!dest || dest.kind !== "folder") throw new Error("invalid dest");
    for (const id of ids) {
      const node = await get(id);
      if (!node || isSystem(node)) continue;
      if (node.parentId === destParentId) continue;
      if (node.kind === "folder" && (node.id === destParentId || (await isDescendant(destParentId, node.id)))) {
        continue;
      }
      node.parentId = destParentId;
      node.name = await uniqueName(destParentId, node.name);
      node.modifiedAt = now();
      const db = await window.OSState.openDb();
      const transaction = db.transaction(nodesStore(), "readwrite");
      transaction.objectStore(nodesStore()).put(node);
      await waitTx(transaction);
    }
    emit({ type: "move", ids, parentId: destParentId });
  }

  async function copyOne(node, destParentId, idMap) {
    const newId = crypto.randomUUID();
    idMap.set(node.id, newId);
    const name = await uniqueName(destParentId, node.name);
    const t = now();
    const copy = Object.assign({}, node, {
      id: newId,
      parentId: destParentId,
      name,
      createdAt: t,
      modifiedAt: t,
      system: false,
    });
    const blob = copy.kind === "file" ? await getBlob(node.id) : null;
    const db = await window.OSState.openDb();
    const stores = copy.kind === "file" ? [nodesStore(), blobsStore()] : [nodesStore()];
    const transaction = db.transaction(stores, "readwrite");
    transaction.objectStore(nodesStore()).put(copy);
    if (copy.kind === "file" && blob) transaction.objectStore(blobsStore()).put({ id: newId, blob });
    await waitTx(transaction);
    if (node.kind === "folder") {
      const kids = await list(node.id);
      for (const kid of kids) await copyOne(kid, newId, idMap);
    }
    return copy;
  }

  async function copy(ids, destParentId) {
    const dest = await get(destParentId);
    if (!dest || dest.kind !== "folder") throw new Error("invalid dest");
    const created = [];
    for (const id of ids) {
      const node = await get(id);
      if (!node || isSystem(node)) continue;
      if (node.kind === "folder" && (node.id === destParentId || (await isDescendant(destParentId, node.id)))) {
        continue;
      }
      created.push(await copyOne(node, destParentId, new Map()));
    }
    emit({ type: "copy", ids, parentId: destParentId });
    return created;
  }

  async function getBlob(id) {
    await ready();
    const db = await window.OSState.openDb();
    const store = db.transaction(blobsStore(), "readonly").objectStore(blobsStore());
    const row = await reqToPromise(store.get(id));
    return row ? row.blob : null;
  }

  async function download(id) {
    const node = await get(id);
    if (!node || node.kind !== "file") return;
    const blob = await getBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = node.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function readText(id) {
    const blob = await getBlob(id);
    if (!blob) return "";
    return blob.text();
  }

  async function ensureFolderPath(parentId, parts) {
    let cur = parentId;
    for (const part of parts) {
      if (!part) continue;
      const kids = await list(cur);
      let folder = kids.find((n) => n.kind === "folder" && n.name.toLowerCase() === part.toLowerCase());
      if (!folder) folder = await createFolder(cur, part);
      cur = folder.id;
    }
    return cur;
  }

  async function importFiles(parentId, files) {
    const listFiles = Array.from(files || []);
    for (const file of listFiles) {
      const rel = String(file.webkitRelativePath || "").replace(/\\/g, "/");
      const parts = rel.split("/").filter(Boolean);
      if (parts.length > 1) parts.pop();
      const dest = parts.length ? await ensureFolderPath(parentId, parts) : parentId;
      await createFile(dest, { name: file.name, mime: file.type, blob: file });
    }
  }

  function readEntryFile(fileEntry) {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  }

  function readDirEntries(dirReader) {
    return new Promise((resolve, reject) => {
      const all = [];
      function readBatch() {
        dirReader.readEntries((batch) => {
          if (!batch.length) {
            resolve(all);
            return;
          }
          all.push(...batch);
          readBatch();
        }, reject);
      }
      readBatch();
    });
  }

  async function importEntry(parentId, entry) {
    if (!entry) return;
    if (entry.isFile) {
      const file = await readEntryFile(entry);
      await createFile(parentId, { name: file.name, mime: file.type, blob: file });
      return;
    }
    if (entry.isDirectory) {
      const kidsExisting = await list(parentId);
      let folder = kidsExisting.find((n) => n.kind === "folder" && n.name.toLowerCase() === entry.name.toLowerCase());
      if (!folder) folder = await createFolder(parentId, entry.name);
      const kids = await readDirEntries(entry.createReader());
      for (const kid of kids) await importEntry(folder.id, kid);
    }
  }

  async function importDataTransfer(parentId, dataTransfer) {
    const items = dataTransfer && dataTransfer.items ? Array.from(dataTransfer.items) : [];
    const entries = items
      .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
      .filter(Boolean);
    if (entries.length) {
      for (const entry of entries) await importEntry(parentId, entry);
      return;
    }
    if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
      await importFiles(parentId, dataTransfer.files);
    }
  }

  function setClipboard(mode, ids) {
    clipboard = { mode: mode === "cut" ? "cut" : "copy", ids: (ids || []).slice() };
  }

  function getClipboard() {
    return clipboard ? { mode: clipboard.mode, ids: clipboard.ids.slice() } : null;
  }

  async function paste(parentId) {
    if (!clipboard || !clipboard.ids.length) return [];
    if (clipboard.mode === "cut") {
      await move(clipboard.ids, parentId);
      const ids = clipboard.ids.slice();
      clipboard = null;
      return ids;
    }
    const created = await copy(clipboard.ids, parentId);
    return created.map((n) => n.id);
  }

  function isTextNode(node) {
    if (!node || node.kind !== "file") return false;
    const mime = node.mime || "";
    if (mime.startsWith("text/")) return true;
    if (["application/json", "application/xml", "application/javascript"].includes(mime)) return true;
    return ["txt", "md", "json", "js", "css", "html", "htm", "xml", "tsv", "log", "ini", "yaml", "yml", "py", "ts", "tsx", "jsx", "sh", "sql"].includes(extOf(node.name));
  }

  function isImageNode(node) {
    return !!(node && node.kind === "file" && ((node.mime || "").startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"].includes(extOf(node.name))));
  }

  function isAudioNode(node) {
    return !!(node && node.kind === "file" && ((node.mime || "").startsWith("audio/") || ["mp3", "wav", "ogg", "oga", "aac", "flac", "m4a"].includes(extOf(node.name))));
  }

  function isVideoNode(node) {
    return !!(node && node.kind === "file" && ((node.mime || "").startsWith("video/") || ["mp4", "webm", "ogv", "mov"].includes(extOf(node.name))));
  }

  function isPdfNode(node) {
    return !!(node && node.kind === "file" && (node.mime === "application/pdf" || extOf(node.name) === "pdf"));
  }

  function isSheetsNode(node) {
    if (!node || node.kind !== "file") return false;
    const ext = extOf(node.name);
    if (SHEETS_EXTS.includes(ext)) return true;
    const mime = node.mime || "";
    return (
      mime === "application/vnd.vc.sheets+json" ||
      mime === "application/vnd.ms-excel" ||
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "text/csv"
    );
  }

  function openKind(node) {
    if (!node) return "none";
    if (node.kind === "folder") return "folder";
    if (isSheetsNode(node)) return "sheets";
    if (isImageNode(node)) return "image";
    if (isAudioNode(node)) return "audio";
    if (isVideoNode(node)) return "video";
    if (isPdfNode(node)) return "pdf";
    if (isTextNode(node)) return "text";
    return "download";
  }

  function formatSize(n) {
    const v = Number(n) || 0;
    if (v < 1024) return v + " B";
    if (v < 1024 * 1024) return (v / 1024).toFixed(v < 10 * 1024 ? 1 : 0) + " KB";
    if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + " MB";
    return (v / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function typeLabel(node, t) {
    if (!node) return "";
    if (node.kind === "folder") return t ? t("feFolder") : "Folder";
    if (node.kind === "shortcut") return t ? t("feShortcut") : "Shortcut";
    const kind = openKind(node);
    if (kind === "image") return t ? t("feImage") : "Image";
    if (kind === "audio") return t ? t("feAudio") : "Audio";
    if (kind === "video") return t ? t("feVideo") : "Video";
    if (kind === "pdf") return t ? t("fePdf") : "PDF";
    if (kind === "sheets") return t ? t("feSpreadsheet") : "Spreadsheet";
    if (kind === "text") return t ? t("feText") : "Text";
    return t ? t("feFile") : "File";
  }

  function glyph(kind) {
    if (kind === "folder") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="14" width="32" height="20" rx="3" fill="#e6c35c"/><path d="M4 16V12c0-1.2 1-2 2.2-2h9.2L18 14h16.8c1.2 0 2.2.8 2.2 2" fill="#f0d78a"/><rect x="4" y="16" width="32" height="18" rx="3" fill="#d4b24a"/></svg>`;
    }
    if (kind === "shortcut") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="8" width="24" height="24" rx="5" fill="#008f7d"/><path d="M16 20h8M20 16v8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
    }
    if (kind === "image") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="8" width="28" height="24" rx="3" fill="#3aa89a"/><circle cx="14" cy="16" r="3" fill="#fff"/><path d="M6 26l8-7 6 5 5-4 9 8v2a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#fff" opacity=".9"/></svg>`;
    }
    if (kind === "audio") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="7" width="26" height="26" rx="4" fill="#5b7cfa"/><path d="M16 14v12m0-12l10-2v10" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16" cy="26" r="3" fill="#fff"/><circle cx="26" cy="22" r="3" fill="#fff"/></svg>`;
    }
    if (kind === "video") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="10" width="28" height="20" rx="3" fill="#c45c8a"/><path d="M17 16l9 4-9 4z" fill="#fff"/></svg>`;
    }
    if (kind === "sheets") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M10 6h14l8 8v20a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#008f7d"/><path d="M24 6v8h8" fill="#006056"/><path d="M12 18h16M12 23h16M12 28h16M17 18v10M22 18v10" fill="none" stroke="#fff" stroke-width="1.4"/></svg>`;
    }
    if (kind === "text") {
      return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M12 6h12l8 8v20a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#f4f4f4"/><path d="M24 6v8h8" fill="#d0d0d0"/><rect x="12" y="20" width="16" height="2" fill="#6a6a6a"/><rect x="12" y="25" width="12" height="2" fill="#6a6a6a"/></svg>`;
    }
    return `<svg class="fe-glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M12 6h12l8 8v20a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#cfd6d4"/><path d="M24 6v8h8" fill="#9aa8a4"/></svg>`;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function iconFor(node) {
    if (!node) return glyph("file");
    if (node.kind === "folder") return glyph("folder");
    if (node.kind === "shortcut") {
      if (node.icon) {
        return `<img class="fe-glyph fe-app-icon" src="${escapeAttr(node.icon)}" alt="">`;
      }
      return glyph("shortcut");
    }
    const kind = openKind(node);
    if (kind === "download") return glyph("file");
    return glyph(kind);
  }

  return {
    ROOT_ID,
    DESKTOP_ID,
    DOCUMENTS_ID,
    SHEETS_DIR_ID,
    SHEETS_EXTS,
    TEXT_MAX,
    ready,
    get,
    list,
    listFolders,
    listDesktop: () => list(DESKTOP_ID),
    listFilesByExt,
    pathOf,
    nodeAtPath,
    uniqueName,
    createFolder,
    createFile,
    createTextFile,
    writeFile,
    rename,
    remove,
    move,
    copy,
    getBlob,
    download,
    readText,
    ensureSheetsFolder,
    importFiles,
    importDataTransfer,
    setClipboard,
    getClipboard,
    paste,
    isSystem,
    isTextNode,
    isImageNode,
    isAudioNode,
    isVideoNode,
    isPdfNode,
    isSheetsNode,
    openKind,
    formatSize,
    typeLabel,
    iconFor,
    onChange,
  };
})();
