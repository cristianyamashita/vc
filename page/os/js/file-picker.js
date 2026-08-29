window.OSFilePicker = (function () {
  let active = null;

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

  function close() {
    if (!active) return;
    const overlay = active.el;
    active = null;
    overlay.remove();
  }

  function ensureExt(name, ext) {
    const base = String(name || "").trim() || "untitled";
    const want = String(ext || "").replace(/^\./, "").toLowerCase();
    if (!want) return base;
    const current = window.OSFileApps ? window.OSFileApps.extOfName(base) : "";
    if (current === want) return base;
    return base.replace(/\.[^.]+$/, "") + "." + want;
  }

  function bindOverlay(overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        if (active && active.reject) active.reject(null);
        close();
      }
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (active && active.reject) active.reject(null);
        close();
      }
    });
  }

  async function open(opts) {
    opts = opts || {};
    if (!window.OSFS) return null;
    close();
    await window.OSFS.ready();
    const exts = (opts.exts || []).map((e) => String(e).replace(/^\./, "").toLowerCase());
    const files = await window.OSFS.listFilesByExt(exts.length ? exts : ["txt"]);
    files.sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0));
    const overlay = document.createElement("div");
    overlay.className = "os-picker-overlay";
    overlay.tabIndex = -1;
    let rows = "";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = await window.OSFS.pathOf(file.parentId || window.OSFS.ROOT_ID);
      rows += `<button type="button" class="os-picker-item" data-id="${escapeHtml(file.id)}"><strong>${escapeHtml(
        file.name
      )}</strong><span>${escapeHtml(path)}</span></button>`;
    }
    if (!rows) rows = `<p class="muted">${escapeHtml(t("pickerEmpty"))}</p>`;
    overlay.innerHTML = `<div class="os-picker-dialog" role="dialog" aria-modal="true">
      <header><strong>${escapeHtml(opts.title || t("pickerOpen"))}</strong><button type="button" data-act="cancel" aria-label="${escapeHtml(t("close"))}">×</button></header>
      <div class="os-picker-list">${rows}</div>
      <footer><button type="button" data-act="cancel">${escapeHtml(t("feCancel"))}</button></footer>
    </div>`;
    document.body.appendChild(overlay);
    bindOverlay(overlay);
    overlay.focus();
    return new Promise((resolve) => {
      active = { el: overlay, reject: () => resolve(null) };
      overlay.querySelector("[data-act=cancel]").addEventListener("click", () => {
        close();
        resolve(null);
      });
      overlay.querySelectorAll("[data-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const node = await window.OSFS.get(btn.dataset.id);
          close();
          resolve(node || null);
        });
      });
    });
  }

  async function saveAs(opts) {
    opts = opts || {};
    if (!window.OSFS) return null;
    close();
    await window.OSFS.ready();
    const ext = String(opts.ext || "").replace(/^\./, "").toLowerCase();
    let selectedId = opts.parentId || null;
    if (!selectedId && window.OSFS.DOCUMENTS_ID) selectedId = window.OSFS.DOCUMENTS_ID;
    const folders = await window.OSFS.listFolders();
    const withPath = [];
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      if (folder.id === window.OSFS.TRASH_ID || (await window.OSFS.isInTrash(folder.id))) continue;
      withPath.push({ folder, path: await window.OSFS.pathOf(folder.id) });
    }
    withPath.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
    if (!selectedId && withPath[0]) selectedId = withPath[0].folder.id;
    const overlay = document.createElement("div");
    overlay.className = "os-picker-overlay";
    overlay.tabIndex = -1;
    overlay.innerHTML = `<div class="os-picker-dialog" role="dialog" aria-modal="true">
      <header><strong>${escapeHtml(opts.title || t("pickerSaveAs"))}</strong><button type="button" data-act="cancel" aria-label="${escapeHtml(t("close"))}">×</button></header>
      <div class="os-picker-body">
        <label class="os-picker-field">${escapeHtml(t("pickerFileName"))}
          <input class="os-picker-name" spellcheck="false" value="${escapeHtml(ensureExt(opts.defaultName || "untitled", ext))}">
        </label>
        <div class="os-picker-field">${escapeHtml(t("pickerFolder"))}
          <div class="os-picker-list os-picker-folders"></div>
        </div>
      </div>
      <footer>
        <button type="button" data-act="cancel">${escapeHtml(t("feCancel"))}</button>
        <button type="button" class="primary" data-act="save">${escapeHtml(t("sheetsSave"))}</button>
      </footer>
    </div>`;
    const listEl = overlay.querySelector(".os-picker-folders");
    withPath.forEach((row) => {
      const depth = String(row.path || "/").split("/").filter(Boolean).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "os-picker-item" + (row.folder.id === selectedId ? " active" : "");
      btn.dataset.id = row.folder.id;
      btn.style.paddingLeft = 8 + depth * 12 + "px";
      btn.innerHTML = `<strong>${escapeHtml(row.path || "/")}</strong>`;
      btn.addEventListener("click", () => {
        selectedId = row.folder.id;
        listEl.querySelectorAll(".os-picker-item").forEach((el) => el.classList.toggle("active", el.dataset.id === selectedId));
      });
      listEl.appendChild(btn);
    });
    document.body.appendChild(overlay);
    bindOverlay(overlay);
    const nameInput = overlay.querySelector(".os-picker-name");
    nameInput.focus();
    nameInput.select();
    return new Promise((resolve) => {
      active = { el: overlay, reject: () => resolve(null) };
      overlay.querySelector("[data-act=cancel]").addEventListener("click", () => {
        close();
        resolve(null);
      });
      overlay.querySelector("[data-act=save]").addEventListener("click", () => {
        const name = ensureExt(nameInput.value.trim() || opts.defaultName || "untitled", ext);
        const parentId = selectedId || window.OSFS.DOCUMENTS_ID;
        close();
        resolve({ parentId, name });
      });
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          overlay.querySelector("[data-act=save]").click();
        }
      });
    });
  }

  async function pickFolder(opts) {
    opts = opts || {};
    if (!window.OSFS) return null;
    close();
    await window.OSFS.ready();
    let selectedId = opts.parentId || null;
    if (!selectedId && window.OSFS.PROJECTS_ID) selectedId = window.OSFS.PROJECTS_ID;
    if (selectedId) {
      const selected = await window.OSFS.get(selectedId);
      if (!selected) {
        const byPath = await window.OSFS.nodeAtPath("/Projects");
        selectedId = byPath ? byPath.id : null;
      }
    }
    if (!selectedId && window.OSFS.DOCUMENTS_ID) selectedId = window.OSFS.DOCUMENTS_ID;
    const folders = await window.OSFS.listFolders();
    const withPath = [];
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      if (folder.id === window.OSFS.TRASH_ID || (await window.OSFS.isInTrash(folder.id))) continue;
      withPath.push({ folder, path: await window.OSFS.pathOf(folder.id) });
    }
    withPath.sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
    if (!selectedId && withPath[0]) selectedId = withPath[0].folder.id;
    const overlay = document.createElement("div");
    overlay.className = "os-picker-overlay";
    overlay.tabIndex = -1;
    overlay.innerHTML = `<div class="os-picker-dialog" role="dialog" aria-modal="true">
      <header><strong>${escapeHtml(opts.title || t("studioPickFolder"))}</strong><button type="button" data-act="cancel" aria-label="${escapeHtml(t("close"))}">×</button></header>
      <div class="os-picker-body">
        <div class="os-picker-field">${escapeHtml(t("pickerFolder"))}
          <div class="os-picker-list os-picker-folders"></div>
        </div>
      </div>
      <footer>
        <button type="button" data-act="cancel">${escapeHtml(t("feCancel"))}</button>
        <button type="button" class="primary" data-act="save">${escapeHtml(t("pickerOpen"))}</button>
      </footer>
    </div>`;
    const listEl = overlay.querySelector(".os-picker-folders");
    withPath.forEach((row) => {
      const depth = String(row.path || "/").split("/").filter(Boolean).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "os-picker-item" + (row.folder.id === selectedId ? " active" : "");
      btn.dataset.id = row.folder.id;
      btn.style.paddingLeft = 8 + depth * 12 + "px";
      btn.innerHTML = `<strong>${escapeHtml(row.path || "/")}</strong>`;
      btn.addEventListener("click", () => {
        selectedId = row.folder.id;
        listEl.querySelectorAll(".os-picker-item").forEach((el) => el.classList.toggle("active", el.dataset.id === selectedId));
      });
      btn.addEventListener("dblclick", () => {
        selectedId = row.folder.id;
        overlay.querySelector("[data-act=save]").click();
      });
      listEl.appendChild(btn);
    });
    document.body.appendChild(overlay);
    bindOverlay(overlay);
    overlay.focus();
    return new Promise((resolve) => {
      active = { el: overlay, reject: () => resolve(null) };
      overlay.querySelector("[data-act=cancel]").addEventListener("click", () => {
        close();
        resolve(null);
      });
      overlay.querySelector("[data-act=save]").addEventListener("click", async () => {
        const parentId = selectedId || window.OSFS.PROJECTS_ID || window.OSFS.DOCUMENTS_ID;
        const folder = parentId ? await window.OSFS.get(parentId) : null;
        const path = folder ? await window.OSFS.pathOf(folder.id) : "/";
        close();
        resolve(folder ? { folder, path, parentId: folder.id } : null);
      });
    });
  }

  return { open, saveAs, pickFolder, close, ensureExt };
})();
