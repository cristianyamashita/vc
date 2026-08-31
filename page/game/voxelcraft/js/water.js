import { AIR, WATER, isPlant, isFruitHang } from './blocks.js';

const FALL_SEC = 0.1;
const SPREAD_SEC = 0.26;
const DRY_SEC = 0.18;
const MAX_PER_TICK = 28;
const MAX_QUEUE = 4000;
const SOURCE = 8;

const SIDES = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const NEIGH = [
  [0, 0, 0],
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

function chunkLoaded(world, x, z) {
  return world.chunks.has(world.chunkKey(x >> 4, z >> 4));
}

function readCell(world, x, y, z) {
  if (world.get(x, y, z) !== WATER) return null;
  const packed = world.waterMeta?.[keyOf(x, y, z)];
  if (packed == null) return { l: SOURCE, f: false, source: true };
  const fall = packed >= 16;
  const l = fall ? packed - 16 : packed;
  return { l, f: fall, source: false };
}

function writeMeta(world, x, y, z, cell) {
  if (!world.waterMeta) world.waterMeta = {};
  const k = keyOf(x, y, z);
  if (!cell || cell.source) delete world.waterMeta[k];
  else world.waterMeta[k] = cell.l + (cell.f ? 16 : 0);
}

function sameCell(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.source && b.source) return true;
  if (a.source !== b.source) return false;
  return a.l === b.l && a.f === b.f;
}

function desiredCell(world, x, y, z) {
  const cur = readCell(world, x, y, z);
  if (cur?.source) return cur;

  const here = world.get(x, y, z);
  if (here !== WATER && !canFill(here)) return null;

  const above = readCell(world, x, y + 1, z);
  if (above) {
    const fallLevel = above.source ? SOURCE : above.l;
    if (y > 0) {
      const below = world.get(x, y - 1, z);
      if (canFill(below) || below === WATER) {
        return { l: fallLevel, f: true, source: false };
      }
    }
    const landed = above.source ? 7 : Math.max(1, Math.min(7, above.l));
    return { l: landed, f: false, source: false };
  }

  let best = 0;
  for (const [dx, , dz] of SIDES) {
    const n = readCell(world, x + dx, y, z + dz);
    if (!n || n.f) continue;
    const spread = n.source ? 7 : n.l - 1;
    if (spread > best) best = spread;
  }
  if (best <= 0) return null;
  return { l: best, f: false, source: false };
}

function delayFor(world, x, y, z, want, cur) {
  if (cur && !want) return DRY_SEC;
  if (want?.f) return FALL_SEC;
  if (world.get(x, y + 1, z) === WATER) return FALL_SEC;
  return SPREAD_SEC;
}

function mightNeedWater(world, x, y, z) {
  if (!world.inBounds(x, y, z)) return false;
  const id = world.get(x, y, z);
  if (id === WATER) return true;
  if (!canFill(id)) return false;
  if (world.get(x, y + 1, z) === WATER) return true;
  for (const [dx, , dz] of SIDES) {
    if (world.get(x + dx, y, z + dz) === WATER) return true;
  }
  return false;
}

function enqueue(world, x, y, z, sec) {
  if (!world.inBounds(x, y, z)) return;
  if (!world.waterWait) world.waterWait = {};
  const k = keyOf(x, y, z);
  const cur = world.waterWait[k];
  if (cur == null && Object.keys(world.waterWait).length >= MAX_QUEUE) return;
  if (cur == null || sec < cur) world.waterWait[k] = sec;
}

function enqueueAround(world, x, y, z) {
  for (const [dx, dy, dz] of NEIGH) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    if (!mightNeedWater(world, nx, ny, nz)) continue;
    enqueue(world, nx, ny, nz, delayFor(world, nx, ny, nz, null, null));
  }
}

function applyCell(world, x, y, z, want) {
  const cur = readCell(world, x, y, z);
  if (sameCell(cur, want)) return false;

  if (!want) {
    if (!cur || cur.source) return false;
    delete world.waterMeta[keyOf(x, y, z)];
    world.set(x, y, z, AIR);
    return true;
  }

  const wasWater = world.get(x, y, z) === WATER;
  if (!wasWater) world.set(x, y, z, WATER);
  writeMeta(world, x, y, z, want);
  if (wasWater) enqueueAround(world, x, y, z);
  return !wasWater;
}

function stepCell(world, x, y, z) {
  if (!chunkLoaded(world, x, z)) {
    enqueue(world, x, y, z, 0.25);
    return false;
  }
  return applyCell(world, x, y, z, desiredCell(world, x, y, z));
}

export function onWaterBlockChange(world, x, y, z, prev, id) {
  if (prev === WATER && id !== WATER && world.waterMeta) {
    delete world.waterMeta[keyOf(x, y, z)];
  }
  if (prev === id) return;
  enqueueAround(world, x, y, z);
}

export function tickWater(world, dt) {
  const wait = world?.waterWait;
  if (!wait) return false;
  const keys = Object.keys(wait);
  if (!keys.length) return false;

  const due = [];
  for (const k of keys) {
    wait[k] -= dt;
    if (wait[k] <= 0) due.push(k);
  }
  if (!due.length) return false;

  let changed = false;
  let n = 0;
  for (const k of due) {
    if (n >= MAX_PER_TICK) break;
    delete wait[k];
    const [x, y, z] = k.split(',').map(Number);
    n += 1;
    if (stepCell(world, x, y, z)) changed = true;
  }
  return changed;
}

export function serializeWaterMeta(map) {
  if (!map) return {};
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

export function loadWaterMeta(data) {
  return serializeWaterMeta(data);
}

export function serializeWaterWait(map) {
  if (!map) return {};
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = Math.max(0, n);
  }
  return out;
}

export function loadWaterWait(data) {
  return serializeWaterWait(data);
}
