window.OSClipboard = (function () {
  const MAX = 30;
  const MAX_CHARS = 8000;

  function state() {
    return window.OS && window.OS.state ? window.OS.state : null;
  }

  function list() {
    const s = state();
    return s && Array.isArray(s.clipboard) ? s.clipboard : [];
  }

  function persist() {
    if (window.OS && typeof window.OS.persistNow === "function") window.OS.persistNow();
  }

  function nid() {
    return "clip_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function push(raw) {
    const text = String(raw || "").replace(/\u0000/g, "").slice(0, MAX_CHARS);
    if (!text.trim()) return;
    const s = state();
    if (!s) return;
    if (!Array.isArray(s.clipboard)) s.clipboard = [];
    const prev = s.clipboard[0];
    if (prev && prev.text === text) {
      prev.at = Date.now();
      persist();
      if (window.OSTray) window.OSTray.paintClip();
      return;
    }
    s.clipboard = [{ id: nid(), text, at: Date.now() }].concat(
      s.clipboard.filter((item) => item && item.text !== text)
    ).slice(0, MAX);
    persist();
    if (window.OSTray) window.OSTray.paintClip();
  }

  function clear() {
    const s = state();
    if (!s) return;
    s.clipboard = [];
    persist();
    if (window.OSTray) window.OSTray.paintClip();
  }

  function hookNav(nav) {
    if (!nav || typeof nav.writeText !== "function" || nav.writeText.__osHook) return;
    const orig = nav.writeText.bind(nav);
    async function wrapped(text) {
      push(text);
      return orig(text);
    }
    wrapped.__osHook = true;
    nav.writeText = wrapped;
  }

  function captureDoc(doc) {
    try {
      const sel = doc.getSelection && doc.getSelection();
      const text = sel ? String(sel) : "";
      if (text.trim()) push(text);
    } catch (_err) {}
  }

  function hookDocument(doc) {
    if (!doc || doc.documentElement.dataset.osClip === "1") return;
    doc.documentElement.dataset.osClip = "1";
    doc.addEventListener("copy", () => captureDoc(doc));
    doc.addEventListener("cut", () => captureDoc(doc));
    try {
      hookNav(doc.defaultView && doc.defaultView.navigator && doc.defaultView.navigator.clipboard);
    } catch (_err) {}
  }

  function init() {
    hookDocument(document);
    hookNav(navigator.clipboard);
  }

  return { list, push, clear, hookDocument, init };
})();

window.OSTray = (function () {
  let quickEl;
  let clipEl;
  let quickBtn;
  let clipBtn;

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

  function iconQuick() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <rect x="9" y="2" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <rect x="2" y="9" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <rect x="9" y="9" width="5" height="5" rx="1.2" fill="currentColor" opacity="0.85"/>
    </svg>`;
  }

  function iconClip() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 3.5h5a1 1 0 0 1 1 1V5h.5A1.5 1.5 0 0 1 13.5 6.5v6A1.5 1.5 0 0 1 12 14H6a1.5 1.5 0 0 1-1.5-1.5v-.5H4A1.5 1.5 0 0 1 2.5 10.5v-6A1.5 1.5 0 0 1 4 3h1.5z" fill="none" stroke="currentColor" stroke-width="1.3"/>
      <path d="M6 3.5V3a1.5 1.5 0 0 1 3 0v.5" fill="none" stroke="currentColor" stroke-width="1.3"/>
    </svg>`;
  }

  function isOpen(el) {
    return !!(el && !el.hidden);
  }

  function closeQuick() {
    if (quickEl) quickEl.hidden = true;
    if (quickBtn) quickBtn.classList.remove("active");
  }

  function closeClip() {
    if (clipEl) clipEl.hidden = true;
    if (clipBtn) clipBtn.classList.remove("active");
  }

  function closeAll() {
    const any = isOpen(quickEl) || isOpen(clipEl);
    closeQuick();
    closeClip();
    return any;
  }

  function closeOthers() {
    if (window.OSStart) {
      window.OSStart.close();
      window.OSStart.closeContext();
    }
    if (window.OSDesk && typeof window.OSDesk.closeFlyout === "function") window.OSDesk.closeFlyout();
  }

  function st() {
    return (window.OS && window.OS.state) || {};
  }

  function paintQuick() {
    if (!quickEl || quickEl.hidden) return;
    const s = st();
    const glass = Number(s.glass);
    const blur = Number(s.blur);
    const night = Number(s.nightLight);
    const themeDark = !(window.OS && window.OS.theme === "light");
    quickEl.innerHTML = `
      <div class="os-quick-card">
        <div class="os-quick-head">${escapeHtml(t("controlCenter"))}</div>
        <div class="os-quick-tiles">
          <button type="button" class="os-quick-tile${themeDark ? " on" : ""}" data-quick="theme">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="4" fill="currentColor"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.4 3.4l1.4 1.4M13.2 13.2l1.4 1.4M3.4 14.6l1.4-1.4M13.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>
            ${escapeHtml(t("theme"))}
          </button>
          <button type="button" class="os-quick-tile${night > 0 ? " on" : ""}" data-quick="night">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M13.5 11.2A6.2 6.2 0 0 1 7.2 3.4 6.4 6.4 0 1 0 13.5 11.2z" fill="currentColor"/></svg>
            ${escapeHtml(t("nightLight"))}
          </button>
          <button type="button" class="os-quick-tile" data-quick="settings">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7.2 2.4h3.6l.5 1.6 1.6.5 1.5-1 2.1 2.1-1 1.5.5 1.6 1.6.5v3.6l-1.6.5-.5 1.6 1 1.5-2.1 2.1-1.5-1-1.6.5-.5 1.6H7.2l-.5-1.6-1.6-.5-1.5 1-2.1-2.1 1-1.5-.5-1.6L1.4 10.8V7.2l1.6-.5.5-1.6-1-1.5 2.1-2.1 1.5 1 1.6-.5.5-1.6z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9" cy="9" r="2.1" fill="currentColor"/></svg>
            ${escapeHtml(t("settings"))}
          </button>
        </div>
        <div class="os-quick-sliders">
          <label>${escapeHtml(t("glassOpacity"))} <span id="os-quick-glass-val">${Number.isFinite(glass) ? glass : 86}%</span>
            <input id="os-quick-glass" type="range" min="40" max="100" value="${Number.isFinite(glass) ? glass : 86}">
          </label>
          <label>${escapeHtml(t("glassBlur"))} <span id="os-quick-blur-val">${Number.isFinite(blur) ? blur : 20}px</span>
            <input id="os-quick-blur" type="range" min="0" max="40" value="${Number.isFinite(blur) ? blur : 20}">
          </label>
          <label>${escapeHtml(t("nightLight"))} <span id="os-quick-night-val">${Number.isFinite(night) ? night : 0}%</span>
            <input id="os-quick-night" type="range" min="0" max="80" value="${Number.isFinite(night) ? night : 0}">
          </label>
        </div>
      </div>`;
  }

  function paintClip() {
    if (!clipEl || clipEl.hidden) return;
    const items = window.OSClipboard ? window.OSClipboard.list() : [];
    clipEl.innerHTML = `
      <div class="os-clip-card">
        <div class="os-clip-head">
          <span>${escapeHtml(t("clipboardHistory"))}</span>
          <button type="button" class="os-clip-clear" data-clip-clear>${escapeHtml(t("clipboardClear"))}</button>
        </div>
        <div class="os-clip-list">
          ${
            items.length
              ? items
                  .map(
                    (item) =>
                      `<button type="button" class="os-clip-item" data-clip-id="${escapeHtml(item.id)}">${escapeHtml(item.text)}</button>`
                  )
                  .join("")
              : `<p class="muted">${escapeHtml(t("clipboardEmpty"))}</p>`
          }
        </div>
      </div>`;
  }

  function openQuick() {
    closeClip();
    closeOthers();
    if (!quickEl) return;
    quickEl.hidden = false;
    if (quickBtn) quickBtn.classList.add("active");
    paintQuick();
  }

  function openClip() {
    closeQuick();
    closeOthers();
    if (!clipEl) return;
    clipEl.hidden = false;
    if (clipBtn) clipBtn.classList.add("active");
    paintClip();
  }

  function toggleQuick() {
    if (isOpen(quickEl)) closeQuick();
    else openQuick();
  }

  function toggleClip() {
    if (isOpen(clipEl)) closeClip();
    else openClip();
  }

  function bindSlider(root, id, key, suffix) {
    const input = root.querySelector(id);
    const label = root.querySelector(id + "-val");
    if (!input) return;
    input.addEventListener("input", () => {
      const n = Number(input.value);
      if (label) label.textContent = n + suffix;
      const patch = {};
      patch[key] = n;
      if (window.OS && window.OS.applyAppearance) window.OS.applyAppearance(patch);
    });
  }

  function init() {
    quickEl = document.getElementById("os-quick");
    clipEl = document.getElementById("os-clip");
    quickBtn = document.getElementById("tray-quick");
    clipBtn = document.getElementById("tray-clip");
    if (window.OSClipboard) window.OSClipboard.init();
    if (quickBtn) {
      const label = t("controlCenter");
      quickBtn.setAttribute("aria-label", label);
      quickBtn.setAttribute("title", label);
      quickBtn.innerHTML = iconQuick();
      quickBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleQuick();
      });
    }
    if (clipBtn) {
      const label = t("clipboardHistory");
      clipBtn.setAttribute("aria-label", label);
      clipBtn.setAttribute("title", label);
      clipBtn.innerHTML = iconClip();
      clipBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleClip();
      });
    }
    if (quickEl) {
      quickEl.addEventListener("click", (e) => e.stopPropagation());
      quickEl.addEventListener("input", (e) => {
        const el = e.target;
        if (!(el instanceof HTMLInputElement) || el.type !== "range") return;
        const n = Number(el.value);
        if (el.id === "os-quick-glass") {
          const lab = document.getElementById("os-quick-glass-val");
          if (lab) lab.textContent = n + "%";
          if (window.OS) window.OS.applyAppearance({ glass: n });
        } else if (el.id === "os-quick-blur") {
          const lab = document.getElementById("os-quick-blur-val");
          if (lab) lab.textContent = n + "px";
          if (window.OS) window.OS.applyAppearance({ blur: n });
        } else if (el.id === "os-quick-night") {
          const lab = document.getElementById("os-quick-night-val");
          if (lab) lab.textContent = n + "%";
          if (window.OS) window.OS.applyAppearance({ nightLight: n });
        }
      });
      quickEl.addEventListener("click", (e) => {
        const tile = e.target.closest("[data-quick]");
        if (!tile) return;
        const act = tile.dataset.quick;
        if (act === "theme" && window.OS) {
          window.OS.setTheme(window.OS.theme === "light" ? "dark" : "light");
          paintQuick();
        } else if (act === "night" && window.OS) {
          const cur = Number(st().nightLight) || 0;
          window.OS.applyAppearance({ nightLight: cur > 0 ? 0 : 42 });
          paintQuick();
        } else if (act === "settings" && window.OSWindows) {
          closeQuick();
          window.OSWindows.open("settings");
        }
      });
    }
    if (clipEl) {
      clipEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (e.target.closest("[data-clip-clear]")) {
          if (window.OSClipboard) window.OSClipboard.clear();
          return;
        }
        const item = e.target.closest("[data-clip-id]");
        if (!item || !window.OSClipboard) return;
        const found = window.OSClipboard.list().find((row) => row.id === item.dataset.clipId);
        if (!found) return;
        window.OSClipboard.push(found.text);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(found.text).catch(() => {});
        }
      });
    }
    document.addEventListener("click", (e) => {
      if (e.target.closest("#os-quick, #os-clip, #tray-quick, #tray-clip")) return;
      closeAll();
    });
  }

  function syncLabels() {
    if (quickBtn) {
      const label = t("controlCenter");
      quickBtn.setAttribute("aria-label", label);
      quickBtn.setAttribute("title", label);
    }
    if (clipBtn) {
      const label = t("clipboardHistory");
      clipBtn.setAttribute("aria-label", label);
      clipBtn.setAttribute("title", label);
    }
    if (isOpen(quickEl)) paintQuick();
    if (isOpen(clipEl)) paintClip();
  }

  return {
    init,
    closeAll,
    toggleQuick,
    toggleClip,
    paintQuick,
    paintClip,
    syncLabels,
  };
})();
