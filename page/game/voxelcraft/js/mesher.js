import * as THREE from 'three';
import { AIR, WATER, TORCH, isOpaque, tileName } from './blocks.js';
import { CHUNK, HEIGHT, VIEW_RADIUS, UNLOAD_RADIUS } from './world.js';
import { tileUV } from './textures.js';

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.6, key: 'px' },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.6, key: 'nx' },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1, key: 'py' },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.45, key: 'ny' },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.8, key: 'pz' },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.8, key: 'nz' },
];

function shouldDrawFace(world, x, y, z, nx, ny, nz, id) {
  const oid = world.get(x + nx, y + ny, z + nz);
  if (id === WATER) return oid === AIR || (oid && oid !== WATER && !isOpaque(oid));
  if (oid === AIR || oid === WATER || oid === TORCH) return true;
  if (!isOpaque(oid)) return id !== oid;
  return false;
}

function pushFace(buf, x, y, z, face, uv, shade) {
  const base = buf.positions.length / 3;
  for (const [cx, cy, cz] of face.corners) {
    buf.positions.push(x + cx, y + cy, z + cz);
    buf.normals.push(face.dir[0], face.dir[1], face.dir[2]);
    buf.colors.push(shade, shade, shade);
  }
  buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

function pushTorch(buf, x, y, z) {
  const uv = tileUV('torch');
  const s = 0.12;
  const h = 0.7;
  const ox = x + 0.5;
  const oz = z + 0.5;
  const faces = [
    { corners: [[ox - s, y, oz - s], [ox - s, y + h, oz - s], [ox + s, y + h, oz - s], [ox + s, y, oz - s]], n: [0, 0, -1] },
    { corners: [[ox + s, y, oz + s], [ox + s, y + h, oz + s], [ox - s, y + h, oz + s], [ox - s, y, oz + s]], n: [0, 0, 1] },
    { corners: [[ox - s, y, oz + s], [ox - s, y + h, oz + s], [ox - s, y + h, oz - s], [ox - s, y, oz - s]], n: [-1, 0, 0] },
    { corners: [[ox + s, y, oz - s], [ox + s, y + h, oz - s], [ox + s, y + h, oz + s], [ox + s, y, oz + s]], n: [1, 0, 0] },
    { corners: [[ox - s, y + h, oz - s], [ox - s, y + h, oz + s], [ox + s, y + h, oz + s], [ox + s, y + h, oz - s]], n: [0, 1, 0] },
  ];
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(p[0], p[1], p[2]);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(1.4, 1.2, 0.8);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function makeBuf() {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

function geomFrom(buf) {
  if (!buf.indices.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  g.setIndex(buf.indices);
  return g;
}

export function meshChunk(world, cx, cz) {
  const solid = makeBuf();
  const water = makeBuf();
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const z = z0 + lz;
      for (let y = 0; y < HEIGHT; y++) {
        const id = world.get(x, y, z);
        if (!id) continue;
        if (id === TORCH) {
          pushTorch(solid, x, y, z);
          continue;
        }
        const buf = id === WATER ? water : solid;
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          if (!shouldDrawFace(world, x, y, z, dx, dy, dz, id)) continue;
          const uv = tileUV(tileName(id, face.key));
          pushFace(buf, x, y, z, face, uv, face.shade);
        }
      }
    }
  }
  return { solid: geomFrom(solid), water: geomFrom(water) };
}

export function createWorldMeshes(atlasTexture) {
  const group = new THREE.Group();
  const solidMat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const waterMat = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return { group, meshes: new Map(), solidMat, waterMat };
}

function addChunk(world, group, meshes, cx, cz, solidMat, waterMat) {
  const key = `${cx},${cz}`;
  const old = meshes.get(key);
  if (old) {
    for (const m of old) {
      group.remove(m);
      m.geometry.dispose();
    }
  }
  const { solid, water } = meshChunk(world, cx, cz);
  const list = [];
  if (solid) {
    const mesh = new THREE.Mesh(solid, solidMat);
    mesh.layers.set(0);
    group.add(mesh);
    list.push(mesh);
  }
  if (water) {
    const mesh = new THREE.Mesh(water, waterMat);
    mesh.layers.set(0);
    group.add(mesh);
    list.push(mesh);
  }
  meshes.set(key, list);
}

function dropChunk(bundle, key) {
  const old = bundle.meshes.get(key);
  if (!old) return;
  for (const m of old) {
    bundle.group.remove(m);
    m.geometry.dispose();
  }
  bundle.meshes.delete(key);
}

export function remeshDirty(world, bundle) {
  if (!world.dirty.size) return;
  for (const key of world.dirty) {
    const [cx, cz] = key.split(',').map(Number);
    if (!world.chunks.has(key)) continue;
    addChunk(world, bundle.group, bundle.meshes, cx, cz, bundle.solidMat, bundle.waterMat);
  }
  world.dirty.clear();
}

export function syncChunkMeshes(world, bundle, px, pz) {
  const pcx = Math.floor(px) >> 4;
  const pcz = Math.floor(pz) >> 4;
  const keepR2 = VIEW_RADIUS * VIEW_RADIUS + 2;
  for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
      if (dx * dx + dz * dz > keepR2) continue;
      const cx = pcx + dx;
      const cz = pcz + dz;
      const key = `${cx},${cz}`;
      if (!world.chunks.has(key)) continue;
      if (!bundle.meshes.has(key)) world.dirty.add(key);
    }
  }
  remeshDirty(world, bundle);
  const dropR2 = UNLOAD_RADIUS * UNLOAD_RADIUS;
  for (const key of [...bundle.meshes.keys()]) {
    const [cx, cz] = key.split(',').map(Number);
    const dx = cx - pcx;
    const dz = cz - pcz;
    if (dx * dx + dz * dz > dropR2) dropChunk(bundle, key);
  }
}

export function disposeMeshes(bundle) {
  for (const list of bundle.meshes.values()) {
    for (const m of list) m.geometry.dispose();
  }
  bundle.solidMat.dispose();
  bundle.waterMat.dispose();
}

