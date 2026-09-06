import { shadeHex } from './voxmodel.js';

// Every human in the game is built here: one body plan per gender, dressed by
// an outfit spec. Keeping it in one place means a new outfit is a table entry
// rather than a second copy of the anatomy, and it lets every box carry a
// stable `pid` so the egg editor can spray individual cells onto it.

export const MAN_WEAR = [0x2a5caa, 0x1e5a32, 0x6b3e22];
export const WOMAN_WEAR = [0xc62828, 0xe85a9a, 0xf5f2ea, 0xe8c220, 0xe07020];

const SKIN_MAN = 0xc8a07a;
const SKIN_WOMAN = 0xd4b08a;

const DENIM = 0x3f6ea8;
const TROUSER = 0x2b323c;
const CAMO = 0x4a5738;
const CAMO_D = 0x33402a;
const CAMO_L = 0x6b7748;
const CAMO_B = 0x5a4a30;
const BOOT = 0x2a231a;
const SNEAKER = 0xe8e4da;

export const OUTFIT_KEYS = ['default', 'shortsTee', 'trousersTee', 'suit', 'guerrilla', 'swim'];

/** What each outfit covers. `legs`/`top`/`sleeve`/`feet` drive the body plan;
 *  the rest are trimmings drawn on top. */
const OUTFITS = {
  man: {
    default: { labelKey: 'outfitManDefault', legs: 'trousers', top: 'shirt', sleeve: 'upper', feet: 'shoe', belt: true, legLen: 'short' },
    shortsTee: { labelKey: 'outfitShortsTee', legs: 'shorts', top: 'tee', sleeve: 'short', feet: 'sneaker', legLen: 'short' },
    trousersTee: { labelKey: 'outfitTrousersTee', legs: 'trousers', top: 'tee', sleeve: 'short', feet: 'sneaker', belt: true, legLen: 'short' },
    suit: { labelKey: 'outfitSuit', legs: 'trousers', top: 'jacket', sleeve: 'long', feet: 'dress', belt: true, tie: true, legLen: 'short' },
    guerrilla: { labelKey: 'outfitGuerrilla', legs: 'trousers', top: 'shirt', sleeve: 'long', feet: 'boot', belt: true, camo: true, cap: true, webbing: true, legLen: 'short' },
    swim: { labelKey: 'outfitTrunks', legs: 'briefs', top: 'bare', sleeve: 'none', feet: 'bare', legLen: 'short' },
  },
  woman: {
    default: { labelKey: 'outfitWomanDefault', legs: 'bare', top: 'dress', sleeve: 'upper', feet: 'flat', skirt: true, legLen: 'short' },
    shortsTee: { labelKey: 'outfitShortsTee', legs: 'shorts', top: 'tee', sleeve: 'short', feet: 'sneaker', legLen: 'long' },
    trousersTee: { labelKey: 'outfitTrousersTee', legs: 'trousers', top: 'tee', sleeve: 'short', feet: 'sneaker', legLen: 'long' },
    suit: { labelKey: 'outfitSuitW', legs: 'trousers', top: 'blazer', sleeve: 'long', feet: 'dress', legLen: 'long' },
    guerrilla: { labelKey: 'outfitGuerrilla', legs: 'trousers', top: 'shirt', sleeve: 'long', feet: 'boot', belt: true, camo: true, cap: true, webbing: true, legLen: 'long' },
    swim: { labelKey: 'outfitBikini', legs: 'briefs', top: 'bikini', sleeve: 'none', feet: 'bare', legLen: 'long' },
  },
};

export function outfitsFor(base) {
  const table = OUTFITS[base === 'woman' ? 'woman' : 'man'];
  return OUTFIT_KEYS.map((key) => ({ key, labelKey: table[key].labelKey }));
}

export function outfitSpec(base, key) {
  const table = OUTFITS[base === 'woman' ? 'woman' : 'man'];
  return table[key] || table.default;
}

/** The woman's default silhouette hangs from a skirt, so her legs stop short.
 *  Trousers and swimwear need the full leg, which moves both joints down. */
function legPlan(base, spec) {
  if (base !== 'woman') {
    return { shinY: 0.22, shinH: 0.26, shinJ: 0.35, thighY: 0.45, thighH: 0.24, thighJ: 0.57, z: 0.1, hipY: 0.63, hipH: 0.14 };
  }
  if (spec.legLen === 'long') {
    return { shinY: 0.225, shinH: 0.27, shinJ: 0.36, thighY: 0.47, thighH: 0.26, thighJ: 0.6, z: 0.09, hipY: 0.65, hipH: 0.14 };
  }
  return { shinY: 0.16, shinH: 0.16, shinJ: 0.24, thighY: 0.305, thighH: 0.15, thighJ: 0.38, z: 0.08, hipY: 0.49, hipH: 0.12 };
}

function limbTag(name, jx, jy, jz, extra, parent) {
  const o = { limb: name, joint: { x: jx, y: jy, z: jz } };
  if (parent) o.parent = parent;
  if (extra) Object.assign(o, extra);
  return o;
}

/**
 * Builds one dressed human.
 * @param {'man'|'woman'|'guard'} kind
 * @param {number} wear   main garment colour
 * @param {object} look   hair / face variation
 * @param {string} outfitKey
 */
export function buildHuman(kind, wear, look, outfitKey = 'default') {
  const guard = kind === 'guard';
  const base = kind === 'woman' ? 'woman' : 'man';
  const spec = guard ? outfitSpec('man', 'default') : outfitSpec(base, outfitKey);
  const out = [];
  let reg = null;
  let pid = null;
  const p = (w, h, d, color, x, y, z, extra) => {
    const b = { w, h, d, color, x, y, z };
    if (extra) Object.assign(b, extra);
    if (reg && b.reg == null) b.reg = reg;
    if (pid && b.pid == null) b.pid = pid;
    out.push(b);
    return b;
  };
  /** Draws one box on each side, tagging the pair `<name>L` / `<name>R`. */
  const pair = (name, w, h, d, color, x, y, z, extra, extraR) => {
    pid = `${name}L`;
    p(w, h, d, color, x, y, z, extra);
    pid = `${name}R`;
    p(w, h, d, color, x, y, -z, extraR || extra);
    pid = null;
  };

  const cloth = guard ? (wear || 0x2a3038) : (wear || (base === 'woman' ? WOMAN_WEAR[0] : MAN_WEAR[0]));
  const clothD = shadeHex(cloth, 0.78);
  const skin = base === 'woman' ? SKIN_WOMAN : SKIN_MAN;
  const skinD = shadeHex(skin, 0.9);
  const hair = look.hair;
  const hairD = shadeHex(hair, base === 'woman' ? 0.74 : 0.72);
  const suitCloth = shadeHex(cloth, 0.42);
  const suitClothD = shadeHex(suitCloth, 0.8);

  const topColor = spec.camo ? CAMO : spec.top === 'jacket' || spec.top === 'blazer' ? suitCloth : cloth;
  const topColorD = spec.camo ? CAMO_D : spec.top === 'jacket' || spec.top === 'blazer' ? suitClothD : clothD;
  // Trousers are their own garment, not a shade of the shirt: a red top with
  // red trousers reads as a jumpsuit rather than an outfit.
  const legColor = spec.camo ? CAMO
    : spec.legs === 'briefs' ? cloth
      : spec.legs === 'shorts' ? DENIM
        : spec.top === 'jacket' || spec.top === 'blazer' ? suitCloth
          : TROUSER;
  const shoeColor = spec.feet === 'boot' ? BOOT
    : spec.feet === 'sneaker' ? SNEAKER
      : spec.feet === 'dress' ? 0x1c1712
        : base === 'woman' ? 0x3a241c : 0x2a2018;

  const L = legPlan(base, spec);
  const man = base !== 'woman';
  // Authored leg thicknesses: a bare leg is slimmer than the trouser around it,
  // and the woman's bare leg is the stock skirt look, so both are stated
  // outright rather than derived from one another.
  const legs = man
    ? { bareW: 0.128, bareD: 0.138, shinW: 0.13, shinD: 0.14, thighW: 0.15, thighD: 0.16 }
    : { bareW: 0.1, bareD: 0.11, shinW: 0.115, shinD: 0.125, thighW: 0.115, thighD: 0.125 };

  // ---------------------------------------------------------------- feet
  reg = 'feet';
  if (spec.feet === 'bare') {
    pair('foot', man ? 0.125 : 0.11, 0.06, man ? 0.2 : 0.17, skinD, 0.015, 0.03, L.z,
      { limb: 'lShin' }, { limb: 'rShin' });
  } else {
    const fw = man ? 0.16 : 0.14;
    const fh = spec.feet === 'boot' ? 0.14 : man ? 0.09 : 0.08;
    const fd = man ? 0.24 : 0.2;
    pair('foot', fw, fh, fd, shoeColor, 0.02, fh / 2, L.z, { limb: 'lShin' }, { limb: 'rShin' });
    if (spec.feet === 'sneaker') {
      pair('sole', fw + 0.01, 0.03, fd + 0.01, 0x3a3a42, 0.02, 0.015, L.z,
        { limb: 'lShin', flat: true, detail: true }, { limb: 'rShin', flat: true, detail: true });
    }
    if (spec.feet === 'boot') {
      pair('bootCuff', fw * 0.86, 0.06, fd * 0.62, shadeHex(shoeColor, 1.25), 0.005, 0.17, L.z,
        { limb: 'lShin', detail: true }, { limb: 'rShin', detail: true });
    }
  }

  // ---------------------------------------------------------------- legs
  reg = 'legs';
  const shinBare = spec.legs === 'bare' || spec.legs === 'shorts' || spec.legs === 'briefs';
  const shinColor = shinBare ? skin : legColor;
  const shinW = shinBare ? legs.bareW : legs.shinW;
  const shinD = shinBare ? legs.bareD : legs.shinD;
  pair('shin', shinW, L.shinH, shinD, shinColor, 0, L.shinY, L.z,
    limbTag('lShin', 0, L.shinJ, L.z, { grain: 0.045 }, 'lThigh'),
    limbTag('rShin', 0, L.shinJ, -L.z, { grain: 0.045 }, 'rThigh'));

  const thighBare = spec.legs === 'bare' || spec.legs === 'briefs';
  const thighColor = thighBare ? skin : legColor;
  const thighW = thighBare ? legs.bareW : legs.thighW;
  const thighD = thighBare ? legs.bareD : legs.thighD;
  pair('thigh', thighW, L.thighH, thighD, thighColor, 0, L.thighY, L.z,
    limbTag('lThigh', 0, L.thighJ, L.z, { grain: 0.045 }),
    limbTag('rThigh', 0, L.thighJ, -L.z, { grain: 0.045 }));
  if (spec.legs === 'shorts') {
    // The hem, so shorts read as a garment rather than differently-coloured legs.
    pair('hem', thighW + 0.015, 0.04, thighD + 0.015, shadeHex(legColor, 0.82), 0, L.thighY - L.thighH / 2 + 0.02, L.z,
      { limb: 'lThigh', detail: true }, { limb: 'rThigh', detail: true });
  }

  // --------------------------------------------------------------- hips
  reg = 'belly';
  if (spec.skirt) {
    const skirtC = shadeHex(cloth, 0.88);
    pid = 'skirtHem';
    p(0.3, 0.05, 0.4, clothD, 0, 0.405, 0, { grain: 0.04 });
    pid = 'skirtLow';
    p(0.29, 0.12, 0.39, skirtC, 0, 0.49, 0, { n: 2, grain: 0.05 });
    pid = 'skirtHigh';
    p(0.25, 0.14, 0.34, skirtC, 0, 0.62, 0, { n: 2, grain: 0.05 });
    pid = 'waist';
    p(0.235, 0.045, 0.325, clothD, 0, 0.705, 0);
  } else {
    const hipBare = spec.legs === 'briefs' && spec.top === 'bare';
    const hipW = man ? 0.24 : 0.23;
    const hipD = man ? 0.35 : 0.32;
    pid = 'hips';
    p(hipW, L.hipH, hipD, spec.legs === 'briefs' ? cloth : legColor, 0, L.hipY, 0, { n: 2, grain: 0.045 });
    if (spec.belt) {
      pid = 'belt';
      p(hipW + 0.02, 0.06, hipD + 0.02, spec.camo ? 0x2f2a1e : 0x4a3520, 0, L.hipY + 0.09, 0);
      pid = 'buckle';
      p(0.05, 0.05, 0.05, 0xc9a63c, hipW / 2 + 0.01, L.hipY + 0.09, 0, { flat: true, detail: true });
    }
    if (spec.legs === 'briefs') {
      pid = 'waistband';
      p(hipW + 0.012, 0.035, hipD + 0.012, shadeHex(cloth, 0.8), 0, L.hipY + L.hipH / 2 - 0.015, 0, { detail: true });
    }
    if (hipBare) {
      // A bare midriff between the trunks and the chest.
      pid = 'midriff';
      p(hipW * 0.9, 0.1, hipD * 0.9, skin, 0, L.hipY + L.hipH / 2 + 0.05, 0, { grain: 0.04 });
    }
  }

  // -------------------------------------------------------------- torso
  reg = 'torso';
  const chestY = man ? 0.97 : 0.96;
  const chestH = man ? 0.44 : 0.48;
  const chestW = man ? 0.26 : 0.22;
  const chestD = man ? 0.36 : 0.32;
  const bareTop = spec.top === 'bare' || spec.top === 'bikini';
  pid = 'chest';
  if (bareTop) {
    p(chestW * 0.92, chestH, chestD * 0.94, skin, 0, chestY, 0, { n: 3, grain: 0.04 });
    pid = 'pecs';
    p(chestW * 0.8, 0.1, chestD * 0.9, shadeHex(skin, 0.94), 0.012, chestY + chestH / 2 - 0.16, 0, { detail: true });
  } else {
    p(chestW, chestH, chestD, topColor, 0, chestY, 0, { n: 3, grain: 0.055 });
  }
  if (spec.camo) {
    // A handful of patches is enough to read as camouflage at play distance.
    pid = 'camoA';
    p(chestW * 0.5, 0.13, chestD + 0.005, CAMO_D, 0.02, chestY + 0.1, 0, { flat: true, grain: 0.1 });
    pid = 'camoB';
    p(chestW * 0.38, 0.1, chestD + 0.005, CAMO_L, -0.03, chestY - 0.08, 0, { flat: true, grain: 0.1 });
    pid = 'camoC';
    p(chestW + 0.005, 0.09, chestD * 0.34, CAMO_B, 0, chestY - 0.16, 0.08, { flat: true, grain: 0.1, detail: true });
  }
  pid = 'shoulders';
  if (!bareTop) {
    p(chestW + (man ? 0.01 : 0.01), man ? 0.09 : 0.07, chestD + 0.01, topColorD, 0, man ? 1.155 : 1.14, 0);
  } else {
    p(chestW * 0.94, 0.07, chestD * 0.92, shadeHex(skin, 0.96), 0, man ? 1.155 : 1.14, 0, { detail: true });
  }
  if (spec.top === 'bikini') {
    pid = 'bikiniTop';
    p(chestW * 0.98, 0.1, chestD * 1.02, cloth, 0.005, chestY + 0.09, 0, { grain: 0.05 });
    pid = 'bikiniStrapL';
    p(0.03, 0.16, 0.03, cloth, -0.02, chestY + 0.2, 0.07, { detail: true });
    pid = 'bikiniStrapR';
    p(0.03, 0.16, 0.03, cloth, -0.02, chestY + 0.2, -0.07, { detail: true });
  }
  if (!man && !bareTop) {
    pair('bust', 0.07, 0.09, 0.11, topColor, 0.11, 1.05, 0.07,
      { detail: true }, { detail: true });
  }
  if (!man && spec.top === 'bikini') {
    pair('bust', 0.07, 0.09, 0.11, cloth, 0.105, 1.05, 0.07,
      { detail: true }, { detail: true });
  }
  pid = 'collar';
  p(man ? 0.1 : 0.09, man ? 0.11 : 0.1, man ? 0.16 : 0.14, skin, man ? 0.045 : 0.04, man ? 1.2 : 1.185, 0,
    { flat: true, detail: true });
  if (spec.top === 'jacket' || spec.top === 'blazer') {
    pid = 'shirtFront';
    p(0.06, 0.3, chestD * 0.42, 0xf2efe6, chestW / 2 - 0.005, chestY + 0.07, 0, { flat: true });
    pid = 'lapelL';
    p(0.045, 0.2, 0.06, topColorD, chestW / 2, chestY + 0.11, 0.06, { flat: true });
    pid = 'lapelR';
    p(0.045, 0.2, 0.06, topColorD, chestW / 2, chestY + 0.11, -0.06, { flat: true });
    if (spec.tie) {
      pid = 'tie';
      p(0.035, 0.24, 0.05, cloth, chestW / 2 + 0.012, chestY + 0.05, 0, { flat: true });
      pid = 'tieKnot';
      p(0.045, 0.05, 0.06, shadeHex(cloth, 0.8), chestW / 2 + 0.012, chestY + 0.19, 0, { flat: true, detail: true });
    }
  }
  if (spec.webbing) {
    pid = 'strapL';
    p(0.02, chestH * 0.9, 0.05, 0x2f2a1e, chestW / 2 + 0.005, chestY, 0.09, { flat: true });
    pid = 'strapR';
    p(0.02, chestH * 0.9, 0.05, 0x2f2a1e, chestW / 2 + 0.005, chestY, -0.09, { flat: true });
    pid = 'pouch';
    p(0.05, 0.09, 0.1, CAMO_D, chestW / 2 + 0.02, chestY - 0.12, 0.1, { detail: true });
  }
  if (guard) {
    pid = 'sash';
    p(0.22, 0.045, 0.05, 0x2a2a32, 0.18, 1.02, -0.3, { flat: true, grain: 0 });
    pid = 'holster';
    p(0.08, 0.07, 0.055, 0x3a2a1c, 0.05, 0.98, -0.27, { flat: true, grain: 0 });
    pid = 'holsterStud';
    p(0.04, 0.04, 0.04, 0xc9a63c, 0.08, 1.04, -0.27, { flat: true, detail: true });
  }

  // --------------------------------------------------------------- arms
  reg = 'arms';
  const armZ = man ? 0.23 : 0.2;
  const armJ = man ? 1.19 : 1.2;
  const upW = man ? 0.12 : 0.1;
  const upD = man ? 0.12 : 0.1;
  // 'upper' sleeves stop at the elbow (the stock look), 'short' is a t-shirt
  // cuff partway down the upper arm, 'long' runs to the wrist.
  const sleeveLong = spec.sleeve === 'long';
  const sleeveShort = spec.sleeve === 'short' || spec.sleeve === 'upper';
  // The upper arm is one box; how much of it the sleeve covers is what makes
  // a long sleeve, a t-shirt sleeve or a bare arm.
  const upY = man ? 1.08 : 1.12;
  const upH = man ? 0.22 : 0.16;
  if (sleeveShort) {
    const cuffH = spec.sleeve === 'upper' ? upH : upH * 0.55;
    pair('sleeve', upW, cuffH, upD, topColor, 0, armJ - cuffH / 2, armZ,
      limbTag('lArm', 0, armJ, armZ, { grain: 0.05 }),
      limbTag('rArm', 0, armJ, -armZ, { grain: 0.05 }));
    if (cuffH < upH) {
      pair('armUp', upW * 0.88, upH - cuffH, upD * 0.88, skin, 0, armJ - cuffH - (upH - cuffH) / 2, armZ,
        { limb: 'lArm', grain: 0.04 }, { limb: 'rArm', grain: 0.04 });
    }
  } else if (sleeveLong) {
    pair('sleeve', upW, upH, upD, topColor, 0, upY, armZ,
      limbTag('lArm', 0, armJ, armZ, { grain: 0.05 }),
      limbTag('rArm', 0, armJ, -armZ, { grain: 0.05 }));
  } else {
    pair('armUp', upW * 0.88, upH, upD * 0.88, skin, 0, upY, armZ,
      limbTag('lArm', 0, armJ, armZ, { grain: 0.04 }),
      limbTag('rArm', 0, armJ, -armZ, { grain: 0.04 }));
  }

  const loW = man ? 0.1 : 0.09;
  const loH = man ? 0.22 : 0.26;
  const loD = man ? 0.105 : 0.095;
  const loY = man ? 0.86 : 0.91;
  if (sleeveLong) {
    // A long sleeve runs to the wrist; the forearm underneath is the cuff.
    pair('armLo', loW + 0.012, loH, loD + 0.012, topColor, 0, loY, armZ,
      { limb: 'lArm', grain: 0.05 }, { limb: 'rArm', grain: 0.05 });
    pair('cuff', loW + 0.016, 0.04, loD + 0.016, topColorD, 0, loY - loH / 2 + 0.02, armZ,
      { limb: 'lArm', detail: true }, { limb: 'rArm', detail: true });
  } else {
    pair('armLo', loW, loH, loD, skin, 0, loY, armZ,
      { limb: 'lArm', grain: 0.04 }, { limb: 'rArm', grain: 0.04 });
  }

  reg = 'hands';
  pair('hand', man ? 0.11 : 0.1, man ? 0.1 : 0.09, man ? 0.11 : 0.1, skinD, 0, man ? 0.71 : 0.74, armZ,
    { limb: 'lArm' }, { limb: 'rArm' });

  // --------------------------------------------------------------- head
  reg = 'head';
  pid = 'neck';
  p(man ? 0.12 : 0.1, man ? 0.1 : 0.09, man ? 0.13 : 0.11, skinD, 0, 1.26, 0);
  pid = 'head';
  p(man ? 0.24 : 0.22, man ? 0.26 : 0.25, man ? 0.25 : 0.24, skin, 0, man ? 1.43 : 1.42, 0, { n: 3, grain: 0.04 });
  if (man) {
    pair('ear', 0.035, 0.08, 0.05, skinD, -0.01, 1.42, 0.14, { detail: true }, { detail: true });
  }

  reg = 'hair';
  if (man) {
    pid = 'hairTop';
    p(0.26, 0.08, 0.27, hair, 0, 1.58, 0, { n: 2, grain: 0.09 });
    pid = 'hairBack';
    p(0.07, 0.18, 0.26, hair, -0.115, 1.49, 0, { grain: 0.09 });
    pair('hairSide', 0.24, 0.12, 0.05, hairD, 0, 1.5, 0.125, { grain: 0.08 }, { grain: 0.08 });
    pid = 'hairFringe';
    p(0.06, 0.06, 0.25, hair, 0.105, 1.54, 0, { grain: 0.08, detail: true });
    pair('brow', 0.028, 0.022, 0.075, hairD, 0.122, 1.495, 0.06,
      { flat: true, detail: true }, { flat: true, detail: true });
  } else {
    pid = 'hairTop';
    p(0.25, 0.1, 0.26, hair, 0, 1.57, 0, { n: 2, grain: 0.09 });
    pid = 'hairBack';
    p(0.1, 0.34, 0.25, hair, -0.11, 1.38, 0, { n: 2, grain: 0.09 });
    pair('hairSide', 0.2, 0.24, 0.05, hair, 0.01, 1.43, 0.125, { grain: 0.09 }, { grain: 0.09 });
    if (look.longHair) {
      pid = 'hairLong';
      p(0.09, 0.2, 0.24, hair, -0.105, 1.14, 0, { grain: 0.09 });
      pair('hairTail', 0.07, 0.16, 0.07, hairD, -0.09, 1.0, 0.09,
        { grain: 0.08, detail: true }, { grain: 0.08, detail: true });
    }
    pid = 'hairFringe';
    p(0.06, 0.06, 0.22, hair, 0.1, 1.52, 0, { grain: 0.08, detail: true });
    pair('brow', 0.026, 0.02, 0.07, hairD, 0.112, 1.485, 0.055,
      { flat: true, detail: true }, { flat: true, detail: true });
  }

  reg = 'eyes';
  const eyeY = man ? 1.45 : 1.445;
  const eyeZ = man ? 0.062 : 0.057;
  const eyeX = man ? 0.12 : 0.11;
  const sc = look.eyeS;
  const ew = 0.03 * sc;
  const eh = 0.045 * sc;
  const ed = 0.05 * sc;
  pair('eyeWhite', ew, eh, ed, 0xf7f2ea, eyeX, eyeY, eyeZ,
    { flat: true, grain: 0 }, { flat: true, grain: 0 });
  pair('iris', ew * 0.72, eh * 0.72, ed * 0.62, 0x1a1410, eyeX + ew * 0.5, eyeY, eyeZ,
    { flat: true, grain: 0 }, { flat: true, grain: 0 });

  reg = 'face';
  const nS = look.noseS;
  pid = 'nose';
  if (man) p(0.055 * nS, 0.05 * nS, 0.05 * nS, skinD, 0.135, 1.4, 0);
  else p(0.05 * nS, 0.045 * nS, 0.045 * nS, skinD, 0.125, 1.39, 0);
  pid = 'mouth';
  if (man) p(0.024, 0.02, 0.075, 0x8a5a50, 0.13, 1.335, 0, { flat: true, detail: true });
  else p(0.024, 0.024, 0.08, look.lip ?? 0xc06070, 0.122, 1.335, 0, { flat: true, detail: true });

  if (man && look.beard) {
    reg = 'hair';
    pid = 'beard';
    p(0.05, 0.12, 0.2, hairD, 0.105, 1.33, 0, { grain: 0.09 });
    pid = 'beardJaw';
    p(0.16, 0.06, 0.25, hairD, 0.03, 1.3, 0, { grain: 0.09, detail: true });
  }

  if (spec.cap) {
    reg = 'hair';
    pid = 'cap';
    p(0.27, 0.07, 0.28, CAMO_D, 0, 1.6, 0, { grain: 0.06 });
    pid = 'capPeak';
    p(0.11, 0.03, 0.26, CAMO, 0.17, 1.575, 0, { flat: true });
  }

  reg = null;
  pid = null;
  return out;
}
