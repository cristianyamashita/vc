const STORAGE_KEY = 'app_theme';

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
  document.documentElement.dataset.theme = theme;
  return theme;
}

export function setTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
