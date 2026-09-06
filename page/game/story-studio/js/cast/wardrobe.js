import { shadeHex, toHex } from '../render/geometry.js';

// The clothing vocabulary. An outfit is not a model: it is a handful of cuts
// ("trousers, tee, short sleeve, sneakers") that the anatomy in body.js reads
// while it lays out boxes. That is what lets one character carry five outfits
// without five models, and what lets a character document invent an outfit
// inline without touching code.

/** Named cuts a document may reference by string. Anything here can also be
 *  written out longhand in a character's wardrobe entry. */
export const OUTFIT_PRESETS = {
  casual: { legs: 'trousers', top: 'tee', sleeve: 'short', feet: 'sneaker', belt: true },
  shortsTee: { legs: 'shorts', top: 'tee', sleeve: 'short', feet: 'sneaker' },
  suit: { legs: 'trousers', top: 'jacket', sleeve: 'long', feet: 'dress', belt: true, tie: true },
  dress: { legs: 'bare', top: 'dress', sleeve: 'upper', feet: 'flat', skirt: true },
  shirt: { legs: 'trousers', top: 'shirt', sleeve: 'upper', feet: 'shoe', belt: true },
  swim: { legs: 'briefs', top: 'bare', sleeve: 'none', feet: 'bare' },
  swimsuit: { legs: 'briefs', top: 'bikini', sleeve: 'none', feet: 'bare' },
  overalls: { legs: 'trousers', top: 'tee', sleeve: 'short', feet: 'boot', straps: true },
  pyjamas: { legs: 'trousers', top: 'tee', sleeve: 'long', feet: 'bare' },
};

export const OUTFIT_KEYS = Object.keys(OUTFIT_PRESETS);

const LEGS = ['trousers', 'shorts', 'briefs', 'bare'];
const TOPS = ['shirt', 'tee', 'jacket', 'dress', 'bikini', 'bare'];
const SLEEVES = ['long', 'short', 'upper', 'none'];
const FEET = ['shoe', 'sneaker', 'boot', 'dress', 'flat', 'bare'];

const DEFAULT_CUT = { legs: 'trousers', top: 'tee', sleeve: 'short', feet: 'sneaker' };

/** Garment colours that are their own thing rather than a shade of the main
 *  one: red trousers under a red shirt read as a jumpsuit, not an outfit. */
const TROUSER = 0x2b323c;
const DENIM = 0x3f6ea8;
const BOOT = 0x2a231a;
const SNEAKER = 0xe8e4da;
const DRESS_SHOE = 0x1c1712;

const SKIN = { man: 0xc8a07a, woman: 0xd4b08a, child: 0xd8b48c };

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Normalises whatever a document said into a full cut. Accepts a preset name
 * or an inline object, and silently falls back per field: one unknown cut in
 * an imported character should dress that part oddly, not fail the import.
 */
export function resolveCut(outfit) {
  const raw = typeof outfit === 'string' ? OUTFIT_PRESETS[outfit] : outfit;
  const src = raw && typeof raw === 'object' ? raw : OUTFIT_PRESETS.casual;
  return {
    legs: pick(src.legs, LEGS, DEFAULT_CUT.legs),
    top: pick(src.top, TOPS, DEFAULT_CUT.top),
    sleeve: pick(src.sleeve, SLEEVES, DEFAULT_CUT.sleeve),
    feet: pick(src.feet, FEET, DEFAULT_CUT.feet),
    belt: !!src.belt,
    tie: !!src.tie,
    cap: !!src.cap,
    skirt: !!src.skirt || src.top === 'dress',
    straps: !!src.straps,
  };
}

/**
 * The palette one dressed figure draws from. `color` is the character's
 * chosen garment colour; everything else is derived so a new outfit never
 * needs a second colour table.
 */
export function palette(plan, cut, color, look = {}) {
  const cloth = toHex(color, 0x2a5caa);
  const suited = cut.top === 'jacket';
  const main = suited ? shadeHex(cloth, 0.45) : cloth;
  const skin = toHex(look.skin, SKIN[plan] ?? SKIN.man);
  const hair = toHex(look.hair, 0x2a1810);
  return {
    top: main,
    topDark: shadeHex(main, 0.78),
    legs: cut.legs === 'briefs' ? cloth
      : cut.legs === 'shorts' ? DENIM
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
