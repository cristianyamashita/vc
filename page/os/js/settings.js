window.OSSettings = (function () {
  const MAX_WALLPAPER_BYTES = 8 * 1024 * 1024;
  const IMAGE_EXT = /\.(png|jpe?g|jfif|gif|webp|bmp|svg|avif|heic|heif|tif|tiff)$/i;

  let currentPane = "preferences";
  let installFilter = "";
  let customWalls = [];
  let uploadHint = "";
  let fileBound = false;
  let offlineUnsub = null;
  const customUrls = new Map();

  function t(key, vars) {
    return window.OSI18n.t(key, vars);
  }

  function builtinWallpapers() {
    return (window.OS && window.OS.BUILTIN_WALLPAPERS) || ["bloom", "aurora", "dusk", "horizon"];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function thumbUrl(record) {
    if (!record || !record.blob) return "";
    if (customUrls.has(record.id)) return customUrls.get(record.id);
    const url = URL.createObjectURL(record.blob);
    customUrls.set(record.id, url);
    return url;
  }

  function revokeThumb(id) {
    const url = customUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    customUrls.delete(id);
  }

  function wallpaperLabel(id) {
    const keys = {
      bloom: "wallpaperBloom",
      aurora: "wallpaperAurora",
      dusk: "wallpaperDusk",
      horizon: "wallpaperHorizon",
      "playground-dark": "wallpaperPlaygroundDark",
      "playground-light": "wallpaperPlaygroundLight",
      wp1: "wallpaperWp1",
      wp2: "wallpaperWp2",
      wp3: "wallpaperWp3",
      wp4: "wallpaperWp4",
      wp5: "wallpaperWp5",
      wp6: "wallpaperWp6",
      wp7: "wallpaperWp7",
      wp8: "wallpaperWp8",
    };
    if (keys[id]) return t(keys[id]);
    const wp = /^wp(\d+)$/.exec(id);
    if (wp) return t("wallpaperWpN", { n: wp[1] });
    return id;
  }

  function paneHtml() {
    if (currentPane === "install") return installHtml();
    if (currentPane === "appearance") return appearanceHtml();
    if (currentPane === "file-types") return fileTypesHtml();
    if (currentPane === "registry") {
      return `<div id="os-registry-root" class="registry-root"></div>`;
    }
    if (currentPane === "more") {
      return moreHtml();
    }
    if (currentPane === "offline") {
      return offlineHtml();
    }
    return preferencesHtml();
  }

  function shortcutRow(keys, label) {
    return `<div class="shortcut-row"><kbd>${escapeHtml(keys)}</kbd><span>${escapeHtml(label)}</span></div>`;
  }

  function formatOfflineWhen(ts) {
    if (!ts) return t("offlineNever");
    try {
      const lang = (window.OS && window.OS.lang) || "en";
      const locale = lang === "ja" ? "ja" : lang === "pt" ? "pt" : "en";
      return new Date(ts).toLocaleString(locale);
    } catch (_err) {
      return String(ts);
    }
  }

  function formatOfflineSize(bytes) {
    if (window.OSFS && window.OSFS.formatSize) return window.OSFS.formatSize(bytes || 0);
    const n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function offlineHtml() {
    return `
      <h2>${escapeHtml(t("offline"))}</h2>
      <p class="muted">${escapeHtml(t("offlineHint"))}</p>
      <p class="offline-status" id="os-offline-status"></p>
      <p class="muted" id="os-offline-sync"></p>
      <p class="muted" id="os-offline-cache"></p>
      <p class="muted" id="os-offline-progress-label"></p>
      <div class="offline-progress" id="os-offline-progress" hidden><span></span></div>
      <p class="muted" id="os-offline-failed"></p>
      <p class="muted" id="os-offline-error"></p>
      <div class="offline-actions">
        <button type="button" class="btn-install" id="os-offline-lite">${escapeHtml(t("offlineDownloadLite"))}</button>
        <button type="button" class="btn-install" id="os-offline-full">${escapeHtml(t("offlineDownloadFull"))}</button>
        <button type="button" id="os-offline-update">${escapeHtml(t("offlineUpdate"))}</button>
        <button type="button" class="btn-uninstall" id="os-offline-clear">${escapeHtml(t("offlineClear"))}</button>
      </div>
      <p class="muted">${escapeHtml(t("offlineLiteHint"))}</p>
      <p class="muted">${escapeHtml(t("offlineFullHint"))}</p>
      <p class="muted offline-limits">${escapeHtml(t("offlineLimits"))}</p>
    `;
  }

  function moreHtml() {
    const motion = !!(window.OS && window.OS.state && window.OS.state.reducedMotion);
    return `
      <h2>${escapeHtml(t("more"))}</h2>
      <p class="muted">${escapeHtml(t("moreHint"))}</p>
      <h3>${escapeHtml(t("about"))}</h3>
      <p>${escapeHtml(t("aboutBody"))}</p>
      <p class="muted">${escapeHtml(navigator.userAgent || "")}</p>
      <h3>${escapeHtml(t("storage"))}</h3>
      <p id="os-storage-line" class="muted">${escapeHtml(t("registryLoading"))}</p>
      <p><a class="settings-link" href="../utils/backup.html" target="_blank" rel="noopener">${escapeHtml(t("registryBackupLink"))}</a></p>
      <h3>${escapeHtml(t("shortcuts"))}</h3>
      <div class="shortcut-list">
        ${shortcutRow("Ctrl+Esc", t("shortcutStart"))}
        ${shortcutRow("Ctrl+Alt+Tab", t("shortcutSwitcher"))}
        ${shortcutRow("Alt+`", t("shortcutAppSwitch"))}
        ${shortcutRow("Ctrl+E", t("shortcutExplorer"))}
        ${shortcutRow("Ctrl+,", t("shortcutSettings"))}
        ${shortcutRow("Alt+R", t("shortcutRun"))}
        ${shortcutRow("Ctrl+Alt+←/→/↑/↓", t("shortcutSnap"))}
        ${shortcutRow("Ctrl+Shift+A", t("shortcutQuick"))}
        ${shortcutRow("Ctrl+Shift+V", t("shortcutClipboard"))}
        ${shortcutRow("Alt+F4", t("shortcutClose"))}
      </div>
      <h3>${escapeHtml(t("reducedMotion"))}</h3>
      <label class="settings-check">
        <input id="os-reduced-motion" type="checkbox"${motion ? " checked" : ""}>
        <span>${escapeHtml(t("reducedMotionHint"))}</span>
      </label>
    `;
  }

  function preferencesHtml() {
    const lang = window.OS.lang;
    return `
      <h2>${escapeHtml(t("preferences"))}</h2>
      <div class="settings-field">
        <label for="os-username">${escapeHtml(t("username"))}</label>
        <input id="os-username" type="text" maxlength="40" value="${escapeHtml(window.OS.state.username || "")}">
      </div>
      <div class="settings-field">
        <label for="os-lang">${escapeHtml(t("language"))}</label>
        <select id="os-lang">
          <option value="en"${lang === "en" ? " selected" : ""}>English</option>
          <option value="pt"${lang === "pt" ? " selected" : ""}>Português</option>
          <option value="ja"${lang === "ja" ? " selected" : ""}>日本語</option>
        </select>
      </div>
    `;
  }

  function fileTypesHtml() {
    if (!window.OSFileApps) {
      return `<h2>${escapeHtml(t("fileTypes"))}</h2><p class="muted">${escapeHtml(t("comingSoon"))}</p>`;
    }
    const lang = (window.OS && window.OS.lang) || "en";
    const prefs = window.OSFileApps.prefs();
    const cards = window.OSFileApps.allExts()
      .map((ext) => {
        const pref = prefs[ext] || { apps: [], default: null };
        const capable = window.OSFileApps.capableAppIds(ext);
        const options = [`<option value=""${!pref.default ? " selected" : ""}>${escapeHtml(t("fileTypesNone"))}</option>`]
          .concat(
            pref.apps.map((appId) => {
              const app = window.OSCatalog.byId(appId);
              const name = app ? window.OSCatalog.displayName(app, lang) : appId;
              return `<option value="${escapeHtml(appId)}"${pref.default === appId ? " selected" : ""}>${escapeHtml(name)}</option>`;
            })
          )
          .join("");
        const checks = capable
          .map((appId) => {
            const app = window.OSCatalog.byId(appId);
            const name = app ? window.OSCatalog.displayName(app, lang) : appId;
            const icon = app && app.icon ? `<img src="${escapeHtml(app.icon)}" alt="">` : "";
            const checked = pref.apps.includes(appId) ? " checked" : "";
            return `<label class="file-types-app">${icon}<input type="checkbox" data-file-ext="${escapeHtml(ext)}" data-file-app="${escapeHtml(appId)}"${checked}><span>${escapeHtml(name)}</span></label>`;
          })
          .join("");
        return `<div class="file-types-card">
          <div class="file-types-ext">.${escapeHtml(ext)}</div>
          <div class="settings-field">
            <label>${escapeHtml(t("fileTypesDefault"))}</label>
            <select data-file-default="${escapeHtml(ext)}">${options}</select>
          </div>
          <div class="file-types-apps">
            <span class="muted">${escapeHtml(t("fileTypesApps"))}</span>
            ${checks}
          </div>
        </div>`;
      })
      .join("");
    return `
      <h2>${escapeHtml(t("fileTypes"))}</h2>
      <div class="file-types-toolbar">
        <p class="muted">${escapeHtml(t("fileTypesHint"))}</p>
        <button type="button" class="file-types-reset" id="os-file-types-reset">${escapeHtml(t("fileTypesReset"))}</button>
      </div>
      ${cards}
    `;
  }

  function appearanceHtml() {
    const theme = window.OS.theme;
    const current = window.OS.state.wallpaperId || "bloom";
    const iconColor = window.OSIconColor ? window.OSIconColor.current() : "#008f7d";
    const st = window.OS.state || {};
    const glass = Number.isFinite(Number(st.glass)) ? Number(st.glass) : 86;
    const blur = Number.isFinite(Number(st.blur)) ? Number(st.blur) : 20;
    const night = Number.isFinite(Number(st.nightLight)) ? Number(st.nightLight) : 0;
    const iconSize = st.iconSize === "s" || st.iconSize === "l" ? st.iconSize : "m";
    const glassPreset =
      glass >= 98 && blur <= 1 ? "solid" : glass <= 68 && blur >= 28 ? "vibrancy" : glass >= 76 && glass <= 90 && blur >= 14 && blur <= 26 ? "acrylic" : "";
    const presets = (window.OSIconColor && window.OSIconColor.PRESETS) || ["#008f7d"];
    const swatches = presets
      .map((hex) => {
        const selected = hex === iconColor ? " selected" : "";
        return `<button type="button" class="icon-color-swatch${selected}" data-icon-swatch="${hex}" style="background:${hex}" title="${hex}" aria-label="${hex}"></button>`;
      })
      .join("");
    const iconPreview = ["os", "os-file_explorer", "os-sheets", "utils-calculator", "utils-notebook"]
      .map((slug) => `<img src="../assets/icons/svg/${slug}.svg" alt="">`)
      .join("");
    const builtinTiles = builtinWallpapers().map((id) => {
      const selected = current === id ? " selected" : "";
      const imageSrc = window.OS.wallpaperImageSrc(id);
      const preview = imageSrc
        ? `<div class="wallpaper-preview" style="background-image:url('${imageSrc}')"></div>`
        : `<div class="wallpaper-preview" data-preset="${id}"></div>`;
      return `<div class="wallpaper-card">
        <button type="button" class="wallpaper-tile${selected}" data-wallpaper-id="${id}">
          ${preview}
          <span class="wallpaper-name">${escapeHtml(wallpaperLabel(id))}</span>
        </button>
      </div>`;
    }).join("");
    const customTiles = customWalls
      .map((record) => {
        const selected = current === record.id ? " selected" : "";
        const url = thumbUrl(record);
        const name = record.name || record.id;
        return `<div class="wallpaper-card">
          <button type="button" class="wallpaper-tile${selected}" data-wallpaper-id="${escapeHtml(record.id)}">
            <div class="wallpaper-preview" style="background-image:url('${url}')"></div>
            <span class="wallpaper-name">${escapeHtml(name)}</span>
          </button>
          <button type="button" class="wallpaper-delete" data-delete-wallpaper="${escapeHtml(record.id)}">${escapeHtml(t("deleteWallpaper"))}</button>
        </div>`;
      })
      .join("");
    return `
      <h2>${escapeHtml(t("appearance"))}</h2>
      <div class="settings-field">
        <label for="os-theme">${escapeHtml(t("theme"))}</label>
        <select id="os-theme">
          <option value="dark"${theme === "dark" ? " selected" : ""}>${escapeHtml(t("dark"))}</option>
          <option value="light"${theme === "light" ? " selected" : ""}>${escapeHtml(t("light"))}</option>
        </select>
      </div>
      <h3>${escapeHtml(t("glass"))}</h3>
      <p class="muted icon-color-hint">${escapeHtml(t("glassHint"))}</p>
      <div class="glass-presets">
        <button type="button" data-glass-preset="solid"${glassPreset === "solid" ? " class=\"selected\"" : ""}>${escapeHtml(t("glassSolid"))}</button>
        <button type="button" data-glass-preset="acrylic"${glassPreset === "acrylic" ? " class=\"selected\"" : ""}>${escapeHtml(t("glassAcrylic"))}</button>
        <button type="button" data-glass-preset="vibrancy"${glassPreset === "vibrancy" ? " class=\"selected\"" : ""}>${escapeHtml(t("glassVibrancy"))}</button>
      </div>
      <div class="settings-field">
        <label for="os-glass">${escapeHtml(t("glassOpacity"))} <span class="settings-range-val" id="os-glass-val">${glass}%</span></label>
        <input id="os-glass" type="range" min="40" max="100" value="${glass}">
      </div>
      <div class="settings-field">
        <label for="os-blur">${escapeHtml(t("glassBlur"))} <span class="settings-range-val" id="os-blur-val">${blur}px</span></label>
        <input id="os-blur" type="range" min="0" max="40" value="${blur}">
      </div>
      <h3>${escapeHtml(t("nightLight"))}</h3>
      <p class="muted icon-color-hint">${escapeHtml(t("nightLightHint"))}</p>
      <div class="settings-field">
        <label for="os-night">${escapeHtml(t("nightLight"))} <span class="settings-range-val" id="os-night-val">${night}%</span></label>
        <input id="os-night" type="range" min="0" max="80" value="${night}">
      </div>
      <h3>${escapeHtml(t("iconSize"))}</h3>
      <div class="settings-seg">
        <button type="button" data-icon-size="s"${iconSize === "s" ? " class=\"selected\"" : ""}>${escapeHtml(t("iconSizeS"))}</button>
        <button type="button" data-icon-size="m"${iconSize === "m" ? " class=\"selected\"" : ""}>${escapeHtml(t("iconSizeM"))}</button>
        <button type="button" data-icon-size="l"${iconSize === "l" ? " class=\"selected\"" : ""}>${escapeHtml(t("iconSizeL"))}</button>
      </div>
      <h3>${escapeHtml(t("iconColor"))}</h3>
      <p class="muted icon-color-hint">${escapeHtml(t("iconColorHint"))}</p>
      <div class="icon-color-row">
        <input type="color" id="os-icon-color" value="${escapeHtml(iconColor)}" aria-label="${escapeHtml(t("iconColor"))}">
        <input type="text" id="os-icon-color-hex" value="${escapeHtml(iconColor.toUpperCase())}" spellcheck="false" autocomplete="off" aria-label="${escapeHtml(t("iconColorHex"))}">
        <button type="button" class="wallpaper-upload" id="os-icon-color-reset">${escapeHtml(t("iconColorReset"))}</button>
      </div>
      <div class="icon-color-swatches">${swatches}</div>
      <div class="icon-color-preview">${iconPreview}</div>
      <h3>${escapeHtml(t("wallpaper"))}</h3>
      <div class="wallpaper-grid">${builtinTiles}</div>
      <h3>${escapeHtml(t("customWallpapers"))}</h3>
      <p class="muted wallpaper-hint">${escapeHtml(t("wallpaperTooLarge"))}</p>
      <label class="wallpaper-upload" for="os-wallpaper-file">${escapeHtml(t("uploadWallpaper"))}</label>
      ${uploadHint ? `<p class="wallpaper-error">${escapeHtml(uploadHint)}</p>` : ""}
      <div class="wallpaper-grid" id="os-custom-wallpapers">
        ${customTiles || `<p class="muted">${escapeHtml(t("emptyCustomWallpapers"))}</p>`}
      </div>
    `;
  }

  function installHtml() {
    const lang = window.OS.lang;
    const q = installFilter.trim().toLowerCase();
    const grouped = new Map();
    window.OSCatalog.siteApps().forEach((app) => {
      const name = window.OSCatalog.displayName(app, lang);
      const tag = window.OSCatalog.displayTag(app, lang);
      const desc = window.OSCatalog.displayDesc(app, lang);
      if (q && !`${name} ${tag} ${desc} ${app.id}`.toLowerCase().includes(q)) return;
      const key = window.OSCatalog.tagGroupKey(app);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(app);
    });
    const keys = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, lang));
    const groups = keys
      .map((key) => {
        const apps = grouped
          .get(key)
          .slice()
          .sort((a, b) =>
            window.OSCatalog.displayName(a, lang).localeCompare(window.OSCatalog.displayName(b, lang), lang)
          );
        const heading = window.OSCatalog.displayTag(apps[0], lang) || key;
        const rows = apps
          .map((app) => {
            const installed = window.OS.isInstalled(app.id);
            const desc = window.OSCatalog.displayDesc(app, lang);
            return `<div class="install-row">
              <img src="${app.icon}" alt="">
              <div class="meta">
                <strong>${escapeHtml(window.OSCatalog.displayName(app, lang))}</strong>
                ${desc ? `<p class="install-desc">${escapeHtml(desc)}</p>` : ""}
                <span>${escapeHtml(installed ? t("installed") : t("notInstalled"))}</span>
              </div>
              <button type="button" data-install-id="${app.id}" class="${installed ? "btn-uninstall" : "btn-install"}">
                ${escapeHtml(installed ? t("uninstall") : t("install"))}
              </button>
            </div>`;
          })
          .join("");
        return `<div class="install-group"><h3>${escapeHtml(heading)}</h3>${rows}</div>`;
      })
      .join("");
    return `
      <h2>${escapeHtml(t("installApps"))}</h2>
      <div class="install-toolbar">
        <input id="os-install-filter" type="search" value="${escapeHtml(installFilter)}" data-i18n-placeholder="searchInstall" placeholder="${escapeHtml(t("searchInstall"))}">
        <div class="install-actions">
          <button type="button" id="os-install-all" class="btn-install">${escapeHtml(t("installAll"))}</button>
          <button type="button" id="os-uninstall-all" class="btn-uninstall">${escapeHtml(t("uninstallAll"))}</button>
          <button type="button" id="os-install-prerelease" class="btn-install">${escapeHtml(t("installPrerelease"))}</button>
        </div>
      </div>
      ${groups}
    `;
  }

  function paint(root) {
    const panel = root.querySelector(".settings-panel");
    const scrollTop = panel ? panel.scrollTop : 0;
    root.innerHTML = `
      <div class="settings-shell">
        <nav class="settings-nav">
          <button type="button" data-pane="preferences" class="${currentPane === "preferences" ? "active" : ""}">${escapeHtml(t("preferences"))}</button>
          <button type="button" data-pane="appearance" class="${currentPane === "appearance" ? "active" : ""}">${escapeHtml(t("appearance"))}</button>
          <button type="button" data-pane="file-types" class="${currentPane === "file-types" ? "active" : ""}">${escapeHtml(t("fileTypes"))}</button>
          <button type="button" data-pane="install" class="${currentPane === "install" ? "active" : ""}">${escapeHtml(t("installApps"))}</button>
          <button type="button" data-pane="offline" class="${currentPane === "offline" ? "active" : ""}">${escapeHtml(t("offline"))}</button>
          <button type="button" data-pane="registry" class="${currentPane === "registry" ? "active" : ""}">${escapeHtml(t("registry"))}</button>
          <button type="button" data-pane="more" class="${currentPane === "more" ? "active" : ""}">${escapeHtml(t("more"))}</button>
        </nav>
        <div class="settings-panel">${paneHtml()}</div>
      </div>
    `;
    bind(root);
    const next = root.querySelector(".settings-panel");
    if (next) next.scrollTop = scrollTop;
    if (currentPane === "registry" && window.OSRegistry) {
      const registryRoot = root.querySelector("#os-registry-root");
      if (registryRoot) window.OSRegistry.mount(registryRoot);
    }
    if (currentPane === "more") fillStorage(root);
    if (currentPane === "offline") bindOffline(root);
    else if (offlineUnsub) {
      offlineUnsub();
      offlineUnsub = null;
    }
    if (window.OSAnalytics) window.OSAnalytics.trackApp("settings", currentPane || "preferences");
  }

  async function fillStorage(root) {
    const line = root.querySelector("#os-storage-line");
    if (!line || !window.OS || !window.OS.getStorageInfo) return;
    try {
      const info = await window.OS.getStorageInfo();
      const used = window.OSFS.formatSize(info.used);
      const quota = info.quota ? window.OSFS.formatSize(info.quota) : t("storageUnknown");
      const files = t("storageFilesLine", { n: info.files, size: window.OSFS.formatSize(info.bytes) });
      line.textContent = info.quota ? t("storageUsedOf", { used, quota }) + " · " + files : files;
    } catch (_err) {
      line.textContent = t("storageUnknown");
    }
  }

  async function mount(root) {
    if (!root) return;
    bindFileInput();
    if (currentPane === "appearance") {
      try {
        customWalls = (await window.OSState.listWallpapers())
          .filter((row) => row && row.id && row.blob)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      } catch (_) {
        customWalls = [];
      }
    }
    paint(root);
  }

  function remountOpen() {
    document.querySelectorAll(".native-root").forEach((root) => {
      if (root.closest('[data-app-id="settings"]')) mount(root);
    });
  }

  function settingsRoot() {
    return document.querySelector('[data-app-id="settings"] .native-root');
  }

  function newWallpaperId() {
    if (window.crypto && crypto.randomUUID) return "custom:" + crypto.randomUUID();
    return "custom:" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function sniffImageType(bytes) {
    if (!bytes || bytes.length < 3) return "";
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }
    return "";
  }

  function looksLikeImage(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    if (IMAGE_EXT.test(file.name || "")) return true;
    return !file.type || file.type === "application/octet-stream";
  }

  async function fileToBlob(file) {
    const buffer = await file.arrayBuffer();
    const sniffed = sniffImageType(new Uint8Array(buffer));
    const named = IMAGE_EXT.test(file.name || "");
    const typed = !!(file.type && file.type.startsWith("image/"));
    if (!sniffed && !typed && !named) throw new Error("not-image");
    const type = (typed && file.type) || sniffed || "application/octet-stream";
    return new Blob([buffer], { type });
  }

  async function uploadWallpapers(files, root) {
    const chosen = Array.from(files || []).filter((file) => file && file.size > 0);
    if (!chosen.length) return;
    const images = chosen.filter(looksLikeImage);
    uploadHint = "";
    if (!images.length) {
      uploadHint = t("wallpaperUploadFailed");
      if (root) paint(root);
      return;
    }
    let lastId = null;
    let tooLarge = false;
    let failed = false;
    for (const file of images) {
      if (file.size > MAX_WALLPAPER_BYTES) {
        tooLarge = true;
        continue;
      }
      try {
        const blob = await fileToBlob(file);
        const record = {
          id: newWallpaperId(),
          name: file.name || "wallpaper",
          type: blob.type,
          blob,
          createdAt: Date.now(),
        };
        await window.OSState.putWallpaper(record);
        lastId = record.id;
      } catch (err) {
        console.warn("Wallpaper upload failed", err);
        failed = true;
      }
    }
    if (lastId) {
      uploadHint = tooLarge || failed ? t("wallpaperTooLarge") : "";
      await window.OS.setWallpaper(lastId);
    } else if (tooLarge) {
      uploadHint = t("wallpaperTooLarge");
    } else {
      uploadHint = t("wallpaperUploadFailed");
    }
    if (root) await mount(root);
    else remountOpen();
  }

  async function removeWallpaper(id, root) {
    await window.OSState.deleteWallpaper(id);
    revokeThumb(id);
    if ((window.OS.state.wallpaperId || "") === id) {
      await window.OS.setWallpaper("bloom");
    }
    customWalls = customWalls.filter((item) => item.id !== id);
    if (root) await mount(root);
  }

  function syncIconColorUi(root, hex) {
    const colorInput = root.querySelector("#os-icon-color");
    const hexInput = root.querySelector("#os-icon-color-hex");
    if (colorInput) colorInput.value = hex;
    if (hexInput && document.activeElement !== hexInput) hexInput.value = hex.toUpperCase();
    root.querySelectorAll("[data-icon-swatch]").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.iconSwatch === hex);
    });
  }

  function bindIconColor(root) {
    const colorInput = root.querySelector("#os-icon-color");
    const hexInput = root.querySelector("#os-icon-color-hex");
    const reset = root.querySelector("#os-icon-color-reset");
    if (!colorInput || !window.OS.setIconColor) return;
    colorInput.addEventListener("input", () => {
      window.OS.setIconColor(colorInput.value);
      syncIconColorUi(root, window.OSIconColor.current());
    });
    if (hexInput) {
      hexInput.addEventListener("input", () => {
        const parsed = window.OSIconColor.parse(hexInput.value);
        const raw = String(hexInput.value || "").trim().replace(/^#/, "");
        if (!/^[0-9a-f]{3}$/i.test(raw) && !/^[0-9a-f]{6}$/i.test(raw)) return;
        window.OS.setIconColor(parsed);
        syncIconColorUi(root, parsed);
      });
    }
    if (reset) {
      reset.addEventListener("click", () => {
        window.OS.setIconColor(window.OSIconColor.DEFAULT_TEAL);
        syncIconColorUi(root, window.OSIconColor.DEFAULT_TEAL);
      });
    }
    root.querySelectorAll("[data-icon-swatch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.OS.setIconColor(btn.dataset.iconSwatch);
        syncIconColorUi(root, window.OSIconColor.current());
      });
    });
  }

  function bindFileInput() {
    const fileInput = document.getElementById("os-wallpaper-file");
    if (!fileInput || fileBound) return;
    fileBound = true;
    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) return;
      const root = settingsRoot();
      fileInput.value = "";
      uploadWallpapers(files, root);
    });
  }

  function bind(root) {
    root.querySelectorAll("[data-pane]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPane = btn.dataset.pane;
        mount(root);
      });
    });
    const user = root.querySelector("#os-username");
    if (user) {
      user.addEventListener("change", () => window.OS.setUsername(user.value));
      user.addEventListener("keydown", (e) => {
        if (e.key === "Enter") window.OS.setUsername(user.value);
      });
    }
    const theme = root.querySelector("#os-theme");
    if (theme) theme.addEventListener("change", () => window.OS.setTheme(theme.value));
    const langSel = root.querySelector("#os-lang");
    if (langSel) langSel.addEventListener("change", () => window.OS.setLang(langSel.value));
    bindIconColor(root);
    const glass = root.querySelector("#os-glass");
    if (glass) {
      glass.addEventListener("input", () => {
        const n = Number(glass.value);
        const label = root.querySelector("#os-glass-val");
        if (label) label.textContent = n + "%";
        if (window.OS && window.OS.applyAppearance) window.OS.applyAppearance({ glass: n });
      });
    }
    const blur = root.querySelector("#os-blur");
    if (blur) {
      blur.addEventListener("input", () => {
        const n = Number(blur.value);
        const label = root.querySelector("#os-blur-val");
        if (label) label.textContent = n + "px";
        if (window.OS && window.OS.applyAppearance) window.OS.applyAppearance({ blur: n });
      });
    }
    const night = root.querySelector("#os-night");
    if (night) {
      night.addEventListener("input", () => {
        const n = Number(night.value);
        const label = root.querySelector("#os-night-val");
        if (label) label.textContent = n + "%";
        if (window.OS && window.OS.applyAppearance) window.OS.applyAppearance({ nightLight: n });
      });
    }
    root.querySelectorAll("[data-glass-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.glassPreset;
        if (id === "solid") window.OS.applyAppearance({ glass: 100, blur: 0 });
        if (id === "acrylic") window.OS.applyAppearance({ glass: 82, blur: 20 });
        if (id === "vibrancy") window.OS.applyAppearance({ glass: 62, blur: 32 });
        paint(root);
      });
    });
    root.querySelectorAll("[data-icon-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.OS.applyAppearance({ iconSize: btn.dataset.iconSize });
        paint(root);
      });
    });
    const resetTypes = root.querySelector("#os-file-types-reset");
    if (resetTypes) {
      resetTypes.addEventListener("click", () => {
        if (window.OSFileApps) window.OSFileApps.resetDefaults();
        paint(root);
      });
    }
    root.querySelectorAll("[data-file-app]").forEach((box) => {
      box.addEventListener("change", () => {
        const ext = box.dataset.fileExt;
        const checked = Array.from(root.querySelectorAll(`[data-file-ext="${ext}"]`))
          .filter((el) => el.checked)
          .map((el) => el.dataset.fileApp);
        const current = window.OSFileApps.prefFor(ext);
        window.OSFileApps.setExtPref(ext, { apps: checked, default: current.default });
        paint(root);
      });
    });
    root.querySelectorAll("[data-file-default]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const ext = sel.dataset.fileDefault;
        const current = window.OSFileApps.prefFor(ext);
        window.OSFileApps.setExtPref(ext, { apps: current.apps, default: sel.value || null });
        paint(root);
      });
    });
    const filter = root.querySelector("#os-install-filter");
    if (filter) {
      filter.addEventListener("input", () => {
        installFilter = filter.value;
        const keep = filter.selectionStart;
        paint(root);
        const next = root.querySelector("#os-install-filter");
        if (next) {
          next.focus();
          next.setSelectionRange(keep, keep);
        }
      });
    }
    root.querySelectorAll("[data-install-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.OS.toggleInstalled(btn.dataset.installId);
        paint(root);
      });
    });
    const installAll = root.querySelector("#os-install-all");
    if (installAll) {
      installAll.addEventListener("click", () => {
        window.OS.installAll();
        paint(root);
      });
    }
    const uninstallAll = root.querySelector("#os-uninstall-all");
    if (uninstallAll) {
      uninstallAll.addEventListener("click", () => {
        window.OS.uninstallAll();
        paint(root);
      });
    }
    const installPrerelease = root.querySelector("#os-install-prerelease");
    if (installPrerelease) {
      installPrerelease.addEventListener("click", () => {
        window.OS.installPrerelease();
        paint(root);
      });
    }
    root.querySelectorAll("[data-wallpaper-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.OS.setWallpaper(btn.dataset.wallpaperId);
        paint(root);
      });
    });
    root.querySelectorAll("[data-delete-wallpaper]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeWallpaper(btn.dataset.deleteWallpaper, root);
      });
    });
    const motion = root.querySelector("#os-reduced-motion");
    if (motion) {
      motion.addEventListener("change", () => {
        if (window.OS && window.OS.applyReducedMotion) window.OS.applyReducedMotion(motion.checked);
      });
    }
    bindOfflineButtons(root);
  }

  function offlinePhaseLabel(info) {
    if (!info.supported) return t("offlineUnsupported");
    if (!info.secure) return t("offlineNeedHttps");
    if (info.phase === "downloading" || info.phase === "registering") return t("offlineStatusDownloading");
    if (info.phase === "clearing") return t("offlineStatusClearing");
    if (info.phase === "error") return t("offlineStatusError");
    if (info.enabled && info.lastSync) return t("offlineStatusReady");
    return t("offlineStatusInactive");
  }

  function updateOfflinePane(root) {
    if (!root || currentPane !== "offline") return;
    const api = window.OSOffline;
    const info = api ? api.getStatus() : { supported: false, secure: false, phase: "idle" };
    const busy = info.phase === "downloading" || info.phase === "registering" || info.phase === "clearing";
    const statusEl = root.querySelector("#os-offline-status");
    const syncEl = root.querySelector("#os-offline-sync");
    const cacheEl = root.querySelector("#os-offline-cache");
    const progressLabel = root.querySelector("#os-offline-progress-label");
    const progress = root.querySelector("#os-offline-progress");
    const bar = progress ? progress.querySelector("span") : null;
    const failedEl = root.querySelector("#os-offline-failed");
    const errorEl = root.querySelector("#os-offline-error");
    if (statusEl) statusEl.textContent = offlinePhaseLabel(info);
    if (syncEl) {
      syncEl.textContent = info.lastSync
        ? t("offlineLastSync", { when: formatOfflineWhen(info.lastSync) })
        : t("offlineNever");
    }
    if (cacheEl) {
      const size = formatOfflineSize(info.cacheBytes || 0);
      cacheEl.textContent = t("offlineCacheSize", { size });
    }
    const canNet = typeof navigator === "undefined" || navigator.onLine;
    if (progress) progress.hidden = !info.total;
    if (progressLabel) {
      progressLabel.textContent = info.total ? t("offlineProgress", { done: info.done, total: info.total }) : "";
    }
    if (bar && info.total) bar.style.width = Math.round((info.done / info.total) * 100) + "%";
    if (failedEl) {
      failedEl.textContent = info.failed ? t("offlineFailed", { n: info.failed }) : "";
    }
    if (errorEl) {
      let msg = "";
      if (!info.supported) msg = t("offlineUnsupported");
      else if (!info.secure) msg = t("offlineNeedHttps");
      else if (!canNet && !busy) msg = t("offlineNeedOnline");
      else if (info.error === "quota") msg = t("offlineQuota");
      else if (info.error) msg = t("offlineStatusError");
      else if (info.persisted && info.enabled) msg = t("offlinePersistOk");
      else if (api && api.updateAvailable && api.updateAvailable()) msg = t("offlineUpdateHint");
      errorEl.textContent = msg;
    }
    const lite = root.querySelector("#os-offline-lite");
    const full = root.querySelector("#os-offline-full");
    const update = root.querySelector("#os-offline-update");
    const clear = root.querySelector("#os-offline-clear");
    const allowDl = info.supported && info.secure && canNet && !busy;
    if (lite) lite.disabled = !allowDl;
    if (full) full.disabled = !allowDl;
    if (update) update.disabled = !allowDl || !info.enabled;
    if (clear) clear.disabled = busy || (!info.enabled && info.phase === "idle");
  }

  function bindOffline(root) {
    if (offlineUnsub) {
      offlineUnsub();
      offlineUnsub = null;
    }
    if (currentPane !== "offline" || !window.OSOffline) return;
    updateOfflinePane(root);
    offlineUnsub = window.OSOffline.subscribe(() => updateOfflinePane(root));
  }

  function bindOfflineButtons(root) {
    const lite = root.querySelector("#os-offline-lite");
    const full = root.querySelector("#os-offline-full");
    const update = root.querySelector("#os-offline-update");
    const clear = root.querySelector("#os-offline-clear");
    if (!window.OSOffline) return;
    if (lite) {
      lite.addEventListener("click", () => {
        window.OSOffline.download("lite").catch(() => {});
      });
    }
    if (full) {
      full.addEventListener("click", () => {
        window.OSOffline.download("full").catch(() => {});
      });
    }
    if (update) {
      update.addEventListener("click", () => {
        const info = window.OSOffline.getStatus();
        window.OSOffline.download(info.pack || "lite").catch(() => {});
      });
    }
    if (clear) {
      clear.addEventListener("click", () => {
        window.OSOffline.disable().catch(() => {});
      });
    }
  }

  return { mount, remountOpen, currentPane: () => currentPane };
})();
