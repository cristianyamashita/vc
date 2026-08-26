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

  function defaultState() {
    const installed = ["settings", ...window.OSCatalog.DEFAULT_INSTALLED];
    return {
      username: "User",
      installed,
      favorites: [...window.OSCatalog.DEFAULT_INSTALLED],
      desktopIcons: ["sheets", "app-builder", ...window.OSCatalog.DEFAULT_INSTALLED],
      windows: [],
      placements: {},
      wallpaperId: "bloom",
      focusedId: null,
    };
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
    const installed = Array.isArray(raw.installed) ? raw.installed.filter(Boolean) : base.installed;
    if (!installed.includes("settings")) installed.unshift("settings");
    return {
      username: typeof raw.username === "string" && raw.username.trim() ? raw.username.trim() : base.username,
      installed,
      favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(Boolean) : base.favorites,
      desktopIcons: Array.isArray(raw.desktopIcons) ? raw.desktopIcons.filter(Boolean) : base.desktopIcons,
      windows: Array.isArray(raw.windows) ? raw.windows.filter((w) => w && w.id) : [],
      placements: normalizePlacements(raw.placements),
      wallpaperId: typeof raw.wallpaperId === "string" && raw.wallpaperId ? raw.wallpaperId : "bloom",
      focusedId: raw.focusedId || null,
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
