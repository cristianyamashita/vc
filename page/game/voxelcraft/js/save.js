const DB_NAME = 'VoxelCraftDB';
const DB_VERSION = 1;
const LEGACY_KEY = 'current';
const INDEX_KEY = 'worldIndex';
const SETTINGS_KEY = 'ui';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readonly');
    const r = t.objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}

function txPut(db, store, key, value) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const r = t.objectStore(store).put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function txDel(db, store, key) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const r = t.objectStore(store).delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

let dbPromise = null;

export function getDB() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

function worldStoreKey(id) {
  return `w:${id}`;
}

export function newWorldId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadWorldIndex() {
  const db = await getDB();
  const idx = await txGet(db, 'settings', INDEX_KEY);
  if (idx && Array.isArray(idx.list)) {
    return { current: idx.current || null, list: idx.list };
  }
  return { current: null, list: [] };
}

export async function saveWorldIndex(index) {
  const db = await getDB();
  await txPut(db, 'settings', INDEX_KEY, {
    current: index.current || null,
    list: index.list || [],
  });
}

export async function migrateLegacyWorld(defaultName = 'World 1') {
  const index = await loadWorldIndex();
  if (index.list.length) return index;
  const db = await getDB();
  const legacy = await txGet(db, 'worlds', LEGACY_KEY);
  if (!legacy?.seed) return index;
  const id = newWorldId();
  await txPut(db, 'worlds', worldStoreKey(id), legacy);
  await txDel(db, 'worlds', LEGACY_KEY);
  const next = {
    current: id,
    list: [{
      id,
      name: defaultName,
      created: Date.now(),
      updated: Date.now(),
    }],
  };
  await saveWorldIndex(next);
  return next;
}

export async function loadWorldSave(id) {
  if (!id) return null;
  const db = await getDB();
  return txGet(db, 'worlds', worldStoreKey(id));
}

export async function saveWorldSave(id, data) {
  if (!id) return;
  const db = await getDB();
  await txPut(db, 'worlds', worldStoreKey(id), data);
}

export async function deleteWorldSave(id) {
  if (!id) return;
  const db = await getDB();
  await txDel(db, 'worlds', worldStoreKey(id));
}

export async function loadSettings() {
  const db = await getDB();
  return txGet(db, 'settings', SETTINGS_KEY);
}

export async function saveSettings(data) {
  const db = await getDB();
  return txPut(db, 'settings', SETTINGS_KEY, data);
}
