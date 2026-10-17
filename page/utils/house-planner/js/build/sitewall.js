// Site boundary wall ("muro"): a polyline on the lot whose top follows the
// ground (smoothly, as a straight line per segment, or in level steps) and
// whose base is always buried. Gates cut a gap with a pillar on each side.
// Built as one ribbon per run with the roof Shell collector; cm in, metres out.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial, ghostMaterial } from "../materials.js";
import { M } from "../scene.js";
import { Shell, UP } from "./roof.js";
import { segments, pointAlong, clampGate, gateGeometry } from "./railing.js";

const BURY = 30; // cm below the lowest ground along a segment
const SAMPLE = 25; // cm between samples when following the ground
const MATERIAL_INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });

/** Five faces of an upright box (no underside) into a Shell, local cm. */
function shellBox(s, cx, cz, size, y0, y1) {
  const h = size / 2;
  const c = (dx, dz, y) => [cx + dx, y, cz + dz];
  s.quad(c(-h, -h, y1), c(h, -h, y1), c(h, h, y1), c(-h, h, y1), UP);
  s.quad(c(-h, -h, y0), c(h, -h, y0), c(h, -h, y1), c(-h, -h, y1), new THREE.Vector3(0, 0, -1));
  s.quad(c(-h, h, y0), c(h, h, y0), c(h, h, y1), c(-h, h, y1), new THREE.Vector3(0, 0, 1));
  s.quad(c(-h, -h, y0), c(-h, h, y0), c(-h, h, y1), c(-h, -h, y1), new THREE.Vector3(-1, 0, 0));
  s.quad(c(h, -h, y0), c(h, h, y0), c(h, h, y1), c(h, -h, y1), new THREE.Vector3(1, 0, 0));
}

/**
 * Group for one site wall, positioned at its first point. userData kinds:
 * siteWallGroup (group), siteWall (meshes), gate (hit boxes).
 */
export function buildSiteWall(wall, terrain, { ghost = null } = {}) {
  const pts = wall.points;
  const group = new THREE.Group();
  if (pts.length < 2) return group;
  const [ox, oz] = pts[0];
  group.position.set(ox * M, 0, oz * M);
  group.userData = { kind: "siteWallGroup", id: wall.id, origin: [ox, oz] };
  const H = wall.height, t = wall.thickness;
  const hAt = (x, z) => terrain.heightAt(x, z);
  const inner = new Shell(), outer = new Shell();
  const useOuter = !!(wall.outerMaterial || wall.outerTint);
  const leaf = [], hits = [];
  const gates = (wall.gates || []).map((g) => clampGate({ ...g }, wall)).sort((a, b) => a.offset - b.offset);
  const v = (p, y) => [p[0] - ox, y, p[1] - oz];
  const segs = segments(pts);
  const segInfo = [];
  for (const seg of segs) {
    const len = seg.s1 - seg.s0;
    const dx = (seg.b[0] - seg.a[0]) / len, dz = (seg.b[1] - seg.a[1]) / len;
    const nx = -dz, nz = dx;
    const P = (s) => [seg.a[0] + dx * (s - seg.s0), seg.a[1] + dz * (s - seg.s0)];
    // base: below the lowest ground under the wall's footprint on this segment
    let bottom = Infinity;
    for (let s = seg.s0; s <= seg.s1 + 0.01; s += SAMPLE) {
      const [x, z] = P(Math.min(s, seg.s1));
      for (const k of [-1, 0, 1]) bottom = Math.min(bottom, hAt(x + (nx * k * t) / 2, z + (nz * k * t) / 2));
    }
    bottom -= BURY;
    const topA = hAt(...P(seg.s0)) + H, topB = hAt(...P(seg.s1)) + H;
    const stepTop = (s) => {
      const k = Math.floor((s - seg.s0) / wall.stepLength + 1e-6);
      const a = seg.s0 + k * wall.stepLength, b = Math.min(seg.s1, a + wall.stepLength);
      let m = -Infinity;
      for (let i = 0; i <= 8; i++) {
        const [x, z] = P(a + ((b - a) * i) / 8);
        m = Math.max(m, hAt(x, z));
      }
      return m + H;
    };
    const topAt = (s) => (wall.top === "straight" ? topA + ((topB - topA) * (s - seg.s0)) / len : wall.top === "stepped" ? stepTop(Math.min(s, seg.s1 - 0.01)) : hAt(...P(s)) + H);
    segInfo.push({ seg, bottom, topAt, dx, dz });
    // runs between gate gaps (and step boundaries)
    const cuts = gates.filter((g) => g.offset >= seg.s0 - 0.01 && g.offset + g.width <= seg.s1 + 0.01);
    let runs = [[seg.s0, seg.s1]];
    for (const g of cuts) {
      const last = runs.pop();
      runs.push([last[0], g.offset], [g.offset + g.width, last[1]]);
    }
    if (wall.top === "stepped") {
      const out = [];
      for (const [r0, r1] of runs) {
        let s = r0;
        while (s < r1 - 0.01) {
          const k = Math.floor((s - seg.s0) / wall.stepLength + 1e-6);
          const e = Math.min(r1, seg.s0 + (k + 1) * wall.stepLength);
          out.push([s, e]);
          s = e;
        }
      }
      runs = out;
    }
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 1) continue;
      const samples = [];
      if (wall.top === "follow") {
        const n = Math.max(1, Math.ceil((r1 - r0) / SAMPLE));
        for (let i = 0; i <= n; i++) samples.push(r0 + ((r1 - r0) * i) / n);
      } else samples.push(r0, r1);
      const S = samples.map((s) => {
        const [x, z] = P(s);
        return { L: [x + (nx * t) / 2, z + (nz * t) / 2], R: [x - (nx * t) / 2, z - (nz * t) / 2], top: topAt(s) };
      });
      for (let i = 0; i < S.length - 1; i++) {
        const a = S[i], b = S[i + 1];
        inner.quad(v(a.L, a.top), v(b.L, b.top), v(b.R, b.top), v(a.R, a.top), UP);
        inner.quad(v(a.L, bottom), v(b.L, bottom), v(b.L, b.top), v(a.L, a.top), new THREE.Vector3(nx, 0, nz));
        (useOuter ? outer : inner).quad(v(a.R, bottom), v(b.R, bottom), v(b.R, b.top), v(a.R, a.top), new THREE.Vector3(-nx, 0, -nz));
      }
      const f = S[0], l = S[S.length - 1];
      inner.quad(v(f.L, bottom), v(f.R, bottom), v(f.R, f.top), v(f.L, f.top), new THREE.Vector3(-dx, 0, -dz));
      inner.quad(v(l.L, bottom), v(l.R, bottom), v(l.R, l.top), v(l.L, l.top), new THREE.Vector3(dx, 0, dz));
    }
    // gates: pillars, leaf, hit box
    const p = t + 10;
    for (const g of cuts) {
      for (const s of [g.offset - p / 2, g.offset + g.width + p / 2]) {
        const [x, z] = P(Math.max(seg.s0, Math.min(seg.s1, s)));
        const top = topAt(Math.max(seg.s0, Math.min(seg.s1 - 0.01, s))) + 10;
        shellBox(inner, x - ox, z - oz, p, bottom, top);
        shellBox(inner, x - ox, z - oz, p + 6, top, top + 4);
      }
      const a = pointAlong(pts, g.offset), b = pointAlong(pts, g.offset + g.width);
      const A = { v: new THREE.Vector3(a.x - ox, hAt(a.x, a.z), a.z - oz), dx: a.dx, dz: a.dz };
      const B = { v: new THREE.Vector3(b.x - ox, hAt(b.x, b.z), b.z - oz), dx: b.dx, dz: b.dz };
      gateGeometry(g, A, B, g.width, H, "metal", wall, leaf);
      if (!ghost) {
        const hit = new THREE.Mesh(new THREE.BoxGeometry(g.width * M, H * M, (t + 10) * M), MATERIAL_INVISIBLE);
        hit.position.set(((A.v.x + B.v.x) / 2) * M, (Math.max(A.v.y, B.v.y) + H / 2) * M, ((A.v.z + B.v.z) / 2) * M);
        hit.rotation.y = -Math.atan2(a.dz, a.dx);
        hit.userData = { kind: "gate", id: g.id, wallId: wall.id };
        hits.push(hit);
      }
    }
  }
  // corners: a square post hides the mitre gap between two segments
  for (let i = 1; i < segInfo.length; i++) {
    const prev = segInfo[i - 1], next = segInfo[i];
    const [x, z] = next.seg.a;
    const bottom = Math.min(prev.bottom, next.bottom);
    const top = Math.max(prev.topAt(prev.seg.s1 - 0.01), next.topAt(next.seg.s0));
    shellBox(inner, x - ox, z - oz, t + 2, bottom, top);
  }
  const add = (geo, material, extra = {}) => {
    const mesh = new THREE.Mesh(geo, ghost ? ghostMaterial("#008f7d") : material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "siteWall", id: wall.id, ...extra };
    group.add(mesh);
  };
  if (inner.pos.length) add(inner.geometry(), surfaceMaterial({ material: wall.material, tint: wall.tint }));
  if (useOuter && outer.pos.length) add(outer.geometry(), surfaceMaterial({ material: wall.outerMaterial || wall.material, tint: wall.outerTint || wall.tint }), { outer: true });
  if (leaf.length) {
    const geo = mergeGeometries(leaf, false);
    leaf.forEach((g) => g.dispose());
    geo.scale(M, M, M);
    add(geo, surfaceMaterial({ vertexColors: true, roughness: 0.6 }), { gateLeaf: true });
  }
  for (const h of hits) group.add(h);
  return group;
}
