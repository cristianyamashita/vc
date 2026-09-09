import * as THREE from 'three';

// Boxes in, one BufferGeometry out. Forked from VoxelCraft's js/voxmodel.js:
// a whole character or prop bakes into a single mesh with vertex colours, so
// an extra decorative box costs vertices but never a draw call. On top of the
// game's version this one adds per-box rotation, round shapes and a `detail`
// tier it can shed on slower machines.
//
// The spray layer is the game's, brought back across when outfits became
// documents: a garment box carries a `paint` map and each face is a grid of
// cells the outfit editor can colour one at a time.

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

/** Spray resolution: each face of a painted box is a PAINT_N x PAINT_N grid,
 *  and a cell is the "pixel" the spray brush colours. A box pays for that
 *  subdivision only once something on it is actually painted. */
export const PAINT_N = 6;

/** Index of one paint cell inside a box's own cell map. */
export function cellIndex(face, gx, gy) {
  return (face * PAINT_N + gy) * PAINT_N + gx;
}

/** The six face frames, so an editor can place a cell's centre in model space
 *  from the same basis the geometry is built from. */
export const FACE_BASIS = FACES.map((f) => ({ n: f.n, o: f.o, u: f.u, v: f.v }));

const SRGB = new THREE.Color();

let detailed = true;

/** Detail tier. Off drops `detail` boxes and collapses every face to one
 *  quad, which is the same parts list rendered far cheaper. */
export function setDetailed(on) {
  detailed = !!on;
}

export function isDetailed() {
  return detailed;
}

function hash2(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

/**
 * Where a point on the unit cube goes, and which way that surface faces.
 *
 * Every round shape here is the subdivided cube pushed outward — the same
 * machinery, three different pushes — so nothing else in the builder has to
 * know a sphere from a box. Positions come back in unit-cube space and are
 * scaled by w/h/d afterwards, which is why three unequal sizes give an
 * ellipsoid, an elliptical cylinder, or a cone on an oval base for free.
 */
function roundPoint(shape, axis, dx, dy, dz, fn, roundness, out) {
  if (shape === 'sphere') {
    const len = Math.hypot(dx, dy, dz) || 1;
    out.px = (dx / len) * 0.5;
    out.py = (dy / len) * 0.5;
    out.pz = (dz / len) * 0.5;
    out.nx = dx / len;
    out.ny = dy / len;
    out.nz = dz / len;
    return;
  }

  if (shape === 'rounded') {
    // A rounded box is the original cube with each point projected away from
    // a smaller inner box. Face centres stay flat while edges and corners get
    // a real radius, unlike an ellipsoid which makes a torso look inflated.
    const radius = Math.max(0.04, Math.min(0.28, roundness ?? 0.16));
    const core = 0.5 - radius;
    const cx = Math.max(-core, Math.min(core, dx));
    const cy = Math.max(-core, Math.min(core, dy));
    const cz = Math.max(-core, Math.min(core, dz));
    const vx = dx - cx;
    const vy = dy - cy;
    const vz = dz - cz;
    const len = Math.hypot(vx, vy, vz);
    if (len > 1e-9) {
      out.nx = vx / len;
      out.ny = vy / len;
      out.nz = vz / len;
      out.px = cx + out.nx * radius;
      out.py = cy + out.ny * radius;
      out.pz = cz + out.nz * radius;
    } else {
      out.px = dx;
      out.py = dy;
      out.pz = dz;
      out.nx = fn[0];
      out.ny = fn[1];
      out.nz = fn[2];
    }
    return;
  }

  // Cylinder and cone keep one axis and round the cross-section. `a` runs
  // along the axis; `u` and `v` are the other two, in x, y, z order.
  const d3 = [dx, dy, dz];
  const iu = axis === 0 ? 1 : 0;
  const iv = axis === 2 ? 1 : 2;
  const a = d3[axis];
  const u = d3[iu];
  const v = d3[iv];

  // Square to disc: pull each point in by the ratio of its square radius to
  // its true radius. The edge of the square lands on the circle and the
  // inside stays filled, which is what keeps the end caps solid instead of
  // collapsing every cap vertex onto the rim.
  const sq = Math.max(Math.abs(u), Math.abs(v));
  const rad = Math.hypot(u, v);
  const k = rad > 1e-9 ? sq / rad : 0;
  // A cone tapers to nothing at the +axis end; a cylinder does not taper.
  const taper = shape === 'cone' ? 0.5 - a : 1;

  const pos = [0, 0, 0];
  pos[axis] = a;
  pos[iu] = u * k * taper;
  pos[iv] = v * k * taper;
  out.px = pos[0];
  out.py = pos[1];
  out.pz = pos[2];

  // A cap keeps the flat face normal it already had; the wall gets a radial
  // one, tipped up the slope on a cone so the shading follows the taper.
  if (Math.abs(fn[axis]) > 0.5) {
    out.nx = fn[0];
    out.ny = fn[1];
    out.nz = fn[2];
    return;
  }
  const rl = rad > 1e-9 ? rad : 1;
  // Base radius over height, with the unit cube's 0.5 and 1: the slope of a
  // cone's side. Zero for a cylinder, whose wall normal is purely radial.
  const na = shape === 'cone' ? 0.5 : 0;
  const nl = Math.hypot(u / rl, v / rl, na) || 1;
  const nrm = [0, 0, 0];
  nrm[axis] = na / nl;
  nrm[iu] = u / rl / nl;
  nrm[iv] = v / rl / nl;
  out.nx = nrm[0];
  out.ny = nrm[1];
  out.nz = nrm[2];
}

function subdivOf(b, advanced) {
  // A round part IS its subdivision: collapsing it to one quad per face would
  // not make it cheaper to look at, it would make it a cube. The cheap tier
  // is for shedding decoration, not for changing what a thing is, so a round
  // part keeps a coarse subdivision there instead of losing its shape.
  // The floor is 3, not 1: a part that says "cylinder" must never come out
  // a square prism because somebody wrote `n: 1`.
  if (b.shape && b.shape !== 'box') {
    return advanced ? Math.max(b.paint ? PAINT_N : 3, b.n || 4) : 3;
  }
  // A painted surface must keep its cells even in the simple detail tier;
  // otherwise the texture vanishes as soon as the viewer chooses Simple.
  if (b.paint) return Math.max(PAINT_N, b.n || 1);
  if (!advanced) return 1;
  // A painted box always renders at the paint grid, or the cells it carries
  // would have nowhere to land.
  return b.n || 1;
}

function crossScale(value, component) {
  if (Array.isArray(value)) return Number.isFinite(value[component]) ? value[component] : 1;
  return Number.isFinite(value) ? value : 1;
}

/** Width/depth scale for a vertically tapered part at unit-local y. */
function taperScale(b, y) {
  const t = Math.max(0, Math.min(1, y + 0.5));
  const bx = crossScale(b.scaleBottom, 0);
  const bz = crossScale(b.scaleBottom, 1);
  const tx = crossScale(b.scaleTop, 0);
  const tz = crossScale(b.scaleTop, 1);
  return [bx + (tx - bx) * t, bz + (tz - bz) * t];
}

/**
 * @param {Array} parts  { w,h,d,x,y,z,color, rx,ry,rz, grain, flat, n, detail }
 *   grain:  0..1 per-quad colour noise, i.e. surface texture. Default 0.055.
 *   flat:   skip the baked directional face shading.
 *   n:      face subdivision (1 = one quad per face). Only worth raising on
 *           big parts, where it turns `grain` into visible texture — and on
 *           spheres, where it is what makes them round.
 *   shape:  "sphere", "cylinder", "cone" or "rounded" pushes the subdivided
 *           cube onto that solid. Nothing else about the part changes, so
 *           w/h/d still give its size. `rounded` preserves flat face centres
 *           and rounds only the box edges and corners.
 *   roundness: rounded-box corner radius in unit-cube space (0.04..0.28).
 *   scaleBottom/scaleTop: optional x/z scales for a vertically tapered part.
 *   axis:   "x" | "y" | "z", which way a cylinder or cone runs. Default "y",
 *           and a cone's point is at the +axis end.
 *   detail: decorative, dropped entirely when the detail tier is off.
 *   paint:  Map or sparse object of cellIndex(face, gx, gy) -> colour, sprayed
 *           over the box's own colour. The cell keeps the face shading and
 *           the grain, so paint sits on the surface instead of flattening it.
 * @param {boolean} full  force the detailed tier regardless of the setting.
 */
export function buildGeometry(parts, full = false) {
  const advanced = full || detailed;
  const boxes = advanced ? parts : parts.filter((b) => !b.detail);
  let quads = 0;
  for (const b of boxes) {
    const n = subdivOf(b, advanced);
    quads += 6 * n * n;
  }

  const pos = new Float32Array(quads * 4 * 3);
  const nor = new Float32Array(quads * 4 * 3);
  const col = new Float32Array(quads * 4 * 3);
  const idx = new (quads * 4 > 65535 ? Uint32Array : Uint16Array)(quads * 6);

  // Reused so a thousand-part model does not allocate a thousand times.
  const R = { px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0 };
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const euler = new THREE.Euler();
  const p = new THREE.Vector3();
  const nv = new THREE.Vector3();

  let vi = 0;
  let ii = 0;
  let bi = 0;

  for (const b of boxes) {
    const w = b.w;
    const h = b.h;
    const d = b.d;
    const n = subdivOf(b, advanced);
    const grain = advanced ? (b.grain ?? 0.055) : 0;
    const rot = !!(b.rx || b.ry || b.rz);
    if (rot) {
      euler.set(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ');
      m.makeRotationFromEuler(euler);
      nm.setFromMatrix4(m);
    }
    SRGB.setHex(b.color, THREE.SRGBColorSpace);
    const cr = SRGB.r;
    const cg = SRGB.g;
    const cb = SRGB.b;

    const shape = b.shape && b.shape !== 'box' ? b.shape : null;
    const axis = AXIS_INDEX[b.axis] ?? 1;
    // Paint is authored on a PAINT_N grid; a box drawn at a finer or coarser
    // subdivision maps its cells onto that grid rather than losing them.
    const paint = advanced && b.paint ? b.paint : null;

    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      // A round part carries real normals, so the baked per-face shading
      // would only paint cube facets back onto it.
      const shade = b.flat || shape ? 1 : F.s;
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
          let r = cr;
          let g = cg;
          let bl = cb;
          if (paint) {
            const key = cellIndex(f,
              Math.min(PAINT_N - 1, Math.floor((gx / n) * PAINT_N)),
              Math.min(PAINT_N - 1, Math.floor((gy / n) * PAINT_N)));
            const hit = paint instanceof Map ? paint.get(key) : paint[key];
            if (hit !== undefined) {
              SRGB.setHex(toHex(hit, 0xa0a0a0), THREE.SRGBColorSpace);
              r = SRGB.r;
              g = SRGB.g;
              bl = SRGB.b;
            }
          }
          r = Math.min(1, r * k);
          g = Math.min(1, g * k);
          bl = Math.min(1, bl * k);

          const base = vi;
          for (const [ta, tb] of [[a0, b0], [a1, b0], [a1, b1], [a0, b1]]) {
            if (shape) {
              // The point on the unit cube, pushed out onto the solid, then
              // scaled by the part's own size. Every quad's corner lands on
              // the same place as its neighbour's, so the seams shade
              // smoothly with no extra bookkeeping.
              roundPoint(shape, axis,
                F.o[0] + F.u[0] * ta + F.v[0] * tb,
                F.o[1] + F.u[1] * ta + F.v[1] * tb,
                F.o[2] + F.u[2] * ta + F.v[2] * tb, F.n, b.roundness, R);
              const [tsx, tsz] = taperScale(b, R.py);
              p.set(R.px * w * tsx, R.py * h, R.pz * d * tsz);
              nv.set(R.nx, R.ny, R.nz);
            } else {
              p.set(ox + ux * ta + vx * tb, oy + uy * ta + vy * tb, oz + uz * ta + vz * tb);
              nv.set(F.n[0], F.n[1], F.n[2]);
            }
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

const _cellEuler = new THREE.Euler();
const _cellMat = new THREE.Matrix4();
const _cellNrm = new THREE.Matrix3();
const _round = { px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0 };

/**
 * Where one paint cell sits on a box, and which way it faces, in the model's
 * own space.
 *
 * The editor needs this to hit-test a spray stroke, and it has to be the same
 * arithmetic the geometry is built from — including the push onto a cylinder
 * and the box's own rotation — or the cell under the cursor is not the cell
 * that gets painted, and the error is worst exactly where it matters: on a
 * sleeve, which is round.
 *
 * @param {object} b     the box, as passed to buildGeometry
 * @param {number} face  0..5
 * @param {THREE.Vector3} p   receives the cell centre
 * @param {THREE.Vector3} nv  receives the outward normal
 */
export function cellPoint(b, face, gx, gy, p, nv) {
  const F = FACES[face];
  const ta = (gx + 0.5) / PAINT_N - 0.5;
  const tb = (gy + 0.5) / PAINT_N - 0.5;
  const dx = F.o[0] + F.u[0] * ta + F.v[0] * tb;
  const dy = F.o[1] + F.u[1] * ta + F.v[1] * tb;
  const dz = F.o[2] + F.u[2] * ta + F.v[2] * tb;
  const shape = b.shape && b.shape !== 'box' ? b.shape : null;
  if (shape) {
    roundPoint(shape, AXIS_INDEX[b.axis] ?? 1, dx, dy, dz, F.n, b.roundness, _round);
    const [tsx, tsz] = taperScale(b, _round.py);
    p.set(_round.px * b.w * tsx, _round.py * b.h, _round.pz * b.d * tsz);
    nv.set(_round.nx, _round.ny, _round.nz);
  } else {
    p.set(dx * b.w, dy * b.h, dz * b.d);
    nv.set(F.n[0], F.n[1], F.n[2]);
  }
  if (b.rx || b.ry || b.rz) {
    _cellEuler.set(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ');
    _cellMat.makeRotationFromEuler(_cellEuler);
    _cellNrm.setFromMatrix4(_cellMat);
    p.applyMatrix4(_cellMat);
    nv.applyMatrix3(_cellNrm).normalize();
  }
  p.x += b.x;
  p.y += b.y;
  p.z += b.z;
}

/** Shared material for every box-built mesh in the app. */
export const BOX_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

export function shadeHex(hex, f) {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

/** `"#c8a07a"` / `"c8a07a"` / `0xc8a07a` -> integer, with a fallback so one
 *  bad colour in an imported document tints a box wrong instead of throwing. */
export function toHex(value, fallback = 0xffffff) {
  if (typeof value === 'number' && Number.isFinite(value)) return value & 0xffffff;
  if (typeof value !== 'string') return fallback;
  const s = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return fallback;
  return parseInt(s, 16);
}
