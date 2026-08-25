window.OSSettings = (function () {
  const BUILTIN_WALLPAPERS = ["bloom", "playground-dark", "playground-light", "aurora", "dusk", "horizon"];
  const MAX_WALLPAPER_BYTES = 8 * 1024 * 1024;
  const IMAGE_EXT = /\.(png|jpe?g|jfif|gif|webp|bmp|svg|avif|heic|heif|tif|tiff)$/i;

  let currentPane = "preferences";
  let installFilter = "";
  let customWalls = [];
  let uploadHint = "";
  let fileBound = false;
  const customUrls = new Map();

  function t(key) {
    return window.OSI18n.t(key);
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
    if (id === "bloom") return t("wallpaperBloom");
    if (id === "aurora") return t("wallpaperAurora");
    if (id === "dusk") return t("wallpaperDusk");
    if (id === "horizon") return t("wallpaperHorizon");
    if (id === "playground-dark") return t("wallpaperPlaygroundDark");
    if (id === "playground-light") return t("wallpaperPlaygroundLight");
    return id;
  }

  function paneHtml() {
    if (currentPane === "install") return installHtml();
    if (currentPane === "appearance") return appearanceHtml();
    if (currentPane === "more") {
      return `<h2>${escapeHtml(t("comingSoon"))}</h2><p class="muted">${escapeHtml(t("comingSoon"))}</p>`;
    }
    return preferencesHtml();
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

  function appearanceHtml() {
    const theme = window.OS.theme;
    const current = window.OS.state.wallpaperId || "bloom";
    const builtinTiles = BUILTIN_WALLPAPERS.map((id) => {
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
          <button type="button" data-pane="install" class="${currentPane === "install" ? "active" : ""}">${escapeHtml(t("installApps"))}</button>
          <button type="button" data-pane="more" class="${currentPane === "more" ? "active" : ""}">${escapeHtml(t("more"))}</button>
        </nav>
        <div class="settings-panel">${paneHtml()}</div>
      </div>
    `;
    bind(root);
    const next = root.querySelector(".settings-panel");
    if (next) next.scrollTop = scrollTop;
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
  }

  return { mount, remountOpen };
})();
