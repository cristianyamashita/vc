window.OSWindows = (function () {
  const TASKBAR_H = 48;
  const MIN_W = 360;
  const MIN_H = 240;
  const DEFAULT_W = 960;
  const DEFAULT_H = 640;
  const HASH_DEBOUNCE_MS = 120;

  const windows = new Map();
  let zCounter = 10;
  let cascade = 0;
  let hashTimer = null;
  let writingHash = false;
  let closedThisSession = new Set();
  let layer;
  const htmlBlobs = new WeakMap();

  function t(key) {
    return window.OSI18n.t(key);
  }

  function lang() {
    return window.OS.lang;
  }

  function workArea() {
    return {
      x: 0,
      y: 0,
      w: Math.max(MIN_W, window.innerWidth),
      h: Math.max(MIN_H, window.innerHeight - TASKBAR_H),
    };
  }

  function appIdOf(id) {
    if (!id) return id;
    const text = String(id);
    const i = text.indexOf("::");
    return i > 0 ? text.slice(0, i) : text;
  }

  function appOf(id) {
    const appId = appIdOf(id);
    const fromCatalog = window.OSCatalog.byId(appId);
    if (fromCatalog) return fromCatalog;
    const win = windows.get(id) || windows.get(appId);
    return (win && win.previewApp) || null;
  }

  function isMulti(app) {
    return !!(app && app.multiInstance);
  }

  function newInstanceId(appId) {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    return appId + "::" + uuid;
  }

  function latestOf(appId) {
    return Array.from(windows.values())
      .filter((win) => (win.appId || appIdOf(win.id)) === appId)
      .sort((a, b) => (b.z || 0) - (a.z || 0))[0] || null;
  }

  function clampRect(x, y, w, h) {
    const area = workArea();
    w = Math.min(Math.max(MIN_W, w), area.w);
    h = Math.min(Math.max(MIN_H, h), area.h);
    x = Math.min(Math.max(0, x), Math.max(0, area.w - w));
    y = Math.min(Math.max(0, y), Math.max(0, area.h - h));
    return { x, y, w, h };
  }

  function nextCascade(app) {
    const area = workArea();
    const step = 28;
    const n = cascade % 8;
    cascade += 1;
    const dw = Math.min(Number(app && app.windowW) || DEFAULT_W, area.w - 48);
    const dh = Math.min(Number(app && app.windowH) || DEFAULT_H, area.h - 36);
    return clampRect(48 + n * step, 36 + n * step, dw, dh);
  }

  function parseHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return null;
    const parts = raw.split("/");
    if (parts.length < 5) return null;
    const y = Number(parts[0]);
    const x = Number(parts[1]);
    const h = Number(parts[2]);
    const w = Number(parts[3]);
    const id = parts.slice(4).join("/");
    if (![y, x, h, w].every(Number.isFinite) || !id) return null;
    return { y, x, h, w, id };
  }

  function geometryForHash(win) {
    if (win.maximized) {
      const area = workArea();
      return { y: 0, x: 0, h: area.h, w: area.w };
    }
    return { y: win.y, x: win.x, h: win.h, w: win.w };
  }

  function hashString(win) {
    if (!win) return "";
    const g = geometryForHash(win);
    return `#${Math.round(g.y)}/${Math.round(g.x)}/${Math.round(g.h)}/${Math.round(g.w)}/${win.id}`;
  }

  function writeHashNow() {
    const focused = getFocused();
    const next = focused && !focused.minimized && !focused.ephemeral ? hashString(focused) : "";
    const current = location.hash || "";
    if (current === next) return;
    writingHash = true;
    const url = location.pathname + location.search + next;
    history.replaceState(null, "", url);
    queueMicrotask(() => {
      writingHash = false;
    });
  }

  function scheduleHash() {
    if (hashTimer) clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      hashTimer = null;
      writeHashNow();
    }, HASH_DEBOUNCE_MS);
  }

  function getFocused() {
    const all = Array.from(windows.values());
    const visible = all.filter((win) => !win.minimized);
    const pool = visible.length ? visible : all;
    let best = null;
    pool.forEach((win) => {
      if (!best || win.z > best.z) best = win;
    });
    return best;
  }

  function rememberPlacement(win) {
    if (!win || !win.id) return;
    if (!window.OS || !window.OS.state) return;
    if (!window.OS.state.placements || typeof window.OS.state.placements !== "object") {
      window.OS.state.placements = {};
    }
    window.OS.state.placements[win.id] = {
      x: win.x,
      y: win.y,
      w: win.w,
      h: win.h,
      maximized: !!win.maximized,
    };
  }

  function savedPlacement(id) {
    const fromState = window.OS && window.OS.state && window.OS.state.placements && window.OS.state.placements[id];
    if (!fromState) return null;
    return fromState;
  }

  function applyRect(win) {
    const el = win.el;
    if (win.maximized) {
      const area = workArea();
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.width = area.w + "px";
      el.style.height = area.h + "px";
    } else {
      el.style.left = win.x + "px";
      el.style.top = win.y + "px";
      el.style.width = win.w + "px";
      el.style.height = win.h + "px";
    }
    el.classList.toggle("maximized", win.maximized);
    el.classList.toggle("minimized", win.minimized);
    const maxBtn = el.querySelector(".win-max");
    if (maxBtn) {
      maxBtn.setAttribute("title", win.maximized ? t("restore") : t("maximize"));
      maxBtn.setAttribute("aria-label", win.maximized ? t("restore") : t("maximize"));
      maxBtn.innerHTML = win.maximized ? restoreIcon() : maxIcon();
    }
    rememberPlacement(win);
  }

  function svgBtn(path) {
    return `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">${path}</svg>`;
  }

  function minIcon() {
    return svgBtn('<path d="M1 5h8" fill="none" stroke="currentColor" stroke-width="1.2"/>');
  }
  function maxIcon() {
    return svgBtn('<rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/>');
  }
  function restoreIcon() {
    return svgBtn(
      '<path d="M3 3h5v5H3zM2 5V2h5" fill="none" stroke="currentColor" stroke-width="1.2"/>'
    );
  }
  function closeIcon() {
    return svgBtn('<path d="M2 2l6 6M8 2l-6 6" fill="none" stroke="currentColor" stroke-width="1.2"/>');
  }
  function externalIcon() {
    return svgBtn(
      '<path d="M4 2h4v4M8 2L4 6M2 4v4h4" fill="none" stroke="currentColor" stroke-width="1.2"/>'
    );
  }

  function setFocused(id) {
    windows.forEach((win) => {
      const is = win.id === id && !win.minimized;
      win.el.classList.toggle("focused", is);
      if (is) {
        win.z = ++zCounter;
        win.el.style.zIndex = String(win.z);
      }
    });
    if (window.OS && window.OS.renderTaskbar) window.OS.renderTaskbar();
    writeHashNow();
    persist();
    if (window.OSAnalytics) {
      const focused = windows.get(id);
      window.OSAnalytics.trackWin(focused && !focused.minimized ? focused : null);
    }
  }

  function persist() {
    if (window.OS && window.OS.persistSession) window.OS.persistSession();
  }

  function serialize() {
    return Array.from(windows.values())
      .filter((win) => !win.ephemeral)
      .map((win) => ({
      id: win.id,
      appId: win.appId || appIdOf(win.id),
      path: win.path || null,
      fileId: win.fileId || null,
      x: win.x,
      y: win.y,
      w: win.w,
      h: win.h,
      minimized: !!win.minimized,
      maximized: !!win.maximized,
      z: win.z,
    }));
  }

  function focusedId() {
    const win = getFocused();
    return win ? win.id : null;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function revokeHtmlBlob(el) {
    const url = htmlBlobs.get(el);
    if (!url) return;
    URL.revokeObjectURL(url);
    htmlBlobs.delete(el);
  }

  function applyUserFrame(iframe, app, el) {
    revokeHtmlBlob(el);
    if (app.mode === "html") {
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-modals");
      const blob = new Blob([app.html || "<!doctype html><title></title>"], {
        type: "text/html;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      htmlBlobs.set(el, url);
      iframe.src = url;
    } else {
      iframe.removeAttribute("sandbox");
      iframe.src = window.OSCatalog.resolveHref(app) || app.url || "";
    }
  }

  function createChrome(app) {
    const el = document.createElement("section");
    el.className = "os-window";
    el.dataset.appId = app.id;
    const name = window.OSCatalog.displayName(app, lang());
    const canExternal = app.kind === "site" && app.href;
    el.innerHTML = `
      <div class="titlebar">
        <img class="titlebar-icon" src="${escapeAttr(app.icon || "")}" alt="">
        <div class="titlebar-title"></div>
        <div class="titlebar-controls">
          ${
            canExternal
              ? `<button type="button" class="win-external" data-i18n-title="openExternal" title="${t("openExternal")}">${externalIcon()}</button>`
              : ""
          }
          <button type="button" class="win-min" title="${t("minimize")}">${minIcon()}</button>
          <button type="button" class="win-max" title="${t("maximize")}">${maxIcon()}</button>
          <button type="button" class="win-close" title="${t("close")}">${closeIcon()}</button>
        </div>
      </div>
      <div class="os-window-body"></div>
      <div class="resize-handle n" data-dir="n"></div>
      <div class="resize-handle s" data-dir="s"></div>
      <div class="resize-handle e" data-dir="e"></div>
      <div class="resize-handle w" data-dir="w"></div>
      <div class="resize-handle ne" data-dir="ne"></div>
      <div class="resize-handle nw" data-dir="nw"></div>
      <div class="resize-handle se" data-dir="se"></div>
      <div class="resize-handle sw" data-dir="sw"></div>
    `;
    el.querySelector(".titlebar-title").textContent = name;
    const body = el.querySelector(".os-window-body");
    if (app.kind === "native" && app.href) {
      const iframe = document.createElement("iframe");
      iframe.className = "native-frame";
      iframe.src = window.OSCatalog.resolveHref(app);
      iframe.title = name;
      iframe.setAttribute(
        "allow",
        "camera; microphone; fullscreen; clipboard-read; clipboard-write; autoplay"
      );
      body.appendChild(iframe);
      bindFrameKeys(iframe);
    } else if (app.kind === "native") {
      const root = document.createElement("div");
      root.className = "native-root";
      body.appendChild(root);
    } else if (app.kind === "user") {
      const iframe = document.createElement("iframe");
      iframe.title = name;
      iframe.setAttribute(
        "allow",
        "camera; microphone; fullscreen; clipboard-read; clipboard-write; autoplay"
      );
      applyUserFrame(iframe, app, el);
      body.appendChild(iframe);
      bindFrameKeys(iframe);
    } else {
      const iframe = document.createElement("iframe");
      iframe.src = window.OSCatalog.resolveHref(app);
      iframe.title = name;
      iframe.setAttribute(
        "allow",
        "camera; microphone; fullscreen; clipboard-read; clipboard-write; autoplay"
      );
      body.appendChild(iframe);
      bindFrameKeys(iframe);
      if (window.OSEmbed) window.OSEmbed.attach(iframe);
    }
    return el;
  }

  function bindFrameKeys(iframe) {
    if (!iframe || iframe.dataset.osKeys === "1") return;
    iframe.dataset.osKeys = "1";
    const attach = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc || doc.documentElement.dataset.osKeys === "1") return;
        doc.documentElement.dataset.osKeys = "1";
        doc.addEventListener(
          "keydown",
          (e) => {
            if (window.OSHotkeys && window.OSHotkeys.handleFromFrame(e)) {
              e.preventDefault();
              e.stopPropagation();
            }
          },
          true
        );
        doc.addEventListener("keyup", (e) => {
          if (e.key === "Alt" || e.key === "Control" || e.key === "Meta") {
            if (window.OSHotkeys) window.OSHotkeys.closeSwitcher(true);
          }
        });
        if (window.OSClipboard) window.OSClipboard.hookDocument(doc);
        if (window.OS && typeof window.OS.applyIframeGlass === "function") window.OS.applyIframeGlass(iframe);
      } catch (_err) {}
    };
    iframe.addEventListener("load", attach);
    attach();
  }

  function bindWindow(win) {
    const { el } = win;
    el.addEventListener("mousedown", () => {
      if (win.minimized) return;
      setFocused(win.id);
    });
    el.querySelector(".win-min").addEventListener("click", (e) => {
      e.stopPropagation();
      minimize(win.id);
    });
    el.querySelector(".win-max").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMaximize(win.id);
    });
    el.querySelector(".win-close").addEventListener("click", (e) => {
      e.stopPropagation();
      close(win.id);
    });
    const ext = el.querySelector(".win-external");
    if (ext) {
      ext.addEventListener("click", (e) => {
        e.stopPropagation();
        const href = window.OSCatalog.resolveHref(appOf(win.appId || win.id));
        if (href) window.open(href, "_blank", "noopener");
      });
    }
    el.querySelector(".titlebar").addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      toggleMaximize(win.id);
    });
    startDrag(win);
    startResize(win);
  }

  function startDrag(win) {
    const bar = win.el.querySelector(".titlebar");
    bar.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      e.preventDefault();
      if (win.maximized || win.snapped) {
        const area = workArea();
        const prev = win.restoreRect || { w: win.w, h: win.h };
        win.maximized = false;
        win.snapped = null;
        win.w = prev.w;
        win.h = prev.h;
        win.x = Math.min(Math.max(0, e.clientX - Math.round(win.w / 2)), Math.max(0, area.w - win.w));
        win.y = Math.min(Math.max(0, e.clientY - 16), Math.max(0, area.h - win.h));
        applyRect(win);
      }
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = win.x;
      const origY = win.y;
      document.body.classList.add("os-dragging");
      const move = (ev) => {
        const next = clampRect(origX + (ev.clientX - startX), origY + (ev.clientY - startY), win.w, win.h);
        win.x = next.x;
        win.y = next.y;
        applyRect(win);
        scheduleHash();
        const edge = snapEdgeAt(ev.clientX, ev.clientY);
        if (window.OSHotkeys) window.OSHotkeys.snapZone(edge);
      };
      const up = (ev) => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.body.classList.remove("os-dragging");
        if (window.OSHotkeys) window.OSHotkeys.snapZone(null);
        const edge = snapEdgeAt(ev.clientX, ev.clientY);
        if (edge) snap(win.id, edge);
        persist();
        writeHashNow();
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function snapEdgeAt(x, y) {
    const area = workArea();
    const edge = 16;
    if (y <= edge) return "up";
    if (x <= edge) return "left";
    if (x >= area.w - edge) return "right";
    return null;
  }

  function rememberRestore(win) {
    if (!win || win.maximized || win.snapped) return;
    win.restoreRect = { x: win.x, y: win.y, w: win.w, h: win.h };
  }

  function snap(id, edge) {
    const win = windows.get(id);
    if (!win) return;
    const area = workArea();
    win.minimized = false;
    if (edge === "down") {
      if (win.maximized || win.snapped) {
        win.maximized = false;
        win.snapped = null;
        if (win.restoreRect) {
          const rect = clampRect(win.restoreRect.x, win.restoreRect.y, win.restoreRect.w, win.restoreRect.h);
          win.x = rect.x;
          win.y = rect.y;
          win.w = rect.w;
          win.h = rect.h;
        }
        applyRect(win);
        setFocused(id);
        return;
      }
      minimize(id);
      return;
    }
    rememberRestore(win);
    win.maximized = false;
    if (edge === "up") {
      win.snapped = null;
      win.maximized = true;
      applyRect(win);
      setFocused(id);
      return;
    }
    win.snapped = edge;
    if (edge === "left") {
      win.x = 0;
      win.y = 0;
      win.w = Math.max(MIN_W, Math.floor(area.w / 2));
      win.h = area.h;
    } else if (edge === "right") {
      win.w = Math.max(MIN_W, Math.floor(area.w / 2));
      win.x = area.w - win.w;
      win.y = 0;
      win.h = area.h;
    }
    applyRect(win);
    setFocused(id);
  }

  function startResize(win) {
    win.el.querySelectorAll(".resize-handle").forEach((handle) => {
      handle.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || win.maximized) return;
        e.preventDefault();
        e.stopPropagation();
        const dir = handle.dataset.dir;
        const startX = e.clientX;
        const startY = e.clientY;
        const orig = { x: win.x, y: win.y, w: win.w, h: win.h };
        document.body.classList.add("os-dragging");
        const move = (ev) => {
          let { x, y, w, h } = orig;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (dir.includes("e")) w = orig.w + dx;
          if (dir.includes("s")) h = orig.h + dy;
          if (dir.includes("w")) {
            w = orig.w - dx;
            x = orig.x + dx;
          }
          if (dir.includes("n")) {
            h = orig.h - dy;
            y = orig.y + dy;
          }
          const clamped = clampRect(x, y, w, h);
          if (dir.includes("w")) clamped.x = Math.min(clamped.x, orig.x + orig.w - MIN_W);
          if (dir.includes("n")) clamped.y = Math.min(clamped.y, orig.y + orig.h - MIN_H);
          win.x = clamped.x;
          win.y = clamped.y;
          win.w = clamped.w;
          win.h = clamped.h;
          applyRect(win);
          scheduleHash();
        };
        const up = () => {
          document.removeEventListener("mousemove", move);
          document.removeEventListener("mouseup", up);
          document.body.classList.remove("os-dragging");
          persist();
          writeHashNow();
        };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });
    });
  }

  function mountNative(win) {
    const app = appOf(win.appId || win.id);
    const root = win.el.querySelector(".native-root");
    if (!app || !root) return;
    if (app.id === "settings" && window.OSSettings) window.OSSettings.mount(root);
    if (app.id === "file-explorer" && window.OSFileExplorer) {
      window.OSFileExplorer.mount(root, { winId: win.id, path: win.path || "/" });
    }
    if (app.id === "task-manager" && window.OSTaskManager) window.OSTaskManager.mount(root);
    if (app.id === "snip" && window.OSSnip) window.OSSnip.mount(root);
  }

  function makeWin(app, winId, rect, maximized) {
    const win = {
      id: winId,
      appId: app.id,
      path: null,
      fileId: null,
      el: createChrome(app),
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      minimized: false,
      maximized: !!maximized,
      snapped: null,
      restoreRect: null,
      z: ++zCounter,
    };
    win.el.dataset.winId = winId;
    win.el.style.zIndex = String(win.z);
    return win;
  }

  function notifyFileOpen(win, fileId) {
    if (!win) return;
    if (fileId) win.fileId = fileId;
    if (!win.fileId) return;
    const iframe = win.el.querySelector("iframe");
    if (!iframe) return;
    const send = () => {
      if (!win.fileId) return;
      const appId = win.appId || appIdOf(win.id);
      try {
        iframe.contentWindow.postMessage({ type: "os-file-open", fileId: win.fileId, appId: appId }, location.origin);
        if (appId === "sheets") {
          iframe.contentWindow.postMessage({ type: "os-sheets-open", fileId: win.fileId }, location.origin);
        }
      } catch (_err) {}
    };
    if (!iframe.dataset.fileOpenBound) {
      iframe.dataset.fileOpenBound = "1";
      iframe.addEventListener("load", send);
    }
    send();
  }

  function open(id, opts) {
    opts = opts || {};
    const appId = appIdOf(id);
    const app = window.OSCatalog.byId(appId);
    if (!app) return null;
    if (app.kind !== "native" && window.OS && !window.OS.isInstalled(appId)) return null;

    const multi = isMulti(app);
    let winId = id;
    if (opts.fileId && multi) {
      const same = Array.from(windows.values()).find(
        (w) => (w.appId || appIdOf(w.id)) === app.id && w.fileId === opts.fileId
      );
      if (same) {
        notifyFileOpen(same, opts.fileId);
        same.minimized = false;
        applyRect(same);
        setFocused(same.id);
        return same;
      }
      winId = newInstanceId(app.id);
    } else if (opts.newInstance && multi) {
      winId = newInstanceId(app.id);
    } else if (multi && id === app.id && !windows.has(id)) {
      const existing = latestOf(app.id);
      if (existing && !opts.forceNew) {
        if (opts.path) existing.path = opts.path;
        existing.minimized = false;
        applyRect(existing);
        setFocused(existing.id);
        if (opts.path && window.OSFileExplorer) window.OSFileExplorer.navigate(existing.id, opts.path);
        return existing;
      }
      winId = newInstanceId(app.id);
    } else if (windows.has(id)) {
      const win = windows.get(id);
      closedThisSession.delete(id);
      if (opts.x != null) {
        const rect = clampRect(opts.x, opts.y, opts.w, opts.h);
        win.x = rect.x;
        win.y = rect.y;
        win.w = rect.w;
        win.h = rect.h;
        applyRect(win);
      }
      if (opts.path) {
        win.path = opts.path;
        if (window.OSFileExplorer) window.OSFileExplorer.navigate(win.id, opts.path);
      }
      if (opts.fileId) notifyFileOpen(win, opts.fileId);
      win.minimized = false;
      applyRect(win);
      setFocused(id);
      return win;
    }

    closedThisSession.delete(winId);
    const area = workArea();
    let rect;
    let maximized = false;
    if (opts.x != null) {
      rect = clampRect(opts.x, opts.y, opts.w || app.windowW || DEFAULT_W, opts.h || app.windowH || DEFAULT_H);
      maximized = Math.abs(rect.w - area.w) < 8 && Math.abs(rect.h - area.h) < 8 && rect.x <= 4 && rect.y <= 4;
    } else {
      const saved = savedPlacement(winId) || (!multi ? savedPlacement(app.id) : null);
      if (saved) {
        rect = clampRect(saved.x, saved.y, saved.w || app.windowW || DEFAULT_W, saved.h || app.windowH || DEFAULT_H);
        maximized = !!saved.maximized;
      } else {
        rect = nextCascade(app);
      }
    }
    const win = makeWin(app, winId, rect, maximized);
    if (opts.path) win.path = opts.path;
    if (opts.fileId) win.fileId = opts.fileId;
    windows.set(winId, win);
    layer.appendChild(win.el);
    bindWindow(win);
    applyRect(win);
    if (app.kind === "native" && !app.href) mountNative(win);
    if (opts.fileId) notifyFileOpen(win, opts.fileId);
    setFocused(winId);
    persist();
    if (window.OSTaskManager) window.OSTaskManager.remountOpen();
    return win;
  }

  function minimize(id) {
    const win = windows.get(id);
    if (!win) return;
    win.minimized = true;
    applyRect(win);
    const next = Array.from(windows.values())
      .filter((w) => !w.minimized && w.id !== id)
      .sort((a, b) => b.z - a.z)[0];
    if (next) setFocused(next.id);
    else {
      win.el.classList.remove("focused");
      writeHashNow();
      persist();
      if (window.OS && window.OS.renderTaskbar) window.OS.renderTaskbar();
      if (window.OSAnalytics) window.OSAnalytics.trackDesktop();
    }
  }

  function toggleMaximize(id) {
    const win = windows.get(id);
    if (!win) return;
    win.minimized = false;
    if (!win.maximized) rememberRestore(win);
    win.maximized = !win.maximized;
    if (!win.maximized && win.restoreRect && !win.snapped) {
      const rect = clampRect(win.restoreRect.x, win.restoreRect.y, win.restoreRect.w, win.restoreRect.h);
      win.x = rect.x;
      win.y = rect.y;
      win.w = rect.w;
      win.h = rect.h;
    }
    win.snapped = null;
    applyRect(win);
    setFocused(id);
  }

  function close(id) {
    const win = windows.get(id);
    if (!win) return;
    rememberPlacement(win);
    closedThisSession.add(id);
    if ((win.appId || appIdOf(id)) === "file-explorer" && window.OSFileExplorer) {
      window.OSFileExplorer.unmount(id);
    }
    revokeHtmlBlob(win.el);
    win.el.remove();
    windows.delete(id);
    if (window.OSTaskManager) window.OSTaskManager.remountOpen();
    const next = Array.from(windows.values())
      .filter((w) => !w.minimized)
      .sort((a, b) => b.z - a.z)[0];
    if (next) setFocused(next.id);
    else {
      writeHashNow();
      persist();
      if (window.OS && window.OS.renderTaskbar) window.OS.renderTaskbar();
      if (window.OSAnalytics) window.OSAnalytics.trackDesktop();
    }
  }

  function toggleTask(id) {
    const win = windows.get(id);
    if (!win) {
      open(id);
      return;
    }
    const focused = getFocused();
    if (focused && focused.id === id && !win.minimized) {
      minimize(id);
    } else {
      win.minimized = false;
      applyRect(win);
      setFocused(id);
    }
  }

  function restoreList(list, focusId) {
    const sorted = (list || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    sorted.forEach((saved) => {
      const appId = saved.appId || appIdOf(saved.id);
      const app = window.OSCatalog.byId(appId);
      if (!app) return;
      if (app.kind !== "native" && window.OS && !window.OS.isInstalled(appId)) return;
      const win = open(saved.id, {
        x: saved.x,
        y: saved.y,
        w: saved.w,
        h: saved.h,
        path: saved.path || null,
        fileId: saved.fileId || null,
      });
      if (!win) return;
      win.minimized = !!saved.minimized;
      win.maximized = !!saved.maximized;
      if (saved.z) {
        win.z = saved.z;
        zCounter = Math.max(zCounter, saved.z);
        win.el.style.zIndex = String(win.z);
      }
      applyRect(win);
    });
    if (focusId && windows.has(focusId)) setFocused(focusId);
    else if (windows.size) {
      const top = getFocused();
      if (top) setFocused(top.id);
    } else writeHashNow();
  }

  function applyHashRoute() {
    if (writingHash) return;
    const hash = parseHash();
    const app = hash && appOf(hash.id);
    if (!hash || !app) return;
    if (app.kind !== "native" && window.OS && !window.OS.isInstalled(app.id)) return;
    open(hash.id, { x: hash.x, y: hash.y, w: hash.w, h: hash.h });
  }

  function refreshTitles() {
    windows.forEach((win) => {
      const app = win.previewApp || appOf(win.appId || win.id);
      if (!app) return;
      let name = window.OSCatalog.displayName
        ? window.OSCatalog.displayName(app, lang())
        : app.name || "";
      if (typeof name === "object" && name) name = name[lang()] || name.en || "";
      if (win.titleName) name = win.titleName;
      const title = win.el.querySelector(".titlebar-title");
      if (title) title.textContent = name;
      const icon = win.el.querySelector(".titlebar-icon");
      if (icon && app.icon) icon.src = app.icon;
      const iframe = win.el.querySelector("iframe");
      if (iframe) iframe.title = name;
    });
  }

  function refreshUserApp(id) {
    const win = windows.get(id);
    const app = appOf(id);
    if (!win || !app || app.kind !== "user") return;
    const name = window.OSCatalog.displayName(app, lang());
    win.el.querySelector(".titlebar-title").textContent = name;
    const icon = win.el.querySelector(".titlebar-icon");
    if (icon && app.icon) icon.src = app.icon;
    const iframe = win.el.querySelector("iframe");
    if (!iframe) return;
    iframe.title = name;
    applyUserFrame(iframe, app, win.el);
  }

  function openHtmlPreview(opts) {
    opts = opts || {};
    const PREVIEW_ID = "studio-preview";
    const title = String(opts.title || "Preview");
    const icon = opts.icon || "";
    const html = opts.html || "<!doctype html><title></title>";
    const fakeApp = {
      id: PREVIEW_ID,
      kind: "user",
      mode: "html",
      html,
      icon,
      href: null,
      name: { en: title, pt: title, ja: title },
      windowW: 720,
      windowH: 520,
    };
    if (windows.has(PREVIEW_ID)) {
      const win = windows.get(PREVIEW_ID);
      win.previewApp = fakeApp;
      win.titleName = title;
      win.ephemeral = true;
      const titleEl = win.el.querySelector(".titlebar-title");
      if (titleEl) titleEl.textContent = title;
      const iconEl = win.el.querySelector(".titlebar-icon");
      if (iconEl && icon) iconEl.src = icon;
      const iframe = win.el.querySelector("iframe");
      if (iframe) {
        iframe.title = title;
        applyUserFrame(iframe, fakeApp, win.el);
      }
      win.minimized = false;
      applyRect(win);
      setFocused(PREVIEW_ID);
      return win;
    }
    const rect = nextCascade(fakeApp);
    const win = makeWin(fakeApp, PREVIEW_ID, rect, false);
    win.previewApp = fakeApp;
    win.titleName = title;
    win.ephemeral = true;
    windows.set(PREVIEW_ID, win);
    layer.appendChild(win.el);
    bindWindow(win);
    applyRect(win);
    setFocused(PREVIEW_ID);
    if (window.OSTaskManager) window.OSTaskManager.remountOpen();
    return win;
  }

  function init() {
    layer = document.getElementById("windows");
    window.addEventListener("resize", () => {
      windows.forEach((win) => {
        const rect = clampRect(win.x, win.y, win.w, win.h);
        win.x = rect.x;
        win.y = rect.y;
        win.w = rect.w;
        win.h = rect.h;
        applyRect(win);
      });
      scheduleHash();
    });
    window.addEventListener("hashchange", applyHashRoute);
  }

  return {
    init,
    open,
    close,
    minimize,
    toggleMaximize,
    snap,
    toggleTask,
    restoreList,
    serialize,
    focusedId,
    parseHash,
    applyHashRoute,
    writeHashNow,
    refreshTitles,
    refreshUserApp,
    openHtmlPreview,
    closedThisSession,
    appIdOf,
    list: () => Array.from(windows.values()),
    has: (id) => windows.has(id),
    get: (id) => windows.get(id) || null,
  };
})();
