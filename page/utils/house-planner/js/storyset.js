// Export a project as a Story Studio bundle: one `set` document plus the
// `prop` documents it needs. Story Studio only knows placements of props, so
// everything the planner builds itself becomes a box prop: one per storey
// (floors, walls, openings, stairs, railings, room finishes), one per roof,
// one per outdoor item, one for the fences and site walls, one for the
// garden patches, a small bulb per light point, and every placed object
// Story Studio does not ship itself (generated, custom and inline objects;
// the catalog items copied from Story Studio are referenced by id). The
// document is centimetres and the bundle metres; the Story Studio ground is
// flat, so terrain heights are not carried over. Story Studio reads the
// file with Library › Import.
import { wallLength, polylineLength, storeyTop, topStorey, OPENING_PRESETS } from "./schema.js";
import { wallHeight, wallAngle, clampOpening, outerSide, cornerExtension } from "./build/walls.js";
import { stairsBoxes, stairsSteps } from "./build/stairs.js";
import { floorTop, floorThickness, tileKey } from "./build/slabs.js";
import { roofRect, ROOF_THICKNESS, CEILING } from "./build/roof.js";
import { segments, pointAlong, clampGate, stations, POST, DEFAULT_TINT, gateColor, railingOffset } from "./build/railing.js";
import { polygonOutline, polygonLevels, POOL_WALL, POOL_WATER, PATH_THICK, PATCH_LIFT, MUD_TINT } from "./build/outdoor.js";
import { pointInPolygon, polygonBounds, insetPolygon, dedupe } from "./geom.js";
import { Sun } from "./sun.js";

const DEG = Math.PI / 180;
const MAX_BOXES = 4000; // Story Studio's limit per prop document
const GLASS = { color: "#bcd8e6", opacity: 0.35 };
const CEILING_TINT = "#f1ede6";
const FLAT_GROUND = { heightAt: () => 0 };

// Planner texture → Story Studio texture (same id, another id with a tint,
// or a plain colour when Story Studio has nothing alike).
const TEXTURES = {
  grass: "grass", sand: "sand", dirt: "dirt", rock: "rock", paving: "paving", concrete: "concrete", asphalt: "asphalt",
  woodFloor: "woodFloor", planks: "planks", tiles: "tiles", carpet: "carpet", rubber: "rubber", plaster: "plaster", bricks: "bricks", metalPlate: "metalPlate",
  gravel: { color: "#9b968c" }, woodLight: "woodFloor", woodDark: "planks", stone: "rock", stoneTiles: "paving",
  bricksRed: { material: "bricks", color: "#d4876f" }, bricksOrange: { material: "bricks", color: "#e8a070" },
  marble: { material: "tiles", color: "#f1efea" }, azulejo: { material: "tiles", color: "#cfe3ee" },
  roofTiles: { color: "#b5563f" }, fiberCement: { material: "concrete", color: "#dcdcd6" },
};
/** Story Studio finish ({material?, color}) for a planner texture id and tint. */
export function finish(material, tint, fallback = "#b9b1a0") {
  const entry = material ? TEXTURES[material] ?? { color: "#c9c3b8" } : {};
  const e = typeof entry === "string" ? { material: entry } : entry;
  if (e.material) return { material: e.material, color: tint || e.color || "#ffffff" };
  return { color: tint || e.color || fallback };
}

const mm = (cm) => Math.round(cm * 10) / 1000; // cm → m, millimetre precision
const rad = (v) => Math.round(v * 10000) / 10000;
const rot = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, f) => a + (b - a) * f;

/** Collects box parts in centimetres and writes them in metres. */
class Boxes {
  constructor() {
    this.list = [];
  }
  /** Box of w×h×d cm centred at (x, y, z); `fin` is a finish plus shape/opacity; `r` rotations in radians. */
  add(w, h, d, x, y, z, fin = {}, r = {}) {
    if (!(w >= 0.1) || !(h >= 0.1) || !(d >= 0.1)) return;
    const b = { w: mm(w), h: mm(h), d: mm(d), x: mm(x), y: mm(y), z: mm(z), color: fin.color || (fin.material ? "#ffffff" : "#a0a0a0") };
    if (fin.material) b.material = fin.material;
    if (fin.opacity != null && fin.opacity < 1) b.opacity = fin.opacity;
    if (fin.shape && fin.shape !== "box") b.shape = fin.shape;
    if (fin.axis && ["cylinder", "cone", "roundcone", "torus"].includes(fin.shape)) b.axis = fin.axis;
    for (const k of ["rx", "ry", "rz"]) if (r[k]) b[k] = rad(r[k]);
    this.list.push(b);
  }
  get size() {
    return this.list.length;
  }
}

// ----------------------------------------------------------------- tiles

/** Tiles merged into rectangles {x0, x1, z0, z1} (cm): runs along x, then equal runs stacked along z. */
export function tileRects(tiles, tile, skip = null) {
  const rows = new Map();
  for (const [x, z] of tiles) {
    if (skip?.has(tileKey(x, z))) continue;
    if (!rows.has(z)) rows.set(z, new Set());
    rows.get(z).add(x);
  }
  const strips = [];
  for (const [z, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
    let s = null;
    for (const x of [...xs].sort((a, b) => a - b)) {
      if (s && x === s.x1) s.x1 = x + 1;
      else strips.push((s = { x0: x, x1: x + 1, z0: z, z1: z + 1 }));
    }
  }
  const out = [];
  for (const s of strips) {
    const prev = out.find((o) => o.x0 === s.x0 && o.x1 === s.x1 && o.z1 === s.z0);
    if (prev) prev.z1 = s.z1;
    else out.push({ ...s });
  }
  return out.map((o) => ({ x0: o.x0 * tile, x1: o.x1 * tile, z0: o.z0 * tile, z1: o.z1 * tile }));
}

/**
 * A polygon (cm) rasterised into rectangles: the grid lines are the
 * polygon's own vertex coordinates plus subdivisions no wider than `cell`,
 * so rectilinear shapes come out exact and slanted edges step by `cell`.
 */
export function polygonRects(pts, cell = 25, holes = []) {
  if (pts.length < 3) return [];
  const b = polygonBounds(pts);
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  cell = Math.max(cell, span / 160);
  const axis = (lo, hi, vals) => {
    const set = new Set([lo, hi, ...vals.filter((v) => v > lo && v < hi)].map((v) => Math.round(v * 10) / 10));
    const base = [...set].sort((a, c) => a - c);
    const out = [];
    for (let i = 0; i < base.length; i++) {
      out.push(base[i]);
      if (i + 1 < base.length) {
        const n = Math.ceil((base[i + 1] - base[i]) / cell);
        for (let k = 1; k < n; k++) out.push(base[i] + ((base[i + 1] - base[i]) * k) / n);
      }
    }
    return out;
  };
  const xs = axis(b.minX, b.maxX, pts.map((p) => p[0]));
  const zs = axis(b.minZ, b.maxZ, pts.map((p) => p[1]));
  const inside = (x, z) => pointInPolygon(x, z, pts) && !holes.some((h) => pointInPolygon(x, z, h));
  const strips = [];
  for (let j = 0; j + 1 < zs.length; j++) {
    const cz = (zs[j] + zs[j + 1]) / 2;
    let s = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      if (!inside((xs[i] + xs[i + 1]) / 2, cz)) {
        s = null;
        continue;
      }
      if (s) s.x1 = xs[i + 1];
      else strips.push((s = { x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] }));
    }
  }
  const out = [];
  for (const s of strips) {
    const prev = out.find((o) => Math.abs(o.x0 - s.x0) < 0.01 && Math.abs(o.x1 - s.x1) < 0.01 && Math.abs(o.z1 - s.z0) < 0.01);
    if (prev) prev.z1 = s.z1;
    else out.push({ ...s });
  }
  return out;
}
function rectBoxes(out, rects, y0, y1, fin) {
  for (const r of rects) out.add(r.x1 - r.x0, y1 - y0, r.z1 - r.z0, (r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2, fin);
}

// ----------------------------------------------------------------- walls

/** One wall as boxes in building-local cm (ports build/walls.js without the geometry). */
function wallBoxes(out, wall, storey, walls, tile) {
  const H = wallHeight(wall, storey), T = wall.thickness, L = wallLength(wall);
  if (L < 1) return;
  const theta = wallAngle(wall), c = Math.cos(theta), s = Math.sin(theta);
  const E = storey.elevation;
  const put = (w, h, d, u, y, v, fin) => out.add(w, h, d, wall.a[0] + u * c - v * s, E + y, wall.a[1] + u * s + v * c, fin, { ry: -theta });
  const [e0, e1] = cornerExtension(wall, walls);
  const twoFaced = !!(wall.outerMaterial || wall.outerTint);
  const side = twoFaced ? outerSide(wall, storey, tile) : 0;
  const inner = finish(wall.material, wall.tint, "#f2ede4");
  const outer = finish(wall.outerMaterial ?? wall.material, wall.outerTint ?? wall.tint, "#f2ede4");
  const openings = wall.openings.map((op) => clampOpening({ ...op }, wall)).sort((a, b) => a.offset - b.offset);
  const SKIRT = 7, SKIRT_T = 1.2, TRIM = 5;
  const span = (u0, u1, y0, y1) => {
    if (u1 - u0 < 0.1 || y1 - y0 < 0.1) return;
    if (wall.skirting && y0 === 0) for (const k of [-1, 1]) put(u1 - u0, SKIRT, SKIRT_T, (u0 + u1) / 2, SKIRT / 2, k * (T / 2 + SKIRT_T / 2), { color: "#e9e3d8" });
    if (!twoFaced) return put(u1 - u0, y1 - y0, T, (u0 + u1) / 2, (y0 + y1) / 2, 0, inner);
    put(u1 - u0, y1 - y0, T / 2, (u0 + u1) / 2, (y0 + y1) / 2, (-side * T) / 4, inner);
    put(u1 - u0, y1 - y0, T / 2, (u0 + u1) / 2, (y0 + y1) / 2, (side * T) / 4, outer);
  };
  let cursor = -e0;
  for (const op of openings) {
    const u0 = op.offset, u1 = op.offset + op.width;
    const top = Math.min(H, op.sill + op.height);
    span(cursor, u0, 0, H);
    span(u0, u1, top, H);
    if (op.sill > 0) span(u0, u1, 0, op.sill);
    cursor = Math.max(cursor, u1);
    const preset = OPENING_PRESETS[op.preset] || {};
    if (preset.arch) {
      // corners above an arched passage, stepped
      const r = op.width / 2, cx = u0 + r, yb = top - r, N = 5;
      for (let k = 0; k < N; k++) {
        const ya = yb + (r * k) / N, yz = yb + (r * (k + 1)) / N;
        const half = Math.sqrt(Math.max(0, r * r - (ya - yb) ** 2));
        for (const k2 of [-1, 1]) span(k2 < 0 ? cx - r : cx + half, k2 < 0 ? cx - half : cx + r, ya, yz);
      }
    }
    leafBoxes(op, T, top - op.sill, put);
    if (wall.trim && !preset.arch)
      for (const k of [-1, 1]) {
        const z = k * (T / 2 + 0.6), h = top - op.sill + TRIM, fin = { color: op.frameColor };
        const yc = op.sill + h / 2 - (op.sill > 0 ? TRIM / 2 : 0);
        put(TRIM, h, 1.2, u0 - TRIM / 2, yc, z, fin);
        put(TRIM, h, 1.2, u1 + TRIM / 2, yc, z, fin);
        put(op.width + TRIM * 2, TRIM, 1.2, (u0 + u1) / 2, top + TRIM / 2, z, fin);
        if (op.sill > 0) put(op.width + TRIM * 2, TRIM, 1.2, (u0 + u1) / 2, op.sill - TRIM / 2, z, fin);
      }
  }
  span(cursor, L + e1, 0, H);
}
/** Frame, leaf and glass of a closed opening (ports leafGeometry). */
function leafBoxes(op, T, h, put) {
  if (OPENING_PRESETS[op.preset]?.passage) return;
  const FRAME = 6;
  const cx = op.offset + op.width / 2, y0 = op.sill, w = op.width;
  const fd = Math.min(T, Math.max(8, T * 0.9));
  const fc = { color: op.frameColor }, lc = { color: op.leafColor }, handle = { color: "#c8c0a8" };
  const glass = { color: op.glassColor, opacity: 0.35 };
  put(FRAME, h, fd, cx - w / 2 + FRAME / 2, y0 + h / 2, 0, fc);
  put(FRAME, h, fd, cx + w / 2 - FRAME / 2, y0 + h / 2, 0, fc);
  put(w, FRAME, fd, cx, y0 + h - FRAME / 2, 0, fc);
  const iw = w - FRAME * 2;
  const dir = op.flip ? -1 : 1;
  if (op.type === "window") {
    put(w, FRAME, fd + 4, cx, y0 + FRAME / 2, 0, fc);
    const ih = h - FRAME * 2;
    put(iw, ih, 1.2, cx, y0 + FRAME + ih / 2, 0, glass);
    const bars = op.preset === "window-wide" ? 2 : op.preset === "window-casement" ? 1 : 0;
    for (let i = 1; i <= bars; i++) put(3, ih, fd * 0.6, cx - iw / 2 + (iw * i) / (bars + 1), y0 + FRAME + ih / 2, 0, fc);
    if (op.preset !== "window-small") put(iw, 3, fd * 0.6, cx, y0 + FRAME + ih / 2, 0, fc);
    return;
  }
  const ih = h - FRAME;
  switch (op.preset) {
    case "door-double": {
      const lw = iw / 2 - 1;
      put(lw, ih - 1, 4, cx - lw / 2 - 1, y0 + ih / 2, 0, lc);
      put(lw, ih - 1, 4, cx + lw / 2 + 1, y0 + ih / 2, 0, lc);
      put(2.5, 12, 6, cx - 8, y0 + 100, 3 * dir, handle);
      put(2.5, 12, 6, cx + 8, y0 + 100, 3 * dir, handle);
      break;
    }
    case "door-sliding": {
      const lw = iw / 2 + 2;
      for (const k of [-1, 1]) {
        const px = cx + (k * lw) / 2 - k;
        put(FRAME * 0.7, ih, 3, px - (k * lw) / 2 + k * FRAME * 0.35, y0 + ih / 2, k * 2.2, fc);
        put(FRAME * 0.7, ih, 3, px + (k * lw) / 2 - k * FRAME * 0.35, y0 + ih / 2, k * 2.2, fc);
        put(lw, FRAME * 0.7, 3, px, y0 + ih - FRAME * 0.35, k * 2.2, fc);
        put(lw, FRAME * 0.7, 3, px, y0 + FRAME * 0.35, k * 2.2, fc);
        put(lw - FRAME, ih - FRAME, 0.8, px, y0 + ih / 2, k * 2.2, glass);
      }
      break;
    }
    case "door-garage": {
      put(iw, ih - 1, 4, cx, y0 + ih / 2, 0, lc);
      for (let i = 1; i < 4; i++) put(iw, 1.5, 5, cx, y0 + (ih * i) / 4, 0, { color: "#6b5a46" });
      break;
    }
    default:
      put(iw - 1, ih - 1, 4, cx, y0 + ih / 2, 0, lc);
      put(2.5, 12, 6, cx + (iw / 2 - 8) * dir, y0 + 100, 3 * dir, handle);
      put(2.5, 12, 6, cx + (iw / 2 - 8) * dir, y0 + 100, -3 * dir, handle);
  }
}

// ---------------------------------------------------------------- stairs

/** A stair as boxes in building-local cm (ports stairsGeometry and railingGeometry). */
function stairBoxes(out, st, storey) {
  const phi = st.rotation * DEG, c = Math.cos(phi), s = Math.sin(phi);
  const E = storey.elevation;
  const fin = finish(st.material, st.tint, "#c8b89a");
  const world = (lx, lz) => [st.at[0] + lx * c + lz * s, st.at[1] - lx * s + lz * c];
  const put = (w, h, d, lx, y, lz, f = fin, r = {}) => {
    const [x, z] = world(lx, lz);
    out.add(w, h, d, x, E + y, z, f, { ry: phi, ...r });
  };
  const boxes = stairsBoxes(st);
  const solid = (b, y0, y1) => put(b.x1 - b.x0, y1 - y0, b.z1 - b.z0, (b.x0 + b.x1) / 2, (y0 + y1) / 2, (b.z0 + b.z1) / 2);
  if (st.base !== "open") for (const b of boxes) solid(b, 0, b.top);
  else {
    const TREAD_T = 6, LANDING_T = 12, STRINGER_W = 8;
    const { riser } = stairsSteps(st);
    for (const b of boxes) {
      const t = b.landing ? LANDING_T : TREAD_T;
      solid(b, b.top - t, b.top);
      if (b.landing) continue;
      const alongX = b.x1 - b.x0 < b.z1 - b.z0;
      const y0 = Math.max(0, b.top - riser - t), y1 = b.top - t;
      if (y1 - y0 < 1) continue;
      if (alongX) for (const z of [b.z0, b.z1 - STRINGER_W]) solid({ x0: b.x0, x1: b.x1, z0: z, z1: z + STRINGER_W }, y0, y1);
      else for (const x of [b.x0, b.x1 - STRINGER_W]) solid({ x0: x, x1: x + STRINGER_W, z0: b.z0, z1: b.z1 }, y0, y1);
    }
  }
  if (!st.railing || st.railing === "none") return;
  const RAIL_H = 90, RAIL_EVERY = 2;
  const thick = st.railingStyle === "metal" ? 3 : 5;
  const rail = { color: st.railingStyle === "metal" ? "#4a5054" : "#8d6e4f", shape: "cylinder", axis: "y" };
  const post = (x, y0, z, y1) => put(thick, y1 - y0, thick, x, (y0 + y1) / 2, z, rail);
  const bar = (a, b) => {
    const [ax, az] = world(a[0], a[2]), [bx, bz] = world(b[0], b[2]);
    const dx = bx - ax, dy = b[1] - a[1], dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1) return;
    out.add(len, thick, thick, (ax + bx) / 2, E + (a[1] + b[1]) / 2, (az + bz) / 2, { ...rail, axis: "x" }, { ry: Math.atan2(-dz, dx), rz: Math.asin(dy / len) });
  };
  const treads = boxes.filter((b) => !b.landing);
  const sides = st.railing === "both" ? [-1, 1] : [st.railing === "left" ? -1 : 1];
  const flights = [];
  let cur = null;
  for (const b of treads) {
    const ctr = [(b.x0 + b.x1) / 2, b.top, (b.z0 + b.z1) / 2];
    if (cur && cur.boxes.length) {
      const p = cur.boxes[cur.boxes.length - 1].c;
      const dir = [Math.sign(ctr[0] - p[0]), Math.sign(ctr[2] - p[2])];
      if (cur.dir && (cur.dir[0] !== dir[0] || cur.dir[1] !== dir[1])) cur = null;
      else cur.dir = cur.dir || dir;
    }
    if (!cur) flights.push((cur = { boxes: [], dir: null }));
    cur.boxes.push({ c: ctr, b });
  }
  for (const f of flights) {
    const dir = f.dir || [1, 0];
    const n = [-dir[1], dir[0]];
    for (const side of sides) {
      const pts = [];
      f.boxes.forEach(({ c: ctr, b }, i) => {
        const half = dir[0] !== 0 ? (b.z1 - b.z0) / 2 : (b.x1 - b.x0) / 2;
        const x = ctr[0] + n[0] * side * (half - thick), z = ctr[2] + n[1] * side * (half - thick);
        if (i % RAIL_EVERY === 0 || i === f.boxes.length - 1) {
          post(x, ctr[1], z, ctr[1] + RAIL_H);
          pts.push([x, ctr[1] + RAIL_H, z]);
        }
      });
      for (let i = 0; i < pts.length - 1; i++) bar(pts[i], pts[i + 1]);
    }
  }
}

// -------------------------------------------------------------- railings

/** A railing or fence as boxes (same frame as its points), on a level base (ports buildRailing). */
function railingBoxes(out, item, kind, baseY) {
  const pts = item.points;
  if (pts.length < 2 || polylineLength(pts) < 5) return;
  const H = item.height, style = item.style, post = POST[style] ?? 5;
  const fin = finish(item.material, item.tint || DEFAULT_TINT[style] || "#ffffff");
  const at = (s) => pointAlong(pts, s);
  // box of w×h×d at (u along, v up, wv right) of a level frame at p heading (dx, dz)
  const frame = (p, w, h, d, u, v, wv, f = fin, shape = null) =>
    out.add(w, h, d, p.x + p.dx * u - p.dz * wv, baseY + v, p.z + p.dz * u + p.dx * wv, shape ? { ...f, shape } : f, { ry: Math.atan2(-p.dz, p.dx) });
  const st = stations(item, kind);
  if (post > 0) {
    const seen = new Set();
    for (const s of st) {
      const key = Math.round(s.s * 10);
      if (seen.has(key)) continue;
      seen.add(key);
      const p = at(s.s);
      const big = style === "masonry";
      const ph = big ? H + (kind === "fence" ? 8 : 5) : style === "glass" || style === "metal" ? H - 3 : H + 3;
      frame(p, post, ph, post, 0, ph / 2, 0);
      if (big) frame(p, post + 6, 4, post + 6, 0, ph + 2, 0);
    }
  }
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1];
    if (a.end || a.seg !== b.seg) continue;
    const L = b.s - a.s;
    if (L < 1) continue;
    const A = at(a.s);
    if (a.gate) {
      gateBoxes(out, a.gate, A, L, H, style, item, baseY, fin);
      continue;
    }
    const mid = L / 2, inner = Math.max(0, L - post);
    const uprights = (gap, w, d, v0, v1, wv = 0) => {
      const n = Math.max(0, Math.floor((inner - w) / gap));
      if (!n) return;
      const step = inner / (n + 1);
      for (let k = 1; k <= n; k++) frame(at(a.s + post / 2 + step * k), w, v1 - v0, d, 0, (v0 + v1) / 2, wv);
    };
    switch (style) {
      case "glass":
        frame(A, L, 4, 5, mid, H - 2, 0);
        frame(A, Math.max(1, inner - 2), Math.max(1, H - 14), 1.2, mid, 8 + (H - 14) / 2, 0, GLASS);
        break;
      case "wood":
        frame(A, L, 5, 9, mid, H - 2.5, 0);
        frame(A, inner, 4, 6, mid, 10, 0);
        uprights(10, 4, 2.2, 8, H - 5);
        break;
      case "metal":
        frame(A, L, 4, 4, mid, H - 2, 0);
        frame(A, inner, 3, 3, mid, 8, 0);
        uprights(12, 1.5, 1.5, 8, H - 4);
        break;
      case "masonry": {
        const t = kind === "fence" ? 25 : 20;
        frame(A, L, H - 4, t, mid, (H - 4) / 2, 0);
        frame(A, L, 4, t + 6, mid, H - 2, 0);
        break;
      }
      case "picket":
        frame(A, inner, 8, 3, mid, H * 0.3, -3);
        frame(A, inner, 8, 3, mid, H * 0.8, -3);
        uprights(12, 7, 2, 3, H, 0.5);
        break;
      case "ranch":
        frame(A, L, 12, 4, mid, H - 6, 0);
        frame(A, L, 12, 4, mid, H * 0.62, 0);
        frame(A, L, 12, 4, mid, H * 0.3, 0);
        break;
      case "hedge": {
        const n = Math.max(1, Math.round(L / 60));
        const piece = L / n;
        for (let k = 0; k < n; k++) {
          const h = H * (k % 2 ? 0.94 : 1);
          frame(A, piece + 8, h, 40, (k + 0.5) * piece, h / 2 - 3, 0, fin, "rounded");
        }
        break;
      }
    }
  }
}
/** A closed gate across the bay from A (ports gateGeometry with `open` at 0). */
function gateBoxes(out, gate, A, L, H, style, item, baseY, bayFin) {
  const fin = finish(gate.material, gateColor(gate, style, item));
  const frame = (w, h, d, u, v, wv, f = fin) => out.add(w, h, d, A.x + A.dx * u - A.dz * wv, baseY + v, A.z + A.dz * u + A.dx * wv, f, { ry: Math.atan2(-A.dz, A.dx) });
  const top = H - 2, bottom = 8;
  const leaf = (u0, u1, wv = 0) => {
    const w = u1 - u0, cu = (u0 + u1) / 2;
    frame(4, top - bottom, 3, u0 + 2, (top + bottom) / 2, wv);
    frame(4, top - bottom, 3, u1 - 2, (top + bottom) / 2, wv);
    frame(w, 4, 3, cu, top - 2, wv);
    frame(w, 4, 3, cu, bottom + 2, wv);
    if (style === "picket" || style === "wood") {
      const n = Math.max(1, Math.floor((w - 8) / 10)), step = (w - 8) / (n + 1);
      for (let k = 1; k <= n; k++) frame(6, top - bottom - 2, 1.6, u0 + 4 + step * k, (top + bottom) / 2, wv + 1.2);
    } else {
      const n = Math.max(1, Math.floor((w - 8) / 11)), step = (w - 8) / (n + 1);
      for (let k = 1; k <= n; k++) frame(1.6, top - bottom - 6, 1.6, u0 + 4 + step * k, (top + bottom) / 2, wv);
      frame(w - 8, 1.5, 1.5, cu, (top + bottom) / 2, wv);
    }
  };
  if (gate.type === "double") {
    leaf(3, L / 2 - 1.5);
    leaf(L / 2 + 1.5, L - 3);
  } else if (gate.type === "sliding") {
    leaf(2, L - 2, 12);
    frame(L * 1.5, 2, 4, L * 0.75, 1, 12);
    frame(6, H - 4, 6, L - 2, (H - 4) / 2, 18);
  } else leaf(3, L - 3);
  void bayFin;
}

// ------------------------------------------------------------ site walls

/** A site wall on level ground (ports buildSiteWall with a flat terrain). */
function siteWallBoxes(out, wall) {
  const pts = wall.points;
  if (pts.length < 2) return;
  const H = wall.height, t = wall.thickness, bottom = -30;
  const inner = finish(wall.material, wall.tint, "#d9d2c5");
  const useOuter = !!(wall.outerMaterial || wall.outerTint);
  const outer = finish(wall.outerMaterial || wall.material, wall.outerTint || wall.tint, "#d9d2c5");
  const gates = (wall.gates || []).map((g) => clampGate({ ...g }, wall)).sort((a, b) => a.offset - b.offset);
  const segs = segments(pts);
  for (const seg of segs) {
    const len = seg.s1 - seg.s0;
    const dx = (seg.b[0] - seg.a[0]) / len, dz = (seg.b[1] - seg.a[1]) / len;
    const nx = -dz, nz = dx;
    const P = (s) => [seg.a[0] + dx * (s - seg.s0), seg.a[1] + dz * (s - seg.s0)];
    const ry = Math.atan2(-dz, dx);
    const cuts = gates.filter((g) => g.offset >= seg.s0 - 0.01 && g.offset + g.width <= seg.s1 + 0.01);
    const runs = [[seg.s0, seg.s1]];
    for (const g of cuts) {
      const last = runs.pop();
      runs.push([last[0], g.offset], [g.offset + g.width, last[1]]);
    }
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 1) continue;
      const [x, z] = P((r0 + r1) / 2);
      if (!useOuter) out.add(r1 - r0, H - bottom, t, x, (H + bottom) / 2, z, inner, { ry });
      else {
        out.add(r1 - r0, H - bottom, t / 2, x + (nx * t) / 4, (H + bottom) / 2, z + (nz * t) / 4, inner, { ry });
        out.add(r1 - r0, H - bottom, t / 2, x - (nx * t) / 4, (H + bottom) / 2, z - (nz * t) / 4, outer, { ry });
      }
    }
    const p = t + 10;
    for (const g of cuts) {
      for (const s of [g.offset - p / 2, g.offset + g.width + p / 2]) {
        const [x, z] = P(Math.max(seg.s0, Math.min(seg.s1, s)));
        out.add(p, H + 10 - bottom, p, x, (H + 10 + bottom) / 2, z, inner, { ry });
        out.add(p + 6, 4, p + 6, x, H + 12, z, inner, { ry });
      }
      const a = pointAlong(pts, g.offset);
      gateBoxes(out, g, a, g.width, H, "metal", wall, 0, inner);
    }
  }
  for (let i = 1; i < segs.length; i++) {
    const [x, z] = segs[i].a;
    out.add(t + 2, H - bottom, t + 2, x, (H + bottom) / 2, z, inner);
  }
}

// ------------------------------------------------------------------ roof

/** The roof of a building as boxes in building-local cm (ports build/roof.js with rotated slabs). */
function roofBoxes(out, building, tile) {
  const roof = building.roof, storey = topStorey(building);
  if (!roof || roof.type === "none" || !storey) return;
  const rect = roofRect(building, tile);
  if (!rect) return;
  const base = storeyTop(storey);
  const fin = finish(roof.material, roof.tint, "#8a6a4a");
  const RT = ROOF_THICKNESS, GABLE_END = 20, N = 8;
  if (roof.ceiling !== false) rectBoxes(out, tileRects(storey.floorGroups.flatMap((fg) => fg.tiles), tile), base - CEILING, base, { color: CEILING_TINT });
  if (roof.type === "flat") {
    const FLAT_SLAB = 15, PARAPET = 15, o = roof.overhang;
    const x0 = rect.minX - o, x1 = rect.maxX + o, z0 = rect.minZ - o, z1 = rect.maxZ + o;
    out.add(x1 - x0, FLAT_SLAB, z1 - z0, (x0 + x1) / 2, base + FLAT_SLAB / 2, (z0 + z1) / 2, fin);
    const h = roof.height;
    if (h > 0 && x1 - x0 > PARAPET * 2 && z1 - z0 > PARAPET * 2) {
      const y = base + FLAT_SLAB + h / 2;
      out.add(x1 - x0, h, PARAPET, (x0 + x1) / 2, y, z0 + PARAPET / 2, fin);
      out.add(x1 - x0, h, PARAPET, (x0 + x1) / 2, y, z1 - PARAPET / 2, fin);
      out.add(PARAPET, h, z1 - z0 - PARAPET * 2, x0 + PARAPET / 2, y, (z0 + z1) / 2, fin);
      out.add(PARAPET, h, z1 - z0 - PARAPET * 2, x1 - PARAPET / 2, y, (z0 + z1) / 2, fin);
    }
    return;
  }
  // u runs across the span, v along the ridge; P maps back to building x/z
  const alongX = roof.ridgeAxis !== "z";
  const P = (u, v) => (alongX ? [v, u] : [u, v]);
  const u0 = alongX ? rect.minZ : rect.minX, u1 = alongX ? rect.maxZ : rect.maxX;
  const v0 = alongX ? rect.minX : rect.minZ, v1 = alongX ? rect.maxX : rect.maxZ;
  const o = roof.overhang, pitch = roof.pitch * DEG, tan = Math.tan(pitch), cos = Math.cos(pitch), sin = Math.sin(pitch);
  const half = (u1 - u0) / 2, uc = (u0 + u1) / 2;
  const ue0 = u0 - o, ue1 = u1 + o, ve0 = v0 - o, ve1 = v1 + o;
  const yE = base - o * tan, yR = base + half * tan;
  /** Sloped slab: its underside's midpoint at (um, ym, vm), rising with +u (`rising` 1) or −u (−1) when `axis` is "u", else with ±v. */
  const slab = (axis, rising, um, ym, vm, len, wide) => {
    const alongU = axis === "u";
    const uu = um - (alongU ? rising * sin * (RT / 2) : 0), vv = vm - (alongU ? 0 : rising * sin * (RT / 2));
    const [x, z] = P(uu, vv);
    const risesAlongX = alongU ? alongX === false : alongX === true;
    const w = risesAlongX ? len : wide, d = risesAlongX ? wide : len;
    out.add(w, RT, d, x, ym + cos * (RT / 2), z, fin, risesAlongX ? { rz: rising * pitch } : { rx: -rising * pitch });
  };
  /** Upright box in the (u, v) frame. */
  const upright = (uA, uB, vA, vB, yA, yB, f = fin) => {
    const [x, z] = P((uA + uB) / 2, (vA + vB) / 2);
    const w = alongX ? Math.abs(vB - vA) : Math.abs(uB - uA), d = alongX ? Math.abs(uB - uA) : Math.abs(vB - vA);
    out.add(w, yB - yA, d, x, (yA + yB) / 2, z, f);
  };
  if (roof.type === "shed") {
    const dir = roof.highSide === "-" ? -1 : 1;
    const uL = dir > 0 ? u0 : u1, uH = dir > 0 ? u1 : u0;
    const y = (u) => base + dir * (u - uL) * tan;
    const uLe = uL - dir * o, uHe = uH + dir * o;
    slab("u", dir, (uLe + uHe) / 2, (y(uLe) + y(uHe)) / 2, (ve0 + ve1) / 2, Math.abs(uHe - uLe) / cos, ve1 - ve0);
    upright(uH - GABLE_END / 2, uH + GABLE_END / 2, v0, v1, base, y(uH));
    for (const v of [v0, v1])
      for (let k = 0; k < N; k++) {
        const ya = base + ((y(uH) - base) * k) / N, yb = base + ((y(uH) - base) * (k + 1)) / N;
        const uStart = uL + (dir * ((ya + yb) / 2 - base)) / tan;
        upright(uStart, uH, v - GABLE_END / 2, v + GABLE_END / 2, ya, yb);
      }
    return;
  }
  if (roof.type === "gable") {
    slab("u", 1, (ue0 + uc) / 2, (yE + yR) / 2, (ve0 + ve1) / 2, (uc - ue0) / cos, ve1 - ve0);
    slab("u", -1, (ue1 + uc) / 2, (yE + yR) / 2, (ve0 + ve1) / 2, (ue1 - uc) / cos, ve1 - ve0);
    for (const v of [v0, v1])
      for (let k = 0; k < N; k++) {
        const ya = base + ((yR - base) * k) / N, yb = base + ((yR - base) * (k + 1)) / N;
        const hw = half * (1 - ((ya + yb) / 2 - base) / (yR - base));
        upright(uc - hw, uc + hw, v - GABLE_END / 2, v + GABLE_END / 2, ya, yb);
      }
    return;
  }
  // hip: trapezoids on the long sides, triangles on the ends, in strips
  let vr0 = v0 + half, vr1 = v1 - half;
  if (vr1 < vr0) vr0 = vr1 = (v0 + v1) / 2;
  for (const [ue, rising] of [[ue0, 1], [ue1, -1]])
    for (let k = 0; k < N; k++) {
      const fm = (k + 0.5) / N;
      slab("u", rising, lerp(ue, uc, fm), lerp(yE, yR, fm), (lerp(ve0, vr0, fm) + lerp(ve1, vr1, fm)) / 2, Math.abs(uc - ue) / N / cos, lerp(ve1 - ve0, vr1 - vr0, fm));
    }
  for (const [ve, vr, rising] of [[ve0, vr0, 1], [ve1, vr1, -1]])
    for (let k = 0; k < N; k++) {
      const fm = (k + 0.5) / N;
      slab("v", rising, uc, lerp(yE, yR, fm), lerp(ve, vr, fm), Math.abs(vr - ve) / N / cos, (ue1 - ue0) * (1 - fm));
    }
}

// --------------------------------------------------------------- outdoor

/** An outdoor polygon on level ground as boxes (world cm). */
function outdoorBoxes(out, poly) {
  const pts = polygonOutline(poly);
  if (pts.length < 3) return;
  const levels = polygonLevels(poly, "outdoor", FLAT_GROUND);
  const fin = finish(poly.material, poly.tint, "#a07d55");
  const rects = polygonRects(pts);
  if (poly.type === "path") return rectBoxes(out, rects, -PATH_THICK, PATH_THICK, fin);
  if (poly.type === "pool") {
    const inner = insetPolygon(pts, POOL_WALL);
    const water = { material: "water", color: "#3a8aa6" };
    if (!inner) return rectBoxes(out, rects, levels.bottom - 10, levels.top, fin);
    rectBoxes(out, polygonRects(inner), levels.bottom - 10, levels.bottom, fin);
    rectBoxes(out, polygonRects(pts, 25, [inner]), levels.bottom - 10, levels.top, fin);
    rectBoxes(out, polygonRects(inner), levels.bottom, levels.top - POOL_WATER, water);
    return;
  }
  if (poly.type === "pond" || poly.type === "stream") {
    const mud = finish(poly.material, poly.tint || MUD_TINT, MUD_TINT);
    const bank = insetPolygon(pts, 10);
    rectBoxes(out, rects, levels.bottom - 5, levels.bottom, mud);
    if (bank) rectBoxes(out, polygonRects(pts, 25, [bank]), levels.bottom, 0, mud);
    const top = Math.min(levels.top, -1);
    rectBoxes(out, polygonRects(bank || pts), levels.bottom, top, { material: "water", color: poly.type === "stream" ? "#3f9bb8" : "#3a8aa6" });
    return;
  }
  // deck
  if (!poly.open) return rectBoxes(out, rects, levels.bottom, levels.top, fin);
  const DECK_SLAB = 8, DECK_RIM = 20, RIM_T = 4, POST_GAP = 200, POST_BURY = 20;
  const top = levels.top, under = top - DECK_SLAB;
  rectBoxes(out, rects, under, top, fin);
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1) continue;
    out.add(len, DECK_RIM, RIM_T, (ax + bx) / 2, under - DECK_RIM / 2, (az + bz) / 2, fin, { ry: Math.atan2(-(bz - az), bx - ax) });
  }
  const ps = poly.postSize || 15;
  const inner = insetPolygon(pts, ps / 2 + 1) || pts;
  for (let i = 0; i < inner.length; i++) {
    const [ax, az] = inner[i], [bx, bz] = inner[(i + 1) % inner.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / POST_GAP));
    for (let k = 0; k < n; k++) out.add(ps, under + POST_BURY, ps, ax + ((bx - ax) * k) / n, (under - POST_BURY) / 2, az + ((bz - az) * k) / n, fin);
  }
}

// --------------------------------------------------------------- objects

/** A planner prop document as a Story Studio prop document. */
export function storyProp(doc, id, name = doc.name) {
  const boxes = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of doc.source.boxes) {
    if (b.hole) continue;
    const fin = b.material ? finish(b.material, b.color) : { color: b.color || "#b9b1a0" };
    const o = { w: b.w, h: b.h, d: b.d, x: b.x, y: b.y, z: b.z, color: fin.color };
    if (fin.material) o.material = fin.material;
    for (const k of ["rx", "ry", "rz"]) if (b[k]) o[k] = b[k];
    if (b.opacity != null && b.opacity < 1) o.opacity = b.opacity;
    if (b.shape && b.shape !== "box") o.shape = b.shape;
    if (b.axis && ["cylinder", "cone", "roundcone", "torus"].includes(b.shape)) o.axis = b.axis;
    for (const k of ["n", "tube", "roundness", "baseRound", "grain"]) if (b[k] != null) o[k] = b[k];
    for (const k of ["flat", "detail"]) if (b[k]) o[k] = true;
    boxes.push(o);
    const r = Math.hypot(b.w, b.d) / 2;
    minX = Math.min(minX, b.x - r);
    maxX = Math.max(maxX, b.x + r);
    minZ = Math.min(minZ, b.z - r);
    maxZ = Math.max(maxZ, b.z + r);
  }
  const out = { kind: "prop", version: 1, id, name: names(name), footprint: [Math.max(0.05, Math.round((maxX - minX) * 100) / 100), Math.max(0.05, Math.round((maxZ - minZ) * 100) / 100)], source: { type: "boxes", boxes } };
  if (doc.light) out.light = { color: doc.light.color, intensity: clamp(doc.light.intensity, 0, 40), distance: clamp(doc.light.distance, 0.2, 200), at: doc.light.at };
  return out;
}
function names(name) {
  if (typeof name === "string") return { en: name, pt: name, ja: name };
  const en = name?.en || name?.pt || name?.ja || "";
  return { en, pt: name?.pt || en, ja: name?.ja || en };
}
const idOf = (s) => String(s || "").replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^[^a-zA-Z0-9]+/, "").slice(0, 64) || "x";
function slugOf(project) {
  const s = String(project.name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return s || idOf(project.id).toLowerCase().slice(0, 24);
}

/** Set placement of a light point: a small bulb prop that gives off its light. */
function lightDoc(l) {
  const id = `hp-light-${l.color.slice(1)}-${Math.round(l.intensity * 10)}-${Math.round(l.range)}`;
  return {
    id,
    doc: {
      kind: "prop", version: 1, id, name: { en: "Light point", pt: "Ponto de luz", ja: "光源" }, footprint: [0.06, 0.06],
      source: { type: "boxes", boxes: [{ w: 0.06, h: 0.06, d: 0.06, x: 0, y: 0, z: 0, color: l.color, opacity: 0.5, shape: "sphere" }] },
      light: { color: l.color, intensity: clamp(l.intensity * 1.7, 0, 40), distance: clamp(l.range / 100, 0.2, 200), at: [0, 0, 0] },
    },
  };
}

// ----------------------------------------------------------------- bundle

/**
 * The Story Studio bundle of a project. `opts`: propDoc(id) (a loaded
 * catalog or custom document, or null), shipped(id) (true when Story Studio
 * ships that prop itself), wells(building, storey, floorGroup) (tile keys
 * left open by stairs), roomsOf(storey) ([{face, room}]), roomLevels(
 * building, storey, face) ({floorY, ceilingY}).
 */
export function storyStudioBundle(project, opts = {}) {
  const slug = slugOf(project);
  const setId = `hp-${slug}`;
  const tile = project.grid?.tile || 50;
  const docs = new Map(); // id -> prop document
  const placements = [];
  const used = new Set();
  const placementId = (want) => {
    let id = idOf(want), n = 2;
    while (used.has(id)) id = `${idOf(want).slice(0, 60)}.${n++}`;
    used.add(id);
    return id;
  };
  const title = (en, pt, ja) => ({ en: `${project.name || "House"} – ${en}`, pt: `${project.name || "Casa"} – ${pt}`, ja: `${project.name || "家"} – ${ja}` });
  /** A box prop (split when over the limit) placed at (x, z) cm with `yaw` degrees. */
  const place = (id, name, boxes, x = 0, z = 0, yaw = 0) => {
    if (!boxes.size) return;
    const chunks = [];
    for (let i = 0; i < boxes.list.length; i += MAX_BOXES) chunks.push(boxes.list.slice(i, i + MAX_BOXES));
    chunks.forEach((list, i) => {
      const pid = chunks.length > 1 ? `${id}-${i + 1}` : id;
      docs.set(pid, { kind: "prop", version: 1, id: pid, name: chunks.length > 1 ? names({ en: `${name.en} ${i + 1}`, pt: `${name.pt} ${i + 1}`, ja: `${name.ja} ${i + 1}` }) : names(name), footprint: footprintOf(list), source: { type: "boxes", boxes: list } });
      placements.push({ id: placementId(pid.slice(setId.length + 1)), prop: pid, at: [mm(x), 0, mm(z)], yaw: rot(yaw) });
    });
  };
  // world cm → set placement of an object or light, from a building frame or the site
  const toWorld = (building, at) => {
    if (!building) return at;
    const th = -building.rotation * DEG, c = Math.cos(th), s = Math.sin(th);
    return [at[0] * c + at[2] * s + building.at[0], at[1], -at[0] * s + at[2] * c + building.at[1]];
  };
  const placeObject = (o, building, baseY, prefix = "") => {
    const doc = o.inline || opts.propDoc?.(o.prop) || null;
    let prop = o.prop;
    if (o.inline) {
      prop = `hp-${slug}-in-${idOf(o.inline.id || o.id)}`.slice(0, 64);
      if (!docs.has(prop)) docs.set(prop, storyProp(o.inline, prop));
    } else if (doc && !opts.shipped?.(o.prop)) {
      if (!docs.has(prop)) docs.set(prop, storyProp(doc, prop));
    }
    if (!prop) return;
    const w = toWorld(building, [o.at[0], o.at[1] + baseY, o.at[2]]);
    const uniform = o.scale.every((v) => Math.abs(v - o.scale[0]) < 1e-6);
    const pl = {
      id: placementId(prefix + o.id),
      prop,
      at: [mm(w[0]), mm(w[1]), mm(w[2])],
      yaw: rot(o.rotation[1] - (building ? building.rotation : 0)),
      pitch: rot(o.rotation[2]),
      roll: rot(o.rotation[0]),
      scale: uniform ? Math.round(o.scale[0] * 1000) / 1000 : o.scale.map((v) => Math.round(v * 1000) / 1000),
    };
    if (o.tint) pl.tint = o.tint;
    if (o.locked) pl.locked = true;
    placements.push(pl);
  };
  const placeLight = (l, building, baseY) => {
    if (l.on === false || !(l.intensity > 0)) return;
    const { id, doc } = lightDoc(l);
    if (!docs.has(id)) docs.set(id, doc);
    const w = toWorld(building, [l.at[0], l.at[1] + baseY, l.at[2]]);
    placements.push({ id: placementId(l.id), prop: id, at: [mm(w[0]), mm(w[1]), mm(w[2])], yaw: 0 });
  };

  project.buildings.forEach((b, bi) => {
    const bName = b.name || `${bi + 1}`;
    b.storeys.forEach((s, si) => {
      const out = new Boxes();
      for (const fg of s.floorGroups) {
        const rects = tileRects(fg.tiles, tile, opts.wells?.(b, s, fg) || null);
        const top = floorTop(s, fg), thick = floorThickness(s, fg);
        // the Story Studio ground is a plane at 0: keep a slab's top just above it
        rectBoxes(out, rects, top - thick, Math.abs(top) < 1 ? 1 : top, finish(fg.material, fg.tint, "#c8b89a"));
        if (s === b.storeys[0] && s.foundation?.enabled && top - thick > -20) rectBoxes(out, rects, -20, top - thick, finish(s.foundation.material, s.foundation.tint, "#9d9a93"));
      }
      for (const w of s.walls) wallBoxes(out, w, s, s.walls, tile);
      for (const st of s.stairs) stairBoxes(out, st, s);
      for (const rl of s.railings) railingBoxes(out, rl, "railing", s.elevation + railingOffset(rl, s, tile));
      for (const { face, room } of opts.roomsOf?.(s) || []) {
        const levels = opts.roomLevels?.(b, s, face);
        if (!levels) continue;
        const holes = (face.holes || []).map((h) => h.polygon);
        const fy = Math.abs(levels.floorY) < 1 ? 1 : levels.floorY; // over the lifted slab (see above)
        if (room.floorMaterial || room.floorTint) rectBoxes(out, polygonRects(face.net, 25, holes), fy + 0.1, fy + 0.7, finish(room.floorMaterial, room.floorTint));
        if (room.ceilingTint) rectBoxes(out, polygonRects(face.net, 25, holes), levels.ceilingY - 0.7, levels.ceilingY - 0.1, { color: room.ceilingTint });
      }
      const sName = s.name || `${si + 1}`;
      place(`${setId}-b${bi + 1}-s${si + 1}`, title(`building ${bName}, storey ${sName}`, `prédio ${bName}, andar ${sName}`, `建物 ${bName}、${sName} 階`), out, b.at[0], b.at[1], -b.rotation);
      // objects carry their storey in the placement id, so the set list groups them with it
      for (const o of s.objects) placeObject(o, b, s.elevation, `b${bi + 1}-s${si + 1}.`);
      for (const l of s.lights || []) placeLight(l, b, s.elevation);
    });
    const roof = new Boxes();
    roofBoxes(roof, b, tile);
    place(`${setId}-b${bi + 1}-roof`, title(`building ${bName}, roof`, `prédio ${bName}, telhado`, `建物 ${bName}、屋根`), roof, b.at[0], b.at[1], -b.rotation);
  });
  project.outdoor.forEach((poly, i) => {
    const out = new Boxes();
    outdoorBoxes(out, poly);
    const kind = { deck: ["deck", "deque", "デッキ"], pool: ["pool", "piscina", "プール"], path: ["path", "caminho", "小道"], pond: ["pond", "lago", "池"], stream: ["stream", "riacho", "小川"] }[poly.type] || ["outdoor", "externo", "屋外"];
    const label = poly.name ? [poly.name, poly.name, poly.name] : kind.map((k) => `${k} ${i + 1}`);
    place(`${setId}-o${i + 1}`, title(...label), out);
  });
  const garden = new Boxes();
  for (const patch of project.gardenPatches) {
    const pts = dedupe(patch.points);
    if (pts.length >= 3) rectBoxes(garden, polygonRects(pts), 0, PATCH_LIFT, finish(patch.material, patch.tint, "#9b968c"));
  }
  place(`${setId}-garden`, title("garden", "jardim", "庭"), garden);
  const fences = new Boxes();
  for (const f of project.fences) railingBoxes(fences, f, "fence", 0);
  for (const w of project.siteWalls) siteWallBoxes(fences, w);
  place(`${setId}-fences`, title("fences and walls", "cercas e muros", "柵と塀"), fences);
  for (const o of project.objects) placeObject(o, null, 0);
  for (const l of project.lights || []) placeLight(l, null, 0);

  const { azimuth, elevation } = Sun.angles(project.sun);
  const az = azimuth * DEG, el = clamp(elevation, 2, 89) * DEG;
  const sun = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)].map((v) => Math.round(v * 1000) / 1000);
  const ground = finish(project.terrain.material, project.terrain.tint, "#6d8f4a");
  const set = {
    kind: "set", version: 1, id: setId, name: names(project.name || "House"),
    ground: { size: [clamp(mm(project.terrain.width), 1, 2000), clamp(mm(project.terrain.depth), 1, 2000)], color: ground.color, ...(ground.material ? { material: ground.material } : {}) },
    sky: project.sun.night ? "night" : elevation < 8 ? "dusk" : "day",
    light: { sun, intensity: clamp(project.sun.night ? 0.4 : project.sun.intensity, 0, 4) },
    props: placements,
  };
  const cam = project.view?.camera;
  if (cam) {
    const d = [cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]];
    const len = Math.hypot(...d) || 1;
    set.cameras = [{ id: "planner", name: { en: "Planner view", pt: "Vista do planejador", ja: "プランナーの視点" }, at: cam.pos.map(mm), yaw: rot(Math.atan2(-d[0], -d[2]) / DEG), pitch: rot(clamp(Math.asin(d[1] / len) / DEG, -89, 89)), fov: 45 }];
  }
  return { kind: "bundle", version: 1, documents: [...docs.values(), set] };
}
function footprintOf(boxes) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    const r = Math.hypot(b.w, b.d) / 2;
    minX = Math.min(minX, b.x - r);
    maxX = Math.max(maxX, b.x + r);
    minZ = Math.min(minZ, b.z - r);
    maxZ = Math.max(maxZ, b.z + r);
  }
  return [Math.max(0.05, Math.round((maxX - minX) * 100) / 100), Math.max(0.05, Math.round((maxZ - minZ) * 100) / 100)];
}
/** File name of the bundle. */
export function storyFilename(project) {
  return `story-studio-${slugOf(project) || "set"}.json`;
}
