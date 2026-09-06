import { JOINT_ORDER, jointParent } from '../cast/rig.js';

// Keeps feet on the floor.
//
// Calibrating each pose so it just touches the ground is necessary but not
// sufficient: a cross-fade between two grounded poses is not itself grounded.
// Going from standing to kneeling, the hips drop on a straight line while the
// knees fold on their own curve, and for a quarter of a second the character
// is measurably underground. Authored poses that arrive by import have no
// calibration at all.
//
// So contact is enforced rather than trusted. A small set of points on the
// body is carried through the same joint chain the renderer uses, and if the
// lowest one is below the floor the whole body rises by exactly that much.
// It only ever lifts, so a jump still leaves the ground and a swimmer still
// floats.

/** The corners of each limb's own bounding box. A limb can be upside down —
 *  a shin folded under a kneeling body, a head on a supine one — so both the
 *  top and the bottom corners have to be candidates. */
export function contactPoints(parts, joints) {
  const bounds = new Map();
  for (const b of parts) {
    const limb = joints[b.limb] ? b.limb : 'hips';
    const j = joints[limb];
    let e = bounds.get(limb);
    if (!e) {
      e = { limb, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
      bounds.set(limb, e);
    }
    const c = [b.x - j.x, b.y - j.y, b.z - j.z];
    const h = [b.w / 2, b.h / 2, b.d / 2];
    for (let i = 0; i < 3; i++) {
      e.lo[i] = Math.min(e.lo[i], c[i] - h[i]);
      e.hi[i] = Math.max(e.hi[i], c[i] + h[i]);
    }
  }

  const out = [];
  for (const e of bounds.values()) {
    for (const x of [e.lo[0], e.hi[0]]) {
      for (const y of [e.lo[1], e.hi[1]]) {
        for (const z of [e.lo[2], e.hi[2]]) out.push({ limb: e.limb, p: [x, y, z] });
      }
    }
  }
  return out;
}

/** Joint offsets relative to the parent joint, in the order the chain walks. */
export function jointChain(joints) {
  const chain = {};
  for (const name of JOINT_ORDER) {
    const j = joints[name];
    if (!j) continue;
    const parent = jointParent(name);
    const pj = parent ? joints[parent] : null;
    chain[name] = { parent, off: [j.x - (pj?.x ?? 0), j.y - (pj?.y ?? 0), j.z - (pj?.z ?? 0)] };
  }
  return chain;
}

// Euler order 'YXZ', matching the pivots the renderer builds: a vector is
// spun by Z, then X, then Y. Any other order here and the clamp would be
// measuring a body the screen never shows.
function rot(v, r) {
  const [rx, ry, rz] = r;
  let x = v[0];
  let y = v[1];
  let z = v[2];
  if (rz) {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    [x, y] = [c * x - s * y, s * x + c * y];
  }
  if (rx) {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    [y, z] = [c * y - s * z, s * y + c * z];
  }
  if (ry) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    [x, z] = [c * x + s * z, -s * x + c * z];
  }
  return [x, y, z];
}

/**
 * How far a body must rise, in metres, for nothing to be below `floor`.
 * Zero when the pose is already clear of it.
 */
export function groundLift(points, chain, pose, height, floor = 0) {
  const tilt = pose.root?.tiltZ || 0;
  const lift = (pose.root?.lift || 0) * height;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);

  let min = Infinity;
  for (const { limb, p } of points) {
    let v = p;
    let cur = limb;
    while (cur) {
      const link = chain[cur];
      if (!link) break;
      v = rot(v, pose.joints?.[cur] || [0, 0, 0]);
      v = [v[0] + link.off[0], v[1] + link.off[1], v[2] + link.off[2]];
      cur = link.parent;
    }
    const y = sin * v[0] + cos * v[1] + lift;
    if (y < min) min = y;
  }
  return min < floor ? floor - min : 0;
}
