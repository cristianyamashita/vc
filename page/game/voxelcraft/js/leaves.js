import { AIR, LOG, LEAVES, FRUIT_HANG } from './blocks.js';

const CANOPY = 2;
const Y_SPAN = 8;

function isLeafy(id) {
  return id === LEAVES || id === FRUIT_HANG;
}

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function columnHasLog(world, x, z, y) {
  const lo = Math.max(0, y - Y_SPAN);
  const hi = y + Y_SPAN;
  for (let ly = lo; ly <= hi; ly++) {
    if (world.get(x, ly, z) === LOG) return true;
  }
  return false;
}

function eachCanopyBlock(x, y, z, fn) {
  for (let dy = -Y_SPAN; dy <= Y_SPAN; dy++) {
    const ly = y + dy;
    if (ly < 0) continue;
    for (let dz = -CANOPY; dz <= CANOPY; dz++) {
      for (let dx = -CANOPY; dx <= CANOPY; dx++) {
        fn(x + dx, ly, z + dz);
      }
    }
  }
}

export function queueLeafDecayAround(world, x, y, z, base = 3, spread = 2.2) {
  if (!world.leafDecay) world.leafDecay = {};
  if (columnHasLog(world, x, z, y)) return;
  eachCanopyBlock(x, y, z, (lx, ly, lz) => {
    if (!isLeafy(world.get(lx, ly, lz))) return;
    const k = keyOf(lx, ly, lz);
    if (world.leafDecay[k] == null) {
      world.leafDecay[k] = base + Math.random() * spread;
    }
  });
}

export function clearSupportedLeafDecay(world, x, y, z) {
  if (!world.leafDecay) return;
  eachCanopyBlock(x, y, z, (lx, ly, lz) => {
    delete world.leafDecay[keyOf(lx, ly, lz)];
  });
}

export function afterBlockChange(world, x, y, z, prev, id) {
  if (prev === LOG && id !== LOG) queueLeafDecayAround(world, x, y, z, 3, 2.2);
  if (id === LOG && prev !== LOG) clearSupportedLeafDecay(world, x, y, z);
  if (isLeafy(prev) && world.leafDecay) delete world.leafDecay[keyOf(x, y, z)];
}

export function tickLeafDecay(world, dt) {
  if (!world?.leafDecay) return false;
  const keys = Object.keys(world.leafDecay);
  if (!keys.length) return false;
  let changed = false;
  for (const k of keys) {
    const left = world.leafDecay[k] - dt;
    if (left > 0) {
      world.leafDecay[k] = left;
      continue;
    }
    delete world.leafDecay[k];
    const [x, y, z] = k.split(',').map(Number);
    const cx = x >> 4;
    const cz = z >> 4;
    if (!world.chunks.has(world.chunkKey(cx, cz))) {
      world.leafDecay[k] = 0.5;
      continue;
    }
    if (!isLeafy(world.get(x, y, z))) continue;
    world.set(x, y, z, AIR);
    changed = true;
  }
  return changed;
}

export function serializeLeafDecay(map) {
  if (!map) return {};
  const out = {};
  for (const [k, t] of Object.entries(map)) {
    if (t > 0) out[k] = t;
  }
  return out;
}

export function loadLeafDecay(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [k, t] of Object.entries(data)) {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}
