import * as THREE from 'three';
import {
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
  STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
  IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
  STICK, TORCH, COAL, IRON, RAW_MEAT, COOKED_MEAT, FRUIT, COOKED_FRUIT,
  HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP, DOOR, DOOR_DOUBLE,
  FLOWER_RED, FLOWER_YELLOW, FLOWER_WHITE,
  LASSO, REVOLVER, BOW,
  STAIRS, STAIRS_SAND, STAIRS_STONE, LADDER, WALL_WOOD, WALL_GLASS,
  BLOCKS, isBlock, isFlower,
} from './blocks.js';
import { cachedVoxGeometry, shadeHex } from './voxmodel.js';
import { isOriginal } from './quality.js';
import { legacyHeldParts } from './legacymodels.js';
import { tileUV } from './textures.js';

// The one description of what every item looks like in 3D. The hand, the
// dropped item in the world and the inventory icon all build from this, so an
// item can never look like three different things.

export const ITEM_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const blockGeoCache = new Map();
let blockMat = null;

/** Blocks are drawn with the real atlas faces, so they need the atlas first. */
export function initItemModels(atlas) {
  if (atlas && !blockMat) blockMat = new THREE.MeshLambertMaterial({ map: atlas.texture });
}

export function blockMaterial() {
  return blockMat;
}

/** The legacy hold transform for `id`, or null outside Original graphics. */
export function legacyHold(id) {
  return isOriginal() ? legacyHeldParts(id).hold : null;
}

/** A mesh for `id` at authored (in-hand) scale, or null if nothing fits. */
export function itemMesh(id, opts = {}) {
  const parts = itemParts(id);
  if (!parts.length) {
    if (isBlock(id) && blockMat) return new THREE.Mesh(blockCube(id), blockMat);
    parts.push({ w: 0.14, h: 0.14, d: 0.05, color: 0xc9c9d2, x: 0, y: 0, z: -0.03, n: 2 });
  }
  const key = `${opts.full ? 'item!' : 'item'}:${id}`;
  return new THREE.Mesh(cachedVoxGeometry(key, () => parts, opts.full), ITEM_MAT);
}

export function isBlockMesh(id) {
  return !itemParts(id).length && isBlock(id);
}

export function blockCube(id) {
  let geo = blockGeoCache.get(id);
  if (geo) return geo;
  geo = new THREE.BoxGeometry(0.17, 0.17, 0.17);
  const tiles = BLOCKS[id]?.tiles || {};
  const faces = [
    tiles.side || tiles.all || tiles.top,
    tiles.side || tiles.all || tiles.top,
    tiles.top || tiles.all || tiles.side,
    tiles.bottom || tiles.all || tiles.side,
    tiles.side || tiles.all || tiles.top,
    tiles.side || tiles.all || tiles.top,
  ];
  const uv = geo.getAttribute('uv');
  for (let f = 0; f < 6; f++) {
    const { u0, v0, u1, v1 } = tileUV(faces[f]);
    const b = f * 4;
    uv.setXY(b, u0, v1);
    uv.setXY(b + 1, u1, v1);
    uv.setXY(b + 2, u0, v0);
    uv.setXY(b + 3, u1, v0);
  }
  uv.needsUpdate = true;
  blockGeoCache.set(id, geo);
  return geo;
}

const WOOD = 0x8b5a2b;
const WOOD_HI = 0xa8703a;
const GOLD = 0xc8a24e;

function headColor(id) {
  if ([STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD].includes(id)) return 0x9195a0;
  if ([IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD].includes(id)) return 0xd8dce6;
  return 0xb8823c;
}

export function itemParts(id) {
  if (isOriginal()) return legacyHeldParts(id).parts;
  const out = [];
  const p = (w, h, d, color, x, y, z, extra) => {
    const b = { w, h, d, color, x, y, z };
    if (extra) Object.assign(b, extra);
    out.push(b);
  };
  const head = headColor(id);
  const headHi = shadeHex(head, 1.12);
  const headLo = shadeHex(head, 0.82);

  if ([WOOD_PICK, STONE_PICK, IRON_PICK].includes(id)) {
    p(0.034, 0.44, 0.034, WOOD, 0, 0.04, 0, { grain: 0.09 });
    p(0.038, 0.05, 0.038, WOOD_HI, 0, 0.2, 0, { detail: true });
    p(0.07, 0.06, 0.055, head, 0, 0.25, 0);
    // head swept along an arc, tips curving down like a real pick
    const R = 0.27;
    const yc = 0.26 - R;
    for (let i = 1; i <= 3; i++) {
      const a = i * 0.3;
      for (const sgn of [1, -1]) {
        p(i === 3 ? 0.06 : 0.085, 0.058 - i * 0.005, 0.05, i === 3 ? headLo : head,
          sgn * R * Math.sin(a), yc + R * Math.cos(a), 0, { rz: -sgn * a });
      }
    }
    p(0.06, 0.016, 0.052, headHi, 0, 0.278, 0, { flat: true, detail: true });
  } else if ([WOOD_AXE, STONE_AXE, IRON_AXE].includes(id)) {
    p(0.03, 0.46, 0.03, WOOD, 0, 0.02, 0, { grain: 0.09 });
    p(0.036, 0.05, 0.036, WOOD_HI, 0, -0.19, 0, { detail: true });
    // The head is kept a constant height. Aimed forward the blade is seen down
    // its own length, so any flare would read as notches rather than a taper.
    p(0.09, 0.2, 0.085, head, 0.01, 0.228, 0);
    p(0.175, 0.235, 0.078, head, 0.115, 0.233, 0, { n: 2, grain: 0.06 });
    p(0.035, 0.28, 0.084, headHi, 0.222, 0.238, 0);
  } else if ([WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL].includes(id)) {
    p(0.03, 0.42, 0.03, WOOD, 0, 0.03, 0, { grain: 0.09 });
    p(0.036, 0.05, 0.036, WOOD_HI, 0, -0.17, 0, { detail: true });
    p(0.055, 0.06, 0.034, headLo, 0, 0.2, 0);
    p(0.105, 0.14, 0.032, head, 0, 0.285, 0, { n: 2, grain: 0.06 });
    p(0.075, 0.045, 0.03, head, 0, 0.372, 0);
    p(0.022, 0.13, 0.038, headHi, 0, 0.285, 0, { detail: true });
  } else if ([WOOD_SWORD, STONE_SWORD, IRON_SWORD].includes(id)) {
    p(0.028, 0.2, 0.028, WOOD, 0, -0.05, 0, { grain: 0.09 });
    p(0.045, 0.04, 0.04, GOLD, 0, -0.16, 0);
    p(0.11, 0.035, 0.04, GOLD, 0, 0.07, 0);
    p(0.05, 0.3, 0.018, head, 0, 0.24, 0, { n: 2, grain: 0.05 });
    p(0.016, 0.28, 0.024, headHi, 0, 0.24, 0, { detail: true });
    p(0.03, 0.07, 0.016, head, 0, 0.42, 0, { rz: 0 });
  } else if (id === LASSO) {
    const rope = 0xcfae6c;
    const ropeD = 0x9a7f45;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      p(0.055, 0.028, 0.035, i % 2 ? rope : ropeD, Math.cos(a) * 0.085, 0.12, Math.sin(a) * 0.085, { ry: -a });
      p(0.05, 0.026, 0.032, i % 2 ? ropeD : rope, Math.cos(a) * 0.07, 0.095, Math.sin(a) * 0.07, { ry: -a, detail: true });
    }
    p(0.026, 0.2, 0.026, rope, 0.07, 0.0, 0, { rz: 0.2 });
    p(0.045, 0.035, 0.045, ropeD, 0.085, -0.09, 0, { detail: true });
  } else if (id === REVOLVER) {
    const steel = 0x4a4a55;
    const steelHi = 0x8d8d9a;
    p(0.045, 0.14, 0.05, 0x7a4e28, 0, -0.05, 0.03, { rx: -0.2, grain: 0.08 });
    p(0.048, 0.03, 0.052, 0x5e3a1c, 0, -0.12, 0.045);
    p(0.05, 0.075, 0.1, steel, 0, 0.035, -0.01);
    p(0.056, 0.06, 0.07, 0x33333c, 0, 0.03, -0.035, { n: 2, grain: 0.08 });
    p(0.03, 0.032, 0.17, steelHi, 0, 0.05, -0.11);
    p(0.012, 0.014, 0.02, steelHi, 0, 0.072, -0.18, { detail: true });
    p(0.026, 0.032, 0.03, steel, 0, 0.072, 0.032);
    p(0.02, 0.03, 0.028, steelHi, 0, -0.005, -0.005, { detail: true });
  } else if (id === BOW) {
    const limb = 0x8a5a28;
    const limbHi = 0xa8703a;
    p(0.032, 0.12, 0.034, limbHi, 0, 0, 0);
    p(0.026, 0.15, 0.028, limb, 0, 0.12, 0.012, { rx: 0.22 });
    p(0.026, 0.15, 0.028, limb, 0, -0.12, 0.012, { rx: -0.22 });
    p(0.024, 0.13, 0.026, limb, 0, 0.24, 0.055, { rx: 0.6 });
    p(0.024, 0.13, 0.026, limb, 0, -0.24, 0.055, { rx: -0.6 });
    p(0.02, 0.09, 0.022, limbHi, 0, 0.31, 0.115, { rx: 1.0, detail: true });
    p(0.02, 0.09, 0.022, limbHi, 0, -0.31, 0.115, { rx: -1.0, detail: true });
    p(0.012, 0.68, 0.012, 0xefe7d6, 0, 0, 0.15, { flat: true, grain: 0 });
  } else if (id === STICK) {
    p(0.03, 0.3, 0.03, WOOD, 0, 0, 0, { grain: 0.1 });
    p(0.034, 0.04, 0.034, WOOD_HI, 0, 0.13, 0, { detail: true });
  } else if (id === TORCH) {
    p(0.032, 0.24, 0.032, WOOD, 0, -0.02, 0, { grain: 0.1 });
    p(0.05, 0.05, 0.05, 0xd06a18, 0, 0.115, 0, { flat: true });
    p(0.036, 0.05, 0.036, 0xffc23a, 0, 0.145, 0, { flat: true });
    p(0.022, 0.03, 0.022, 0xfff0b0, 0, 0.175, 0, { flat: true, detail: true });
  } else if (isFlower(id)) {
    const petal = id === FLOWER_RED ? 0xd22d37 : id === FLOWER_YELLOW ? 0xe6be28 : 0xf0f0f4;
    p(0.02, 0.2, 0.02, 0x2e8a38, 0, 0.0, 0);
    p(0.055, 0.03, 0.02, 0x3aa044, 0.035, 0.02, 0, { rz: 0.5, detail: true });
    p(0.04, 0.045, 0.04, 0xe8d24a, 0, 0.14, 0, { flat: true });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      p(0.045, 0.025, 0.03, petal, Math.cos(a) * 0.042, 0.14, Math.sin(a) * 0.042, { ry: -a });
    }
  } else if (id === RAW_MEAT || id === COOKED_MEAT) {
    const m = id === RAW_MEAT ? 0xc05656 : 0x8a4a24;
    p(0.12, 0.09, 0.09, m, 0.02, 0.02, -0.02, { n: 2, grain: 0.1 });
    p(0.06, 0.06, 0.06, shadeHex(m, 1.18), 0.05, 0.03, -0.02, { detail: true });
    p(0.09, 0.035, 0.035, 0xefe6d2, -0.09, -0.02, -0.02, { rz: -0.35 });
    p(0.045, 0.04, 0.04, 0xefe6d2, -0.14, -0.05, -0.02, { detail: true });
  } else if (id === FRUIT || id === COOKED_FRUIT) {
    const skin = id === FRUIT ? 0xc8322c : 0xd0812c;
    p(0.09, 0.085, 0.09, skin, 0, 0.01, -0.02, { n: 2, grain: 0.08 });
    p(0.04, 0.05, 0.04, shadeHex(skin, 1.25), -0.03, 0.03, 0.02, { flat: true, detail: true });
    p(0.016, 0.045, 0.016, 0x6b4526, 0.01, 0.07, -0.02);
    p(0.05, 0.016, 0.035, 0x3e9438, 0.045, 0.085, -0.02, { rz: 0.25, detail: true });
  } else if (id === HIDE_COW || id === HIDE_ZEBRA || id === HIDE_SHEEP) {
    const base = id === HIDE_COW ? 0x7d5231 : id === HIDE_ZEBRA ? 0xefeade : 0xece7da;
    p(0.17, 0.028, 0.13, base, 0, 0, -0.02, { n: 2, grain: 0.08 });
    if (id === HIDE_COW) {
      p(0.05, 0.032, 0.05, 0xd8c6a6, -0.03, 0.001, 0.0);
      p(0.04, 0.032, 0.04, 0xd8c6a6, 0.04, 0.001, -0.04);
    } else if (id === HIDE_ZEBRA) {
      p(0.022, 0.032, 0.135, 0x231f1c, -0.045, 0.001, -0.02);
      p(0.022, 0.032, 0.135, 0x231f1c, 0.015, 0.001, -0.02);
    } else {
      p(0.06, 0.05, 0.06, 0xf4f0e4, -0.03, 0.01, -0.01, { grain: 0.12 });
      p(0.06, 0.05, 0.06, 0xdcd6c4, 0.035, 0.008, -0.04, { grain: 0.12 });
    }
  } else if (id === DOOR || id === DOOR_DOUBLE) {
    const wood = 0xa97a3c;
    const trim = 0x8d6229;
    const leaf = (ox) => {
      p(0.11, 0.28, 0.035, wood, ox, 0.02, -0.03, { n: 2, grain: 0.06 });
      p(0.115, 0.02, 0.04, trim, ox, 0.155, -0.03);
      p(0.115, 0.02, 0.04, trim, ox, -0.115, -0.03);
      p(0.05, 0.05, 0.042, 0x8fc7da, ox, 0.09, -0.03, { flat: true });
    };
    leaf(0);
    if (id === DOOR_DOUBLE) leaf(0.115);
  } else if (id === STAIRS || id === STAIRS_SAND || id === STAIRS_STONE) {
    const c = id === STAIRS ? 0xc08b4c : id === STAIRS_SAND ? 0xd6c47c : 0x9a9aa4;
    p(0.18, 0.07, 0.14, c, -0.02, -0.045, -0.02, { n: 2, grain: 0.07 });
    p(0.09, 0.07, 0.14, c, 0.045, 0.025, -0.02, { n: 2, grain: 0.07 });
  } else if (id === LADDER) {
    p(0.024, 0.3, 0.024, 0x8a5a28, -0.055, 0, -0.02, { grain: 0.08 });
    p(0.024, 0.3, 0.024, 0x8a5a28, 0.055, 0, -0.02, { grain: 0.08 });
    for (const ry of [-0.1, 0.0, 0.1]) p(0.12, 0.022, 0.022, 0xc48f4c, 0, ry, -0.02);
  } else if (id === COAL) {
    const lump = 0x2f2f38;
    p(0.11, 0.1, 0.1, lump, 0, 0, -0.02, { n: 2, grain: 0.2 });
    p(0.075, 0.075, 0.09, lump, 0.05, 0.03, -0.005, { ry: 0.5, grain: 0.2 });
    p(0.065, 0.085, 0.075, lump, -0.048, -0.022, -0.045, { rz: 0.4, grain: 0.2 });
    p(0.05, 0.045, 0.05, 0x4d4d5c, 0.005, 0.052, 0.005, { flat: true, detail: true });
  } else if (id === IRON) {
    p(0.17, 0.032, 0.095, 0xa9b0be, 0, -0.028, -0.02);
    p(0.145, 0.035, 0.078, 0xd5dae4, 0, 0.002, -0.02, { n: 2, grain: 0.05 });
    p(0.12, 0.016, 0.06, 0xeef2f8, 0, 0.025, -0.02, { flat: true, detail: true });
  } else if (id === WALL_WOOD || id === WALL_GLASS) {
    const post = id === WALL_WOOD ? 0xb98446 : 0xcfe6ef;
    const rail = id === WALL_WOOD ? 0x8a5a28 : 0xa9d6e4;
    p(0.035, 0.3, 0.035, post, -0.06, 0, -0.02, { grain: 0.07 });
    p(0.035, 0.3, 0.035, post, 0.06, 0, -0.02, { grain: 0.07 });
    p(0.16, 0.028, 0.028, rail, 0, 0.07, -0.02);
    p(0.16, 0.028, 0.028, rail, 0, -0.05, -0.02);
  }
  return out;
}
