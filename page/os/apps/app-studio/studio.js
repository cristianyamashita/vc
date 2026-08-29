(function () {
  const MONACO_VER = "0.52.2";
  const MONACO_BASE = "https://cdn.jsdelivr.net/npm/monaco-editor@" + MONACO_VER + "/min/vs";
  const root = document.getElementById("studio");

  const state = {
    view: "start",
    recents: [],
    project: null,
    tree: [],
    tabs: [],
    activeId: null,
    buffers: {},
    saved: {},
    monaco: null,
    editor: null,
    fallback: null,
    usingFallback: false,
    modal: null,
    status: "",
    error: "",
    settingsDraft: null,
    installResult: null,
  };

  function host() {
    try {
      if (window.parent && window.parent !== window) return window.parent;
    } catch (_err) {}
    return null;
  }

  function t(key, vars) {
    const text = window.OSAppFrame ? window.OSAppFrame.t(key, key) : key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, name) {
      return vars[name] == null ? "" : String(vars[name]);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fs() {
    const h = host();
    return h && h.OSFS ? h.OSFS : null;
  }

  function slugify(name) {
    const cleaned = String(name || "").replace(/\s+/g, "").replace(/[\\/:*?"<>|]/g, "");
    return cleaned || "App";
  }

  function langOf(name) {
    const ext = String(name || "").split(".").pop().toLowerCase();
    if (ext === "html" || ext === "htm") return "html";
    if (ext === "css") return "css";
    if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript";
    if (ext === "json") return "json";
    return "plaintext";
  }

  function iconUrl(manifest) {
    const h = host();
    const icons = h && h.OSBuilderIcons;
    const icon = (manifest && manifest.icon) || {};
    if (icons) return icons.dataUrl(icon.galleryId || "code", icon.galleryColor || "teal");
    return "";
  }

  function currentWin() {
    const h = host();
    if (!h || !h.OSWindows) return null;
    return (
      h.OSWindows.list().find(function (w) {
        const iframe = w.el && w.el.querySelector("iframe");
        try {
          return iframe && iframe.contentWindow === window;
        } catch (_err) {
          return false;
        }
      }) || null
    );
  }

  function setWindowTitle(name) {
    const win = currentWin();
    if (!win) return;
    win.titleName = name ? name + " — " + t("appStudio") : t("appStudio");
    if (host().OSWindows.refreshTitles) host().OSWindows.refreshTitles();
  }

  function getRecents() {
    const h = host();
    const list = h && h.OS && h.OS.state && Array.isArray(h.OS.state.studioRecent) ? h.OS.state.studioRecent : [];
    return list.slice();
  }

  function rememberRecent(entry) {
    const h = host();
    if (!h || !h.OS || !h.OS.state) return;
    const next = [entry].concat(getRecents().filter(function (row) { return row.path !== entry.path; })).slice(0, 16);
    h.OS.state.studioRecent = next;
    state.recents = next;
    if (typeof h.OS.persistNow === "function") h.OS.persistNow();
  }

  function defaultManifest(name) {
    return {
      name: name || "App",
      description: "",
      icon: { galleryId: "code", galleryColor: "teal" },
      createdAt: Date.now(),
    };
  }

  function templateHtml(name) {
    return (
      "<!doctype html>\n<html lang=\"en\">\n<head>\n" +
      "  <meta charset=\"utf-8\">\n" +
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
      "  <title>" + name + "</title>\n" +
      "  <link rel=\"stylesheet\" href=\"style.css\">\n" +
      "</head>\n<body>\n  <main>\n    <h1>" + name + "</h1>\n" +
      "    <p>Edit this app in App Studio.</p>\n  </main>\n" +
      "  <script src=\"main.js\"></script>\n</body>\n</html>\n"
    );
  }

  function templateCss() {
    return (
      ":root {\n  --bg: #1b1b1b;\n  --ink: #f3f3f3;\n  --accent: #008f7d;\n}\n" +
      "html, body {\n  margin: 0;\n  min-height: 100%;\n  background: var(--bg);\n  color: var(--ink);\n" +
      "  font: 16px/1.5 \"Segoe UI\", system-ui, sans-serif;\n}\n" +
      "main { padding: 32px; }\nh1 { color: var(--accent); }\n"
    );
  }

  function templateJs(name) {
    return "console.log(" + JSON.stringify(name + " ready") + ");\n";
  }

  function isExternal(url) {
    return /^(https?:|data:|blob:|\/\/)/i.test(String(url || "").trim());
  }

  function attr(tag, name) {
    const match = String(tag).match(new RegExp(name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i"));
    return match ? match[1] : "";
  }

  async function childNamed(parentId, name) {
    const kids = await fs().list(parentId);
    const want = String(name || "").toLowerCase();
    return kids.find(function (n) { return String(n.name || "").toLowerCase() === want; }) || null;
  }

  async function resolveRel(folderId, rel) {
    const parts = String(rel || "").replace(/\\/g, "/").split("/").filter(function (p) { return p && p !== "."; });
    let cur = await fs().get(folderId);
    for (let i = 0; i < parts.length; i++) {
      if (!cur) return null;
      if (parts[i] === "..") {
        cur = cur.parentId ? await fs().get(cur.parentId) : cur;
        continue;
      }
      const next = await childNamed(cur.id, parts[i]);
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  async function replaceAsync(text, regex, replacer) {
    const matches = [];
    String(text).replace(regex, function () {
      matches.push(Array.prototype.slice.call(arguments));
      return arguments[0];
    });
    let out = String(text);
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const full = m[0];
      const offset = m[m.length - 2];
      const insert = await replacer.apply(null, m);
      out = out.slice(0, offset) + insert + out.slice(offset + full.length);
    }
    return out;
  }

  async function blobDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  async function assembleProject(folderId) {
    const index = await childNamed(folderId, "index.html");
    if (!index || index.kind !== "file") throw new Error("missing-index");
    let html = await fs().readText(index.id);
    html = await replaceAsync(html, /<link\b[^>]*>/gi, async function (tag) {
      if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) return tag;
      const href = attr(tag, "href");
      if (!href || isExternal(href)) return tag;
      const file = await resolveRel(folderId, href);
      if (!file || file.kind !== "file") return tag;
      const css = await fs().readText(file.id);
      return "<style>\n" + css + "\n</style>";
    });
    html = await replaceAsync(html, /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, async function (tag, src) {
      if (!src || isExternal(src)) return tag;
      const file = await resolveRel(folderId, src);
      if (!file || file.kind !== "file") return tag;
      const js = await fs().readText(file.id);
      return "<script>\n" + js + "\n<\/script>";
    });
    html = await replaceAsync(html, /(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, async function (full, pre, src, post) {
      if (!src || isExternal(src)) return full;
      const file = await resolveRel(folderId, src);
      if (!file || file.kind !== "file") return full;
      const blob = await fs().getBlob(file.id);
      if (!blob) return full;
      return pre + (await blobDataUrl(blob)) + post;
    });
    return html;
  }

  async function loadTree(folderId) {
    const kids = await fs().list(folderId);
    const out = [];
    for (let i = 0; i < kids.length; i++) {
      const kid = kids[i];
      if (kid.kind === "folder") out.push({ node: kid, children: await loadTree(kid.id) });
      else out.push({ node: kid, children: null });
    }
    return out;
  }

  async function readManifest(folderId) {
    const file = await childNamed(folderId, "manifest.json");
    if (!file) return defaultManifest("App");
    try {
      const parsed = JSON.parse(await fs().readText(file.id) || "{}");
      const base = defaultManifest(parsed.name || "App");
      return Object.assign(base, parsed, {
        icon: Object.assign(base.icon, parsed.icon || {}),
      });
    } catch (_err) {
      return defaultManifest("App");
    }
  }

  async function writeManifest(folderId, manifest) {
    const blob = new Blob([JSON.stringify(manifest, null, 2) + "\n"], { type: "application/json" });
    const existing = await childNamed(folderId, "manifest.json");
    if (existing) await fs().writeFile(existing.id, blob, { mime: "application/json" });
    else await fs().createFile(folderId, { name: "manifest.json", mime: "application/json", blob: blob });
  }

  function isDirty(id) {
    return Object.prototype.hasOwnProperty.call(state.buffers, id) && state.buffers[id] !== state.saved[id];
  }

  function anyDirty() {
    return Object.keys(state.buffers).some(isDirty);
  }

  function getActiveText() {
    if (!state.activeId) return "";
    if (state.editor && !state.usingFallback) return state.editor.getValue();
    if (state.fallback) return state.fallback.value;
    return state.buffers[state.activeId] || "";
  }

  function stashActive() {
    if (!state.activeId) return;
    state.buffers[state.activeId] = getActiveText();
  }

  async function ensureMonaco() {
    if (state.monaco || state.usingFallback) return state.monaco;
    try {
      await loadMonaco();
      state.monaco = window.monaco;
    } catch (_err) {
      state.usingFallback = true;
      state.status = t("studioFallbackEditor");
    }
    return state.monaco;
  }

  function loadMonaco() {
    return new Promise(function (resolve, reject) {
      if (window.monaco) {
        resolve(window.monaco);
        return;
      }
      window.MonacoEnvironment = {
        getWorkerUrl: function () {
          const worker = MONACO_BASE + "/base/worker/workerMain.js";
          const blob = new Blob(
            [
              "self.MonacoEnvironment={baseUrl:" + JSON.stringify(MONACO_BASE + "/") + "};",
              "importScripts(" + JSON.stringify(worker) + ");",
            ],
            { type: "text/javascript" }
          );
          return URL.createObjectURL(blob);
        },
      };
      const script = document.createElement("script");
      script.src = MONACO_BASE + "/loader.js";
      script.onload = function () {
        if (!window.require) {
          reject(new Error("monaco"));
          return;
        }
        window.require.config({ paths: { vs: MONACO_BASE } });
        window.require(["vs/editor/editor.main"], function () {
          resolve(window.monaco);
        }, reject);
      };
      script.onerror = function () { reject(new Error("monaco")); };
      document.head.appendChild(script);
    });
  }

  function monacoTheme() {
    const theme = document.documentElement.dataset.theme === "light" ? "vs" : "vs-dark";
    return theme;
  }

  function mountEditor(container) {
    if (state.usingFallback || !state.monaco) {
      container.innerHTML =
        '<div class="studio-fallback"><div class="studio-gutter" id="studio-gutter">1</div><textarea id="studio-fallback" spellcheck="false"></textarea></div>';
      state.fallback = document.getElementById("studio-fallback");
      state.fallback.addEventListener("input", onFallbackInput);
      return;
    }
    container.innerHTML = '<div class="studio-monaco" id="studio-monaco"></div>';
    state.editor = state.monaco.editor.create(document.getElementById("studio-monaco"), {
      value: "",
      language: "html",
      theme: monacoTheme(),
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      tabSize: 2,
      wordWrap: "on",
    });
    state.editor.onDidChangeModelContent(function () {
      if (!state.activeId) return;
      state.buffers[state.activeId] = state.editor.getValue();
      paintTabs();
      setStatus(isDirty(state.activeId) ? t("studioUnsaved") : t("studioSaved"));
    });
  }

  function onFallbackInput() {
    if (!state.activeId || !state.fallback) return;
    state.buffers[state.activeId] = state.fallback.value;
    const lines = state.fallback.value.split("\n").length;
    const gutter = document.getElementById("studio-gutter");
    if (gutter) {
      const nums = [];
      for (let i = 1; i <= Math.max(1, lines); i++) nums.push(String(i));
      gutter.textContent = nums.join("\n");
    }
    paintTabs();
    setStatus(isDirty(state.activeId) ? t("studioUnsaved") : t("studioSaved"));
  }

  function setEditorText(text, language) {
    if (state.editor && !state.usingFallback) {
      const model = state.editor.getModel();
      if (model && state.monaco) state.monaco.editor.setModelLanguage(model, language || "plaintext");
      state.editor.setValue(text || "");
      return;
    }
    if (state.fallback) {
      state.fallback.value = text || "";
      onFallbackInput();
    }
  }

  function setStatus(text) {
    state.status = text || "";
    const el = document.getElementById("studio-status");
    if (el) el.textContent = state.status;
  }

  async function openFile(node) {
    if (!node || node.kind !== "file") return;
    stashActive();
    if (!Object.prototype.hasOwnProperty.call(state.buffers, node.id)) {
      const text = await fs().readText(node.id);
      state.buffers[node.id] = text;
      state.saved[node.id] = text;
    }
    if (!state.tabs.some(function (tab) { return tab.id === node.id; })) {
      state.tabs.push({ id: node.id, name: node.name });
    }
    state.activeId = node.id;
    await ensureMonaco();
    const pane = document.getElementById("studio-editor");
    if (pane && !state.editor && !state.fallback) mountEditor(pane);
    setEditorText(state.buffers[node.id], langOf(node.name));
    paintTabs();
    paintTree();
    setStatus(isDirty(node.id) ? t("studioUnsaved") : t("studioSaved"));
  }

  async function saveAll() {
    stashActive();
    const ids = Object.keys(state.buffers).filter(isDirty);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const text = state.buffers[id];
      await fs().writeFile(id, new Blob([text], { type: "text/plain" }));
      state.saved[id] = text;
    }
    setStatus(t("studioSaved"));
    paintTabs();
  }

  async function refreshTree() {
    if (!state.project) return;
    state.tree = await loadTree(state.project.folderId);
    paintTree();
  }

  async function openProject(folder, opts) {
    opts = opts || {};
    const osfs = fs();
    await osfs.ready();
    let manifest = await readManifest(folder.id);
    if (!(await childNamed(folder.id, "manifest.json"))) {
      if (!(await childNamed(folder.id, "index.html")) && !opts.create) {
        state.error = t("studioOpenFailed");
        paint();
        return;
      }
      await writeManifest(folder.id, manifest);
    }
    const path = await osfs.pathOf(folder.id);
    state.project = {
      folderId: folder.id,
      path: path,
      manifest: manifest,
    };
    state.view = "ide";
    state.tabs = [];
    state.activeId = null;
    state.buffers = {};
    state.saved = {};
    state.modal = null;
    state.error = "";
    rememberRecent({
      path: path,
      name: manifest.name || folder.name,
      folderId: folder.id,
      at: Date.now(),
    });
    setWindowTitle(manifest.name || folder.name);
    paint();
    await refreshTree();
    const index = await childNamed(folder.id, "index.html");
    if (opts.fileId) {
      const file = await osfs.get(opts.fileId);
      if (file && file.kind === "file") await openFile(file);
      else if (index) await openFile(index);
    } else if (index) {
      await openFile(index);
    }
  }

  async function createProject() {
    const draft = state.newDraft || {};
    const name = String(draft.name || "").trim();
    if (!name) {
      state.error = t("studioNameRequired");
      paint();
      return;
    }
    const osfs = fs();
    await osfs.ready();
    const folderName = slugify(name);
    let parentPath = String(draft.location || "").trim();
    if (!parentPath || parentPath === "/Projects" || /\/$/.test(parentPath)) {
      const base = !parentPath || parentPath === "/Projects" ? "/Projects" : parentPath.replace(/\/+$/, "");
      parentPath = (base === "/" ? "" : base) + "/" + folderName;
    }
    const parts = parentPath.replace(/\\/g, "/").split("/").filter(Boolean);
    const wantName = parts.length ? parts.pop() : folderName;
    let parent = await osfs.get(osfs.ROOT_ID);
    for (let i = 0; i < parts.length; i++) {
      const kids = await osfs.list(parent.id);
      let next = kids.find(function (n) {
        return n.kind === "folder" && String(n.name).toLowerCase() === parts[i].toLowerCase();
      });
      if (!next && parts[i].toLowerCase() === "projects" && osfs.PROJECTS_ID) {
        next = await osfs.get(osfs.PROJECTS_ID);
      }
      if (!next) next = await osfs.createFolder(parent.id, parts[i]);
      parent = next;
    }
    const existing = await childNamed(parent.id, wantName);
    if (existing) {
      state.error = t("studioExists");
      paint();
      return;
    }
    const folder = await osfs.createFolder(parent.id, wantName);
    const manifest = defaultManifest(name);
    await osfs.createFile(folder.id, {
      name: "index.html",
      mime: "text/html",
      blob: new Blob([templateHtml(name)], { type: "text/html" }),
    });
    await osfs.createFile(folder.id, {
      name: "style.css",
      mime: "text/css",
      blob: new Blob([templateCss()], { type: "text/css" }),
    });
    await osfs.createFile(folder.id, {
      name: "main.js",
      mime: "text/javascript",
      blob: new Blob([templateJs(name)], { type: "text/javascript" }),
    });
    await writeManifest(folder.id, manifest);
    await openProject(folder, { create: true });
  }

  async function projectRootFor(node) {
    const osfs = fs();
    let cur = node;
    if (cur.kind === "file") cur = await osfs.get(cur.parentId);
    while (cur) {
      const kids = await osfs.list(cur.id);
      if (kids.some(function (k) { return k.kind === "file" && k.name === "manifest.json"; })) return cur;
      if (!cur.parentId || cur.id === osfs.ROOT_ID) break;
      cur = await osfs.get(cur.parentId);
    }
    return node.kind === "folder" ? node : await osfs.get(node.parentId);
  }

  async function handleOpenFileId(fileId) {
    const osfs = fs();
    await osfs.ready();
    const node = await osfs.get(fileId);
    if (!node) return;
    const folder = await projectRootFor(node);
    if (!folder) return;
    await openProject(folder, { fileId: node.kind === "file" ? node.id : null, create: true });
  }

  async function testApp() {
    try {
      await saveAll();
      const html = await assembleProject(state.project.folderId);
      const h = host();
      if (!h || !h.OSWindows || !h.OSWindows.openHtmlPreview) throw new Error("preview");
      h.OSWindows.openHtmlPreview({
        title: (state.project.manifest.name || "App") + " (" + t("studioTest") + ")",
        html: html,
        icon: iconUrl(state.project.manifest),
      });
      setStatus(t("studioTest"));
    } catch (err) {
      setStatus(err && err.message === "missing-index" ? t("studioMissingIndex") : t("studioTestFailed"));
    }
  }

  async function buildApp() {
    try {
      await saveAll();
      const html = await assembleProject(state.project.folderId);
      const h = host();
      const manifest = state.project.manifest;
      const now = Date.now();
      const id =
        (manifest.appId && String(manifest.appId).indexOf("user-") === 0 && manifest.appId) ||
        "user-" + (crypto.randomUUID ? crypto.randomUUID() : String(now) + "-" + Math.random().toString(36).slice(2, 8));
      const existing = h.OSState && h.OSState.getUserApp ? await h.OSState.getUserApp(id) : null;
      const record = {
        id: id,
        mode: "html",
        name: manifest.name || "App",
        desc: manifest.description || "",
        url: "",
        html: html,
        iconBlob: null,
        iconType: "gallery",
        galleryId: (manifest.icon && manifest.icon.galleryId) || "code",
        galleryColor: (manifest.icon && manifest.icon.galleryColor) || "teal",
        projectPath: state.project.path,
        createdAt: existing && existing.createdAt ? existing.createdAt : manifest.createdAt || now,
        updatedAt: now,
      };
      await h.OSState.putUserApp(record);
      if (h.OSAppBuilder && h.OSAppBuilder.hydrate) await h.OSAppBuilder.hydrate();
      if (h.OS && h.OS.registerUserApp) h.OS.registerUserApp(id, { desktop: false });
      if (h.OSWindows && h.OSWindows.refreshUserApp) h.OSWindows.refreshUserApp(id);
      if (!manifest.appId) {
        manifest.appId = id;
        state.project.manifest = manifest;
        await writeManifest(state.project.folderId, manifest);
      }
      setStatus(t("studioBuilt", { name: record.name }));
      state.installResult = { id: id, name: record.name, linked: false };
      state.modal = "installed";
      paint();
    } catch (err) {
      setStatus(err && err.message === "missing-index" ? t("studioMissingIndex") : t("studioBuildFailed"));
    }
  }

  function isOnDesktop(id) {
    const h = host();
    const list = h && h.OS && h.OS.state && h.OS.state.desktopIcons;
    return !!(id && Array.isArray(list) && list.includes(id));
  }

  function linkInstalledToDesktop() {
    const info = state.installResult;
    const h = host();
    if (!info || !info.id || !h || !h.OS) return;
    if (!isOnDesktop(info.id) && typeof h.OS.toggleDesktopIcon === "function") {
      h.OS.toggleDesktopIcon(info.id);
    }
    state.installResult = Object.assign({}, info, { linked: true });
    setStatus(t("studioLinkedDesktop"));
    paint();
  }

  async function createNode(kind) {
    const name = window.prompt(kind === "folder" ? t("studioFolderName") : t("studioFileName"));
    if (!name) return;
    const parentId = state.project.folderId;
    if (kind === "folder") await fs().createFolder(parentId, name.trim());
    else {
      const label = name.trim();
      const mime = langOf(label) === "html" ? "text/html" : langOf(label) === "css" ? "text/css" : langOf(label) === "javascript" ? "text/javascript" : "text/plain";
      const node = await fs().createFile(parentId, {
        name: label,
        mime: mime,
        blob: new Blob([""], { type: mime }),
      });
      await refreshTree();
      await openFile(node);
      return;
    }
    await refreshTree();
  }

  async function saveSettings() {
    const draft = state.settingsDraft || {};
    const name = String(draft.name || "").trim();
    if (!name) {
      state.error = t("studioNameRequired");
      paint();
      return;
    }
    const manifest = Object.assign({}, state.project.manifest, {
      name: name,
      description: String(draft.desc || ""),
      icon: {
        galleryId: draft.galleryId || "code",
        galleryColor: draft.galleryColor || "teal",
      },
    });
    await writeManifest(state.project.folderId, manifest);
    state.project.manifest = manifest;
    rememberRecent({
      path: state.project.path,
      name: manifest.name,
      folderId: state.project.folderId,
      at: Date.now(),
    });
    setWindowTitle(manifest.name);
    state.modal = null;
    paint();
    await refreshTree();
  }

  function gearSvg() {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 1.8h3l.4 1.6 1.5.8 1.6-.5 1.5 2.6-1.2 1.2v1.8l1.2 1.2-1.5 2.6-1.6-.5-1.5.8-.4 1.6h-3l-.4-1.6-1.5-.8-1.6.5L2.2 10l1.2-1.2V7l-1.2-1.2 1.5-2.6 1.6.5 1.5-.8z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  }

  function plusSvg() {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  }

  function folderPlusSvg() {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.2V13h12V6.2H8L6.4 4.6H2z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9.2 8.4v4M7.2 10.4h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  }

  function backSvg() {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3 2.5 8 7 13M3 8h10.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function treeHtml(items, depth) {
    return items
      .map(function (item) {
        const node = item.node;
        const active = node.id === state.activeId ? " active" : "";
        const dirty = isDirty(node.id) ? '<span class="mark">•</span>' : "";
        const kids = item.children ? treeHtml(item.children, depth + 1) : "";
        return (
          '<button type="button" class="studio-tree-item' +
          active +
          '" data-id="' +
          escapeHtml(node.id) +
          '" style="padding-left:' +
          (10 + depth * 12) +
          'px">' +
          escapeHtml(node.name) +
          dirty +
          "</button>" +
          kids
        );
      })
      .join("");
  }

  function paintTree() {
    const el = document.getElementById("studio-tree");
    if (el) el.innerHTML = treeHtml(state.tree, 0) || "";
  }

  function paintTabs() {
    const el = document.getElementById("studio-tabs");
    if (!el) return;
    el.innerHTML = state.tabs
      .map(function (tab) {
        const active = tab.id === state.activeId ? " active" : "";
        const dirty = isDirty(tab.id) ? '<span class="dirty">•</span>' : "";
        return (
          '<button type="button" class="studio-tab' +
          active +
          '" data-tab="' +
          escapeHtml(tab.id) +
          '">' +
          escapeHtml(tab.name) +
          dirty +
          "</button>"
        );
      })
      .join("");
  }

  function startHtml() {
    const rows = state.recents
      .map(function (row) {
        return (
          '<button type="button" class="studio-recent" data-open-path="' +
          escapeHtml(row.path) +
          '"><img src="' +
          escapeHtml(iconUrl({ icon: { galleryId: "code", galleryColor: "teal" } })) +
          '" alt=""><span><strong>' +
          escapeHtml(row.name || row.path) +
          "</strong><span>" +
          escapeHtml(row.path) +
          "</span></span></button>"
        );
      })
      .join("");
    return (
      '<div class="studio-start">' +
      "<h1>" + escapeHtml(t("appStudio")) + "</h1>" +
      '<p class="studio-lead"></p>' +
      '<div class="studio-start-actions">' +
      '<button type="button" class="studio-btn primary" data-act="new" data-i18n="studioNewProject">' + escapeHtml(t("studioNewProject")) + "</button>" +
      '<button type="button" class="studio-btn" data-act="open" data-i18n="studioOpenProject">' + escapeHtml(t("studioOpenProject")) + "</button>" +
      "</div>" +
      "<h2 data-i18n=\"studioRecent\">" + escapeHtml(t("studioRecent")) + "</h2>" +
      '<div class="studio-recents">' +
      (rows || '<p class="studio-muted">' + escapeHtml(t("studioNoRecent")) + "</p>") +
      "</div></div>"
    );
  }

  function settingsModal() {
    const h = host();
    const icons = h && h.OSBuilderIcons;
    const draft = state.settingsDraft || {};
    const color = draft.galleryColor || "teal";
    const chips = ["teal", "blue", "orange"]
      .map(function (id) {
        return (
          '<button type="button" class="studio-color' +
          (color === id ? " selected" : "") +
          '" data-icon-color="' +
          id +
          '"><span class="studio-swatch" data-color="' +
          id +
          '"></span>' +
          escapeHtml(id) +
          "</button>"
        );
      })
      .join("");
    const tiles = ((icons && icons.IDS) || [])
      .map(function (id) {
        return (
          '<button type="button" class="studio-icon-tile' +
          (draft.galleryId === id ? " selected" : "") +
          '" data-icon-id="' +
          id +
          '"><img src="' +
          escapeHtml(icons.dataUrl(id, color)) +
          '" alt=""></button>'
        );
      })
      .join("");
    return (
      '<div class="studio-overlay" data-dismiss="1"><div class="studio-modal" role="dialog">' +
      "<h2>" + escapeHtml(t("studioSettings")) + "</h2>" +
      (state.error ? '<p class="studio-error">' + escapeHtml(state.error) + "</p>" : "") +
      '<label class="studio-field">' + escapeHtml(t("studioProjectName")) +
      '<input id="studio-set-name" value="' + escapeHtml(draft.name || "") + '"></label>' +
      '<label class="studio-field">' + escapeHtml(t("studioDescription")) +
      '<textarea id="studio-set-desc">' + escapeHtml(draft.desc || "") + "</textarea></label>" +
      "<div class=\"studio-field\">" + escapeHtml(t("studioIcon")) +
      '<div class="studio-icon-row">' + chips + "</div>" +
      '<div class="studio-icon-grid">' + tiles + "</div></div>" +
      '<div class="studio-modal-actions">' +
      '<button type="button" class="studio-btn" data-act="close-modal">' + escapeHtml(t("feCancel")) + "</button>" +
      '<button type="button" class="studio-btn primary" data-act="save-settings">' + escapeHtml(t("studioSave")) + "</button>" +
      "</div></div></div>"
    );
  }

  function installedModal() {
    const info = state.installResult || {};
    const linked = !!info.linked;
    return (
      '<div class="studio-overlay" data-dismiss="1"><div class="studio-modal" role="dialog">' +
      "<h2 data-i18n=\"studioInstalledTitle\">" + escapeHtml(t("studioInstalledTitle")) + "</h2>" +
      "<p>" + escapeHtml(t("studioBuilt", { name: info.name || "App" })) + "</p>" +
      (linked ? '<p class="studio-ok" data-i18n="studioLinkedDesktop">' + escapeHtml(t("studioLinkedDesktop")) + "</p>" : "") +
      '<div class="studio-modal-actions">' +
      (linked
        ? ""
        : '<button type="button" class="studio-btn primary" data-act="link-desktop" data-i18n="studioLinkDesktop">' +
          escapeHtml(t("studioLinkDesktop")) +
          "</button>") +
      '<button type="button" class="studio-btn" data-act="close-modal" data-i18n="close">' +
      escapeHtml(t("close")) +
      "</button>" +
      "</div></div></div>"
    );
  }

  function newModal() {
    const draft = state.newDraft || { name: "", location: "/Projects/" };
    return (
      '<div class="studio-overlay" data-dismiss="1"><div class="studio-modal" role="dialog">' +
      "<h2>" + escapeHtml(t("studioNewProject")) + "</h2>" +
      (state.error ? '<p class="studio-error">' + escapeHtml(state.error) + "</p>" : "") +
      '<label class="studio-field">' + escapeHtml(t("studioProjectName")) +
      '<input id="studio-new-name" value="' + escapeHtml(draft.name || "") + '"></label>' +
      '<label class="studio-field">' + escapeHtml(t("studioLocation")) +
      '<div class="studio-loc"><input id="studio-new-loc" value="' +
      escapeHtml(draft.location || "") +
      '"><button type="button" class="studio-btn" data-act="browse">' +
      escapeHtml(t("studioBrowse")) +
      "</button></div></label>" +
      '<div class="studio-modal-actions">' +
      '<button type="button" class="studio-btn" data-act="close-modal">' + escapeHtml(t("feCancel")) + "</button>" +
      '<button type="button" class="studio-btn primary" data-act="create">' + escapeHtml(t("studioCreate")) + "</button>" +
      "</div></div></div>"
    );
  }

  function ideHtml() {
    const name = (state.project && state.project.manifest && state.project.manifest.name) || "";
    const icon = iconUrl(state.project && state.project.manifest);
    return (
      '<div class="studio-ide">' +
      '<aside class="studio-sidebar">' +
      '<div class="studio-side-top">' +
      '<button type="button" class="studio-icon-btn" data-act="back" data-i18n-title="studioCloseProject" title="' +
      escapeHtml(t("studioCloseProject")) +
      '">' + backSvg() + "</button>" +
      (icon ? '<img src="' + escapeHtml(icon) + '" alt="">' : "") +
      '<span class="studio-side-name">' + escapeHtml(name) + "</span>" +
      '<button type="button" class="studio-icon-btn" data-act="settings" data-i18n-title="studioSettings" title="' +
      escapeHtml(t("studioSettings")) +
      '">' + gearSvg() + "</button>" +
      "</div>" +
      '<div class="studio-tree-tools">' +
      '<button type="button" class="studio-icon-btn" data-act="new-file" data-i18n-title="studioNewFile" title="' +
      escapeHtml(t("studioNewFile")) +
      '">' + plusSvg() + "</button>" +
      '<button type="button" class="studio-icon-btn" data-act="new-folder" data-i18n-title="studioNewFolder" title="' +
      escapeHtml(t("studioNewFolder")) +
      '">' + folderPlusSvg() + "</button>" +
      "</div>" +
      '<div class="studio-tree" id="studio-tree"></div>' +
      "</aside>" +
      '<section class="studio-main">' +
      '<div class="studio-toolbar">' +
      '<button type="button" class="studio-btn" data-act="save" data-i18n="studioSave">' + escapeHtml(t("studioSave")) + "</button>" +
      '<button type="button" class="studio-btn" data-act="test" data-i18n="studioTest">' + escapeHtml(t("studioTest")) + "</button>" +
      '<button type="button" class="studio-btn primary" data-act="build" data-i18n="studioBuild">' + escapeHtml(t("studioBuild")) + "</button>" +
      "</div>" +
      '<div class="studio-tabs" id="studio-tabs"></div>' +
      '<div class="studio-editor" id="studio-editor"></div>' +
      '<div class="studio-status" id="studio-status">' + escapeHtml(state.status) + "</div>" +
      "</section></div>" +
      (state.modal === "settings" ? settingsModal() : "") +
      (state.modal === "new" ? newModal() : "") +
      (state.modal === "installed" ? installedModal() : "")
    );
  }

  function bindOnce() {
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    root.addEventListener("click", async function (e) {
      const actBtn = e.target.closest("[data-act]");
      if (actBtn && root.contains(actBtn)) {
        e.preventDefault();
        await onAct({ currentTarget: actBtn });
        return;
      }
      const recent = e.target.closest("[data-open-path]");
      if (recent && root.contains(recent)) {
        const path = recent.getAttribute("data-open-path");
        const node = await fs().nodeAtPath(path);
        if (node && node.kind === "folder") await openProject(node, { create: true });
        else {
          state.error = t("studioOpenFailed");
          paint();
        }
        return;
      }
      const tab = e.target.closest("[data-tab]");
      if (tab && root.contains(tab)) {
        const node = await fs().get(tab.getAttribute("data-tab"));
        if (node) await openFile(node);
        return;
      }
      const fileBtn = e.target.closest("[data-id]");
      if (fileBtn && root.contains(fileBtn)) {
        const node = await fs().get(fileBtn.getAttribute("data-id"));
        if (node && node.kind === "file") await openFile(node);
        return;
      }
      const iconColor = e.target.closest("[data-icon-color]");
      if (iconColor && root.contains(iconColor)) {
        readSettingsDraft();
        state.settingsDraft.galleryColor = iconColor.getAttribute("data-icon-color");
        paint();
        return;
      }
      const iconId = e.target.closest("[data-icon-id]");
      if (iconId && root.contains(iconId)) {
        readSettingsDraft();
        state.settingsDraft.galleryId = iconId.getAttribute("data-icon-id");
        paint();
        return;
      }
      if (e.target.classList && e.target.classList.contains("studio-overlay")) {
        state.modal = null;
        state.error = "";
        paint();
      }
    });
    root.addEventListener("input", function (e) {
      if (e.target && e.target.id === "studio-new-name") {
        const locInput = document.getElementById("studio-new-loc");
        const next = slugify(e.target.value);
        const loc = locInput ? locInput.value : "";
        const auto = /^\/Projects\/[^/]*$/.test(loc) || loc === "/Projects/" || !loc;
        if (auto && locInput) locInput.value = "/Projects/" + next;
      }
    });
  }

  function paint() {
    const keepEditor = state.view === "ide" && (state.editor || state.fallback);
    const editorParent = document.getElementById("studio-editor");
    const editorEl = keepEditor && editorParent ? editorParent.firstElementChild : null;
    if (state.view === "start") root.innerHTML = startHtml() + (state.modal === "new" ? newModal() : "");
    else root.innerHTML = ideHtml();
    if (editorEl && document.getElementById("studio-editor")) {
      document.getElementById("studio-editor").appendChild(editorEl);
      if (state.editor && state.editor.layout) state.editor.layout();
    } else if (state.view === "ide" && !state.editor && !state.fallback) {
      const pane = document.getElementById("studio-editor");
      if (pane && (state.monaco || state.usingFallback)) mountEditor(pane);
    }
    paintTree();
    paintTabs();
    bindOnce();
    if (window.OSAppFrame) window.OSAppFrame.applyI18n();
    const focusId = state.modal === "new" ? "studio-new-name" : state.modal === "settings" ? "studio-set-name" : "";
    if (focusId) {
      const input = document.getElementById(focusId);
      if (input) input.focus();
    }
  }

  function readSettingsDraft() {
    const name = document.getElementById("studio-set-name");
    const desc = document.getElementById("studio-set-desc");
    state.settingsDraft = Object.assign({}, state.settingsDraft, {
      name: name ? name.value : "",
      desc: desc ? desc.value : "",
    });
  }

  function readNewDraft() {
    const name = document.getElementById("studio-new-name");
    const loc = document.getElementById("studio-new-loc");
    state.newDraft = {
      name: name ? name.value : "",
      location: loc ? loc.value : "",
    };
  }

  async function onAct(e) {
    const act = e.currentTarget.getAttribute("data-act");
    if (act === "new") {
      state.modal = "new";
      state.error = "";
      state.newDraft = { name: "", location: "/Projects/" };
      paint();
      const input = document.getElementById("studio-new-name");
      if (input) input.focus();
      return;
    }
    if (act === "open") {
      const h = host();
      if (!h.OSFilePicker || !h.OSFilePicker.pickFolder) return;
      const picked = await h.OSFilePicker.pickFolder({ title: t("studioOpenProject") });
      if (!picked || !picked.folder) return;
      await openProject(picked.folder, { create: true });
      return;
    }
    if (act === "close-modal") {
      state.modal = null;
      state.error = "";
      paint();
      return;
    }
    if (act === "browse") {
      readNewDraft();
      const h = host();
      const picked = await h.OSFilePicker.pickFolder({
        title: t("studioPickFolder"),
        parentId: fs().PROJECTS_ID,
      });
      if (picked && picked.path) {
        const name = slugify(state.newDraft.name || "App");
        const base = picked.path === "/" ? "" : picked.path;
        state.newDraft.location = base + "/" + name;
      }
      paint();
      return;
    }
    if (act === "create") {
      readNewDraft();
      await createProject();
      return;
    }
    if (act === "settings") {
      const man = state.project.manifest;
      state.settingsDraft = {
        name: man.name,
        desc: man.description || "",
        galleryId: (man.icon && man.icon.galleryId) || "code",
        galleryColor: (man.icon && man.icon.galleryColor) || "teal",
      };
      state.modal = "settings";
      state.error = "";
      paint();
      return;
    }
    if (act === "save-settings") {
      readSettingsDraft();
      await saveSettings();
      return;
    }
    if (act === "back") {
      await saveAll();
      if (state.editor) {
        state.editor.dispose();
        state.editor = null;
      }
      state.fallback = null;
      state.project = null;
      state.view = "start";
      state.modal = null;
      setWindowTitle("");
      paint();
      return;
    }
    if (act === "save") {
      await saveAll();
      return;
    }
    if (act === "test") {
      await testApp();
      return;
    }
    if (act === "build") {
      await buildApp();
      return;
    }
    if (act === "link-desktop") {
      linkInstalledToDesktop();
      return;
    }
    if (act === "new-file") {
      await createNode("file");
      return;
    }
    if (act === "new-folder") {
      await createNode("folder");
    }
  }

  async function boot() {
    if (window.OSAppFrame) window.OSAppFrame.sync();
    state.recents = getRecents();
    paint();
    await ensureMonaco();
    const win = currentWin();
    if (win && win.fileId) await handleOpenFileId(win.fileId);
    window.addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === "os-host-sync") {
        if (window.OSAppFrame) window.OSAppFrame.sync();
        if (state.monaco && state.editor) state.monaco.editor.setTheme(monacoTheme());
        if (state.view === "start") paint();
        else if (window.OSAppFrame) window.OSAppFrame.applyI18n();
      }
      if (e.data.type === "os-file-open" && e.data.fileId) handleOpenFileId(e.data.fileId);
      if (e.data.type === "os-fs-change" && state.project) refreshTree();
    });
    window.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (state.project) saveAll();
      }
    });
  }

  boot();
})();
