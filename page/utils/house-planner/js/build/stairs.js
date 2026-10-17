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
const TREAD_T = 6, LANDING_T = 12, STRINGER_W = 8; // cm, open-base stairs
export function stairsGeometry(st) {
  const boxes = stairsBoxes(st);
  const parts = [];
  const solid = (b, y0, y1) => {
    const g = new THREE.BoxGeometry((b.x1 - b.x0) * M, (y1 - y0) * M, (b.z1 - b.z0) * M);
    g.translate(((b.x0 + b.x1) / 2) * M, ((y0 + y1) / 2) * M, ((b.z0 + b.z1) / 2) * M);
    parts.push(g);
  };
  if (st.base !== "open") {
    for (const b of boxes) solid(b, 0, b.top);
  } else {
    // treads and landings as slabs, with sawtooth stringers under both edges of each tread
    const { riser } = stairsSteps(st);
    boxes.forEach((b) => {
      const t = b.landing ? LANDING_T : TREAD_T;
      solid(b, b.top - t, b.top);
      if (b.landing) return;
      const alongX = b.x1 - b.x0 < b.z1 - b.z0; // a tread is shallow along its flight
      const y0 = Math.max(0, b.top - riser - t), y1 = b.top - t;
      if (y1 - y0 < 1) return;
      if (alongX) for (const z of [b.z0, b.z1 - STRINGER_W]) solid({ x0: b.x0, x1: b.x1, z0: z, z1: z + STRINGER_W }, y0, y1);
      else for (const x of [b.x0, b.x1 - STRINGER_W]) solid({ x0: x, x1: x + STRINGER_W, z0: b.z0, z1: b.z1 }, y0, y1);
    });
  }
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
  if (st.railing && st.railing !== "none" && !material) {
    const rail = new THREE.Mesh(railingGeometry(st), surfaceMaterial({ tint: st.railingStyle === "metal" ? "#4a5054" : "#8d6e4f", roughness: 0.6 }));
    rail.castShadow = true;
    rail.userData = { kind: "stairs", id: st.id, storeyId: storey.id, railing: true };
    group.add(rail);
  }
  return group;
}
const RAIL_H = 90, RAIL_EVERY = 2;
/** Posts and a handrail along the outer edge(s) of each flight. */
export function railingGeometry(st) {
  const boxes = stairsBoxes(st);
  const parts = [];
  const thick = st.railingStyle === "metal" ? 3 : 5;
  const post = (x, y0, z, y1) => {
    const g = new THREE.CylinderGeometry((thick / 2) * M, (thick / 2) * M, (y1 - y0) * M, 8);
    g.translate(x * M, ((y0 + y1) / 2) * M, z * M);
    parts.push(g);
  };
  const bar = (a, b) => {
    const from = new THREE.Vector3(a[0], a[1], a[2]).multiplyScalar(M), to = new THREE.Vector3(b[0], b[1], b[2]).multiplyScalar(M);
    const len = from.distanceTo(to);
    if (len < 0.01) return;
    const g = new THREE.CylinderGeometry((thick / 2) * M, (thick / 2) * M, len, 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    parts.push(g);
  };
  const treads = boxes.filter((b) => !b.landing);
  const sides = st.railing === "both" ? [-1, 1] : [st.railing === "left" ? -1 : 1];
  // flights: runs of treads moving in one direction
  const flights = [];
  let cur = null;
  for (const b of treads) {
    const c = [(b.x0 + b.x1) / 2, b.top, (b.z0 + b.z1) / 2];
    if (cur && cur.boxes.length) {
      const p = cur.boxes[cur.boxes.length - 1].c;
      const d = [c[0] - p[0], c[2] - p[2]];
      const dir = [Math.sign(d[0]), Math.sign(d[1])];
      if (cur.dir && (cur.dir[0] !== dir[0] || cur.dir[1] !== dir[1])) cur = null;
      else cur.dir = cur.dir || dir;
    }
    if (!cur) {
      cur = { boxes: [], dir: null };
      flights.push(cur);
    }
    cur.boxes.push({ c, b });
  }
  for (const f of flights) {
    const dir = f.dir || [1, 0];
    const n = [-dir[1], dir[0]]; // left of the ascending direction
    for (const side of sides) {
      const pts = [];
      f.boxes.forEach(({ c, b }, i) => {
        const half = dir[0] !== 0 ? (b.z1 - b.z0) / 2 : (b.x1 - b.x0) / 2;
        const x = c[0] + n[0] * side * (half - thick), z = c[2] + n[1] * side * (half - thick);
        if (i % RAIL_EVERY === 0 || i === f.boxes.length - 1) {
          post(x, c[1], z, c[1] + RAIL_H);
          pts.push([x, c[1] + RAIL_H, z]);
        }
      });
      for (let i = 0; i < pts.length - 1; i++) bar(pts[i], pts[i + 1]);
    }
  }
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return geo;
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
