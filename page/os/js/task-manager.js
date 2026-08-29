window.OSTaskManager = (function () {
  const roots = new Map();

  function t(key, vars) {
    return window.OSI18n.t(key, vars);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBytes(n) {
    return window.OSFS && window.OSFS.formatSize ? window.OSFS.formatSize(n) : String(n || 0) + " B";
  }

  async function storageInfo() {
    if (window.OS && typeof window.OS.getStorageInfo === "function") return window.OS.getStorageInfo();
    return { used: 0, quota: 0, files: 0, bytes: 0 };
  }

  async function paint(root) {
    const lang = (window.OS && window.OS.lang) || "en";
    const wins = window.OSWindows.list().slice().sort((a, b) => (b.z || 0) - (a.z || 0));
    const installed = (window.OS.state && window.OS.state.installed) || [];
    const natives = window.OSCatalog.nativeApps();
    const info = await storageInfo();
    const quotaText = info.quota
      ? t("storageUsedOf", { used: formatBytes(info.used), quota: formatBytes(info.quota) })
      : t("storageUnknown");
    const rows = wins
      .map((win) => {
        const app = window.OSCatalog.byId(win.appId || window.OSWindows.appIdOf(win.id));
        if (!app) return "";
        const name = win.titleName || window.OSCatalog.displayName(app, lang);
        return `<div class="tm-row" data-win-id="${escapeHtml(win.id)}">
          <img src="${escapeHtml(app.icon || "")}" alt="">
          <div class="tm-meta">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(app.id)}${win.minimized ? " · " + escapeHtml(t("minimize")) : ""}</span>
          </div>
          <button type="button" data-tm-focus="${escapeHtml(win.id)}">${escapeHtml(t("tmFocus"))}</button>
          <button type="button" class="btn-uninstall" data-tm-end="${escapeHtml(win.id)}">${escapeHtml(t("tmEndTask"))}</button>
        </div>`;
      })
      .join("");
    root.innerHTML = `
      <div class="tm-shell">
        <h2>${escapeHtml(t("taskManager"))}</h2>
        <div class="tm-stats">
          <div class="tm-stat"><span>${escapeHtml(t("tmWindows"))}</span><strong>${wins.length}</strong></div>
          <div class="tm-stat"><span>${escapeHtml(t("tmInstalled"))}</span><strong>${natives.length + installed.length}</strong></div>
          <div class="tm-stat"><span>${escapeHtml(t("storage"))}</span><strong>${escapeHtml(quotaText)}</strong></div>
          <div class="tm-stat"><span>${escapeHtml(t("storageFiles"))}</span><strong>${info.files} · ${escapeHtml(formatBytes(info.bytes))}</strong></div>
        </div>
        <h3>${escapeHtml(t("tmWindows"))}</h3>
        <div class="tm-list">${rows || `<p class="muted">${escapeHtml(t("tmNoWindows"))}</p>`}</div>
      </div>
    `;
    root.querySelectorAll("[data-tm-focus]").forEach((btn) => {
      btn.addEventListener("click", () => window.OSWindows.toggleTask(btn.dataset.tmFocus));
    });
    root.querySelectorAll("[data-tm-end]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.OSWindows.close(btn.dataset.tmEnd);
        remountOpen();
      });
    });
  }

  function mount(root) {
    if (!root) return;
    roots.set(root, true);
    paint(root);
  }

  function remountOpen() {
    document.querySelectorAll('.native-root').forEach((root) => {
      if (root.closest('[data-app-id="task-manager"]')) paint(root);
    });
  }

  return { mount, remountOpen };
})();
