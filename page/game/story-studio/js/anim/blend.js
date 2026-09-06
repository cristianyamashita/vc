import { REST_ROOT } from './poses.js';

// Cross-fading two poses. Kept separate from the clips because the director
// needs it to be a pure function: a blend that remembered where it was last
// frame would make `seek()` return a different picture depending on how the
// viewer got there, and scrubbing the progress bar would drift.

/** Smoothstep, so a transition eases in and out instead of starting abruptly. */
export function ease(k) {
  const t = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return t * t * (3 - 2 * t);
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

/**
 * Mixes `b` into `a` by `k` (0 = all a, 1 = all b). Joints missing from one
 * side count as zero rotation, which is what makes a pose table able to
 * mention only the joints it cares about.
 */
export function blendPose(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const ra = { ...REST_ROOT, ...(a.root || {}) };
  const rb = { ...REST_ROOT, ...(b.root || {}) };
  const root = {
    tiltZ: lerp(ra.tiltZ, rb.tiltZ, k),
    lift: lerp(ra.lift, rb.lift, k),
    shift: lerp(ra.shift, rb.shift, k),
  };

  const joints = {};
  const names = new Set([...Object.keys(a.joints || {}), ...Object.keys(b.joints || {})]);
  for (const name of names) {
    const va = a.joints?.[name];
    const vb = b.joints?.[name];
    joints[name] = [
      lerp(va?.[0] || 0, vb?.[0] || 0, k),
      lerp(va?.[1] || 0, vb?.[1] || 0, k),
      lerp(va?.[2] || 0, vb?.[2] || 0, k),
    ];
  }
  return { root, joints };
}

/**
 * Lays a gesture over a pose without disturbing the rest of the body.
 *
 * `blendPose` treats a joint missing from one side as zero rotation, which is
 * right for swapping whole-body poses and wrong for a gesture: waving while
 * seated would drag the thighs back toward standing and lift the actor off
 * the chair. So an overlay keeps the base's root and every joint it does not
 * itself mention.
 */
export function overlayPose(base, over, k) {
  if (k <= 0) return base;
  const joints = {};
  for (const [name, v] of Object.entries(base.joints || {})) joints[name] = [v[0], v[1], v[2]];
  for (const [name, v] of Object.entries(over.joints || {})) {
    const a = joints[name] || [0, 0, 0];
    joints[name] = [lerp(a[0], v[0], k), lerp(a[1], v[1], k), lerp(a[2], v[2], k)];
  }
  return { root: base.root, joints };
}

/** Writes a pose onto a rigged character built by `cast/build.js`. */
export function applyPose(root, pose) {
  const pivots = root.userData?.pivots;
  if (!pivots) return;
  const height = root.userData.height || 1;
  const body = root.userData.body || root;

  for (const name of Object.keys(pivots)) {
    const r = pose.joints?.[name];
    const pivot = pivots[name];
    if (r) pivot.rotation.set(r[0], r[1], r[2]);
    else pivot.rotation.set(0, 0, 0);
  }

  const rt = { ...REST_ROOT, ...(pose.root || {}) };
  body.rotation.z = rt.tiltZ;
  body.position.set(rt.shift * height, rt.lift * height, 0);
}
