import * as THREE from 'three';
import { AIR, WATER, TORCH, STAIRS, LADDER, isOpaque, isDecor, isPlant, isRug, isFruitHang, tileName } from './blocks.js';
import { CHUNK, HEIGHT, VIEW_RADIUS, UNLOAD_RADIUS, TORCH_FLOOR, TORCH_PX, TORCH_NX, TORCH_PZ, TORCH_NZ } from './world.js';
import { tileUV } from './textures.js';
import { isDoorId, isDoorBottom, isDoorOpenId, doorKey, doorSlab } from './doors.js';
import { stairBoxes, FACE_PZ, FACE_PX, FACE_NZ, FACE_NX } from './stairs.js';

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
  if (oid === AIR || oid === WATER || isDecor(oid)) return true;
  if (!isOpaque(oid)) return id !== oid;
  return false;
}

function pushFace(buf, x, y, z, face, uv, shade, torch) {
  const base = buf.positions.length / 3;
  for (const [cx, cy, cz] of face.corners) {
    buf.positions.push(x + cx, y + cy, z + cz);
    buf.normals.push(face.dir[0], face.dir[1], face.dir[2]);
    buf.colors.push(shade, torch, 0);
  }
  buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
  buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

function mapTorchPoint(x, y, z, lx, ly, lz, facing) {
  const ang = 0.58;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  let px = lx;
  let py = ly;
  let pz = lz;
  if (facing === TORCH_PX) {
    const nx = px * c - py * s;
    const ny = px * s + py * c;
    return [x + 0.86 + nx, y + 0.22 + ny, z + 0.5 + pz];
  }
  if (facing === TORCH_NX) {
    const nx = px * c + py * s;
    const ny = -px * s + py * c;
    return [x + 0.14 + nx, y + 0.22 + ny, z + 0.5 + pz];
  }
  if (facing === TORCH_PZ) {
    const ny = py * c + pz * s;
    const nz = -py * s + pz * c;
    return [x + 0.5 + px, y + 0.22 + ny, z + 0.86 + nz];
  }
  if (facing === TORCH_NZ) {
    const ny = py * c - pz * s;
    const nz = py * s + pz * c;
    return [x + 0.5 + px, y + 0.22 + ny, z + 0.14 + nz];
  }
  return [x + 0.5 + px, y + py, z + 0.5 + pz];
}

function pushTorch(buf, x, y, z, facing = TORCH_FLOOR) {
  const uv = tileUV('torch');
  const w = 0.1;
  const h = 0.72;
  const faces = [
    { corners: [[-w, 0, -w], [-w, h, -w], [w, h, -w], [w, 0, -w]], n: [0, 0, -1] },
    { corners: [[w, 0, w], [w, h, w], [-w, h, w], [-w, 0, w]], n: [0, 0, 1] },
    { corners: [[-w, 0, w], [-w, h, w], [-w, h, -w], [-w, 0, -w]], n: [-1, 0, 0] },
    { corners: [[w, 0, -w], [w, h, -w], [w, h, w], [w, 0, w]], n: [1, 0, 0] },
    { corners: [[-w, h, -w], [-w, h, w], [w, h, w], [w, h, -w]], n: [0, 1, 0] },
  ];
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      const [wx, wy, wz] = mapTorchPoint(x, y, z, p[0], p[1], p[2], facing);
      buf.positions.push(wx, wy, wz);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(1, 1, 0);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function pushPlant(buf, x, y, z, tile) {
  const uv = tileUV(tile);
  const h = 0.85;
  const y0 = 0;
  const crosses = [
    { corners: [[0.15, y0, 0.15], [0.15, h, 0.15], [0.85, h, 0.85], [0.85, y0, 0.85]], n: [0.7, 0, -0.7] },
    { corners: [[0.85, y0, 0.15], [0.85, h, 0.15], [0.15, h, 0.85], [0.15, y0, 0.85]], n: [0.7, 0, 0.7] },
  ];
  for (const f of crosses) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(x + p[0], y + p[1], z + p[2]);
      buf.normals.push(f.n[0], 0.2, f.n[2]);
      buf.colors.push(1, 0, 0);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function pushFruit(buf, x, y, z) {
  const uv = tileUV('fruit');
  const s = 0.18;
  const cx = 0.5;
  const cy = 0.42;
  const cz = 0.5;
  const faces = [
    { corners: [[-s, -s, s], [-s, s, s], [s, s, s], [s, -s, s]], n: [0, 0, 1] },
    { corners: [[s, -s, -s], [s, s, -s], [-s, s, -s], [-s, -s, -s]], n: [0, 0, -1] },
    { corners: [[-s, -s, -s], [-s, s, -s], [-s, s, s], [-s, -s, s]], n: [-1, 0, 0] },
    { corners: [[s, -s, s], [s, s, s], [s, s, -s], [s, -s, -s]], n: [1, 0, 0] },
    { corners: [[-s, s, s], [-s, s, -s], [s, s, -s], [s, s, s]], n: [0, 1, 0] },
    { corners: [[-s, -s, -s], [-s, -s, s], [s, -s, s], [s, -s, -s]], n: [0, -1, 0] },
  ];
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(x + cx + p[0], y + cy + p[1], z + cz + p[2]);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(1, 0, 0);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function pushRug(buf, x, y, z, tile) {
  const uv = tileUV(tile);
  const h = 0.06;
  const faces = [
    { corners: [[0.02, h, 0.02], [0.98, h, 0.02], [0.98, h, 0.98], [0.02, h, 0.98]], n: [0, 1, 0], shade: 1 },
    { corners: [[0.02, 0, 0.98], [0.98, 0, 0.98], [0.98, 0, 0.02], [0.02, 0, 0.02]], n: [0, -1, 0], shade: 0.5 },
    { corners: [[0.02, 0, 0.02], [0.98, 0, 0.02], [0.98, h, 0.02], [0.02, h, 0.02]], n: [0, 0, -1], shade: 0.7 },
    { corners: [[0.98, 0, 0.98], [0.02, 0, 0.98], [0.02, h, 0.98], [0.98, h, 0.98]], n: [0, 0, 1], shade: 0.7 },
    { corners: [[0.02, 0, 0.98], [0.02, 0, 0.02], [0.02, h, 0.02], [0.02, h, 0.98]], n: [-1, 0, 0], shade: 0.6 },
    { corners: [[0.98, 0, 0.02], [0.98, 0, 0.98], [0.98, h, 0.98], [0.98, h, 0.02]], n: [1, 0, 0], shade: 0.6 },
  ];
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(x + p[0], y + p[1], z + p[2]);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(f.shade, 0, 0);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1);
    buf.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function pushBox(buf, x, y, z, box, uv, torch) {
  const { x0, y0, z0, x1, y1, z1 } = box;
  const faces = [
    { corners: [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], n: [0, 0, 1], shade: 0.8 },
    { corners: [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], n: [0, 0, -1], shade: 0.8 },
    { corners: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], n: [-1, 0, 0], shade: 0.6 },
    { corners: [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], n: [1, 0, 0], shade: 0.6 },
    { corners: [[x0, y1, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1]], n: [0, 1, 0], shade: 1 },
    { corners: [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], n: [0, -1, 0], shade: 0.45 },
  ];
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(x + p[0], y + p[1], z + p[2]);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(f.shade, torch, 0);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function pushStairs(buf, world, x, y, z, torch) {
  const uv = tileUV('planks');
  for (const box of stairBoxes(world.blockFacing(x, y, z))) {
    pushBox(buf, x, y, z, box, uv, torch);
  }
}

function pushLadder(buf, x, y, z, facing) {
  const uv = tileUV('ladder');
  const t = 0.08;
  let faces;
  if (facing === FACE_NZ) {
    faces = [
      { corners: [[0, 0, t], [0, 1, t], [1, 1, t], [1, 0, t]], n: [0, 0, 1] },
      { corners: [[1, 0, t], [1, 1, t], [0, 1, t], [0, 0, t]], n: [0, 0, -1] },
    ];
  } else if (facing === FACE_PZ) {
    faces = [
      { corners: [[1, 0, 1 - t], [1, 1, 1 - t], [0, 1, 1 - t], [0, 0, 1 - t]], n: [0, 0, -1] },
      { corners: [[0, 0, 1 - t], [0, 1, 1 - t], [1, 1, 1 - t], [1, 0, 1 - t]], n: [0, 0, 1] },
    ];
  } else if (facing === FACE_NX) {
    faces = [
      { corners: [[t, 0, 1], [t, 1, 1], [t, 1, 0], [t, 0, 0]], n: [1, 0, 0] },
      { corners: [[t, 0, 0], [t, 1, 0], [t, 1, 1], [t, 0, 1]], n: [-1, 0, 0] },
    ];
  } else {
    faces = [
      { corners: [[1 - t, 0, 0], [1 - t, 1, 0], [1 - t, 1, 1], [1 - t, 0, 1]], n: [-1, 0, 0] },
      { corners: [[1 - t, 0, 1], [1 - t, 1, 1], [1 - t, 1, 0], [1 - t, 0, 0]], n: [1, 0, 0] },
    ];
  }
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(x + p[0], y + p[1], z + p[2]);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(1, 0, 0);
    }
    buf.uvs.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    buf.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

function pushDoor(buf, world, x, y, z, id) {
  const bottomY = isDoorBottom(id) ? y : y - 1;
  const meta = (world.doors || {})[doorKey(x, bottomY, z)] || { facing: 0, hinge: 0 };
  const open = isDoorOpenId(id);
  const s = doorSlab(meta.facing || 0, open, meta.hinge || 0);
  const uv = tileUV(tileName(id, 'py'));
  const x0 = s.x0;
  const x1 = s.x1;
  const z0 = s.z0;
  const z1 = s.z1;
  const y0 = 0;
  const y1 = 1;
  const faces = [
    { corners: [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], n: [0, 0, 1], shade: 0.9 },
    { corners: [[x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0]], n: [0, 0, -1], shade: 0.7 },
    { corners: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], n: [-1, 0, 0], shade: 0.6 },
    { corners: [[x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0]], n: [1, 0, 0], shade: 0.8 },
    { corners: [[x0, y1, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1]], n: [0, 1, 0], shade: 1 },
    { corners: [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], n: [0, -1, 0], shade: 0.45 },
  ];
  for (const f of faces) {
    const base = buf.positions.length / 3;
    for (const p of f.corners) {
      buf.positions.push(x + p[0], y + p[1], z + p[2]);
      buf.normals.push(f.n[0], f.n[1], f.n[2]);
      buf.colors.push(f.shade, 0, 0);
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

const LIGHT_RANGE = 14;
const LIGHT_PAD = 14;
const LIGHT_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function buildTorchLight(world, cx, cz) {
  const x0 = cx * CHUNK - LIGHT_PAD;
  const z0 = cz * CHUNK - LIGHT_PAD;
  const w = CHUNK + LIGHT_PAD * 2;
  const d = CHUNK + LIGHT_PAD * 2;
  const light = new Uint8Array(w * HEIGHT * d);
  const idx = (x, y, z) => ((z - z0) * HEIGHT + y) * w + (x - x0);
  const inside = (x, y, z) => (
    y >= 0 && y < HEIGHT && x >= x0 && z >= z0 && x < x0 + w && z < z0 + d
  );
  const q = [];
  for (const [key, id] of Object.entries(world.edits)) {
    if (id !== TORCH) continue;
    const [x, y, z] = key.split(',').map(Number);
    if (!inside(x, y, z)) continue;
    light[idx(x, y, z)] = LIGHT_RANGE;
    q.push(x, y, z);
  }
  let head = 0;
  while (head < q.length) {
    const x = q[head++];
    const y = q[head++];
    const z = q[head++];
    const lv = light[idx(x, y, z)];
    if (lv <= 1) continue;
    const next = lv - 1;
    for (const [dx, dy, dz] of LIGHT_DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (!inside(nx, ny, nz)) continue;
      const nid = world.get(nx, ny, nz);
      if (nid && isOpaque(nid)) continue;
      const ni = idx(nx, ny, nz);
      if (next > light[ni]) {
        light[ni] = next;
        q.push(nx, ny, nz);
      }
    }
  }
  return { light, x0, z0, w };
}

function sampleTorch(field, x, y, z) {
  if (y < 0 || y >= HEIGHT) return 0;
  const lx = x - field.x0;
  const lz = z - field.z0;
  if (lx < 0 || lz < 0 || lx >= field.w || lz >= field.w) return 0;
  return field.light[(lz * HEIGHT + y) * field.w + lx] / LIGHT_RANGE;
}

function blockTorch(field, x, y, z) {
  let m = sampleTorch(field, x, y, z);
  for (const [dx, dy, dz] of LIGHT_DIRS) {
    const v = sampleTorch(field, x + dx, y + dy, z + dz);
    if (v > m) m = v;
  }
  return m;
}

export function meshChunk(world, cx, cz) {
  const solid = makeBuf();
  const water = makeBuf();
  const field = buildTorchLight(world, cx, cz);
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
          pushTorch(solid, x, y, z, world.torchFacing(x, y, z));
          continue;
        }
        if (isPlant(id)) {
          pushPlant(solid, x, y, z, tileName(id, 'py'));
          continue;
        }
        if (isFruitHang(id)) {
          pushFruit(solid, x, y, z);
          continue;
        }
        if (isRug(id)) {
          pushRug(solid, x, y, z, tileName(id, 'py'));
          continue;
        }
        if (isDoorId(id)) {
          pushDoor(solid, world, x, y, z, id);
          continue;
        }
        if (id === STAIRS) {
          pushStairs(solid, world, x, y, z, blockTorch(field, x, y, z));
          continue;
        }
        if (id === LADDER) {
          pushLadder(solid, x, y, z, world.blockFacing(x, y, z));
          continue;
        }
        const buf = id === WATER ? water : solid;
        const torch = blockTorch(field, x, y, z);
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          if (!shouldDrawFace(world, x, y, z, dx, dy, dz, id)) continue;
          const uv = tileUV(tileName(id, face.key));
          pushFace(buf, x, y, z, face, uv, face.shade, torch);
        }
      }
    }
  }
  return { solid: geomFrom(solid), water: geomFrom(water) };
}

function makeWorldMaterial(atlasTexture, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        map: { value: atlasTexture },
        day: { value: 1 },
        opacity: { value: opacity },
        holdPos: { value: new THREE.Vector3() },
        holdTorch: { value: 0 },
      },
    ]),
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec2 vLight;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vLight = color.rg;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D map;
      uniform float day;
      uniform float opacity;
      uniform vec3 holdPos;
      uniform float holdTorch;
      varying vec2 vUv;
      varying vec2 vLight;
      varying vec3 vWorld;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.12) discard;
        float shade = vLight.x;
        float torch = vLight.y;
        float sky = mix(0.14, 1.06, clamp(day, 0.0, 1.0));
        float hd = length(vWorld - holdPos);
        float held = holdTorch * clamp(1.0 - hd / 10.0, 0.0, 1.0);
        held *= held;
        float blockLight = max(torch, held);
        vec3 lit = vec3(shade * sky);
        lit += blockLight * vec3(1.35, 1.05, 0.62);
        lit = min(lit, vec3(1.55));
        gl_FragColor = vec4(tex.rgb * lit, tex.a * opacity);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    vertexColors: true,
    fog: true,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    side: THREE.DoubleSide,
  });
}

export function createWorldMeshes(atlasTexture) {
  const group = new THREE.Group();
  const solidMat = makeWorldMaterial(atlasTexture, 1);
  const waterMat = makeWorldMaterial(atlasTexture, 0.65);
  return { group, meshes: new Map(), solidMat, waterMat };
}

export function setWorldLight(bundle, day, holdPos, holdTorch) {
  if (!bundle) return;
  for (const mat of [bundle.solidMat, bundle.waterMat]) {
    mat.uniforms.day.value = day;
    mat.uniforms.holdTorch.value = holdTorch ? 1 : 0;
    mat.uniforms.holdPos.value.copy(holdPos);
  }
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

