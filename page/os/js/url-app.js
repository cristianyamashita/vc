window.OSUrlApp = (function () {
  const ICON_REL = /(^|\s)(icon|shortcut|apple-touch-icon|apple-touch-icon-precomposed|mask-icon|fluid-icon)(\s|$)/;
  const FALLBACK_ICONS = [
    { path: "favicon.svg", type: "image/svg+xml" },
    { path: "icon.svg", type: "image/svg+xml" },
    { path: "apple-touch-icon.png", type: "image/png" },
    { path: "favicon.png", type: "image/png" },
    { path: "favicon.ico", type: "image/x-icon" },
  ];
  const MAX_ICON_BYTES = 512 * 1024;

  function pagesUrl(owner, repo, sub) {
    const host = String(owner).toLowerCase() + ".github.io";
    const isUserSite = String(repo).toLowerCase() === host;
    let path = isUserSite ? "/" : "/" + repo + "/";
    const rest = String(sub || "").replace(/^\/+/, "");
    if (rest) path += /\.[a-z0-9]+$/i.test(rest) ? rest : rest.replace(/\/*$/, "/");
    return "https://" + host + path;
  }

  // A hostname is either a dotted name, an IPv6 literal, or plain localhost.
  // Without this `new URL()` happily accepts "not a url" as a host.
  function isHostname(host) {
    const name = String(host || "").toLowerCase();
    if (!name || /[^a-z0-9.:_\-\[\]]/.test(name)) return false;
    if (name === "localhost" || name === "[::1]") return true;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(name);
  }

  // Accepts a bare host, a GitHub Pages link, or a github.com repo/tree/blob URL
  // (converted to its GitHub Pages address, which is what can be framed).
  function normalize(raw) {
    let text = String(raw || "").trim();
    if (!text) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
      const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(text);
      text = (local ? "http://" : "https://") + text;
    }
    let url;
    try {
      url = new URL(text);
    } catch (_err) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!isHostname(url.hostname)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "github.com" && parts.length >= 2) {
      const sub = parts[2] === "tree" || parts[2] === "blob" ? parts.slice(4).join("/") : "";
      return { url: pagesUrl(parts[0], parts[1], sub), original: url.href, converted: true };
    }
    if (host === "raw.githubusercontent.com" && parts.length >= 4) {
      return {
        url: pagesUrl(parts[0], parts[1], parts.slice(3).join("/")),
        original: url.href,
        converted: true,
      };
    }
    return { url: url.href, original: url.href, converted: false };
  }

  function absolute(href, base) {
    try {
      return new URL(String(href).trim(), base).href;
    } catch (_err) {
      return "";
    }
  }

  function iconScore(candidate) {
    const href = candidate.href.toLowerCase();
    const svg = candidate.type === "image/svg+xml" || /\.svg($|[?#])/.test(href);
    let score = svg ? 120 : 0;
    if (/apple-touch-icon/.test(candidate.rel)) score += 45;
    else if (/\.png($|[?#])/.test(href)) score += 30;
    else if (/\.ico($|[?#])/.test(href)) score += 12;
    if (candidate.rel === "og:image") score += 4;
    if (candidate.guessed) score -= 60;
    const size = parseInt(String(candidate.sizes || "").split(/[x×]/)[0], 10);
    if (size) score += Math.min(size, 512) / 64;
    return score;
  }

  function iconCandidates(doc, base) {
    const seen = new Set();
    const list = [];
    const add = (href, rel, type, sizes, guessed) => {
      const abs = absolute(href, base);
      if (!abs || seen.has(abs)) return;
      seen.add(abs);
      list.push({ href: abs, rel: rel || "", type: (type || "").toLowerCase(), sizes: sizes || "", guessed: !!guessed });
    };
    if (doc) {
      doc.querySelectorAll("link[rel][href]").forEach((link) => {
        const rel = (link.getAttribute("rel") || "").toLowerCase();
        if (!ICON_REL.test(rel)) return;
        add(link.getAttribute("href"), rel, link.getAttribute("type"), link.getAttribute("sizes"), false);
      });
      const og = doc.querySelector('meta[property="og:image"], meta[name="og:image"]');
      if (og && og.getAttribute("content")) add(og.getAttribute("content"), "og:image", "", "", false);
    }
    FALLBACK_ICONS.forEach((row) => add(row.path, "guessed", row.type, "", true));
    return list.sort((a, b) => iconScore(b) - iconScore(a));
  }

  // Used when the page itself cannot be read (no CORS): probe the usual icon
  // filenames next to the page and at the site root with plain <img> loads.
  function guessIcons(url) {
    const seen = new Set();
    const list = [];
    let base;
    try {
      base = new URL(url);
    } catch (_err) {
      return list;
    }
    const roots = [base.href, base.origin + "/"];
    roots.forEach((root) => {
      FALLBACK_ICONS.forEach((row) => {
        const abs = absolute(row.path, root);
        if (!abs || seen.has(abs)) return;
        seen.add(abs);
        list.push({ href: abs, rel: "guessed", type: row.type, sizes: "", guessed: true });
      });
    });
    return list.sort((a, b) => iconScore(b) - iconScore(a));
  }

  function metaText(doc, selector) {
    const el = doc && doc.querySelector(selector);
    const value = el ? el.getAttribute("content") : "";
    return String(value || "").trim();
  }

  function titleFromUrl(url) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const last = parts.filter((part) => !/^index\.html?$/i.test(part)).pop();
      const base = last ? last.replace(/\.[a-z0-9]+$/i, "") : parsed.hostname.split(".")[0];
      return base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || parsed.hostname;
    } catch (_err) {
      return "";
    }
  }

  // Reads the page cross-origin. GitHub Pages sends `access-control-allow-origin: *`,
  // so this works there; hosts without CORS throw and the caller falls back to a
  // gallery icon and a name typed by hand.
  async function inspect(url) {
    const res = await fetch(url, { credentials: "omit", redirect: "follow" });
    if (!res.ok) throw new Error("http-" + res.status);
    const finalUrl = res.url || url;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title =
      metaText(doc, 'meta[property="og:site_name"]') ||
      String((doc.querySelector("title") || {}).textContent || "").trim() ||
      metaText(doc, 'meta[property="og:title"]') ||
      titleFromUrl(finalUrl);
    const desc =
      metaText(doc, 'meta[name="description"]') || metaText(doc, 'meta[property="og:description"]');
    return { url: finalUrl, title, desc, icons: iconCandidates(doc, finalUrl) };
  }

  function loadsAsImage(href) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      img.onload = () => finish(img.naturalWidth > 0 || /\.svg($|[?#])/i.test(href));
      img.onerror = () => finish(false);
      setTimeout(() => finish(false), 6000);
      img.src = href;
    });
  }

  // Prefers an inlined blob (so the icon survives offline); falls back to the remote
  // URL when the host blocks cross-origin reads but still serves the image to <img>.
  async function fetchIcon(href) {
    try {
      const res = await fetch(href, { credentials: "omit", redirect: "follow" });
      if (res.ok) {
        const blob = await res.blob();
        const type = (blob.type || "").toLowerCase();
        const looksImage = type.startsWith("image/") || /\.(svg|png|ico|jpe?g|webp|gif)($|[?#])/i.test(href);
        if (blob.size > 0 && blob.size <= MAX_ICON_BYTES && looksImage) {
          return { iconType: "blob", iconBlob: blob, iconUrl: href, preview: URL.createObjectURL(blob) };
        }
      }
    } catch (_err) {
      /* falls through to the <img> probe below */
    }
    if (await loadsAsImage(href)) return { iconType: "url", iconBlob: null, iconUrl: href, preview: href };
    return null;
  }

  async function firstIcon(candidates, limit) {
    const list = (candidates || []).slice(0, limit || 6);
    for (let i = 0; i < list.length; i += 1) {
      const icon = await fetchIcon(list[i].href);
      if (icon) return icon;
    }
    return null;
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return "user-" + crypto.randomUUID();
    return "user-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function sameUrl(a, b) {
    const clean = (value) => String(value || "").replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
    return clean(a) === clean(b);
  }

  return { normalize, inspect, guessIcons, fetchIcon, firstIcon, newId, sameUrl, titleFromUrl };
})();
