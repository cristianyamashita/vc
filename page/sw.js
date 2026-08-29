/* Desktop OS offline cache. Scope is this directory (page/). */
const CACHE_PREFIX = "vc-os-offline-";
const FALLBACK = "os/offline.html";

let activeVersion = "";

function pageBase() {
  return new URL("./", self.location.href);
}

function toAbs(url) {
  try {
    return new URL(url, pageBase()).href;
  } catch (_err) {
    return "";
  }
}

function cacheNameFor(version) {
  return CACHE_PREFIX + (version || activeVersion || "pending");
}

async function resolveCacheName() {
  if (activeVersion) return cacheNameFor(activeVersion);
  const keys = await caches.keys();
  const found = keys.filter((key) => key.startsWith(CACHE_PREFIX)).sort();
  if (found.length) {
    activeVersion = found[found.length - 1].slice(CACHE_PREFIX.length);
    return found[found.length - 1];
  }
  return cacheNameFor("pending");
}

function isQuotaError(err) {
  if (!err) return false;
  const name = err.name || "";
  const message = String(err.message || err);
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(message)
  );
}

async function putUrl(cache, url) {
  const abs = toAbs(url);
  if (!abs) return false;
  try {
    const res = await fetch(abs, { cache: "reload", credentials: "same-origin", mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    await cache.put(abs, res.clone());
    if ((res.headers.get("content-type") || "").includes("text/css")) {
      await cacheCssDeps(cache, res, abs);
    }
    return true;
  } catch (err) {
    if (isQuotaError(err)) throw err;
    try {
      const opaque = await fetch(abs, { cache: "reload", mode: "no-cors" });
      if (opaque && opaque.type === "opaque") {
        await cache.put(abs, opaque);
        return true;
      }
    } catch (_err) {}
    return false;
  }
}

async function cacheCssDeps(cache, response, href) {
  let text = "";
  try {
    text = await response.clone().text();
  } catch (_err) {
    return;
  }
  const matches = text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g);
  for (const match of matches) {
    const raw = (match[1] || "").trim();
    if (!raw || raw.startsWith("data:")) continue;
    try {
      const dep = new URL(raw, href).href;
      if (!dep.startsWith("http")) continue;
      await putUrl(cache, dep);
    } catch (_err) {}
  }
}

async function mapPool(items, limit, fn) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current], current);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: n }, worker));
}

async function cacheUrls(urls, version, port) {
  const list = Array.from(new Set((urls || []).map(toAbs).filter(Boolean)));
  const name = cacheNameFor(version);
  const cache = await caches.open(name);
  activeVersion = version || activeVersion;
  let done = 0;
  let failed = 0;
  const failedUrls = [];
  const total = list.length;
  try {
    await mapPool(list, 6, async (url) => {
      const ok = await putUrl(cache, url);
      done += 1;
      if (!ok) {
        failed += 1;
        if (failedUrls.length < 24) failedUrls.push(url);
      }
      if (port) {
        port.postMessage({ type: "progress", done, total, failed, url });
      }
    });
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== name)
        .map((key) => caches.delete(key))
    );
    if (port) port.postMessage({ type: "done", done, total, failed, failedUrls });
  } catch (err) {
    if (port) {
      port.postMessage({
        type: "error",
        error: isQuotaError(err) ? "quota" : String((err && err.message) || err),
      });
    }
    throw err;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (data.type === "cachePack" || data.type === "cacheUrls") {
    if (data.version) activeVersion = data.version;
    event.waitUntil(
      cacheUrls(data.urls || [], data.version || activeVersion, port).catch(() => {})
    );
    return;
  }
  if (data.type === "clearCache") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
        activeVersion = "";
        if (port) port.postMessage({ type: "done", done: 0, total: 0, failed: 0 });
      })()
    );
  }
});

function isNavigate(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try {
    url = new URL(request.url);
  } catch (_err) {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (request.headers.has("range")) return;

  event.respondWith(
    (async () => {
      const name = await resolveCacheName();
      const cache = await caches.open(name);
      const cached = await cache.match(request, { ignoreSearch: true });
      const networkPromise = fetch(request)
        .then(async (res) => {
          if (res && (res.ok || res.type === "opaque")) {
            try {
              await cache.put(request, res.clone());
            } catch (_err) {}
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }
      const fresh = await networkPromise;
      if (fresh) return fresh;
      if (isNavigate(request)) {
        const fallback = await cache.match(new URL(FALLBACK, pageBase()));
        if (fallback) return fallback;
      }
      return new Response("Offline", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain" } });
    })()
  );
});
