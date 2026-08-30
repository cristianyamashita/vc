import {
  AIR, GRASS, DIRT, STONE, COBBLE, SAND, WATER, LOG, LEAVES, PLANKS,
  COAL_ORE, IRON_ORE, TABLE, TORCH, BEDROCK, CACTUS, isSolid,
} from './blocks.js';
import { fbm2, fbm3, hash2, hash3 } from './noise.js';

export const CHUNK = 16;
export const HEIGHT = 64;
export const VIEW_RADIUS = 6;
export const UNLOAD_RADIUS = 8;
export const GEN_PER_TICK = 4;
export const WATER_LEVEL = 28;

export const BIOME_FOREST = 0;
export const BIOME_DESERT = 1;
export const BIOME_MOUNTAIN = 2;

export function biomeNameKey(id) {
  if (id === BIOME_DESERT) return 'biomeDesert';
  if (id === BIOME_MOUNTAIN) return 'biomeMountain';
  return 'biomeForest';
}

const MAP_RGB = {
  [GRASS]: [62, 154, 58],
  [DIRT]: [138, 90, 50],
  [STONE]: [122, 122, 128],
  [COBBLE]: [110, 110, 115],
  [SAND]: [214, 196, 122],
  [WATER]: [50, 118, 196],
  [LOG]: [110, 75, 40],
  [LEAVES]: [45, 130, 40],
  [PLANKS]: [175, 140, 80],
  [COAL_ORE]: [72, 72, 76],
  [IRON_ORE]: [168, 150, 132],
  [TABLE]: [160, 110, 55],
  [CACTUS]: [46, 138, 52],
  [BEDROCK]: [50, 50, 55],
};

export function mapRgb(id, h = 28) {
  const rgb = MAP_RGB[id] || [88, 88, 92];
  const s = 0.58 + Math.max(0, Math.min(1, h / HEIGHT)) * 0.55;
  return [rgb[0] * s, rgb[1] * s, rgb[2] * s];
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0 || 1;
    this.chunks = new Map();
    this.dirty = new Set();
    this.edits = {};
    this.pending = new Map();
    this.map = new Map();
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  idx(lx, y, lz) {
    return lx + lz * CHUNK + y * CHUNK * CHUNK;
  }

  inBounds(x, y, z) {
    return y >= 0 && y < HEIGHT && Number.isFinite(x) && Number.isFinite(z);
  }

  get(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= HEIGHT) return AIR;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    if (!chunk) return AIR;
    return chunk[this.idx(x & 15, y, z & 15)];
  }

  markDirty(x, z) {
    const cx = x >> 4;
    const cz = z >> 4;
    this.dirty.add(this.chunkKey(cx, cz));
    if ((x & 15) === 0) this.dirty.add(this.chunkKey(cx - 1, cz));
    if ((x & 15) === 15) this.dirty.add(this.chunkKey(cx + 1, cz));
    if ((z & 15) === 0) this.dirty.add(this.chunkKey(cx, cz - 1));
    if ((z & 15) === 15) this.dirty.add(this.chunkKey(cx, cz + 1));
  }

  set(x, y, z, id, record = true) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (!this.inBounds(x, y, z)) return false;
    const cx = x >> 4;
    const cz = z >> 4;
    this.ensureChunk(cx, cz);
    const chunk = this.chunks.get(this.chunkKey(cx, cz));
    const i = this.idx(x & 15, y, z & 15);
    if (chunk[i] === id) return false;
    chunk[i] = id;
    this.markDirty(x, z);
    if (record) this.edits[`${x},${y},${z}`] = id;
    this.recordMapColumn(x, z);
    return true;
  }

  setLocal(chunk, x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return;
    chunk[this.idx(x & 15, y, z & 15)] = id;
  }

  isSolidAt(x, y, z) {
    return isSolid(this.get(x, y, z));
  }

  heightAt(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (id && id !== WATER) return y;
    }
    return 0;
  }

  climate(x, z) {
    const t = fbm2(x / 160, z / 160, this.seed + 3, 4);
    const m = fbm2(x / 140, z / 140, this.seed + 11, 4);
    const mountainW = clamp01((0.42 - t) / 0.18);
    const desertW = clamp01((t - 0.52) / 0.16) * clamp01((0.52 - m) / 0.18);
    const forestW = Math.max(0, 1 - mountainW - desertW);
    return { t, m, mountainW, desertW, forestW };
  }

  biomeAt(x, z) {
    const { mountainW, desertW } = this.climate(x, z);
    if (mountainW > 0.48 && mountainW >= desertW) return BIOME_MOUNTAIN;
    if (desertW > 0.42) return BIOME_DESERT;
    return BIOME_FOREST;
  }

  heightNoise(x, z) {
    const seed = this.seed;
    const n = fbm2(x / 48, z / 48, seed, 5);
    const ridge = fbm2(x / 90, z / 90, seed + 7, 3);
    const { mountainW, desertW, forestW } = this.climate(x, z);
    const hForest = 22 + n * 14 + ridge * 6;
    const hDesert = 20 + n * 7 + ridge * 3;
    const hMount = 28 + n * 20 + ridge * 14;
    return Math.max(6, Math.min(58, Math.floor(forestW * hForest + desertW * hDesert + mountainW * hMount)));
  }

  generate() {
    this.ensureAround(0, 0, VIEW_RADIUS);
  }

  ensureAround(px, pz, radius = VIEW_RADIUS, maxNew = Infinity) {
    const pcx = Math.floor(px) >> 4;
    const pcz = Math.floor(pz) >> 4;
    const r2 = radius * radius;
    const missing = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > r2 + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (!this.chunks.has(this.chunkKey(cx, cz))) {
          missing.push({ cx, cz, d: dx * dx + dz * dz });
        }
      }
    }
    missing.sort((a, b) => a.d - b.d);
    const n = Math.min(missing.length, maxNew);
    for (let i = 0; i < n; i++) this.ensureChunk(missing[i].cx, missing[i].cz);
  }

  unloadFar(px, pz) {
    const pcx = Math.floor(px) >> 4;
    const pcz = Math.floor(pz) >> 4;
    const r2 = UNLOAD_RADIUS * UNLOAD_RADIUS;
    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - pcx;
      const dz = cz - pcz;
      if (dx * dx + dz * dz > r2) {
        this.chunks.delete(key);
        this.dirty.delete(key);
      }
    }
  }

  ensureChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key)) return;
    this.generateChunk(cx, cz);
  }

  generateChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    const chunk = new Uint8Array(CHUNK * HEIGHT * CHUNK);
    const seed = this.seed;
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightNoise(x, z);
        const biome = this.biomeAt(x, z);
        const wet = h < WATER_LEVEL;
        for (let y = 0; y < HEIGHT; y++) {
          let id = AIR;
          if (y === 0) id = BEDROCK;
          else if (y > h) {
            if (wet && y <= WATER_LEVEL) id = WATER;
          } else if (biome === BIOME_DESERT) {
            if (y === h || y >= h - 4) id = SAND;
            else id = STONE;
          } else if (biome === BIOME_MOUNTAIN) {
            if (y === h) id = wet ? SAND : (h >= 38 ? STONE : GRASS);
            else if (y >= h - 2) id = wet ? SAND : DIRT;
            else id = STONE;
          } else if (y === h) id = wet ? SAND : GRASS;
          else if (y >= h - 3) id = wet ? SAND : DIRT;
          else id = STONE;
          this.setLocal(chunk, lx, y, lz, id);
        }
      }
    }

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightNoise(x, z);
        for (let y = 2; y < h - 2; y++) {
          const cave = fbm3(x / 14, y / 10, z / 14, seed + 40, 3);
          if (cave > 0.62) this.setLocal(chunk, lx, y, lz, AIR);
        }
        for (let y = 2; y < h; y++) {
          if (chunk[this.idx(lx, y, lz)] !== STONE) continue;
          const ore = hash3(x, y, z, seed + 90);
          if (ore > 0.985 && y < 40) this.setLocal(chunk, lx, y, lz, COAL_ORE);
          else if (ore > 0.972 && ore <= 0.985 && y < 32) this.setLocal(chunk, lx, y, lz, IRON_ORE);
        }
      }
    }

    this.chunks.set(key, chunk);

    const queued = this.pending.get(key);
    if (queued) {
      for (const p of queued) {
        if (p.y >= 0 && p.y < HEIGHT && chunk[this.idx(p.x & 15, p.y, p.z & 15)] === AIR) {
          this.setLocal(chunk, p.x & 15, p.y, p.z & 15, p.id);
        }
      }
      this.pending.delete(key);
    }

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        this.tryPlaceDecor(x0 + lx, z0 + lz);
      }
    }
    this.restampNeighborDecor(cx, cz);

    for (const [ek, id] of Object.entries(this.edits)) {
      const [x, y, z] = ek.split(',').map(Number);
      if ((x >> 4) === cx && (z >> 4) === cz && y >= 0 && y < HEIGHT) {
        this.setLocal(chunk, x & 15, y, z & 15, id);
      }
    }

    this.dirty.add(key);
    for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
      const nk = this.chunkKey(nx, nz);
      if (this.chunks.has(nk)) this.dirty.add(nk);
    }
    this.recordMapChunk(cx, cz);
    for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
      if (this.map.has(this.chunkKey(nx, nz))) this.recordMapChunk(nx, nz);
    }
  }

  restampNeighborDecor(cx, cz) {
    for (const [ndx, ndz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ncx = cx + ndx;
      const ncz = cz + ndz;
      if (!this.chunks.has(this.chunkKey(ncx, ncz))) continue;
      const x0 = ncx * CHUNK;
      const z0 = ncz * CHUNK;
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const x = x0 + lx;
          const z = z0 + lz;
          const ox = x - cx * CHUNK;
          const oz = z - cz * CHUNK;
          if (ox < -2 || ox >= CHUNK + 2 || oz < -2 || oz >= CHUNK + 2) continue;
          this.tryPlaceDecor(x, z);
        }
      }
    }
  }

  tryPlaceDecor(x, z) {
    const h = this.heightNoise(x, z);
    if (h < WATER_LEVEL) return;
    const biome = this.biomeAt(x, z);
    const surface = this.get(x, h, z);
    if (biome === BIOME_DESERT) {
      if (surface !== SAND) return;
      if (hash2(x, z, this.seed + 140) > 0.022) return;
      this.placeCactus(x, h + 1, z);
      return;
    }
    if (surface !== GRASS) return;
    const chance = biome === BIOME_FOREST ? 0.032 : biome === BIOME_MOUNTAIN ? 0.01 : 0;
    if (!chance || hash2(x, z, this.seed + 120) > chance) return;
    if (biome === BIOME_MOUNTAIN && h > 40) return;
    this.placeTree(x, h + 1, z);
  }

  stamp(x, y, z, id) {
    if (y < 0 || y >= HEIGHT) return;
    const cx = x >> 4;
    const cz = z >> 4;
    const key = this.chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (chunk) {
      const i = this.idx(x & 15, y, z & 15);
      if (chunk[i] === AIR || id === LOG) {
        chunk[i] = id;
        this.dirty.add(key);
      }
      return;
    }
    let list = this.pending.get(key);
    if (!list) {
      list = [];
      this.pending.set(key, list);
    }
    list.push({ x, y, z, id });
  }

  placeTree(x, y, z) {
    const h = 4 + Math.floor(hash2(x, z, this.seed + 200) * 3);
    for (let i = 0; i < h; i++) this.stamp(x, y + i, z, LOG);
    const top = y + h - 1;
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy >= 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && dy > 0) continue;
          this.stamp(x + dx, top + dy, z + dz, LEAVES);
        }
      }
    }
  }

  placeCactus(x, y, z) {
    const h = 2 + Math.floor(hash2(x, z, this.seed + 210) * 3);
    for (let i = 0; i < h; i++) this.stamp(x, y + i, z, CACTUS);
  }

  surfaceForMap(x, z) {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (!id || id === AIR || id === TORCH) continue;
      if (id === LEAVES || id === LOG || id === CACTUS) continue;
      return { id, h: y };
    }
    return { id: AIR, h: 0 };
  }

  recordMapColumn(x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    const cx = x >> 4;
    const cz = z >> 4;
    const key = this.chunkKey(cx, cz);
    let buf = this.map.get(key);
    if (!buf) {
      buf = new Uint8Array(CHUNK * CHUNK * 2);
      this.map.set(key, buf);
    }
    const { id, h } = this.surfaceForMap(x, z);
    const i = ((z & 15) * CHUNK + (x & 15)) * 2;
    buf[i] = id;
    buf[i + 1] = h;
  }

  recordMapChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    if (!this.chunks.has(key)) return;
    const buf = new Uint8Array(CHUNK * CHUNK * 2);
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const { id, h } = this.surfaceForMap(x0 + lx, z0 + lz);
        const i = (lz * CHUNK + lx) * 2;
        buf[i] = id;
        buf[i + 1] = h;
      }
    }
    this.map.set(key, buf);
  }

  rebuildMapFromChunks() {
    for (const key of this.chunks.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      this.recordMapChunk(cx, cz);
    }
  }

  encodeMap() {
    const out = {};
    for (const [key, buf] of this.map) {
      let s = '';
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      out[key] = btoa(s);
    }
    return out;
  }

  loadMap(data) {
    this.map.clear();
    if (!data || typeof data !== 'object') return;
    for (const [key, encoded] of Object.entries(data)) {
      try {
        const raw = atob(encoded);
        const buf = new Uint8Array(CHUNK * CHUNK * 2);
        for (let i = 0; i < buf.length && i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        this.map.set(key, buf);
      } catch {
        /* ignore a bad tile */
      }
    }
  }

  applyEdits(edits) {
    this.edits = edits && typeof edits === 'object' ? { ...edits } : {};
    for (const [key, id] of Object.entries(this.edits)) {
      const [x, y, z] = key.split(',').map(Number);
      const cx = x >> 4;
      const cz = z >> 4;
      const chunk = this.chunks.get(this.chunkKey(cx, cz));
      if (!chunk || y < 0 || y >= HEIGHT) continue;
      this.setLocal(chunk, x & 15, y, z & 15, id);
      this.markDirty(x, z);
    }
  }

  findSpawn() {
    this.ensureAround(0, 0, 3);
    for (let r = 0; r < 48; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r && r) continue;
          const x = dx;
          const z = dz;
          this.ensureChunk(x >> 4, z >> 4);
          const y = this.heightAt(x, z);
          const ground = this.get(x, y, z);
          if (ground === GRASS || ground === DIRT || ground === SAND || ground === STONE) {
            if (this.get(x, y + 1, z) === AIR && this.get(x, y + 2, z) === AIR) {
              return { x: x + 0.5, y: y + 1, z: z + 0.5 };
            }
          }
        }
      }
    }
    return { x: 0.5, y: 40, z: 0.5 };
  }
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
