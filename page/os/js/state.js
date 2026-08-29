window.OSState = (function () {
  const DB_NAME = "DesktopOSDB";
  const DB_VERSION = 6;
  const STORE = "state";
  const WALL_STORE = "wallpapers";
  const USER_STORE = "userApps";
  const FS_NODES = "fsNodes";
  const FS_BLOBS = "fsBlobs";
  const KEY = "desktop";
  const SAVE_DEBOUNCE_MS = 300;

  let dbPromise = null;
  let saveTimer = null;
  let lastSaved = null;

  function normalizePlacements(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((id) => {
      const item = raw[id];
      if (!item || typeof item !== "object") return;
      const x = Number(item.x);
      const y = Number(item.y);
      const w = Number(item.w);
      const h = Number(item.h);
      if (![x, y, w, h].every(Number.isFinite)) return;
      out[id] = { x, y, w, h, maximized: !!item.maximized };
    });
    return out;
  }

  function normalizeDesktopLayout(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((key) => {
      const item = raw[key];
      if (!item || typeof item !== "object") return;
      const c = Math.floor(Number(item.c));
      const r = Math.floor(Number(item.r));
      if (!Number.isFinite(c) || !Number.isFinite(r) || c < 0 || r < 0) return;
      out[key] = { c, r };
    });
    return out;
  }

  function normalizeFileApps(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((ext) => {
      const item = raw[ext];
      if (!item || typeof item !== "object") return;
      const key = String(ext).replace(/^\./, "").toLowerCase();
      if (!key) return;
      const apps = Array.isArray(item.apps) ? item.apps.filter((id) => typeof id === "string" && id) : [];
      const def = typeof item.default === "string" && item.default ? item.default : null;
      out[key] = { apps, default: def };
    });
    return out;
  }

  const LEGACY_SEEDED_DEFAULTS = ["utils-calculator", "utils-notebook"];
  const EXCLUSIVE_DESKTOP = ["notepad", "paint", "calendar", "browser"];

  function defaultState() {
    const installed = ["settings", ...window.OSCatalog.DEFAULT_INSTALLED];
    return {
      username: "User",
      installed,
      favorites: [...window.OSCatalog.DEFAULT_INSTALLED],
      desktopIcons: ["sheets", "app-builder", ...EXCLUSIVE_DESKTOP, ...window.OSCatalog.DEFAULT_INSTALLED],
      windows: [],
      placements: {},
      desktopLayout: {},
      wallpaperId: "bloom",
      focusedId: null,
      fileApps: {},
      appliedDefaultApps: [...window.OSCatalog.DEFAULT_INSTALLED],
      iconColor: "#008f7d",
      taskbarPins: ["file-explorer", "browser"],
      recentFiles: [],
      reducedMotion: false,
      glass: 86,
      blur: 20,
      nightLight: 0,
      iconSize: "m",
      clipboard: [],
      calendarItems: [],
      stickies: [],
      widgets: [],
      browser: { bookmarks: [], history: [], cookies: [], proxy: "" },
      appliedWidgets: false,
      appliedExclusiveDesktop: EXCLUSIVE_DESKTOP.slice(),
    };
  }

  function normalizeTaskbarPins(raw) {
    const pins = Array.isArray(raw) ? raw.filter((id) => typeof id === "string" && id) : [];
    return pins.length ? pins : ["file-explorer"];
  }

  function normalizeRecentFiles(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    raw.forEach((item) => {
      if (!item || typeof item !== "object" || !item.id || seen.has(item.id)) return;
      seen.add(item.id);
      out.push({
        id: String(item.id),
        appId: typeof item.appId === "string" ? item.appId : null,
        name: typeof item.name === "string" ? item.name : "",
        at: Number(item.at) || 0,
      });
    });
    return out.slice(0, 24);
  }

  function seedExclusiveDesktop(raw, desktopIcons) {
    const applied = Array.isArray(raw && raw.appliedExclusiveDesktop)
      ? raw.appliedExclusiveDesktop.filter(Boolean).slice()
      : [];
    EXCLUSIVE_DESKTOP.forEach((id) => {
      if (applied.includes(id)) return;
      applied.push(id);
      if (!desktopIcons.includes(id)) desktopIcons.push(id);
    });
    return applied;
  }

  function seedNewDefaultApps(raw, installed, favorites, desktopIcons) {
    const defaults = Array.isArray(window.OSCatalog.DEFAULT_INSTALLED)
      ? window.OSCatalog.DEFAULT_INSTALLED
      : [];
    const applied = Array.isArray(raw && raw.appliedDefaultApps)
      ? raw.appliedDefaultApps.filter(Boolean).slice()
      : LEGACY_SEEDED_DEFAULTS.slice();
    defaults.forEach((id) => {
      if (applied.includes(id)) return;
      applied.push(id);
      if (!installed.includes(id)) installed.push(id);
      if (!favorites.includes(id)) favorites.push(id);
      if (!desktopIcons.includes(id)) desktopIcons.push(id);
    });
    return applied;
  }

  function ensureKeyedStore(db, upgradeTx, name) {
    if (!db.objectStoreNames.contains(name)) {
      db.createObjectStore(name, { keyPath: "id" });
      return;
    }
    if (!upgradeTx) return;
    const existing = upgradeTx.objectStore(name);
    if (existing.keyPath !== "id") {
      db.deleteObjectStore(name);
      db.createObjectStore(name, { keyPath: "id" });
    }
  }

  function ensureStores(db, upgradeTx) {
    if (!db.objectStoreNames.contains(STORE)) {
      db.createObjectStore(STORE);
    }
    ensureKeyedStore(db, upgradeTx, WALL_STORE);
    ensureKeyedStore(db, upgradeTx, USER_STORE);
    ensureKeyedStore(db, upgradeTx, FS_NODES);
    ensureKeyedStore(db, upgradeTx, FS_BLOBS);
    if (upgradeTx && db.objectStoreNames.contains(FS_NODES)) {
      const nodes = upgradeTx.objectStore(FS_NODES);
      if (!nodes.indexNames.contains("parentId")) nodes.createIndex("parentId", "parentId", { unique: false });
      if (!nodes.indexNames.contains("kind")) nodes.createIndex("kind", "kind", { unique: false });
    }
  }

  function hasRequiredStores(db) {
    return (
      db.objectStoreNames.contains(STORE) &&
      db.objectStoreNames.contains(WALL_STORE) &&
      db.objectStoreNames.contains(USER_STORE) &&
      db.objectStoreNames.contains(FS_NODES) &&
      db.objectStoreNames.contains(FS_BLOBS)
    );
  }

  function isVersionError(err) {
    return !!(err && (err.name === "VersionError" || /less than the existing version/i.test(String(err.message || ""))));
  }

  function attachDb(db) {
    db.onversionchange = () => {
      db.close();
      dbPromise = null;
    };
    return db;
  }

  function probeVersion() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        const version = req.result.version || 0;
        req.result.close();
        resolve(version);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function openAt(version) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, version);
      req.onupgradeneeded = (event) => {
        ensureStores(req.result, event.target.transaction);
      };
      req.onblocked = () => {
        console.warn("DesktopOSDB upgrade blocked; close other tabs using Desktop.");
      };
      req.onsuccess = () => resolve(attachDb(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  async function openReady(attempt) {
    attempt = attempt || 0;
    const existing = await probeVersion().catch(() => 0);
    const version = Math.max(DB_VERSION, existing);
    let db;
    try {
      db = await openAt(version);
    } catch (err) {
      if (isVersionError(err) && attempt < 4) {
        const latest = await probeVersion().catch(() => version + 1);
        db = await openAt(Math.max(version, latest));
      } else {
        throw err;
      }
    }
    if (hasRequiredStores(db)) return db;
    const nextVersion = db.version + 1;
    if (attempt >= 6 || nextVersion > Math.max(DB_VERSION, db.version) + 8) {
      db.close();
      throw new Error("DesktopOSDB is missing required stores");
    }
    db.close();
    try {
      db = await openAt(nextVersion);
    } catch (err) {
      if (!(isVersionError(err) && attempt < 6)) throw err;
      return openReady(attempt + 1);
    }
    if (hasRequiredStores(db)) return db;
    db.close();
    return openReady(attempt + 1);
  }

  function clampGlass(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 86;
    return Math.min(100, Math.max(40, Math.round(v)));
  }

  function clampBlur(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 20;
    return Math.min(40, Math.max(0, Math.round(v)));
  }

  function clampNight(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.min(80, Math.max(0, Math.round(v)));
  }

  function clampIconSize(value) {
    return value === "s" || value === "l" ? value : "m";
  }

  function normalizeClipboard(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item.text === "string" && item.text)
      .slice(0, 30)
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : "clip_" + Math.random().toString(36).slice(2, 8),
        text: String(item.text).slice(0, 8000),
        at: Number(item.at) || 0,
      }));
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = openReady().catch((err) => {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  function normalize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    const installed = Array.isArray(raw.installed) ? raw.installed.filter(Boolean) : base.installed.slice();
    if (!installed.includes("settings")) installed.unshift("settings");
    const favorites = Array.isArray(raw.favorites) ? raw.favorites.filter(Boolean) : base.favorites.slice();
    const desktopIcons = Array.isArray(raw.desktopIcons)
      ? raw.desktopIcons.filter(Boolean)
      : base.desktopIcons.slice();
    const appliedDefaultApps = seedNewDefaultApps(raw, installed, favorites, desktopIcons);
    const appliedExclusiveDesktop = seedExclusiveDesktop(raw, desktopIcons);
    return {
      username: typeof raw.username === "string" && raw.username.trim() ? raw.username.trim() : base.username,
      installed,
      favorites,
      desktopIcons,
      windows: Array.isArray(raw.windows) ? raw.windows.filter((w) => w && w.id) : [],
      placements: normalizePlacements(raw.placements),
      desktopLayout: normalizeDesktopLayout(raw.desktopLayout),
      wallpaperId: typeof raw.wallpaperId === "string" && raw.wallpaperId ? raw.wallpaperId : "bloom",
      focusedId: raw.focusedId || null,
      fileApps: normalizeFileApps(raw.fileApps),
      appliedDefaultApps,
      appliedExclusiveDesktop,
      iconColor: window.OSIconColor ? window.OSIconColor.parse(raw.iconColor) : "#008f7d",
      taskbarPins: normalizeTaskbarPins(raw.taskbarPins),
      recentFiles: normalizeRecentFiles(raw.recentFiles),
      reducedMotion: !!raw.reducedMotion,
      glass: clampGlass(raw.glass),
      blur: clampBlur(raw.blur),
      nightLight: clampNight(raw.nightLight),
      iconSize: clampIconSize(raw.iconSize),
      clipboard: normalizeClipboard(raw.clipboard),
      calendarItems: Array.isArray(raw.calendarItems) ? raw.calendarItems.filter((item) => item && item.id) : [],
      stickies: Array.isArray(raw.stickies) ? raw.stickies.filter((item) => item && item.id) : [],
      widgets: Array.isArray(raw.widgets) ? raw.widgets.filter((item) => item && item.id && item.type) : [],
      browser:
        raw.browser && typeof raw.browser === "object"
          ? {
              bookmarks: Array.isArray(raw.browser.bookmarks) ? raw.browser.bookmarks : [],
              history: Array.isArray(raw.browser.history) ? raw.browser.history : [],
              cookies: Array.isArray(raw.browser.cookies) ? raw.browser.cookies : [],
              proxy: typeof raw.browser.proxy === "string" ? raw.browser.proxy : "",
            }
          : { bookmarks: [], history: [], cookies: [] },
      appliedWidgets: !!raw.appliedWidgets,
    };
  }

  async function load() {
    try {
      const db = await openDb();
      const stored = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      lastSaved = normalize(stored);
      const prevApplied = stored && Array.isArray(stored.appliedDefaultApps) ? stored.appliedDefaultApps : null;
      const nextApplied = lastSaved.appliedDefaultApps || [];
      if (!prevApplied || prevApplied.join("\0") !== nextApplied.join("\0")) {
        write(lastSaved).catch((err) => console.warn("DesktopOSDB default-app seed failed", err));
      }
      return structuredClone(lastSaved);
    } catch (err) {
      console.warn("DesktopOSDB load failed", err);
      lastSaved = defaultState();
      return structuredClone(lastSaved);
    }
  }

  async function write(state) {
    const normalized = normalize(state);
    lastSaved = structuredClone(normalized);
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(normalized, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function scheduleSave(state) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      write(state).catch((err) => console.warn("DesktopOSDB save failed", err));
    }, SAVE_DEBOUNCE_MS);
  }

  function getLastSaved() {
    return lastSaved ? structuredClone(lastSaved) : defaultState();
  }

  function listWallpapers() {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(WALL_STORE, "readonly");
          const req = tx.objectStore(WALL_STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function getWallpaper(id) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(WALL_STORE, "readonly");
          const req = tx.objectStore(WALL_STORE).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function putWallpaper(record) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!db.objectStoreNames.contains(WALL_STORE)) {
            reject(new Error("missing wallpapers store"));
            return;
          }
          const tx = db.transaction(WALL_STORE, "readwrite");
          const store = tx.objectStore(WALL_STORE);
          if (store.keyPath) store.put(record);
          else store.put(record, record.id);
          tx.oncomplete = () => resolve(record);
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  function deleteWallpaper(id) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(WALL_STORE, "readwrite");
          tx.objectStore(WALL_STORE).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  function listUserApps() {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!db.objectStoreNames.contains(USER_STORE)) {
            resolve([]);
            return;
          }
          const tx = db.transaction(USER_STORE, "readonly");
          const req = tx.objectStore(USER_STORE).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function getUserApp(id) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!db.objectStoreNames.contains(USER_STORE)) {
            resolve(null);
            return;
          }
          const tx = db.transaction(USER_STORE, "readonly");
          const req = tx.objectStore(USER_STORE).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function putUserApp(record) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!db.objectStoreNames.contains(USER_STORE)) {
            reject(new Error("missing userApps store"));
            return;
          }
          const tx = db.transaction(USER_STORE, "readwrite");
          const store = tx.objectStore(USER_STORE);
          if (store.keyPath) store.put(record);
          else store.put(record, record.id);
          tx.oncomplete = () => resolve(record);
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  function deleteUserApp(id) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!db.objectStoreNames.contains(USER_STORE)) {
            resolve();
            return;
          }
          const tx = db.transaction(USER_STORE, "readwrite");
          tx.objectStore(USER_STORE).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  return {
    DB_NAME,
    defaultState,
    load,
    write,
    scheduleSave,
    getLastSaved,
    SAVE_DEBOUNCE_MS,
    listWallpapers,
    getWallpaper,
    putWallpaper,
    deleteWallpaper,
    listUserApps,
    getUserApp,
    putUserApp,
    deleteUserApp,
    openDb,
    FS_NODES,
    FS_BLOBS,
  };
})();
