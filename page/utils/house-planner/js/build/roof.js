// Roofs and the ceiling of the top storey. The roof sits on the bounding
// rectangle of the top storey (its floor tiles and wall ends; the whole
// building when that storey is empty) at the storey's top, and the eaves
// extend by the overhang. Flat = slab + parapet; gable = two slopes with
// closed ends; hip = four slopes meeting at a ridge. All in building-local
// metres; the document is centimetres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial, glassMaterial } from "../materials.js";
import { M } from "../scene.js";
import { topStorey, storeyTop } from "../schema.js";
import { tileKey, buildingFootprint } from "./slabs.js";

const DEG = Math.PI / 180;
export const ROOF_THICKNESS = 12; // cm, sloped roof slab
const FLAT_SLAB = 15;
const PARAPET = 15;
const GABLE_END = 20;
export const CEILING = 10;
const CEILING_TINT = "#f1ede6";
export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);

/** Rectangle (cm, building-local) under the roof, or null without tiles or walls. */
export function roofRect(building, tile) {
  const s = topStorey(building);
  if (!s) return null;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const take = (x, z) => {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  };
  for (const fg of s.floorGroups)
    for (const [x, z] of fg.tiles) {
      take(x * tile, z * tile);
      take((x + 1) * tile, (z + 1) * tile);
    }
  for (const w of s.walls) for (const p of [w.a, w.b]) take(p[0], p[1]);
  if (!Number.isFinite(minX)) return buildingFootprint(building, tile);
  if (maxX - minX < 1 || maxZ - minZ < 1) return null;
  return { minX, minZ, maxX, maxZ };
}

/** Triangles collected in cm; the winding follows the wanted normal side. */
export class Shell {
  constructor() {
    this.pos = [];
  }
  tri(a, b, c, want) {
    const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    if (ab.cross(ac).dot(want) < 0) [b, c] = [c, b];
    this.pos.push(...a, ...b, ...c);
  }
  quad(a, b, c, d, want) {
    this.tri(a, b, c, want);
    this.tri(a, c, d, want);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos.map((v) => v * M), 3));
    g.computeVertexNormals();
    return g;
  }
}

const FRAME_W = 6, FRAME_H = 4; // cm, skylight frame strip and its height above the roof
/**
 * Roof windows of one slope as rectangles in the (u, v) frame, clamped to the
 * slope. `uWall` is the eave wall line, `dir` +1 when the slope rises with
 * +u from there, `uTop` the ridge (or high eave), `ve0..ve1` the eave span.
 */
export function slopeWindows(roof, slopeKey, uWall, dir, uTop, v0, ve0, ve1) {
  const out = [];
  for (const w of roof.windows || []) {
    if (roof.type === "gable" && w.slope !== slopeKey) continue;
    let ua = uWall + dir * w.up, ub = uWall + dir * (w.up + w.length);
    if (ua > ub) [ua, ub] = [ub, ua];
    const lo = Math.min(uWall - dir * roof.overhang, uTop) + 4, hi = Math.max(uWall - dir * roof.overhang, uTop) - 4;
    ua = Math.max(lo, ua); ub = Math.min(hi, ub);
    const va = Math.max(ve0 + 4, v0 + w.at - w.width / 2), vb = Math.min(ve1 - 4, v0 + w.at + w.width / 2);
    if (ub - ua < 10 || vb - va < 10) continue;
    out.push({ id: w.id, ua, ub, va, vb });
  }
  return out;
}
/**
 * One slope: top and underside as a grid of quads around the roof windows,
 * with the reveals of each hole, its frame and its glass pane. `y(u)` is the
 * underside height, T the vertical thickness.
 */
function slopeSurfaces(s, extras, P, want, y, T, ua0, ua1, ve0, ve1, windows, sign) {
  const us = [ua0, ua1, ...windows.flatMap((w) => [w.ua, w.ub])].filter((u) => u >= Math.min(ua0, ua1) && u <= Math.max(ua0, ua1)).sort((a, b) => a - b);
  const vs = [ve0, ve1, ...windows.flatMap((w) => [w.va, w.vb])].sort((a, b) => a - b);
  const inHole = (u, v) => windows.some((w) => u > w.ua && u < w.ub && v > w.va && v < w.vb);
  for (let i = 0; i + 1 < us.length; i++)
    for (let j = 0; j + 1 < vs.length; j++) {
      const uA = us[i], uB = us[i + 1], vA = vs[j], vB = vs[j + 1];
      if (uB - uA < 0.5 || vB - vA < 0.5 || inHole((uA + uB) / 2, (vA + vB) / 2)) continue;
      s.quad(P(uA, y(uA) + T, vA), P(uB, y(uB) + T, vA), P(uB, y(uB) + T, vB), P(uA, y(uA) + T, vB), UP);
      s.quad(P(uA, y(uA), vA), P(uB, y(uB), vA), P(uB, y(uB), vB), P(uA, y(uA), vB), DOWN);
    }
  for (const w of windows) {
    // reveals of the hole, facing into it
    s.quad(P(w.ua, y(w.ua), w.va), P(w.ua, y(w.ua) + T, w.va), P(w.ua, y(w.ua) + T, w.vb), P(w.ua, y(w.ua), w.vb), want(1, 0, 0));
    s.quad(P(w.ub, y(w.ub), w.va), P(w.ub, y(w.ub) + T, w.va), P(w.ub, y(w.ub) + T, w.vb), P(w.ub, y(w.ub), w.vb), want(-1, 0, 0));
    for (const [v, dv] of [[w.va, 1], [w.vb, -1]]) s.quad(P(w.ua, y(w.ua), v), P(w.ub, y(w.ub), v), P(w.ub, y(w.ub) + T, v), P(w.ua, y(w.ua) + T, v), want(0, 0, dv));
    // glass pane in the middle of the slab, frame strips standing on the roof around the hole
    const g = (u) => y(u) + T / 2;
    extras.glass.quad(P(w.ua, g(w.ua), w.va), P(w.ub, g(w.ub), w.va), P(w.ub, g(w.ub), w.vb), P(w.ua, g(w.ua), w.vb), UP);
    extras.glass.quad(P(w.ua, g(w.ua), w.va), P(w.ub, g(w.ub), w.va), P(w.ub, g(w.ub), w.vb), P(w.ua, g(w.ua), w.vb), DOWN);
    const f = (u) => y(u) + T, strips = [[w.ua - FRAME_W, w.ua, w.va - FRAME_W, w.vb + FRAME_W], [w.ub, w.ub + FRAME_W, w.va - FRAME_W, w.vb + FRAME_W], [w.ua, w.ub, w.va - FRAME_W, w.va], [w.ua, w.ub, w.vb, w.vb + FRAME_W]];
    for (const [a, b, c, d] of strips) {
      const F = extras.frame;
      F.quad(P(a, f(a) + FRAME_H, c), P(b, f(b) + FRAME_H, c), P(b, f(b) + FRAME_H, d), P(a, f(a) + FRAME_H, d), UP);
      F.quad(P(a, f(a), c), P(a, f(a) + FRAME_H, c), P(a, f(a) + FRAME_H, d), P(a, f(a), d), want(-sign, 0, 0));
      F.quad(P(b, f(b), c), P(b, f(b) + FRAME_H, c), P(b, f(b) + FRAME_H, d), P(b, f(b), d), want(sign, 0, 0));
      F.quad(P(a, f(a), c), P(b, f(b), c), P(b, f(b) + FRAME_H, c), P(a, f(a) + FRAME_H, c), want(0, 0, -1));
      F.quad(P(a, f(a), d), P(b, f(b), d), P(b, f(b) + FRAME_H, d), P(a, f(a) + FRAME_H, d), want(0, 0, 1));
    }
  }
}
/**
 * Sloped roof over a rectangle. Work in a frame where u runs across the
 * span and v along the ridge; `P` maps it back to building x/z. `extras`
 * collects the roof windows' glass and frames (gable and shed roofs).
 */
function slopedGeometry(roof, rect, base, extras = { glass: new Shell(), frame: new Shell() }) {
  const alongX = roof.ridgeAxis !== "z";
  const P = (u, y, v) => (alongX ? [v, y, u] : [u, y, v]);
  const want = (du, dy, dv) => new THREE.Vector3(...(alongX ? [dv, dy, du] : [du, dy, dv]));
  const u0 = alongX ? rect.minZ : rect.minX, u1 = alongX ? rect.maxZ : rect.maxX;
  const v0 = alongX ? rect.minX : rect.minZ, v1 = alongX ? rect.maxX : rect.maxZ;
  const o = roof.overhang, tan = Math.tan(roof.pitch * DEG);
  const T = ROOF_THICKNESS / Math.cos(roof.pitch * DEG); // vertical thickness
  const half = (u1 - u0) / 2, uc = (u0 + u1) / 2;
  const ue0 = u0 - o, ue1 = u1 + o, ve0 = v0 - o, ve1 = v1 + o;
  const yE = base - o * tan, yR = base + half * tan;
  const s = new Shell();
  if (roof.type === "shed") {
    // one slope: low eave at uL, high wall at uH, three closing walls
    const dir = roof.highSide === "-" ? -1 : 1;
    const uL = dir > 0 ? u0 : u1, uH = dir > 0 ? u1 : u0;
    const y = (u) => base + dir * (u - uL) * tan;
    const uLe = uL - dir * o, uHe = uH + dir * o;
    slopeSurfaces(s, extras, P, want, y, T, uLe, uHe, ve0, ve1, slopeWindows(roof, "+", uL, dir, uHe, v0, ve0, ve1), 1);
    for (const [ue, d] of [[uLe, -dir], [uHe, dir]])
      s.quad(P(ue, y(ue), ve0), P(ue, y(ue) + T, ve0), P(ue, y(ue) + T, ve1), P(ue, y(ue), ve1), want(d, 0, 0));
    for (const [ve, dv] of [[ve0, -1], [ve1, 1]])
      s.quad(P(uLe, y(uLe), ve), P(uHe, y(uHe), ve), P(uHe, y(uHe) + T, ve), P(uLe, y(uLe) + T, ve), want(0, 0, dv));
    for (const side of [-1, 1]) {
      const uw = uH + (side * GABLE_END) / 2;
      s.quad(P(uw, base, v0), P(uw, base, v1), P(uw, y(uH), v1), P(uw, y(uH), v0), want(side, 0, 0));
    }
    for (const [v, dv] of [[v0, -1], [v1, 1]])
      for (const side of [-1, 1]) {
        const vv = v + (side * GABLE_END) / 2;
        s.tri(P(uL, base, vv), P(uH, base, vv), P(uH, y(uH), vv), want(0, 0, side));
      }
    return s.geometry();
  }
  if (roof.type === "gable") {
    for (const [ue, dir] of [[ue0, -1], [ue1, 1]]) {
      // top and underside of one slope, around its roof windows
      const y = (u) => yE + Math.abs(u - ue) * tan;
      slopeSurfaces(s, extras, P, want, y, T, ue, uc, ve0, ve1, slopeWindows(roof, dir > 0 ? "+" : "-", dir > 0 ? u1 : u0, -dir, uc, v0, ve0, ve1), 1);
      // eave fascia
      s.quad(P(ue, yE, ve0), P(ue, yE + T, ve0), P(ue, yE + T, ve1), P(ue, yE, ve1), want(dir, 0, 0));
      // slab ends
      for (const [ve, dv] of [[ve0, -1], [ve1, 1]])
        s.quad(P(ue, yE, ve), P(uc, yR, ve), P(uc, yR + T, ve), P(ue, yE + T, ve), want(0, 0, dv));
    }
    // gable end walls (triangles under the slopes, as thick as a wall)
    for (const [v, dv] of [[v0, -1], [v1, 1]])
      for (const side of [-1, 1])
        s.tri(P(u0, base, v + (side * GABLE_END) / 2), P(uc, yR, v + (side * GABLE_END) / 2), P(u1, base, v + (side * GABLE_END) / 2), want(0, 0, side));
  } else {
    // hip: the ridge is shortened by the half span at each end
    let vr0 = v0 + half, vr1 = v1 - half;
    if (vr1 < vr0) vr0 = vr1 = (v0 + v1) / 2;
    for (const dy of [T, 0]) {
      const w = dy ? UP : DOWN;
      s.quad(P(ue0, yE + dy, ve0), P(ue0, yE + dy, ve1), P(uc, yR + dy, vr1), P(uc, yR + dy, vr0), w);
      s.quad(P(ue1, yE + dy, ve0), P(ue1, yE + dy, ve1), P(uc, yR + dy, vr1), P(uc, yR + dy, vr0), w);
      s.tri(P(ue0, yE + dy, ve0), P(ue1, yE + dy, ve0), P(uc, yR + dy, vr0), w);
      s.tri(P(ue0, yE + dy, ve1), P(ue1, yE + dy, ve1), P(uc, yR + dy, vr1), w);
    }
    s.quad(P(ue0, yE, ve0), P(ue0, yE + T, ve0), P(ue0, yE + T, ve1), P(ue0, yE, ve1), want(-1, 0, 0));
    s.quad(P(ue1, yE, ve0), P(ue1, yE + T, ve0), P(ue1, yE + T, ve1), P(ue1, yE, ve1), want(1, 0, 0));
    s.quad(P(ue0, yE, ve0), P(ue0, yE + T, ve0), P(ue1, yE + T, ve0), P(ue1, yE, ve0), want(0, 0, -1));
    s.quad(P(ue0, yE, ve1), P(ue0, yE + T, ve1), P(ue1, yE + T, ve1), P(ue1, yE, ve1), want(0, 0, 1));
  }
  return s.geometry();
}
function box(w, h, d, x, y, z, list) {
  const g = new THREE.BoxGeometry(w * M, h * M, d * M);
  g.translate(x * M, y * M, z * M);
  list.push(g);
}
/** Flat roof: slab over the eave rectangle and a parapet along its edge. */
function flatGeometry(roof, rect, base) {
  const o = roof.overhang;
  const x0 = rect.minX - o, x1 = rect.maxX + o, z0 = rect.minZ - o, z1 = rect.maxZ + o;
  const parts = [];
  box(x1 - x0, FLAT_SLAB, z1 - z0, (x0 + x1) / 2, base + FLAT_SLAB / 2, (z0 + z1) / 2, parts);
  const h = roof.height;
  if (h > 0 && x1 - x0 > PARAPET * 2 && z1 - z0 > PARAPET * 2) {
    const y = base + FLAT_SLAB + h / 2;
    box(x1 - x0, h, PARAPET, (x0 + x1) / 2, y, z0 + PARAPET / 2, parts);
    box(x1 - x0, h, PARAPET, (x0 + x1) / 2, y, z1 - PARAPET / 2, parts);
    box(PARAPET, h, z1 - z0 - PARAPET * 2, x0 + PARAPET / 2, y, (z0 + z1) / 2, parts);
    box(PARAPET, h, z1 - z0 - PARAPET * 2, x1 - PARAPET / 2, y, (z0 + z1) / 2, parts);
  }
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return geo;
}
/** Thin ceiling under the top storey's tiles, or null. */
function ceilingGeometry(storey, tile, base) {
  const seen = new Set(), parts = [];
  for (const fg of storey.floorGroups)
    for (const [x, z] of fg.tiles) {
      const k = tileKey(x, z);
      if (seen.has(k)) continue;
      seen.add(k);
      box(tile, CEILING, tile, (x + 0.5) * tile, base - CEILING / 2, (z + 0.5) * tile, parts);
    }
  if (!parts.length) return null;
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return geo;
}

/**
 * Roof group of a building (userData kind roofGroup; meshes kind roof,
 * id = building id), or null for type "none" or an empty building.
 */
export function buildRoof(building, tile = 50) {
  const roof = building.roof;
  const storey = topStorey(building);
  if (!roof || roof.type === "none" || !storey) return null;
  const rect = roofRect(building, tile);
  if (!rect) return null;
  const base = storeyTop(storey);
  const group = new THREE.Group();
  group.userData = { kind: "roofGroup", id: building.id };
  const extras = { glass: new Shell(), frame: new Shell() };
  const geo = roof.type === "flat" ? flatGeometry(roof, rect, base) : slopedGeometry(roof, rect, base, extras);
  const mesh = new THREE.Mesh(geo, surfaceMaterial({ material: roof.material, tint: roof.tint }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: "roof", id: building.id };
  group.add(mesh);
  if (extras.frame.pos.length) {
    const f = new THREE.Mesh(extras.frame.geometry(), surfaceMaterial({ tint: "#3a3d42", roughness: 0.5 }));
    f.castShadow = true;
    f.receiveShadow = true;
    f.userData = { kind: "roof", id: building.id };
    group.add(f);
    const g = new THREE.Mesh(extras.glass.geometry(), glassMaterial());
    g.castShadow = false; // the sun comes in through the glass
    g.receiveShadow = true;
    g.renderOrder = 10;
    g.userData = { kind: "roof", id: building.id, glass: true };
    group.add(g);
  }
  const ceiling = roof.ceiling === false ? null : ceilingGeometry(storey, tile, base);
  if (ceiling) {
    const c = new THREE.Mesh(ceiling, surfaceMaterial({ tint: CEILING_TINT }));
    c.castShadow = true;
    c.receiveShadow = true;
    c.userData = { kind: "roof", id: building.id, ceiling: true };
    group.add(c);
  }
  return group;
}
