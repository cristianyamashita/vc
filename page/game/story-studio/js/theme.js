const STORAGE_KEY = 'app_theme';

let theme = 'dark';
const listeners = new Set();

export function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (_err) { /* private mode */ }
  if (stored === 'light' || stored === 'dark') theme = stored;
  else theme = matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function getTheme() {
  return theme;
}

export function setTheme(next) {
  theme = next === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (_err) { /* session only */ }
  for (const fn of listeners) fn(theme);
  return theme;
}

export function toggleTheme() {
  return setTheme(theme === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
