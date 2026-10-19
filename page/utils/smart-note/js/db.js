/* Smart Note — IndexedDB storage (SmartNoteDB: docs, assets). */
window.SNDB = (function () {
  const NAME = 'SmartNoteDB';
  const VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('docs')) {
          const docs = db.createObjectStore('docs', { keyPath: 'id' });
          docs.createIndex('parentId', 'parentId', { unique: false });
        }
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      try { result = fn(s); } catch (err) { reject(err); return; }
      t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const api = {
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    allDocs() { return tx('docs', 'readonly', (s) => s.getAll()).then((r) => r || []); },
    getDoc(id) { return tx('docs', 'readonly', (s) => s.get(id)); },
    putDoc(doc) { return tx('docs', 'readwrite', (s) => s.put(doc)); },
    putDocs(docs) { return tx('docs', 'readwrite', (s) => { docs.forEach((d) => s.put(d)); }); },
    deleteDocs(ids) { return tx('docs', 'readwrite', (s) => { ids.forEach((id) => s.delete(id)); }); },
    getAsset(id) { return tx('assets', 'readonly', (s) => s.get(id)); },
    putAsset(asset) { return tx('assets', 'readwrite', (s) => s.put(asset)); },
    allAssets() { return tx('assets', 'readonly', (s) => s.getAll()).then((r) => r || []); },
    deleteAssets(ids) { return tx('assets', 'readwrite', (s) => { ids.forEach((id) => s.delete(id)); }); },
  };
  return api;
})();
