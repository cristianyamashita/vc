// Roofs and the ceiling of the top storey. The roof sits on the bounding
// rectangle of the top storey (its floor tiles and wall ends; the whole
// building when that storey is empty) at the storey's top, and the eaves
// extend by the overhang. Flat = slab + parapet; gable = two slopes with
// closed ends; hip = four slopes meeting at a ridge. All in building-local
// metres; the document is centimetres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial } from "../materials.js";
import { M } from "../scene.js";
import { topStorey, storeyTop } from "../schema.js";
import { tileKey, buildingFootprint } from "./slabs.js";

const DEG = Math.PI / 180;
export const ROOF_THICKNESS = 12; // cm, sloped roof slab
const FLAT_SLAB = 15;
const PARAPET = 15;
const GABLE_END = 20;
const CEILING = 10;
const CEILING_TINT = "#f1ede6";
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

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
class Shell {
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

/**
 * Sloped roof over a rectangle. Work in a frame where u runs across the
 * span and v along the ridge; `P` maps it back to building x/z.
 */
function slopedGeometry(roof, rect, base) {
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
  if (roof.type === "gable") {
    for (const [ue, dir] of [[ue0, -1], [ue1, 1]]) {
      // top and underside of one slope
      s.quad(P(ue, yE + T, ve0), P(uc, yR + T, ve0), P(uc, yR + T, ve1), P(ue, yE + T, ve1), UP);
      s.quad(P(ue, yE, ve0), P(uc, yR, ve0), P(uc, yR, ve1), P(ue, yE, ve1), DOWN);
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
  const geo = roof.type === "flat" ? flatGeometry(roof, rect, base) : slopedGeometry(roof, rect, base);
  const mesh = new THREE.Mesh(geo, surfaceMaterial({ material: roof.material, tint: roof.tint }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: "roof", id: building.id };
  group.add(mesh);
  const ceiling = ceilingGeometry(storey, tile, base);
  if (ceiling) {
    const c = new THREE.Mesh(ceiling, surfaceMaterial({ tint: CEILING_TINT }));
    c.castShadow = true;
    c.receiveShadow = true;
    c.userData = { kind: "roof", id: building.id, ceiling: true };
    group.add(c);
  }
  return group;
}
