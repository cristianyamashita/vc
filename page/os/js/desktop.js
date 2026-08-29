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
    document.querySelectorAll(".os-window iframe").forEach((frame) => {
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
  const PHOTO_WALLPAPER_COUNT = 25;
  const PHOTO_WALLPAPER_IDS = Array.from({ length: PHOTO_WALLPAPER_COUNT }, (_, i) => `wp${i + 1}`);
  const IMAGE_WALLPAPERS = {
    "playground-dark": "../assets/images/hero-playground-dark.png",
    "playground-light": "../assets/images/hero-playground-light.png",
  };
  PHOTO_WALLPAPER_IDS.forEach((id) => {
    IMAGE_WALLPAPERS[id] = `../assets/images/${id}.png`;
  });
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
    const done = applyWallpaper();
    if (window.OSOffline && window.OSOffline.cacheCurrentWallpaper) {
      Promise.resolve(done).then(function () {
        window.OSOffline.cacheCurrentWallpaper();
      });
    }
    return done;
  }

  function setIconColor(value) {
    const hex = window.OSIconColor.parse(value);
    api.state.iconColor = hex;
    window.OSState.scheduleSave(api.state);
    const done = window.OSIconColor.apply();
    renderDesktop();
    renderTaskbar();
    if (window.OSStart.isOpen()) window.OSStart.render();
    window.OSWindows.refreshTitles();
    if (window.OSFileExplorer && window.OSFileExplorer.refreshOpen) window.OSFileExplorer.refreshOpen();
    return done;
  }

  function setTheme(theme) {
    api.theme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = api.theme;
    localStorage.setItem("app_theme", api.theme);
    persistNow();
    applyWallpaper();
    notifyNativeFrames();
    applyIframeGlass();
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

  function pinnedIds() {
    const raw = api.state && api.state.taskbarPins;
    const list = Array.isArray(raw) && raw.length ? raw.slice() : ["file-explorer"];
    return list.filter((id) => {
      const app = window.OSCatalog.byId(id);
      if (!app) return false;
      if (app.kind === "native" || app.kind === "user") return true;
      return isInstalled(id);
    });
  }

  function isPinned(id) {
    return pinnedIds().includes(id);
  }

  function toggleTaskbarPin(id) {
    if (!id || !api.state) return;
    const app = window.OSCatalog.byId(id);
    if (!app) return;
    if (!api.state.taskbarPins) api.state.taskbarPins = ["file-explorer"];
    const list = api.state.taskbarPins;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    persistNow();
    renderTaskbar();
    if (window.OSStart && window.OSStart.isOpen()) window.OSStart.render();
  }

  function rememberRecentFile(fileId, appId, name) {
    if (!fileId || !api.state) return;
    const list = Array.isArray(api.state.recentFiles) ? api.state.recentFiles : [];
    api.state.recentFiles = [{ id: fileId, appId: appId || null, name: name || "", at: Date.now() }]
      .concat(list.filter((item) => item && item.id !== fileId))
      .slice(0, 24);
    persistSession();
  }

  function recentFilesFor(appId) {
    const list = Array.isArray(api.state && api.state.recentFiles) ? api.state.recentFiles : [];
    return list.filter((item) => !appId || item.appId === appId).slice(0, 8);
  }

  function applyReducedMotion(on) {
    const enabled = !!on;
    if (api.state) api.state.reducedMotion = enabled;
    document.documentElement.dataset.motion = enabled ? "reduce" : "full";
    applyAppearance({}, false);
    persistNow();
  }

  function clampGlass(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 86;
    return Math.min(100, Math.max(40, Math.round(v)));
  }

  function clampBlur(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 20;
    return Math.min(40, Math.max(0, Math.round(v)));
  }

  function clampNight(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.min(80, Math.max(0, Math.round(v)));
  }

  function clampIconSize(value) {
    return value === "s" || value === "l" ? value : "m";
  }

  function applyIframeGlass(iframe) {
    const frames = iframe ? [iframe] : Array.from(document.querySelectorAll(".os-window iframe"));
    const glass = api.state ? clampGlass(api.state.glass) : 86;
    const blur = api.state ? clampBlur(api.state.blur) : 20;
    const solid = document.documentElement.dataset.glass === "solid";
    const pct = glass + "%";
    const blurPx = document.documentElement.dataset.motion === "reduce" || solid ? "0px" : blur + "px";
    frames.forEach((frame) => {
      try {
        const doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        const html = doc.documentElement;
        html.style.setProperty("--glass-pct", pct);
        html.style.setProperty("--glass-blur", blurPx);
        html.style.setProperty("--glass-alpha", String(glass / 100));
        html.dataset.glass = solid ? "solid" : "acrylic";
        html.style.background = "transparent";
        const src = frame.getAttribute("src") || "";
        const skip =
          /terminal\.html/.test(src) ||
          /\/os\/apps\//.test(src) ||
          !!(doc.defaultView && doc.defaultView.OSAppFrame);
        let tag = doc.getElementById("os-host-glass");
        if (skip || solid) {
          if (tag) tag.remove();
          return;
        }
        if (!tag) {
          tag = doc.createElement("style");
          tag.id = "os-host-glass";
          (doc.head || html).appendChild(tag);
        }
        tag.textContent =
          "html{background:transparent!important}" +
          "body{background:color-mix(in srgb, var(--bg, Canvas) var(--glass-pct, 86%), transparent)!important}";
      } catch (_err) {}
    });
  }

  function applyAppearance(patch, persist) {
    if (!api.state) return;
    const prevSize = clampIconSize(api.state.iconSize);
    if (patch && typeof patch === "object") {
      if (patch.glass != null) api.state.glass = clampGlass(patch.glass);
      if (patch.blur != null) api.state.blur = clampBlur(patch.blur);
      if (patch.nightLight != null) api.state.nightLight = clampNight(patch.nightLight);
      if (patch.iconSize != null) api.state.iconSize = clampIconSize(patch.iconSize);
    }
    const glass = clampGlass(api.state.glass);
    const blur = clampBlur(api.state.blur);
    const night = clampNight(api.state.nightLight);
    const iconSize = clampIconSize(api.state.iconSize);
    api.state.glass = glass;
    api.state.blur = blur;
    api.state.nightLight = night;
    api.state.iconSize = iconSize;
    const root = document.documentElement;
    const reduce = root.dataset.motion === "reduce";
    root.style.setProperty("--glass-alpha", String(glass / 100));
    root.style.setProperty("--glass-pct", glass + "%");
    root.style.setProperty("--glass-blur", reduce || glass >= 98 ? "0px" : blur + "px");
    root.style.setProperty("--night-light", String(night / 200));
    root.dataset.glass = glass >= 98 ? "solid" : "acrylic";
    root.dataset.iconSize = iconSize;
    applyIframeGlass();
    notifyNativeFrames();
    if (iconSize !== prevSize) renderDesktop();
    if (persist !== false) persistSession();
  }

  async function getStorageInfo() {
    let used = 0;
    let quota = 0;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        used = est.usage || 0;
        quota = est.quota || 0;
      }
    } catch (_err) {}
    let files = 0;
    let bytes = 0;
    if (window.OSFS && window.OSFS.allNodes) {
      try {
        const nodes = await window.OSFS.allNodes();
        nodes.forEach((node) => {
          if (node && node.kind === "file") {
            files += 1;
            bytes += Number(node.size) || 0;
          }
        });
      } catch (_err) {}
    }
    return { used, quota, files, bytes };
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
      api.state.taskbarPins = (api.state.taskbarPins || []).filter((item) => item !== id);
      window.OSWindows.list()
        .filter((win) => window.OSWindows.appIdOf(win.id) === id)
        .forEach((win) => window.OSWindows.close(win.id));
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
    api.state.taskbarPins = (api.state.taskbarPins || []).filter((id) => !removable.has(id) || id === "file-explorer");
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

  function ensureInstalled(id) {
    const app = window.OSCatalog.byId(id);
    if (!app) return false;
    if (app.kind === "native" || app.kind === "user") return true;
    if (!api.state) return false;
    if (!api.state.installed.includes(id)) {
      api.state.installed.push(id);
      persistNow();
      if (window.OSStart && window.OSStart.isOpen()) window.OSStart.render();
      renderTaskbar();
    }
    return true;
  }

  function registerUserApp(id, opts) {
    if (!id || !api.state) return;
    if (!api.state.installed.includes(id)) api.state.installed.push(id);
    if (!opts || opts.desktop !== false) {
      if (!api.state.desktopIcons.includes(id)) api.state.desktopIcons.push(id);
    }
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
  const DESK_MIME = "application/x-os-desktop-icon";
  const RECYCLE_KEY = "recycle";
  let draggingDeskKey = null;
  let suppressIconClick = false;

  function deskKeyApp(id) {
    return "app:" + id;
  }

  function deskKeyFs(id) {
    return "fs:" + id;
  }

  function layoutMap() {
    if (!api.state.desktopLayout || typeof api.state.desktopLayout !== "object") api.state.desktopLayout = {};
    return api.state.desktopLayout;
  }

  function gridMetrics() {
    const desktop = document.getElementById("desktop");
    const styles = desktop ? getComputedStyle(desktop) : null;
    const cellW = Math.max(64, parseFloat(styles && styles.getPropertyValue("--icon-col")) || 92);
    const cellH = Math.max(72, parseFloat(styles && styles.getPropertyValue("--icon-row")) || 104);
    const padX = 8;
    const padY = 12;
    const width = desktop ? desktop.clientWidth : 800;
    const height = desktop ? desktop.clientHeight : 600;
    const cols = Math.max(1, Math.floor((width - padX) / cellW));
    const rows = Math.max(1, Math.floor((height - padY) / cellH));
    return { cellW, cellH, padX, padY, cols, rows };
  }

  function cellId(pos) {
    return pos.c + "," + pos.r;
  }

  function cellStyle(pos, metrics) {
    metrics = metrics || gridMetrics();
    const left = metrics.padX + pos.c * metrics.cellW;
    const top = metrics.padY + pos.r * metrics.cellH;
    return `left:${left}px;top:${top}px;`;
  }

  function cellFromPoint(clientX, clientY) {
    const desktop = document.getElementById("desktop");
    const metrics = gridMetrics();
    const rect = desktop.getBoundingClientRect();
    let c = Math.floor((clientX - rect.left - metrics.padX) / metrics.cellW);
    let r = Math.floor((clientY - rect.top - metrics.padY) / metrics.cellH);
    c = Math.max(0, Math.min(metrics.cols - 1, c));
    r = Math.max(0, Math.min(metrics.rows - 1, r));
    return { c, r };
  }

  function firstFreeCell(taken, metrics) {
    const cols = Math.max(metrics.cols, 1);
    const rows = Math.max(metrics.rows, 1);
    for (let c = 0; c < cols + 24; c++) {
      for (let r = 0; r < rows; r++) {
        if (!taken.has(c + "," + r)) return { c, r };
      }
    }
    return { c: cols, r: 0 };
  }

  function keyAtCell(c, r) {
    const layout = layoutMap();
    const want = c + "," + r;
    return (
      Object.keys(layout).find((key) => layout[key] && layout[key].c + "," + layout[key].r === want) || null
    );
  }

  function ensureLayout(keys) {
    const metrics = gridMetrics();
    const layout = layoutMap();
    let changed = false;
    const valid = new Set(keys);
    Object.keys(layout).forEach((key) => {
      if (!valid.has(key)) {
        delete layout[key];
        changed = true;
      }
    });
    const taken = new Set();
    function tryKeep(pos) {
      if (!pos || !Number.isFinite(pos.c) || !Number.isFinite(pos.r)) return false;
      const id = cellId(pos);
      if (taken.has(id)) return false;
      taken.add(id);
      return true;
    }
    if (valid.has(RECYCLE_KEY)) {
      if (!tryKeep(layout[RECYCLE_KEY])) {
        layout[RECYCLE_KEY] = { c: 0, r: 0 };
        taken.add("0,0");
        changed = true;
      }
    }
    keys.forEach((key) => {
      if (key === RECYCLE_KEY) return;
      if (tryKeep(layout[key])) return;
      const pos = firstFreeCell(taken, metrics);
      layout[key] = pos;
      taken.add(cellId(pos));
      changed = true;
    });
    return changed;
  }

  function moveIconToCell(key, cell) {
    const layout = layoutMap();
    const occupant = keyAtCell(cell.c, cell.r);
    const prev = layout[key] ? { c: layout[key].c, r: layout[key].r } : null;
    if (occupant && occupant !== key) {
      if (prev) layout[occupant] = prev;
      else {
        const taken = new Set(
          Object.keys(layout)
            .filter((k) => k !== occupant)
            .map((k) => cellId(layout[k]))
        );
        layout[occupant] = firstFreeCell(taken, gridMetrics());
      }
    }
    layout[key] = { c: cell.c, r: cell.r };
  }

  function arrangeDesktopIcons(keys) {
    const metrics = gridMetrics();
    const layout = layoutMap();
    const others = keys
      .filter((k) => k !== RECYCLE_KEY)
      .sort((a, b) => {
        const pa = layout[a] || { c: 999, r: 999 };
        const pb = layout[b] || { c: 999, r: 999 };
        if (pa.c !== pb.c) return pa.c - pb.c;
        if (pa.r !== pb.r) return pa.r - pb.r;
        return a.localeCompare(b);
      });
    const ordered = keys.includes(RECYCLE_KEY) ? [RECYCLE_KEY].concat(others) : others;
    const next = {};
    const taken = new Set();
    ordered.forEach((key) => {
      const pos = firstFreeCell(taken, metrics);
      next[key] = pos;
      taken.add(cellId(pos));
    });
    api.state.desktopLayout = next;
  }

  async function currentDesktopKeys() {
    const keys = [RECYCLE_KEY];
    (api.state.desktopIcons || []).forEach((id) => {
      const app = window.OSCatalog.byId(id);
      if (app && isInstalled(app.id)) keys.push(deskKeyApp(app.id));
    });
    if (window.OSFS) {
      try {
        await window.OSFS.ready();
        const files = await window.OSFS.listDesktop();
        files.forEach((node) => keys.push(deskKeyFs(node.id)));
      } catch (_err) {}
    }
    return keys;
  }

  async function arrangeDesktop() {
    const keys = await currentDesktopKeys();
    arrangeDesktopIcons(keys);
    persistNow();
    await renderDesktop();
  }

  function showDeskSlot(cell) {
    const desktop = document.getElementById("desktop");
    let slot = desktop.querySelector(".desktop-slot");
    if (!slot) {
      slot = document.createElement("div");
      slot.className = "desktop-slot";
      slot.setAttribute("aria-hidden", "true");
      desktop.appendChild(slot);
    }
    slot.style.cssText = cellStyle(cell);
    slot.hidden = false;
  }

  function hideDeskSlot() {
    const slot = document.querySelector("#desktop .desktop-slot");
    if (slot) slot.hidden = true;
  }

  async function recycleIconHtml(style) {
    if (!window.OSFS) return "";
    try {
      const node = await window.OSFS.get(window.OSFS.TRASH_ID);
      if (!node) return "";
      const kids = await window.OSFS.list(window.OSFS.TRASH_ID);
      const iconNode = Object.assign({}, node, { trashFilled: !!(kids && kids.length) });
      const label = window.OSFS.displayName(node, window.OSI18n.t.bind(window.OSI18n));
      return `<button type="button" class="desktop-icon desktop-recycle fe-drop-target" data-desk-key="${RECYCLE_KEY}" data-fs-id="${escapeHtml(node.id)}" data-recycle="1" data-drop="${escapeHtml(node.id)}" draggable="true" style="${style}">
          ${window.OSFS.iconFor(iconNode)}
          <span>${escapeHtml(label)}</span>
        </button>`;
    } catch (_err) {
      return "";
    }
  }

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
    const keys = [RECYCLE_KEY].concat(apps.map((app) => deskKeyApp(app.id))).concat(files.map((node) => deskKeyFs(node.id)));
    const changed = ensureLayout(keys);
    if (changed) window.OSState.scheduleSave(api.state);
    if (gen !== desktopGen) return;
    const metrics = gridMetrics();
    const layout = layoutMap();
    const appHtml = apps
      .map((app) => {
        const key = deskKeyApp(app.id);
        const pos = layout[key] || { c: 0, r: 0 };
        return `
        <button type="button" class="desktop-icon" data-desk-key="${escapeHtml(key)}" data-app-id="${escapeHtml(app.id)}" draggable="true" style="${cellStyle(pos, metrics)}">
          <img src="${escapeHtml(app.icon)}" alt="" draggable="false">
          <span>${escapeHtml(window.OSCatalog.displayName(app, lang))}</span>
        </button>`;
      })
      .join("");
    const fileHtml = files
      .map((node) => {
        const key = deskKeyFs(node.id);
        const pos = layout[key] || { c: 0, r: 0 };
        return `<button type="button" class="desktop-icon desktop-fs" data-desk-key="${escapeHtml(key)}" data-fs-id="${escapeHtml(node.id)}" draggable="true" style="${cellStyle(pos, metrics)}">
          ${window.OSFS.iconFor(node)}
          <span>${escapeHtml(node.name)}</span>
        </button>`;
      })
      .join("");
    const recyclePos = layout[RECYCLE_KEY] || { c: 0, r: 0 };
    const recycleHtml = await recycleIconHtml(cellStyle(recyclePos, metrics));
    if (gen !== desktopGen) return;
    root.innerHTML = recycleHtml + appHtml + fileHtml;
  }

  function renderTaskbar() {
    const pinsEl = document.getElementById("taskbar-pins");
    const bar = document.getElementById("taskbar-apps");
    const focused = window.OSWindows.focusedId();
    const lang = api.lang;
    const wins = window.OSWindows.list();
    const pins = pinnedIds();
    const pinSet = new Set(pins);
    if (pinsEl) {
      pinsEl.innerHTML = pins
        .map((id) => {
          const app = window.OSCatalog.byId(id);
          if (!app) return "";
          const related = wins.filter((win) => window.OSWindows.appIdOf(win.id) === id);
          const active = related.some((win) => win.id === focused && !win.minimized);
          const open = related.length > 0;
          const name = window.OSCatalog.displayName(app, lang);
          return `<button type="button" class="taskbar-pin${active ? " active" : ""}${open ? " open" : ""}" data-pin-id="${escapeHtml(id)}" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}">
            <img src="${escapeHtml(app.icon || "")}" alt="">
          </button>`;
        })
        .join("");
    }
    if (!bar) return;
    bar.innerHTML = wins
      .filter((win) => !pinSet.has(win.appId || window.OSWindows.appIdOf(win.id)))
      .sort((a, b) => a.z - b.z)
      .map((win) => {
        const app =
          win.previewApp || window.OSCatalog.byId(win.appId || window.OSWindows.appIdOf(win.id));
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
    if (window.OSTaskManager) window.OSTaskManager.remountOpen();
    if (window.OSSnip) window.OSSnip.remountOpen();
    if (window.OSWidgets) window.OSWidgets.refresh();
    notifyNativeFrames();
    if (window.OS && window.OS.applyIframeGlass) window.OS.applyIframeGlass();
    if (window.OSTray && window.OSTray.syncLabels) window.OSTray.syncLabels();
    document.getElementById("start-btn").setAttribute("aria-label", window.OSI18n.t("start"));
    document.getElementById("start-btn").setAttribute("title", window.OSI18n.t("start"));
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
      if (suppressIconClick) {
        suppressIconClick = false;
        return;
      }
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
      if (icon && icon.dataset.recycle) {
        e.preventDefault();
        e.stopPropagation();
        desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
        icon.classList.add("selected");
        const kids = await window.OSFS.list(window.OSFS.TRASH_ID);
        const empty = !kids.length;
        window.OSStart.showItems(
          [
            { act: "open", label: window.OSI18n.t("feOpen") },
            { act: "restoreAll", label: window.OSI18n.t("recycleRestoreAll"), disabled: empty },
            { act: "emptyTrash", label: window.OSI18n.t("recycleEmpty"), disabled: empty },
          ],
          e.clientX,
          e.clientY,
          async (act) => {
            if (act === "open") {
              const node = await window.OSFS.get(window.OSFS.TRASH_ID);
              await window.OSFileExplorer.openDesktopNode(node);
            }
            if (act === "restoreAll") await window.OSFS.restoreAll();
            if (act === "emptyTrash") {
              if (confirm(window.OSI18n.t("recycleEmptyConfirm"))) await window.OSFS.emptyTrash();
            }
          }
        );
        return;
      }
      if (icon && icon.dataset.fsId) {
        e.preventDefault();
        e.stopPropagation();
        desktop.querySelectorAll(".desktop-icon").forEach((el) => el.classList.remove("selected"));
        icon.classList.add("selected");
        const node = await window.OSFS.get(icon.dataset.fsId);
        const clip = window.OSFS.getClipboard();
        const items = [{ act: "open", label: window.OSI18n.t("feOpen") }];
        if (node.kind === "file") {
          const openAs = window.OSFileApps ? window.OSFileApps.openAsItems(node) : [];
          if (openAs.length) items.push({ act: "openAs", label: window.OSI18n.t("feOpenAs"), children: openAs });
          const kind = window.OSFS.openKind(node);
          if (kind !== "download" && kind !== "none") items.push({ act: "preview", label: window.OSI18n.t("fePreview") });
        }
        items.push(
          { act: "cut", label: window.OSI18n.t("feCut") },
          { act: "copy", label: window.OSI18n.t("feCopy") },
          { act: "paste", label: window.OSI18n.t("fePaste"), disabled: !(clip && clip.ids.length) },
          { sep: true },
          { act: "rename", label: window.OSI18n.t("feRename") },
          { act: "delete", label: window.OSI18n.t("feDelete") },
          { sep: true },
          { act: "properties", label: window.OSI18n.t("feProperties") }
        );
        window.OSStart.showItems(items, e.clientX, e.clientY, async (act) => {
          if (!node) return;
          if (act === "open") await window.OSFileExplorer.openDesktopNode(node);
          if (act === "preview") await window.OSFileExplorer.previewNode(node);
          if (typeof act === "string" && act.startsWith("openAs:")) {
            await window.OSFileExplorer.openDesktopNode(node, act.slice(7));
          }
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
          { sep: true },
          {
            act: "widgets",
            label: window.OSI18n.t("widgets"),
            children: window.OSWidgets ? window.OSWidgets.contextItems() : [],
          },
        ],
        e.clientX,
        e.clientY,
        async (act) => {
          if (act === "newFolder") await window.OSFileExplorer.newFolder(window.OSFS.DESKTOP_ID);
          if (act === "paste") await window.OSFS.paste(window.OSFS.DESKTOP_ID);
          if (window.OSWidgets) window.OSWidgets.handleContext(act);
        }
      );
    });
    desktop.addEventListener("dragstart", (e) => {
      const icon = e.target.closest(".desktop-icon");
      if (!icon || !icon.dataset.deskKey) return;
      draggingDeskKey = icon.dataset.deskKey;
      icon.classList.add("dragging");
      e.dataTransfer.setData(DESK_MIME, draggingDeskKey);
      e.dataTransfer.setData("text/plain", draggingDeskKey);
      if (icon.dataset.fsId && !icon.dataset.recycle && window.OSFileExplorer) {
        e.dataTransfer.setData(window.OSFileExplorer.DRAG_MIME, JSON.stringify({ ids: [icon.dataset.fsId] }));
      }
      e.dataTransfer.effectAllowed = "copyMove";
    });
    desktop.addEventListener("dragend", () => {
      desktop.querySelectorAll(".desktop-icon.dragging").forEach((el) => el.classList.remove("dragging"));
      hideDeskSlot();
      draggingDeskKey = null;
      suppressIconClick = true;
    });
    desktop.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      const types = [...e.dataTransfer.types];
      const ours =
        draggingDeskKey ||
        types.includes("Files") ||
        types.includes(DESK_MIME) ||
        types.includes("text/plain") ||
        (window.OSFileExplorer && types.includes(window.OSFileExplorer.DRAG_MIME));
      if (!ours) return;
      e.preventDefault();
      const recycle = e.target.closest("[data-recycle]");
      e.dataTransfer.dropEffect = recycle && draggingDeskKey !== RECYCLE_KEY ? "move" : e.ctrlKey ? "copy" : "move";
      showDeskSlot(cellFromPoint(e.clientX, e.clientY));
    });
    desktop.addEventListener("dragleave", (e) => {
      if (!desktop.contains(e.relatedTarget)) hideDeskSlot();
    });
    desktop.addEventListener("drop", async (e) => {
      e.preventDefault();
      hideDeskSlot();
      const cell = cellFromPoint(e.clientX, e.clientY);
      const types = e.dataTransfer ? [...e.dataTransfer.types] : [];
      const fsIds = window.OSFileExplorer ? window.OSFileExplorer.parseDrag(e) : null;
      const deskKey = draggingDeskKey;
      const overKey = keyAtCell(cell.c, cell.r);
      const overEl = overKey ? desktop.querySelector('[data-desk-key="' + overKey.replace(/"/g, '\\"') + '"]') : null;
      const overRecycle = overKey === RECYCLE_KEY || !!(overEl && overEl.dataset.recycle);
      const overFsId = overEl && overEl.dataset.fsId ? overEl.dataset.fsId : "";
      draggingDeskKey = null;

      const isExternal = types.includes("Files") && !(window.OSFileExplorer && types.includes(window.OSFileExplorer.DRAG_MIME));
      if (isExternal && window.OSFileExplorer) {
        if (overRecycle) return;
        const destNode = overFsId ? await window.OSFS.get(overFsId) : null;
        const destId =
          destNode && destNode.kind === "folder" && destNode.id !== window.OSFS.TRASH_ID ? destNode.id : window.OSFS.DESKTOP_ID;
        await window.OSFileExplorer.dropOn(null, destId, e);
        return;
      }

      if (overRecycle && fsIds && fsIds.length && deskKey !== RECYCLE_KEY) {
        await window.OSFS.trash(fsIds);
        return;
      }

      if (overFsId && fsIds && fsIds.length && !fsIds.includes(overFsId)) {
        const destNode = await window.OSFS.get(overFsId);
        if (destNode && destNode.kind === "folder" && destNode.id !== window.OSFS.TRASH_ID) {
          await window.OSFileExplorer.dropOn(null, destNode.id, e);
          return;
        }
      }

      if (deskKey) {
        moveIconToCell(deskKey, cell);
        persistNow();
        await renderDesktop();
        return;
      }

      if (fsIds && fsIds.length && window.OSFileExplorer) {
        await window.OSFileExplorer.dropOn(null, window.OSFS.DESKTOP_ID, e);
        const layout = layoutMap();
        const metrics = gridMetrics();
        const taken = new Set(Object.keys(layout).map((k) => cellId(layout[k])));
        fsIds.forEach((id, i) => {
          const key = deskKeyFs(id);
          taken.delete(layout[key] ? cellId(layout[key]) : "");
          let pos;
          if (i === 0 && !keyAtCell(cell.c, cell.r)) pos = cell;
          else pos = firstFreeCell(taken, metrics);
          layout[key] = pos;
          taken.add(cellId(pos));
        });
        persistNow();
        await renderDesktop();
      }
    });
    document.getElementById("taskbar-apps").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-task-id]");
      if (btn) window.OSWindows.toggleTask(btn.dataset.taskId);
    });
    document.getElementById("taskbar-apps").addEventListener("contextmenu", (e) => {
      const btn = e.target.closest("[data-task-id]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const win = window.OSWindows.get(btn.dataset.taskId);
      if (!win) return;
      const appId = win.appId || window.OSWindows.appIdOf(win.id);
      window.OSStart.close();
      window.OSStart.showItems(
        [
          { act: "pin", label: window.OSI18n.t("pinTaskbar") },
          { act: "close", label: window.OSI18n.t("close") },
        ],
        e.clientX,
        e.clientY,
        (act) => {
          if (act === "pin") toggleTaskbarPin(appId);
          if (act === "close") window.OSWindows.close(win.id);
        }
      );
    });
    const pinsEl = document.getElementById("taskbar-pins");
    if (pinsEl) {
      pinsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pin-id]");
        if (!btn) return;
        e.stopPropagation();
        window.OSStart.close();
        window.OSStart.closeContext();
        const appId = btn.dataset.pinId;
        const related = window.OSWindows.list().filter((win) => window.OSWindows.appIdOf(win.id) === appId);
        if (related.length) {
          const top = related.slice().sort((a, b) => (b.z || 0) - (a.z || 0))[0];
          window.OSWindows.toggleTask(top.id);
        } else {
          window.OSWindows.open(appId);
        }
      });
      pinsEl.addEventListener("contextmenu", (e) => {
        const btn = e.target.closest("[data-pin-id]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const appId = btn.dataset.pinId;
        const app = window.OSCatalog.byId(appId);
        window.OSStart.close();
        const items = [{ act: "open", label: window.OSCatalog.displayName(app, api.lang) }];
        if (app && app.multiInstance) items.push({ act: "newWindow", label: window.OSI18n.t("feNewWindow") });
        const recents = recentFilesFor(appId);
        if (recents.length) {
          items.push({ sep: true });
          recents.forEach((item) => {
            items.push({ act: "recent:" + item.id, label: item.name || item.id });
          });
        }
        items.push({ sep: true }, { act: "unpin", label: window.OSI18n.t("unpinTaskbar") });
        window.OSStart.showItems(items, e.clientX, e.clientY, (act) => {
          if (act === "open") window.OSWindows.open(appId);
          if (act === "newWindow") window.OSWindows.open(appId, { newInstance: true });
          if (act === "unpin") toggleTaskbarPin(appId);
          if (typeof act === "string" && act.startsWith("recent:")) {
            const fileId = act.slice(7);
            if (window.OSFileApps) window.OSFileApps.openFile(fileId, appId);
          }
        });
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
    document.documentElement.dataset.motion = api.state.reducedMotion ? "reduce" : "full";
    applyAppearance({}, false);
    if (window.OSIconColor) window.OSIconColor.watch();
    if (window.OSFS) await window.OSFS.ready();
    if (window.OSAppBuilder) await window.OSAppBuilder.hydrate();
    await applyWallpaper();

    window.OSWindows.init();
    window.OSStart.init();
    if (window.OSHotkeys) window.OSHotkeys.init();
    if (window.OSDesk) window.OSDesk.initFlyout();
    if (window.OSWidgets) window.OSWidgets.init();
    if (window.OSTray) window.OSTray.init();
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
    if (window.OSOffline && window.OSOffline.syncFromState) {
      window.OSOffline.syncFromState();
    }
  }

  api.isInstalled = isInstalled;
  api.ensureInstalled = ensureInstalled;
  api.persistSession = persistSession;
  api.persistNow = persistNow;
  api.setTheme = setTheme;
  api.setLang = setLang;
  api.setUsername = setUsername;
  api.toggleFavorite = toggleFavorite;
  api.toggleDesktopIcon = toggleDesktopIcon;
  api.toggleTaskbarPin = toggleTaskbarPin;
  api.isPinned = isPinned;
  api.rememberRecentFile = rememberRecentFile;
  api.recentFilesFor = recentFilesFor;
  api.applyReducedMotion = applyReducedMotion;
  api.applyAppearance = applyAppearance;
  api.applyIframeGlass = applyIframeGlass;
  api.getStorageInfo = getStorageInfo;
  api.toggleInstalled = toggleInstalled;
  api.installAll = installAll;
  api.uninstallAll = uninstallAll;
  api.installPrerelease = installPrerelease;
  api.registerUserApp = registerUserApp;
  api.unregisterUserApp = unregisterUserApp;
  api.setWallpaper = setWallpaper;
  api.setIconColor = setIconColor;
  api.applyWallpaper = applyWallpaper;
  api.wallpaperImageSrc = wallpaperImageSrc;
  api.BUILTIN_WALLPAPERS = [
    ...GRADIENT_WALLPAPERS,
    "playground-dark",
    "playground-light",
    ...PHOTO_WALLPAPER_IDS,
  ];
  api.renderDesktop = renderDesktop;
  api.renderTaskbar = renderTaskbar;
  api.refreshChrome = refreshChrome;
  api.boot = boot;
  return api;
})();

document.addEventListener("DOMContentLoaded", () => window.OS.boot());
