window.OSAppBuilder = (function () {
  const MAX_HTML_BYTES = 1.5 * 1024 * 1024;
  const MAX_ICON_BYTES = 512 * 1024;
  const iconUrls = new Map();
  let records = [];
  let view = "home";
  let editingId = null;
  let deleteId = null;
  let showInstructions = false;
  let copied = false;
  let saving = false;
  let error = "";
  let codeTab = "config";
  let form = emptyForm();

  function emptyForm() {
    return {
      name: "",
      desc: "",
      url: "",
      html: "",
      galleryId: "globe",
      galleryColor: "teal",
    };
  }

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

  function localized(text) {
    const value = String(text || "");
    return { en: value, pt: value, ja: value };
  }

  function myAppsTag() {
    return { en: "My apps", pt: "Meus apps", ja: "マイアプリ" };
  }

  function newUserAppId() {
    if (window.crypto && crypto.randomUUID) return "user-" + crypto.randomUUID();
    return "user-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function isValidRecord(row) {
    return (
      row &&
      typeof row.id === "string" &&
      row.id.startsWith("user-") &&
      (row.mode === "url" || row.mode === "html") &&
      typeof row.name === "string"
    );
  }

  function revokeIcon(id) {
    const url = iconUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    iconUrls.delete(id);
  }

  function iconUrlFor(record) {
    if (!record) return window.OSBuilderIcons.dataUrl("globe", "teal");
    if (record.iconType === "gallery") {
      return window.OSBuilderIcons.dataUrl(record.galleryId || "globe", record.galleryColor || "teal");
    }
    if (record.iconBlob) {
      if (iconUrls.has(record.id)) return iconUrls.get(record.id);
      const url = URL.createObjectURL(record.iconBlob);
      iconUrls.set(record.id, url);
      return url;
    }
    return window.OSBuilderIcons.dataUrl("globe", "teal");
  }

  function toCatalogApp(record) {
    return {
      id: record.id,
      href: record.mode === "url" ? record.url : null,
      url: record.url || "",
      html: record.html || "",
      icon: iconUrlFor(record),
      kind: "user",
      mode: record.mode,
      uninstallable: true,
      defaultInstalled: true,
      channel: "stable",
      tag: myAppsTag(),
      name: localized(record.name),
      desc: localized(record.desc),
    };
  }

  function syncCatalog() {
    if (window.OSCatalog && window.OSCatalog.setUserApps) {
      window.OSCatalog.setUserApps(records.map(toCatalogApp));
    }
  }

  async function hydrate() {
    try {
      const rows = await window.OSState.listUserApps();
      records = (rows || []).filter(isValidRecord).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
      console.warn("userApps load failed", err);
      records = [];
    }
    syncCatalog();
  }

  function parseHttpUrl(value) {
    try {
      const parsed = new URL(String(value || "").trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  async function blobFromResponse(res) {
    if (!res || !res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size < 16 || blob.size > MAX_ICON_BYTES) return null;
    return blob;
  }

  async function fetchFavicon(pageUrl) {
    const parsed = parseHttpUrl(pageUrl);
    if (!parsed) return null;
    const host = parsed.hostname;
    const candidates = [
      parsed.origin + "/favicon.ico",
      "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64",
      "https://icons.duckduckgo.com/ip3/" + encodeURIComponent(host) + ".ico",
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      try {
        const res = await fetch(candidates[i], { mode: "cors" });
        const blob = await blobFromResponse(res);
        if (blob) return blob;
      } catch (_) {
        /* try next */
      }
    }
    return window.OSBuilderIcons.blob("globe", "teal");
  }

  function htmlBytes(html) {
    return new Blob([html || ""]).size;
  }

  function homeHtml() {
    const rows = records
      .filter((record) => !record.projectPath)
      .map((record) => {
        const app = toCatalogApp(record);
        const modeLabel = record.mode === "url" ? t("builderModeUrl") : t("builderModeHtml");
        return `<div class="builder-row">
          <img src="${escapeHtml(app.icon)}" alt="">
          <div class="meta">
            <strong>${escapeHtml(record.name)}</strong>
            ${record.desc ? `<p class="install-desc">${escapeHtml(record.desc)}</p>` : ""}
            <span>${escapeHtml(modeLabel)}</span>
          </div>
          <div class="builder-row-actions">
            <button type="button" data-edit-id="${escapeHtml(record.id)}">${escapeHtml(t("builderEdit"))}</button>
            <button type="button" class="btn-uninstall" data-delete-id="${escapeHtml(record.id)}">${escapeHtml(t("builderDelete"))}</button>
          </div>
        </div>`;
      })
      .join("");
    return `
      <div class="builder-header">
        <h2>${escapeHtml(t("appBuilder"))}</h2>
        <div class="builder-mode-actions">
          <button type="button" class="btn-install" data-open-mode="url">${escapeHtml(t("byUrl"))}</button>
          <button type="button" class="btn-install" data-open-mode="html">${escapeHtml(t("byCode"))}</button>
        </div>
      </div>
      <h3>${escapeHtml(t("builderCreatedApps"))}</h3>
      <div class="builder-list">
        ${rows || `<p class="muted">${escapeHtml(t("builderEmpty"))}</p>`}
      </div>
    `;
  }

  function galleryHtml() {
    const ids = window.OSBuilderIcons.IDS;
    const color = form.galleryColor || "teal";
    const chips = ["teal", "blue", "orange"]
      .map((id) => {
        const label =
          id === "blue" ? t("builderIconColorBlue") : id === "orange" ? t("builderIconColorOrange") : t("builderIconColorTeal");
        const selected = color === id ? " selected" : "";
        return `<button type="button" class="builder-color${selected}" data-icon-color="${id}" title="${escapeHtml(label)}">
          <span class="builder-color-swatch" data-color="${id}"></span>${escapeHtml(label)}
        </button>`;
      })
      .join("");
    const tiles = ids
      .map((id) => {
        const selected = form.galleryId === id ? " selected" : "";
        return `<button type="button" class="builder-icon-tile${selected}" data-icon-id="${id}" title="${id}">
          <img src="${window.OSBuilderIcons.dataUrl(id, color)}" alt="">
        </button>`;
      })
      .join("");
    return `<div class="builder-icon-pane">
      <div class="builder-color-row">${chips}</div>
      <div class="builder-icon-grid">${tiles}</div>
    </div>`;
  }

  function urlFormFields() {
    return `
      <div class="builder-field">
        <label for="os-builder-name">${escapeHtml(t("builderName"))}</label>
        <input id="os-builder-name" type="text" maxlength="80" value="${escapeHtml(form.name)}">
      </div>
      <div class="builder-field">
        <label for="os-builder-desc">${escapeHtml(t("builderDesc"))}</label>
        <input id="os-builder-desc" type="text" maxlength="200" value="${escapeHtml(form.desc)}">
      </div>
      <div class="builder-field">
        <label for="os-builder-url">${escapeHtml(t("builderUrl"))}</label>
        <input id="os-builder-url" type="url" value="${escapeHtml(form.url)}" placeholder="https://">
      </div>
      <p class="muted">${escapeHtml(t("builderEmbedHint"))}</p>
      ${error ? `<p class="builder-error">${escapeHtml(error)}</p>` : ""}
    `;
  }

  function codeTabPane() {
    if (codeTab === "code") {
      return `<div class="builder-code-pane">
        <div class="builder-code-toolbar">
          <span>${escapeHtml(t("builderHtml"))}</span>
          <button type="button" class="builder-link" data-open-instructions="1">${escapeHtml(t("builderInstructions"))}</button>
        </div>
        <textarea id="os-builder-html" class="builder-code-textarea" spellcheck="false">${escapeHtml(form.html)}</textarea>
      </div>`;
    }
    if (codeTab === "icon") return galleryHtml();
    return `
      <div class="builder-field">
        <label for="os-builder-name">${escapeHtml(t("builderName"))}</label>
        <input id="os-builder-name" type="text" maxlength="80" value="${escapeHtml(form.name)}">
      </div>
      <div class="builder-field">
        <label for="os-builder-desc">${escapeHtml(t("builderDesc"))}</label>
        <input id="os-builder-desc" type="text" maxlength="200" value="${escapeHtml(form.desc)}">
      </div>
    `;
  }

  function modalHtml(mode) {
    const title = editingId ? t("builderEdit") : t("byUrl");
    return `<div class="builder-modal-card">
      <h2>${escapeHtml(title)}</h2>
      ${urlFormFields()}
      <div class="builder-modal-actions">
        <button type="button" data-cancel="1">${escapeHtml(t("close"))}</button>
        <button type="button" class="btn-install" data-save="${mode}" ${saving ? "disabled" : ""}>${escapeHtml(t("builderSave"))}</button>
      </div>
    </div>`;
  }

  function codeEditorHtml() {
    const title = editingId ? t("builderEdit") : t("byCode");
    const tabs = [
      { id: "config", label: t("builderTabConfig") },
      { id: "code", label: t("builderTabCode") },
      { id: "icon", label: t("builderIcon") },
    ]
      .map((tab) => {
        const active = codeTab === tab.id ? " active" : "";
        return `<button type="button" class="builder-tab${active}" data-code-tab="${tab.id}">${escapeHtml(tab.label)}</button>`;
      })
      .join("");
    return `<div class="builder-editor">
      <div class="builder-editor-header">
        <h2>${escapeHtml(title)}</h2>
        <div class="builder-tabs">${tabs}</div>
      </div>
      <div class="builder-editor-body">${codeTabPane()}</div>
      <div class="builder-editor-footer">
        ${error ? `<p class="builder-error builder-error-inline">${escapeHtml(error)}</p>` : `<span></span>`}
        <div class="builder-modal-actions">
          <button type="button" data-cancel="1">${escapeHtml(t("close"))}</button>
          <button type="button" class="btn-install" data-save="html" ${saving ? "disabled" : ""}>${escapeHtml(t("builderSave"))}</button>
        </div>
      </div>
    </div>`;
  }

  function confirmHtml() {
    const record = records.find((row) => row.id === deleteId);
    const name = record ? record.name : "";
    return `<div class="builder-modal-card">
      <h2>${escapeHtml(t("builderDeleteConfirm"))}</h2>
      <p>${escapeHtml(t("builderDeleteConfirmBody", { name }))}</p>
      <div class="builder-modal-actions">
        <button type="button" data-cancel="1">${escapeHtml(t("builderCancel"))}</button>
        <button type="button" class="btn-uninstall" data-confirm-delete="1">${escapeHtml(t("builderDelete"))}</button>
      </div>
    </div>`;
  }

  function instructionsHtml() {
    const copyLabel = copied ? t("builderCopied") : t("builderCopyPrompt");
    return `<div class="builder-modal-card builder-modal-wide">
      <h2>${escapeHtml(t("builderInstructionsTitle"))}</h2>
      <p class="builder-pre">${escapeHtml(t("builderInstructionsBody"))}</p>
      <label class="builder-prompt-label">${escapeHtml(t("builderCopyPrompt"))}</label>
      <textarea class="builder-prompt" readonly>${escapeHtml(t("builderAiPrompt"))}</textarea>
      <div class="builder-modal-actions">
        <button type="button" data-close-instructions="1">${escapeHtml(t("builderCancel"))}</button>
        <button type="button" class="btn-install" data-copy-prompt="1">${escapeHtml(copyLabel)}</button>
      </div>
    </div>`;
  }

  function overlayHtml() {
    if (view === "html") {
      const instructions = showInstructions ? `<div class="builder-overlay">${instructionsHtml()}</div>` : "";
      return codeEditorHtml() + instructions;
    }
    if (showInstructions) return `<div class="builder-overlay">${instructionsHtml()}</div>`;
    if (view === "url") return `<div class="builder-overlay">${modalHtml("url")}</div>`;
    if (view === "confirm") return `<div class="builder-overlay">${confirmHtml()}</div>`;
    return "";
  }

  function paint(root) {
    if (!root) return;
    const panel = root.querySelector(".builder-panel");
    const scrollTop = panel ? panel.scrollTop : 0;
    root.innerHTML = `<div class="builder-shell">
      <div class="builder-panel">${homeHtml()}</div>
      ${overlayHtml()}
    </div>`;
    bind(root);
    const next = root.querySelector(".builder-panel");
    if (next) next.scrollTop = scrollTop;
  }

  function openMode(mode, record) {
    view = mode;
    showInstructions = false;
    error = "";
    copied = false;
    if (mode === "html") codeTab = "config";
    if (record) {
      editingId = record.id;
      form = {
        name: record.name || "",
        desc: record.desc || "",
        url: record.url || "",
        html: record.html || "",
        galleryId: record.galleryId || "globe",
        galleryColor: record.galleryColor || "teal",
      };
    } else {
      editingId = null;
      form = emptyForm();
    }
  }

  function closeModal() {
    view = "home";
    editingId = null;
    deleteId = null;
    showInstructions = false;
    error = "";
    saving = false;
    copied = false;
    codeTab = "config";
    form = emptyForm();
  }

  function readForm(root, mode) {
    const name = root.querySelector("#os-builder-name");
    const desc = root.querySelector("#os-builder-desc");
    const url = root.querySelector("#os-builder-url");
    const html = root.querySelector("#os-builder-html");
    form.name = name ? name.value : form.name;
    form.desc = desc ? desc.value : form.desc;
    if (mode === "url" && url) form.url = url.value;
    if (mode === "html" && html) form.html = html.value;
  }

  async function saveUrl() {
    const name = form.name.trim();
    const parsed = parseHttpUrl(form.url);
    if (!name) {
      error = t("builderNameRequired");
      return false;
    }
    if (!parsed) {
      error = t("builderInvalidUrl");
      return false;
    }
    const existing = editingId ? records.find((row) => row.id === editingId) : null;
    const urlChanged = !existing || existing.url !== parsed.href;
    let iconBlob = existing && existing.iconType === "favicon" ? existing.iconBlob : null;
    if (!existing || urlChanged || !iconBlob) {
      iconBlob = await fetchFavicon(parsed.href);
    }
    const now = Date.now();
    const record = {
      id: existing ? existing.id : newUserAppId(),
      mode: "url",
      name,
      desc: form.desc.trim(),
      url: parsed.href,
      html: "",
      iconBlob,
      iconType: "favicon",
      galleryId: "globe",
      galleryColor: "teal",
      createdAt: existing ? existing.createdAt || now : now,
      updatedAt: now,
    };
    await window.OSState.putUserApp(record);
    revokeIcon(record.id);
    upsertRecord(record);
    window.OS.registerUserApp(record.id);
    if (window.OSWindows.refreshUserApp) window.OSWindows.refreshUserApp(record.id);
    return true;
  }

  async function saveHtml() {
    const name = form.name.trim();
    const html = form.html || "";
    if (!name) {
      error = t("builderNameRequired");
      codeTab = "config";
      return false;
    }
    if (!html.trim()) {
      error = t("builderHtmlRequired");
      codeTab = "code";
      return false;
    }
    if (htmlBytes(html) > MAX_HTML_BYTES) {
      error = t("builderHtmlTooLarge");
      codeTab = "code";
      return false;
    }
    const existing = editingId ? records.find((row) => row.id === editingId) : null;
    const galleryId = window.OSBuilderIcons.IDS.includes(form.galleryId) ? form.galleryId : "globe";
    const galleryColor = ["teal", "blue", "orange"].includes(form.galleryColor) ? form.galleryColor : "teal";
    const now = Date.now();
    const record = {
      id: existing ? existing.id : newUserAppId(),
      mode: "html",
      name,
      desc: form.desc.trim(),
      url: "",
      html,
      iconBlob: null,
      iconType: "gallery",
      galleryId,
      galleryColor,
      createdAt: existing ? existing.createdAt || now : now,
      updatedAt: now,
    };
    await window.OSState.putUserApp(record);
    revokeIcon(record.id);
    upsertRecord(record);
    window.OS.registerUserApp(record.id);
    if (window.OSWindows.refreshUserApp) window.OSWindows.refreshUserApp(record.id);
    return true;
  }

  function upsertRecord(record) {
    const i = records.findIndex((row) => row.id === record.id);
    if (i >= 0) records.splice(i, 1, record);
    else records.unshift(record);
    records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    syncCatalog();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    await window.OSState.deleteUserApp(id);
    revokeIcon(id);
    records = records.filter((row) => row.id !== id);
    syncCatalog();
    window.OS.unregisterUserApp(id);
  }

  function bind(root) {
    root.querySelectorAll("[data-open-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openMode(btn.getAttribute("data-open-mode"), null);
        paint(root);
      });
    });
    root.querySelectorAll("[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const record = records.find((row) => row.id === btn.getAttribute("data-edit-id"));
        if (!record) return;
        openMode(record.mode, record);
        paint(root);
      });
    });
    root.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteId = btn.getAttribute("data-delete-id");
        view = "confirm";
        paint(root);
      });
    });
    root.querySelectorAll("[data-code-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        readForm(root, "html");
        codeTab = btn.getAttribute("data-code-tab") || "config";
        paint(root);
      });
    });
    root.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeModal();
        paint(root);
      });
    });
    root.querySelectorAll("[data-confirm-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await confirmDelete();
        } catch (err) {
          console.warn(err);
        }
        closeModal();
        paint(root);
      });
    });
    root.querySelectorAll("[data-open-instructions]").forEach((btn) => {
      btn.addEventListener("click", () => {
        readForm(root, "html");
        showInstructions = true;
        copied = false;
        paint(root);
      });
    });
    root.querySelectorAll("[data-close-instructions]").forEach((btn) => {
      btn.addEventListener("click", () => {
        showInstructions = false;
        copied = false;
        paint(root);
      });
    });
    root.querySelectorAll("[data-copy-prompt]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = t("builderAiPrompt");
        try {
          await navigator.clipboard.writeText(text);
        } catch (_) {
          const area = root.querySelector(".builder-prompt");
          if (area) {
            area.focus();
            area.select();
            document.execCommand("copy");
          }
        }
        copied = true;
        paint(root);
      });
    });
    root.querySelectorAll("[data-icon-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        readForm(root, "html");
        form.galleryColor = btn.getAttribute("data-icon-color");
        paint(root);
      });
    });
    root.querySelectorAll("[data-icon-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        readForm(root, "html");
        form.galleryId = btn.getAttribute("data-icon-id");
        paint(root);
      });
    });
    root.querySelectorAll("[data-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (saving) return;
        const mode = btn.getAttribute("data-save");
        readForm(root, mode);
        error = "";
        saving = true;
        paint(root);
        try {
          const ok = mode === "url" ? await saveUrl() : await saveHtml();
          saving = false;
          if (ok) {
            closeModal();
            if (window.OS.refreshChrome) window.OS.refreshChrome();
          }
          paint(root);
        } catch (err) {
          console.warn(err);
          saving = false;
          error = t("builderSaveFailed");
          paint(root);
        }
      });
    });
  }

  function mount(root) {
    if (!root) return;
    paint(root);
  }

  function remountOpen() {
    document.querySelectorAll(".native-root").forEach((root) => {
      if (root.closest('[data-app-id="app-builder"]')) mount(root);
    });
  }

  return { mount, remountOpen, hydrate };
})();
