import { POSES, clonePose, addJoint } from './poses.js';

// Every clip is a PURE function (params, localT) -> pose. No clip may keep
// state between calls: the whole point is that asking for the pose at t=12.4
// gives the same answer whether the viewer played there or dragged the
// progress bar there. That single rule is what makes scrubbing exact, and it
// is the first thing to check when an animation misbehaves after a seek.

const TAU = Math.PI * 2;

/** Breathing and weight shift, laid over whatever pose is underneath. A
 *  perfectly still figure reads as a crashed renderer, not as a calm person. */
function breathe(pose, t, amount = 1) {
  const s = Math.sin(t * 1.6);
  addJoint(pose, 'chest', 0, 0, s * 0.012 * amount);
  addJoint(pose, 'lArm', 0, 0, s * 0.02 * amount);
  addJoint(pose, 'rArm', 0, 0, s * 0.02 * amount);
  addJoint(pose, 'head', 0, Math.sin(t * 0.7) * 0.05 * amount, 0);
  return pose;
}

function stride(pose, t, amp, speed) {
  const w = t * (4.4 + speed * 1.7);
  const s = Math.sin(w);
  const c = Math.cos(w);
  addJoint(pose, 'lThigh', 0, 0, s * 0.62 * amp);
  addJoint(pose, 'rThigh', 0, 0, -s * 0.62 * amp);
  // The shin only ever folds backward, so it is a rectified cosine rather
  // than a sine: a knee that bends forward is the classic broken walk.
  addJoint(pose, 'lShin', 0, 0, -(0.12 + Math.max(0, c) * 0.72) * amp);
  addJoint(pose, 'rShin', 0, 0, -(0.12 + Math.max(0, -c) * 0.72) * amp);
  addJoint(pose, 'lFoot', 0, 0, (0.10 + Math.max(0, -c) * 0.24) * amp);
  addJoint(pose, 'rFoot', 0, 0, (0.10 + Math.max(0, c) * 0.24) * amp);
  addJoint(pose, 'lArm', 0, 0, -s * 0.46 * amp);
  addJoint(pose, 'rArm', 0, 0, s * 0.46 * amp);
  addJoint(pose, 'lFore', 0, 0, (0.18 + Math.max(0, -s) * 0.42) * amp);
  addJoint(pose, 'rFore', 0, 0, (0.18 + Math.max(0, s) * 0.42) * amp);
  addJoint(pose, 'chest', 0, -s * 0.05 * amp, 0);
  pose.root.lift += (Math.abs(Math.cos(w)) - 0.5) * 0.008 * amp;
  return pose;
}

/** How many whole repetitions fit, and where inside one we are. */
function repPhase(t, period) {
  const p = period > 0.05 ? period : 0.05;
  return (t % p) / p;
}

export const CLIPS = {
  stand: (_p, t) => breathe(clonePose(POSES.stand), t),

  idle: (_p, t) => {
    const pose = breathe(clonePose(POSES.stand), t, 1.4);
    addJoint(pose, 'chest', 0, Math.sin(t * 0.42) * 0.06, 0);
    return pose;
  },

  walk: (p, t) => stride(clonePose(POSES.stand), t, 1, p?.speed ?? 1.2),

  run: (p, t) => {
    const pose = stride(clonePose(POSES.stand), t, 1.35, p?.speed ?? 3.2);
    addJoint(pose, 'chest', 0, 0, 0.22);
    return pose;
  },

  // `lift` lets a seat anchor put the hips exactly where the prop's cushion
  // is, so one pose serves a bar stool and a low sofa alike.
  sit: (p, t) => {
    const pose = breathe(clonePose(POSES.sit), t, 0.7);
    if (Number.isFinite(p?.lift)) pose.root.lift = p.lift;
    return pose;
  },
  kneel: (_p, t) => breathe(clonePose(POSES.kneel), t, 0.7),
  crouch: (_p, t) => breathe(clonePose(POSES.crouch), t, 0.6),
  // `rise` lifts a lying body onto a surface; the pose itself already lays
  // it on the ground, so this adds rather than replaces.
  lieUp: (p, t) => {
    const pose = breathe(clonePose(POSES.lieUp), t, 0.5);
    if (Number.isFinite(p?.rise)) pose.root.lift += p.rise;
    return pose;
  },
  lieDown: (p, t) => {
    const pose = breathe(clonePose(POSES.lieDown), t, 0.5);
    if (Number.isFinite(p?.rise)) pose.root.lift += p.rise;
    return pose;
  },

  crawl: (p, t) => {
    const pose = clonePose(POSES.crawl);
    const w = t * (3.4 + (p?.speed ?? 0.6) * 2.2);
    const s = Math.sin(w);
    // Each swing is cancelled at the next joint down, because in a crawl the
    // shins and the hands stay flat on the floor while the thigh and the
    // upper arm move over them. Swinging the thigh alone drags the ankle
    // through the ground on every stride.
    addJoint(pose, 'lThigh', 0, 0, s * 0.20);
    addJoint(pose, 'rThigh', 0, 0, -s * 0.20);
    addJoint(pose, 'lShin', 0, 0, -s * 0.20);
    addJoint(pose, 'rShin', 0, 0, s * 0.20);
    addJoint(pose, 'lArm', 0, 0, -s * 0.24);
    addJoint(pose, 'rArm', 0, 0, s * 0.24);
    addJoint(pose, 'lFore', 0, 0, s * 0.24);
    addJoint(pose, 'rFore', 0, 0, -s * 0.24);
    addJoint(pose, 'chest', 0, s * 0.06, 0);
    return pose;
  },

  swim: (p, t) => {
    const pose = clonePose(POSES.swim);
    const w = t * (2.6 + (p?.speed ?? 1) * 1.2);
    addJoint(pose, 'lArm', 0, 0, Math.sin(w) * 1.5 + 1.3);
    addJoint(pose, 'rArm', 0, 0, Math.sin(w + Math.PI) * 1.5 + 1.3);
    addJoint(pose, 'lThigh', 0, 0, Math.sin(w * 2) * 0.28);
    addJoint(pose, 'rThigh', 0, 0, -Math.sin(w * 2) * 0.28);
    addJoint(pose, 'head', 0, Math.sin(w) * 0.5, 0);
    pose.root.lift += Math.sin(w * 2) * 0.012;
    return pose;
  },

  // ------------------------------------------------------------- exercises
  jumpingJacks: (p, t) => {
    const pose = clonePose(POSES.stand);
    const k = repPhase(t, p?.period ?? 0.9);
    // One smooth open-and-close per rep, not a sawtooth back to the start.
    const open = (1 - Math.cos(k * TAU)) / 2;
    addJoint(pose, 'lArm', -open * 2.55, 0, 0);
    addJoint(pose, 'rArm', open * 2.55, 0, 0);
    addJoint(pose, 'lFore', -open * 0.18, 0, 0);
    addJoint(pose, 'rFore', open * 0.18, 0, 0);
    addJoint(pose, 'lThigh', -open * 0.34, 0, 0);
    addJoint(pose, 'rThigh', open * 0.34, 0, 0);
    pose.root.lift += Math.abs(Math.sin(k * TAU)) * 0.018;
    return pose;
  },

  squats: (p, t) => {
    const k = repPhase(t, p?.period ?? 1.6);
    const down = (1 - Math.cos(k * TAU)) / 2;
    const pose = clonePose(POSES.stand);
    pose.root.lift += -0.095 * down;
    addJoint(pose, 'lThigh', 0.05, 0, 1.28 * down);
    addJoint(pose, 'rThigh', -0.05, 0, 1.28 * down);
    addJoint(pose, 'lShin', 0, 0, -1.42 * down);
    addJoint(pose, 'rShin', 0, 0, -1.42 * down);
    addJoint(pose, 'lFoot', 0, 0, 0.24 * down);
    addJoint(pose, 'rFoot', 0, 0, 0.24 * down);
    addJoint(pose, 'chest', 0, 0, 0.26 * down);
    addJoint(pose, 'lArm', 0, 0, 1.35 * down);
    addJoint(pose, 'rArm', 0, 0, 1.35 * down);
    return pose;
  },

  pushups: (p, t) => {
    const k = repPhase(t, p?.period ?? 1.5);
    const down = (1 - Math.cos(k * TAU)) / 2;
    const pose = clonePose(POSES.plank);
    // Elbows fold and the whole body settles toward the floor together, or
    // the arms visibly detach from the ground.
    addJoint(pose, 'lFore', 0, 0, -1.30 * down);
    addJoint(pose, 'rFore', 0, 0, -1.30 * down);
    addJoint(pose, 'lArm', 0, 0, -0.30 * down);
    addJoint(pose, 'rArm', 0, 0, -0.30 * down);
    pose.root.lift -= 0.085 * down;
    pose.root.shift += 0.05 * down;
    addJoint(pose, 'head', 0, 0, -0.18 * down);
    return pose;
  },

  situps: (p, t) => {
    const k = repPhase(t, p?.period ?? 1.8);
    const up = (1 - Math.cos(k * TAU)) / 2;
    const pose = clonePose(POSES.situpDown);
    // The curl is the root tilting back toward upright plus the waist
    // folding: doing it with the chest alone bends the person in half.
    pose.root.tiltZ -= 0.62 * up;
    pose.root.lift += 0.055 * up;
    pose.root.shift -= 0.14 * up;
    addJoint(pose, 'chest', 0, 0, 0.72 * up);
    addJoint(pose, 'head', 0, 0, 0.22 * up);
    return pose;
  },

  // ------------------------------------------------------------- gestures
  wave: (p, t) => {
    const pose = breathe(clonePose(POSES.stand), t, 0.6);
    const arm = p?.side === 'left' ? 'lArm' : 'rArm';
    const fore = p?.side === 'left' ? 'lFore' : 'rFore';
    const sign = p?.side === 'left' ? -1 : 1;
    addJoint(pose, arm, sign * 2.15, 0, 0.25);
    addJoint(pose, fore, sign * (0.35 + Math.sin(t * 7.5) * 0.45), 0, 0.5);
    addJoint(pose, 'head', 0, sign * -0.16, 0);
    return pose;
  },

  raiseArm: (p, t) => {
    const pose = breathe(clonePose(POSES.stand), t, 0.6);
    const arm = p?.side === 'left' ? 'lArm' : 'rArm';
    const sign = p?.side === 'left' ? -1 : 1;
    addJoint(pose, arm, sign * 2.85, 0, 0);
    return pose;
  },

  point: (p, t) => {
    const pose = breathe(clonePose(POSES.stand), t, 0.5);
    const arm = p?.side === 'left' ? 'lArm' : 'rArm';
    const sign = p?.side === 'left' ? -1 : 1;
    addJoint(pose, arm, sign * 0.30, 0, 1.62);
    addJoint(pose, 'chest', 0, sign * -0.10, 0);
    return pose;
  },

  nod: (_p, t) => {
    const pose = breathe(clonePose(POSES.stand), t, 0.5);
    addJoint(pose, 'head', 0, 0, -Math.sin(t * 5.2) * 0.28 - 0.06);
    return pose;
  },

  shakeHead: (_p, t) => {
    const pose = breathe(clonePose(POSES.stand), t, 0.5);
    addJoint(pose, 'head', 0, Math.sin(t * 5.6) * 0.42, 0);
    return pose;
  },

  jump: (p, t) => {
    const dur = p?.duration ?? 0.9;
    const k = Math.max(0, Math.min(1, t / dur));
    const pose = clonePose(POSES.stand);
    // Crouch, launch, land: one arc, so the pose at any k is well defined.
    const crouch = k < 0.22 ? k / 0.22 : k > 0.82 ? (1 - k) / 0.18 : 0;
    const air = k >= 0.22 && k <= 0.82 ? Math.sin(((k - 0.22) / 0.60) * Math.PI) : 0;
    pose.root.lift += air * 0.22 - crouch * 0.037;
    addJoint(pose, 'lThigh', 0, 0, crouch * 0.85 + air * 0.35);
    addJoint(pose, 'rThigh', 0, 0, crouch * 0.85 + air * 0.35);
    addJoint(pose, 'lShin', 0, 0, -crouch * 1.0 - air * 0.75);
    addJoint(pose, 'rShin', 0, 0, -crouch * 1.0 - air * 0.75);
    addJoint(pose, 'lArm', 0, 0, crouch * -0.7 + air * 2.0);
    addJoint(pose, 'rArm', 0, 0, crouch * -0.7 + air * 2.0);
    return pose;
  },
};

export const CLIP_NAMES = Object.keys(CLIPS);

export function hasClip(name) {
  return Object.prototype.hasOwnProperty.call(CLIPS, name);
}

/** Samples a clip, falling back to standing so an unknown name shows a
 *  character standing there rather than throwing mid-playback. */
export function sampleClip(name, params, localT) {
  const fn = CLIPS[name] || CLIPS.stand;
  return fn(params || {}, Math.max(0, localT));
}
