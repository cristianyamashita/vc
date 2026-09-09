// The visitor's own library, in IndexedDB. Everything a person makes here
// lives in this one database, which is also why it is registered in
// page/utils/backup.html: losing it loses their whole body of work, and this
// site has no server to fall back on.

const DB_NAME = 'StoryStudioDB';
const DB_VERSION = 2;
const DOCS = 'documents';
const BLOBS = 'blobs';
const PREFERENCES = 'preferences';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOCS)) {
        db.createObjectStore(DOCS, { keyPath: 'key' }).createIndex('kind', 'kind');
      }
      if (!db.objectStoreNames.contains(BLOBS)) {
        db.createObjectStore(BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PREFERENCES)) {
        db.createObjectStore(PREFERENCES, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve();
    }
  }));
}

export function docKey(kind, id) {
  return `${kind}:${id}`;
}

export async function listDocuments() {
  const rows = await run(DOCS, 'readonly', (s) => s.getAll());
  return rows.map((r) => r.doc);
}

export async function getDocument(kind, id) {
  const row = await run(DOCS, 'readonly', (s) => s.get(docKey(kind, id)));
  return row?.doc ?? null;
}

export async function putDocument(doc) {
  await run(DOCS, 'readwrite', (s) => s.put({
    key: docKey(doc.kind, doc.id),
    kind: doc.kind,
    id: doc.id,
    saved: Date.now(),
    doc,
  }));
  return doc;
}

export async function deleteDocument(kind, id) {
  await run(DOCS, 'readwrite', (s) => s.delete(docKey(kind, id)));
}

export function getBlob(id) {
  return run(BLOBS, 'readonly', (s) => s.get(id)).then((row) => row?.blob ?? null);
}

export function putBlob(id, blob, meta = {}) {
  return run(BLOBS, 'readwrite', (s) => s.put({ id, blob, saved: Date.now(), ...meta }));
}

export function deleteBlob(id) {
  return run(BLOBS, 'readwrite', (s) => s.delete(id));
}

export function listBlobs() {
  return run(BLOBS, 'readonly', (s) => s.getAll());
}

/** Small app-wide values that are not library documents. Keeping these in
 *  their own store means a preference can be shared by every object editor
 *  without being copied into, or accidentally exported as, an object. */
export async function getPreference(key, fallback = null) {
  const row = await run(PREFERENCES, 'readonly', (s) => s.get(key));
  return row?.value ?? fallback;
}

export async function putPreference(key, value) {
  await run(PREFERENCES, 'readwrite', (s) => s.put({ key, value, saved: Date.now() }));
  return value;
}

/** True when storage is usable at all. A private window with site data
 *  blocked should degrade to "official content only", not to a broken app. */
export async function available() {
  try {
    await open();
    return true;
  } catch (_err) {
    return false;
  }
}
