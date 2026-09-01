import { AIR, WATER, WATER_SPRING, isPlant, isFruitHang, isSolid } from './blocks.js';

const RANGE = 5;
const Y_UP = 1;
const FILL_SEC = 0.07;
const MAX_PER_TICK = 28;
const MAX_WAIT = 8000;
const RANGE2 = RANGE * RANGE;

const NEIGH = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function canFill(id) {
  return id === AIR || isPlant(id) || isFruitHang(id);
}

function isFallingWater(world, x, y, z) {
  if (world.get(x, y, z) !== WATER) return false;
  const packed = world.waterMeta?.[keyOf(x, y, z)];
  return packed != null && packed >= 16;
}

function hasFloor(world, x, y, z) {
  if (y <= 0) return false;
  const below = world.get(x, y - 1, z);
  if (below === WATER_SPRING || isSolid(below)) return true;
  if (below === WATER && !isFallingWater(world, x, y - 1, z)) return true;
  return false;
}

function chunkLoaded(world, x, z) {
  return world.chunks.has(world.chunkKey(x >> 4, z >> 4));
}

function inRange(s, x, y, z) {
  if (y < s.y || y > s.y + Y_UP) return false;
  if (x === s.x && y === s.y && z === s.z) return false;
  const dx = x - s.x;
  const dz = z - s.z;
  return dx * dx + dz * dz <= RANGE2;
}

function waitCount(s) {
  return s.waitN || 0;
}

function enqueue(s, x, y, z, sec) {
  if (!inRange(s, x, y, z)) return;
  if (s.seen?.[keyOf(x, y, z)]) return;
  if (!s.wait) s.wait = {};
  const k = keyOf(x, y, z);
  const cur = s.wait[k];
  if (cur == null && waitCount(s) >= MAX_WAIT) return;
  if (cur == null) s.waitN = waitCount(s) + 1;
  if (cur == null || sec < cur) s.wait[k] = sec;
}

function seed(s) {
  for (const [dx, dy, dz] of NEIGH) {
    enqueue(s, s.x + dx, s.y + dy, s.z + dz, FILL_SEC);
  }
}

function addSpring(world, x, y, z) {
  if (!world.springs) world.springs = {};
  const k = keyOf(x, y, z);
  if (world.springs[k]) return;
  const s = { x, y, z, wait: {}, seen: {}, waitN: 0 };
  world.springs[k] = s;
  seed(s);
}

function removeSpring(world, x, y, z) {
  if (!world.springs) return;
  delete world.springs[keyOf(x, y, z)];
}

function spread(s, x, y, z) {
  for (const [dx, dy, dz] of NEIGH) {
    enqueue(s, x + dx, y + dy, z + dz, FILL_SEC);
  }
}

function stepCell(world, s, x, y, z) {
  if (!inRange(s, x, y, z)) return false;
  if (!chunkLoaded(world, x, z)) {
    enqueue(s, x, y, z, 0.4);
    return false;
  }
  const k = keyOf(x, y, z);
  const id = world.get(x, y, z);
  if (!hasFloor(world, x, y, z)) return false;
  if (id === WATER) {
    if (world.waterMeta?.[k] != null) delete world.waterMeta[k];
    if (!s.seen) s.seen = {};
    s.seen[k] = 1;
    spread(s, x, y, z);
    return false;
  }
  if (!canFill(id)) return false;
  world.set(x, y, z, WATER);
  if (!s.seen) s.seen = {};
  s.seen[k] = 1;
  spread(s, x, y, z);
  return true;
}

function tickOne(world, s, dt) {
  const wait = s.wait;
  if (!wait) return false;
  const due = [];
  for (const [k, sec] of Object.entries(wait)) {
    const next = sec - dt;
    if (next <= 0) due.push(k);
    else wait[k] = next;
  }
  if (!due.length) return false;

  let changed = false;
  let n = 0;
  for (const k of due) {
    if (n >= MAX_PER_TICK) break;
    if (wait[k] != null) {
      delete wait[k];
      s.waitN = Math.max(0, waitCount(s) - 1);
    }
    const [x, y, z] = k.split(',').map(Number);
    n += 1;
    if (stepCell(world, s, x, y, z)) changed = true;
  }
  return changed;
}

export function onSpringBlockChange(world, x, y, z, prev, id) {
  if (id === WATER_SPRING && prev !== WATER_SPRING) addSpring(world, x, y, z);
  if (prev === WATER_SPRING && id !== WATER_SPRING) removeSpring(world, x, y, z);
  if (!canFill(id) || !world.springs) return;
  const k = keyOf(x, y, z);
  for (const s of Object.values(world.springs)) {
    if (!inRange(s, x, y, z)) continue;
    if (s.seen) delete s.seen[k];
    enqueue(s, x, y, z, FILL_SEC);
  }
}

export function tickSprings(world, dt) {
  if (!world?.springs) return false;
  let changed = false;
  for (const k of Object.keys(world.springs)) {
    const s = world.springs[k];
    if (chunkLoaded(world, s.x, s.z) && world.get(s.x, s.y, s.z) !== WATER_SPRING) {
      delete world.springs[k];
      continue;
    }
    if (tickOne(world, s, dt)) changed = true;
  }
  return changed;
}

export function serializeSprings(springs) {
  const out = {};
  if (!springs) return out;
  for (const k of Object.keys(springs)) out[k] = 1;
  return out;
}

export function loadSprings(world, data, edits) {
  world.springs = {};
  const keys = new Set();
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) keys.add(k);
  }
  if (edits && typeof edits === 'object') {
    for (const [k, id] of Object.entries(edits)) {
      if (id === WATER_SPRING) keys.add(k);
    }
  }
  for (const k of keys) {
    const [x, y, z] = k.split(',').map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    addSpring(world, x, y, z);
  }
}
