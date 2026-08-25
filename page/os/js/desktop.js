window.OS = (function () {
  const api = {
    lang: "en",
    theme: "dark",
    state: null,
  };

  function htmlLang(lang) {
    if (lang === "pt") return "pt";
    if (lang === "ja") return "ja";
    return "en";
  }

  function isInstalled(id) {
    const app = window.OSCatalog.byId(id);
    if (app && (app.kind === "native" || app.kind === "user")) return true;
    return !!(api.state && api.state.installed.includes(id));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function persistSession() {
    if (!api.state) return;
    const live = window.OSWindows.serialize();
    const liveIds = new Set(live.map((w) => w.id));
    const previous = window.OSState.getLastSaved().windows || [];
    const kept = previous.filter(
      (w) => !liveIds.has(w.id) && !window.OSWindows.closedThisSession.has(w.id)
    );
    api.state.windows = kept.concat(live);
    api.state.focusedId = window.OSWindows.focusedId();
    if (!api.state.placements || typeof api.state.placements !== "object") {
      api.state.placements = {};
    }
    live.forEach((win) => {
      api.state.placements[win.id] = {
        x: win.x,
        y: win.y,
        w: win.w,
        h: win.h,
        maximized: !!win.maximized,
      };
    });
    window.OSState.scheduleSave(api.state);
  }

  function persistNow() {
    persistSession();
    return window.OSState.write(api.state);
  }

  function refreshIframes() {
    document.querySelectorAll(".os-window iframe").forEach((frame) => {
      const src = frame.getAttribute("src");
      if (src) frame.src = src;
    });
  }

  const GRADIENT_WALLPAPERS = ["bloom", "aurora", "dusk", "horizon"];
  const IMAGE_WALLPAPERS = {
    "playground-dark": "../assets/images/hero-playground-dark.png",
    "playground-light": "../assets/images/hero-playground-light.png",
  };
  let wallpaperObjectUrl = null;

  function wallpaperImageSrc(id) {
    return IMAGE_WALLPAPERS[id] || null;
  }

  function refreshInstalledChrome() {
    persistNow();
    renderDesktop();
    if (window.OSStart.isOpen()) window.OSStart.render();
    renderTaskbar();
  }

  const BUSY_MS = 2500;
  let busyTimer = null;

  function showBusy(message) {
    const overlay = document.getElementById("os-busy");
    const text = document.getElementById("os-busy-text");
    if (!overlay || !text) return;
    text.textContent = message;
    overlay.hidden = false;
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = setTimeout(() => {
      overlay.hidden = true;
      busyTimer = null;
    }, BUSY_MS);
  }

  async function applyWallpaper() {
    const el = document.getElementById("wallpaper");
    const id = (api.state && api.state.wallpaperId) || "bloom";
    if (wallpaperObjectUrl) {
      URL.revokeObjectURL(wallpaperObjectUrl);
      wallpaperObjectUrl = null;
    }
    if (el) el.style.backgroundImage = "";
    if (GRADIENT_WALLPAPERS.includes(id)) {
      document.documentElement.dataset.wallpaper = id;
      return;
    }
    const imageSrc = wallpaperImageSrc(id);
    if (imageSrc) {
      document.documentElement.dataset.wallpaper = id;
      if (el) el.style.backgroundImage = `url("${imageSrc}")`;
      return;
    }
    document.documentElement.dataset.wallpaper = "custom";
    try {
      const rec = await window.OSState.getWallpaper(id);
      if (!rec || !rec.blob) {
        api.state.wallpaperId = "bloom";
        document.documentElement.dataset.wallpaper = "bloom";
        persistNow();
        return;
      }
      wallpaperObjectUrl = URL.createObjectURL(rec.blob);
      if (el) el.style.backgroundImage = `url("${wallpaperObjectUrl}")`;
    } catch (err) {
      console.warn("Wallpaper load failed", err);
      document.documentElement.dataset.wallpaper = "bloom";
    }
  }

  function setWallpaper(id) {
    api.state.wallpaperId = id || "bloom";
    persistNow();
    return applyWallpaper();
  }

  function setTheme(theme) {
    api.theme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = api.theme;
    localStorage.setItem("app_theme", api.theme);
    persistNow();
    applyWallpaper();
    refreshIframes();
  }

  function setLang(lang) {
    api.lang = ["en", "pt", "ja"].includes(lang) ? lang : "en";
    document.documentElement.lang = htmlLang(api.lang);
    localStorage.setItem("app_lang", api.lang);
    persistNow();
    refreshChrome();
    refreshIframes();
  }

  function setUsername(name) {
    api.state.username = (name || "").trim() || "User";
    persistNow();
    if (window.OSStart.isOpen()) window.OSStart.render();
  }

  function toggleFavorite(id) {
    const list = api.state.favorites;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    persistNow();
    if (window.OSStart.isOpen()) window.OSStart.render();
  }

  function toggleDesktopIcon(id) {
    const list = api.state.desktopIcons;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    persistNow();
    renderDesktop();
  }

  function toggleInstalled(id) {
    const app = window.OSCatalog.byId(id);
    if (!app || !app.uninstallable) return;
    const installing = !api.state.installed.includes(id);
    const name = window.OSCatalog.displayName(app, api.lang);
    showBusy(window.OSI18n.t(installing ? "installingApp" : "uninstallingApp", { name }));
    const list = api.state.installed;
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      api.state.favorites = api.state.favorites.filter((item) => item !== id);
      api.state.desktopIcons = api.state.desktopIcons.filter((item) => item !== id);
      if (window.OSWindows.has(id)) window.OSWindows.close(id);
    } else {
      list.push(id);
    }
    refreshInstalledChrome();
  }

  function installAll() {
    showBusy(window.OSI18n.t("installingAll"));
    const ids = window.OSCatalog.stableSiteApps().map((app) => app.id);
    const next = new Set(api.state.installed.concat(ids));
    api.state.installed = ["settings", ...Array.from(next).filter((id) => id !== "settings")];
    refreshInstalledChrome();
  }

  function uninstallAll() {
    showBusy(window.OSI18n.t("uninstallingAll"));
    const removable = new Set(window.OSCatalog.stableSiteApps().map((app) => app.id));
    api.state.installed = api.state.installed.filter((id) => !removable.has(id));
    if (!api.state.installed.includes("settings")) api.state.installed.unshift("settings");
    api.state.favorites = api.state.favorites.filter((id) => !removable.has(id));
    api.state.desktopIcons = api.state.desktopIcons.filter((id) => !removable.has(id));
    window.OSWindows.list()
      .map((win) => win.id)
      .filter((id) => removable.has(id))
      .forEach((id) => window.OSWindows.close(id));
    refreshInstalledChrome();
  }

  function installPrerelease() {
    showBusy(window.OSI18n.t("installingPrerelease"));
    const ids = window.OSCatalog.prereleaseSiteApps().map((app) => app.id);
    const next = new Set(api.state.installed.concat(ids));
    api.state.installed = ["settings", ...Array.from(next).filter((id) => id !== "settings")];
    refreshInstalledChrome();
  }

  function registerUserApp(id) {
    if (!id || !api.state) return;
    if (!api.state.installed.includes(id)) api.state.installed.push(id);
    if (!api.state.desktopIcons.includes(id)) api.state.desktopIcons.push(id);
    refreshInstalledChrome();
  }

  function unregisterUserApp(id) {
    if (!id || !api.state) return;
    api.state.installed = api.state.installed.filter((item) => item !== id);
    api.state.favorites = api.state.favorites.filter((item) => item !== id);
    api.state.desktopIcons = api.state.desktopIcons.filter((item) => item !== id);
    if (window.OSWindows.has(id)) window.OSWindows.close(id);
    refreshInstalledChrome();
  }

  function renderDesktop() {
    const root = document.getElementById("desktop");
    const lang = api.lang;
    const icons = (api.state.desktopIcons || [])
      .map((id) => window.OSCatalog.byId(id))
      .filter((app) => app && isInstalled(app.id));
    if (!icons.length) {
      root.innerHTML = `<p class="desktop-empty">${window.OSI18n.t("emptyDesktop")}</p>`;
      return;
    }
    root.innerHTML = icons
      .map(
        (app) => `
        <button type="button" class="desktop-icon" data-app-id="${escapeHtml(app.id)}">
          <img src="${escapeHtml(app.icon)}" alt="">
          <span>${escapeHtml(window.OSCatalog.displayName(app, lang))}</span>
        </button>`
      )
      .join("");
  }

  function renderTaskbar() {
    const bar = document.getElementById("taskbar-apps");
    const focused = window.OSWindows.focusedId();
    const lang = api.lang;
    bar.innerHTML = window.OSWindows.list()
      .sort((a, b) => a.z - b.z)
      .map((win) => {
        const app = window.OSCatalog.byId(win.id);
        if (!app) return "";
        const active = win.id === focused && !win.minimized ? " active" : "";
        return `<button type="button" class="task-btn${active}" data-task-id="${escapeHtml(win.id)}">
          <img src="${escapeHtml(app.icon)}" alt="">
          <span>${escapeHtml(window.OSCatalog.displayName(app, lang))}</span>
        </button>`;
      })
      .join("");
  }

  function refreshChrome() {
    window.OSI18n.apply();
    renderDesktop();
    renderTaskbar();
    window.OSWindows.refreshTitles();
    if (window.OSStart.isOpen()) window.OSStart.render();
    window.OSSettings.remountOpen();
    if (window.OSAppBuilder) window.OSAppBuilder.remountOpen();
    document.getElementById("start-btn").setAttribute("aria-label", window.OSI18n.t("start"));
    document.getElementById("start-btn").setAttribute("title", window.OSI18n.t("start"));
  }

  function tickClock() {
    const el = document.getElementById("clock");
    const locale = api.lang === "ja" ? "ja-JP" : api.lang === "pt" ? "pt-BR" : "en-US";
    el.textContent = new Date().toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  }

  function bindUi() {
    const desktop = document.getElementById("desktop");
    desktop.addEventListener("click", (e) => {
      const icon = e.target.closest(".desktop-icon");
      desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
      if (icon) icon.classList.add("selected");
    });
    desktop.addEventListener("dblclick", (e) => {
      const icon = e.target.closest(".desktop-icon");
      if (icon) window.OSWindows.open(icon.dataset.appId);
    });
    desktop.addEventListener("contextmenu", (e) => {
      const icon = e.target.closest(".desktop-icon");
      if (!icon) return;
      e.preventDefault();
      e.stopPropagation();
      desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
      icon.classList.add("selected");
      window.OSStart.close();
      window.OSStart.showContext(icon.dataset.appId, e.clientX, e.clientY);
    });
    document.getElementById("taskbar-apps").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-task-id]");
      if (btn) window.OSWindows.toggleTask(btn.dataset.taskId);
    });
  }

  async function boot() {
    const savedTheme = localStorage.getItem("app_theme");
    const savedLang = localStorage.getItem("app_lang");
    api.theme = savedTheme === "light" ? "light" : "dark";
    api.lang = ["en", "pt", "ja"].includes(savedLang) ? savedLang : "en";
    document.documentElement.dataset.theme = api.theme;
    document.documentElement.lang = htmlLang(api.lang);

    api.state = await window.OSState.load();
    if (!api.state.installed.includes("settings")) api.state.installed.unshift("settings");
    if (window.OSAppBuilder) await window.OSAppBuilder.hydrate();
    await applyWallpaper();

    window.OSWindows.init();
    window.OSStart.init();
    bindUi();
    refreshChrome();
    tickClock();
    setInterval(tickClock, 1000);

    const hash = window.OSWindows.parseHash();
    const hashApp = hash && window.OSCatalog.byId(hash.id);
    if (hash && hashApp && isInstalled(hashApp.id)) {
      window.OSWindows.open(hashApp.id, { x: hash.x, y: hash.y, w: hash.w, h: hash.h, fromHash: true });
    } else {
      window.OSWindows.restoreList(api.state.windows, api.state.focusedId);
    }
  }

  api.isInstalled = isInstalled;
  api.persistSession = persistSession;
  api.setTheme = setTheme;
  api.setLang = setLang;
  api.setUsername = setUsername;
  api.toggleFavorite = toggleFavorite;
  api.toggleDesktopIcon = toggleDesktopIcon;
  api.toggleInstalled = toggleInstalled;
  api.installAll = installAll;
  api.uninstallAll = uninstallAll;
  api.installPrerelease = installPrerelease;
  api.registerUserApp = registerUserApp;
  api.unregisterUserApp = unregisterUserApp;
  api.setWallpaper = setWallpaper;
  api.applyWallpaper = applyWallpaper;
  api.wallpaperImageSrc = wallpaperImageSrc;
  api.BUILTIN_WALLPAPERS = [...GRADIENT_WALLPAPERS, "playground-dark", "playground-light"];
  api.renderDesktop = renderDesktop;
  api.renderTaskbar = renderTaskbar;
  api.refreshChrome = refreshChrome;
  api.boot = boot;
  return api;
})();

document.addEventListener("DOMContentLoaded", () => window.OS.boot());
