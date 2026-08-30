import * as THREE from 'three';
import { AIR, FLOWER_RED, FLOWER_YELLOW, FLOWER_WHITE, RAW_MEAT, HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP, isSolid, isLiquid } from './blocks.js';
import { HEIGHT, UNLOAD_RADIUS, BIOME_DESERT, BIOME_MOUNTAIN } from './world.js';

const MAX_NEAR = 52;
const UNLOAD = UNLOAD_RADIUS * 16;

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

function pickWear(kind, seed) {
  const rng = mulberry(seed | 0);
  const pal = kind === 'woman' ? WOMAN_WEAR : kind === 'man' ? MAN_WEAR : null;
  if (!pal) return 0;
  return pal[Math.floor(rng() * pal.length) % pal.length];
}

function makeModel(kind, wear = 0) {
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
    g.add(box(0.38, 0.5, 0.22, cloth, 0, 1.05, 0));
    g.add(box(0.36, 0.48, 0.2, pants, 0, 0.56, 0));
    g.add(box(0.26, 0.26, 0.24, 0xc8a07a, 0, 1.42, 0));
    g.add(box(0.28, 0.1, 0.26, 0x3a2818, 0, 1.56, 0));
    g.add(box(0.1, 0.42, 0.1, cloth, 0.24, 1.0, 0));
    g.add(box(0.1, 0.42, 0.1, cloth, -0.24, 1.0, 0));
    g.add(box(0.12, 0.5, 0.12, pants, 0.1, 0.26, 0));
    g.add(box(0.12, 0.5, 0.12, pants, -0.1, 0.26, 0));
  } else {
    const cloth = wear || WOMAN_WEAR[0];
    const skirt = darken(cloth, 0.72);
    g.add(box(0.36, 0.62, 0.22, cloth, 0, 0.98, 0));
    g.add(box(0.24, 0.24, 0.22, 0xd4b08a, 0, 1.38, 0));
    g.add(box(0.32, 0.42, 0.28, 0x5a2a12, 0, 1.28, -0.02));
    g.add(box(0.09, 0.4, 0.09, 0xd4b08a, 0.22, 0.95, 0));
    g.add(box(0.09, 0.4, 0.09, 0xd4b08a, -0.22, 0.95, 0));
    g.add(box(0.1, 0.48, 0.1, skirt, 0.08, 0.28, 0));
    g.add(box(0.1, 0.48, 0.1, skirt, -0.08, 0.28, 0));
  }
  return g;
}

function groundY(world, x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  for (let y = HEIGHT - 1; y >= 1; y--) {
    if (isSolid(world.get(ix, y, iz))) return y + 1;
  }
  return 2;
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
        if (isSolid(world.get(ix, iy, iz))) return true;
      }
    }
  }
  return false;
}

function pickKind(biome, rng, night) {
  const r = rng();
  if (biome === BIOME_DESERT) {
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

export class Life {
  constructor(scene) {
    this.list = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.nextId = 1;
    this.spawnAcc = 0;
    this.scene = scene;
  }

  dispose() {
    for (const e of this.list) this.dropMesh(e);
    this.scene.remove(this.group);
    this.list = [];
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
      attackCd: 0,
      hurtT: 0,
      onGround: false,
      wear,
      mesh: null,
    };
    e.mesh = makeModel(kind, wear);
    this.group.add(e.mesh);
    this.syncMesh(e);
    this.list.push(e);
    return e;
  }

  syncMesh(e) {
    if (!e.mesh) return;
    e.mesh.position.set(e.x, e.y, e.z);
    e.mesh.rotation.y = e.yaw - Math.PI / 2;
    const flash = e.hurtT > 0;
    e.mesh.traverse((o) => {
      if (o.material && o.material.emissive) {
        o.material.emissive.setHex(flash ? 0x551010 : 0);
      }
    });
  }

  serialize() {
    return this.list.map((e) => ({
      id: e.id,
      kind: e.kind,
      x: e.x, y: e.y, z: e.z,
      yaw: e.yaw,
      hp: e.hp,
      state: e.state,
      home: e.home,
      wear: e.wear || 0,
    }));
  }

  load(data, world) {
    for (const e of this.list) this.dropMesh(e);
    this.list = [];
    this.nextId = 1;
    if (!Array.isArray(data)) return;
    for (const raw of data) {
      if (!KINDS[raw.kind]) continue;
      const spawned = this.spawn(raw.kind, raw.x, raw.y, raw.z, {
        id: raw.id, yaw: raw.yaw, hp: raw.hp, state: raw.state, home: raw.home, wear: raw.wear,
      });
      if (spawned) {
        if (world && overlapsSolid(world, spawned.x, spawned.y, spawned.z, KINDS[spawned.kind].w, KINDS[spawned.kind].h)) {
          spawned.y = groundY(world, spawned.x, spawned.z);
        }
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
        e.home = { x, y, z };
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

  raycast(origin, dir, maxDist = 5.5) {
    let best = null;
    let bestT = maxDist;
    for (const e of this.list) {
      const def = KINDS[e.kind];
      const hw = def.w * 0.5;
      const min = { x: e.x - hw, y: e.y, z: e.z - hw };
      const max = { x: e.x + hw, y: e.y + def.h, z: e.z + hw };
      const t = rayAabb(origin, dir, min, max, bestT);
      if (t != null && t < bestT) {
        bestT = t;
        best = { e, dist: t };
      }
    }
    return best;
  }

  hurt(e, amount, from) {
    if (!e || amount <= 0) return [];
    e.hp -= amount;
    e.hurtT = 0.25;
    const def = KINDS[e.kind];
    if (from) {
      const dx = e.x - from.x;
      const dz = e.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      e.vx += (dx / len) * 4;
      e.vz += (dz / len) * 4;
      if (!def.hostile) e.state = 'flee';
    }
    if (e.hp > 0) return [];
    const loot = [];
    if (def.meat) loot.push({ id: RAW_MEAT, n: def.meat });
    if (def.hide) loot.push({ id: def.hide, n: 1 });
    if (def.person && Math.random() < 0.12) loot.push({ id: FLOWER_RED, n: 1 });
    this.remove(e);
    return loot;
  }

  remove(e) {
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
    if (feet !== AIR && feet !== WATER) return;
    if (isSolid(head)) return;
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
      if (dist > UNLOAD && !(e.kind === 'woman' && e.home)) {
        this.remove(e);
        continue;
      }

      e.hurtT = Math.max(0, e.hurtT - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.wanderT -= dt;

      const duskNight = !!ctx.duskNight;
      const mayHunt = def.hostile && !ctx.sleeping && (!def.nocturnal || duskNight);
      const huntRange = mayHunt ? (duskNight ? def.range + 8 : def.range) : 0;

      if (!mayHunt && e.state === 'chase') e.state = 'wander';
      if (mayHunt && dist < huntRange && dist > 0.4) {
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
      if (e.state === 'chase') {
        tx = px - e.x;
        tz = pz - e.z;
      } else if (e.state === 'follow') {
        if (dist > 2.1) {
          tx = px - e.x;
          tz = pz - e.z;
        }
      } else if (e.state === 'home' && e.home) {
        const hx = e.home.x + 0.5 - e.x;
        const hz = e.home.z + 0.5 - e.z;
        const hd = Math.hypot(hx, hz);
        if (hd > 7.5) {
          tx = hx;
          tz = hz;
        } else if (e.wanderT <= 0) {
          e.yaw += (Math.random() - 0.5) * 1.6;
          e.wanderT = 1.5 + Math.random() * 3;
        } else {
          tx = Math.sin(e.yaw);
          tz = Math.cos(e.yaw);
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
      }

      const len = Math.hypot(tx, tz);
      const speed = def.speed * (e.state === 'flee' || e.state === 'chase' ? 1 : 0.55);
      if (len > 0.05) {
        e.yaw = Math.atan2(tx, tz);
        e.vx += ((tx / len) * speed - e.vx) * Math.min(1, 8 * dt);
        e.vz += ((tz / len) * speed - e.vz) * Math.min(1, 8 * dt);
      } else {
        e.vx *= Math.max(0, 1 - 8 * dt);
        e.vz *= Math.max(0, 1 - 8 * dt);
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
  }

  move(e, world, def, dx, dy, dz) {
    if (dx) {
      e.x += dx;
      if (overlapsSolid(world, e.x, e.y, e.z, def.w, def.h) && !this.tryStep(e, world, def)) {
        e.x -= dx;
        e.vx = 0;
      }
    }
    if (dz) {
      e.z += dz;
      if (overlapsSolid(world, e.x, e.y, e.z, def.w, def.h) && !this.tryStep(e, world, def)) {
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

  tryStep(e, world, def) {
    const max = def.step || 1;
    const tries = max >= 2 ? [0.55, 1.08, 1.55, 2.12] : [0.55, 1.08];
    for (const up of tries) {
      if (up > max + 0.15) continue;
      if (!overlapsSolid(world, e.x, e.y + up, e.z, def.w, def.h)) {
        e.y += up;
        return true;
      }
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
