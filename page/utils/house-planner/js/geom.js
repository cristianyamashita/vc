// 2D polygon helpers on lists of [x, z] points (centimetres). Used by the
// outdoor builder (decks, pools, paths, garden patches) and by the stairs
// builder to find floor tiles under a flight.

/** Signed area: positive when the interior is to the left of each edge. */
export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
export function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function polygonBounds(pts) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, minZ, maxX, maxZ };
}
export function polygonCentroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) {
    x += p[0];
    z += p[1];
  }
  return pts.length ? [x / pts.length, z / pts.length] : [0, 0];
}
/** Drop consecutive points closer than eps (also the closing duplicate). */
export function dedupe(pts, eps = 0.5) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < eps) continue;
    out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < eps) out.pop();
  return out;
}
/**
 * Shrink a polygon by d (grow when negative) with mitred corners. Returns
 * null when the result collapses or flips, so callers can skip the hole.
 */
export function insetPolygon(pts, d) {
  const n = pts.length;
  if (n < 3) return null;
  const sign = polygonArea(pts) > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i + n - 1) % n], v = pts[i], q = pts[(i + 1) % n];
    const e1 = norm([v[0] - p[0], v[1] - p[1]]), e2 = norm([q[0] - v[0], q[1] - v[1]]);
    // inward normals of the two edges
    const n1 = [-e1[1] * sign, e1[0] * sign], n2 = [-e2[1] * sign, e2[0] * sign];
    const bis = [n1[0] + n2[0], n1[1] + n2[1]];
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    const k = d / Math.max(0.2, 1 + dot); // mitre, capped at 5× for sharp corners
    out.push([v[0] + bis[0] * k, v[1] + bis[1] * k]);
  }
  const area = polygonArea(out);
  if (Math.sign(area) !== sign || Math.abs(area) < 1) return null;
  return out;
}
function norm(v) {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}
/** Sutherland–Hodgman: subject (any shape) clipped to a convex polygon. */
export function clipPolygon(subject, clip) {
  const sign = polygonArea(clip) > 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const input = out;
    out = [];
    const side = (p) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign;
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      const sc = side(cur), sp = side(prev);
      if (sc >= 0) {
        if (sp < 0) out.push(intersect(prev, cur, a, b));
        out.push(cur);
      } else if (sp >= 0) out.push(intersect(prev, cur, a, b));
    }
  }
  return out;
}
/** The part of `subject` on one side of the line a→b: sign 1 keeps the left side, -1 the right. */
export function clipHalfPlane(subject, a, b, sign) {
  const out = [];
  const side = (p) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign;
  for (let j = 0; j < subject.length; j++) {
    const cur = subject[j], prev = subject[(j + subject.length - 1) % subject.length];
    const sc = side(cur), sp = side(prev);
    if (sc >= 0) {
      if (sp < 0) out.push(intersect(prev, cur, a, b));
      out.push(cur);
    } else if (sp >= 0) out.push(intersect(prev, cur, a, b));
  }
  return out;
}
/**
 * `piece` minus the convex polygon `conv`, as a list of polygons: the part
 * outside each edge of `conv` in turn, the rest narrowed to the inside.
 */
export function subtractConvex(piece, conv) {
  const sign = polygonArea(conv) > 0 ? 1 : -1;
  const out = [];
  let rest = piece;
  for (let i = 0; i < conv.length && rest.length >= 3; i++) {
    const a = conv[i], b = conv[(i + 1) % conv.length];
    const outside = clipHalfPlane(rest, a, b, -sign);
    if (outside.length >= 3 && Math.abs(polygonArea(outside)) > 0.5) out.push(outside);
    rest = clipHalfPlane(rest, a, b, sign);
  }
  return out;
}
function intersect(p, q, a, b) {
  const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [b[0] - a[0], b[1] - a[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return [q[0], q[1]];
  const t = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den;
  return [p[0] + d1[0] * t, p[1] + d1[1] * t];
}
/** Separating-axis test for two convex polygons. */
export function convexOverlap(a, b) {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ax = -(q[1] - p[1]), az = q[0] - p[0];
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) {
        const d = v[0] * ax + v[1] * az;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const v of b) {
        const d = v[0] * ax + v[1] * az;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA <= minB || maxB <= minA) return false;
    }
  return true;
}
