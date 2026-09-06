import { ITEMS, STACK_MAX } from './blocks.js';
import { PAINT_N, cellIndex, shadeHex } from './voxmodel.js';
import { OUTFIT_KEYS, outfitSpec } from './outfits.js';

// Player-authored humans ("eggs"). A design is a preset human plus a small
// table of per-region edits: a paint colour and a sculpt (scale + push). The
// edits are applied to the box list `buildParts` already produces, so a custom
// human is the same model pipeline as a stock one and needs no second renderer.

export const EGG_BASE = 1000;
export const EGG_COST = 4;
export const EGG_BUNDLE = 10;
export const MAX_DESIGNS = 24;

/** Selectable body regions. `mirrored` regions sculpt each side in place
 *  instead of dragging the pair apart from the body centre line. `anchorY`
 *  is the edge a vertical scale grows away from: limbs hang from their
 *  joint (`max`), the head and feet grow off the ground (`min`). */
export const REGIONS = [
  { key: 'head', labelKey: 'regionHead', mirrored: false, anchorY: 'min' },
  { key: 'hair', labelKey: 'regionHair', mirrored: false, anchorY: 'min' },
  { key: 'eyes', labelKey: 'regionEyes', mirrored: true, anchorY: 'center' },
  { key: 'face', labelKey: 'regionFace', mirrored: false, anchorY: 'center' },
  { key: 'torso', labelKey: 'regionTorso', mirrored: false, anchorY: 'center' },
  { key: 'belly', labelKey: 'regionBelly', mirrored: false, anchorY: 'center' },
  { key: 'arms', labelKey: 'regionArms', mirrored: true, anchorY: 'max' },
  { key: 'hands', labelKey: 'regionHands', mirrored: true, anchorY: 'max' },
  { key: 'legs', labelKey: 'regionLegs', mirrored: true, anchorY: 'max' },
  { key: 'feet', labelKey: 'regionFeet', mirrored: true, anchorY: 'min' },
];

export const REGION_KEYS = REGIONS.map((r) => r.key);
const REGION_BY_KEY = new Map(REGIONS.map((r) => [r.key, r]));

export const MAX_SPRAY = 4000;
const SPRAY_KEY = /^[A-Za-z0-9_]{1,24}\|[0-5]\|[0-9]{1,2},[0-9]{1,2}$/;
const PID_KEY = /^[A-Za-z0-9_]{1,24}$/;

/** Address of one sprayable cell: a box's stable id, a face, and a grid cell. */
export function sprayKey(pid, face, gx, gy) {
  return `${pid}|${face}|${gx},${gy}`;
}

export const SCALE_MIN = 0.4;
export const SCALE_MAX = 2.2;
export const PUSH_MIN = -0.3;
export const PUSH_MAX = 0.3;

/** The six starting humans: three men, three women. */
export const PRESETS = [
  {
    key: 'm1', base: 'man', nameKey: 'presetMan1', wear: 0x2a5caa,
    look: { hair: 0x2a1810, eyeS: 1.0, noseS: 1.0, beard: false },
  },
  {
    key: 'm2', base: 'man', nameKey: 'presetMan2', wear: 0x1e5a32,
    look: { hair: 0xc8b060, eyeS: 0.9, noseS: 1.12, beard: true },
  },
  {
    key: 'm3', base: 'man', nameKey: 'presetMan3', wear: 0x6b3e22,
    look: { hair: 0xa83818, eyeS: 1.12, noseS: 0.85, beard: false },
  },
  {
    key: 'w1', base: 'woman', nameKey: 'presetWoman1', wear: 0xc62828,
    look: { hair: 0x1c1210, eyeS: 1.05, noseS: 0.9, longHair: true, lip: 0xc04858 },
  },
  {
    key: 'w2', base: 'woman', nameKey: 'presetWoman2', wear: 0xe85a9a,
    look: { hair: 0xdbc478, eyeS: 0.95, noseS: 1.0, longHair: false, lip: 0xe07888 },
  },
  {
    key: 'w3', base: 'woman', nameKey: 'presetWoman3', wear: 0xe8c220,
    look: { hair: 0xc44a22, eyeS: 1.15, noseS: 0.85, longHair: true, lip: 0x9a2436 },
  },
];

export function presetAt(i) {
  return PRESETS[((i % PRESETS.length) + PRESETS.length) % PRESETS.length];
}

export function defaultEdit() {
  return { color: null, sx: 1, sy: 1, sz: 1, ox: 0, oy: 0, oz: 0 };
}

export function isEditIdentity(e) {
  if (!e) return true;
  return e.color == null && e.sx === 1 && e.sy === 1 && e.sz === 1
    && e.ox === 0 && e.oy === 0 && e.oz === 0;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function sanitiseEdit(raw) {
  const e = defaultEdit();
  if (!raw || typeof raw !== 'object') return e;
  if (Number.isFinite(raw.color)) e.color = raw.color & 0xffffff;
  e.sx = clamp(Number(raw.sx) || 1, SCALE_MIN, SCALE_MAX);
  e.sy = clamp(Number(raw.sy) || 1, SCALE_MIN, SCALE_MAX);
  e.sz = clamp(Number(raw.sz) || 1, SCALE_MIN, SCALE_MAX);
  e.ox = clamp(Number(raw.ox) || 0, PUSH_MIN, PUSH_MAX);
  e.oy = clamp(Number(raw.oy) || 0, PUSH_MIN, PUSH_MAX);
  e.oz = clamp(Number(raw.oz) || 0, PUSH_MIN, PUSH_MAX);
  return e;
}

/** A fresh, unsaved design seeded from preset `i`. */
export function designFromPreset(i, name = '') {
  const preset = presetAt(i);
  return {
    id: '',
    itemId: 0,
    name,
    preset: preset.key,
    base: preset.base,
    outfit: 'default',
    wear: preset.wear,
    look: { ...preset.look },
    edits: {},
    blocks: {},
    spray: {},
  };
}

export function cloneDesign(d) {
  const out = {
    id: d.id || '',
    itemId: d.itemId || 0,
    name: d.name || '',
    preset: d.preset || 'm1',
    base: d.base === 'woman' ? 'woman' : 'man',
    outfit: OUTFIT_KEYS.includes(d.outfit) ? d.outfit : 'default',
    wear: d.wear | 0,
    look: { ...(d.look || {}) },
    edits: {},
    blocks: {},
    spray: { ...(d.spray || {}) },
  };
  for (const key of REGION_KEYS) {
    if (d.edits?.[key]) out.edits[key] = { ...d.edits[key] };
  }
  for (const [pid, e] of Object.entries(d.blocks || {})) out.blocks[pid] = { ...e };
  return out;
}

function normaliseDesign(raw) {
  const preset = PRESETS.find((p) => p.key === raw?.preset) || PRESETS[0];
  const base = raw?.base === 'woman' || raw?.base === 'man' ? raw.base : preset.base;
  const look = { ...preset.look };
  for (const k of ['hair', 'eyeS', 'noseS', 'lip']) {
    if (Number.isFinite(raw?.look?.[k])) look[k] = raw.look[k];
  }
  if (typeof raw?.look?.beard === 'boolean') look.beard = raw.look.beard;
  if (typeof raw?.look?.longHair === 'boolean') look.longHair = raw.look.longHair;
  const edits = {};
  for (const key of REGION_KEYS) {
    if (!raw?.edits?.[key]) continue;
    const e = sanitiseEdit(raw.edits[key]);
    if (!isEditIdentity(e)) edits[key] = e;
  }
  return {
    id: String(raw?.id || newDesignId()),
    itemId: 0,
    name: String(raw?.name || '').slice(0, 24),
    preset: preset.key,
    base,
    outfit: OUTFIT_KEYS.includes(raw?.outfit) ? raw.outfit : 'default',
    wear: Number.isFinite(raw?.wear) ? raw.wear & 0xffffff : preset.wear,
    look,
    edits,
    blocks: sanitiseBlocks(raw?.blocks),
    spray: sanitiseSpray(raw?.spray),
  };
}

/** Per-block sculpts, keyed by a box's stable `pid`. */
function sanitiseBlocks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, value] of Object.entries(raw)) {
    if (!PID_KEY.test(pid)) continue;
    const e = sanitiseEdit(value);
    if (!isEditIdentity(e)) out[pid] = e;
  }
  return out;
}

/** Spray is a flat `pid|face|gx,gy -> colour` table; anything malformed (or
 *  from a future build) is dropped rather than allowed to poison a model. */
function sanitiseSpray(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  let n = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (n >= MAX_SPRAY) break;
    if (!SPRAY_KEY.test(key) || !Number.isFinite(value)) continue;
    out[key] = value & 0xffffff;
    n++;
  }
  return out;
}

export function editFor(design, region) {
  return design.edits?.[region] || defaultEdit();
}

export function blockEditFor(design, pid) {
  return design.blocks?.[pid] || defaultEdit();
}

export function setBlockEdit(design, pid, edit) {
  if (!design.blocks) design.blocks = {};
  const e = sanitiseEdit(edit);
  if (isEditIdentity(e)) delete design.blocks[pid];
  else design.blocks[pid] = e;
}

export function hasBlockEdit(design, pid) {
  return !!design.blocks?.[pid];
}

export function setEdit(design, region, edit) {
  if (!design.edits) design.edits = {};
  const e = sanitiseEdit(edit);
  if (isEditIdentity(e)) delete design.edits[region];
  else design.edits[region] = e;
}

/** Stable key for the geometry cache: must change whenever the model does. */
export function designHash(d) {
  if (!d) return 'none';
  const look = d.look || {};
  const parts = [d.base, d.outfit || 'default', d.wear, look.hair,
    look.eyeS?.toFixed(3), look.noseS?.toFixed(3),
    look.beard ? 1 : 0, look.longHair ? 1 : 0, look.lip ?? ''];
  for (const key of REGION_KEYS) {
    const e = d.edits?.[key];
    if (!e) continue;
    parts.push(`${key}:${e.color ?? 'n'}:${e.sx.toFixed(2)}:${e.sy.toFixed(2)}:${e.sz.toFixed(2)}:${e.ox.toFixed(3)}:${e.oy.toFixed(3)}:${e.oz.toFixed(3)}`);
  }
  const blocks = d.blocks;
  if (blocks) {
    for (const pid of Object.keys(blocks).sort()) {
      const e = blocks[pid];
      parts.push(`b:${pid}:${e.color ?? 'n'}:${e.sx.toFixed(2)}:${e.sy.toFixed(2)}:${e.sz.toFixed(2)}:${e.ox.toFixed(3)}:${e.oy.toFixed(3)}:${e.oz.toFixed(3)}`);
    }
  }
  const spray = d.spray;
  if (spray) {
    // Order-independent so two identical paint jobs share one cached model.
    const keys = Object.keys(spray);
    if (keys.length) {
      keys.sort();
      parts.push(`spray:${keys.length}`);
      for (const k of keys) parts.push(`${k}=${spray[k]}`);
    }
  }
  return parts.join(',');
}

export function outfitOf(design) {
  return design?.outfit && OUTFIT_KEYS.includes(design.outfit) ? design.outfit : 'default';
}

export function setOutfit(design, key) {
  design.outfit = OUTFIT_KEYS.includes(key) ? key : 'default';
}

export function sprayCount(design) {
  return design?.spray ? Object.keys(design.spray).length : 0;
}

/**
 * Hangs each box's sprayed cells off it as a `paint` map, which is what makes
 * `buildVoxGeometry` subdivide that box and colour the individual cells.
 * Cells whose box is not in this outfit are simply skipped, so switching
 * clothes keeps the paint that still has a surface to sit on.
 */
export function applySpray(parts, design) {
  const spray = design?.spray;
  if (!spray) return parts;
  const keys = Object.keys(spray);
  if (!keys.length) return parts;

  const byPid = new Map();
  for (const key of keys) {
    const bar = key.indexOf('|');
    const pid = key.slice(0, bar);
    let cells = byPid.get(pid);
    if (!cells) {
      cells = new Map();
      byPid.set(pid, cells);
    }
    const rest = key.slice(bar + 1);
    const comma = rest.indexOf(',');
    const face = +rest[0];
    const gx = +rest.slice(2, comma);
    const gy = +rest.slice(comma + 1);
    if (gx >= PAINT_N || gy >= PAINT_N) continue;
    cells.set(cellIndex(face, gx, gy), spray[key]);
  }

  return parts.map((b) => {
    const cells = b.pid ? byPid.get(b.pid) : null;
    return cells ? { ...b, paint: cells } : b;
  });
}

function lum(c) {
  return 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
}

/**
 * Rewrites `parts` (from `buildParts`) in place-ish for one design and returns
 * the new list. Paint keeps each box's shade relative to its region's main
 * colour, so a repainted shirt still has its darker collar and seams.
 */
export function applyEdits(parts, design) {
  const edits = design?.edits || {};
  const blocks = design?.blocks || {};
  const active = REGION_KEYS.filter((k) => edits[k] && !isEditIdentity(edits[k]));
  const anyBlocks = Object.keys(blocks).length > 0;
  if (!active.length) return anyBlocks ? applyBlockEdits(parts, blocks) : parts;

  // Per region (and per side, for mirrored ones) the anchor the sculpt works
  // from, measured on the *untouched* model so edits stay independent.
  const groups = new Map();
  const groupOf = (b) => {
    const info = REGION_BY_KEY.get(b.reg);
    return info?.mirrored ? `${b.reg}#${b.z >= 0 ? 'a' : 'b'}` : b.reg;
  };
  for (const b of parts) {
    if (!b.reg || !edits[b.reg]) continue;
    const g = groupOf(b);
    let acc = groups.get(g);
    if (!acc) {
      acc = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity, best: 0, baseLum: 0 };
      groups.set(g, acc);
    }
    acc.minX = Math.min(acc.minX, b.x - b.w / 2);
    acc.maxX = Math.max(acc.maxX, b.x + b.w / 2);
    acc.minY = Math.min(acc.minY, b.y - b.h / 2);
    acc.maxY = Math.max(acc.maxY, b.y + b.h / 2);
    acc.minZ = Math.min(acc.minZ, b.z - b.d / 2);
    acc.maxZ = Math.max(acc.maxZ, b.z + b.d / 2);
    const vol = b.w * b.h * b.d;
    if (vol > acc.best) {
      acc.best = vol;
      acc.baseLum = lum(b.color) || 1;
    }
  }

  const out = [];
  for (const src of parts) {
    const e = src.reg ? edits[src.reg] : null;
    if (!e) {
      out.push(src);
      continue;
    }
    const info = REGION_BY_KEY.get(src.reg);
    const g = groups.get(groupOf(src));
    const b = { ...src };
    const ax = (g.minX + g.maxX) / 2;
    const az = info?.mirrored ? (g.minZ + g.maxZ) / 2 : (g.minZ + g.maxZ) / 2;
    const ay = info?.anchorY === 'min' ? g.minY : info?.anchorY === 'max' ? g.maxY : (g.minY + g.maxY) / 2;
    const zs = info?.mirrored ? (src.z >= 0 ? 1 : -1) : 1;

    b.w = src.w * e.sx;
    b.h = src.h * e.sy;
    b.d = src.d * e.sz;
    b.x = ax + (src.x - ax) * e.sx + e.ox;
    b.y = ay + (src.y - ay) * e.sy + e.oy;
    b.z = az + (src.z - az) * e.sz + e.oz * zs;
    if (src.joint) {
      b.joint = {
        x: ax + (src.joint.x - ax) * e.sx + e.ox,
        y: ay + (src.joint.y - ay) * e.sy + e.oy,
        z: az + (src.joint.z - az) * e.sz + e.oz * zs,
      };
    }
    if (e.color != null) {
      const f = clamp((lum(src.color) || 1) / (g.baseLum || 1), 0.15, 1.6);
      b.color = shadeHex(e.color, f);
    }
    out.push(b);
  }
  return anyBlocks ? applyBlockEdits(out, blocks) : out;
}

/**
 * The fine pass: one box at a time, scaled and pushed about its own centre so
 * a single ear or shoe can be tuned without moving the part around it. Limb
 * joints are deliberately left alone — the pivot belongs to the whole limb,
 * not to whichever box the player happens to be nudging.
 */
function applyBlockEdits(parts, blocks) {
  return parts.map((src) => {
    const e = src.pid ? blocks[src.pid] : null;
    if (!e) return src;
    const b = { ...src };
    b.w = src.w * e.sx;
    b.h = src.h * e.sy;
    b.d = src.d * e.sz;
    b.x = src.x + e.ox;
    b.y = src.y + e.oy;
    b.z = src.z + e.oz;
    if (e.color != null) b.color = e.color;
    return b;
  });
}

// ---------------------------------------------------------------- registry

let designs = [];
let nextItemId = EGG_BASE;

export function newDesignId() {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function registerItem(d) {
  if (!d.itemId) d.itemId = nextItemId++;
  else nextItemId = Math.max(nextItemId, d.itemId + 1);
  ITEMS[d.itemId] = {
    nameKey: d.name || 'itemEgg',
    stack: STACK_MAX,
    place: 0,
    icon: 'egg',
    egg: d.id,
  };
  return d.itemId;
}

function unregisterItem(d) {
  if (d?.itemId) delete ITEMS[d.itemId];
}

export function listDesigns() {
  return designs;
}

export function hasDesigns() {
  return designs.length > 0;
}

export function getDesign(id) {
  return designs.find((d) => d.id === id) || null;
}

export function isEggItem(id) {
  return !!ITEMS[id]?.egg;
}

export function designForItem(itemId) {
  const key = ITEMS[itemId]?.egg;
  return key ? getDesign(key) : null;
}

/** Picks a saved design, so world spawns draw from the player's own humans. */
export function randomDesign(rnd = Math.random) {
  if (!designs.length) return null;
  return designs[Math.min(designs.length - 1, Math.floor(rnd() * designs.length))];
}

export function saveDesign(draft) {
  const d = cloneDesign(draft);
  const existing = d.id ? getDesign(d.id) : null;
  if (existing) {
    d.itemId = existing.itemId;
    Object.assign(existing, d);
    unregisterItem(existing);
    existing.itemId = d.itemId;
    registerItem(existing);
    return existing;
  }
  if (designs.length >= MAX_DESIGNS) return null;
  d.id = newDesignId();
  d.itemId = 0;
  registerItem(d);
  designs.push(d);
  return d;
}

export function duplicateDesign(id) {
  const src = getDesign(id);
  if (!src || designs.length >= MAX_DESIGNS) return null;
  const copy = cloneDesign(src);
  copy.id = newDesignId();
  copy.itemId = 0;
  registerItem(copy);
  designs.push(copy);
  return copy;
}

export function deleteDesign(id) {
  const i = designs.findIndex((d) => d.id === id);
  if (i < 0) return false;
  unregisterItem(designs[i]);
  designs.splice(i, 1);
  return true;
}

export function serializeDesigns() {
  return designs.map((d) => ({
    id: d.id,
    name: d.name,
    preset: d.preset,
    base: d.base,
    outfit: d.outfit || 'default',
    wear: d.wear,
    look: { ...d.look },
    edits: JSON.parse(JSON.stringify(d.edits || {})),
    blocks: JSON.parse(JSON.stringify(d.blocks || {})),
    spray: { ...(d.spray || {}) },
  }));
}

export function loadDesigns(list) {
  for (const d of designs) unregisterItem(d);
  designs = [];
  nextItemId = EGG_BASE;
  if (!Array.isArray(list)) return designs;
  for (const raw of list.slice(0, MAX_DESIGNS)) {
    const d = normaliseDesign(raw);
    registerItem(d);
    designs.push(d);
  }
  return designs;
}
