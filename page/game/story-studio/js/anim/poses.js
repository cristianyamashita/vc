// Static poses: a table of joint angles plus how the whole body sits on the
// ground. Everything here is data, sampled by the clips in `clips.js`.
//
// Angles are radians in the character's OWN frame, which is what keeps them
// readable: +z on a joint always swings it toward the character's face side,
// whether the character is standing, lying on its back or planking. A thigh at
// +1.5 means "knee toward my front" — the knee comes up when standing and
// rises toward the sky when supine, and both are what you want.
//
// `root` places the body as a whole:
//   tiltZ  radians; +PI/2 lays the character on its back, -PI/2 on its front
//   lift   vertical offset, as a fraction of the character's height. These
//          numbers are measured, not eyeballed: a calibration pass runs
//          forward kinematics over the man, woman and child plans and finds
//          the lowest corner of any box, and each lift is set so the worst of
//          the three just touches the ground. Change a pose's joints and the
//          lift needs re-measuring, or that pose will sink or float.
//   shift  offset along the facing axis, same units — used to keep a lying
//          body centred on the spot where it was standing

const PI2 = Math.PI / 2;

export const REST_ROOT = { tiltZ: 0, lift: 0, shift: 0 };

export const POSES = {
  stand: {
    root: { tiltZ: 0, lift: 0, shift: 0 },
    joints: {
      lArm: [0.13, 0, 0.04], rArm: [-0.13, 0, 0.04],
      lFore: [0.05, 0, 0.12], rFore: [-0.05, 0, 0.12],
    },
  },

  sit: {
    // Hips drop to seat height. An action that sits a character on a prop
    // overrides `lift` from that prop's seat anchor; this default is for
    // sitting on the ground or on something with no anchor.
    root: { tiltZ: 0, lift: -0.243, shift: -0.04 },
    joints: {
      chest: [0, 0, -0.10],
      lThigh: [0.04, 0, PI2], rThigh: [-0.04, 0, PI2],
      lShin: [0, 0, -PI2 * 0.98], rShin: [0, 0, -PI2 * 0.98],
      lArm: [0.10, 0, 0.30], rArm: [-0.10, 0, 0.30],
      lFore: [0, 0, 0.34], rFore: [0, 0, 0.34],
    },
  },

  // Upright on both knees, shins flat along the ground behind. The feet fold
  // so the soles face up: leaving them at rest drives the toes through the
  // floor, which is only ever hidden by the ground clamp shoving the whole
  // body up and floating the knees.
  kneel: {
    root: { tiltZ: 0, lift: -0.246, shift: -0.02 },
    joints: {
      chest: [0, 0, 0.04],
      lThigh: [0.03, 0, 0.02], rThigh: [-0.03, 0, 0.02],
      lShin: [0, 0, -PI2], rShin: [0, 0, -PI2],
      lFoot: [0, 0, -PI2], rFoot: [0, 0, -PI2],
      lArm: [0.06, 0, 0.10], rArm: [-0.06, 0, 0.10],
    },
  },

  // A deep squat with the feet flat. The knee has to fold further than the
  // hip opens, or the hips stay at half height and it reads as perching on
  // an invisible stool.
  crouch: {
    root: { tiltZ: 0, lift: -0.262, shift: -0.05 },
    joints: {
      chest: [0, 0, -0.34],
      lThigh: [0.05, 0, 1.62], rThigh: [-0.05, 0, 1.62],
      lShin: [0, 0, -1.86], rShin: [0, 0, -1.86],
      lFoot: [0, 0, 0.26], rFoot: [0, 0, 0.26],
      lArm: [0.08, 0, 0.62], rArm: [-0.08, 0, 0.62],
      lFore: [0, 0, 0.75], rFore: [0, 0, 0.75],
    },
  },

  lieUp: {
    root: { tiltZ: PI2, lift: 0.097, shift: 0.40 },
    joints: {
      lArm: [0.30, 0, 0.04], rArm: [-0.30, 0, 0.04],
      lFore: [0.10, 0, 0.06], rFore: [-0.10, 0, 0.06],
      lThigh: [0.06, 0, 0.02], rThigh: [-0.06, 0, 0.02],
      head: [0, 0, 0.12],
    },
  },

  lieDown: {
    root: { tiltZ: -PI2, lift: 0.125, shift: -0.40 },
    joints: {
      lArm: [0.34, 0, -0.10], rArm: [-0.34, 0, -0.10],
      lFore: [0.12, 0, -0.90], rFore: [-0.12, 0, -0.90],
      head: [0, 0.6, -0.20],
      lFoot: [0, 0, -0.5], rFoot: [0, 0, -0.5],
    },
  },

  // Hands and knees. The chest carries the head and both arms with it, so
  // folding the torso down to horizontal is one angle, not four.
  // Hands and knees. The arms are longer than the hips are high, so the
  // torso rides slightly head-up rather than dead level; folding it to a
  // true right angle leaves the hands hovering above the floor.
  crawl: {
    root: { tiltZ: 0, lift: -0.256, shift: 0 },
    joints: {
      // The torso folds FORWARD over the hands: negative on the chest. The
      // arms then need the opposite sign to hang straight down from the
      // shoulders, and the head to come back up to look ahead.
      chest: [0, 0, -PI2 * 0.97],
      head: [0, 0, PI2 * 0.84],
      lArm: [0.05, 0, 1.50], rArm: [-0.05, 0, 1.50],
      lFore: [0, 0, 0.10], rFore: [0, 0, 0.10],
      lShin: [0, 0, -PI2], rShin: [0, 0, -PI2],
      lFoot: [0, 0, -PI2 * 0.95], rFoot: [0, 0, -PI2 * 0.95],
    },
  },

  // Plank. The arms swing forward in body frame, which under the face-down
  // tilt points them straight at the floor.
  plank: {
    root: { tiltZ: -PI2, lift: 0.370, shift: -0.36 },
    joints: {
      lArm: [0.10, 0, PI2], rArm: [-0.10, 0, PI2],
      head: [0, 0, -0.35],
      lFoot: [0, 0, -0.85], rFoot: [0, 0, -0.85],
    },
  },

  // Supine with the knees up, the position a sit-up starts and ends in.
  situpDown: {
    root: { tiltZ: PI2, lift: 0.124, shift: 0.34 },
    joints: {
      lThigh: [0.06, 0, 1.15], rThigh: [-0.06, 0, 1.15],
      lShin: [0, 0, -1.65], rShin: [0, 0, -1.65],
      lArm: [0.55, 0, 1.30], rArm: [-0.55, 0, 1.30],
      lFore: [0.20, 0, 1.55], rFore: [-0.20, 0, 1.55],
      head: [0, 0, 0.30],
    },
  },

  // The one pose that is supposed to float. It rides the water line, so the
  // ground calibration does not apply to it.
  swim: {
    root: { tiltZ: -PI2, lift: 0.42, shift: -0.36 },
    joints: {
      head: [0, 0, -0.55],
      lArm: [0.20, 0, 0.30], rArm: [-0.20, 0, 0.30],
      lFore: [0, 0, 0.20], rFore: [0, 0, 0.20],
      lThigh: [0.10, 0, 0.10], rThigh: [-0.10, 0, 0.10],
    },
  },
};

/** The poses an action document may name. They stay in code because their
 *  heights are measured against the floor by a calibration pass, not chosen. */
export const POSE_NAMES = Object.keys(POSES);

/** A pose object with nothing set, for blends that start from neutral. */
export function emptyPose() {
  return { root: { tiltZ: 0, lift: 0, shift: 0 }, joints: {} };
}

/** Deep-ish copy, so a clip can overlay motion without editing the table. */
export function clonePose(pose) {
  const src = pose || POSES.stand;
  const joints = {};
  for (const [k, v] of Object.entries(src.joints || {})) joints[k] = [v[0], v[1], v[2]];
  return {
    root: { ...REST_ROOT, ...(src.root || {}) },
    joints,
  };
}

/** Adds `[rx, ry, rz]` onto a joint already in the pose. */
export function addJoint(pose, name, rx, ry, rz) {
  const cur = pose.joints[name];
  if (cur) {
    cur[0] += rx;
    cur[1] += ry;
    cur[2] += rz;
  } else {
    pose.joints[name] = [rx, ry, rz];
  }
  return pose;
}
