window.OSEmbed = (function () {
  const STYLE_ID = "os-embed-style";
  const CONTROL_SELECTORS = [
    "#lang-switcher",
    "#theme-switcher",
    "#lang-selector",
    "#theme-toggle-btn",
    "#theme-toggle",
    "#themeButton",
    "#themeBtn",
    "#langBtn",
    "#langSel",
    "#btnTheme",
    "#themeSelect",
    "#langSelect",
    "#themeChip",
    "#langGroup",
    "#themeGroup",
    "select#language",
    "select#lang",
    "select#theme",
    ".lang-selector",
  ];
  const HEADER_SELECTORS = "nav, header, .navbar, .top, .topbar, .app-header, .page-header";

  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html, body {
        height: 100% !important;
        min-height: 100% !important;
        margin: 0 !important;
        max-width: none !important;
      }
      body {
        padding: 0 !important;
      }
      body > .container,
      body > .container-fluid {
        max-width: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        flex: 1 1 auto !important;
      }
      body > .container > .row,
      body > .container-fluid > .row {
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      body > .container > .row > [class*="col-"],
      body > .container-fluid > .row > [class*="col-"] {
        flex: 0 0 100% !important;
        max-width: 100% !important;
        width: 100% !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .os-embed-hide {
        display: none !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  function looksLikeLangOrTheme(el) {
    if (!el || el.nodeType !== 1) return false;
    const id = (el.id || "").toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const title = (el.getAttribute("title") || "").toLowerCase();
    const cls = (el.className && typeof el.className === "string" ? el.className : "").toLowerCase();
    const blob = `${id} ${aria} ${title} ${cls}`;
    if (/(^|[\s_-])(lang|language|idioma|theme|tema)([\s_-]|$)/.test(blob)) return true;
    if (el.tagName === "SELECT") {
      const opts = Array.from(el.options || []).map((opt) => `${opt.value} ${opt.textContent}`.toLowerCase());
      const langish = opts.filter((opt) => /\b(en|pt|ja|english|portugu|日本語|idioma)\b/.test(opt)).length >= 2;
      const themeish = opts.filter((opt) => /\b(dark|light|escuro|claro|dark mode|light mode)\b/.test(opt)).length >= 2;
      if ((langish || themeish) && opts.length <= 8) return true;
    }
    return false;
  }

  function collectControls(doc) {
    const found = new Set();
    CONTROL_SELECTORS.forEach((sel) => {
      try {
        doc.querySelectorAll(sel).forEach((el) => found.add(el));
      } catch (err) {
        /* ignore invalid selector */
      }
    });
    doc.querySelectorAll("select, button").forEach((el) => {
      if (looksLikeLangOrTheme(el)) found.add(el);
    });
    return Array.from(found);
  }

  function isUsefulControl(el) {
    if (!el || el.classList.contains("os-embed-hide")) return false;
    const tag = el.tagName;
    if (!["BUTTON", "SELECT", "INPUT", "TEXTAREA", "A"].includes(tag)) return false;
    if (tag === "A" && (el.classList.contains("navbar-brand") || el.getAttribute("href") === "#")) return false;
    if (el.closest(".os-embed-hide")) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function hideChrome(doc) {
    const controls = collectControls(doc);
    controls.forEach((el) => {
      const group = el.closest("#langGroup, #themeGroup, .lang-selector");
      (group || el).classList.add("os-embed-hide");
    });
    doc.querySelectorAll(HEADER_SELECTORS).forEach((header) => {
      const remaining = header.querySelectorAll("button, select, input, textarea, a");
      const useful = Array.from(remaining).filter(isUsefulControl);
      if (!useful.length) header.classList.add("os-embed-hide");
    });
  }

  function adapt(iframe) {
    let doc;
    try {
      doc = iframe.contentDocument;
    } catch (err) {
      return;
    }
    if (!doc || !doc.documentElement) return;
    doc.documentElement.dataset.osEmbed = "1";
    injectStyle(doc);
    hideChrome(doc);
  }

  function attach(iframe) {
    const run = () => adapt(iframe);
    iframe.addEventListener("load", run);
    if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
      run();
    }
  }

  return { attach, adapt };
})();
