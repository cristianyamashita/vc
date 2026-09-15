import { shadeHex, toHex, cellIndex, paintGridOf, PAINT_N } from '../render/geometry.js';

// The clothing vocabulary, and the book of outfits the app has loaded.
//
// An outfit is not a model: it is a handful of cuts ("trousers, tee, short
// sleeve, sneakers") that the anatomy in body.js reads while it lays out
// boxes. That is what lets one character carry fifteen outfits without
// fifteen models.
//
// The cuts themselves used to be a constant table in this file. They are
// documents now — `data/outfits/*.json`, loaded like every other kind — and
// what stays here is the book they are installed into. The vocabulary below
// is still code because it is what the anatomy can actually draw; which
// combinations exist, what they are called, how far they stand off the body
// and how they are painted belong to the document.

/** The cut fields, and every value the anatomy knows how to draw. */
export const LEGS = ['trousers', 'shorts', 'briefs', 'bare'];
export const TOPS = ['shirt', 'tee', 'jacket', 'dress', 'nightie', 'bikini', 'bra',
  'towel', 'tube', 'croptop', 'fatigues', 'bare'];
export const SLEEVES = ['long', 'short', 'upper', 'none'];
export const FEET = ['shoe', 'sneaker', 'boot', 'dress', 'flat', 'bare'];
export const CUT_FLAGS = ['belt', 'tie', 'cap', 'skirt', 'straps'];

/** How far cloth may stand off the skin, in metres on a 1.76 m frame. */
export const SWELL_RANGE = [-0.02, 0.06];

const DEFAULT_CUT = { legs: 'trousers', top: 'tee', sleeve: 'short', feet: 'sneaker' };

/** Garment colours that are their own thing rather than a shade of the main
 *  one: red trousers under a red shirt read as a jumpsuit, not an outfit. */
const TROUSER = 0x2b323c;
const DENIM = 0x3f6ea8;
const BOOT = 0x2a231a;
const SNEAKER = 0xe8e4da;
const DRESS_SHOE = 0x1c1712;

const SKIN = { man: 0xc8a07a, woman: 0xd4b08a, child: 0xd8b48c };

// ------------------------------------------------------------------- book

/** id -> outfit document. Filled by the registry once the library is read. */
let BOOK = new Map();

/**
 * Installs the loaded outfit documents. Everything that names an outfit by
 * string — a character's wardrobe, the preview's picker, the validator — asks
 * this one book, so an imported outfit dresses every character that names it
 * without a line of code changing.
 */
export function installOutfits(docs) {
  BOOK = docs instanceof Map ? new Map(docs) : new Map(Object.entries(docs || {}));
}

export function outfitDoc(id) {
  return (typeof id === 'string' && BOOK.get(id)) || null;
}

/** Every installed outfit id, in the order the library loaded them. */
export function outfitIds() {
  return [...BOOK.keys()];
}

/**
 * The outfits worth offering for one body plan. Every cut RENDERS on every
 * plan and a document may name any of them — `plans` is what an outfit is
 * suggested for, not what it is allowed on.
 */
export function presetsFor(plan) {
  const out = [];
  for (const [id, doc] of BOOK) {
    if (!doc.plans?.length || doc.plans.includes(plan)) out.push(id);
  }
  return out;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Normalises whatever a document said into a full cut. Accepts an outfit id
 * or an inline object, and silently falls back per field: one unknown cut in
 * an imported character should dress that part oddly, not fail the import.
 */
export function resolveCut(outfit) {
  const named = typeof outfit === 'string' ? outfitDoc(outfit)?.cut : null;
  const src = named || (outfit && typeof outfit === 'object' ? outfit : null) || DEFAULT_CUT;
  return {
    legs: pick(src.legs, LEGS, DEFAULT_CUT.legs),
    top: pick(src.top, TOPS, DEFAULT_CUT.top),
    sleeve: pick(src.sleeve, SLEEVES, DEFAULT_CUT.sleeve),
    feet: pick(src.feet, FEET, DEFAULT_CUT.feet),
    belt: !!src.belt,
    tie: !!src.tie,
    cap: !!src.cap,
    // A tube dress and a towel reach past the hip too, but as a straight
    // wrap: they are drawn by their own cut, not by the flared skirt.
    skirt: !!src.skirt || src.top === 'dress' || src.top === 'nightie',
    straps: !!src.straps,
  };
}

/** How far a named outfit's cloth stands off the body. An inline cut has no
 *  document to carry the dial, so it sits on the skin. */
export function resolveFit(outfit) {
  const doc = typeof outfit === 'string' ? outfitDoc(outfit) : null;
  return doc?.fit || { swell: 0 };
}

// ------------------------------------------------------------------ paint

/**
 * The paint scheme to wear: the one asked for by id, else the outfit's
 * default, else its first. A paint carries the garment's main colour and its
 * sprayed cells, which is what lets one outfit ship plain and camouflaged
 * without being two documents.
 */
export function resolvePaint(outfit, paintId) {
  const doc = typeof outfit === 'string' ? outfitDoc(outfit) : null;
  const list = doc?.paints;
  if (!list?.length) return null;
  return (paintId && list.find((p) => p.id === paintId))
    || list.find((p) => p.id === doc.defaultPaint)
    || list[0];
}

// A paint's cell map is built once and kept alongside the paint object: a
// story rebuilds its whole cast on every load, and re-parsing four thousand
// spray keys per character is work nobody asked for.
const CELLS = new WeakMap();

/**
 * `{ "topChest|4|2,3": "#3a4030" }` -> Map(pid -> { grid, cells }), which is
 * what a garment box is built from: the cells it wears and the grid they are
 * addressed on. A malformed key is dropped rather than thrown on: one bad
 * cell in an imported outfit should cost that cell.
 */
export function sprayCells(paint) {
  if (!paint?.spray) return null;
  if (CELLS.has(paint)) return CELLS.get(paint);
  const byPid = new Map();
  for (const [key, value] of Object.entries(paint.spray)) {
    const bar = key.indexOf('|');
    const bar2 = key.indexOf('|', bar + 1);
    const comma = key.indexOf(',', bar2 + 1);
    if (bar < 1 || bar2 < 0 || comma < 0) continue;
    const face = Number(key.slice(bar + 1, bar2));
    const gx = Number(key.slice(bar2 + 1, comma));
    const gy = Number(key.slice(comma + 1));
    if (!(face >= 0 && face < 6)) continue;
    const pid = key.slice(0, bar);
    const grid = sprayGrid(paint, pid);
    if (!(gx >= 0 && gx < grid) || !(gy >= 0 && gy < grid)) continue;
    let entry = byPid.get(pid);
    if (!entry) {
      entry = { grid, cells: new Map() };
      byPid.set(pid, entry);
    }
    entry.cells.set(cellIndex(face, gx, gy, grid), toHex(value, 0x808080));
  }
  const out = byPid.size ? byPid : null;
  CELLS.set(paint, out);
  return out;
}

/**
 * The grid one garment's cells are addressed on.
 *
 * It is per garment box, not per outfit, because that is what makes a fine
 * grid affordable: painting a badge on a pocket refines the pocket, and the
 * trousers, the boots and the rest of the shirt stay on the cells — and at
 * the subdivision — they were already drawn with. A paint that names no grid
 * at all was sprayed before the grid was refined, and is read on the old one.
 */
export function sprayGrid(paint, pid) {
  const per = pid !== undefined ? paint?.grids?.[pid] : undefined;
  return paintGridOf(per === undefined ? paint?.grid : per);
}

/** Address of one sprayable cell: a garment box's pid, a face, a grid cell. */
export function sprayKey(pid, face, gx, gy) {
  return `${pid}|${face}|${gx},${gy}`;
}

/**
 * Rewrites one garment's cells onto the current, finest grid, in place.
 *
 * The brush works on one grid, so the garment under it is brought up to that
 * grid before the first new cell lands: each old cell becomes the block of
 * new cells covering exactly the same patch of cloth, which is why a grid
 * must divide the current one. Nothing else in the app does this — cloth
 * that is only being worn stays on the grid it was painted on, and stays
 * cheap to draw.
 */
export function upscaleSpray(paint, pid) {
  if (!paint) return paint;
  const grid = sprayGrid(paint, pid);
  if (!paint.grids) paint.grids = {};
  if (grid === PAINT_N) {
    paint.grids[pid] = PAINT_N;
    return paint;
  }
  const step = PAINT_N / grid;
  const out = {};
  for (const [key, value] of Object.entries(paint.spray || {})) {
    const bar = key.indexOf('|');
    const bar2 = key.indexOf('|', bar + 1);
    const comma = key.indexOf(',', bar2 + 1);
    if (bar < 1 || bar2 < 0 || comma < 0) continue;
    const owner = key.slice(0, bar);
    if (owner !== pid) {
      out[key] = value;
      continue;
    }
    const face = Number(key.slice(bar + 1, bar2));
    const gx = Number(key.slice(bar2 + 1, comma));
    const gy = Number(key.slice(comma + 1));
    if (!(face >= 0 && face < 6) || !(gx >= 0 && gx < grid) || !(gy >= 0 && gy < grid)) continue;
    for (let dy = 0; dy < step; dy++) {
      for (let dx = 0; dx < step; dx++) {
        out[sprayKey(pid, face, gx * step + dx, gy * step + dy)] = value;
      }
    }
  }
  if (paint.spray || Object.keys(out).length) paint.spray = out;
  paint.grids[pid] = PAINT_N;
  return paint;
}

// ---------------------------------------------------------------- palette

/**
 * The palette one dressed figure draws from. `color` is the garment colour —
 * the paint's, or the character's own override — and everything else is
 * derived so a new outfit never needs a second colour table.
 */
export function palette(plan, cut, color, look = {}) {
  const cloth = toHex(color, 0x2a5caa);
  const suited = cut.top === 'jacket';
  // Nightwear, underwear and a towel are pale, soft cloth: taking the chosen
  // colour straight would give a midnight-blue slip where the author asked
  // for the same blue they use on a tee.
  const soft = cut.top === 'nightie' || cut.top === 'bra' || cut.top === 'towel';
  const main = suited ? shadeHex(cloth, 0.45) : soft ? shadeHex(cloth, 1.28) : cloth;
  const skin = toHex(look.skin, SKIN[plan] ?? SKIN.man);
  const hair = toHex(look.hair, 0x2a1810);
  return {
    top: main,
    topDark: shadeHex(main, 0.78),
    // Fatigue trousers are the tunic's own cloth a shade darker, not
    // charcoal: a uniform is one cloth, and a paint that dresses the tunic
    // has to dress the legs with it or camouflage stops at the waist.
    legs: cut.top === 'fatigues' ? shadeHex(main, 0.82)
      : cut.legs === 'briefs' ? (soft ? shadeHex(cloth, 1.28) : cloth)
        // Sports shorts belong to the top they came with; loose ones are
        // denim, which is what a shorts-and-tee outfit means by "shorts".
        : cut.legs === 'shorts' ? (cut.top === 'croptop' ? cloth : DENIM)
          : suited ? main : TROUSER,
    shoe: cut.feet === 'boot' ? BOOT
      : cut.feet === 'sneaker' ? SNEAKER
        : cut.feet === 'dress' ? DRESS_SHOE
          : cut.feet === 'flat' ? shadeHex(cloth, 0.5) : skin,
    belt: 0x2a2018,
    tie: shadeHex(cloth, 1.25),
    skin,
    skinDark: shadeHex(skin, 0.9),
    hair,
    hairDark: shadeHex(hair, 0.74),
    eye: 0x2b2018,
  };
}

/** True when the leg should be drawn as skin rather than as a garment. */
export function legIsBare(cut, part) {
  if (cut.legs === 'bare') return true;
  if (cut.legs === 'briefs') return part !== 'hip';
  if (cut.legs === 'shorts') return part === 'shin';
  return false;
}

/** How far down the upper arm the sleeve reaches, 0..1. */
export function sleeveReach(cut) {
  if (cut.sleeve === 'long') return 2;
  if (cut.sleeve === 'upper') return 1;
  if (cut.sleeve === 'short') return 0.55;
  return 0;
}
