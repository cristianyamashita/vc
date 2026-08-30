window.OSSetup = (function () {
  const LANGS = [
    { id: "ja", code: "JA", name: "日本語" },
    { id: "en", code: "EN", name: "English" },
    { id: "pt", code: "PT", name: "Português" },
  ];

  let step = "lang";
  let lang = "en";
  let name = "";
  let pack = "recommended";
  let resolveDone = null;

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

  function guessLang() {
    const raw = String((navigator.language || navigator.userLanguage || "") + " " + (navigator.languages || []).join(" ")).toLowerCase();
    if (/\bja\b/.test(raw) || raw.indexOf("ja-") !== -1) return "ja";
    if (/\bpt\b/.test(raw) || raw.indexOf("pt-") !== -1) return "pt";
    return "en";
  }

  function rootEl() {
    return document.getElementById("os-setup");
  }

  function packIds(id) {
    if (window.OSCatalog && window.OSCatalog.installPackIds) return window.OSCatalog.installPackIds(id);
    if (id === "recommended" && window.OSCatalog && window.OSCatalog.DEFAULT_INSTALLED) {
      return window.OSCatalog.DEFAULT_INSTALLED.slice();
    }
    if (id === "all" && window.OSCatalog && window.OSCatalog.stableSiteApps) {
      return window.OSCatalog.stableSiteApps().map((app) => app.id);
    }
    return [];
  }

  function applyLang(next) {
    lang = ["en", "pt", "ja"].includes(next) ? next : "en";
    if (window.OS) window.OS.lang = lang;
    document.documentElement.lang = lang === "pt" ? "pt" : lang === "ja" ? "ja" : "en";
    localStorage.setItem("app_lang", lang);
  }

  function stepsHtml() {
    const order = ["lang", "name", "apps"];
    return (
      '<div class="os-setup-steps" aria-hidden="true">' +
      order
        .map((id) => '<span class="' + (id === step ? "on" : "") + '"></span>')
        .join("") +
      "</div>"
    );
  }

  function langStep() {
    return (
      '<h1 id="os-setup-title" class="os-setup-title">' +
      escapeHtml(t("setupLangTitle")) +
      "</h1>" +
      '<div class="os-setup-langs">' +
      LANGS.map((item) => {
        const selected = item.id === lang ? " selected" : "";
        return (
          '<button type="button" class="os-setup-lang' +
          selected +
          '" data-setup-lang="' +
          item.id +
          '">' +
          '<span class="os-setup-lang-code">' +
          escapeHtml(item.code) +
          "</span>" +
          '<span class="os-setup-lang-name">' +
          escapeHtml(item.name) +
          "</span>" +
          "</button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function nameStep() {
    return (
      '<p class="os-setup-kicker">' +
      escapeHtml(t("setupWelcome")) +
      "</p>" +
      '<h1 id="os-setup-title" class="os-setup-title">' +
      escapeHtml(t("setupNameTitle")) +
      "</h1>" +
      '<p class="muted os-setup-hint">' +
      escapeHtml(t("setupNameHint")) +
      "</p>" +
      '<label class="os-setup-field" for="os-setup-name">' +
      '<span>' +
      escapeHtml(t("username")) +
      "</span>" +
      '<input id="os-setup-name" type="text" maxlength="40" value="' +
      escapeHtml(name) +
      '" placeholder="' +
      escapeHtml(t("setupNamePlaceholder")) +
      '" autocomplete="nickname">' +
      "</label>" +
      '<div class="os-setup-actions">' +
      '<button type="button" class="os-setup-btn" data-setup-act="back">' +
      escapeHtml(t("setupBack")) +
      "</button>" +
      '<button type="button" class="os-setup-btn" data-setup-act="skip">' +
      escapeHtml(t("setupSkip")) +
      "</button>" +
      '<button type="button" class="os-setup-btn primary" data-setup-act="continue">' +
      escapeHtml(t("setupContinue")) +
      "</button>" +
      "</div>"
    );
  }

  function appsStep() {
    const packs = [
      {
        id: "recommended",
        title: t("setupPackRecommended"),
        desc: t("setupPackRecommendedDesc", { n: packIds("recommended").length }),
      },
      {
        id: "basic",
        title: t("setupPackBasic"),
        desc: t("setupPackBasicDesc", { n: (window.OSCatalog.nativeApps() || []).length }),
      },
      {
        id: "all",
        title: t("setupPackAll"),
        desc: t("setupPackAllDesc", { n: packIds("all").length }),
      },
    ];
    return (
      '<p class="os-setup-kicker">' +
      escapeHtml(t("setupWelcome")) +
      "</p>" +
      '<h1 id="os-setup-title" class="os-setup-title">' +
      escapeHtml(t("setupAppsTitle")) +
      "</h1>" +
      '<p class="muted os-setup-hint">' +
      escapeHtml(t("setupAppsHint")) +
      "</p>" +
      '<div class="os-setup-packs">' +
      packs
        .map((item) => {
          const selected = item.id === pack ? " selected" : "";
          return (
            '<button type="button" class="os-setup-pack' +
            selected +
            '" data-setup-pack="' +
            item.id +
            '">' +
            "<strong>" +
            escapeHtml(item.title) +
            "</strong>" +
            "<span>" +
            escapeHtml(item.desc) +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="os-setup-actions">' +
      '<button type="button" class="os-setup-btn" data-setup-act="back">' +
      escapeHtml(t("setupBack")) +
      "</button>" +
      '<button type="button" class="os-setup-btn primary" data-setup-act="finish">' +
      escapeHtml(t("setupFinish")) +
      "</button>" +
      "</div>"
    );
  }

  function bodyHtml() {
    if (step === "name") return nameStep();
    if (step === "apps") return appsStep();
    return langStep();
  }

  function render() {
    const root = rootEl();
    if (!root) return;
    root.innerHTML =
      '<div class="os-setup-card" role="dialog" aria-modal="true" aria-labelledby="os-setup-title">' +
      '<div class="os-setup-brand">' +
      '<img src="../assets/icons/svg/os.svg" alt="">' +
      "<span>Desktop</span>" +
      "</div>" +
      stepsHtml() +
      '<div class="os-setup-body">' +
      bodyHtml() +
      "</div>" +
      "</div>";
    bind(root);
    const focus =
      step === "name"
        ? root.querySelector("#os-setup-name")
        : step === "apps"
          ? root.querySelector(".os-setup-pack.selected") || root.querySelector("[data-setup-pack]")
          : root.querySelector(".os-setup-lang.selected") || root.querySelector("[data-setup-lang]");
    if (focus) focus.focus();
  }

  function goName() {
    step = "name";
    render();
  }

  function goApps(fromSkip) {
    if (fromSkip) name = "";
    else {
      const input = rootEl() && rootEl().querySelector("#os-setup-name");
      if (input) name = input.value;
    }
    step = "apps";
    render();
  }

  function finish() {
    const username = String(name || "").trim() || "User";
    if (window.OS && window.OS.state) window.OS.state.username = username;
    if (window.OS.applyInstallPack) window.OS.applyInstallPack(pack);
    else if (window.OS.state) {
      window.OS.state.onboarded = true;
      if (window.OS.persistNow) window.OS.persistNow();
    }
    hide();
    if (window.OS.setLang) window.OS.setLang(lang);
    else if (window.OS.refreshChrome) window.OS.refreshChrome();
    if (resolveDone) {
      const done = resolveDone;
      resolveDone = null;
      done();
    }
  }

  function bind(root) {
    root.querySelectorAll("[data-setup-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyLang(btn.dataset.setupLang);
        goName();
      });
    });
    root.querySelectorAll("[data-setup-pack]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pack = btn.dataset.setupPack || "recommended";
        render();
      });
    });
    root.querySelectorAll("[data-setup-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.setupAct;
        if (act === "back") {
          if (step === "apps") goName();
          else {
            step = "lang";
            render();
          }
        }
        if (act === "skip") goApps(true);
        if (act === "continue") goApps(false);
        if (act === "finish") finish();
      });
    });
    const input = root.querySelector("#os-setup-name");
    if (input) {
      input.addEventListener("input", () => {
        name = input.value;
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          goApps(false);
        }
      });
    }
  }

  function show() {
    document.documentElement.dataset.setup = "1";
    const root = rootEl();
    if (root) {
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
    }
    render();
  }

  function hide() {
    delete document.documentElement.dataset.setup;
    const root = rootEl();
    if (root) {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = "";
    }
  }

  function run() {
    step = "lang";
    const saved = window.OS && window.OS.lang;
    lang = ["en", "pt", "ja"].includes(saved) ? saved : guessLang();
    applyLang(lang);
    name = "";
    pack = "recommended";
    show();
    return new Promise((resolve) => {
      resolveDone = resolve;
    });
  }

  return { run };
})();
