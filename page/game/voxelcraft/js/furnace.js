import { RAW_MEAT, COOKED_MEAT, FRUIT, COOKED_FRUIT, COAL, SAND, GLASS, stackMax } from './blocks.js';

export const SMELT_MAP = {
  [RAW_MEAT]: COOKED_MEAT,
  [FRUIT]: COOKED_FRUIT,
  [SAND]: GLASS,
};

export const FUEL_SEC = {
  [COAL]: 32,
};

export const COOK_SEC = 4;

export function emptyFurnace() {
  return { input: null, fuel: null, out: null, cook: 0, burn: 0, burnMax: 0 };
}

export function furnaceKey(x, y, z) {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function cloneStack(s) {
  return s ? { id: s.id, n: s.n, dura: s.dura } : null;
}

function canOutput(slot, id) {
  if (!slot) return true;
  if (slot.id !== id) return false;
  return slot.n < stackMax(id);
}

export function tickFurnace(f, dt) {
  if (!f) return;
  const want = f.input ? SMELT_MAP[f.input.id] : 0;
  const ready = !!want && canOutput(f.out, want);
  if (f.burn <= 0 && ready && f.fuel && FUEL_SEC[f.fuel.id]) {
    f.burnMax = FUEL_SEC[f.fuel.id];
    f.burn = f.burnMax;
    f.fuel.n -= 1;
    if (f.fuel.n <= 0) f.fuel = null;
  }
  if (f.burn > 0) {
    f.burn = Math.max(0, f.burn - dt);
    if (ready) {
      f.cook += dt;
      if (f.cook >= COOK_SEC) {
        f.cook = 0;
        f.input.n -= 1;
        if (f.input.n <= 0) f.input = null;
        if (!f.out) f.out = { id: want, n: 1 };
        else f.out.n += 1;
      }
    } else {
      f.cook = 0;
    }
    if (f.burn <= 0) f.burnMax = 0;
  } else {
    f.cook = 0;
    f.burnMax = 0;
  }
}

export function dropFurnaceStacks(f) {
  const out = [];
  if (!f) return out;
  for (const k of ['input', 'fuel', 'out']) {
    if (f[k]) out.push(cloneStack(f[k]));
  }
  return out;
}

export function serializeFurnaces(map) {
  const out = {};
  if (!map) return out;
  for (const [key, f] of Object.entries(map)) {
    out[key] = {
      input: cloneStack(f.input),
      fuel: cloneStack(f.fuel),
      out: cloneStack(f.out),
      cook: f.cook || 0,
      burn: f.burn || 0,
      burnMax: f.burnMax || 0,
    };
  }
  return out;
}

export function loadFurnaces(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [key, f] of Object.entries(data)) {
    out[key] = {
      ...emptyFurnace(),
      input: cloneStack(f.input),
      fuel: cloneStack(f.fuel),
      out: cloneStack(f.out),
      cook: f.cook || 0,
      burn: f.burn || 0,
      burnMax: f.burnMax || 0,
    };
  }
  return out;
}
