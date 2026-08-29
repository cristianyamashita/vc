window.OSIconColor = (function () {
  const DEFAULT_TEAL = "#008f7d";
  const DEFAULT_DARK = "#006056";
  const PRESETS = ["#008f7d", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#0f172a"];
  const svgCache = new Map();

  function parse(value) {
    const cleaned = String(value || "")
      .trim()
      .replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(cleaned)) {
      return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toLowerCase();
    }
    if (/^[0-9a-f]{6}$/i.test(cleaned)) return `#${cleaned.toLowerCase()}`;
    return DEFAULT_TEAL;
  }

  function darken(hex) {
    const color = parse(hex);
    if (color === DEFAULT_TEAL) return DEFAULT_DARK;
    const n = parseInt(color.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * 0.67);
    const g = Math.round(((n >> 8) & 255) * 0.67);
    const b = Math.round((n & 255) * 0.67);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  function current() {
    const fromState = window.OS && window.OS.state && window.OS.state.iconColor;
    return parse(fromState);
  }

  function recolorSvg(svgText, color) {
    return svgText.replace(/#008f7d/gi, color).replace(/#006056/gi, darken(color));
  }

  function catalogUrl(url) {
    const value = String(url || "").split("?")[0];
    if (!/assets\/icons\/svg\//i.test(value)) return "";
    if (value.startsWith("data:")) return "";
    return value;
  }

  async function tintedSrc(url, color) {
    const fileUrl = catalogUrl(url);
    if (!fileUrl) return url;
    if (parse(color) === DEFAULT_TEAL) return fileUrl;
    let svg = svgCache.get(fileUrl);
    if (!svg) {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("missing icon");
      svg = await res.text();
      svgCache.set(fileUrl, svg);
    }
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recolorSvg(svg, parse(color)))}`;
  }

  async function tintImg(img) {
    if (!img || img.tagName !== "IMG") return;
    let original = img.getAttribute("data-icon-src") || "";
    const src = img.getAttribute("src") || "";
    if (!original) {
      original = catalogUrl(src);
      if (!original) return;
      img.setAttribute("data-icon-src", original);
    }
    const color = current();
    if (img.getAttribute("data-icon-tint") === color) return;
    try {
      img.src = await tintedSrc(original, color);
      img.setAttribute("data-icon-tint", color);
    } catch (_err) {
      img.src = original;
    }
  }

  function applyVars() {
    const color = current();
    document.documentElement.style.setProperty("--icon-color", color);
    document.documentElement.style.setProperty("--icon-color-dark", darken(color));
  }

  async function apply(root) {
    applyVars();
    const scope = root || document;
    await Promise.all([...scope.querySelectorAll("img")].map(tintImg));
  }

  function watch() {
    applyVars();
    const obs = new MutationObserver((mutations) => {
      const imgs = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!node || node.nodeType !== 1) return;
          if (node.tagName === "IMG") imgs.push(node);
          else if (node.querySelectorAll) imgs.push(...node.querySelectorAll("img"));
        });
      });
      imgs.forEach(tintImg);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    document.querySelectorAll("img").forEach(tintImg);
  }

  return {
    DEFAULT_TEAL,
    PRESETS,
    parse,
    darken,
    current,
    apply,
    watch,
  };
})();
