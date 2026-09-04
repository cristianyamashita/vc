window.OSAnalytics = (function () {
  let lastKey = "";
  let timer = null;

  function safeSegment(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function rootPath() {
    let path = location.pathname || "/os/";
    path = path.replace(/\/index\.html$/i, "");
    if (!path.endsWith("/")) path += "/";
    return path;
  }

  function send(path, title) {
    if (typeof gtag !== "function") return;
    const key = path + "\n" + title;
    if (key === lastKey) return;
    lastKey = key;
    gtag("event", "page_view", {
      page_title: title,
      page_location: location.origin + path,
      page_path: path,
    });
  }

  function schedule(path, title) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      send(path, title);
    }, 200);
  }

  function appLabel(appId) {
    const app = window.OSCatalog && window.OSCatalog.byId(appId);
    const lang = (window.OS && window.OS.lang) || "en";
    if (app && window.OSCatalog.displayName) return window.OSCatalog.displayName(app, lang);
    return appId || "Desktop";
  }

  function trackDesktop() {
    schedule(rootPath(), "Desktop");
  }

  function trackApp(appId, extra) {
    const id = safeSegment(appId);
    if (!id) {
      trackDesktop();
      return;
    }
    const extraSeg = extra ? safeSegment(extra) : "";
    const path = extraSeg ? rootPath() + "app/" + id + "/" + extraSeg : rootPath() + "app/" + id;
    const title = extraSeg ? "Desktop · " + appLabel(appId) + " · " + extraSeg : "Desktop · " + appLabel(appId);
    schedule(path, title);
  }

  function trackSetup(step) {
    const seg = safeSegment(step) || "lang";
    schedule(rootPath() + "setup/" + seg, "Desktop · Setup · " + seg);
  }

  function trackWin(win) {
    if (!win || win.minimized) {
      trackDesktop();
      return;
    }
    const appId = win.appId || (window.OSWindows && window.OSWindows.appIdOf(win.id)) || "";
    if (appId === "settings" && window.OSSettings && typeof window.OSSettings.currentPane === "function") {
      trackApp("settings", window.OSSettings.currentPane() || "preferences");
      return;
    }
    trackApp(appId);
  }

  return {
    trackDesktop,
    trackApp,
    trackSetup,
    trackWin,
  };
})();
