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

  function notifyNativeFrames() {
    document.querySelectorAll(".os-window iframe.native-frame").forEach((frame) => {
      try {
        if (frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "os-host-sync" }, location.origin);
        }
      } catch (_err) {}
    });
  }

  function refreshIframes() {
    document.querySelectorAll(".os-window iframe").forEach((frame) => {
      if (frame.classList.contains("native-frame")) return;
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
    notifyNativeFrames();
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
    if (window.OSFileExplorer && window.OSFileExplorer.refreshOpen) window.OSFileExplorer.refreshOpen();
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
      .filter((win) => removable.has(window.OSWindows.appIdOf(win.id)))
      .forEach((win) => window.OSWindows.close(win.id));
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

  let desktopGen = 0;

  async function renderDesktop() {
    const root = document.getElementById("desktop");
    const lang = api.lang;
    const gen = ++desktopGen;
    const apps = (api.state.desktopIcons || [])
      .map((id) => window.OSCatalog.byId(id))
      .filter((app) => app && isInstalled(app.id));
    let files = [];
    try {
      if (window.OSFS) {
        await window.OSFS.ready();
        files = await window.OSFS.listDesktop();
      }
    } catch (_err) {
      files = [];
    }
    if (gen !== desktopGen) return;
    const appHtml = apps
      .map(
        (app) => `
        <button type="button" class="desktop-icon" data-app-id="${escapeHtml(app.id)}">
          <img src="${escapeHtml(app.icon)}" alt="">
          <span>${escapeHtml(window.OSCatalog.displayName(app, lang))}</span>
        </button>`
      )
      .join("");
    const fileHtml = files
      .map((node) => {
        return `<button type="button" class="desktop-icon desktop-fs" data-fs-id="${escapeHtml(node.id)}" draggable="true">
          ${window.OSFS.iconFor(node)}
          <span>${escapeHtml(node.name)}</span>
        </button>`;
      })
      .join("");
    const empty = !apps.length && !files.length ? `<p class="desktop-empty">${window.OSI18n.t("emptyDesktop")}</p>` : "";
    root.innerHTML = appHtml + fileHtml + empty;
  }

  function renderTaskbar() {
    const bar = document.getElementById("taskbar-apps");
    const focused = window.OSWindows.focusedId();
    const lang = api.lang;
    const explorerOpen = window.OSWindows.list().some((win) => window.OSWindows.appIdOf(win.id) === "file-explorer");
    const pin = document.getElementById("explorer-pin");
    if (pin) {
      pin.classList.toggle("active", explorerOpen && window.OSWindows.appIdOf(focused) === "file-explorer");
      const label = window.OSI18n.t("fileExplorer");
      pin.setAttribute("aria-label", label);
      pin.setAttribute("title", label);
    }
    bar.innerHTML = window.OSWindows.list()
      .sort((a, b) => a.z - b.z)
      .map((win) => {
        const app = window.OSCatalog.byId(win.appId || window.OSWindows.appIdOf(win.id));
        if (!app) return "";
        const active = win.id === focused && !win.minimized ? " active" : "";
        const title = win.titleName || window.OSCatalog.displayName(app, lang);
        return `<button type="button" class="task-btn${active}" data-task-id="${escapeHtml(win.id)}">
          <img src="${escapeHtml(app.icon)}" alt="">
          <span>${escapeHtml(title)}</span>
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
    if (window.OSFileExplorer) window.OSFileExplorer.remountOpen();
    notifyNativeFrames();
    document.getElementById("start-btn").setAttribute("aria-label", window.OSI18n.t("start"));
    document.getElementById("start-btn").setAttribute("title", window.OSI18n.t("start"));
    const pin = document.getElementById("explorer-pin");
    if (pin) {
      pin.setAttribute("aria-label", window.OSI18n.t("fileExplorer"));
      pin.setAttribute("title", window.OSI18n.t("fileExplorer"));
    }
    syncFullscreenButton();
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function tickClock() {
    const el = document.getElementById("clock");
    const now = new Date();
    const stamp =
      now.getFullYear() +
      "-" +
      pad2(now.getMonth() + 1) +
      "-" +
      pad2(now.getDate()) +
      " " +
      pad2(now.getHours()) +
      ":" +
      pad2(now.getMinutes());
    el.textContent = stamp;
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function fullscreenEnterIcon() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 6V3h3M13 6V3H10M3 10v3h3M13 10v3h-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/>
    </svg>`;
  }

  function fullscreenExitIcon() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3v3H3M10 3v3h3M6 13v-3H3M10 13v-3h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/>
    </svg>`;
  }

  function syncFullscreenButton() {
    const btn = document.getElementById("tray-fullscreen");
    if (!btn) return;
    const on = isFullscreen();
    const key = on ? "exitFullscreen" : "enterFullscreen";
    const label = window.OSI18n.t(key);
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
    btn.setAttribute("data-i18n-aria", key);
    btn.setAttribute("data-i18n-title", key);
    btn.classList.toggle("active", on);
    btn.innerHTML = on ? fullscreenExitIcon() : fullscreenEnterIcon();
  }

  async function toggleFullscreen() {
    try {
      if (isFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const root = document.documentElement;
        const enter = root.requestFullscreen || root.webkitRequestFullscreen;
        if (enter) await enter.call(root);
      }
    } catch (_err) {
      /* user cancelled or the browser blocked fullscreen */
    }
    syncFullscreenButton();
  }

  function bindUi() {
    const desktop = document.getElementById("desktop");
    desktop.addEventListener("click", (e) => {
      const icon = e.target.closest(".desktop-icon");
      desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
      if (icon) icon.classList.add("selected");
    });
    desktop.addEventListener("dblclick", async (e) => {
      const icon = e.target.closest(".desktop-icon");
      if (!icon) return;
      if (icon.dataset.fsId && window.OSFileExplorer) {
        const node = await window.OSFS.get(icon.dataset.fsId);
        await window.OSFileExplorer.openDesktopNode(node);
        return;
      }
      if (icon.dataset.appId) window.OSWindows.open(icon.dataset.appId);
    });
    desktop.addEventListener("contextmenu", async (e) => {
      const icon = e.target.closest(".desktop-icon");
      window.OSStart.close();
      if (icon && icon.dataset.appId) {
        e.preventDefault();
        e.stopPropagation();
        desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
        icon.classList.add("selected");
        window.OSStart.showContext(icon.dataset.appId, e.clientX, e.clientY);
        return;
      }
      if (icon && icon.dataset.fsId) {
        e.preventDefault();
        e.stopPropagation();
        desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
        icon.classList.add("selected");
        const node = await window.OSFS.get(icon.dataset.fsId);
        const clip = window.OSFS.getClipboard();
        const items = [
          { act: "open", label: window.OSI18n.t("feOpen") },
          { act: "cut", label: window.OSI18n.t("feCut") },
          { act: "copy", label: window.OSI18n.t("feCopy") },
          { act: "paste", label: window.OSI18n.t("fePaste"), disabled: !(clip && clip.ids.length) },
          { sep: true },
          { act: "rename", label: window.OSI18n.t("feRename") },
          { act: "delete", label: window.OSI18n.t("feDelete") },
          { sep: true },
          { act: "properties", label: window.OSI18n.t("feProperties") },
        ];
        window.OSStart.showItems(items, e.clientX, e.clientY, async (act) => {
          if (!node) return;
          if (act === "open") await window.OSFileExplorer.openDesktopNode(node);
          if (act === "cut") window.OSFS.setClipboard("cut", [node.id]);
          if (act === "copy") window.OSFS.setClipboard("copy", [node.id]);
          if (act === "paste") await window.OSFS.paste(window.OSFS.DESKTOP_ID);
          if (act === "rename") {
            const name = await window.OSFileExplorer.promptName(window.OSI18n.t("feRename"), node.name);
            if (name) await window.OSFS.rename(node.id, name);
          }
          if (act === "delete") {
            if (confirm(window.OSI18n.t("feConfirmDelete"))) await window.OSFS.remove(node.id);
          }
          if (act === "properties") await window.OSFileExplorer.propertiesFor(node);
        });
        return;
      }
      e.preventDefault();
      const clip = window.OSFS.getClipboard();
      window.OSStart.showItems(
        [
          { act: "newFolder", label: window.OSI18n.t("feNewFolder") },
          { act: "paste", label: window.OSI18n.t("fePaste"), disabled: !(clip && clip.ids.length) },
        ],
        e.clientX,
        e.clientY,
        async (act) => {
          if (act === "newFolder") await window.OSFileExplorer.newFolder(window.OSFS.DESKTOP_ID);
          if (act === "paste") await window.OSFS.paste(window.OSFS.DESKTOP_ID);
        }
      );
    });
    desktop.addEventListener("dragstart", (e) => {
      const icon = e.target.closest("[data-fs-id]");
      if (!icon || !window.OSFileExplorer) return;
      e.dataTransfer.setData(window.OSFileExplorer.DRAG_MIME, JSON.stringify({ ids: [icon.dataset.fsId] }));
      e.dataTransfer.effectAllowed = "copyMove";
    });
    desktop.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      const types = [...e.dataTransfer.types];
      if (!types.includes("Files") && !(window.OSFileExplorer && types.includes(window.OSFileExplorer.DRAG_MIME))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
    });
    desktop.addEventListener("drop", async (e) => {
      e.preventDefault();
      const folder = e.target.closest("[data-fs-id]");
      let dest = window.OSFS.DESKTOP_ID;
      if (folder) {
        const node = await window.OSFS.get(folder.dataset.fsId);
        if (node && node.kind === "folder") dest = node.id;
      }
      await window.OSFileExplorer.dropOn(null, dest, e);
    });
    document.getElementById("taskbar-apps").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-task-id]");
      if (btn) window.OSWindows.toggleTask(btn.dataset.taskId);
    });
    const pin = document.getElementById("explorer-pin");
    if (pin) {
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        window.OSStart.close();
        window.OSStart.closeContext();
        window.OSWindows.open("file-explorer");
      });
      pin.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.OSStart.close();
        window.OSStart.showItems(
          [
            { act: "open", label: window.OSI18n.t("fileExplorer") },
            { act: "newWindow", label: window.OSI18n.t("feNewWindow") },
          ],
          e.clientX,
          e.clientY,
          (act) => {
            if (act === "open") window.OSWindows.open("file-explorer");
            if (act === "newWindow") window.OSWindows.open("file-explorer", { newInstance: true });
          }
        );
      });
    }
    document.getElementById("tray-fullscreen").addEventListener("click", () => {
      toggleFullscreen();
    });
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
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
    if (window.OSFS) await window.OSFS.ready();
    if (window.OSAppBuilder) await window.OSAppBuilder.hydrate();
    await applyWallpaper();

    window.OSWindows.init();
    window.OSStart.init();
    bindUi();
    refreshChrome();
    tickClock();
    setInterval(tickClock, 1000);

    const hash = window.OSWindows.parseHash();
    const hashApp = hash && window.OSCatalog.byId(window.OSWindows.appIdOf(hash.id));
    if (hash && hashApp && isInstalled(hashApp.id)) {
      window.OSWindows.open(hash.id, { x: hash.x, y: hash.y, w: hash.w, h: hash.h, fromHash: true });
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
