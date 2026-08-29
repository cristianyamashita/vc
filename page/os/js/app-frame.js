window.OSAppFrame = (function () {
  function hosted() {
    try {
      return !!(window.parent && window.parent !== window && window.parent.OS);
    } catch (_err) {
      return false;
    }
  }

  function host() {
    return hosted() ? window.parent : null;
  }

  function t(key, fallback) {
    const h = host();
    if (h && h.OSI18n) return h.OSI18n.t(key);
    return fallback || key;
  }

  function sync() {
    const h = host();
    const theme = (h && h.OS && h.OS.theme) || localStorage.getItem("app_theme") || "dark";
    const lang = (h && h.OS && h.OS.lang) || localStorage.getItem("app_lang") || "en";
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
    document.documentElement.lang = lang === "pt" ? "pt" : lang === "ja" ? "ja" : "en";
    if (h && h.document && h.document.documentElement) {
      const src = h.document.documentElement;
      const styles = h.getComputedStyle(src);
      const pct = src.style.getPropertyValue("--glass-pct") || styles.getPropertyValue("--glass-pct") || "86%";
      const blur = src.style.getPropertyValue("--glass-blur") || styles.getPropertyValue("--glass-blur") || "20px";
      const alpha = src.style.getPropertyValue("--glass-alpha") || styles.getPropertyValue("--glass-alpha") || "0.86";
      document.documentElement.style.setProperty("--glass-pct", pct.trim());
      document.documentElement.style.setProperty("--glass-blur", blur.trim());
      document.documentElement.style.setProperty("--glass-alpha", alpha.trim());
      document.documentElement.dataset.glass = src.dataset.glass || "acrylic";
      document.documentElement.style.background = "transparent";
    }
    applyI18n();
    return { theme, lang, host: h };
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"), el.textContent);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const text = t(el.getAttribute("data-i18n-title"), el.getAttribute("title") || el.getAttribute("aria-label"));
      el.setAttribute("title", text);
      if (!el.matches("label")) el.setAttribute("aria-label", text);
    });
  }

  function onMessage(fn) {
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === "os-host-sync") sync();
      if (fn) fn(e.data);
    });
  }

  return { hosted, host, t, sync, applyI18n, onMessage };
})();
