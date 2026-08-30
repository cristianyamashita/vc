window.OSHotkeys = (function () {
  let switcherEl = null;
  let runEl = null;
  let runInput = null;
  let snapEl = null;
  let switcherOpen = false;
  let switcherIndex = 0;
  let switcherIds = [];

  function t(key, vars) {
    return window.OSI18n.t(key, vars);
  }

  function typingTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return !!target.isContentEditable;
  }

  function orderedWindows() {
    return window.OSWindows.list()
      .slice()
      .sort((a, b) => (b.z || 0) - (a.z || 0));
  }

  function renderSwitcher() {
    if (!switcherEl) return;
    const lang = (window.OS && window.OS.lang) || "en";
    switcherEl.innerHTML = `<div class="os-switcher-card" role="listbox" aria-label="${t("switcher")}">${switcherIds
      .map((id, i) => {
        const win = window.OSWindows.get(id);
        const app = win && window.OSCatalog.byId(win.appId || window.OSWindows.appIdOf(win.id));
        if (!win || !app) return "";
        const name = win.titleName || window.OSCatalog.displayName(app, lang);
        return `<button type="button" class="os-switcher-item${i === switcherIndex ? " active" : ""}" data-switch-id="${id}">
          <img src="${app.icon || ""}" alt="">
          <span>${name}</span>
        </button>`;
      })
      .join("")}</div>`;
  }

  function closeSwitcher(activate) {
    if (!switcherOpen) return;
    switcherOpen = false;
    if (switcherEl) switcherEl.hidden = true;
    if (activate && switcherIds.length) {
      const id = switcherIds[switcherIndex] || switcherIds[0];
      if (id) window.OSWindows.toggleTask(id);
    }
    switcherIds = [];
  }

  function openSwitcher(back) {
    const list = orderedWindows();
    if (!list.length) return;
    switcherIds = list.map((win) => win.id);
    if (!switcherOpen) {
      switcherIndex = switcherIds.length > 1 ? 1 : 0;
    } else if (back) {
      switcherIndex = (switcherIndex - 1 + switcherIds.length) % switcherIds.length;
    } else {
      switcherIndex = (switcherIndex + 1) % switcherIds.length;
    }
    switcherOpen = true;
    if (switcherEl) switcherEl.hidden = false;
    renderSwitcher();
  }

  function closeRun() {
    if (!runEl) return;
    runEl.hidden = true;
  }

  function openRun() {
    if (!runEl || !runInput) return;
    if (window.OSStart) {
      window.OSStart.close();
      window.OSStart.closeContext();
    }
    closeSwitcher(false);
    runEl.hidden = false;
    runInput.value = "";
    runInput.focus();
  }

  function matchApp(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return null;
    const catalog = window.OSCatalog;
    const all = catalog
      .nativeApps()
      .concat(catalog.siteApps())
      .concat(catalog.userApps ? catalog.userApps() : []);
    const lang = (window.OS && window.OS.lang) || "en";
    const exact = all.find((app) => app.id === q);
    if (exact) return exact;
    return (
      all.find((app) => catalog.displayName(app, lang).toLowerCase() === q) ||
      all.find((app) => catalog.displayName(app, lang).toLowerCase().includes(q)) ||
      all.find((app) => app.id.includes(q)) ||
      null
    );
  }

  async function submitRun(raw) {
    const text = String(raw || "").trim();
    closeRun();
    if (!text) return;
    if (text.startsWith("/") && window.OSFS) {
      const node = await window.OSFS.nodeAtPath(text);
      if (node && window.OSFileExplorer) {
        await window.OSFileExplorer.openDesktopNode(node);
        return;
      }
    }
    const app = matchApp(text);
    if (!app) return;
    if (window.OS && typeof window.OS.ensureInstalled === "function") window.OS.ensureInstalled(app.id);
    window.OSWindows.open(app.id);
  }

  function snapZone(edge) {
    if (!snapEl) return;
    if (!edge) {
      snapEl.hidden = true;
      snapEl.dataset.edge = "";
      return;
    }
    snapEl.hidden = false;
    snapEl.dataset.edge = edge;
  }

  function handle(e, fromFrame) {
    if (!e) return false;
    if (document.documentElement.dataset.setup) {
      return false;
    }
    const key = e.key;
    const lower = String(key || "").toLowerCase();
    const meta = e.metaKey;
    const ctrl = e.ctrlKey;
    const alt = e.altKey;
    const shift = e.shiftKey;
    const typing = !fromFrame && typingTarget(e.target);

    if (key === "Escape") {
      if (window.OSTray && window.OSTray.closeAll && window.OSTray.closeAll()) {
        e.preventDefault();
        return true;
      }
      if (runEl && !runEl.hidden) {
        e.preventDefault();
        closeRun();
        return true;
      }
      if (switcherOpen) {
        e.preventDefault();
        closeSwitcher(false);
        return true;
      }
    }

    if ((alt && key === "Tab") || (ctrl && alt && key === "Tab")) {
      e.preventDefault();
      openSwitcher(shift);
      return true;
    }
    if (alt && key === "`") {
      e.preventDefault();
      const focused = window.OSWindows.focusedId();
      const appId = focused ? window.OSWindows.appIdOf(focused) : null;
      const same = orderedWindows().filter((win) => window.OSWindows.appIdOf(win.id) === appId);
      if (same.length > 1) {
        const idx = same.findIndex((win) => win.id === focused);
        const next = same[(idx + (shift ? -1 : 1) + same.length) % same.length];
        window.OSWindows.toggleTask(next.id);
      } else {
        openSwitcher(shift);
      }
      return true;
    }

    if (ctrl && key === "Escape") {
      e.preventDefault();
      if (window.OSStart) window.OSStart.toggle();
      return true;
    }
    const startMeta = meta && !ctrl && !alt && !shift && (key === " " || key === "Spacebar");
    if (startMeta) {
      e.preventDefault();
      if (window.OSStart) window.OSStart.toggle();
      return true;
    }

    if (!typing && ctrl && !alt && !shift && (lower === "e" || key === "e")) {
      e.preventDefault();
      window.OSWindows.open("file-explorer");
      return true;
    }
    if (!typing && ctrl && !alt && key === ",") {
      e.preventDefault();
      window.OSWindows.open("settings");
      return true;
    }
    if (!typing && ((alt && !ctrl && lower === "r") || (ctrl && alt && lower === "r"))) {
      e.preventDefault();
      openRun();
      return true;
    }

    const snapKey = (meta || (ctrl && alt)) && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key);
    if (snapKey && window.OSWindows.focusedId()) {
      e.preventDefault();
      const id = window.OSWindows.focusedId();
      if (key === "ArrowLeft") window.OSWindows.snap(id, "left");
      if (key === "ArrowRight") window.OSWindows.snap(id, "right");
      if (key === "ArrowUp") window.OSWindows.snap(id, "up");
      if (key === "ArrowDown") window.OSWindows.snap(id, "down");
      return true;
    }

    if (!typing && ctrl && shift && !alt && (lower === "a" || key === "A")) {
      e.preventDefault();
      if (window.OSTray) window.OSTray.toggleQuick();
      return true;
    }
    if (ctrl && shift && !alt && (lower === "v" || key === "V")) {
      e.preventDefault();
      if (window.OSTray) window.OSTray.toggleClip();
      return true;
    }

    if (!typing && alt && !ctrl && !shift && (lower === "f4" || key === "F4")) {
      e.preventDefault();
      const id = window.OSWindows.focusedId();
      if (id) window.OSWindows.close(id);
      return true;
    }

    return false;
  }

  function handleFromFrame(e) {
    return handle(e, true);
  }

  function init() {
    switcherEl = document.getElementById("os-switcher");
    runEl = document.getElementById("os-run");
    runInput = document.getElementById("os-run-input");
    snapEl = document.getElementById("os-snap-zone");

    document.addEventListener(
      "keydown",
      (e) => {
        handle(e, false);
      },
      true
    );
    document.addEventListener("keyup", (e) => {
      if (switcherOpen && (e.key === "Alt" || e.key === "Control" || e.key === "Meta")) {
        closeSwitcher(true);
      }
    });
    if (switcherEl) {
      switcherEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-switch-id]");
        if (!btn) return;
        switcherIndex = Math.max(0, switcherIds.indexOf(btn.dataset.switchId));
        closeSwitcher(true);
      });
    }
    if (runEl) {
      runEl.addEventListener("click", (e) => {
        if (e.target === runEl) closeRun();
      });
    }
    const form = document.getElementById("os-run-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitRun(runInput ? runInput.value : "");
      });
    }
  }

  return {
    init,
    handle,
    handleFromFrame,
    openRun,
    closeRun,
    openSwitcher,
    closeSwitcher,
    snapZone,
    t,
  };
})();
