// Rooms: the closed areas bounded by a storey's walls. The wall centrelines
// form a planar graph (segments split where they cross or touch, ends
// merged within EPS, dangling ends pruned); the bounded faces of that graph
// are the rooms. Every face edge remembers its wall, so the net polygon
// (the inner wall faces) and the plan dimensions know the thickness.
// Faces are matched to the storey's saved room records first by polygon
// key, then by the stored centroid, so names and finishes survive wall
// edits. All coordinates are building-local centimetres.
import { polygonArea, pointInPolygon, polygonBounds } from "./geom.js";
import { wallLength, uid } from "./schema.js";

const EPS = 2; // cm: ends closer than this are one node
const MIN_AREA = 1000; // cm² (0.1 m²): smaller faces are slivers between overlapping walls

/**
 * Detect the rooms of a wall list. Returns faces sorted by position:
 * { polygon (centreline, counter-clockwise), edges [{a, b, wall}] (edge i
 * runs polygon[i] → polygon[i+1]), net (inset polygon, or the centreline
 * one when the inset collapses), area (net, cm²), grossArea, perimeter
 * (net, cm), centroid, labelPoint, key }.
 */
export function detectRooms(walls) {
  const segs = walls.filter((w) => wallLength(w) >= 1).map((w) => ({ a: w.a, b: w.b, wall: w }));
  // ---- split every segment where another one crosses or touches it
  const pieces = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const ts = [0, 1];
    for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const o = segs[j];
      const hit = segIntersect(s.a, s.b, o.a, o.b, EPS);
      if (hit) ts.push(hit.t);
      for (const p of [o.a, o.b]) {
        const pr = project(s.a, s.b, p);
        if (pr.t > 0 && pr.t < 1 && pr.dist < EPS) ts.push(pr.t);
      }
    }
    ts.sort((x, y) => x - y);
    let prev = 0;
    for (let k = 1; k < ts.length; k++) {
      const t = Math.min(1, Math.max(0, ts[k]));
      if ((t - prev) * len < EPS) continue;
      pieces.push({ a: lerp(s.a, s.b, prev), b: lerp(s.a, s.b, t), wall: s.wall });
      prev = t;
    }
  }
  // ---- nodes (merged within EPS) and unique edges
  const nodes = [];
  const nodeAt = (p) => {
    for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - p[0], nodes[i].z - p[1]) < EPS) return i;
    nodes.push({ x: p[0], z: p[1], edges: [] });
    return nodes.length - 1;
  };
  const edges = [];
  const seen = new Set();
  for (const pc of pieces) {
    const u = nodeAt(pc.a), v = nodeAt(pc.b);
    if (u === v) continue;
    const key = u < v ? `${u}-${v}` : `${v}-${u}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const e = { u, v, wall: pc.wall, alive: true };
    edges.push(e);
    nodes[u].edges.push(e);
    nodes[v].edges.push(e);
  }
  // ---- prune dangling ends (a wall sticking into a room is not a boundary)
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      const live = n.edges.filter((e) => e.alive);
      if (live.length === 1) {
        live[0].alive = false;
        changed = true;
      }
    }
  }
  nodes.forEach((n, ni) => {
    n.edges = n.edges.filter((e) => e.alive);
    n.nbrs = n.edges
      .map((e) => ({ to: e.u === ni ? e.v : e.u, e }))
      .map((x) => ({ ...x, ang: Math.atan2(nodes[x.to].z - n.z, nodes[x.to].x - n.x) }))
      .sort((p, q) => p.ang - q.ang);
  });
  // ---- connected components (for holes: a face of another component inside this one)
  const comp = new Array(nodes.length).fill(-1);
  let ncomp = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (comp[i] >= 0 || !nodes[i].edges.length) continue;
    const stack = [i];
    comp[i] = ncomp;
    while (stack.length) {
      const k = stack.pop();
      for (const nb of nodes[k].nbrs) if (comp[nb.to] < 0) {
        comp[nb.to] = ncomp;
        stack.push(nb.to);
      }
    }
    ncomp++;
  }
  // ---- faces: follow each half-edge, always taking the sharpest left turn
  // (the previous neighbour in angle order); bounded faces come out
  // counter-clockwise, the unbounded one clockwise
  const used = new Set();
  const faces = [];
  for (const e of edges) {
    if (!e.alive) continue;
    for (const [u0, v0] of [[e.u, e.v], [e.v, e.u]]) {
      if (used.has(`${u0}>${v0}`)) continue;
      const poly = [], fedges = [];
      let u = u0, v = v0, guard = 0;
      do {
        used.add(`${u}>${v}`);
        const n = nodes[u];
        poly.push([n.x, n.z]);
        const list = nodes[v].nbrs;
        const idx = list.findIndex((nb) => nb.to === u);
        fedges.push({ a: [n.x, n.z], b: [nodes[v].x, nodes[v].z], wall: list[idx].e.wall });
        const next = list[(idx - 1 + list.length) % list.length];
        u = v;
        v = next.to;
      } while ((u !== u0 || v !== v0) && ++guard < 10000);
      const grossArea = polygonArea(poly);
      if (grossArea <= MIN_AREA) continue; // the unbounded face runs clockwise
      faces.push({ polygon: poly, edges: fedges, grossArea, comp: comp[u0] });
    }
  }
  // ---- holes, net polygons, labels
  for (const f of faces) {
    f.bounds = polygonBounds(f.polygon);
    f.holes = [];
  }
  for (const f of faces)
    for (const g of faces) {
      if (g === f || g.comp === f.comp) continue;
      const b = g.bounds, fb = f.bounds;
      if (b.minX < fb.minX || b.maxX > fb.maxX || b.minZ < fb.minZ || b.maxZ > fb.maxZ) continue;
      if (pointInPolygon(g.polygon[0][0], g.polygon[0][1], f.polygon)) f.holes.push(g);
    }
  for (const f of faces) {
    // only the outermost contained faces count as holes
    f.holes = f.holes.filter((g) => !f.holes.some((h) => h !== g && h.holes.includes(g)));
    f.net = insetByEdges(f.polygon, f.edges.map((e) => e.wall.thickness / 2)) || f.polygon;
    f.area = Math.max(0, polygonArea(f.net) - f.holes.reduce((s, g) => s + g.grossArea, 0));
    f.perimeter = perimeter(f.net);
    f.centroid = areaCentroid(f.polygon);
    f.labelPoint = labelPoint(f.net, f.holes.map((g) => g.polygon));
    f.key = faceKey(f.polygon);
    delete f.comp;
    delete f.bounds;
  }
  faces.sort((p, q) => p.centroid[1] - q.centroid[1] || p.centroid[0] - q.centroid[0]);
  return faces;
}

/** Pair detected faces with saved room records without changing them. */
export function matchRooms(rooms, faces) {
  const left = new Set(rooms);
  const out = faces.map((face) => ({ face, room: null }));
  for (const o of out) {
    const r = rooms.find((x) => left.has(x) && x.polygonKey === o.face.key);
    if (r) {
      o.room = r;
      left.delete(r);
    }
  }
  for (const o of out) {
    if (o.room) continue;
    let best = null, bestD = Infinity;
    for (const r of left) {
      if (!r.centroid || !pointInPolygon(r.centroid[0], r.centroid[1], o.face.polygon)) continue;
      const d = Math.hypot(r.centroid[0] - o.face.centroid[0], r.centroid[1] - o.face.centroid[1]);
      if (d < bestD) {
        best = r;
        bestD = d;
      }
    }
    if (best) {
      o.room = best;
      left.delete(best);
    }
  }
  return out;
}

/**
 * Detect the rooms of a storey and update storey.rooms in place: matched
 * records keep their name and finishes, new faces get fresh records,
 * records without a face are dropped. Returns [{face, room}].
 */
export function syncRooms(storey) {
  const faces = detectRooms(storey.walls);
  const pairs = matchRooms(storey.rooms || [], faces);
  const order = new Map((storey.rooms || []).map((r, i) => [r, i]));
  for (const p of pairs) {
    if (!p.room) p.room = freshRoom();
    p.room.polygonKey = p.face.key;
    p.room.centroid = [Math.round(p.face.centroid[0]), Math.round(p.face.centroid[1])];
  }
  pairs.sort((p, q) => (order.get(p.room) ?? 1e9) - (order.get(q.room) ?? 1e9));
  storey.rooms = pairs.map((p) => p.room);
  return pairs;
}
export function freshRoom() {
  return { id: uid("rm"), name: "", polygonKey: "", centroid: [0, 0], floorMaterial: null, floorTint: null, ceilingTint: null, locked: false };
}
/** Display name: the given one or "Room n" by position in the storey list. */
export function roomLabel(room, storey, t, auto = "") {
  return room.name || auto || `${t("room")} ${(storey.rooms || []).indexOf(room) + 1}`;
}
export function formatArea(cm2, lang) {
  return `${(cm2 / 10000).toLocaleString(lang, { maximumFractionDigits: 1 })} m²`;
}

// ---------------------------------------------------------------- geometry

/** Sorted-vertex hash of a polygon (1 cm), stable under rotation of the start vertex. */
export function faceKey(poly) {
  const parts = poly.map(([x, z]) => `${Math.round(x)},${Math.round(z)}`).sort().join(";");
  let h = 2166136261;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}${poly.length.toString(36)}`;
}
function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** Projection of p onto segment ab: {t, dist}. */
function project(a, b, p) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2;
  return { t, dist: Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t)) };
}
/** Crossing of two segments (tolerance in cm at the ends): {t, u} or null. */
function segIntersect(a1, b1, a2, b2, tol) {
  const d1 = [b1[0] - a1[0], b1[1] - a1[1]], d2 = [b2[0] - a2[0], b2[1] - a2[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
  if (Math.abs(den) < 1e-6 * l1 * l2) return null; // parallel: handled by endpoint projection
  const w = [a2[0] - a1[0], a2[1] - a1[1]];
  const t = (w[0] * d2[1] - w[1] * d2[0]) / den;
  const u = (w[0] * d1[1] - w[1] * d1[0]) / den;
  const tt = tol / l1, tu = tol / l2;
  if (t < -tt || t > 1 + tt || u < -tu || u > 1 + tu) return null;
  return { t, u };
}
/**
 * Offset every edge of a counter-clockwise polygon inwards by its own
 * distance, meeting the neighbours at the offset lines' intersection.
 * Returns null when the result collapses or flips.
 */
export function insetByEdges(poly, dists) {
  const n = poly.length;
  if (n < 3) return null;
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const d = [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
    const nrm = [-d[1], d[0]]; // interior is to the left of a counter-clockwise edge
    return { p: [p[0] + nrm[0] * dists[i], p[1] + nrm[1] * dists[i]], d };
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = lines[(i + n - 1) % n], B = lines[i];
    const den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-6) {
      out.push(B.p.slice());
      continue;
    }
    const w = [B.p[0] - A.p[0], B.p[1] - A.p[1]];
    const t = (w[0] * B.d[1] - w[1] * B.d[0]) / den;
    const v = [A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t];
    if (Math.hypot(v[0] - poly[i][0], v[1] - poly[i][1]) > Math.max(...dists) * 6 + 1) return null; // spike at a sharp corner
    out.push(v);
  }
  const area = polygonArea(out);
  return area > 0 && area < polygonArea(poly) ? out : null;
}
function perimeter(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    s += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return s;
}
export function areaCentroid(poly) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f;
    cx += (p[0] + q[0]) * f;
    cz += (p[1] + q[1]) * f;
  }
  if (Math.abs(a) < 1e-6) return poly.length ? poly[0].slice() : [0, 0];
  return [cx / (3 * a), cz / (3 * a)];
}
/** A point well inside the polygon (and outside its holes) for a label. */
export function labelPoint(poly, holes = []) {
  const c = areaCentroid(poly);
  const inside = (x, z) => pointInPolygon(x, z, poly) && !holes.some((h) => pointInPolygon(x, z, h));
  const clearance = (x, z) => {
    let best = Infinity;
    for (const ring of [poly, ...holes])
      for (let i = 0; i < ring.length; i++) best = Math.min(best, segDist(ring[i], ring[(i + 1) % ring.length], x, z));
    return best;
  };
  const b = polygonBounds(poly);
  let best = inside(c[0], c[1]) ? c : null, bestScore = best ? clearance(c[0], c[1]) : -1;
  const N = 18;
  for (let i = 1; i < N; i++)
    for (let j = 1; j < N; j++) {
      const x = b.minX + ((b.maxX - b.minX) * i) / N, z = b.minZ + ((b.maxZ - b.minZ) * j) / N;
      if (!inside(x, z)) continue;
      const s = clearance(x, z);
      if (s > bestScore * 1.15) {
        best = [x, z];
        bestScore = s;
      }
    }
  return best || c;
}
function segDist(a, b, x, z) {
  const { t } = project(a, b, [x, z]);
  const k = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a[0] + (b[0] - a[0]) * k), z - (a[1] + (b[1] - a[1]) * k));
}
