import * as THREE from 'three';
import { getQuality, isAdvanced } from './quality.js';

// Builds a whole character out of boxes and bakes it into ONE BufferGeometry
// with vertex colours. A mob used to be ~15 meshes (15 draw calls, 15 material
// uploads); now it is a single mesh, so extra detail boxes are essentially free.

const FACES = [
  { n: [1, 0, 0], o: [0.5, 0, 0], u: [0, 0, -1], v: [0, 1, 0], s: 0.95 },
  { n: [-1, 0, 0], o: [-0.5, 0, 0], u: [0, 0, 1], v: [0, 1, 0], s: 0.87 },
  { n: [0, 1, 0], o: [0, 0.5, 0], u: [1, 0, 0], v: [0, 0, 1], s: 1.07 },
  { n: [0, -1, 0], o: [0, -0.5, 0], u: [1, 0, 0], v: [0, 0, -1], s: 0.68 },
  { n: [0, 0, 1], o: [0, 0, 0.5], u: [1, 0, 0], v: [0, 1, 0], s: 1.0 },
  { n: [0, 0, -1], o: [0, 0, -0.5], u: [-1, 0, 0], v: [0, 1, 0], s: 0.82 },
];

// A quad's two triangles have to wind so that (u x v) points along n, or
// backface culling silently drops the face and you see into the box.
for (const f of FACES) {
  const [ux, uy, uz] = f.u;
  const [vx, vy, vz] = f.v;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  f.flip = cx * f.n[0] + cy * f.n[1] + cz * f.n[2] < 0;
}

const SRGB = new THREE.Color();

function hash2(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * @param {Array} boxes  { w,h,d,x,y,z,color, rx,ry,rz, grain, flat }
 *   grain: 0..1 amount of per-quad colour noise (surface texture). Default 0.05.
 *   flat:  true to skip the baked directional face shading.
 *   n:     face subdivision (1 = one quad per face, 2 = 2x2). Only worth
 *          raising on big parts, where it turns `grain` into visible texture.
 *   detail: decorative part, dropped entirely on standard graphics.
 *
 * On standard graphics every box collapses to one flat quad per face and
 * `detail` boxes are skipped, so the same parts list yields a much lighter
 * model without a second set of hand-written models to maintain.
 */
export function buildVoxGeometry(parts, full = false) {
  const advanced = full || isAdvanced();
  const boxes = advanced ? parts : parts.filter((b) => !b.detail);
  let quads = 0;
  for (const b of boxes) quads += 6 * subdiv(b, advanced) * subdiv(b, advanced);

  const pos = new Float32Array(quads * 4 * 3);
  const nor = new Float32Array(quads * 4 * 3);
  const col = new Float32Array(quads * 4 * 3);
  const idx = new (quads * 4 > 65535 ? Uint32Array : Uint16Array)(quads * 6);

  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const p = new THREE.Vector3();
  const nv = new THREE.Vector3();

  let vi = 0;
  let ii = 0;
  let bi = 0;

  for (const b of boxes) {
    const w = b.w;
    const h = b.h;
    const d = b.d;
    const n = subdiv(b, advanced);
    const grain = advanced ? (b.grain ?? 0.055) : 0;
    const rot = !!(b.rx || b.ry || b.rz);
    if (rot) {
      m.makeRotationFromEuler(new THREE.Euler(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ'));
      nm.setFromMatrix4(m);
    }
    SRGB.setHex(b.color, THREE.SRGBColorSpace);
    const cr = SRGB.r;
    const cg = SRGB.g;
    const cb = SRGB.b;

    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const shade = b.flat ? 1 : F.s;
      const ox = F.o[0] * w;
      const oy = F.o[1] * h;
      const oz = F.o[2] * d;
      const ux = F.u[0] * w;
      const uy = F.u[1] * h;
      const uz = F.u[2] * d;
      const vx = F.v[0] * w;
      const vy = F.v[1] * h;
      const vz = F.v[2] * d;

      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++) {
          const a0 = gx / n - 0.5;
          const a1 = (gx + 1) / n - 0.5;
          const b0 = gy / n - 0.5;
          const b1 = (gy + 1) / n - 0.5;
          const tint = 1 + (hash2(bi * 6 + f, gx, gy) - 0.5) * grain * 2;
          const k = shade * tint;
          const r = Math.min(1, cr * k);
          const g = Math.min(1, cg * k);
          const bl = Math.min(1, cb * k);

          const base = vi;
          for (const [ta, tb] of [[a0, b0], [a1, b0], [a1, b1], [a0, b1]]) {
            p.set(ox + ux * ta + vx * tb, oy + uy * ta + vy * tb, oz + uz * ta + vz * tb);
            nv.set(F.n[0], F.n[1], F.n[2]);
            if (rot) {
              p.applyMatrix4(m);
              nv.applyMatrix3(nm).normalize();
            }
            const o3 = vi * 3;
            pos[o3] = p.x + b.x;
            pos[o3 + 1] = p.y + b.y;
            pos[o3 + 2] = p.z + b.z;
            nor[o3] = nv.x;
            nor[o3 + 1] = nv.y;
            nor[o3 + 2] = nv.z;
            col[o3] = r;
            col[o3 + 1] = g;
            col[o3 + 2] = bl;
            vi++;
          }
          if (F.flip) {
            idx[ii++] = base;
            idx[ii++] = base + 2;
            idx[ii++] = base + 1;
            idx[ii++] = base;
            idx[ii++] = base + 3;
            idx[ii++] = base + 2;
          } else {
            idx[ii++] = base;
            idx[ii++] = base + 1;
            idx[ii++] = base + 2;
            idx[ii++] = base;
            idx[ii++] = base + 2;
            idx[ii++] = base + 3;
          }
        }
      }
    }
    bi++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

function subdiv(b, advanced) {
  return advanced ? (b.n || 1) : 1;
}

const geoCache = new Map();

/** Cached merged geometry. `key` must capture every variation in `build()`. */
export function cachedVoxGeometry(key, build, full = false) {
  const cacheKey = full ? `full|${key}` : `${getQuality()}|${key}`;
  let geo = geoCache.get(cacheKey);
  if (!geo) {
    geo = buildVoxGeometry(build(), full);
    geoCache.set(cacheKey, geo);
  }
  return geo;
}

/** Drops every cached geometry; callers must rebuild their meshes after. */
export function clearVoxCache() {
  for (const geo of geoCache.values()) geo.dispose();
  geoCache.clear();
}

export function shadeHex(hex, f) {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}
