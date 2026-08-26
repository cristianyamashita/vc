window.OSFileExplorer = (function () {
  const instances = new Map();
  const DRAG_MIME = "application/x-os-fs";
  const VIEW_KEY = "os-explorer-view";

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

  function viewMode() {
    return localStorage.getItem(VIEW_KEY) === "details" ? "details" : "icons";
  }

  function setViewMode(mode) {
    localStorage.setItem(VIEW_KEY, mode === "details" ? "details" : "icons");
  }

  function parseDrag(event) {
    try {
      const raw = event.dataTransfer.getData(DRAG_MIME);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && Array.isArray(data.ids) ? data.ids : null;
    } catch (_err) {
      return null;
    }
  }

  function instOf(winId) {
    return instances.get(winId) || null;
  }

  function focusedExplorer() {
    const focused = window.OSWindows.focusedId();
    return focused ? instOf(focused) : null;
  }

  function svgIcon(paths) {
    return `<svg class="fe-tool-icon" viewBox="0 0 16 16" aria-hidden="true">${paths}</svg>`;
  }

  const TOOL_ICONS = {
    back: svgIcon('<path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'),
    forward: svgIcon('<path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'),
    up: svgIcon('<path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'),
    newFolder: svgIcon('<path d="M2 5.5V13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1H8L6.5 4H3a1 1 0 0 0-1 1.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 8v4M6 10h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'),
    upload: svgIcon('<path d="M8 11V3M4.5 6L8 2.5 11.5 6M3 13h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'),
    newWindow: svgIcon('<rect x="3" y="5" width="9" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 5V3.5A1 1 0 0 1 7 2.5h5.5A1 1 0 0 1 13.5 3.5V10" fill="none" stroke="currentColor" stroke-width="1.3"/>'),
    "view-icons": svgIcon('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx=".8" fill="currentColor"/><rect x="9" y="2.5" width="4.5" height="4.5" rx=".8" fill="currentColor"/><rect x="2.5" y="9" width="4.5" height="4.5" rx=".8" fill="currentColor"/><rect x="9" y="9" width="4.5" height="4.5" rx=".8" fill="currentColor"/>'),
    "view-details": svgIcon('<path d="M3 4h10M3 8h10M3 12h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="4.5" cy="4" r="1" fill="currentColor"/><circle cx="4.5" cy="8" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/>'),
  };

  function toolbarBtn(act, label) {
    return `<button type="button" class="fe-btn fe-icon-btn" data-act="${act}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${TOOL_ICONS[act] || escapeHtml(label)}</button>`;
  }

  function shellHtml() {
    return `
      <div class="fe-root" tabindex="0">
        <div class="fe-toolbar">
          <div class="fe-btn-group">
            ${toolbarBtn("back", t("feBack"))}
            ${toolbarBtn("forward", t("feForward"))}
            ${toolbarBtn("up", t("feUp"))}
          </div>
          <input class="fe-path" spellcheck="false">
          <input class="fe-search" type="search" placeholder="${escapeHtml(t("feSearch"))}">
          <div class="fe-btn-group">
            ${toolbarBtn("newFolder", t("feNewFolder"))}
            ${toolbarBtn("upload", t("feUpload"))}
            ${toolbarBtn("newWindow", t("feNewWindow"))}
          </div>
          <div class="fe-btn-group">
            <button type="button" class="fe-btn fe-icon-btn fe-view" data-act="view-icons" title="${escapeHtml(t("feIcons"))}" aria-label="${escapeHtml(t("feIcons"))}">${TOOL_ICONS["view-icons"]}</button>
            <button type="button" class="fe-btn fe-icon-btn fe-view" data-act="view-details" title="${escapeHtml(t("feDetails"))}" aria-label="${escapeHtml(t("feDetails"))}">${TOOL_ICONS["view-details"]}</button>
          </div>
        </div>
        <div class="fe-body">
          <aside class="fe-tree"></aside>
          <section class="fe-main fe-drop-target" data-drop="cwd"></section>
        </div>
        <footer class="fe-status"></footer>
        <input class="fe-file" type="file" multiple hidden>
        <div class="fe-drop-overlay" hidden><span>${escapeHtml(t("feDropHere"))}</span></div>
        <div class="fe-modal" hidden></div>
      </div>`;
  }

  function ensureExpanded(inst, folderId) {
    if (!inst.expanded) inst.expanded = new Set([window.OSFS.ROOT_ID, window.OSFS.DESKTOP_ID]);
    inst.expanded.add(folderId);
  }

  async function expandAncestors(inst, folderId) {
    ensureExpanded(inst, folderId);
    let cur = await window.OSFS.get(folderId);
    while (cur && cur.parentId) {
      ensureExpanded(inst, cur.parentId);
      cur = await window.OSFS.get(cur.parentId);
    }
  }

  async function go(inst, folderId, push) {
    const node = await window.OSFS.get(folderId);
    if (!node || node.kind !== "folder") return;
    inst.cwdId = node.id;
    await expandAncestors(inst, node.id);
    if (push !== false) {
      inst.history = inst.history.slice(0, inst.histIndex + 1);
      if (inst.history[inst.histIndex] !== node.id) {
        inst.history.push(node.id);
        inst.histIndex = inst.history.length - 1;
      }
    }
    const win = window.OSWindows.get(inst.winId);
    if (win) {
      win.path = await window.OSFS.pathOf(node.id);
      win.titleName = node.id === window.OSFS.ROOT_ID ? t("fileExplorer") : node.name || t("fileExplorer");
      window.OSWindows.refreshTitles();
    }
    await render(inst);
  }

  async function renderTree(inst) {
    if (!inst.expanded) inst.expanded = new Set([window.OSFS.ROOT_ID, window.OSFS.DESKTOP_ID]);
    const folders = await window.OSFS.listFolders();
    const byParent = new Map();
    folders.forEach((folder) => {
      const key = folder.parentId == null ? "" : folder.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(folder);
    });
    byParent.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));

    function branch(parentId, depth) {
      const kids = byParent.get(parentId) || [];
      return kids
        .map((folder) => {
          const childFolders = byParent.get(folder.id) || [];
          const hasKids = childFolders.length > 0;
          const isExpanded = inst.expanded.has(folder.id);
          const active = inst.cwdId === folder.id ? " open" : "";
          const label = folder.name || "/";
          const twisty = hasKids
            ? `<button type="button" class="fe-twisty${isExpanded ? " expanded" : ""}" data-toggle="${escapeHtml(folder.id)}" aria-label="${escapeHtml(isExpanded ? t("feCollapse") : t("feExpand"))}"></button>`
            : `<span class="fe-twisty-spacer"></span>`;
          const kidsHtml = hasKids && isExpanded ? branch(folder.id, depth + 1) : "";
          return `<div class="fe-tree-row" style="padding-left:${6 + depth * 12}px">
            ${twisty}
            <button type="button" class="fe-tree-item${active} fe-drop-target" data-id="${escapeHtml(folder.id)}" data-drop="${escapeHtml(folder.id)}">${window.OSFS.iconFor(folder)}<span>${escapeHtml(label)}</span></button>
          </div>${kidsHtml}`;
        })
        .join("");
    }

    const rootActive = inst.cwdId === window.OSFS.ROOT_ID ? " open" : "";
    const rootExpanded = inst.expanded.has(window.OSFS.ROOT_ID);
    const rootKids = byParent.get(window.OSFS.ROOT_ID) || [];
    const rootTwisty = rootKids.length
      ? `<button type="button" class="fe-twisty${rootExpanded ? " expanded" : ""}" data-toggle="${window.OSFS.ROOT_ID}" aria-label="${escapeHtml(rootExpanded ? t("feCollapse") : t("feExpand"))}"></button>`
      : `<span class="fe-twisty-spacer"></span>`;
    inst.root.querySelector(".fe-tree").innerHTML =
      `<div class="fe-tree-row" style="padding-left:6px">${rootTwisty}<button type="button" class="fe-tree-item${rootActive} fe-drop-target" data-id="${window.OSFS.ROOT_ID}" data-drop="${window.OSFS.ROOT_ID}">${window.OSFS.iconFor({ kind: "folder" })}<span>/</span></button></div>` +
      (rootExpanded ? branch(window.OSFS.ROOT_ID, 1) : "");
  }

  function selectedNodes(inst, items) {
    return items.filter((n) => inst.selected.has(n.id));
  }

  async function desktopShortcuts() {
    const state = window.OS && window.OS.state;
    if (!state || !Array.isArray(state.desktopIcons)) return [];
    const lang = (window.OS && window.OS.lang) || "en";
    const now = Date.now();
    return state.desktopIcons
      .map((appId) => {
        const app = window.OSCatalog.byId(appId);
        if (!app) return null;
        if (window.OS && !window.OS.isInstalled(appId)) return null;
        return {
          id: "app::" + app.id,
          appId: app.id,
          parentId: window.OSFS.DESKTOP_ID,
          name: window.OSCatalog.displayName(app, lang),
          kind: "shortcut",
          mime: "application/x-os-shortcut",
          size: 0,
          createdAt: now,
          modifiedAt: now,
          icon: app.icon || "",
          system: false,
          virtual: true,
        };
      })
      .filter(Boolean);
  }

  async function listFolderItems(folderId) {
    const files = await window.OSFS.list(folderId);
    if (folderId !== window.OSFS.DESKTOP_ID) return files;
    const shortcuts = await desktopShortcuts();
    const fileNames = new Set(files.map((n) => n.name.toLowerCase()));
    const uniqueShortcuts = shortcuts.filter((s) => !fileNames.has(s.name.toLowerCase()));
    return files.concat(uniqueShortcuts);
  }

  function findItem(inst, id) {
    return (inst.items || []).find((n) => n.id === id) || null;
  }

  function isShortcut(node) {
    return !!(node && node.kind === "shortcut");
  }

  function kindRank(node) {
    if (!node) return 9;
    if (node.kind === "folder") return 0;
    if (node.kind === "shortcut") return 1;
    return 2;
  }

  async function renderMain(inst) {
    const items = await listFolderItems(inst.cwdId);
    inst.items = items;
    const q = (inst.search || "").trim().toLowerCase();
    let shown = q ? items.filter((n) => n.name.toLowerCase().includes(q)) : items.slice();
    const key = inst.sortKey || "name";
    const dir = inst.sortDir === "desc" ? -1 : 1;
    shown.sort((a, b) => {
      const ra = kindRank(a);
      const rb = kindRank(b);
      if (ra !== rb) return ra - rb;
      let av = a.name;
      let bv = b.name;
      if (key === "modified") {
        av = a.modifiedAt;
        bv = b.modifiedAt;
      } else if (key === "type") {
        av = window.OSFS.typeLabel(a, t);
        bv = window.OSFS.typeLabel(b, t);
      } else if (key === "size") {
        av = a.kind === "folder" || a.kind === "shortcut" ? -1 : a.size;
        bv = b.kind === "folder" || b.kind === "shortcut" ? -1 : b.size;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.localeCompare(b.name);
    });

    const main = inst.root.querySelector(".fe-main");
    const mode = viewMode();
    inst.root.querySelectorAll(".fe-view").forEach((btn) => {
      btn.classList.toggle("on", btn.dataset.act === "view-" + mode);
    });

    if (mode === "details") {
      main.className = "fe-main details fe-drop-target";
      main.dataset.drop = "cwd";
      main.innerHTML = `
        <table class="fe-table">
          <thead><tr>
            <th data-sort="name">${escapeHtml(t("feName"))}</th>
            <th data-sort="modified">${escapeHtml(t("feModified"))}</th>
            <th data-sort="type">${escapeHtml(t("feType"))}</th>
            <th data-sort="size">${escapeHtml(t("feSize"))}</th>
          </tr></thead>
          <tbody>
            ${shown
              .map((n) => {
                const sel = inst.selected.has(n.id) ? " selected" : "";
                const date = isShortcut(n) ? "—" : new Date(n.modifiedAt).toLocaleString();
                const size = n.kind === "folder" || isShortcut(n) ? "" : window.OSFS.formatSize(n.size);
                const drag = isShortcut(n) ? "" : ' draggable="true"';
                return `<tr class="fe-row${sel}${n.kind === "folder" ? " fe-drop-target" : ""}${isShortcut(n) ? " fe-shortcut" : ""}" data-id="${escapeHtml(n.id)}"${n.kind === "folder" ? ` data-drop="${escapeHtml(n.id)}"` : ""}${drag}>
                  <td>${window.OSFS.iconFor(n)}<span>${escapeHtml(n.name)}</span></td>
                  <td>${escapeHtml(date)}</td>
                  <td>${escapeHtml(window.OSFS.typeLabel(n, t))}</td>
                  <td>${escapeHtml(size)}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>`;
    } else {
      main.className = "fe-main icons fe-drop-target";
      main.dataset.drop = "cwd";
      main.innerHTML = shown
        .map((n) => {
          const sel = inst.selected.has(n.id) ? " selected" : "";
          const drag = isShortcut(n) ? "" : ' draggable="true"';
          return `<button type="button" class="fe-icon${sel}${n.kind === "folder" ? " fe-drop-target" : ""}${isShortcut(n) ? " fe-shortcut" : ""}" data-id="${escapeHtml(n.id)}"${n.kind === "folder" ? ` data-drop="${escapeHtml(n.id)}"` : ""}${drag}>${window.OSFS.iconFor(n)}<span>${escapeHtml(n.name)}</span></button>`;
        })
        .join("");
    }

    const selected = selectedNodes(inst, items);
    const count = items.length;
    let status = t("feItemCount", { n: count });
    if (selected.length) {
      const bytes = selected.filter((n) => n.kind === "file").reduce((s, n) => s + (n.size || 0), 0);
      status += " · " + t("feSelectedCount", { n: selected.length });
      if (bytes) status += " · " + window.OSFS.formatSize(bytes);
    }
    inst.root.querySelector(".fe-status").textContent = status;
    const pathInput = inst.root.querySelector(".fe-path");
    if (document.activeElement !== pathInput) {
      pathInput.value = await window.OSFS.pathOf(inst.cwdId);
    }
  }

  async function render(inst) {
    if (!inst || !inst.root.isConnected) return;
    await renderTree(inst);
    await renderMain(inst);
  }

  function itemEl(target) {
    return target.closest("[data-id]");
  }

  async function selectClick(inst, id, event) {
    if (!id) {
      inst.selected.clear();
      await renderMain(inst);
      return;
    }
    if (event.shiftKey && inst.anchorId) {
      const ids = (inst.items || []).map((n) => n.id);
      const a = ids.indexOf(inst.anchorId);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        inst.selected = new Set(ids.slice(lo, hi + 1));
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (inst.selected.has(id)) inst.selected.delete(id);
      else inst.selected.add(id);
      inst.anchorId = id;
    } else {
      inst.selected = new Set([id]);
      inst.anchorId = id;
    }
    await renderMain(inst);
  }

  async function openNode(inst, node) {
    if (!node) return;
    if (isShortcut(node)) {
      if (node.appId) window.OSWindows.open(node.appId);
      return;
    }
    if (node.kind === "folder") {
      inst.selected.clear();
      await go(inst, node.id);
      return;
    }
    const kind = window.OSFS.openKind(node);
    if (kind === "download") {
      await window.OSFS.download(node.id);
      return;
    }
    await showViewer(inst, node, kind);
  }

  function closeModal(inst) {
    if (inst.previewUrl) {
      URL.revokeObjectURL(inst.previewUrl);
      inst.previewUrl = null;
    }
    const modal = inst.root.querySelector(".fe-modal");
    modal.hidden = true;
    modal.innerHTML = "";
  }

  function modalFrame(title, body, actions) {
    return `<div class="fe-dialog">
      <header><strong>${escapeHtml(title)}</strong><button type="button" data-act="close-modal" aria-label="${escapeHtml(t("close"))}">×</button></header>
      <div class="fe-dialog-body">${body}</div>
      ${actions ? `<footer>${actions}</footer>` : ""}
    </div>`;
  }

  async function showViewer(inst, node, kind) {
    closeModal(inst);
    const modal = inst.root.querySelector(".fe-modal");
    const blob = await window.OSFS.getBlob(node.id);
    if (!blob) return;
    inst.previewUrl = URL.createObjectURL(blob);
    let body = "";
    if (kind === "image") body = `<img class="fe-preview-img" src="${inst.previewUrl}" alt="">`;
    else if (kind === "audio") body = `<audio class="fe-preview-media" controls src="${inst.previewUrl}"></audio>`;
    else if (kind === "video") body = `<video class="fe-preview-media" controls src="${inst.previewUrl}"></video>`;
    else if (kind === "pdf") body = `<iframe class="fe-preview-frame" src="${inst.previewUrl}"></iframe>`;
    else {
      if (node.size > window.OSFS.TEXT_MAX) {
        body = `<p>${escapeHtml(t("feTooLarge"))}</p>`;
      } else {
        const text = await blob.text();
        body = `<pre class="fe-preview-text">${escapeHtml(text)}</pre>`;
      }
    }
    modal.innerHTML = modalFrame(node.name, body, `<button type="button" data-act="download-one" data-id="${escapeHtml(node.id)}">${escapeHtml(t("feDownload"))}</button>`);
    modal.hidden = false;
  }

  async function showProperties(inst, node) {
    closeModal(inst);
    const path = isShortcut(node) ? "/Desktop" : await window.OSFS.pathOf(node.id);
    const rows = [
      [t("feName"), node.name],
      [t("fePath"), path],
      [t("feType"), window.OSFS.typeLabel(node, t)],
      [t("feMime"), isShortcut(node) ? "—" : node.mime || "—"],
      [t("feSize"), node.kind === "folder" || isShortcut(node) ? "—" : window.OSFS.formatSize(node.size)],
      [t("feCreated"), isShortcut(node) ? "—" : new Date(node.createdAt).toLocaleString()],
      [t("feModified"), isShortcut(node) ? "—" : new Date(node.modifiedAt).toLocaleString()],
    ]
      .map(([k, v]) => `<div class="fe-prop"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`)
      .join("");
    const modal = inst.root.querySelector(".fe-modal");
    modal.innerHTML = modalFrame(t("feProperties"), rows);
    modal.hidden = false;
  }

  async function promptName(title, value) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "fe-prompt-overlay";
      overlay.innerHTML = `<form class="fe-prompt">
        <label>${escapeHtml(title)}</label>
        <input name="name" value="${escapeHtml(value || "")}" spellcheck="false">
        <div class="fe-prompt-actions">
          <button type="submit">${escapeHtml(t("feOk"))}</button>
          <button type="button" data-cancel="1">${escapeHtml(t("feCancel"))}</button>
        </div>
      </form>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector("input");
      input.focus();
      input.select();
      const done = (val) => {
        overlay.remove();
        resolve(val);
      };
      overlay.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        done(input.value.trim());
      });
      overlay.querySelector("[data-cancel]").addEventListener("click", () => done(null));
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") done(null);
      });
    });
  }

  async function newFolder(parentId, suggested) {
    const name = await promptName(t("feNewFolder"), suggested || t("feNewFolderName"));
    if (!name) return null;
    return window.OSFS.createFolder(parentId, name);
  }

  async function renameSelected(inst) {
    const id = [...inst.selected][0];
    if (!id) return;
    const node = findItem(inst, id) || (await window.OSFS.get(id));
    if (!node || isShortcut(node) || window.OSFS.isSystem(node)) return;
    const name = await promptName(t("feRename"), node.name);
    if (!name) return;
    await window.OSFS.rename(id, name);
  }

  async function deleteSelected(inst) {
    const ids = [...inst.selected];
    if (!ids.length) return;
    const nodes = ids.map((id) => findItem(inst, id)).filter(Boolean);
    const shortcuts = nodes.filter(isShortcut);
    const files = nodes.filter((n) => !isShortcut(n) && !window.OSFS.isSystem(n));
    if (!shortcuts.length && !files.length) return;
    if (!confirm(t("feConfirmDelete"))) return;
    for (const node of shortcuts) {
      if (node.appId && window.OS.state.desktopIcons.includes(node.appId)) {
        window.OS.toggleDesktopIcon(node.appId);
      }
    }
    for (const node of files) {
      try {
        await window.OSFS.remove(node.id);
      } catch (_err) {}
    }
    inst.selected.clear();
    await render(inst);
  }

  async function dropOn(inst, destId, event) {
    const ids = parseDrag(event);
    if (ids && ids.length) {
      if (event.ctrlKey || event.altKey) await window.OSFS.copy(ids, destId);
      else await window.OSFS.move(ids, destId);
      return;
    }
    if (event.dataTransfer) await window.OSFS.importDataTransfer(destId, event.dataTransfer);
  }

  function isExternalFileDrag(event) {
    const types = event.dataTransfer ? [...event.dataTransfer.types] : [];
    return types.includes("Files") && !types.includes(DRAG_MIME);
  }

  function clearDropHighlights(root) {
    root.querySelectorAll(".fe-drop-hover").forEach((el) => el.classList.remove("fe-drop-hover"));
    const overlay = root.querySelector(".fe-drop-overlay");
    if (overlay) overlay.hidden = true;
  }

  function highlightDropTarget(root, target) {
    root.querySelectorAll(".fe-drop-hover").forEach((el) => el.classList.remove("fe-drop-hover"));
    if (target) target.classList.add("fe-drop-hover");
  }

  function contextItems(inst, node, onEmpty) {
    const clip = window.OSFS.getClipboard();
    const canPaste = !!(clip && clip.ids.length);
    if (onEmpty) {
      return [
        { act: "newFolder", label: t("feNewFolder") },
        { act: "newText", label: t("feNewText") },
        { act: "upload", label: t("feUpload") },
        { act: "paste", label: t("fePaste"), disabled: !canPaste },
        { sep: true },
        { act: "view-icons", label: t("feIcons") },
        { act: "view-details", label: t("feDetails") },
      ];
    }
    const items = [{ act: "open", label: t("feOpen") }];
    if (isShortcut(node)) {
      items.push(
        { sep: true },
        { act: "delete", label: t("removeDesktop") },
        { sep: true },
        { act: "properties", label: t("feProperties") }
      );
      return items;
    }
    if (node.kind === "file") items.push({ act: "download", label: t("feDownload") });
    items.push(
      { sep: true },
      { act: "cut", label: t("feCut"), disabled: window.OSFS.isSystem(node) },
      { act: "copy", label: t("feCopy"), disabled: window.OSFS.isSystem(node) },
      { act: "paste", label: t("fePaste"), disabled: !canPaste },
      { sep: true },
      { act: "rename", label: t("feRename"), disabled: window.OSFS.isSystem(node) },
      { act: "delete", label: t("feDelete"), disabled: window.OSFS.isSystem(node) },
      { sep: true },
      { act: "properties", label: t("feProperties") }
    );
    return items;
  }

  async function runAct(inst, act, node) {
    if (act === "back") {
      if (inst.histIndex > 0) {
        inst.histIndex -= 1;
        await go(inst, inst.history[inst.histIndex], false);
      }
      return;
    }
    if (act === "forward") {
      if (inst.histIndex < inst.history.length - 1) {
        inst.histIndex += 1;
        await go(inst, inst.history[inst.histIndex], false);
      }
      return;
    }
    if (act === "up") {
      const cur = await window.OSFS.get(inst.cwdId);
      if (cur && cur.parentId) await go(inst, cur.parentId);
      return;
    }
    if (act === "newFolder") {
      await newFolder(inst.cwdId);
      return;
    }
    if (act === "newText") {
      const name = await promptName(t("feNewText"), t("feNewTextName"));
      if (name) await window.OSFS.createTextFile(inst.cwdId, name.endsWith(".txt") ? name : name + ".txt");
      return;
    }
    if (act === "upload") {
      inst.root.querySelector(".fe-file").click();
      return;
    }
    if (act === "newWindow") {
      const path = await window.OSFS.pathOf(inst.cwdId);
      window.OSWindows.open("file-explorer", { newInstance: true, path });
      return;
    }
    if (act === "view-icons") {
      setViewMode("icons");
      await renderMain(inst);
      return;
    }
    if (act === "view-details") {
      setViewMode("details");
      await renderMain(inst);
      return;
    }
    if (act === "paste") {
      await window.OSFS.paste(inst.cwdId);
      return;
    }
    if (act === "cut" || act === "copy") {
      const ids = [...inst.selected].filter((id) => {
        const n = findItem(inst, id);
        return n && !isShortcut(n) && !window.OSFS.isSystem(n);
      });
      if (ids.length) window.OSFS.setClipboard(act === "cut" ? "cut" : "copy", ids);
      return;
    }
    if (act === "rename") {
      await renameSelected(inst);
      return;
    }
    if (act === "delete") {
      if (node && isShortcut(node)) {
        inst.selected = new Set([node.id]);
      }
      await deleteSelected(inst);
      return;
    }
    if (act === "open" && node) {
      await openNode(inst, node);
      return;
    }
    if (act === "download" && node) {
      await window.OSFS.download(node.id);
      return;
    }
    if (act === "properties" && node) {
      await showProperties(inst, node);
      return;
    }
    if (act === "close-modal") {
      closeModal(inst);
      return;
    }
    if (act === "download-one") {
      const id = inst.root.querySelector("[data-act=download-one]")?.dataset.id;
      if (id) await window.OSFS.download(id);
    }
  }

  function bind(inst) {
    const root = inst.root;
    root.addEventListener("click", async (e) => {
      const modalBtn = e.target.closest(".fe-modal [data-act]");
      if (modalBtn) {
        await runAct(inst, modalBtn.dataset.act);
        return;
      }
      if (e.target.closest(".fe-modal") && !e.target.closest(".fe-dialog")) {
        closeModal(inst);
        return;
      }
      const tool = e.target.closest(".fe-toolbar [data-act]");
      if (tool) {
        await runAct(inst, tool.dataset.act);
        return;
      }
      const twisty = e.target.closest("[data-toggle]");
      if (twisty) {
        e.preventDefault();
        e.stopPropagation();
        const id = twisty.dataset.toggle;
        if (!inst.expanded) inst.expanded = new Set([window.OSFS.ROOT_ID, window.OSFS.DESKTOP_ID]);
        if (inst.expanded.has(id)) inst.expanded.delete(id);
        else inst.expanded.add(id);
        await renderTree(inst);
        return;
      }
      const tree = e.target.closest(".fe-tree-item");
      if (tree) {
        inst.selected.clear();
        await go(inst, tree.dataset.id);
        return;
      }
      const sort = e.target.closest("th[data-sort]");
      if (sort) {
        if (inst.sortKey === sort.dataset.sort) inst.sortDir = inst.sortDir === "asc" ? "desc" : "asc";
        else {
          inst.sortKey = sort.dataset.sort;
          inst.sortDir = "asc";
        }
        await renderMain(inst);
        return;
      }
      const row = itemEl(e.target);
      if (row && row.closest(".fe-main")) {
        await selectClick(inst, row.dataset.id, e);
        return;
      }
      if (e.target.closest(".fe-main")) {
        inst.selected.clear();
        await renderMain(inst);
      }
    });

    root.addEventListener("dblclick", async (e) => {
      const row = itemEl(e.target);
      if (!row || !row.closest(".fe-main")) return;
      const node = findItem(inst, row.dataset.id) || (await window.OSFS.get(row.dataset.id));
      await openNode(inst, node);
    });

    root.addEventListener("contextmenu", async (e) => {
      if (e.target.closest(".fe-modal")) return;
      const row = itemEl(e.target);
      if (row && row.closest(".fe-main")) {
        e.preventDefault();
        if (!inst.selected.has(row.dataset.id)) {
          inst.selected = new Set([row.dataset.id]);
          inst.anchorId = row.dataset.id;
          await renderMain(inst);
        }
        const node = findItem(inst, row.dataset.id) || (await window.OSFS.get(row.dataset.id));
        window.OSStart.close();
        window.OSStart.showItems(contextItems(inst, node, false), e.clientX, e.clientY, (act) => runAct(inst, act, node));
        return;
      }
      if (e.target.closest(".fe-main") || e.target.closest(".fe-tree")) {
        e.preventDefault();
        window.OSStart.close();
        window.OSStart.showItems(contextItems(inst, null, true), e.clientX, e.clientY, (act) => runAct(inst, act));
      }
    });

    root.addEventListener("keydown", async (e) => {
      if (e.target.closest("input") || e.target.closest("textarea")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        inst.selected = new Set((inst.items || []).map((n) => n.id));
        await renderMain(inst);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        await runAct(inst, "copy");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        await runAct(inst, "cut");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        await runAct(inst, "paste");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        await runAct(inst, "newWindow");
      } else if (e.key === "F2") {
        e.preventDefault();
        await renameSelected(inst);
      } else if (e.key === "Delete") {
        e.preventDefault();
        await deleteSelected(inst);
      } else if (e.key === "Enter") {
        const id = [...inst.selected][0];
        if (id) await openNode(inst, findItem(inst, id) || (await window.OSFS.get(id)));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        await runAct(inst, "up");
      }
    });

    root.querySelector(".fe-path").addEventListener("keydown", async (e) => {
      if (e.key !== "Enter") return;
      const node = await window.OSFS.nodeAtPath(e.target.value);
      if (node && node.kind === "folder") await go(inst, node.id);
      else e.target.value = await window.OSFS.pathOf(inst.cwdId);
    });

    root.querySelector(".fe-search").addEventListener("input", async (e) => {
      inst.search = e.target.value;
      await renderMain(inst);
    });

    root.querySelector(".fe-file").addEventListener("change", async (e) => {
      const files = e.target.files;
      if (files && files.length) await window.OSFS.importFiles(inst.cwdId, files);
      e.target.value = "";
    });

    root.addEventListener("dragstart", (e) => {
      const row = itemEl(e.target);
      if (!row || !row.closest(".fe-main")) return;
      const node = findItem(inst, row.dataset.id);
      if (isShortcut(node)) {
        e.preventDefault();
        return;
      }
      if (!inst.selected.has(row.dataset.id)) inst.selected = new Set([row.dataset.id]);
      const ids = [...inst.selected].filter((id) => {
        const n = findItem(inst, id);
        return n && !isShortcut(n);
      });
      if (!ids.length) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ ids }));
      e.dataTransfer.effectAllowed = "copyMove";
    });

    function resolveDropDest(e) {
      const hit = e.target.closest("[data-drop]");
      if (!hit) return inst.cwdId;
      if (hit.dataset.drop === "cwd") return inst.cwdId;
      return hit.dataset.drop || inst.cwdId;
    }

    root.addEventListener("dragenter", (e) => {
      const types = e.dataTransfer ? [...e.dataTransfer.types] : [];
      if (!types.includes(DRAG_MIME) && !types.includes("Files")) return;
      e.preventDefault();
    });

    root.addEventListener("dragover", (e) => {
      const types = e.dataTransfer ? [...e.dataTransfer.types] : [];
      if (!types.includes(DRAG_MIME) && !types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = types.includes(DRAG_MIME) ? (e.ctrlKey || e.altKey ? "copy" : "move") : "copy";
      const hit = e.target.closest(".fe-drop-target") || e.target.closest(".fe-main");
      highlightDropTarget(root, hit);
      const overlay = root.querySelector(".fe-drop-overlay");
      if (overlay) overlay.hidden = !isExternalFileDrag(e);
    });

    root.addEventListener("dragleave", (e) => {
      if (!root.contains(e.relatedTarget)) clearDropHighlights(root);
    });

    root.addEventListener("drop", async (e) => {
      e.preventDefault();
      const dest = resolveDropDest(e);
      clearDropHighlights(root);
      await dropOn(inst, dest, e);
      if (dest !== inst.cwdId) ensureExpanded(inst, dest);
    });

    root.addEventListener("dragend", () => clearDropHighlights(root));
  }

  async function mount(root, opts) {
    opts = opts || {};
    await window.OSFS.ready();
    root.innerHTML = shellHtml();
    const start = opts.path ? await window.OSFS.nodeAtPath(opts.path) : await window.OSFS.get(window.OSFS.ROOT_ID);
    const cwdId = start && start.kind === "folder" ? start.id : window.OSFS.ROOT_ID;
    const inst = {
      root,
      winId: opts.winId,
      cwdId,
      history: [cwdId],
      histIndex: 0,
      selected: new Set(),
      anchorId: null,
      items: [],
      sortKey: "name",
      sortDir: "asc",
      search: "",
      previewUrl: null,
      expanded: new Set([window.OSFS.ROOT_ID, window.OSFS.DESKTOP_ID]),
    };
    instances.set(opts.winId, inst);
    bind(inst);
    await go(inst, cwdId, false);
    root.querySelector(".fe-root").focus();
  }

  function unmount(winId) {
    const inst = instOf(winId);
    if (!inst) return;
    closeModal(inst);
    instances.delete(winId);
  }

  async function navigate(winId, path) {
    const inst = instOf(winId);
    if (!inst) return;
    const node = await window.OSFS.nodeAtPath(path || "/");
    if (node && node.kind === "folder") await go(inst, node.id);
  }

  async function openPath(path, opts) {
    opts = opts || {};
    const win = window.OSWindows.open("file-explorer", Object.assign({}, opts, { path: path || "/" }));
    if (win && path) await navigate(win.id, path);
    return win;
  }

  async function openDesktopNode(node) {
    if (!node) return;
    if (node.kind === "folder") {
      const path = await window.OSFS.pathOf(node.id);
      await openPath(path);
      return;
    }
    const parent = await window.OSFS.get(node.parentId);
    const path = parent ? await window.OSFS.pathOf(parent.id) : "/Desktop";
    const win = await openPath(path);
    const inst = win ? instOf(win.id) : null;
    if (inst) {
      inst.selected = new Set([node.id]);
      await openNode(inst, node);
    }
  }

  async function propertiesFor(node) {
    if (!node) return;
    const parent = node.kind === "folder" ? node : await window.OSFS.get(node.parentId);
    const path = parent ? await window.OSFS.pathOf(parent.id) : "/";
    const win = await openPath(path);
    const inst = win ? instOf(win.id) : null;
    if (inst) await showProperties(inst, node);
  }

  function remountOpen() {
    instances.forEach((inst) => {
      if (!inst.root || !inst.root.isConnected) return;
      closeModal(inst);
      const winId = inst.winId;
      window.OSFS.pathOf(inst.cwdId).then((path) => mount(inst.root, { winId, path }));
    });
  }

  function refreshOpen() {
    instances.forEach((inst) => {
      if (inst.root && inst.root.isConnected) render(inst);
    });
  }

  window.OSFS.onChange(() => {
    instances.forEach((inst) => {
      if (inst.root && inst.root.isConnected) render(inst);
    });
    if (window.OS && window.OS.renderDesktop) window.OS.renderDesktop();
  });

  return {
    mount,
    unmount,
    navigate,
    openPath,
    openDesktopNode,
    remountOpen,
    refreshOpen,
    promptName,
    newFolder,
    dropOn,
    parseDrag,
    propertiesFor,
    DRAG_MIME,
  };
})();
