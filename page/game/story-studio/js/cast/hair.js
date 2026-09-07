import { shadeHex } from '../render/geometry.js';

// Hair, as its own thing rather than a cap glued to the skull.
//
// At this level of detail hair is doing most of the work of telling one
// character from another — more than height or build — and it is the single
// biggest reason a girl reads as a girl rather than as a small man. So it gets
// a style table, a length dial, and enough shapes that a cast does not all
// look related.
//
// Every box comes back in head-local terms; `cast/body.js` tags them onto the
// head joint. They are deliberately NOT contact points for the ground clamp:
// hair is not something you stand on, and a plait reaching the waist would
// otherwise levitate a character who lies down.

/**
 * `cap`   how much of the skull the hair covers, as a fraction of head height
 * `back`  the wedge behind the skull
 * `sides` locks framing the face, as a fraction of head height
 * `fall`  a sheet down the back — the thing that makes hair read as "long"
 * `tail`  a single gathered tail
 * `twin`  two gathered tails, one over each ear
 * `bun`   a gathered ball
 * `braid` a tail split into narrowing segments
 * `round` a rounded silhouette that sits proud of the skull all round
 * `fringe` a straight edge over the forehead
 */
export const HAIR_STYLES = {
  bald: {},
  buzz: { cap: 0.10, back: 0.30 },
  short: { cap: 0.24, back: 0.50 },
  crop: { cap: 0.30, back: 0.42, fringe: true },
  bob: { cap: 0.30, back: 0.55, sides: 0.62, fringe: true },
  long: { cap: 0.30, back: 0.55, sides: 0.72, fall: 1, fringe: true },
  wavy: { cap: 0.34, back: 0.58, sides: 0.80, fall: 1, wave: true },
  ponytail: { cap: 0.28, back: 0.50, sides: 0.30, tail: 1 },
  pigtails: { cap: 0.28, back: 0.50, sides: 0.34, twin: 1, fringe: true },
  bun: { cap: 0.28, back: 0.46, sides: 0.26, bun: 1 },
  braid: { cap: 0.28, back: 0.50, sides: 0.34, braid: 1 },
  afro: { cap: 0.55, back: 0.70, round: true, fringe: true },
};

export const HAIR_STYLE_KEYS = Object.keys(HAIR_STYLES);

/** Long by default for women and girls, short for men and boys. A document
 *  that says nothing should still produce the character people expect.
 *
 *  `child` is the pre-split spelling; it lands on the boy defaults, matching
 *  where `planOf` sends the body itself. */
const DEFAULT_STYLE = { woman: 'long', girl: 'pigtails', boy: 'crop', child: 'crop', man: 'short' };
const LONG_BY_DEFAULT = new Set(['woman', 'girl']);

export function defaultHairStyle(base) {
  return DEFAULT_STYLE[base] || 'short';
}

export function defaultHairLength(base) {
  return LONG_BY_DEFAULT.has(base) ? 0.55 : 0.2;
}

export function resolveStyle(name, base) {
  return HAIR_STYLES[name] ? name : defaultHairStyle(base);
}

/**
 * @param {object} g  head geometry in model space:
 *   headW / headD / headH  the skull box
 *   headY                  centre of the skull
 *   chinY                  underside of the skull
 *   hair / hairDark        colours
 *   style                  a key of HAIR_STYLES
 *   length                 0..1, how far the loose hair falls
 * @returns {Array} boxes, in the same shape `buildGeometry` consumes
 */
export function hairParts(g) {
  const { headW, headD, headH, headY, hair, hairDark } = g;
  const S = HAIR_STYLES[g.style] || HAIR_STYLES.short;
  const len = Math.max(0, Math.min(1, g.length ?? 0.4));
  const out = [];
  const box = (w, h, d, color, x, y, z, extra) => {
    out.push({ w, h, d, color, x, y, z, ...(extra || {}) });
  };

  if (!S.cap) return out;                        // bald

  // ------------------------------------------------------------------ skull
  if (S.round) {
    // Built like the other women's styles — a cap, a back, two sides —
    // just round and larger, so it reads as an afro rather than as a hood
    // or a bun. Front edges stay behind the face plane; the crown stays
    // above the eyes.
    box(headD * 1.42, headH * 0.95, headW * 1.52, hair, -headD * 0.08,
      headY + headH * 0.62, 0, { shape: 'sphere', n: 3, grain: 0.07 });
    box(headD * 0.90, headH * 1.02, headW * 1.22, hair, -headD * 0.50,
      headY + headH * 0.14, 0, { shape: 'sphere', n: 3, grain: 0.07 });
    for (const s of [1, -1]) {
      box(headD * 0.90, headH * 0.84, headW * 0.78, hair, -headD * 0.16,
        headY + headH * 0.20, s * headW * 0.58,
        { shape: 'sphere', n: 3, grain: 0.07 });
    }
  } else {
    const capH = headH * S.cap;
    box(headD * 1.05, capH, headW * 1.06, hair, 0,
      headY + headH / 2 - capH * 0.32, 0, { n: 2, grain: 0.05 });
  }

  if (S.back) {
    box(headD * 0.20, headH * S.back, headW * 1.04, hairDark, -headD * 0.47,
      headY + headH * 0.10, 0, { detail: true, grain: 0.05 });
  }

  if (S.fringe) {
    box(headD * 0.10, headH * 0.16, headW * 0.96, hairDark, headD * 0.49,
      headY + headH * 0.30, 0, { detail: true, flat: true });
  }

  // Locks down the sides of the face. These are what separate a bob from a
  // crop long before any hair reaches the shoulders.
  if (S.sides) {
    const sideH = headH * S.sides;
    for (const s of [1, -1]) {
      box(headD * 0.78, sideH, headW * 0.20, hair, -headD * 0.06,
        headY + headH * 0.34 - sideH / 2, s * headW * 0.50,
        { n: 2, grain: 0.05 });
    }
  }

  // ------------------------------------------------------------ loose hair
  const fallH = headH * (1.0 + len * 3.0);
  const top = headY + headH * 0.24;

  if (S.fall) {
    // Two stacked sections rather than one slab. The lower one is wider and
    // sits further back, which is what gives long hair a silhouette against
    // the shoulders instead of a dark stripe that reads as part of the shirt.
    const upper = fallH * 0.42;
    const lower = fallH * 0.62;
    box(headD * 0.40, upper, headW * 1.04, hair, -headD * 0.46,
      top - upper / 2, 0, { n: 3, grain: 0.06 });
    box(headD * 0.34, lower, headW * 1.14, hair, -headD * 0.56,
      top - upper - lower / 2 + upper * 0.10, 0, { n: 3, grain: 0.06 });
    box(headD * 0.18, lower * 0.92, headW * 0.72, hairDark, -headD * 0.74,
      top - upper - lower / 2, 0, { detail: true, n: 2, grain: 0.07 });
    if (S.wave) {
      box(headD * 0.40, fallH * 0.24, headW * 1.22, hair, -headD * 0.58,
        top - fallH * 0.92, 0, { detail: true, n: 2, grain: 0.08 });
    }
  }

  if (S.tail) {
    box(headD * 0.40, headH * 0.34, headW * 0.52, hair, -headD * 0.54,
      headY + headH * 0.26, 0, { n: 2, grain: 0.05 });
    box(headD * 0.34, fallH * 0.92, headW * 0.44, hair, -headD * 0.66,
      top - fallH * 0.46, 0, { n: 3, grain: 0.06 });
    box(headD * 0.20, headH * 0.10, headW * 0.50, hairDark, -headD * 0.58,
      headY + headH * 0.10, 0, { detail: true });
  }

  if (S.twin) {
    // Clear of the skull on both sides. Pigtails tucked against the head read
    // as nothing at all once the character is more than a few metres away.
    for (const s of [1, -1]) {
      box(headD * 0.44, headH * 0.28, headW * 0.40, hair, -headD * 0.14,
        headY + headH * 0.16, s * headW * 0.72, { n: 2, grain: 0.05 });
      box(headD * 0.38, fallH * 0.70, headW * 0.38, hair, -headD * 0.16,
        headY + headH * 0.02 - fallH * 0.35, s * headW * 0.76,
        { n: 3, grain: 0.06 });
      box(headD * 0.22, headH * 0.09, headW * 0.44, hairDark, -headD * 0.12,
        headY + headH * 0.03, s * headW * 0.74, { detail: true });
    }
  }

  if (S.bun) {
    box(headD * 0.56, headH * 0.46, headW * 0.56, hair, -headD * 0.58,
      headY + headH * 0.34, 0, { n: 2, grain: 0.06 });
    box(headD * 0.30, headH * 0.10, headW * 0.34, hairDark, -headD * 0.46,
      headY + headH * 0.12, 0, { detail: true });
  }

  if (S.braid) {
    box(headD * 0.30, headH * 0.24, headW * 0.36, hair, -headD * 0.56,
      headY + headH * 0.24, 0, { n: 2 });
    // Narrowing segments, alternating shade: that alternation is the whole
    // reason a braid reads as plaited rather than as a rope.
    const segs = 5;
    const segH = (fallH * 0.92) / segs;
    for (let i = 0; i < segs; i++) {
      const k = 1 - i * 0.13;
      box(headD * 0.38 * k, segH * 0.94, headW * 0.46 * k,
        i % 2 ? hairDark : hair, -headD * 0.60,
        top - headH * 0.06 - segH * (i + 0.5), 0,
        { n: 2, grain: 0.05 });
    }
  }

  return out;
}

/** A slightly darker shade for the under-layers, so callers do not have to
 *  agree on the factor separately. */
export function hairShades(hair) {
  return { hair, hairDark: shadeHex(hair, 0.74) };
}
