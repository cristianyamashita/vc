import { POSES, clonePose, addJoint } from './poses.js';
import { channelValue, clockOf, mirrorJointName, AXES } from './channels.js';

// Turns an action document into a pose. This is the replacement for the old
// hand-written clip functions, and it keeps their one non-negotiable
// property: the result depends only on the document, the parameters and the
// local time. Nothing is remembered between calls, so seeking to a moment
// gives the same picture as playing to it.

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

/** Breathing and a slow weight shift. Every posture wants some, or a still
 *  figure reads as a crashed renderer rather than as a calm person. */
function breathe(pose, t, amount) {
  if (!amount) return pose;
  const s = Math.sin(t * 1.6);
  addJoint(pose, 'chest', 0, 0, s * 0.012 * amount);
  addJoint(pose, 'lArm', 0, 0, s * 0.02 * amount);
  addJoint(pose, 'rArm', 0, 0, s * 0.02 * amount);
  addJoint(pose, 'head', 0, Math.sin(t * 0.7) * 0.05 * amount, 0);
  return pose;
}

/** The base pose an action starts from, by name. Poses stay in code because
 *  their heights are measured against the floor by a calibration pass; an
 *  action layers movement on top of one. */
export function basePose(name) {
  return clonePose(POSES[name] ? POSES[name] : POSES.stand);
}

/**
 * @param {object} action  a validated action document
 * @param {object} params  { speed, period, duration, side, lift, rise, reps }
 * @param {number} localT  seconds since the action started
 * @param {object} [part]  for a group action, the role's own part
 */
export function performAction(action, params, localT, part) {
  const t = Math.max(0, localT);
  const body = part || action;
  const pose = basePose(body.pose ?? action.pose);
  const u = clockOf(action, t, params);

  // `side: "left"` plays the document's channels mirrored, so a wave does not
  // need writing twice.
  const flip = action.mirrorable && params?.side === 'left';

  for (const ch of body.root || []) {
    if (!ch.field) continue;
    pose.root[ch.field] = (pose.root[ch.field] || 0) + channelValue(ch, u, t);
  }

  for (const ch of body.joints || []) {
    if (!ch.joint || !AXES.includes(ch.axis)) continue;
    const name = flip ? mirrorJointName(ch.joint) : ch.joint;
    // Mirroring negates the sideways senses as well as swapping the limb:
    // both arms lifting outward are +x on one side and -x on the other, and a
    // head turned toward the raised hand turns the other way to follow it.
    const sign = flip && (ch.axis === 'x' || ch.axis === 'y') ? -1 : 1;
    const v = channelValue(ch, u, t) * sign;
    const d = [0, 0, 0];
    d[AXIS_INDEX[ch.axis]] = v;
    addJoint(pose, name, d[0], d[1], d[2]);
  }

  breathe(pose, t, body.breathe ?? action.breathe ?? 0);

  // Sitting is measured from a cushion, lying from a surface: one replaces
  // the pose's own height, the other adds to it.
  if (Number.isFinite(params?.lift) && action.seatLift === 'set') pose.root.lift = params.lift;
  if (Number.isFinite(params?.rise) && action.seatLift === 'add') pose.root.lift += params.rise;

  return pose;
}

/** How long the action runs, given what the timeline entry asked for. */
export function actionDuration(action, entry) {
  if (Number.isFinite(entry?.for)) return entry.for;
  if (action.reps) {
    const period = action.period > 0.01 ? action.period : 1;
    return Math.max(period, (entry?.reps ?? action.defaultReps ?? 5) * period);
  }
  return action.duration ?? 1;
}
