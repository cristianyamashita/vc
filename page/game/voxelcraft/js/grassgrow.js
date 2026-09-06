import { AIR, DIRT, GRASS, isOpaque, isLiquid } from './blocks.js';

const GROW_SEC = 60;
const JITTER = 12;
const STEP = 1;
const SPREAD = 2;
const SPREAD_Y = 2;
const UNLOADED_WAIT = 8;

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function skyLit(world, x, y, z) {
  for (let ly = y + 1; world.inBounds(x, ly, z); ly++) {
    const id = world.get(x, ly, z);
    if (id === AIR) continue;
    if (isOpaque(id) || isLiquid(id)) return false;
  }
  return true;
}

function canGrow(world, x, y, z) {
  if (world.get(x, y, z) !== DIRT) return false;
  const above = world.get(x, y + 1, z);
  if (above !== AIR && (isOpaque(above) || isLiquid(above))) return false;
  return skyLit(world, x, y, z);
}

function hasGrassNear(world, x, y, z) {
  for (let dy = -SPREAD_Y; dy <= SPREAD_Y; dy++) {
    for (let dz = -SPREAD; dz <= SPREAD; dz++) {
      for (let dx = -SPREAD; dx <= SPREAD; dx++) {
        if (!dx && !dy && !dz) continue;
        if (world.get(x + dx, y + dy, z + dz) === GRASS) return true;
      }
    }
  }
  return false;
}

function queueOne(world, x, y, z) {
  if (!world.inBounds(x, y, z)) return;
  const k = keyOf(x, y, z);
  if (world.grassGrow[k] != null) return;
  if (!canGrow(world, x, y, z)) return;
  world.grassGrow[k] = GROW_SEC + Math.random() * JITTER;
}

function queueAround(world, x, y, z) {
  for (let dy = -SPREAD_Y; dy <= SPREAD_Y; dy++) {
    for (let dz = -SPREAD; dz <= SPREAD; dz++) {
      for (let dx = -SPREAD; dx <= SPREAD; dx++) {
        queueOne(world, x + dx, y + dy, z + dz);
      }
    }
  }
}

export function afterBlockChange(world, x, y, z, prev, id) {
  if (!world.grassGrow) world.grassGrow = {};
  if (prev === DIRT && id !== DIRT) delete world.grassGrow[keyOf(x, y, z)];
  if (id === DIRT) queueOne(world, x, y, z);
  else if (id === GRASS) queueAround(world, x, y, z);
  else if (!isOpaque(id)) queueOne(world, x, y - 1, z);
}

export function tickGrassGrow(world, dt) {
  if (!world?.grassGrow) return false;
  world.grassAcc = (world.grassAcc || 0) + dt;
  if (world.grassAcc < STEP) return false;
  const step = world.grassAcc;
  world.grassAcc = 0;
  const keys = Object.keys(world.grassGrow);
  if (!keys.length) return false;
  let changed = false;
  for (const k of keys) {
    const left = world.grassGrow[k] - step;
    if (left > 0) {
      world.grassGrow[k] = left;
      continue;
    }
    delete world.grassGrow[k];
    const [x, y, z] = k.split(',').map(Number);
    if (!world.chunks.has(world.chunkKey(x >> 4, z >> 4))) {
      world.grassGrow[k] = UNLOADED_WAIT;
      continue;
    }
    if (!canGrow(world, x, y, z)) continue;
    if (!hasGrassNear(world, x, y, z)) continue;
    world.set(x, y, z, GRASS);
    changed = true;
  }
  return changed;
}

export function serializeGrassGrow(map) {
  if (!map) return {};
  const out = {};
  for (const [k, t] of Object.entries(map)) {
    if (t > 0) out[k] = Math.round(t * 10) / 10;
  }
  return out;
}

export function loadGrassGrow(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [k, t] of Object.entries(data)) {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}
