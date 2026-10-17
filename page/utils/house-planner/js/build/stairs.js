// Stairs: straight, L and U flights built from full boxes (one per step,
// from the floor up to the tread) merged into one mesh, plus landings. Full
// boxes leak no light between treads. The stair's local frame runs along
// +X from `at`, width across Z; `rotation` turns it about Y. The floor of
// the storey above is cut where the headroom under it would be too low.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial } from "../materials.js";
import { M } from "../scene.js";
import { convexOverlap } from "../geom.js";
import { tileKey } from "./slabs.js";

export const HEADROOM = 200; // cm; less than this under the floor above → cut it
const DEG = Math.PI / 180;

export function stairsSteps(st) {
  const steps = Math.max(1, Math.round(st.rise / st.stepHeight));
  return { steps, riser: st.rise / steps };
}
/** Default rise: the gap to the next storey above, or 300. */
export function defaultRise(building, storey) {
  const above = building.storeys.filter((s) => s.elevation > storey.elevation).sort((a, b) => a.elevation - b.elevation)[0];
  return above ? Math.max(30, above.elevation - storey.elevation) : 300;
}
/** Boxes {x0,x1,z0,z1,top,landing} in the stair's local frame (cm). */
export function stairsBoxes(st) {
  const { steps: n, riser } = stairsSteps(st);
  const w = st.width, d = st.treadDepth, s = st.turn === "right" ? 1 : -1;
  const boxes = [];
  const push = (x0, x1, z0, z1, top, landing = false) =>
    boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), top, landing });
  const shape = n >= 3 ? st.shape : "straight";
  if (shape === "straight") {
    for (let i = 0; i < n; i++) push(i * d, (i + 1) * d, -w / 2, w / 2, (i + 1) * riser);
    return boxes;
  }
  const n1 = Math.max(1, Math.floor((n - 1) / 2)), n2 = n - 1 - n1;
  for (let i = 0; i < n1; i++) push(i * d, (i + 1) * d, -w / 2, w / 2, (i + 1) * riser);
  const lx = n1 * d;
  if (shape === "L") {
    push(lx, lx + w, -w / 2, w / 2, (n1 + 1) * riser, true);
    for (let j = 0; j < n2; j++) push(lx, lx + w, s * (w / 2 + j * d), s * (w / 2 + (j + 1) * d), (n1 + 2 + j) * riser);
  } else {
    push(lx, lx + w, -s * (w / 2), s * (1.5 * w), (n1 + 1) * riser, true);
    for (let j = 0; j < n2; j++) push(lx - (j + 1) * d, lx - j * d, s * (w / 2), s * (1.5 * w), (n1 + 2 + j) * riser);
  }
  return boxes;
}
/** Local bounds (cm) of a stair: {x0,x1,z0,z1,top}. */
export function stairsBounds(st) {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, top: 0 };
  for (const box of stairsBoxes(st)) {
    b.x0 = Math.min(b.x0, box.x0);
    b.x1 = Math.max(b.x1, box.x1);
    b.z0 = Math.min(b.z0, box.z0);
    b.z1 = Math.max(b.z1, box.z1);
    b.top = Math.max(b.top, box.top);
  }
  return b;
}
export function stairsGeometry(st) {
  const parts = stairsBoxes(st).map((b) => {
    const g = new THREE.BoxGeometry((b.x1 - b.x0) * M, b.top * M, (b.z1 - b.z0) * M);
    g.translate(((b.x0 + b.x1) / 2) * M, (b.top / 2) * M, ((b.z0 + b.z1) / 2) * M);
    return g;
  });
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return geo;
}
export function layoutStairs(group, st, storey) {
  group.position.set(st.at[0] * M, storey.elevation * M, st.at[1] * M);
  group.rotation.set(0, st.rotation * DEG, 0);
}
/** Group (storey-local metres) with the merged mesh; userData kind "stairs". */
export function buildStairs(st, storey, material = null) {
  const group = new THREE.Group();
  layoutStairs(group, st, storey);
  group.userData = { kind: "stairsGroup", id: st.id };
  const mesh = new THREE.Mesh(stairsGeometry(st), material || surfaceMaterial({ material: st.material, tint: st.tint }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: "stairs", id: st.id, storeyId: storey.id };
  group.add(mesh);
  return group;
}
/**
 * Building-local footprint quads of the steps that leave less than
 * HEADROOM under a floor whose underside is at `underside` cm.
 */
export function stairsCutQuads(st, storey, underside) {
  const c = Math.cos(st.rotation * DEG), s = Math.sin(st.rotation * DEG);
  const map = (x, z) => [st.at[0] + x * c + z * s, st.at[1] - x * s + z * c];
  const out = [];
  for (const b of stairsBoxes(st)) {
    if (underside - (storey.elevation + b.top) >= HEADROOM) continue;
    out.push([map(b.x0, b.z0), map(b.x1, b.z0), map(b.x1, b.z1), map(b.x0, b.z1)]);
  }
  return out;
}
/** Keys of the tiles (size `tile` cm) overlapping any of the quads. */
export function tilesUnderQuads(tiles, quads, tile) {
  const out = new Set();
  if (!quads.length) return out;
  const e = 0.5; // shrink tiles a little so touching edges do not count
  for (const [x, z] of tiles) {
    const q = [[x * tile + e, z * tile + e], [(x + 1) * tile - e, z * tile + e], [(x + 1) * tile - e, (z + 1) * tile - e], [x * tile + e, (z + 1) * tile - e]];
    if (quads.some((quad) => convexOverlap(q, quad))) out.add(tileKey(x, z));
  }
  return out;
}
