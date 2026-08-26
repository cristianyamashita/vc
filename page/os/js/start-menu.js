window.OSStart = (function () {
  let menu;
  let context;
  let contextAppId = null;
  let searchQuery = "";

  function t(key) {
    return window.OSI18n.t(key);
  }

  let contextHandler = null;

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    searchQuery = "";
    document.getElementById("start-btn").classList.remove("open");
  }

  function closeContext() {
    if (!context) return;
    context.hidden = true;
    contextAppId = null;
    contextHandler = null;
  }

  function isOpen() {
    return menu && !menu.hidden;
  }

  function matchesQuery(app, lang, q) {
    if (!q) return true;
    const name = window.OSCatalog.displayName(app, lang);
    const tag = window.OSCatalog.displayTag(app, lang);
    const desc = window.OSCatalog.displayDesc(app, lang);
    return `${name} ${tag} ${desc} ${app.id}`.toLowerCase().includes(q);
  }

  function startGroupKey(app) {
    if (!app) return "misc";
    if (app.kind === "native") return "system";
    if (app.kind === "user") return "user";
    if (app.channel === "alpha") return "alpha";
    if (app.channel === "beta") return "beta";
    const folder = String(app.href || "").split("/")[0];
    if (folder === "utils") return "utils";
    if (folder === "game") return "game";
    if (folder === "mobile") return "mobile";
    return "misc";
  }

  function startGroupLabel(key) {
    const keys = {
      utils: "startGroupUtils",
      game: "startGroupGames",
      mobile: "startGroupMobile",
      misc: "startGroupMisc",
      beta: "startGroupBeta",
      alpha: "startGroupAlpha",
      user: "startGroupMyApps",
      system: "startGroupSystem",
    };
    return t(keys[key] || key);
  }

  function startListApps() {
    const site = window.OSCatalog.siteApps().filter((app) => window.OS.isInstalled(app.id));
    const natives = window.OSCatalog.nativeApps().filter((app) => app.id !== "settings");
    const users = window.OSCatalog.userApps ? window.OSCatalog.userApps() : [];
    return site.concat(natives, users);
  }

  function render() {
    const lang = window.OS.lang;
    const q = searchQuery.trim().toLowerCase();
    const favorites = (window.OS.state.favorites || [])
      .map((id) => window.OSCatalog.byId(id))
      .filter((app) => app && (app.kind === "native" || window.OS.isInstalled(app.id)))
      .filter((app) => matchesQuery(app, lang, q));
    const grouped = new Map();
    startListApps()
      .filter((app) => matchesQuery(app, lang, q))
      .forEach((app) => {
        const key = startGroupKey(app);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(app);
      });
    const groupKeys = ["utils", "game", "mobile", "misc", "beta", "alpha", "user", "system"].filter((key) =>
      grouped.has(key)
    );

    let favHtml = favorites
      .map(
        (app) => `
        <button type="button" class="start-fav" data-app-id="${app.id}">
          <img src="${app.icon}" alt="">
          <span>${escapeHtml(window.OSCatalog.displayName(app, lang))}</span>
        </button>`
      )
      .join("");
    if (!favHtml && !q) favHtml = `<p class="start-empty">${escapeHtml(t("emptyFavorites"))}</p>`;

    let appsHtml = groupKeys
      .map((key) => {
        const apps = grouped.get(key).slice().sort((a, b) =>
          window.OSCatalog.displayName(a, lang).localeCompare(window.OSCatalog.displayName(b, lang), lang)
        );
        const heading = startGroupLabel(key);
        const items = apps
          .map(
            (app) => `
            <button type="button" class="start-app" data-app-id="${app.id}">
              <img src="${app.icon}" alt="">
              <span>${escapeHtml(window.OSCatalog.displayName(app, lang))}</span>
            </button>`
          )
          .join("");
        return `<div class="start-group"><h4>${escapeHtml(heading)}</h4><div class="start-app-list">${items}</div></div>`;
      })
      .join("");
    if (!appsHtml && !q) appsHtml = `<p class="start-empty">${escapeHtml(t("emptyApps"))}</p>`;

    const noResults = q && !favorites.length && !groupKeys.length;
    const username = window.OS.state.username || "User";
    let bodyHtml;
    if (noResults) {
      bodyHtml = `<p class="start-empty">${escapeHtml(t("noSearchResults"))}</p>`;
    } else {
      const favTitle = !q || favorites.length ? `<h3 class="start-section-title">${escapeHtml(t("favorites"))}</h3>` : "";
      const favBlock = !q || favorites.length ? `<div class="start-favorites">${favHtml}</div>` : "";
      const appsTitle = q ? "" : `<h3 class="start-section-title">${escapeHtml(t("apps"))}</h3>`;
      bodyHtml = `${favTitle}${favBlock}${appsTitle}${appsHtml}`;
    }
    menu.innerHTML = `
      <div class="start-search-wrap">
        <input class="start-search" type="search" value="${escapeHtml(searchQuery)}" data-i18n-placeholder="searchApps" placeholder="${escapeHtml(t("searchApps"))}" autocomplete="off">
      </div>
      <div class="start-scroll">
        ${bodyHtml}
      </div>
      <div class="start-footer">
        <div class="start-user">
          <div class="start-avatar">${escapeHtml(username.slice(0, 1).toUpperCase())}</div>
          <div class="start-user-name">${escapeHtml(username)}</div>
        </div>
        <button type="button" class="settings-btn" data-app-id="settings">
          <img src="../assets/icons/svg/os.svg" alt="">
          <span>${escapeHtml(t("settings"))}</span>
        </button>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openApp(id) {
    closeMenu();
    closeContext();
    window.OSWindows.open(id);
  }

  function placeContext(x, y) {
    context.hidden = false;
    const pad = 8;
    const rect = context.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - pad);
    const top = Math.min(y, window.innerHeight - rect.height - pad);
    context.style.left = Math.max(pad, left) + "px";
    context.style.top = Math.max(pad, top) + "px";
  }

  function showContext(appId, x, y) {
    const app = window.OSCatalog.byId(appId);
    if (!app) {
      closeContext();
      return;
    }
    contextAppId = appId;
    contextHandler = null;
    const onDesktop = window.OS.state.desktopIcons.includes(appId);
    const onFav = window.OS.state.favorites.includes(appId);
    context.innerHTML = `
      <button type="button" data-act="desktop">${escapeHtml(onDesktop ? t("removeDesktop") : t("addDesktop"))}</button>
      <button type="button" data-act="favorites">${escapeHtml(onFav ? t("removeFavorites") : t("addFavorites"))}</button>
    `;
    placeContext(x, y);
  }

  function showItems(items, x, y, onPick) {
    contextAppId = null;
    contextHandler = typeof onPick === "function" ? onPick : null;
    context.innerHTML = (items || [])
      .map((item) => {
        if (item.sep) return `<div class="context-sep"></div>`;
        const disabled = item.disabled ? " disabled" : "";
        return `<button type="button" data-act="${escapeHtml(item.act)}"${disabled}>${escapeHtml(item.label)}</button>`;
      })
      .join("");
    placeContext(x, y);
  }

  function focusSearch(caret) {
    const input = menu.querySelector(".start-search");
    if (!input) return;
    input.focus();
    const pos = typeof caret === "number" ? caret : input.value.length;
    try {
      input.setSelectionRange(pos, pos);
    } catch (_) {
      /* search inputs in some browsers reject selection */
    }
  }

  function toggle() {
    if (isOpen()) {
      closeMenu();
      return;
    }
    searchQuery = "";
    render();
    menu.hidden = false;
    document.getElementById("start-btn").classList.add("open");
    focusSearch();
  }

  function init() {
    menu = document.getElementById("start-menu");
    context = document.getElementById("context-menu");
    document.getElementById("start-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      closeContext();
      toggle();
    });
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-app-id]");
      if (!btn) return;
      openApp(btn.dataset.appId);
    });
    menu.addEventListener("input", (e) => {
      const input = e.target.closest(".start-search");
      if (!input) return;
      searchQuery = input.value;
      const keep = input.selectionStart;
      render();
      focusSearch(keep);
    });
    menu.addEventListener("keydown", (e) => {
      if (e.target.closest(".start-search") && e.key === "Escape") {
        e.stopPropagation();
        if (searchQuery) {
          searchQuery = "";
          render();
          focusSearch();
        } else {
          closeMenu();
        }
      }
    });
    menu.addEventListener("contextmenu", (e) => {
      const btn = e.target.closest("[data-app-id]");
      if (!btn) return;
      e.preventDefault();
      showContext(btn.dataset.appId, e.clientX, e.clientY);
    });
    context.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      const act = btn && btn.dataset.act;
      if (!act || btn.disabled) return;
      if (contextHandler) {
        const fn = contextHandler;
        closeContext();
        fn(act);
        return;
      }
      if (!contextAppId) return;
      if (act === "desktop") window.OS.toggleDesktopIcon(contextAppId);
      if (act === "favorites") window.OS.toggleFavorite(contextAppId);
      closeContext();
      if (isOpen()) render();
    });
    document.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      if (!menu.contains(e.target) && !e.target.closest("#start-btn")) closeMenu();
      if (!context.contains(e.target)) closeContext();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeContext();
        closeMenu();
      }
    });
  }

  return { init, render, close: closeMenu, closeContext, isOpen, showContext, showItems };
})();
