window.OSOffline = (function () {
  const SW_URL = new URL("../sw.js", window.location.href);
  const listeners = new Set();
  const status = {
    supported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    secure: isSecureContext(),
    enabled: false,
    pack: null,
    lastSync: 0,
    cacheVersion: "",
    phase: "idle",
    done: 0,
    total: 0,
    failed: 0,
    error: "",
    cacheBytes: 0,
    persisted: false,
  };

  function isSecureContext() {
    if (typeof window === "undefined") return false;
    if (window.isSecureContext) return true;
    const host = location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }

  function pageBase() {
    return new URL("../", window.location.href);
  }

  function absFromPage(rel) {
    if (!rel) return "";
    if (/^https?:\/\//i.test(rel)) return rel;
    try {
      return new URL(rel, pageBase()).href;
    } catch (_err) {
      return "";
    }
  }

  function unique(list) {
    return Array.from(new Set((list || []).map(absFromPage).filter(Boolean)));
  }

  function manifest() {
    return window.OSOfflineManifest || { core: [], pages: [], cdn: [], images: [], models: [], version: "" };
  }

  function packUrls(pack, extra) {
    const data = manifest();
    const urls = data.core.concat(data.pages, data.cdn, extra || []);
    if (pack === "full") {
      urls.push.apply(urls, data.images || []);
      urls.push.apply(urls, data.models || []);
    }
    return unique(urls);
  }

  function currentWallpaperUrl() {
    if (!window.OS || !window.OS.wallpaperImageSrc || !window.OS.state) return "";
    const src = window.OS.wallpaperImageSrc(window.OS.state.wallpaperId);
    if (!src || /^blob:/i.test(src)) return "";
    try {
      return new URL(src, window.location.href).href;
    } catch (_err) {
      return "";
    }
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(getStatus());
      } catch (_err) {}
    });
  }

  function getStatus() {
    return Object.assign({}, status);
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.add(fn);
    return function () {
      listeners.delete(fn);
    };
  }

  function readState() {
    const state = window.OS && window.OS.state;
    if (!state) return;
    status.enabled = !!state.offlineEnabled;
    status.pack = state.offlinePack === "full" || state.offlinePack === "lite" ? state.offlinePack : null;
    status.lastSync = Number(state.offlineLastSync) || 0;
    status.cacheVersion = typeof state.offlineCacheVersion === "string" ? state.offlineCacheVersion : "";
    if (status.enabled && status.lastSync && status.phase === "idle") status.phase = "ready";
  }

  function writeState(patch) {
    if (!window.OS || !window.OS.state) return;
    Object.assign(window.OS.state, patch);
    if (window.OS.persistSession) window.OS.persistSession();
  }

  async function registration() {
    if (!status.supported) return null;
    return navigator.serviceWorker.getRegistration(pageBase().href);
  }

  function waitForWorker(reg) {
    if (reg.active) return Promise.resolve(reg.active);
    const pending = reg.installing || reg.waiting;
    if (!pending) return Promise.resolve(null);
    return new Promise((resolve) => {
      pending.addEventListener("statechange", () => {
        if (pending.state === "activated" || pending.state === "installed") {
          resolve(reg.active || pending);
        }
      });
    });
  }

  async function ensureRegistered() {
    if (!status.supported || !status.secure) {
      throw new Error("unsupported");
    }
    let reg = await registration();
    if (!reg) {
      reg = await navigator.serviceWorker.register(SW_URL.href, { scope: pageBase().href });
    }
    await navigator.serviceWorker.ready;
    const worker = await waitForWorker(reg);
    return { reg, worker: worker || reg.active };
  }

  function postToWorker(worker, message) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        reject(new Error("timeout"));
      }, 30 * 60 * 1000);
      channel.port1.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === "progress") {
          status.done = data.done || 0;
          status.total = data.total || 0;
          status.failed = data.failed || 0;
          notify();
          return;
        }
        clearTimeout(timer);
        if (data.type === "error") {
          reject(new Error(data.error || "cache failed"));
          return;
        }
        resolve(data);
      };
      worker.postMessage(message, [channel.port2]);
    });
  }

  async function estimateCacheBytes() {
    let bytes = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        bytes = est.usageDetails && est.usageDetails.caches ? est.usageDetails.caches : est.usage || 0;
      }
    } catch (_err) {}
    status.cacheBytes = bytes;
    return bytes;
  }

  async function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        status.persisted = await navigator.storage.persist();
      }
    } catch (_err) {
      status.persisted = false;
    }
  }

  async function cacheCurrentWallpaper() {
    if (!status.enabled || !status.supported || !navigator.onLine) return;
    const url = currentWallpaperUrl();
    if (!url) return;
    try {
      const { worker } = await ensureRegistered();
      if (!worker) return;
      await postToWorker(worker, {
        type: "cacheUrls",
        version: manifest().version,
        urls: [url],
      });
    } catch (_err) {}
  }

  async function download(pack) {
    if (status.phase === "downloading" || status.phase === "registering" || status.phase === "clearing") {
      return getStatus();
    }
    if (!status.supported) throw new Error("unsupported");
    if (!status.secure) throw new Error("insecure");
    if (!navigator.onLine) throw new Error("offline");
    const nextPack = pack === "full" ? "full" : "lite";
    status.phase = "registering";
    status.error = "";
    status.done = 0;
    status.total = 0;
    status.failed = 0;
    notify();
    await requestPersist();
    const { worker } = await ensureRegistered();
    if (!worker) throw new Error("no-worker");
    const extra = [];
    if (nextPack === "lite") {
      const wallpaper = currentWallpaperUrl();
      if (wallpaper) extra.push(wallpaper);
    }
    const urls = packUrls(nextPack, extra);
    status.phase = "downloading";
    status.total = urls.length;
    notify();
    writeState({ offlineEnabled: true, offlinePack: nextPack });
    try {
      const result = await postToWorker(worker, {
        type: "cachePack",
        version: manifest().version,
        urls,
      });
      const now = Date.now();
      status.enabled = true;
      status.pack = nextPack;
      status.lastSync = now;
      status.cacheVersion = manifest().version;
      status.phase = "ready";
      status.done = result.done || urls.length;
      status.total = result.total || urls.length;
      status.failed = result.failed || 0;
      status.error = "";
      writeState({
        offlineEnabled: true,
        offlinePack: nextPack,
        offlineLastSync: now,
        offlineCacheVersion: manifest().version,
      });
      await estimateCacheBytes();
      notify();
      return result;
    } catch (err) {
      const code = err && err.message === "quota" ? "quota" : "error";
      status.phase = "error";
      status.error = code;
      notify();
      throw err;
    }
  }

  async function disable() {
    if (status.phase === "downloading" || status.phase === "registering" || status.phase === "clearing") {
      return getStatus();
    }
    status.phase = "clearing";
    status.error = "";
    notify();
    try {
      const reg = await registration();
      const worker = reg && (reg.active || reg.waiting || reg.installing);
      if (worker) {
        await postToWorker(worker, { type: "clearCache" }).catch(function () {});
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(function (key) {
          return key.indexOf("vc-os-offline-") === 0;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
      if (reg) await reg.unregister();
    } catch (_err) {}
    status.enabled = false;
    status.pack = null;
    status.lastSync = 0;
    status.cacheVersion = "";
    status.phase = "idle";
    status.done = 0;
    status.total = 0;
    status.failed = 0;
    status.cacheBytes = 0;
    writeState({
      offlineEnabled: false,
      offlinePack: null,
      offlineLastSync: 0,
      offlineCacheVersion: "",
    });
    notify();
  }

  async function syncFromState() {
    readState();
    if (status.enabled && status.supported && status.secure) {
      try {
        await ensureRegistered();
        status.phase = status.lastSync ? "ready" : "idle";
      } catch (_err) {
        status.phase = "error";
        status.error = "error";
      }
    }
    await estimateCacheBytes();
    notify();
  }

  function updateAvailable() {
    const version = manifest().version;
    return !!(status.enabled && version && status.cacheVersion && status.cacheVersion !== version);
  }

  return {
    getStatus,
    subscribe,
    packUrls,
    download,
    disable,
    cacheCurrentWallpaper,
    syncFromState,
    updateAvailable,
    currentWallpaperUrl,
    manifestVersion: function () {
      return manifest().version;
    },
  };
})();
