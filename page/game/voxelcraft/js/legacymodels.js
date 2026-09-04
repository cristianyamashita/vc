import {
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
  STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
  IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
  GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_SWORD,
  STICK, TORCH, RAW_MEAT, COOKED_MEAT, FRUIT, COOKED_FRUIT,
  HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP, DOOR, DOOR_DOUBLE,
  FLOWER_RED, FLOWER_YELLOW,
  LASSO, REVOLVER, BOW, COMPASS,
  isBlock, isFlower,
} from './blocks.js';
import { shadeHex } from './voxmodel.js';

// The pre-rework shapes, kept so the "Original" graphics setting can put the
// game back exactly as it looked. They are plain, flat-shaded boxes: every
// part is emitted with `flat` and no grain, so the merged geometry renders
// identically to the loose per-box meshes these were lifted from.

const WOMAN_WEAR_0 = 0xc62828;
const MAN_WEAR_0 = 0x2a5caa;

function collector() {
  const out = [];
  const p = (w, h, d, color, x, y, z, extra) => {
    const b = { w, h, d, color, x, y, z, flat: true, grain: 0 };
    if (extra) Object.assign(b, extra);
    out.push(b);
  };
  return { out, p };
}

function limb(name, jx, jy, jz, extra, parent) {
  const o = { limb: name, joint: { x: jx, y: jy, z: jz } };
  if (parent) o.parent = parent;
  if (extra) Object.assign(o, extra);
  return o;
}

/** @param look {hair, lip, eyeS, noseS} from the caller's seeded picker. */
export function legacyMobParts(kind, wear, look) {
  const { out, p } = collector();
  if (kind === 'cow') {
    p(0.85, 0.55, 0.5, 0x6b4423, 0, 0.62, 0);
    p(0.22, 0.18, 0.16, 0xd8c4a8, 0.42, 0.72, 0);
    p(0.32, 0.28, 0.28, 0x5a381c, 0.48, 0.92, 0);
    p(0.08, 0.12, 0.06, 0x3a2414, 0.58, 1.08, 0.1);
    p(0.08, 0.12, 0.06, 0x3a2414, 0.58, 1.08, -0.1);
    p(0.12, 0.42, 0.12, 0x4a3018, 0.28, 0.22, 0.16, limb('fl', 0.28, 0.43, 0.16));
    p(0.12, 0.42, 0.12, 0x4a3018, 0.28, 0.22, -0.16, limb('fr', 0.28, 0.43, -0.16));
    p(0.12, 0.42, 0.12, 0x4a3018, -0.28, 0.22, 0.16, limb('bl', -0.28, 0.43, 0.16));
    p(0.12, 0.42, 0.12, 0x4a3018, -0.28, 0.22, -0.16, limb('br', -0.28, 0.43, -0.16));
    p(0.18, 0.16, 0.08, 0xe8d8c8, 0.1, 0.7, 0.22);
  } else if (kind === 'zebra') {
    p(0.82, 0.52, 0.42, 0xf2eee6, 0, 0.64, 0);
    p(0.12, 0.48, 0.44, 0x1a1814, 0.18, 0.64, 0);
    p(0.12, 0.48, 0.44, 0x1a1814, -0.18, 0.64, 0);
    p(0.28, 0.3, 0.26, 0xf2eee6, 0.48, 0.95, 0);
    p(0.08, 0.28, 0.08, 0x1a1814, 0.52, 1.18, 0);
    p(0.1, 0.4, 0.1, 0x1a1814, 0.26, 0.22, 0.14, limb('fl', 0.26, 0.42, 0.14));
    p(0.1, 0.4, 0.1, 0xf2eee6, 0.26, 0.22, -0.14, limb('fr', 0.26, 0.42, -0.14));
    p(0.1, 0.4, 0.1, 0xf2eee6, -0.26, 0.22, 0.14, limb('bl', -0.26, 0.42, 0.14));
    p(0.1, 0.4, 0.1, 0x1a1814, -0.26, 0.22, -0.14, limb('br', -0.26, 0.42, -0.14));
  } else if (kind === 'chicken') {
    p(0.32, 0.28, 0.24, 0xf4f0e4, 0, 0.28, 0);
    p(0.2, 0.18, 0.18, 0xf4f0e4, 0.18, 0.4, 0);
    p(0.1, 0.06, 0.08, 0xf0a020, 0.3, 0.38, 0);
    p(0.08, 0.1, 0.06, 0xd43030, 0.18, 0.52, 0);
    p(0.2, 0.06, 0.28, 0xe8e0d0, 0, 0.34, 0);
    p(0.05, 0.16, 0.05, 0xf0a020, 0.06, 0.08, 0.06, limb('l', 0.06, 0.16, 0.06));
    p(0.05, 0.16, 0.05, 0xf0a020, 0.06, 0.08, -0.06, limb('r', 0.06, 0.16, -0.06));
  } else if (kind === 'sheep') {
    p(0.7, 0.5, 0.5, 0xf0ece2, 0, 0.58, 0);
    p(0.26, 0.24, 0.24, 0xc4b090, 0.4, 0.62, 0);
    p(0.1, 0.32, 0.1, 0xc4b090, 0.22, 0.18, 0.14, limb('fl', 0.22, 0.34, 0.14));
    p(0.1, 0.32, 0.1, 0xc4b090, 0.22, 0.18, -0.14, limb('fr', 0.22, 0.34, -0.14));
    p(0.1, 0.32, 0.1, 0xc4b090, -0.22, 0.18, 0.14, limb('bl', -0.22, 0.34, 0.14));
    p(0.1, 0.32, 0.1, 0xc4b090, -0.22, 0.18, -0.14, limb('br', -0.22, 0.34, -0.14));
  } else if (kind === 'lion') {
    const fur = 0xe09030;
    const mane = 0xc43028;
    p(0.8, 0.48, 0.42, fur, 0, 0.58, 0);
    p(0.58, 0.5, 0.58, mane, 0.34, 0.9, 0);
    p(0.28, 0.24, 0.26, fur, 0.54, 0.88, 0);
    p(0.08, 0.1, 0.08, mane, 0.42, 1.16, 0.16);
    p(0.08, 0.1, 0.08, mane, 0.42, 1.16, -0.16);
    p(0.1, 0.22, 0.08, mane, -0.44, 0.62, 0);
    p(0.12, 0.36, 0.1, fur, 0.24, 0.2, 0.14, limb('fl', 0.24, 0.38, 0.14));
    p(0.12, 0.36, 0.1, fur, 0.24, 0.2, -0.14, limb('fr', 0.24, 0.38, -0.14));
    p(0.12, 0.36, 0.1, fur, -0.24, 0.2, 0.14, limb('bl', -0.24, 0.38, 0.14));
    p(0.12, 0.36, 0.1, fur, -0.24, 0.2, -0.14, limb('br', -0.24, 0.38, -0.14));
  } else if (kind === 'tiger') {
    const fur = 0xf07820;
    const stripe = 0x141210;
    p(0.84, 0.46, 0.4, fur, 0, 0.56, 0);
    p(0.08, 0.46, 0.42, stripe, 0.22, 0.56, 0);
    p(0.08, 0.46, 0.42, stripe, 0.02, 0.56, 0);
    p(0.08, 0.46, 0.42, stripe, -0.18, 0.56, 0);
    p(0.08, 0.46, 0.42, stripe, -0.36, 0.56, 0);
    p(0.3, 0.26, 0.26, fur, 0.5, 0.82, 0);
    p(0.08, 0.22, 0.28, stripe, 0.5, 0.82, 0);
    p(0.1, 0.12, 0.06, 0xf4f0e4, 0.62, 0.78, 0.1);
    p(0.1, 0.12, 0.06, 0xf4f0e4, 0.62, 0.78, -0.1);
    p(0.1, 0.34, 0.1, stripe, 0.26, 0.18, 0.12, limb('fl', 0.26, 0.35, 0.12));
    p(0.1, 0.34, 0.1, fur, 0.26, 0.18, -0.12, limb('fr', 0.26, 0.35, -0.12));
    p(0.1, 0.34, 0.1, fur, -0.26, 0.18, 0.12, limb('bl', -0.26, 0.35, 0.12));
    p(0.1, 0.34, 0.1, stripe, -0.26, 0.18, -0.12, limb('br', -0.26, 0.35, -0.12));
  } else if (kind === 'bull') {
    p(0.95, 0.62, 0.52, 0x2a1c12, 0, 0.7, 0);
    p(0.36, 0.32, 0.32, 0x1a120c, 0.52, 1.02, 0);
    p(0.08, 0.22, 0.08, 0xe8dcc8, 0.58, 1.22, 0.16);
    p(0.08, 0.22, 0.08, 0xe8dcc8, 0.58, 1.22, -0.16);
    p(0.14, 0.48, 0.14, 0x1a120c, 0.3, 0.24, 0.16, limb('fl', 0.3, 0.48, 0.16));
    p(0.14, 0.48, 0.14, 0x1a120c, 0.3, 0.24, -0.16, limb('fr', 0.3, 0.48, -0.16));
    p(0.14, 0.48, 0.14, 0x1a120c, -0.3, 0.24, 0.16, limb('bl', -0.3, 0.48, 0.16));
    p(0.14, 0.48, 0.14, 0x1a120c, -0.3, 0.24, -0.16, limb('br', -0.3, 0.48, -0.16));
  } else if (kind === 'man' || kind === 'guard') {
    const cloth = kind === 'guard' ? (wear || 0x2a3038) : (wear || MAN_WEAR_0);
    const pants = 0x1a1e24;
    const skin = 0xc8a07a;
    const hair = look.hair;
    const eyeS = look.eyeS;
    const noseS = look.noseS;
    const ew = 0.03 * eyeS;
    const eh = 0.045 * eyeS;
    const ed = 0.05 * eyeS;
    const pw = 0.022 * eyeS;
    const ph = 0.032 * eyeS;
    const pd = 0.032 * eyeS;
    const eyeX = 0.12 + ew * 0.55;
    const pupilX = eyeX + 0.01 * eyeS;
    const nw = 0.05 * noseS;
    const nh = 0.04 * noseS;
    const nd = 0.04 * noseS;
    const noseX = 0.12 + nw * 0.8;
    p(0.12, 0.26, 0.12, pants, 0, 0.13, 0.1, limb('lShin', 0, 0.26, 0.1, null, 'lThigh'));
    p(0.12, 0.26, 0.12, pants, 0, 0.13, -0.1, limb('rShin', 0, 0.26, -0.1, null, 'rThigh'));
    p(0.12, 0.25, 0.12, pants, 0, 0.385, 0.1, limb('lThigh', 0, 0.51, 0.1));
    p(0.12, 0.25, 0.12, pants, 0, 0.385, -0.1, limb('rThigh', 0, 0.51, -0.1));
    p(0.2, 0.48, 0.36, pants, 0, 0.56, 0);
    p(0.22, 0.5, 0.38, cloth, 0, 1.05, 0);
    p(0.1, 0.42, 0.1, cloth, 0, 1.0, 0.24, limb('lArm', 0, 1.21, 0.24));
    p(0.1, 0.42, 0.1, cloth, 0, 1.0, -0.24, limb('rArm', 0, 1.21, -0.24));
    p(0.1, 0.08, 0.1, skin, 0, 1.28, 0);
    p(0.24, 0.26, 0.26, skin, 0, 1.42, 0);
    p(0.26, 0.09, 0.28, hair, 0, 1.56, 0);
    p(0.05, 0.1, 0.26, hair, -0.125, 1.51, 0);
    p(ew, eh, ed, 0xf7f2ea, eyeX, 1.46, 0.06);
    p(ew, eh, ed, 0xf7f2ea, eyeX, 1.46, -0.06);
    p(pw, ph, pd, 0x1a1410, pupilX, 1.46, 0.06);
    p(pw, ph, pd, 0x1a1410, pupilX, 1.46, -0.06);
    p(nw, nh, nd, 0xb89068, noseX, 1.4, 0);
    p(0.024, 0.02, 0.07, 0x8a5a50, 0.14, 1.335, 0);
    if (kind === 'guard') {
      p(0.22, 0.045, 0.05, 0x2a2a32, 0.18, 1.02, -0.3);
      p(0.08, 0.07, 0.055, 0x3a2a1c, 0.05, 0.98, -0.27);
    }
  } else {
    const cloth = wear || WOMAN_WEAR_0;
    const skirt = shadeHex(cloth, 0.72);
    const skin = 0xd4b08a;
    const hair = look.hair;
    const lip = look.lip;
    const eyeS = look.eyeS;
    const noseS = look.noseS;
    const ew = 0.03 * eyeS;
    const eh = 0.045 * eyeS;
    const ed = 0.05 * eyeS;
    const pw = 0.022 * eyeS;
    const ph = 0.032 * eyeS;
    const pd = 0.032 * eyeS;
    const eyeX = 0.11 + ew * 0.55;
    const pupilX = eyeX + 0.01 * eyeS;
    const nw = 0.05 * noseS;
    const nh = 0.04 * noseS;
    const nd = 0.04 * noseS;
    const noseX = 0.11 + nw * 0.8;
    p(0.1, 0.24, 0.1, skirt, 0, 0.16, 0.08, limb('lShin', 0, 0.28, 0.08, null, 'lThigh'));
    p(0.1, 0.24, 0.1, skirt, 0, 0.16, -0.08, limb('rShin', 0, 0.28, -0.08, null, 'rThigh'));
    p(0.1, 0.24, 0.1, skirt, 0, 0.40, 0.08, limb('lThigh', 0, 0.52, 0.08));
    p(0.1, 0.24, 0.1, skirt, 0, 0.40, -0.08, limb('rThigh', 0, 0.52, -0.08));
    p(0.22, 0.76, 0.36, cloth, 0, 0.88, 0);
    p(0.06, 0.12, 0.1, cloth, 0.14, 1.16, 0.06);
    p(0.06, 0.12, 0.1, cloth, 0.14, 1.16, -0.06);
    p(0.09, 0.4, 0.09, skin, 0, 0.95, 0.22, limb('lArm', 0, 1.15, 0.22));
    p(0.09, 0.4, 0.09, skin, 0, 0.95, -0.22, limb('rArm', 0, 1.15, -0.22));
    p(0.1, 0.08, 0.1, skin, 0, 1.28, 0);
    p(0.22, 0.24, 0.24, skin, 0, 1.42, 0);
    p(0.26, 0.14, 0.28, hair, 0, 1.58, 0);
    p(0.1, 0.28, 0.24, hair, -0.15, 1.42, 0);
    p(0.2, 0.22, 0.08, hair, 0.02, 1.46, 0.145);
    p(0.2, 0.22, 0.08, hair, 0.02, 1.46, -0.145);
    p(0.06, 0.08, 0.2, hair, 0.12, 1.53, 0);
    p(ew, eh, ed, 0xf7f2ea, eyeX, 1.45, 0.055);
    p(ew, eh, ed, 0xf7f2ea, eyeX, 1.45, -0.055);
    p(pw, ph, pd, 0x1a1410, pupilX, 1.45, 0.055);
    p(pw, ph, pd, 0x1a1410, pupilX, 1.45, -0.055);
    p(nw, nh, nd, 0xc49872, noseX, 1.39, 0);
    p(0.025, 0.022, 0.08, lip, 0.135, 1.335, 0);
  }
  return out;
}

export function legacyHeldParts(id) {
  const { out, p } = collector();
  const hold = { rot: [0, 0, 0], pos: [0, 0, 0], scale: 1 };
  const wood = 0x8b5a2b;
  let head = 0xc4a060;
  if ([STONE_PICK, STONE_AXE, STONE_SHOVEL].includes(id)) head = 0x8e8e96;
  if ([IRON_PICK, IRON_AXE, IRON_SHOVEL].includes(id)) head = 0xc8ccd4;
  if ([GOLD_PICK, GOLD_AXE, GOLD_SHOVEL].includes(id)) head = 0xe8c44a;

  if ([WOOD_PICK, STONE_PICK, IRON_PICK, GOLD_PICK].includes(id)) {
    p(0.035, 0.42, 0.035, wood, 0, 0.05, 0);
    p(0.22, 0.06, 0.05, head, 0, 0.24, 0);
    hold.rot[2] = 0.5;
    hold.rot[0] = 0.4;
    hold.pos = [0.04, 0.02, -0.08];
  } else if ([WOOD_AXE, STONE_AXE, IRON_AXE, GOLD_AXE].includes(id)) {
    p(0.028, 0.58, 0.028, wood, 0, 0.22, 0);
    p(0.08, 0.12, 0.08, head, 0, 0.48, 0);
    p(0.24, 0.16, 0.05, head, 0.12, 0.5, 0.02);
    hold.rot = [0.05, 0.45, 0.08];
    hold.pos = [0.04, 0.02, 0];
    hold.scale = 1.2;
  } else if ([WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL, GOLD_SHOVEL].includes(id)) {
    p(0.03, 0.4, 0.03, wood, 0, 0.04, 0);
    p(0.08, 0.1, 0.03, head, 0, 0.24, 0);
    hold.rot[2] = 0.4;
    hold.rot[0] = 0.3;
    hold.pos = [0.03, 0.02, -0.06];
  } else if ([WOOD_SWORD, STONE_SWORD, IRON_SWORD, GOLD_SWORD].includes(id)) {
    if ([STONE_SWORD].includes(id)) head = 0x8e8e96;
    if ([IRON_SWORD].includes(id)) head = 0xc8ccd4;
    if ([GOLD_SWORD].includes(id)) head = 0xe8c44a;
    p(0.03, 0.22, 0.03, wood, 0, -0.04, 0);
    p(0.08, 0.04, 0.03, 0xc4a060, 0, 0.08, 0);
    p(0.05, 0.32, 0.02, head, 0, 0.26, 0);
    hold.rot[2] = 0.45;
    hold.rot[0] = 0.25;
    hold.pos = [0.03, 0.02, -0.06];
  } else if (id === LASSO) {
    p(0.16, 0.03, 0.16, 0xc4a060, 0, 0.12, 0);
    p(0.12, 0.03, 0.12, 0x8a5a28, 0, 0.12, 0);
    p(0.03, 0.22, 0.03, 0xc4a060, 0.08, 0, 0);
    hold.rot[2] = 0.35;
    hold.rot[0] = 0.2;
    hold.pos = [0.03, 0.02, -0.05];
  } else if (id === REVOLVER) {
    p(0.04, 0.12, 0.05, 0x6a4a28, 0, -0.04, 0.02);
    p(0.05, 0.06, 0.16, 0x3a3a42, 0, 0.04, -0.04);
    p(0.03, 0.03, 0.14, 0x8a8a96, 0, 0.055, -0.06);
    p(0.07, 0.07, 0.04, 0x2a2a30, 0, 0.01, 0.04);
    hold.rot[0] = 0.15;
    hold.rot[1] = 0.15;
    hold.pos = [0.02, 0.02, -0.08];
  } else if (id === BOW) {
    p(0.03, 0.36, 0.03, 0x8a5a28, 0, 0.04, 0);
    p(0.02, 0.02, 0.14, 0xe8e0d0, 0, 0.2, -0.06);
    p(0.02, 0.02, 0.14, 0xe8e0d0, 0, -0.12, -0.06);
    p(0.015, 0.32, 0.015, 0xe8e0d0, 0, 0.04, -0.12);
    hold.rot[2] = 0.15;
    hold.rot[0] = 0.1;
    hold.pos = [0.02, 0.02, -0.06];
  } else if (id === COMPASS) {
    p(0.18, 0.18, 0.03, 0xc4a060, 0, 0.04, 0);
    p(0.14, 0.14, 0.02, 0xefe6d2, 0, 0.04, -0.01);
    p(0.03, 0.1, 0.02, 0xc42828, 0, 0.07, -0.02);
    hold.rot = [-1.05, 0, 0.08];
    hold.pos = [0.04, -0.01, -0.07];
  } else if (id === STICK) {
    p(0.03, 0.28, 0.03, wood, 0, 0, 0);
    hold.pos = [0.02, -0.02, -0.05];
  } else if (id === TORCH) {
    p(0.03, 0.22, 0.03, wood, 0, 0, 0);
    p(0.04, 0.04, 0.04, 0xffaa33, 0, 0.12, 0);
    hold.pos = [0.02, 0, -0.05];
  } else if (isFlower(id)) {
    const petal = id === FLOWER_RED ? 0xd22d37 : id === FLOWER_YELLOW ? 0xe6be28 : 0xf0f0f4;
    p(0.02, 0.18, 0.02, 0x2e8a38, 0, 0.02, 0);
    p(0.08, 0.06, 0.08, petal, 0, 0.14, 0);
    hold.pos = [0.02, -0.02, -0.05];
  } else if (id === RAW_MEAT) {
    p(0.12, 0.07, 0.08, 0xc45a5a, 0, 0, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === COOKED_MEAT) {
    p(0.12, 0.07, 0.08, 0x7a3e22, 0, 0, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === FRUIT) {
    p(0.08, 0.08, 0.08, 0xc83228, 0, 0.02, -0.03);
    p(0.03, 0.05, 0.03, 0x3a8a32, 0, 0.08, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === COOKED_FRUIT) {
    p(0.08, 0.08, 0.08, 0xc47828, 0, 0.02, -0.03);
    p(0.05, 0.05, 0.05, 0x8a4a14, 0, 0.02, -0.03);
    p(0.03, 0.05, 0.03, 0x3a8a32, 0, 0.08, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === HIDE_COW) {
    p(0.16, 0.02, 0.12, 0x7a4e2e, 0, 0, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === HIDE_ZEBRA) {
    p(0.16, 0.02, 0.12, 0xf0ece4, 0, 0, -0.03);
    p(0.04, 0.025, 0.12, 0x1a1816, -0.04, 0, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === HIDE_SHEEP) {
    p(0.16, 0.03, 0.12, 0xe8e4d8, 0, 0, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (id === DOOR || id === DOOR_DOUBLE) {
    p(0.12, 0.28, 0.04, 0xa87838, 0, 0.02, -0.03);
    if (id === DOOR_DOUBLE) p(0.12, 0.28, 0.04, 0xa87838, 0.1, 0.02, -0.03);
    hold.pos = [0.03, -0.02, -0.05];
  } else if (isBlock(id)) {
    p(0.16, 0.16, 0.16, 0x8fbf6a, 0, 0, -0.04);
    hold.pos = [0.03, -0.02, -0.06];
  } else {
    p(0.1, 0.1, 0.04, 0xdddddd, 0, 0, -0.03);
  }

  return { parts: out, hold };
}
