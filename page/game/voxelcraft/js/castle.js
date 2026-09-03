import {
  AIR, STONE, COBBLE, PLANKS, GLASS, TORCH, DOOR, DOOR_UPPER, TABLE, FURNACE,
  STAIRS_STONE, LADDER, WALL_WOOD, SURPRISE_BOX, CASTLE_WALL, isGlass, isPlant, isLiquid,
} from './blocks.js';
import { hash2 } from './noise.js';
import { FACE_PZ, FACE_PX, FACE_NZ, FACE_NX } from './stairs.js';
import { doorKey, isDoorOpenId } from './doors.js';

const HEIGHT = 64;
const WATER_LEVEL = 28;
const SIZE = 48;
const DIST_MIN = 500;
const DIST_MAX = 800;
const WALL_H = 6;
const KEEP_X = 17;
const KEEP_Z = 24;
const KEEP_W = 14;
const KEEP_D = 14;
const FLOOR_H = 4;
const STAIR_STEPS = FLOOR_H + 1;
const GATE_X = 22;
const GATE_W = 2;
const STAIR_W = 2;

const layouts = new Map();

function mulberry(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inChunk(x, z, cx, cz) {
  return (x >> 4) === cx && (z >> 4) === cz;
}

function put(world, chunk, cx, cz, x, y, z, id) {
  if (!inChunk(x, z, cx, cz) || y < 1 || y >= HEIGHT) return false;
  world.setLocal(chunk, x & 15, y, z & 15, id);
  return true;
}

function putDir(world, chunk, cx, cz, x, y, z, id, facing) {
  if (!put(world, chunk, cx, cz, x, y, z, id)) return false;
  world.blockDir[`${x},${y},${z}`] = facing;
  return true;
}

function putDoorPair(world, chunk, cx, cz, x0, y, z, x1, facing) {
  const k0 = doorKey(x0, y, z);
  const k1 = doorKey(x1, y, z);
  if (!world.doors[k0]) world.doors[k0] = { facing, hinge: 0, px: x1, pz: z };
  if (!world.doors[k1]) world.doors[k1] = { facing, hinge: 1, px: x0, pz: z };
  put(world, chunk, cx, cz, x0, y, z, DOOR);
  put(world, chunk, cx, cz, x0, y + 1, z, DOOR_UPPER);
  put(world, chunk, cx, cz, x1, y, z, DOOR);
  put(world, chunk, cx, cz, x1, y + 1, z, DOOR_UPPER);
}

function putDoor(world, chunk, cx, cz, x, y, z, facing) {
  const k = doorKey(x, y, z);
  if (!world.doors[k]) world.doors[k] = { facing, hinge: 0 };
  put(world, chunk, cx, cz, x, y, z, DOOR);
  put(world, chunk, cx, cz, x, y + 1, z, DOOR_UPPER);
}

function isChestAt(c, x, y, z) {
  return c?.chest && c.chest.x === x && c.chest.y === y && c.chest.z === z;
}

function putLoot(world, chunk, cx, cz, c, x, y, z, id) {
  if (isChestAt(c, x, y, z)) return false;
  return put(world, chunk, cx, cz, x, y, z, id);
}

function along(facing) {
  if (facing === FACE_PX) return [1, 0];
  if (facing === FACE_NX) return [-1, 0];
  if (facing === FACE_PZ) return [0, 1];
  return [0, -1];
}

function perp(facing) {
  if (facing === FACE_PX || facing === FACE_NX) return [0, 1];
  return [1, 0];
}

function stairFootprint(x, z, facing, steps = STAIR_STEPS, width = STAIR_W) {
  const [dx, dz] = along(facing);
  const [px, pz] = perp(facing);
  const cells = [];
  for (let i = 0; i < steps; i++) {
    cells.push([x + dx * i, z + dz * i]);
    if (width > 1) cells.push([x + dx * i + px, z + dz * i + pz]);
  }
  return cells;
}

function holeSet(cells) {
  const s = new Set(cells.map(([x, z]) => `${x},${z}`));
  return (x, z) => s.has(`${x},${z}`);
}

function stampStairRun(world, chunk, cx, cz, x, y, z, facing, steps = STAIR_STEPS, width = STAIR_W) {
  const [dx, dz] = along(facing);
  const [px, pz] = perp(facing);
  for (let i = 0; i < steps; i++) {
    const sx = x + dx * i;
    const sy = y + i;
    const sz = z + dz * i;
    putDir(world, chunk, cx, cz, sx, sy, sz, STAIRS_STONE, facing);
    if (width > 1) putDir(world, chunk, cx, cz, sx + px, sy, sz + pz, STAIRS_STONE, facing);
    for (let h = 1; h <= 3; h++) {
      put(world, chunk, cx, cz, sx, sy + h, sz, AIR);
      if (width > 1) put(world, chunk, cx, cz, sx + px, sy + h, sz + pz, AIR);
    }
  }
}

function keepFlights(c) {
  const { keepX0, keepZ0, baseY } = c;
  return [
    { x: keepX0 + 1, z: keepZ0 + 2, y: baseY, facing: FACE_PX },
    { x: keepX0 + 5, z: keepZ0 + 4, y: baseY + FLOOR_H, facing: FACE_NX },
    { x: keepX0 + 1, z: keepZ0 + 2, y: baseY + FLOOR_H * 2, facing: FACE_PX },
  ];
}

function stairReserved(c) {
  const cells = [];
  for (const f of keepFlights(c)) cells.push(...stairFootprint(f.x, f.z, f.facing));
  return new Set(cells.map(([x, z]) => `${x},${z}`));
}

function sampleHeights(world, ox, oz) {
  const hs = [];
  for (let z = oz; z < oz + SIZE; z += 4) {
    for (let x = ox; x < ox + SIZE; x += 4) {
      hs.push(world.heightNoise(x, z));
    }
  }
  return hs;
}

function siteOk(world, ox, oz) {
  const hs = sampleHeights(world, ox, oz);
  let min = 99;
  let max = 0;
  for (const h of hs) {
    if (h < WATER_LEVEL) return null;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (max - min > 6) return null;
  const sorted = hs.slice().sort((a, b) => a - b);
  const baseY = sorted[sorted.length >> 1];
  if (baseY + 22 >= HEIGHT - 1) return null;
  const cx = ox + SIZE / 2;
  const cz = oz + SIZE / 2;
  const dist = Math.hypot(cx, cz);
  if (dist < DIST_MIN || dist > DIST_MAX) return null;
  return baseY;
}

function houseSpots(ox, oz, baseY) {
  return [
    { x0: ox + 5, z0: oz + 6, doorZFace: -1, backX: ox + 6, backZ: oz + 11 },
    { x0: ox + 36, z0: oz + 6, doorZFace: -1, backX: ox + 37, backZ: oz + 11 },
    { x0: ox + 5, z0: oz + 14, doorZFace: 1, backX: ox + 6, backZ: oz + 15 },
    { x0: ox + 36, z0: oz + 14, doorZFace: 1, backX: ox + 37, backZ: oz + 15 },
  ].map((h) => ({ ...h, y: baseY + 1 }));
}

function keepRooms(keepX0, keepZ0, baseY) {
  const rooms = [];
  const corners = [
    [keepX0 + 10, keepZ0 + 3],
    [keepX0 + 3, keepZ0 + 10],
    [keepX0 + 10, keepZ0 + 10],
  ];
  for (let floor = 0; floor < 3; floor++) {
    const y = baseY + floor * FLOOR_H + 1;
    for (const [x, z] of corners) rooms.push({ x, y, z, floor });
  }
  return rooms;
}

function pickTreasure(rng, ox, oz, baseY, keepX0, keepZ0, keepX1, keepZ1) {
  const rooms = keepRooms(keepX0, keepZ0, baseY);
  const houses = houseSpots(ox, oz, baseY).map((h) => ({ x: h.backX, y: h.y, z: h.backZ }));
  const roofY = baseY + 3 * FLOOR_H;
  const tower = { x: keepX1 - 1, y: roofY + 1, z: keepZ1 - 1 };
  const roll = rng();
  if (roll < 0.64) return rooms[Math.floor(rng() * rooms.length)];
  if (roll < 0.88) return houses[Math.floor(rng() * houses.length)];
  return tower;
}

function pickCastle(world) {
  const seed = world.seed >>> 0;
  const rng = mulberry(seed ^ 0xC45A1E);
  for (let i = 0; i < 140; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = DIST_MIN + rng() * (DIST_MAX - DIST_MIN);
    const cx = Math.floor(Math.cos(ang) * dist);
    const cz = Math.floor(Math.sin(ang) * dist);
    const ox = cx - (SIZE >> 1);
    const oz = cz - (SIZE >> 1);
    const baseY = siteOk(world, ox, oz);
    if (baseY != null) return buildLayout(world, ox, oz, baseY);
  }
  for (let r = DIST_MIN; r <= DIST_MAX; r += 24) {
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + hash2(seed, r, 9);
      const cx = Math.floor(Math.cos(ang) * r);
      const cz = Math.floor(Math.sin(ang) * r);
      const ox = cx - (SIZE >> 1);
      const oz = cz - (SIZE >> 1);
      const baseY = siteOk(world, ox, oz);
      if (baseY != null) return buildLayout(world, ox, oz, baseY);
    }
  }
  return null;
}

function sameCell(a, b) {
  return Math.floor(a.x) === Math.floor(b.x) && a.y === b.y && Math.floor(a.z) === Math.floor(b.z);
}

function treasureBounds(chest, ox, oz, keepX0, keepZ0, keepX1, keepZ1, baseY) {
  const house = houseSpots(ox, oz, baseY).find((h) => (
    chest.x >= h.x0 && chest.x <= h.x0 + 6
    && chest.z >= h.z0 && chest.z <= h.z0 + 6
    && chest.y === h.y
  ));
  if (house) return { x0: house.x0 + 1, z0: house.z0 + 1, x1: house.x0 + 5, z1: house.z0 + 5 };
  if (chest.y >= baseY + 3 * FLOOR_H + 1) {
    return { x0: keepX1 - 3, z0: keepZ1 - 3, x1: keepX1 - 1, z1: keepZ1 - 1 };
  }
  return { x0: keepX0 + 1, z0: keepZ0 + 1, x1: keepX1 - 1, z1: keepZ1 - 1 };
}

function hiddenGuardNear(chest, bounds) {
  const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [dx, dz] of deltas) {
    const x = chest.x + dx + 0.5;
    const z = chest.z + dz + 0.5;
    if (x >= bounds.x0 + 0.35 && x <= bounds.x1 + 0.65 && z >= bounds.z0 + 0.35 && z <= bounds.z1 + 0.65) {
      return { kind: 'guard', x, z, y: chest.y, yaw: Math.PI };
    }
  }
  return {
    kind: 'guard',
    x: (bounds.x0 + bounds.x1 + 1) * 0.5,
    z: (bounds.z0 + bounds.z1 + 1) * 0.5,
    y: chest.y,
    yaw: 0,
  };
}

function buildLayout(world, ox, oz, baseY) {
  const keepX0 = ox + KEEP_X;
  const keepZ0 = oz + KEEP_Z;
  const keepX1 = keepX0 + KEEP_W - 1;
  const keepZ1 = keepZ0 + KEEP_D - 1;
  const rng = mulberry((world.seed ^ (ox * 73856093) ^ (oz * 19349663)) | 0);
  const chest = pickTreasure(rng, ox, oz, baseY, keepX0, keepZ0, keepX1, keepZ1);
  const walkY = baseY + 5;
  const roofY = baseY + 3 * FLOOR_H;
  const posts = [
    { kind: 'guard', x: ox + GATE_X - 2.5, z: oz + 6.5, y: baseY + 1, yaw: Math.PI },
    { kind: 'guard', x: ox + GATE_X + 4.5, z: oz + 6.5, y: baseY + 1, yaw: Math.PI },
    { kind: 'guard', x: ox + 1.5, z: oz + SIZE / 2, y: walkY + 1, yaw: Math.PI / 2 },
    { kind: 'guard', x: ox + SIZE - 1.5, z: oz + SIZE / 2, y: walkY + 1, yaw: -Math.PI / 2 },
    { kind: 'guard', x: keepX0 + KEEP_W / 2, z: keepZ0 - 2.5, y: baseY + 1, yaw: Math.PI },
    { kind: 'lion', x: ox + 14.5, z: oz + 16.5, y: baseY + 1, yaw: 0 },
    { kind: 'lion', x: ox + 37.5, z: oz + 16.5, y: baseY + 1, yaw: 0 },
    { kind: 'tiger', x: ox + 24.5, z: oz + 18.5, y: baseY + 1, yaw: Math.PI },
    { kind: 'tiger', x: keepX0 + 3.5, z: keepZ0 + 6.5, y: baseY + 1, yaw: 0 },
  ];
  const hidden = [
    hiddenGuardNear(chest, treasureBounds(chest, ox, oz, keepX0, keepZ0, keepX1, keepZ1, baseY)),
    { kind: 'guard', x: keepX0 + 10.5, z: keepZ0 + 3.5, y: baseY + 1, yaw: Math.PI },
    { kind: 'guard', x: keepX0 + 3.5, z: keepZ0 + 10.5, y: baseY + FLOOR_H + 1, yaw: 0 },
    { kind: 'guard', x: keepX0 + 10.5, z: keepZ0 + 10.5, y: baseY + FLOOR_H * 2 + 1, yaw: Math.PI },
    { kind: 'guard', x: ox + 6.5, z: oz + 10.5, y: baseY + 1, yaw: 0 },
    { kind: 'guard', x: ox + 37.5, z: oz + 15.5, y: baseY + 1, yaw: Math.PI },
    { kind: 'guard', x: keepX1 - 0.5, z: keepZ1 - 1.5, y: roofY + 1, yaw: Math.PI },
  ];
  for (const p of hidden) {
    if (posts.some((q) => q.kind === p.kind && sameCell(p, q))) continue;
    posts.push(p);
  }
  return {
    ox, oz, size: SIZE, baseY,
    keepX0, keepZ0, keepX1, keepZ1,
    chest,
    posts,
  };
}

export function getCastle(world) {
  if (!world) return null;
  const seed = world.seed >>> 0;
  if (layouts.has(seed)) return layouts.get(seed);
  const c = pickCastle(world);
  layouts.set(seed, c);
  return c;
}

export function castleCenter(world) {
  const c = getCastle(world);
  if (!c) return null;
  return { x: c.ox + c.size * 0.5, z: c.oz + c.size * 0.5 };
}

/** CSS degrees to rotate a needle that points up at 0 so it faces the castle. */
export function castleNeedleDeg(world, px, pz, yaw) {
  const t = castleCenter(world);
  if (!t) return 0;
  const look = Math.atan2(-(t.x - px), -(t.z - pz));
  let a = look - yaw;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return -a * (180 / Math.PI);
}

export function inCastleFootprint(world, x, z) {
  const c = getCastle(world);
  if (!c) return false;
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  return ix >= c.ox && ix < c.ox + c.size && iz >= c.oz && iz < c.oz + c.size;
}

export function inCastleArea(world, x, z) {
  return inCastleFootprint(world, x, z);
}

export function isCastleChest(world, x, y, z) {
  const c = getCastle(world);
  if (!c?.chest) return false;
  return c.chest.x === x && c.chest.y === y && c.chest.z === z;
}

export function castleRespawn(world) {
  const c = getCastle(world);
  if (!c) return null;
  const x = c.ox + GATE_X + 1.5;
  const z = c.oz - 3.5;
  world.ensureAround(x, z, 2);
  const y = world.heightAt(Math.floor(x), Math.floor(z)) + 1;
  return { x, y, z };
}

export function castleOverlapsChunk(world, cx, cz) {
  const c = getCastle(world);
  if (!c) return false;
  const x0 = cx * 16;
  const z0 = cz * 16;
  const x1 = x0 + 15;
  const z1 = z0 + 15;
  return !(x1 < c.ox || x0 >= c.ox + c.size || z1 < c.oz || z0 >= c.oz + c.size);
}

function isGate(lx, lz) {
  return lz < 2 && lx >= GATE_X && lx < GATE_X + GATE_W;
}

function isOuterRing(lx, lz) {
  return lx === 0 || lx === SIZE - 1 || lz === 0 || lz === SIZE - 1;
}

function isInnerRing(lx, lz) {
  return lx === 1 || lx === SIZE - 2 || lz === 1 || lz === SIZE - 2;
}

function fillColumn(world, chunk, cx, cz, x, z, baseY, wall) {
  const top = wall ? Math.max(baseY, 1) : baseY;
  for (let y = 1; y < top; y++) put(world, chunk, cx, cz, x, y, z, wall ? CASTLE_WALL : STONE);
  put(world, chunk, cx, cz, x, baseY, z, wall ? CASTLE_WALL : COBBLE);
  for (let y = baseY + 1; y < HEIGHT; y++) put(world, chunk, cx, cz, x, y, z, AIR);
}

function stampWalls(world, chunk, cx, cz, c) {
  const { ox, oz, baseY } = c;
  const top = baseY + WALL_H;
  for (let lz = 0; lz < SIZE; lz++) {
    for (let lx = 0; lx < SIZE; lx++) {
      const x = ox + lx;
      const z = oz + lz;
      if (!inChunk(x, z, cx, cz)) continue;
      const outer = isOuterRing(lx, lz);
      const inner = isInnerRing(lx, lz);
      if (!outer && !inner) continue;
      const gate = isGate(lx, lz);
      if (outer) {
        for (let y = 1; y <= top; y++) {
          if (gate && y >= baseY + 1 && y <= baseY + 3) {
            put(world, chunk, cx, cz, x, y, z, AIR);
            continue;
          }
          put(world, chunk, cx, cz, x, y, z, CASTLE_WALL);
        }
        if (!gate && ((lx + lz) & 1) === 0) put(world, chunk, cx, cz, x, top + 1, z, CASTLE_WALL);
      } else {
        for (let y = 1; y <= baseY + 4; y++) {
          if (gate && y >= baseY + 1 && y <= baseY + 3) {
            put(world, chunk, cx, cz, x, y, z, AIR);
            continue;
          }
          put(world, chunk, cx, cz, x, y, z, CASTLE_WALL);
        }
        if (!gate) put(world, chunk, cx, cz, x, baseY + 5, z, COBBLE);
      }
    }
  }
  for (const [tx, tz] of [[0, 0], [SIZE - 4, 0], [0, SIZE - 4], [SIZE - 4, SIZE - 4]]) {
    for (let dz = 0; dz < 4; dz++) {
      for (let dx = 0; dx < 4; dx++) {
        const x = ox + tx + dx;
        const z = oz + tz + dz;
        if (!inChunk(x, z, cx, cz)) continue;
        for (let y = baseY + 1; y <= baseY + 9; y++) put(world, chunk, cx, cz, x, y, z, CASTLE_WALL);
        if ((dx + dz) & 1) put(world, chunk, cx, cz, x, baseY + 10, z, CASTLE_WALL);
      }
    }
  }
  putDoorPair(world, chunk, cx, cz, ox + GATE_X, baseY + 1, oz, ox + GATE_X + 1, 0);
}

function boxWalls(world, chunk, cx, cz, x0, z0, x1, z1, y0, y1, id, openings) {
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) continue;
      for (let y = y0; y <= y1; y++) {
        if (openings?.some((o) => o.x === x && o.z === z && y >= o.y0 && y <= o.y1)) continue;
        put(world, chunk, cx, cz, x, y, z, id);
      }
    }
  }
}

function fillFloor(world, chunk, cx, cz, x0, z0, x1, z1, y, id, skip) {
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (skip?.(x, z)) continue;
      put(world, chunk, cx, cz, x, y, z, id);
    }
  }
}

function stampWindows(world, chunk, cx, cz, x0, z0, x1, z1, y) {
  const spots = [];
  for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    spots.push([x, z0], [x, z1]);
  }
  for (let z = z0 + 2; z <= z1 - 2; z += 3) {
    spots.push([x0, z], [x1, z]);
  }
  for (const [x, z] of spots) put(world, chunk, cx, cz, x, y, z, GLASS);
}

function stampKeepPartitions(world, chunk, cx, cz, c, y0, y1, reserved) {
  const midX = c.keepX0 + 7;
  const midZ = c.keepZ0 + 7;
  const gap = 1;
  for (let z = c.keepZ0 + 1; z <= c.keepZ1 - 1; z++) {
    if (Math.abs(z - midZ) <= gap) continue;
    if (reserved.has(`${midX},${z}`)) continue;
    for (let y = y0; y <= y1; y++) put(world, chunk, cx, cz, midX, y, z, COBBLE);
  }
  for (let x = c.keepX0 + 1; x <= c.keepX1 - 1; x++) {
    if (Math.abs(x - midX) <= gap) continue;
    if (reserved.has(`${x},${midZ}`)) continue;
    for (let y = y0; y <= y1; y++) put(world, chunk, cx, cz, x, y, midZ, COBBLE);
  }
}

function furnishKeepFloor(world, chunk, cx, cz, c, y) {
  const { keepX0, keepZ0, keepX1, keepZ1 } = c;
  const spots = [
    { x: keepX0 + 9, z: keepZ0 + 2, table: true, crate: true, rack: true },
    { x: keepX0 + 2, z: keepZ0 + 9, table: true, furnace: true },
    { x: keepX0 + 9, z: keepZ0 + 9, table: true, crate: true, furnace: y === c.baseY + 1 },
  ];
  for (const s of spots) {
    if (s.table) putLoot(world, chunk, cx, cz, c, s.x, y, s.z, TABLE);
    if (s.furnace) putLoot(world, chunk, cx, cz, c, s.x + 2, y, s.z, FURNACE);
    if (s.crate) putLoot(world, chunk, cx, cz, c, s.x, y, s.z + 2, SURPRISE_BOX);
    if (s.rack) putDir(world, chunk, cx, cz, s.x + 1, y, s.z, WALL_WOOD, FACE_PX);
    put(world, chunk, cx, cz, s.x + 1, y + 1, s.z + 1, TORCH);
  }
  put(world, chunk, cx, cz, keepX1 - 2, y + 1, keepZ0 + 2, TORCH);
  put(world, chunk, cx, cz, keepX0 + 2, y + 1, keepZ1 - 2, TORCH);
}

function stampKeep(world, chunk, cx, cz, c) {
  const { keepX0, keepZ0, keepX1, keepZ1, baseY } = c;
  const stories = 3;
  const doorX = keepX0 + Math.floor(KEEP_W / 2);
  const flights = keepFlights(c);
  const reserved = stairReserved(c);
  for (let s = 0; s < stories; s++) {
    const y0 = baseY + 1 + s * FLOOR_H;
    const y1 = y0 + FLOOR_H - 1;
    const floorY = s === 0 ? baseY : y0 - 1;
    const holes = s === 0
      ? null
      : holeSet(stairFootprint(flights[s - 1].x, flights[s - 1].z, flights[s - 1].facing));
    fillFloor(world, chunk, cx, cz, keepX0 + 1, keepZ0 + 1, keepX1 - 1, keepZ1 - 1, floorY, COBBLE, holes);
    boxWalls(world, chunk, cx, cz, keepX0, keepZ0, keepX1, keepZ1, y0, y1, COBBLE, s === 0
      ? [{ x: doorX, z: keepZ0, y0, y1: y0 + 1 }]
      : []);
    stampKeepPartitions(world, chunk, cx, cz, c, y0, y1, reserved);
    stampWindows(world, chunk, cx, cz, keepX0, keepZ0, keepX1, keepZ1, y0 + 1);
    furnishKeepFloor(world, chunk, cx, cz, c, y0);
  }
  for (const f of flights) stampStairRun(world, chunk, cx, cz, f.x, f.y, f.z, f.facing);
  const roofY = baseY + stories * FLOOR_H;
  fillFloor(world, chunk, cx, cz, keepX0, keepZ0, keepX1, keepZ1, roofY, COBBLE, holeSet(
    stairFootprint(flights[2].x, flights[2].z, flights[2].facing),
  ));
  for (let z = keepZ0; z <= keepZ1; z++) {
    for (let x = keepX0; x <= keepX1; x++) {
      const edge = x === keepX0 || x === keepX1 || z === keepZ0 || z === keepZ1;
      if (edge && ((x + z) & 1) === 0) put(world, chunk, cx, cz, x, roofY + 1, z, COBBLE);
    }
  }
  putDoor(world, chunk, cx, cz, doorX, baseY + 1, keepZ0, 0);

  const tx0 = keepX1 - 4;
  const tz0 = keepZ1 - 4;
  const tx1 = keepX1;
  const tz1 = keepZ1;
  const towerTop = Math.min(HEIGHT - 2, roofY + 8);
  boxWalls(world, chunk, cx, cz, tx0, tz0, tx1, tz1, roofY + 1, towerTop, COBBLE, [
    { x: tx0 + 2, z: tz0, y0: roofY + 1, y1: roofY + 2 },
  ]);
  fillFloor(world, chunk, cx, cz, tx0 + 1, tz0 + 1, tx1 - 1, tz1 - 1, roofY, COBBLE);
  const spiral = [
    [tx0 + 1, tz0 + 1, FACE_PX],
    [tx0 + 2, tz0 + 1, FACE_PZ],
    [tx0 + 2, tz0 + 2, FACE_NX],
    [tx0 + 1, tz0 + 2, FACE_NZ],
  ];
  const rise = towerTop - roofY + 1;
  const topHoles = [];
  for (let i = 0; i < rise; i++) {
    const [x, z, facing] = spiral[i % 4];
    const y = roofY + i;
    putDir(world, chunk, cx, cz, x, y, z, STAIRS_STONE, facing);
    put(world, chunk, cx, cz, x, y + 1, z, AIR);
    put(world, chunk, cx, cz, x, y + 2, z, AIR);
    put(world, chunk, cx, cz, x, y + 3, z, AIR);
    if (i >= rise - 4) topHoles.push([x, z]);
  }
  fillFloor(world, chunk, cx, cz, tx0, tz0, tx1, tz1, towerTop, COBBLE, holeSet(topHoles));
  putDoor(world, chunk, cx, cz, tx0 + 2, roofY + 1, tz0, 0);
  putLoot(world, chunk, cx, cz, c, tx0 + 1, roofY + 1, tz1 - 1, SURPRISE_BOX);
  put(world, chunk, cx, cz, tx0 + 1, roofY + 2, tz0, GLASS);
  put(world, chunk, cx, cz, tx1 - 1, roofY + 2, tz0, GLASS);
  put(world, chunk, cx, cz, tx0, roofY + 2, tz0 + 1, GLASS);
  put(world, chunk, cx, cz, tx1, roofY + 2, tz0 + 1, GLASS);
  for (let z = tz0; z <= tz1; z++) {
    for (let x = tx0; x <= tx1; x++) {
      if (x === tx0 || x === tx1 || z === tz0 || z === tz1) {
        if ((x + z) & 1) put(world, chunk, cx, cz, x, towerTop + 1, z, COBBLE);
      }
    }
  }
}

function stampHouse(world, chunk, cx, cz, c, x0, z0, doorZFace) {
  const { baseY } = c;
  const x1 = x0 + 6;
  const z1 = z0 + 6;
  const y1 = baseY + 4;
  const doorZ = doorZFace < 0 ? z0 : z1;
  const doorX = x0 + 3;
  const midZ = z0 + 3;
  const frontZ = doorZFace < 0 ? z0 + 1 : z0 + 5;
  const backZ = doorZFace < 0 ? z0 + 5 : z0 + 1;
  fillFloor(world, chunk, cx, cz, x0, z0, x1, z1, baseY, PLANKS);
  boxWalls(world, chunk, cx, cz, x0, z0, x1, z1, baseY + 1, y1, PLANKS, [
    { x: doorX, z: doorZ, y0: baseY + 1, y1: baseY + 2 },
  ]);
  fillFloor(world, chunk, cx, cz, x0, z0, x1, z1, y1 + 1, PLANKS);
  put(world, chunk, cx, cz, x0 + 2, baseY + 2, doorZ, GLASS);
  put(world, chunk, cx, cz, x0 + 4, baseY + 2, doorZ, GLASS);
  for (let x = x0 + 1; x <= x1 - 1; x++) {
    if (x === doorX) continue;
    for (let y = baseY + 1; y <= y1; y++) put(world, chunk, cx, cz, x, y, midZ, PLANKS);
  }
  putDoor(world, chunk, cx, cz, doorX, baseY + 1, doorZ, doorZFace < 0 ? 0 : 2);
  putDoor(world, chunk, cx, cz, doorX, baseY + 1, midZ, 0);
  putLoot(world, chunk, cx, cz, c, x0 + 1, baseY + 1, frontZ, TABLE);
  put(world, chunk, cx, cz, x0 + 1, baseY + 2, frontZ, TORCH);
  putLoot(world, chunk, cx, cz, c, x1 - 1, baseY + 1, backZ, SURPRISE_BOX);
  putLoot(world, chunk, cx, cz, c, x0 + 1, baseY + 1, backZ, FURNACE);
  putDir(world, chunk, cx, cz, x1 - 2, baseY + 1, backZ, WALL_WOOD, FACE_NX);
}

function stampYard(world, chunk, cx, cz, c) {
  const { ox, oz, baseY } = c;
  for (let x = ox + GATE_X; x < ox + GATE_X + GATE_W; x++) {
    for (let z = oz + 2; z < oz + KEEP_Z; z++) {
      put(world, chunk, cx, cz, x, baseY, z, COBBLE);
    }
  }
}

function stampChest(world, chunk, cx, cz, c) {
  const { chest } = c;
  if (!chest) return;
  put(world, chunk, cx, cz, chest.x, chest.y, chest.z, SURPRISE_BOX);
  put(world, chunk, cx, cz, chest.x, chest.y + 1, chest.z, TORCH);
}

export function stampCastleChunk(world, chunk, cx, cz) {
  if (!castleOverlapsChunk(world, cx, cz)) return;
  const c = getCastle(world);
  if (!c) return;
  const { ox, oz, baseY } = c;
  const x0 = Math.max(ox, cx * 16);
  const z0 = Math.max(oz, cz * 16);
  const x1 = Math.min(ox + SIZE - 1, cx * 16 + 15);
  const z1 = Math.min(oz + SIZE - 1, cz * 16 + 15);
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const lx = x - ox;
      const lz = z - oz;
      fillColumn(world, chunk, cx, cz, x, z, baseY, isOuterRing(lx, lz) || isInnerRing(lx, lz));
    }
  }
  stampWalls(world, chunk, cx, cz, c);
  stampYard(world, chunk, cx, cz, c);
  for (const h of houseSpots(ox, oz, baseY)) {
    stampHouse(world, chunk, cx, cz, c, h.x0, h.z0, h.doorZFace);
  }
  stampKeep(world, chunk, cx, cz, c);
  stampChest(world, chunk, cx, cz, c);
}

export function sightBlocked(world, origin, target, maxDist = 24) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.2 || len > maxDist) return true;
  const steps = Math.ceil(len * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(origin.x + dx * t);
    const y = Math.floor(origin.y + dy * t);
    const z = Math.floor(origin.z + dz * t);
    if (!world.chunks.has(world.chunkKey(x >> 4, z >> 4))) return true;
    const id = world.get(x, y, z);
    if (!id || id === AIR || isLiquid(id) || isPlant(id) || isGlass(id) || id === TORCH || id === LADDER) continue;
    if (isDoorOpenId(id)) continue;
    return true;
  }
  return false;
}
