const DB_NAME = 'VoxelCraftDB';
const DB_VERSION = 1;
const WORLD_KEY = 'current';
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

export async function loadWorldSave() {
  const db = await getDB();
  return txGet(db, 'worlds', WORLD_KEY);
}

export async function saveWorldSave(data) {
  const db = await getDB();
  return txPut(db, 'worlds', WORLD_KEY, data);
}

export async function clearWorldSave() {
  const db = await getDB();
  return txDel(db, 'worlds', WORLD_KEY);
}

export async function loadSettings() {
  const db = await getDB();
  return txGet(db, 'settings', SETTINGS_KEY);
}

export async function saveSettings(data) {
  const db = await getDB();
  return txPut(db, 'settings', SETTINGS_KEY, data);
}
