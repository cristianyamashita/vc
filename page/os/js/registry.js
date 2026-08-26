window.OSRegistry = (function () {
  const MAX_PREVIEW_CHARS = 8000;
  const MAX_INLINE_PREVIEW = 120;

  const KNOWN_IDB_DATABASES = [
    { name: "prompt_context_db", version: 2, stores: ["data"] },
    { name: "slides_db", version: 1, stores: ["projects", "folders", "documents", "slides"] },
    { name: "AudioPlayerDB", version: 1, stores: ["folders", "subfolders", "tracks"] },
    { name: "NotebookDB", version: 1, stores: ["projects", "books", "sheets"] },
    { name: "ObsidianWebDB", version: 1, stores: ["vaults", "docs"] },
    { name: "wordpad_db_v1", version: 1, stores: ["documents"] },
    { name: "TestBuilderDB", version: 2, stores: ["projects", "tests", "sections", "questions"] },
    { name: "CreditPlannerDB", version: 1, stores: ["services"] },
    { name: "vector_editor_db", version: 1, stores: ["documents", "settings"] },
    {
      name: "form_builder_db",
      version: 1,
      stores: ["forms", "fields", "relations", "records", "attachments", "views", "settings"],
    },
    { name: "masonry_gallery_db", version: 1, stores: ["images"] },
    { name: "ChainReactionLabDB", version: 1, stores: ["scenarios"] },
    { name: "ChecklistDB", version: 1, stores: ["templates", "runs"] },
    { name: "kanban-db", version: 1, stores: ["columns", "cards"] },
    { name: "stepseq-db", version: 1, stores: ["patterns"] },
    { name: "circuit-db", version: 1, stores: ["circuits"] },
    { name: "electronics_lab_3d", version: 2, stores: ["projects", "settings"] },
    { name: "ServiceTycoonDB", version: 1, stores: ["scenarios", "saves", "preferences"] },
    { name: "FlashcardsSRSDB", version: 1, stores: ["decks", "cards", "settings"] },
    { name: "DesktopOSDB", version: 6, stores: ["state", "wallpapers", "userApps", "fsNodes", "fsBlobs"] },
    { name: "OSSheetsDB", version: 1, stores: ["workbooks", "meta"] },
  ];

  let hostEl = null;
  let expanded = new Set(["ls", "idb"]);
  let cache = {
    lsKeys: null,
    dbs: null,
    stores: new Map(),
    records: new Map(),
    errors: new Map(),
  };

  function t(key, vars) {
    return window.OSI18n.t(key, vars);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBytes(n) {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function summarizeValue(value) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      const type = value.type || "application/octet-stream";
      return t("registryBlob", { type: type, size: formatBytes(value.size) });
    }
    if (value instanceof ArrayBuffer) {
      return "[ArrayBuffer · " + formatBytes(value.byteLength) + "]";
    }
    if (value && value.buffer instanceof ArrayBuffer && typeof value.byteLength === "number") {
      return "[" + (value.constructor && value.constructor.name ? value.constructor.name : "TypedArray") + " · " + formatBytes(value.byteLength) + "]";
    }
    if (typeof value === "string") {
      if (value.length > MAX_INLINE_PREVIEW) return JSON.stringify(value.slice(0, MAX_INLINE_PREVIEW)) + "…";
      return JSON.stringify(value);
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      const text = JSON.stringify(sanitizeForJson(value));
      if (!text) return String(value);
      if (text.length > MAX_INLINE_PREVIEW) return text.slice(0, MAX_INLINE_PREVIEW) + "…";
      return text;
    } catch (_) {
      return Object.prototype.toString.call(value);
    }
  }

  function sanitizeForJson(value, depth) {
    const d = depth || 0;
    if (d > 8) return "[…]";
    if (value === null || value === undefined) return value;
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      return { __type: "Blob", mime: value.type || "", size: value.size };
    }
    if (value instanceof ArrayBuffer) {
      return { __type: "ArrayBuffer", size: value.byteLength };
    }
    if (value && value.buffer instanceof ArrayBuffer && typeof value.byteLength === "number") {
      return {
        __type: value.constructor && value.constructor.name ? value.constructor.name : "TypedArray",
        size: value.byteLength,
      };
    }
    if (Array.isArray(value)) return value.map((item) => sanitizeForJson(item, d + 1));
    if (typeof value === "object") {
      if (value instanceof Date) return value.toISOString();
      const out = {};
      Object.keys(value).forEach((key) => {
        try {
          out[key] = sanitizeForJson(value[key], d + 1);
        } catch (_) {
          out[key] = "[unreadable]";
        }
      });
      return out;
    }
    if (typeof value === "bigint") return value.toString() + "n";
    if (typeof value === "function") return "[Function]";
    return value;
  }

  function prettyValue(value) {
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch (_) {
        return value;
      }
    }
    try {
      return JSON.stringify(sanitizeForJson(value), null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function truncateText(text) {
    if (text.length <= MAX_PREVIEW_CHARS) return text;
    return text.slice(0, MAX_PREVIEW_CHARS) + "\n…";
  }

  function keyLabel(key) {
    if (typeof key === "string" || typeof key === "number" || typeof key === "boolean") return String(key);
    try {
      return JSON.stringify(key);
    } catch (_) {
      return String(key);
    }
  }

  async function discoverDatabases() {
    const known = new Map();
    KNOWN_IDB_DATABASES.forEach((db) => known.set(db.name, { ...db }));
    const map = new Map();
    let listed = null;
    try {
      if (indexedDB.databases) {
        listed = await indexedDB.databases();
      }
    } catch (_) {
      listed = null;
    }
    if (listed) {
      for (const db of listed) {
        if (!db || !db.name) continue;
        const base = known.get(db.name) || { name: db.name, stores: null };
        map.set(db.name, {
          name: db.name,
          version: db.version || base.version || 1,
          stores: base.stores || null,
        });
      }
    } else {
      for (const db of known.values()) map.set(db.name, { ...db });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Open an existing DB without creating or upgrading schema. */
  function openDatabaseReadOnly(name) {
    return new Promise((resolve, reject) => {
      let req;
      let created = false;
      try {
        req = indexedDB.open(name);
      } catch (err) {
        reject(err);
        return;
      }
      req.onupgradeneeded = () => {
        created = true;
        try {
          req.transaction.abort();
        } catch (_) {
          /* ignore */
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        if (created) {
          db.close();
          reject(new Error("not-found"));
          return;
        }
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error("open-failed"));
      req.onblocked = () => reject(new Error("blocked"));
    });
  }

  async function listStores(dbMeta) {
    let db = null;
    try {
      db = await openDatabaseReadOnly(dbMeta.name);
      const stores = Array.from(db.objectStoreNames || []).sort((a, b) => a.localeCompare(b));
      return stores;
    } finally {
      if (db) db.close();
    }
  }

  function readAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const results = [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            results.push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function listRecords(dbMeta, storeName) {
    let db = null;
    try {
      db = await openDatabaseReadOnly(dbMeta.name);
      if (!db.objectStoreNames.contains(storeName)) return [];
      return await readAllFromStore(db, storeName);
    } finally {
      if (db) db.close();
    }
  }

  function listLocalStorageKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key != null) keys.push(key);
      }
    } catch (_) {
      /* ignore */
    }
    return keys.sort((a, b) => a.localeCompare(b));
  }

  function resetCache() {
    cache = {
      lsKeys: null,
      dbs: null,
      stores: new Map(),
      records: new Map(),
      errors: new Map(),
    };
  }

  function chevron(open) {
    return open ? "▾" : "▸";
  }

  function nodeHeader(id, label, meta, depth) {
    const open = expanded.has(id);
    const pad = 8 + depth * 14;
    return `<button type="button" class="registry-toggle" data-registry-id="${escapeHtml(id)}" style="padding-left:${pad}px">
      <span class="registry-chevron" aria-hidden="true">${chevron(open)}</span>
      <span class="registry-label">${escapeHtml(label)}</span>
      ${meta ? `<span class="registry-meta">${escapeHtml(meta)}</span>` : ""}
    </button>`;
  }

  function leafRow(id, depth, key, summary, bodyHtml) {
    const pad = 8 + depth * 14;
    const open = expanded.has(id);
    return `<div class="registry-leaf">
      <button type="button" class="registry-toggle registry-leaf-toggle" data-registry-id="${escapeHtml(id)}" style="padding-left:${pad}px">
        <span class="registry-chevron" aria-hidden="true">${chevron(open)}</span>
        <span class="registry-key">${escapeHtml(key)}</span>
        <span class="registry-summary">${escapeHtml(summary)}</span>
      </button>
      ${open ? `<div class="registry-value" style="margin-left:${pad + 18}px">${bodyHtml}</div>` : ""}
    </div>`;
  }

  function valueBlock(value) {
    const text = truncateText(prettyValue(value));
    return `<pre class="registry-pre">${escapeHtml(text)}</pre>`;
  }

  function errorLine(msg, depth) {
    const pad = 8 + depth * 14;
    return `<p class="registry-error muted" style="padding-left:${pad + 18}px">${escapeHtml(msg)}</p>`;
  }

  function loadingLine(depth) {
    const pad = 8 + depth * 14;
    return `<p class="muted registry-loading" style="padding-left:${pad + 18}px">${escapeHtml(t("registryLoading"))}</p>`;
  }

  function emptyLine(depth) {
    const pad = 8 + depth * 14;
    return `<p class="muted" style="padding-left:${pad + 18}px">${escapeHtml(t("registryEmpty"))}</p>`;
  }

  function renderLocalStorage() {
    const id = "ls";
    let html = `<div class="registry-node">${nodeHeader(id, t("registryLocalStorage"), cache.lsKeys ? String(cache.lsKeys.length) : "", 0)}`;
    if (!expanded.has(id)) return html + "</div>";
    if (!cache.lsKeys) return html + loadingLine(1) + "</div>";
    if (!cache.lsKeys.length) return html + emptyLine(1) + "</div>";
    html += `<div class="registry-children">`;
    cache.lsKeys.forEach((key) => {
      let raw = "";
      try {
        raw = localStorage.getItem(key);
      } catch (_) {
        raw = "";
      }
      html += leafRow("ls-key:" + key, 1, key, summarizeValue(raw), valueBlock(raw == null ? "" : raw));
    });
    html += `</div></div>`;
    return html;
  }

  function renderIndexedDB() {
    const id = "idb";
    let html = `<div class="registry-node">${nodeHeader(id, t("registryIndexedDB"), cache.dbs ? String(cache.dbs.length) : "", 0)}`;
    if (!expanded.has(id)) return html + "</div>";
    if (!cache.dbs) return html + loadingLine(1) + "</div>";
    if (!cache.dbs.length) return html + emptyLine(1) + "</div>";
    html += `<div class="registry-children">`;
    cache.dbs.forEach((dbMeta) => {
      const dbId = "db:" + dbMeta.name;
      const ver = dbMeta.version ? "v" + dbMeta.version : "";
      html += `<div class="registry-node">${nodeHeader(dbId, dbMeta.name, ver, 1)}`;
      if (expanded.has(dbId)) {
        if (cache.errors.has(dbId)) {
          html += errorLine(cache.errors.get(dbId), 2);
        } else if (!cache.stores.has(dbId)) {
          html += loadingLine(2);
        } else {
          const stores = cache.stores.get(dbId) || [];
          if (!stores.length) {
            html += `<p class="muted" style="padding-left:${8 + 2 * 14 + 18}px">${escapeHtml(t("registryNoStores"))}</p>`;
          } else {
            html += `<div class="registry-children">`;
            stores.forEach((storeName) => {
              const storeId = "store:" + dbMeta.name + "/" + storeName;
              html += `<div class="registry-node">${nodeHeader(storeId, storeName, "", 2)}`;
              if (expanded.has(storeId)) {
                if (cache.errors.has(storeId)) {
                  html += errorLine(cache.errors.get(storeId), 3);
                } else if (!cache.records.has(storeId)) {
                  html += loadingLine(3);
                } else {
                  const records = cache.records.get(storeId) || [];
                  if (!records.length) {
                    html += emptyLine(3);
                  } else {
                    html += `<div class="registry-children">`;
                    html += `<p class="muted registry-count" style="padding-left:${8 + 3 * 14 + 18}px">${escapeHtml(
                      t("registryRecords", { n: String(records.length) })
                    )}</p>`;
                    records.forEach((rec, index) => {
                      const k = keyLabel(rec.key);
                      const leafId = "rec:" + dbMeta.name + "/" + storeName + "/" + index;
                      html += leafRow(leafId, 3, k || "#" + index, summarizeValue(rec.value), valueBlock(rec.value));
                    });
                    html += `</div>`;
                  }
                }
              }
              html += `</div>`;
            });
            html += `</div>`;
          }
        }
      }
      html += `</div>`;
    });
    html += `</div></div>`;
    return html;
  }

  function paint() {
    if (!hostEl) return;
    hostEl.innerHTML = `
      <h2>${escapeHtml(t("registry"))}</h2>
      <p class="muted registry-hint">${escapeHtml(t("registryHint"))}</p>
      <p class="muted registry-readonly">${escapeHtml(t("registryReadOnly"))}</p>
      <div class="registry-toolbar">
        <button type="button" id="os-registry-refresh" class="btn-install">${escapeHtml(t("registryRefresh"))}</button>
        <a class="registry-backup-link" href="../utils/backup.html" target="_blank" rel="noopener">${escapeHtml(t("registryBackupLink"))}</a>
      </div>
      <div class="registry-tree">
        ${renderLocalStorage()}
        ${renderIndexedDB()}
      </div>
    `;
    bind();
  }

  function bind() {
    if (!hostEl) return;
    const refresh = hostEl.querySelector("#os-registry-refresh");
    if (refresh) {
      refresh.addEventListener("click", () => {
        resetCache();
        expanded = new Set(["ls", "idb"]);
        paint();
        loadRoots();
      });
    }
    hostEl.querySelectorAll("[data-registry-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.registryId;
        if (!id) return;
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        paint();
        ensureLoaded(id);
      });
    });
  }

  async function ensureLoaded(id) {
    if (!expanded.has(id)) return;
    try {
      if (id === "ls") {
        if (!cache.lsKeys) {
          cache.lsKeys = listLocalStorageKeys();
          paint();
        }
        return;
      }
      if (id === "idb") {
        if (!cache.dbs) {
          cache.dbs = await discoverDatabases();
          paint();
        }
        return;
      }
      if (id.startsWith("db:")) {
        if (!cache.stores.has(id)) {
          const name = id.slice(3);
          const meta = (cache.dbs || []).find((db) => db.name === name);
          if (!meta) return;
          try {
            const stores = await listStores(meta);
            cache.stores.set(id, stores);
            cache.errors.delete(id);
          } catch (err) {
            cache.stores.set(id, []);
            cache.errors.set(id, t("registryError") + (err && err.message ? ": " + err.message : ""));
          }
          paint();
        }
        return;
      }
      if (id.startsWith("store:")) {
        if (!cache.records.has(id)) {
          const path = id.slice(6);
          const slash = path.indexOf("/");
          if (slash < 0) return;
          const dbName = path.slice(0, slash);
          const storeName = path.slice(slash + 1);
          const meta = (cache.dbs || []).find((db) => db.name === dbName) || { name: dbName, version: 1 };
          try {
            const records = await listRecords(meta, storeName);
            cache.records.set(id, records);
            cache.errors.delete(id);
          } catch (err) {
            cache.records.set(id, []);
            cache.errors.set(id, t("registryError") + (err && err.message ? ": " + err.message : ""));
          }
          paint();
        }
      }
    } catch (err) {
      cache.errors.set(id, t("registryError") + (err && err.message ? ": " + err.message : ""));
      paint();
    }
  }

  async function loadRoots() {
    paint();
    await ensureLoaded("ls");
    await ensureLoaded("idb");
  }

  function mount(panel) {
    hostEl = panel;
    resetCache();
    if (!expanded.size) expanded = new Set(["ls", "idb"]);
    if (!expanded.has("ls")) expanded.add("ls");
    if (!expanded.has("idb")) expanded.add("idb");
    loadRoots();
  }

  return { mount };
})();
