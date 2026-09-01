import * as THREE from 'three';
import { AIR, FLOWER_RED, FLOWER_YELLOW, FLOWER_WHITE, RAW_MEAT, HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP, isSolid, isLiquid, isRug } from './blocks.js';
import { HEIGHT, UNLOAD_RADIUS, BIOME_DESERT, BIOME_MOUNTAIN, BIOME_CANYON } from './world.js';
import { solidBoxes, aabbHitsBox } from './stairs.js';

const MAX_NEAR = 52;
const UNLOAD = UNLOAD_RADIUS * 16;
const RUG_SEEK_R = 16;
const RUG_SEEK_RETRY = 2.4;

const WOMAN_WEAR = [0xc62828, 0xe85a9a, 0xf5f2ea, 0xe8c220, 0xe07020];
const MAN_WEAR = [0x2a5caa, 0x1e5a32, 0x6b3e22];

export const KINDS = {
  cow: {
    nameKey: 'mobCow', hp: 10, speed: 1.55, w: 0.9, h: 1.12,
    hostile: false, person: false, meat: 2, hide: HIDE_COW, step: 1,
  },
  zebra: {
    nameKey: 'mobZebra', hp: 10, speed: 1.85, w: 0.85, h: 1.15,
    hostile: false, person: false, meat: 2, hide: HIDE_ZEBRA, step: 1,
  },
  chicken: {
    nameKey: 'mobChicken', hp: 4, speed: 1.7, w: 0.4, h: 0.52,
    hostile: false, person: false, meat: 1, hide: 0, step: 1,
  },
  sheep: {
    nameKey: 'mobSheep', hp: 8, speed: 1.5, w: 0.72, h: 0.95,
    hostile: false, person: false, meat: 1, hide: HIDE_SHEEP, step: 1,
  },
  lion: {
    nameKey: 'mobLion', hp: 18, speed: 3.1, w: 0.88, h: 1.05,
    hostile: true, nocturnal: true, person: false, meat: 3, hide: 0, damage: 4, range: 16, step: 2,
  },
  tiger: {
    nameKey: 'mobTiger', hp: 18, speed: 3.2, w: 0.86, h: 1.02,
    hostile: true, nocturnal: true, person: false, meat: 3, hide: 0, damage: 4, range: 16, step: 2,
  },
  bull: {
    nameKey: 'mobBull', hp: 16, speed: 2.6, w: 1.02, h: 1.28,
    hostile: true, person: false, meat: 3, hide: 0, damage: 5, range: 12, step: 1,
  },
  man: {
    nameKey: 'mobMan', hp: 12, speed: 2.2, w: 0.5, h: 1.78,
    hostile: false, person: true, meat: 0, hide: 0, step: 1,
  },
  woman: {
    nameKey: 'mobWoman', hp: 12, speed: 2.15, w: 0.48, h: 1.7,
    hostile: false, person: true, meat: 0, hide: 0, step: 1,
  },
};

function mulberry(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

function darken(hex, f = 0.55) {
  const r = Math.min(255, Math.floor(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.floor(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.floor((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

const HAIR_TONES = [
  [0x1c1210, 0x2a1810, 0x3d2414, 0x4a2a12],
  [0xc8b060, 0xdbc478, 0xe8d490, 0xb89a48],
  [0xa83818, 0xc44a22, 0xd06030, 0x8a2810],
];

function pickHair(rng) {
  const hairs = HAIR_TONES[Math.floor(rng() * HAIR_TONES.length) % HAIR_TONES.length];
  return hairs[Math.floor(rng() * hairs.length) % hairs.length];
}

function pickWomanLook(seed) {
  const rng = mulberry(seed | 0);
  return {
    hair: pickHair(rng),
    lip: mixHex(0xe890a0, 0x8a1828, rng()),
    eyeS: 0.76 + rng() * 0.48,
    noseS: 0.7 + rng() * 0.55,
  };
}

function pickManLook(seed) {
  const rng = mulberry(seed | 0);
  return {
    hair: pickHair(rng),
    eyeS: 0.76 + rng() * 0.48,
    noseS: 0.7 + rng() * 0.55,
  };
}

function flowerHangout(x, y, z, seed) {
  const rng = mulberry((seed * 1103515245 + (Math.floor(x) * 73856093) + (Math.floor(z) * 19349663)) | 0);
  const ang = rng() * Math.PI * 2;
  const r = 2.4 + rng() * 4.2;
  return { x, y, z, ox: Math.cos(ang) * r, oz: Math.sin(ang) * r };
}

function ensureHangout(home, seed) {
  if (!home) return home;
  if (home.ox != null && home.oz != null) return home;
  const spot = flowerHangout(home.x, home.y, home.z, seed);
  home.ox = spot.ox;
  home.oz = spot.oz;
  return home;
}

function pickWear(kind, seed) {
  const rng = mulberry(seed | 0);
  const pal = kind === 'woman' ? WOMAN_WEAR : kind === 'man' ? MAN_WEAR : null;
  if (!pal) return 0;
  return pal[Math.floor(rng() * pal.length) % pal.length];
}

function makeModel(kind, wear = 0, seed = 1) {
  const g = new THREE.Group();
  if (kind === 'cow') {
    g.add(box(0.85, 0.55, 0.5, 0x6b4423, 0, 0.62, 0));
    g.add(box(0.22, 0.18, 0.16, 0xd8c4a8, 0.42, 0.72, 0));
    g.add(box(0.32, 0.28, 0.28, 0x5a381c, 0.48, 0.92, 0));
    g.add(box(0.08, 0.12, 0.06, 0x3a2414, 0.58, 1.08, 0.1));
    g.add(box(0.08, 0.12, 0.06, 0x3a2414, 0.58, 1.08, -0.1));
    g.add(box(0.12, 0.42, 0.12, 0x4a3018, 0.28, 0.22, 0.16));
    g.add(box(0.12, 0.42, 0.12, 0x4a3018, 0.28, 0.22, -0.16));
    g.add(box(0.12, 0.42, 0.12, 0x4a3018, -0.28, 0.22, 0.16));
    g.add(box(0.12, 0.42, 0.12, 0x4a3018, -0.28, 0.22, -0.16));
    g.add(box(0.18, 0.16, 0.08, 0xe8d8c8, 0.1, 0.7, 0.22));
  } else if (kind === 'zebra') {
    g.add(box(0.82, 0.52, 0.42, 0xf2eee6, 0, 0.64, 0));
    g.add(box(0.12, 0.48, 0.44, 0x1a1814, 0.18, 0.64, 0));
    g.add(box(0.12, 0.48, 0.44, 0x1a1814, -0.18, 0.64, 0));
    g.add(box(0.28, 0.3, 0.26, 0xf2eee6, 0.48, 0.95, 0));
    g.add(box(0.08, 0.28, 0.08, 0x1a1814, 0.52, 1.18, 0));
    g.add(box(0.1, 0.4, 0.1, 0x1a1814, 0.26, 0.22, 0.14));
    g.add(box(0.1, 0.4, 0.1, 0xf2eee6, 0.26, 0.22, -0.14));
    g.add(box(0.1, 0.4, 0.1, 0xf2eee6, -0.26, 0.22, 0.14));
    g.add(box(0.1, 0.4, 0.1, 0x1a1814, -0.26, 0.22, -0.14));
  } else if (kind === 'chicken') {
    g.add(box(0.32, 0.28, 0.24, 0xf4f0e4, 0, 0.28, 0));
    g.add(box(0.2, 0.18, 0.18, 0xf4f0e4, 0.18, 0.4, 0));
    g.add(box(0.1, 0.06, 0.08, 0xf0a020, 0.3, 0.38, 0));
    g.add(box(0.08, 0.1, 0.06, 0xd43030, 0.18, 0.52, 0));
    g.add(box(0.2, 0.06, 0.28, 0xe8e0d0, 0, 0.34, 0));
    g.add(box(0.05, 0.16, 0.05, 0xf0a020, 0.06, 0.08, 0.06));
    g.add(box(0.05, 0.16, 0.05, 0xf0a020, 0.06, 0.08, -0.06));
  } else if (kind === 'sheep') {
    g.add(box(0.7, 0.5, 0.5, 0xf0ece2, 0, 0.58, 0));
    g.add(box(0.26, 0.24, 0.24, 0xc4b090, 0.4, 0.62, 0));
    g.add(box(0.1, 0.32, 0.1, 0xc4b090, 0.22, 0.18, 0.14));
    g.add(box(0.1, 0.32, 0.1, 0xc4b090, 0.22, 0.18, -0.14));
    g.add(box(0.1, 0.32, 0.1, 0xc4b090, -0.22, 0.18, 0.14));
    g.add(box(0.1, 0.32, 0.1, 0xc4b090, -0.22, 0.18, -0.14));
  } else if (kind === 'lion') {
    const fur = 0xe09030;
    const mane = 0xc43028;
    g.add(box(0.8, 0.48, 0.42, fur, 0, 0.58, 0));
    g.add(box(0.58, 0.5, 0.58, mane, 0.34, 0.9, 0));
    g.add(box(0.28, 0.24, 0.26, fur, 0.54, 0.88, 0));
    g.add(box(0.08, 0.1, 0.08, mane, 0.42, 1.16, 0.16));
    g.add(box(0.08, 0.1, 0.08, mane, 0.42, 1.16, -0.16));
    g.add(box(0.1, 0.22, 0.08, mane, -0.44, 0.62, 0));
    g.add(box(0.12, 0.36, 0.1, fur, 0.24, 0.2, 0.14));
    g.add(box(0.12, 0.36, 0.1, fur, 0.24, 0.2, -0.14));
    g.add(box(0.12, 0.36, 0.1, fur, -0.24, 0.2, 0.14));
    g.add(box(0.12, 0.36, 0.1, fur, -0.24, 0.2, -0.14));
  } else if (kind === 'tiger') {
    const fur = 0xf07820;
    const stripe = 0x141210;
    g.add(box(0.84, 0.46, 0.4, fur, 0, 0.56, 0));
    g.add(box(0.08, 0.46, 0.42, stripe, 0.22, 0.56, 0));
    g.add(box(0.08, 0.46, 0.42, stripe, 0.02, 0.56, 0));
    g.add(box(0.08, 0.46, 0.42, stripe, -0.18, 0.56, 0));
    g.add(box(0.08, 0.46, 0.42, stripe, -0.36, 0.56, 0));
    g.add(box(0.3, 0.26, 0.26, fur, 0.5, 0.82, 0));
    g.add(box(0.08, 0.22, 0.28, stripe, 0.5, 0.82, 0));
    g.add(box(0.1, 0.12, 0.06, 0xf4f0e4, 0.62, 0.78, 0.1));
    g.add(box(0.1, 0.12, 0.06, 0xf4f0e4, 0.62, 0.78, -0.1));
    g.add(box(0.1, 0.34, 0.1, stripe, 0.26, 0.18, 0.12));
    g.add(box(0.1, 0.34, 0.1, fur, 0.26, 0.18, -0.12));
    g.add(box(0.1, 0.34, 0.1, fur, -0.26, 0.18, 0.12));
    g.add(box(0.1, 0.34, 0.1, stripe, -0.26, 0.18, -0.12));
  } else if (kind === 'bull') {
    g.add(box(0.95, 0.62, 0.52, 0x2a1c12, 0, 0.7, 0));
    g.add(box(0.36, 0.32, 0.32, 0x1a120c, 0.52, 1.02, 0));
    g.add(box(0.08, 0.22, 0.08, 0xe8dcc8, 0.58, 1.22, 0.16));
    g.add(box(0.08, 0.22, 0.08, 0xe8dcc8, 0.58, 1.22, -0.16));
    g.add(box(0.14, 0.48, 0.14, 0x1a120c, 0.3, 0.24, 0.16));
    g.add(box(0.14, 0.48, 0.14, 0x1a120c, 0.3, 0.24, -0.16));
    g.add(box(0.14, 0.48, 0.14, 0x1a120c, -0.3, 0.24, 0.16));
    g.add(box(0.14, 0.48, 0.14, 0x1a120c, -0.3, 0.24, -0.16));
  } else if (kind === 'man') {
    const cloth = wear || MAN_WEAR[0];
    const pants = 0x1a1e24;
    const skin = 0xc8a07a;
    const look = pickManLook(seed);
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
    g.add(box(0.12, 0.5, 0.12, pants, 0, 0.26, 0.1));
    g.add(box(0.12, 0.5, 0.12, pants, 0, 0.26, -0.1));
    g.add(box(0.2, 0.48, 0.36, pants, 0, 0.56, 0));
    g.add(box(0.22, 0.5, 0.38, cloth, 0, 1.05, 0));
    g.add(box(0.1, 0.42, 0.1, cloth, 0, 1.0, 0.24));
    g.add(box(0.1, 0.42, 0.1, cloth, 0, 1.0, -0.24));
    g.add(box(0.1, 0.08, 0.1, skin, 0, 1.28, 0));
    g.add(box(0.24, 0.26, 0.26, skin, 0, 1.42, 0));
    g.add(box(0.26, 0.09, 0.28, hair, 0, 1.56, 0));
    g.add(box(0.05, 0.1, 0.26, hair, -0.125, 1.51, 0));
    g.add(box(ew, eh, ed, 0xf7f2ea, eyeX, 1.46, 0.06));
    g.add(box(ew, eh, ed, 0xf7f2ea, eyeX, 1.46, -0.06));
    g.add(box(pw, ph, pd, 0x1a1410, pupilX, 1.46, 0.06));
    g.add(box(pw, ph, pd, 0x1a1410, pupilX, 1.46, -0.06));
    g.add(box(nw, nh, nd, 0xb89068, noseX, 1.4, 0));
    g.add(box(0.024, 0.02, 0.07, 0x8a5a50, 0.14, 1.335, 0));
  } else {
    const cloth = wear || WOMAN_WEAR[0];
    const skirt = darken(cloth, 0.72);
    const skin = 0xd4b08a;
    const look = pickWomanLook(seed);
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
    g.add(box(0.1, 0.48, 0.1, skirt, 0, 0.28, 0.08));
    g.add(box(0.1, 0.48, 0.1, skirt, 0, 0.28, -0.08));
    g.add(box(0.22, 0.76, 0.36, cloth, 0, 0.88, 0));
    g.add(box(0.06, 0.12, 0.1, cloth, 0.14, 1.16, 0.06));
    g.add(box(0.06, 0.12, 0.1, cloth, 0.14, 1.16, -0.06));
    g.add(box(0.09, 0.4, 0.09, skin, 0, 0.95, 0.22));
    g.add(box(0.09, 0.4, 0.09, skin, 0, 0.95, -0.22));
    g.add(box(0.1, 0.08, 0.1, skin, 0, 1.28, 0));
    g.add(box(0.22, 0.24, 0.24, skin, 0, 1.42, 0));
    g.add(box(0.26, 0.14, 0.28, hair, 0, 1.58, 0));
    g.add(box(0.1, 0.28, 0.24, hair, -0.15, 1.42, 0));
    g.add(box(0.2, 0.22, 0.08, hair, 0.02, 1.46, 0.145));
    g.add(box(0.2, 0.22, 0.08, hair, 0.02, 1.46, -0.145));
    g.add(box(0.06, 0.08, 0.2, hair, 0.12, 1.53, 0));
    g.add(box(ew, eh, ed, 0xf7f2ea, eyeX, 1.45, 0.055));
    g.add(box(ew, eh, ed, 0xf7f2ea, eyeX, 1.45, -0.055));
    g.add(box(pw, ph, pd, 0x1a1410, pupilX, 1.45, 0.055));
    g.add(box(pw, ph, pd, 0x1a1410, pupilX, 1.45, -0.055));
    g.add(box(nw, nh, nd, 0xc49872, noseX, 1.39, 0));
    g.add(box(0.025, 0.022, 0.08, lip, 0.135, 1.335, 0));
  }
  return g;
}

function groundY(world, x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  for (let y = HEIGHT - 1; y >= 1; y--) {
    const boxes = solidBoxes(world, ix, y, iz);
    if (!boxes.length) continue;
    let top = 0;
    for (const b of boxes) if (b.y1 > top) top = b.y1;
    return y + top;
  }
  return 2;
}

function waterDepth(world, x, z) {
  const gy = groundY(world, x, z);
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let d = 0;
  for (let y = Math.floor(gy); y < HEIGHT && d < 12; y++) {
    if (!isLiquid(world.get(ix, y, iz))) break;
    d += 1;
  }
  return d;
}

function isDeepWater(world, x, z) {
  return waterDepth(world, x, z) >= 2;
}

function awayFromWater(world, x, z) {
  const here = waterDepth(world, x, z);
  let bx = 0;
  let bz = 0;
  let best = here;
  let found = false;
  for (let r = 1; r <= 4; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const d = waterDepth(world, x + dx, z + dz);
        if (d < best) {
          best = d;
          bx = dx;
          bz = dz;
          found = true;
        }
      }
    }
    if (found) break;
  }
  if (!found) return null;
  return { x: bx, z: bz };
}

function overlapsSolid(world, x, y, z, w, h) {
  const hw = w * 0.5;
  const x0 = Math.floor(x - hw);
  const x1 = Math.floor(x + hw - 1e-6);
  const y0 = Math.floor(y);
  const y1 = Math.floor(y + h - 1e-6);
  const z0 = Math.floor(z - hw);
  const z1 = Math.floor(z + hw - 1e-6);
  for (let iy = y0; iy <= y1; iy++) {
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        for (const box of solidBoxes(world, ix, iy, iz)) {
          if (aabbHitsBox(x - hw, y, z - hw, x + hw, y + h, z + hw, ix, iy, iz, box)) return true;
        }
      }
    }
  }
  return false;
}

function rugAt(world, x, y, z) {
  return isRug(world.get(x, y, z));
}

function playerOnRug(player, x, y, z) {
  if (!player?.pos) return false;
  return Math.floor(player.pos.x) === x
    && Math.floor(player.pos.y + 0.05) === y
    && Math.floor(player.pos.z) === z;
}

function rugClaimedBy(list, x, y, z, except) {
  for (const o of list) {
    if (o === except || o.dying || !o.bed) continue;
    if (o.bed.x === x && o.bed.y === y && o.bed.z === z) return true;
  }
  return false;
}

function findFreeRug(world, e, list, player, radius = RUG_SEEK_R) {
  const x0 = Math.floor(e.x);
  const y0 = Math.floor(e.y + 0.05);
  const z0 = Math.floor(e.z);
  let best = null;
  let bestD = radius * radius + 1;
  for (let dy = -2; dy <= 3; dy++) {
    const y = y0 + dy;
    if (y < 1 || y >= HEIGHT - 1) continue;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 >= bestD) continue;
        const x = x0 + dx;
        const z = z0 + dz;
        if (!rugAt(world, x, y, z)) continue;
        if (playerOnRug(player, x, y, z)) continue;
        if (rugClaimedBy(list, x, y, z, e)) continue;
        bestD = d2;
        best = { x, y, z };
      }
    }
  }
  return best;
}

function pickKind(biome, rng, night) {
  const r = rng();
  if (biome === BIOME_DESERT || biome === BIOME_CANYON) {
    if (r < 0.45) return 'zebra';
    if (r < 0.7) return night ? 'lion' : 'zebra';
    if (r < 0.88) return 'lion';
    return 'tiger';
  }
  if (biome === BIOME_MOUNTAIN) {
    if (r < 0.55) return 'sheep';
    if (r < 0.78) return 'chicken';
    if (r < 0.9) return 'cow';
    return night ? 'lion' : 'sheep';
  }
  if (r < 0.22) return 'cow';
  if (r < 0.38) return 'chicken';
  if (r < 0.52) return 'sheep';
  if (r < 0.62) return 'woman';
  if (r < 0.72) return 'man';
  if (r < 0.8) return 'bull';
  if (r < 0.9) return night ? 'lion' : 'cow';
  return night ? 'tiger' : 'chicken';
}

function dyingBlink(e) {
  if (!e?.dying || e.deathDelay > 0) return false;
  return Math.floor((e.flashT || 0) * 10) % 2 === 0;
}

export class Life {
  constructor(scene) {
    this.list = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.nextId = 1;
    this.spawnAcc = 0;
    this.scene = scene;
    this.lassoedId = 0;
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xc4a060 });
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), ropeMat);
    this.rope.visible = false;
    this.rope.castShadow = false;
    this.group.add(this.rope);
    this._ropeUp = new THREE.Vector3(0, 1, 0);
    this._ropeDir = new THREE.Vector3();
  }

  dispose() {
    for (const e of this.list) this.dropMesh(e);
    if (this.rope) {
      this.group.remove(this.rope);
      this.rope.geometry?.dispose();
      this.rope.material?.dispose();
      this.rope = null;
    }
    this.scene.remove(this.group);
    this.list = [];
    this.lassoedId = 0;
  }

  dropMesh(e) {
    if (!e.mesh) return;
    this.group.remove(e.mesh);
    e.mesh.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    e.mesh = null;
  }

  spawn(kind, x, y, z, extra = {}) {
    const def = KINDS[kind];
    if (!def) return null;
    const id = extra.id ?? this.nextId++;
    this.nextId = Math.max(this.nextId, id + 1);
    const wear = extra.wear ?? pickWear(kind, id ^ (Math.floor(x) * 73856093) ^ (Math.floor(z) * 19349663));
    const e = {
      id,
      kind,
      x, y, z,
      yaw: extra.yaw ?? Math.random() * Math.PI * 2,
      hp: extra.hp ?? def.hp,
      vx: 0, vy: 0, vz: 0,
      state: extra.state || 'wander',
      home: extra.home || null,
      wanderT: 1 + Math.random() * 3,
      bedSeekT: 0.2 + Math.random() * 0.8,
      attackCd: 0,
      hurtT: 0,
      onGround: false,
      wear,
      lassoed: !!extra.lassoed,
      bed: extra.bed || null,
      mesh: null,
    };
    e.mesh = makeModel(kind, wear, id);
    this.group.add(e.mesh);
    this.syncMesh(e);
    this.list.push(e);
    return e;
  }

  syncMesh(e) {
    if (!e.mesh) return;
    const sleeping = e.state === 'sleep';
    if (sleeping) {
      e.mesh.rotation.order = 'YXZ';
      e.mesh.rotation.set(-Math.PI / 2, e.yaw - Math.PI / 2, 0);
      e.mesh.position.set(e.x, e.y + 0.16, e.z);
    } else {
      e.mesh.rotation.order = 'XYZ';
      e.mesh.rotation.set(0, e.yaw - Math.PI / 2, 0);
      e.mesh.position.set(e.x, e.y, e.z);
    }
    const flash = e.hurtT > 0 || dyingBlink(e);
    const caught = !!e.lassoed && !e.dying;
    e.mesh.traverse((o) => {
      if (o.material && o.material.emissive) {
        o.material.emissive.setHex(flash ? 0xff1a1a : caught ? 0x4a3810 : 0);
        if (o.material.color) {
          if (o.material.userData.baseHex == null) o.material.userData.baseHex = o.material.color.getHex();
          o.material.color.setHex(flash && e.dying ? 0xff3a3a : o.material.userData.baseHex);
        }
      }
    });
  }

  serialize() {
    return this.list.filter((e) => !e.dying).map((e) => ({
      id: e.id,
      kind: e.kind,
      x: e.x, y: e.y, z: e.z,
      yaw: e.yaw,
      hp: e.hp,
      state: e.state,
      home: e.home,
      wear: e.wear || 0,
      lassoed: !!e.lassoed,
      bed: e.bed || null,
    }));
  }

  load(data, world) {
    for (const e of this.list) this.dropMesh(e);
    this.list = [];
    this.nextId = 1;
    this.lassoedId = 0;
    if (!Array.isArray(data)) return;
    for (const raw of data) {
      if (!KINDS[raw.kind]) continue;
      const spawned = this.spawn(raw.kind, raw.x, raw.y, raw.z, {
        id: raw.id, yaw: raw.yaw, hp: raw.hp, state: raw.state, home: raw.home, wear: raw.wear, lassoed: raw.lassoed, bed: raw.bed,
      });
      if (spawned) {
        if (world && overlapsSolid(world, spawned.x, spawned.y, spawned.z, KINDS[spawned.kind].w, KINDS[spawned.kind].h)) {
          spawned.y = groundY(world, spawned.x, spawned.z);
        }
        if (spawned.lassoed) this.lassoedId = spawned.id;
      }
    }
  }

  holdingFlower(inv) {
    const a = inv?.selectedStack()?.id;
    const b = inv?.offhand?.id;
    return a === FLOWER_RED || a === FLOWER_YELLOW || a === FLOWER_WHITE
      || b === FLOWER_RED || b === FLOWER_YELLOW || b === FLOWER_WHITE;
  }

  assignFlowerHome(x, y, z) {
    for (const e of this.list) {
      if (e.kind !== 'woman') continue;
      if (e.state === 'follow') {
        e.home = flowerHangout(x, y, z, e.id);
        e.state = 'home';
      }
    }
  }

  clearFlowerHome(x, y, z) {
    for (const e of this.list) {
      if (!e.home) continue;
      if (e.home.x === x && e.home.y === y && e.home.z === z) {
        e.home = null;
        if (e.state === 'home') e.state = 'wander';
      }
    }
  }

  getLassoed() {
    if (!this.lassoedId) return null;
    return this.list.find((e) => e.id === this.lassoedId) || null;
  }

  setLassoed(e) {
    if (!e || e.dying) return;
    const prev = this.getLassoed();
    if (prev && prev !== e) prev.lassoed = false;
    if (!e) {
      this.lassoedId = 0;
      return;
    }
    e.lassoed = true;
    e.state = 'lassoed';
    e.bed = null;
    this.lassoedId = e.id;
  }

  clearLasso() {
    const e = this.getLassoed();
    if (e) {
      e.lassoed = false;
      e.state = 'wander';
    }
    this.lassoedId = 0;
  }

  snapLassoedTo(x, y, z, yaw = 0) {
    const e = this.getLassoed();
    if (!e) return;
    const ang = yaw + Math.PI;
    e.x = x + Math.sin(ang) * 1.8;
    e.z = z + Math.cos(ang) * 1.8;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.vz = 0;
    this.syncMesh(e);
  }

  syncRope(player) {
    const e = this.getLassoed();
    if (!e || !player || !this.rope) {
      if (this.rope) this.rope.visible = false;
      return;
    }
    const def = KINDS[e.kind];
    const ax = player.pos.x;
    const ay = player.pos.y + 1.05;
    const az = player.pos.z;
    const bx = e.x;
    const by = e.y + def.h * 0.55;
    const bz = e.z;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 0.01;
    this.rope.visible = true;
    this.rope.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    this._ropeDir.set(dx / len, dy / len, dz / len);
    this.rope.quaternion.setFromUnitVectors(this._ropeUp, this._ropeDir);
    this.rope.scale.set(1, len, 1);
  }

  raycast(origin, dir, maxDist = 5.5) {
    let best = null;
    let bestT = maxDist;
    for (const e of this.list) {
      if (e.dying) continue;
      const def = KINDS[e.kind];
      let min;
      let max;
      if (e.state === 'sleep' && def.person) {
        const along = def.h * 0.48;
        const hx = Math.abs(Math.sin(e.yaw)) * along + def.w * 0.55;
        const hz = Math.abs(Math.cos(e.yaw)) * along + def.w * 0.55;
        min = { x: e.x - hx, y: e.y, z: e.z - hz };
        max = { x: e.x + hx, y: e.y + 0.42, z: e.z + hz };
      } else {
        const hw = def.w * 0.5;
        min = { x: e.x - hw, y: e.y, z: e.z - hw };
        max = { x: e.x + hw, y: e.y + def.h, z: e.z + hw };
      }
      const t = rayAabb(origin, dir, min, max, bestT);
      if (t != null && t < bestT) {
        bestT = t;
        best = { e, dist: t };
      }
    }
    return best;
  }

  hurt(e, amount, from, opts = {}) {
    if (!e || amount <= 0 || e.dying) return [];
    e.hp -= amount;
    e.hurtT = 0.25;
    const def = KINDS[e.kind];
    if (from) {
      const dx = e.x - from.x;
      const dz = e.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      e.vx += (dx / len) * 4;
      e.vz += (dz / len) * 4;
      if (!def.hostile && !opts.delayDeath) {
        e.state = 'flee';
        e.bed = null;
      }
    }
    if (e.hp > 0) return [];
    const loot = [];
    if (def.meat) loot.push({ id: RAW_MEAT, n: def.meat });
    if (def.hide) loot.push({ id: def.hide, n: 1 });
    if (def.person && Math.random() < 0.12) loot.push({ id: FLOWER_RED, n: 1 });
    if (opts.delayDeath) {
      e.hp = 0;
      e.dying = true;
      e.deathDelay = opts.deathDelay || 0;
      e.deathFlash = 0.55;
      e.flashT = 0;
      e.pendingLoot = loot;
      e.state = 'dying';
      e.lassoed = false;
      if (e.id === this.lassoedId) this.lassoedId = 0;
      return [];
    }
    this.remove(e);
    return loot;
  }

  finishDeath(e, ctx) {
    if (!e) return;
    const loot = e.pendingLoot || [];
    const pos = { x: e.x, y: e.y, z: e.z };
    this.remove(e);
    if (ctx?.deaths) ctx.deaths.push({ loot, x: pos.x, y: pos.y, z: pos.z });
  }

  remove(e) {
    if (e.id === this.lassoedId) this.lassoedId = 0;
    this.dropMesh(e);
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  trySpawn(world, player, night) {
    if (this.list.length >= MAX_NEAR) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 28;
    const x = player.pos.x + Math.cos(ang) * dist;
    const z = player.pos.z + Math.sin(ang) * dist;
    if (!world.chunks.has(world.chunkKey(Math.floor(x) >> 4, Math.floor(z) >> 4))) return;
    const y = groundY(world, x, z);
    const below = world.get(Math.floor(x), y - 1, Math.floor(z));
    const feet = world.get(Math.floor(x), y, Math.floor(z));
    const head = world.get(Math.floor(x), y + 1, Math.floor(z));
    if (isLiquid(below) || below === AIR) return;
    if (feet !== AIR || isLiquid(head)) return;
    if (isSolid(head)) return;
    if (isDeepWater(world, x, z)) return;
    for (const e of this.list) {
      if ((e.x - x) ** 2 + (e.z - z) ** 2 < 36) return;
    }
    const biome = world.biomeAt(x, z);
    const rng = mulberry((Math.floor(x) * 73856093) ^ (Math.floor(z) * 19349663) ^ (this.nextId * 83492791));
    const kind = pickKind(biome, rng, night);
    const def = KINDS[kind];
    if (overlapsSolid(world, x, y, z, def.w, def.h)) return;
    this.spawn(kind, x, y, z);
    if (kind === 'woman' && Math.random() < 0.55 && this.list.length < MAX_NEAR) {
      this.spawn('man', x + 1.4, y, z + 0.4);
    }
  }

  populate(world, player, night) {
    for (let i = 0; i < 18 && this.list.length < 28; i++) {
      this.trySpawn(world, player, night);
    }
  }

  bedStillGood(world, e, player) {
    const b = e.bed;
    if (!b) return false;
    if (!rugAt(world, b.x, b.y, b.z)) return false;
    if (e.state !== 'sleep' && playerOnRug(player, b.x, b.y, b.z)) return false;
    return true;
  }

  tickPersonSleep(e, world, player, dt) {
    e.bedSeekT = (e.bedSeekT || 0) - dt;
    if (e.state === 'sleep' || e.state === 'bed') {
      if (!this.bedStillGood(world, e, player)) {
        e.state = e.kind === 'woman' && e.home ? 'home' : 'wander';
        e.bed = null;
        e.bedSeekT = 0.4;
        return;
      }
      if (e.state === 'bed' && e.wanderT <= 0) {
        e.bed = null;
        e.state = 'wander';
        e.bedSeekT = 0.35;
      }
      return;
    }
    if (e.state === 'flee') return;
    if (e.bedSeekT > 0) return;
    const found = findFreeRug(world, e, this.list, player);
    e.bedSeekT = RUG_SEEK_RETRY;
    if (!found) return;
    e.bed = found;
    e.state = 'bed';
    e.wanderT = 14;
  }

  lieOnRug(e, world) {
    const b = e.bed;
    if (!b) return;
    e.x = b.x + 0.5;
    e.z = b.z + 0.5;
    e.vx = 0;
    e.vz = 0;
    const hx = Math.floor(e.x + Math.sin(e.yaw) * 1.15);
    const hz = Math.floor(e.z + Math.cos(e.yaw) * 1.15);
    if (isSolid(world.get(hx, b.y, hz)) || isSolid(world.get(hx, b.y + 1, hz))) {
      e.yaw += Math.PI;
    }
    e.state = 'sleep';
  }

  update(dt, world, player, ctx) {
    this.spawnAcc += dt;
    if (this.spawnAcc > 1.6) {
      this.spawnAcc = 0;
      this.trySpawn(world, player, ctx.night);
    }

    const flower = ctx.holdingFlower;
    const px = player.pos.x;
    const py = player.pos.y;
    const pz = player.pos.z;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const def = KINDS[e.kind];
      const dx = e.x - px;
      const dz = e.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > UNLOAD && !(e.kind === 'woman' && e.home) && !e.bed && !e.lassoed && !e.dying) {
        this.remove(e);
        continue;
      }

      e.hurtT = Math.max(0, e.hurtT - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.wanderT -= dt;

      if (e.dying) {
        if (e.deathDelay > 0) {
          e.deathDelay = Math.max(0, e.deathDelay - dt);
        } else {
          e.flashT += dt;
          e.deathFlash -= dt;
          if (e.deathFlash <= 0) {
            this.finishDeath(e, ctx);
            continue;
          }
        }
        this.syncMesh(e);
        continue;
      }

      if (e.lassoed) {
        const follow = 2.15;
        if (dist > 10) {
          const nx = dx / (dist || 1);
          const nz = dz / (dist || 1);
          e.x = px + nx * follow;
          e.z = pz + nz * follow;
          e.y = py;
          e.vx = 0;
          e.vz = 0;
        } else if (dist > follow) {
          const pull = Math.min(dist - follow, 16 * dt);
          e.vx = 0;
          e.vz = 0;
          this.move(e, world, def, -(dx / dist) * pull, 0, 0);
          this.move(e, world, def, 0, 0, -(dz / dist) * pull);
        } else {
          e.vx *= Math.max(0, 1 - 10 * dt);
          e.vz *= Math.max(0, 1 - 10 * dt);
        }
        const wantY = py;
        if (Math.abs(e.y - wantY) > 0.15) {
          this.move(e, world, def, 0, (wantY - e.y) * Math.min(1, 10 * dt), 0);
        }
        e.vy -= 28 * dt;
        this.move(e, world, def, 0, e.vy * dt, 0);
        if (e.onGround && e.vy < 0) e.vy = 0;
        e.y = Math.max(1, Math.min(HEIGHT - 2, e.y));
        e.yaw = Math.atan2(px - e.x, pz - e.z);
        this.syncMesh(e);
        continue;
      }

      const duskNight = !!ctx.duskNight;
      const nightRest = def.person && (duskNight || !!ctx.night);
      const mayHunt = def.hostile && !ctx.sleeping && (!def.nocturnal || duskNight);
      const huntRange = mayHunt ? (duskNight ? def.range + 8 : def.range) : 0;

      if (nightRest) {
        this.tickPersonSleep(e, world, player, dt);
      } else if (e.state === 'sleep' || e.state === 'bed') {
        e.state = e.kind === 'woman' && e.home ? 'home' : 'wander';
        e.bed = null;
      }

      if (!mayHunt && e.state === 'chase') e.state = 'wander';
      if (e.state === 'sleep' || e.state === 'bed') {
        /* keep going to the rug */
      } else if (mayHunt && dist < huntRange && dist > 0.4) {
        e.state = 'chase';
      } else if (e.kind === 'woman' && flower && dist < 4.2) {
        e.state = 'follow';
      } else if (e.kind === 'woman' && e.home && e.state !== 'flee') {
        e.state = 'home';
      } else if (e.state === 'follow' && (!flower || dist > 18)) {
        e.state = e.home ? 'home' : 'wander';
      } else if (e.state === 'chase' && dist > huntRange + 6) {
        e.state = 'wander';
      } else if (e.state === 'flee' && dist > 16) {
        e.state = 'wander';
      }

      let tx = 0;
      let tz = 0;
      const wet = isDeepWater(world, e.x, e.z);
      const escape = wet ? awayFromWater(world, e.x, e.z) : null;
      if (escape && e.state !== 'sleep') {
        tx = escape.x;
        tz = escape.z;
      } else if (e.state === 'sleep') {
        tx = 0;
        tz = 0;
        if (e.bed) {
          e.x += ((e.bed.x + 0.5) - e.x) * Math.min(1, 10 * dt);
          e.z += ((e.bed.z + 0.5) - e.z) * Math.min(1, 10 * dt);
        }
      } else if (e.state === 'bed' && e.bed) {
        tx = e.bed.x + 0.5 - e.x;
        tz = e.bed.z + 0.5 - e.z;
        if (Math.hypot(tx, tz) < 0.55 && Math.abs(e.y - e.bed.y) < 1.8) {
          this.lieOnRug(e, world);
          tx = 0;
          tz = 0;
        }
      } else if (e.state === 'chase') {
        tx = px - e.x;
        tz = pz - e.z;
      } else if (e.state === 'follow') {
        if (dist > 2.1) {
          tx = px - e.x;
          tz = pz - e.z;
        }
      } else if (e.state === 'home' && e.home) {
        ensureHangout(e.home, e.id);
        const fx = e.home.x + 0.5;
        const fz = e.home.z + 0.5;
        const hx = fx + e.home.ox - e.x;
        const hz = fz + e.home.oz - e.z;
        const fromFlower = Math.hypot(e.x - fx, e.z - fz);
        const toSpot = Math.hypot(hx, hz);
        if (fromFlower > 7) {
          tx = hx;
          tz = hz;
        } else if (fromFlower < 1.8) {
          tx = e.x - fx;
          tz = e.z - fz;
        } else if (toSpot > 1.4) {
          tx = hx;
          tz = hz;
        } else if (e.wanderT <= 0) {
          const ang = Math.atan2(e.x - fx, e.z - fz) + (Math.random() - 0.5) * 1.8;
          const r = 2.2 + Math.random() * 4.4;
          e.home.ox = Math.sin(ang) * r;
          e.home.oz = Math.cos(ang) * r;
          e.wanderT = 2 + Math.random() * 4;
        }
      } else if (e.state === 'flee') {
        tx = dx;
        tz = dz;
      } else {
        if (e.wanderT <= 0) {
          e.yaw += (Math.random() - 0.5) * 2.2;
          e.wanderT = 1.2 + Math.random() * 4;
        }
        tx = Math.sin(e.yaw);
        tz = Math.cos(e.yaw);
        if (isDeepWater(world, e.x + tx * 1.4, e.z + tz * 1.4)) {
          e.yaw += Math.random() > 0.5 ? 1.35 : -1.35;
          tx = Math.sin(e.yaw);
          tz = Math.cos(e.yaw);
        }
      }

      const len = Math.hypot(tx, tz);
      const hurry = e.state === 'flee' || e.state === 'chase' || e.state === 'bed';
      const speed = def.speed * (hurry ? 1 : 0.55);
      if (len > 0.05 && e.state !== 'sleep') {
        e.yaw = Math.atan2(tx, tz);
        e.vx += ((tx / len) * speed - e.vx) * Math.min(1, 8 * dt);
        e.vz += ((tz / len) * speed - e.vz) * Math.min(1, 8 * dt);
      } else {
        e.vx *= Math.max(0, 1 - 8 * dt);
        e.vz *= Math.max(0, 1 - 8 * dt);
      }
      if (e.state === 'sleep') {
        e.vx = 0;
        e.vz = 0;
      }

      e.vy -= 28 * dt;
      this.move(e, world, def, e.vx * dt, 0, 0);
      e.onGround = false;
      this.move(e, world, def, 0, e.vy * dt, 0);
      this.move(e, world, def, 0, 0, e.vz * dt);
      if (e.onGround && e.vy < 0) e.vy = 0;
      e.y = Math.max(1, Math.min(HEIGHT - 2, e.y));

      if (def.hostile && e.state === 'chase' && !ctx.sleeping && dist < 1.35 && Math.abs(e.y - py) < 1.6 && e.attackCd <= 0) {
        player.hurt(def.damage);
        e.attackCd = 1.05;
        ctx.hitPlayer = true;
      }

      this.syncMesh(e);
    }
    this.syncRope(player);
  }

  move(e, world, def, dx, dy, dz) {
    if (dx) {
      const oldD = waterDepth(world, e.x, e.z);
      e.x += dx;
      const newD = waterDepth(world, e.x, e.z);
      const blocked = overlapsSolid(world, e.x, e.y, e.z, def.w, def.h)
        || (newD >= 2 && newD >= oldD);
      if (blocked && !this.tryStep(e, world, def, oldD)) {
        e.x -= dx;
        e.vx = 0;
      }
    }
    if (dz) {
      const oldD = waterDepth(world, e.x, e.z);
      e.z += dz;
      const newD = waterDepth(world, e.x, e.z);
      const blocked = overlapsSolid(world, e.x, e.y, e.z, def.w, def.h)
        || (newD >= 2 && newD >= oldD);
      if (blocked && !this.tryStep(e, world, def, oldD)) {
        e.z -= dz;
        e.vz = 0;
      }
    }
    if (dy) {
      e.y += dy;
      if (overlapsSolid(world, e.x, e.y, e.z, def.w, def.h)) {
        e.y -= dy;
        if (dy < 0) {
          e.onGround = true;
          e.vy = 0;
        } else e.vy = 0;
      }
    }
  }

  tryStep(e, world, def, oldDepth = 0) {
    const max = def.step || 1;
    const tries = max >= 2 ? [0.55, 1.08, 1.55, 2.12] : [0.55, 1.08];
    for (const up of tries) {
      if (up > max + 0.15) continue;
      if (overlapsSolid(world, e.x, e.y + up, e.z, def.w, def.h)) continue;
      const d = waterDepth(world, e.x, e.z);
      if (d >= 2 && d >= oldDepth) continue;
      e.y += up;
      return true;
    }
    return false;
  }
}

function rayAabb(origin, dir, min, max, maxT) {
  let tmin = 0;
  let tmax = maxT;
  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const d = dir[axis];
    const mn = min[axis];
    const mx = max[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null;
      continue;
    }
    const inv = 1 / d;
    let t0 = (mn - o) * inv;
    let t1 = (mx - o) * inv;
    if (t0 > t1) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax < tmin) return null;
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}
