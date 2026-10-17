// Railings (on a storey) and fences (on the terrain): a polyline of posts
// with a top rail and an infill per style, merged into one mesh, plus a
// glass mesh for glass panels, a vertex-coloured mesh for gates and an
// invisible hit box per gate. Geometry is built in centimetres relative to
// the first point of the polyline (so the gizmo rotates about it) and
// scaled to metres at the end. Fence posts stand on the ground under them;
// the rails and panels between two posts follow the slope.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { surfaceMaterial, glassMaterial } from "../materials.js";
import { M } from "../scene.js";
import { polylineLength } from "../schema.js";
import { tileKey, floorTop } from "./slabs.js";

const MATERIAL_INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });
export const DEFAULT_TINT = { glass: "#9aa3a8", wood: "#a07d55", metal: "#3b4044", masonry: "#d9d2c5", picket: "#ebe6da", ranch: "#8a6a45", hedge: "#4f7f3a" };
export const DEFAULT_TEXTURE = { masonry: "bricks" };
const POST = { glass: 5, wood: 9, metal: 4, masonry: 25, picket: 9, ranch: 12, hedge: 0 };
const GATE_COLOR = "#4a5054";

// ------------------------------------------------------------- polyline

/** Point at distance s along the polyline: {x, z, dx, dz (unit), seg}. */
export function pointAlong(points, s) {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    if (s <= acc + len || i === points.length - 1) {
      const u = Math.max(0, Math.min(1, (s - acc) / len));
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, dx: (bx - ax) / len, dz: (bz - az) / len, seg: i - 1 };
    }
    acc += len;
  }
  const [x, z] = points[0] || [0, 0];
  return { x, z, dx: 1, dz: 0, seg: 0 };
}
/** Nearest point of the polyline to (px, pz): {s, dist, x, z, seg, segStart, segEnd}. */
export function nearestOnPolyline(points, px, pz) {
  let best = null, acc = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const len = Math.sqrt(len2);
    if (len < 0.01) continue;
    const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
    const x = ax + dx * u, z = az + dz * u;
    const dist = Math.hypot(px - x, pz - z);
    if (!best || dist < best.dist) best = { s: acc + u * len, dist, x, z, seg: i - 1, segStart: acc, segEnd: acc + len };
    acc += len;
  }
  return best;
}
/** Segments of a polyline as {s0, s1, a, b} in cumulative distance. */
function segments(points) {
  const out = [];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (len < 0.01) continue;
    out.push({ s0: acc, s1: acc + len, a: points[i - 1], b: points[i] });
    acc += len;
  }
  return out;
}
/** Keep a gate inside one segment of its fence (it cannot bend around a corner). */
export function clampGate(gate, fence) {
  const segs = segments(fence.points);
  if (!segs.length) return gate;
  const centre = gate.offset + gate.width / 2;
  let seg = segs.find((g) => centre >= g.s0 && centre <= g.s1) || segs[segs.length - 1];
  if (centre < segs[0].s0) seg = segs[0];
  const len = seg.s1 - seg.s0;
  gate.width = Math.min(gate.width, Math.max(60, len));
  gate.offset = Math.max(seg.s0, Math.min(seg.s1 - gate.width, gate.offset));
  return gate;
}

// ------------------------------------------------------------- frames

/** Matrix (cm) with U from P to Q (sloped), V up-ish, W across to the right. */
function bayFrame(P, Q) {
  const U = new THREE.Vector3().subVectors(Q, P).normalize();
  const W = new THREE.Vector3(-(Q.z - P.z), 0, Q.x - P.x).normalize();
  const V = new THREE.Vector3().crossVectors(W, U).normalize();
  return new THREE.Matrix4().makeBasis(U, V, W).setPosition(P);
}
/** Matrix (cm) at P with horizontal U along (dx, dz) and V straight up. */
function vertFrame(P, dx, dz) {
  const U = new THREE.Vector3(dx, 0, dz).normalize();
  const W = new THREE.Vector3(-dz, 0, dx).normalize();
  return new THREE.Matrix4().makeBasis(U, new THREE.Vector3(0, 1, 0), W).setPosition(P);
}
function colorize(g, color) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
/** Box of w×h×d cm centred at (u, v, w) of a frame. */
function box(list, frame, w, h, d, u, v, wv, color = null) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(u, v, wv);
  g.applyMatrix4(frame);
  list.push(color ? colorize(g, color) : g);
  return g;
}

// ------------------------------------------------------------- styles

/** Base of each post along the polyline, plus the bays between them. */
function stations(item, kind) {
  const segs = segments(item.points);
  const out = []; // {s, seg, gate: gate starting a gate bay here | null}
  const gates = kind === "fence" ? item.gates.map((g) => clampGate({ ...g }, item)).sort((a, b) => a.offset - b.offset) : [];
  for (const seg of segs) {
    const inSeg = gates.filter((g) => g.offset >= seg.s0 - 0.01 && g.offset + g.width <= seg.s1 + 0.01);
    let cursor = seg.s0;
    const run = (s0, s1) => {
      const len = s1 - s0;
      if (len < 0.5) return;
      const n = Math.max(1, Math.ceil(len / item.postSpacing));
      for (let k = 0; k < n; k++) out.push({ s: s0 + (len * k) / n, seg, gate: null });
    };
    for (const g of inSeg) {
      run(cursor, g.offset);
      out.push({ s: g.offset, seg, gate: g });
      cursor = g.offset + g.width;
    }
    run(cursor, seg.s1);
    out.push({ s: seg.s1, seg, gate: null, end: true });
  }
  return out;
}
/** Derived floor offset (cm) of a railing: the floor group beside its first segment. */
export function railingOffset(item, storey, tile = 50) {
  const pts = item.points;
  if (pts.length < 1 || !storey.floorGroups.length) return 0;
  const candidates = [];
  if (pts.length >= 2) {
    const [ax, az] = pts[0], [bx, bz] = pts[1];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    candidates.push([mx + nx * 15, mz + nz * 15], [mx - nx * 15, mz - nz * 15]);
  }
  candidates.push(pts[0]);
  for (const [x, z] of candidates) {
    const key = tileKey(Math.floor(x / tile), Math.floor(z / tile));
    for (const fg of storey.floorGroups) if (fg.tiles.some(([tx, tz]) => tileKey(tx, tz) === key)) return floorTop(storey, fg) - storey.elevation;
  }
  return 0;
}

/**
 * Group for a railing (storey-local metres, at the storey elevation plus
 * `baseY`) or a fence (world metres, posts on `heightAt`). Mesh userData
 * kind is "railing" / "fence" with the item id; gate hit boxes are "gate".
 */
export function buildRailing(item, kind, { baseY = 0, heightAt = null, storeyId = null, ghost = null } = {}) {
  const group = new THREE.Group();
  const pts = item.points;
  const [ox, oz] = pts[0] || [0, 0];
  group.position.set(ox * M, baseY * M, oz * M);
  group.userData = { kind: `${kind}Group`, id: item.id, origin: [ox, oz] };
  if (pts.length < 2 || polylineLength(pts) < 5) return group;
  const H = item.height, style = item.style, post = POST[style] ?? 5;
  const base = heightAt ? (x, z) => heightAt(x, z) : () => 0;
  // local cm point at distance s along the polyline, standing on its base
  const at = (s) => {
    const p = pointAlong(pts, s);
    return { v: new THREE.Vector3(p.x - ox, base(p.x, p.z), p.z - oz), dx: p.dx, dz: p.dz };
  };
  const solid = [], glass = [], gates = [];
  const hits = [];
  const st = stations(item, kind);
  // posts
  if (post > 0) {
    const seen = new Set();
    for (const s of st) {
      const key = Math.round(s.s * 10);
      if (seen.has(key)) continue;
      seen.add(key);
      const { v, dx, dz } = at(s.s);
      const f = vertFrame(v, dx, dz);
      const big = style === "masonry";
      const ph = big ? H + (kind === "fence" ? 8 : 5) : style === "glass" || style === "metal" ? H - 3 : H + 3;
      box(solid, f, post, ph, post, 0, ph / 2, 0);
      if (big) box(solid, f, post + 6, 4, post + 6, 0, ph + 2, 0);
    }
  }
  // bays
  for (let i = 0; i + 1 < st.length; i++) {
    const a = st[i], b = st[i + 1];
    if (a.end || a.seg !== b.seg) continue;
    const L = b.s - a.s;
    if (L < 1) continue;
    const A = at(a.s), B = at(b.s);
    if (a.gate) {
      gateGeometry(a.gate, A, B, L, H, style, item, gates);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(L * M, H * M, 24 * M), MATERIAL_INVISIBLE);
      const mid = new THREE.Vector3().addVectors(A.v, B.v).multiplyScalar(0.5);
      hit.position.set(mid.x * M, (Math.max(A.v.y, B.v.y) + H / 2) * M, mid.z * M);
      hit.rotation.y = -Math.atan2(A.dz, A.dx);
      hit.userData = { kind: "gate", id: a.gate.id, fenceId: item.id };
      hits.push(hit);
      continue;
    }
    const f = bayFrame(A.v, B.v);
    const L3 = A.v.distanceTo(B.v);
    const mid = L3 / 2, inner = Math.max(0, L3 - post);
    // vertical infill members spaced `gap` apart, each standing on the base under it
    const uprights = (gap, w, d, v0, v1, wv = 0) => {
      const n = Math.max(0, Math.floor((inner - w) / gap));
      if (!n) return;
      const step = inner / (n + 1);
      for (let k = 1; k <= n; k++) {
        const s = a.s + ((post / 2 + step * k) * L) / L3;
        const { v, dx, dz } = at(s);
        box(solid, vertFrame(v, dx, dz), w, v1 - v0, d, 0, (v0 + v1) / 2, wv);
      }
    };
    switch (style) {
      case "glass": {
        box(solid, f, L3, 4, 5, mid, H - 2, 0);
        const g = new THREE.BoxGeometry(Math.max(1, inner - 2), Math.max(1, H - 14), 1.2);
        g.translate(mid, 8 + (H - 14) / 2, 0);
        g.applyMatrix4(f);
        glass.push(g);
        break;
      }
      case "wood":
        box(solid, f, L3, 5, 9, mid, H - 2.5, 0);
        box(solid, f, inner, 4, 6, mid, 10, 0);
        uprights(10, 4, 2.2, 8, H - 5);
        break;
      case "metal":
        box(solid, f, L3, 4, 4, mid, H - 2, 0);
        box(solid, f, inner, 3, 3, mid, 8, 0);
        uprights(12, 1.5, 1.5, 8, H - 4);
        break;
      case "masonry": {
        const t = kind === "fence" ? 25 : 20;
        box(solid, f, L3, H - 4, t, mid, (H - 4) / 2, 0);
        box(solid, f, L3, 4, t + 6, mid, H - 2, 0);
        break;
      }
      case "picket":
        box(solid, f, inner, 8, 3, mid, H * 0.3, -3);
        box(solid, f, inner, 8, 3, mid, H * 0.8, -3);
        uprights(12, 7, 2, 3, H, 0.5);
        break;
      case "ranch":
        box(solid, f, L3, 12, 4, mid, H - 6, 0);
        box(solid, f, L3, 12, 4, mid, H * 0.62, 0);
        box(solid, f, L3, 12, 4, mid, H * 0.3, 0);
        break;
      case "hedge": {
        const n = Math.max(1, Math.round(L3 / 60));
        const piece = L3 / n;
        for (let k = 0; k < n; k++) {
          const h = H * (k % 2 ? 0.94 : 1);
          const g = new RoundedBoxGeometry(piece + 8, h, 40, 2, 10);
          g.translate((k + 0.5) * piece, h / 2 - 3, 0);
          g.applyMatrix4(f);
          solid.push(g);
        }
        break;
      }
    }
  }
  const finish = (list) => {
    const geo = list.length > 1 ? mergeGeometries(list, false) : list[0];
    if (list.length > 1) list.forEach((g) => g.dispose());
    geo.scale(M, M, M);
    return geo;
  };
  const tag = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind, id: item.id, storeyId };
    group.add(mesh);
  };
  if (solid.length) tag(new THREE.Mesh(finish(solid), ghost || surfaceMaterial({ material: item.material, tint: item.tint || DEFAULT_TINT[style] || "#ffffff" })));
  if (gates.length) tag(new THREE.Mesh(finish(gates), ghost || surfaceMaterial({ vertexColors: true, roughness: 0.6 })));
  if (glass.length) {
    const mesh = new THREE.Mesh(finish(glass), ghost || glassMaterial("#bcd8e6"));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 10;
    mesh.userData = { kind, id: item.id, storeyId, glass: true };
    group.add(mesh);
  }
  if (!ghost) for (const h of hits) group.add(h);
  return group;
}

/** A level gate (single, double or sliding) across the bay from A to B. */
function gateGeometry(gate, A, B, L, H, style, item, list) {
  const color = ["picket", "ranch", "wood"].includes(style) ? item.tint || DEFAULT_TINT[style] : GATE_COLOR;
  const P = A.v.clone();
  P.y = Math.max(A.v.y, B.v.y);
  const f = vertFrame(P, A.dx, A.dz);
  const top = H - 2, bottom = 8;
  const leaf = (u0, u1, wv = 0) => {
    const w = u1 - u0, cu = (u0 + u1) / 2;
    box(list, f, 4, top - bottom, 3, u0 + 2, (top + bottom) / 2, wv, color);
    box(list, f, 4, top - bottom, 3, u1 - 2, (top + bottom) / 2, wv, color);
    box(list, f, w, 4, 3, cu, top - 2, wv, color);
    box(list, f, w, 4, 3, cu, bottom + 2, wv, color);
    if (style === "picket" || style === "wood") {
      const n = Math.max(1, Math.floor((w - 8) / 10));
      const step = (w - 8) / (n + 1);
      for (let k = 1; k <= n; k++) box(list, f, 6, top - bottom - 2, 1.6, u0 + 4 + step * k, (top + bottom) / 2, wv + 1.2, color);
    } else {
      const n = Math.max(1, Math.floor((w - 8) / 11));
      const step = (w - 8) / (n + 1);
      for (let k = 1; k <= n; k++) box(list, f, 1.6, top - bottom - 6, 1.6, u0 + 4 + step * k, (top + bottom) / 2, wv, color);
      box(list, f, w - 8, 1.5, 1.5, cu, (top + bottom) / 2, wv, color); // middle brace
    }
  };
  if (gate.type === "double") {
    leaf(3, L / 2 - 1.5);
    leaf(L / 2 + 1.5, L - 3);
  } else if (gate.type === "sliding") {
    leaf(2, L - 2, 12);
    box(list, f, L * 1.5, 2, 4, L * 0.75, 1, 12, color); // ground track past the gate
    box(list, f, 6, H - 4, 6, L - 2, (H - 4) / 2, 18, color); // guide post
  } else leaf(3, L - 3);
}
