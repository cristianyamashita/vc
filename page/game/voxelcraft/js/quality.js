// Graphics preference, chosen from the pause menu.
//
// 'original' is the game's pre-rework look: the old flat-shaded mob and tool
// shapes, the old drawn inventory icons and the old dropped-item sprites.
// 'standard' is the reworked art with one flat quad per face and no grain.
// 'advanced' adds subdivided faces with per-quad colour grain plus the small
// decorative parts on mobs and held gear.

const STORAGE_KEY = 'voxelcraft_quality';
const LEVELS = ['original', 'standard', 'advanced'];

let level = 'advanced';
const listeners = new Set();

export function getQuality() {
  return level;
}

export function isAdvanced() {
  return level === 'advanced';
}

export function isOriginal() {
  return level === 'original';
}

export function initQuality() {
  const stored = localStorage.getItem(STORAGE_KEY);
  level = LEVELS.includes(stored) ? stored : 'advanced';
  return level;
}

export function setQuality(next) {
  const want = LEVELS.includes(next) ? next : 'advanced';
  if (want === level) return level;
  level = want;
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* private mode: keep the choice for this session only */
  }
  for (const fn of listeners) fn(level);
  return level;
}

export function onQualityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
