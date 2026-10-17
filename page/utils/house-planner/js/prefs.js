// Browser-local preferences (not part of a project).
const KEY = "housePlanner.prefs.v1";

const DEFAULTS = {
  lang: "en",
  theme: "light",
  snap: true,
  tab: "floors",
  lastProjectId: null,
  brush: { radius: 200, strength: 10 },
  catalogCategory: "all",
};

export const prefs = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out = { ...DEFAULTS, ...raw, brush: { ...DEFAULTS.brush, ...(raw.brush || {}) } };
    if (!["en", "pt", "ja"].includes(out.lang)) {
      const nav = (navigator.language || "en").slice(0, 2);
      out.lang = ["en", "pt", "ja"].includes(nav) ? nav : "en";
    }
    if (!["light", "dark"].includes(out.theme))
      out.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be unavailable */
  }
}
