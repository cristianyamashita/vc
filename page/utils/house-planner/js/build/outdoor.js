// Outdoor polygons on the terrain (world cm): decks (level slabs standing on
// the lowest ground under them), pools (a basin with a hole, water plane,
// and the terrain shader cut inside), paths (3 cm, conforming to the
// ground) and garden patches (1 cm skin conforming to the ground).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial, waterMaterial } from "../materials.js";
import { M } from "../scene.js";
import { polygonArea, pointInPolygon, polygonBounds, polygonCentroid, insetPolygon, clipPolygon, dedupe } from "../geom.js";

export const POOL_WALL = 20; // cm
export const POOL_WATER = 12; // cm below the rim
export const PATH_THICK = 3;
export const PATCH_LIFT = 1;
export const DEFAULT_MATERIAL = { deck: "planks", pool: "tiles", path: "paving", garden: "gravel" };

/** THREE.Shape in the XZ plane (x → x, z → −y so rotateX(−90°) maps back). */
function shapeOf(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x * M, -z * M) : s.moveTo(x * M, -z * M)));
  s.closePath();
  return s;
}
function extrude(shape, bottom, top) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, top - bottom) * M, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom * M, 0);
  return g;
}
function flat(shape, y) {
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y * M, 0);
  return g;
}
/** Lowest and highest shown terrain height (cm) under a polygon. */
export function terrainRange(pts, terrain) {
  let min = Infinity, max = -Infinity;
  const take = (h) => {
    min = Math.min(min, h);
    max = Math.max(max, h);
  };
  for (const [x, z] of pts) take(terrain.heightAt(x, z));
  const b = polygonBounds(pts);
  const step = Math.max(25, Math.min(100, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 16));
  for (let z = b.minZ; z <= b.maxZ; z += step)
    for (let x = b.minX; x <= b.maxX; x += step) if (pointInPolygon(x, z, pts)) take(terrain.heightAt(x, z));
  return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 };
}
/**
 * Surface following the terrain triangles inside the polygon, lifted by
 * `lift` cm. Each terrain triangle clips the polygon, so the skin matches the
 * ground exactly. Returns null when nothing is inside the terrain.
 */
export function conformGeometry(pts, terrain, lift) {
  const t = terrain.doc, n = t.resolution;
  const cw = t.width / n, cd = t.depth / n;
  const b = polygonBounds(pts);
  const ix0 = Math.max(0, Math.floor((b.minX / t.width + 0.5) * n)), ix1 = Math.min(n - 1, Math.floor((b.maxX / t.width + 0.5) * n));
  const iz0 = Math.max(0, Math.floor((b.minZ / t.depth + 0.5) * n)), iz1 = Math.min(n - 1, Math.floor((b.maxZ / t.depth + 0.5) * n));
  const positions = [], indices = [];
  const vx = (i) => (i / n - 0.5) * t.width, vz = (j) => (j / n - 0.5) * t.depth;
  for (let iz = iz0; iz <= iz1; iz++)
    for (let ix = ix0; ix <= ix1; ix++) {
      const x0 = vx(ix), x1 = vx(ix + 1), z0 = vz(iz), z1 = vz(iz + 1);
      const tris = [[[x0, z0], [x0, z1], [x1, z0]], [[x1, z0], [x0, z1], [x1, z1]]];
      for (const tri of tris) {
        const piece = dedupe(clipPolygon(pts, tri), 0.05);
        if (piece.length < 3 || Math.abs(polygonArea(piece)) < 0.5) continue;
        const faces = THREE.ShapeUtils.triangulateShape(piece.map(([x, z]) => new THREE.Vector2(x, z)), []);
        const base = positions.length / 3;
        for (const [x, z] of piece) positions.push(x * M, (terrain.heightAt(x, z) + lift) * M, z * M);
        for (const [a, bb, c] of faces) {
          const p = piece[a], q = piece[bb], r = piece[c];
          const area = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
          if (area > 0) indices.push(base + a, base + c, base + bb);
          else indices.push(base + a, base + bb, base + c);
        }
      }
    }
  void cw;
  void cd;
  if (!indices.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
/** Vertical skirt along the polygon edges from terrain+top to terrain+bottom. */
function skirtGeometry(pts, terrain, top, bottom) {
  const outwardSign = polygonArea(pts) > 0 ? 1 : -1;
  const positions = [], indices = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 0.5) continue;
    const segs = Math.max(1, Math.ceil(len / 50));
    const ox = ((q[1] - p[1]) / len) * outwardSign, oz = (-(q[0] - p[0]) / len) * outwardSign;
    for (let s = 0; s < segs; s++) {
      const a = [p[0] + ((q[0] - p[0]) * s) / segs, p[1] + ((q[1] - p[1]) * s) / segs];
      const b = [p[0] + ((q[0] - p[0]) * (s + 1)) / segs, p[1] + ((q[1] - p[1]) * (s + 1)) / segs];
      const ha = terrain.heightAt(a[0], a[1]), hb = terrain.heightAt(b[0], b[1]);
      const base = positions.length / 3;
      positions.push(a[0] * M, (ha + top) * M, a[1] * M, a[0] * M, (ha + bottom) * M, a[1] * M, b[0] * M, (hb + bottom) * M, b[1] * M, b[0] * M, (hb + top) * M, b[1] * M);
      // normal of (aTop, aBot, bBot) is along the edge's left side; flip to face outward
      const nx = -(b[1] - a[1]), nz = b[0] - a[0];
      const facesOut = nx * ox + nz * oz > 0;
      if (facesOut) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  if (!indices.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function solidMesh(geo, poly, kind) {
  const mesh = new THREE.Mesh(geo, surfaceMaterial({ material: poly.material, tint: poly.tint }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind, id: poly.id };
  return mesh;
}
/** Top level (cm) of a polygon item, used by the properties panel. */
export function polygonLevels(poly, kind, terrain) {
  const pts = dedupe(poly.points);
  if (pts.length < 3) return null;
  const { min, max } = terrainRange(pts, terrain);
  if (kind === "garden") return { bottom: min, top: max + PATCH_LIFT };
  if (poly.type === "pool") {
    const top = max + 3;
    return { top, bottom: top - Math.max(30, Math.abs(poly.height)) };
  }
  if (poly.type === "path") return { bottom: min, top: max + PATH_THICK };
  const bottom = min - 2;
  return { bottom, top: Math.max(bottom + 2, max + poly.height) };
}
/**
 * Group (world metres, at the origin) for an outdoor polygon or a garden
 * patch; null when it has fewer than 3 points. Mesh userData kind is
 * "outdoor" or "garden" with the item id.
 */
export function buildPolygon(poly, kind, terrain) {
  const pts = dedupe(poly.points);
  if (pts.length < 3 || Math.abs(polygonArea(pts)) < 100) return null;
  const group = buildPolygonMeshes(poly, kind, terrain, pts);
  // put the group's origin at the centroid so the gizmo sits on the shape
  const [cx, cz] = polygonCentroid(pts);
  for (const m of group.children) m.geometry.translate(-cx * M, 0, -cz * M);
  group.position.set(cx * M, 0, cz * M);
  group.userData.origin = [cx, cz];
  return group;
}
function buildPolygonMeshes(poly, kind, terrain, pts) {
  const group = new THREE.Group();
  group.userData = { kind: `${kind}Group`, id: poly.id };
  const levels = polygonLevels(poly, kind, terrain);
  if (kind === "garden") {
    const geo = conformGeometry(pts, terrain, PATCH_LIFT);
    if (geo) {
      const mesh = solidMesh(geo, poly, kind);
      mesh.castShadow = false;
      group.add(mesh);
    }
    return group;
  }
  if (poly.type === "path") {
    const parts = [conformGeometry(pts, terrain, PATH_THICK), skirtGeometry(pts, terrain, PATH_THICK, -PATH_THICK)].filter(Boolean);
    if (parts.length) {
      const geo = parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
      if (parts.length > 1) parts.forEach((g) => g.dispose());
      const mesh = solidMesh(geo, poly, kind);
      mesh.castShadow = false;
      group.add(mesh);
    }
    return group;
  }
  if (poly.type === "pool") {
    const inner = insetPolygon(pts, POOL_WALL);
    const outer = shapeOf(pts);
    const parts = [];
    if (inner) {
      outer.holes.push(shapeOf(inner));
      parts.push(extrude(shapeOf(inner), levels.bottom - 10, levels.bottom)); // floor
    }
    parts.push(extrude(outer, levels.bottom - 10, levels.top)); // walls (or a solid block)
    const geo = parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
    if (parts.length > 1) parts.forEach((g) => g.dispose());
    group.add(solidMesh(geo, poly, kind));
    if (inner) {
      const water = new THREE.Mesh(flat(shapeOf(inner), levels.top - POOL_WATER), waterMaterial());
      water.castShadow = false;
      water.receiveShadow = true;
      water.renderOrder = 10;
      water.userData = { kind, id: poly.id, water: true };
      group.add(water);
    }
    return group;
  }
  // deck
  if (poly.open) return openDeck(group, poly, kind, pts, levels, terrain);
  group.add(solidMesh(extrude(shapeOf(pts), levels.bottom, levels.top), poly, kind));
  return group;
}
const DECK_SLAB = 8, DECK_RIM = 20, RIM_T = 4, POST_GAP = 200, POST_GRID = 250, POST_BURY = 20, MAX_POSTS = 400;
/** Deck as a thin slab on wooden posts that reach the ground. */
function openDeck(group, poly, kind, pts, levels, terrain) {
  const top = levels.top, under = top - DECK_SLAB;
  const parts = [extrude(shapeOf(pts), under, top)];
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1) continue;
    const g = new THREE.BoxGeometry(len * M, DECK_RIM * M, RIM_T * M);
    g.rotateY(-Math.atan2(bz - az, bx - ax));
    g.translate(((ax + bx) / 2) * M, (under - DECK_RIM / 2) * M, ((az + bz) / 2) * M);
    parts.push(g);
  }
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g)); // extrude is non-indexed, boxes are indexed
  group.add(solidMesh(mergeGeometries(flat, false), poly, kind));
  parts.forEach((g) => g.dispose());
  // posts: polygon corners (inset), along edges, and a grid inside large decks
  const ps = poly.postSize || 15;
  const inner = insetPolygon(pts, ps / 2 + 1) || pts;
  const spots = [];
  for (let i = 0; i < inner.length; i++) {
    const [ax, az] = inner[i], [bx, bz] = inner[(i + 1) % inner.length];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / POST_GAP));
    for (let k = 0; k < n; k++) spots.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  const b = polygonBounds(inner);
  for (let x = b.minX + POST_GRID / 2; x < b.maxX; x += POST_GRID)
    for (let z = b.minZ + POST_GRID / 2; z < b.maxZ; z += POST_GRID)
      if (pointInPolygon(x, z, inner) && edgeDistance(x, z, inner) > 80) spots.push([x, z]);
  const posts = [];
  for (const [x, z] of spots.slice(0, MAX_POSTS)) {
    const ground = terrain.heightAt(x, z) - POST_BURY;
    const h = under - ground;
    if (h < 5) continue;
    const g = new THREE.BoxGeometry(ps * M, h * M, ps * M);
    g.translate(x * M, (ground + h / 2) * M, z * M);
    posts.push(g);
  }
  if (posts.length) {
    const mesh = new THREE.Mesh(mergeGeometries(posts, false), surfaceMaterial({ material: "planks" }));
    posts.forEach((g) => g.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind, id: poly.id };
    group.add(mesh);
  }
  return group;
}
function edgeDistance(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (ax + dx * u), z - (az + dz * u)));
  }
  return best;
}
