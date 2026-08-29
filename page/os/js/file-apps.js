window.OSFileApps = (function () {
  const HANDLERS = [
    { appId: "notepad", exts: ["txt", "log", "ini", "text"], defaultFor: ["txt", "log", "ini", "text"] },
    { appId: "utils-wordpad", exts: ["txt", "html", "htm"], defaultFor: ["html", "htm"] },
    { appId: "utils-markdown", exts: ["md", "markdown"], defaultFor: ["md", "markdown"] },
    { appId: "utils-obsidian", exts: ["md", "markdown"] },
    { appId: "utils-data_explorer", exts: ["json", "csv", "tsv"], defaultFor: ["json", "tsv"] },
    { appId: "sheets", exts: ["vcsh", "xlsx", "xls", "csv", "json"], defaultFor: ["vcsh", "xlsx", "xls", "csv"] },
    { appId: "paint", exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] },
    { appId: "preview", exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico", "pdf"] },
    {
      appId: "utils-ps2",
      exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico", "svg"],
      defaultFor: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico"],
    },
    { appId: "utils-ps1", exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico", "svg"] },
    { appId: "utils-whiteboard", exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico", "svg"] },
    { appId: "utils-pdf_toolbox", exts: ["pdf"], defaultFor: ["pdf"] },
    { appId: "utils-vector_editor", exts: ["svg"], defaultFor: ["svg"] },
  ];

  const MIME_EXT = {
    "text/plain": "txt",
    "text/html": "html",
    "text/markdown": "md",
    "application/json": "json",
    "text/csv": "csv",
    "text/tab-separated-values": "tsv",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/avif": "avif",
    "image/x-icon": "ico",
    "image/svg+xml": "svg",
    "application/vnd.vc.sheets+json": "vcsh",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };

  function extOfName(name) {
    const text = String(name || "");
    const i = text.lastIndexOf(".");
    if (i <= 0) return "";
    return text.slice(i + 1).toLowerCase();
  }

  function extOf(node) {
    if (!node) return "";
    const fromName = extOfName(node.name);
    if (fromName) return fromName;
    const mime = String(node.mime || "").split(";")[0].trim().toLowerCase();
    return MIME_EXT[mime] || "";
  }

  function handlers() {
    return HANDLERS.slice();
  }

  function allExts() {
    const set = new Set();
    HANDLERS.forEach((handler) => (handler.exts || []).forEach((ext) => set.add(ext)));
    return Array.from(set).sort();
  }

  function capableAppIds(ext) {
    const key = String(ext || "").replace(/^\./, "").toLowerCase();
    const ids = [];
    HANDLERS.forEach((handler) => {
      if ((handler.exts || []).includes(key) && !ids.includes(handler.appId)) ids.push(handler.appId);
    });
    return ids;
  }

  function defaultPrefs() {
    const out = {};
    HANDLERS.forEach((handler) => {
      (handler.exts || []).forEach((ext) => {
        if (!out[ext]) out[ext] = { apps: [], default: null };
        if (!out[ext].apps.includes(handler.appId)) out[ext].apps.push(handler.appId);
      });
      (handler.defaultFor || []).forEach((ext) => {
        if (!out[ext]) out[ext] = { apps: [handler.appId], default: handler.appId };
        if (!out[ext].apps.includes(handler.appId)) out[ext].apps.unshift(handler.appId);
        if (!out[ext].default) out[ext].default = handler.appId;
      });
    });
    return out;
  }

  function userMap() {
    const raw = window.OS && window.OS.state && window.OS.state.fileApps;
    return raw && typeof raw === "object" ? raw : {};
  }

  function prefs() {
    const defaults = defaultPrefs();
    const user = userMap();
    const out = {};
    allExts().forEach((ext) => {
      const capable = capableAppIds(ext);
      const base = defaults[ext] || { apps: capable.slice(), default: capable[0] || null };
      const overlay = user[ext];
      if (!overlay || typeof overlay !== "object") {
        const apps = (base.apps || []).filter((id) => capable.includes(id));
        const def = base.default && capable.includes(base.default) ? base.default : null;
        out[ext] = { apps, default: def };
        return;
      }
      const apps = (Array.isArray(overlay.apps) ? overlay.apps : []).filter((id) => capable.includes(id));
      let def = typeof overlay.default === "string" ? overlay.default : null;
      if (!apps.includes(def)) def = apps[0] || null;
      out[ext] = { apps, default: def };
    });
    return out;
  }

  function prefFor(ext) {
    const key = String(ext || "").replace(/^\./, "").toLowerCase();
    return prefs()[key] || { apps: [], default: null };
  }

  function enabledApps(ext) {
    return prefFor(ext).apps.slice();
  }

  function defaultAppId(ext) {
    return prefFor(ext).default || null;
  }

  function defaultAppIdFor(node) {
    return defaultAppId(extOf(node));
  }

  function enabledAppsFor(node) {
    return enabledApps(extOf(node));
  }

  function persistUser(next) {
    if (!window.OS || !window.OS.state) return;
    window.OS.state.fileApps = next;
    if (typeof window.OS.persistNow === "function") window.OS.persistNow();
    else if (typeof window.OS.persistSession === "function") window.OS.persistSession();
  }

  function setExtPref(ext, next) {
    const key = String(ext || "").replace(/^\./, "").toLowerCase();
    const capable = capableAppIds(key);
    const apps = (next && Array.isArray(next.apps) ? next.apps : []).filter((id) => capable.includes(id));
    let def = next && typeof next.default === "string" ? next.default : null;
    if (!apps.includes(def)) def = apps[0] || null;
    const map = Object.assign({}, userMap());
    map[key] = { apps, default: def };
    persistUser(map);
    return map[key];
  }

  function resetDefaults() {
    persistUser({});
  }

  function appLabel(appId) {
    const app = window.OSCatalog && window.OSCatalog.byId(appId);
    const lang = (window.OS && window.OS.lang) || "en";
    if (app && window.OSCatalog.displayName) return window.OSCatalog.displayName(app, lang);
    return appId;
  }

  function openAsItems(node) {
    const ids = enabledAppsFor(node);
    return ids.map((appId) => ({
      act: "openAs:" + appId,
      label: appLabel(appId),
      appId,
    }));
  }

  async function openFile(fileId, appId) {
    if (!fileId || !appId || !window.OSWindows) return null;
    if (window.OS && typeof window.OS.ensureInstalled === "function") window.OS.ensureInstalled(appId);
    let name = "";
    if (window.OSFS) {
      try {
        const node = await window.OSFS.get(fileId);
        if (node && node.name) name = node.name;
      } catch (_err) {}
    }
    if (window.OS && typeof window.OS.rememberRecentFile === "function") {
      window.OS.rememberRecentFile(fileId, appId, name);
    }
    return window.OSWindows.open(appId, { fileId });
  }

  return {
    HANDLERS,
    handlers,
    allExts,
    capableAppIds,
    defaultPrefs,
    prefs,
    prefFor,
    enabledApps,
    enabledAppsFor,
    defaultAppId,
    defaultAppIdFor,
    setExtPref,
    resetDefaults,
    extOf,
    extOfName,
    appLabel,
    openAsItems,
    openFile,
  };
})();
