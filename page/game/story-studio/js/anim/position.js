import { JOINT_NAMES } from '../cast/rig.js';
import { AXES, ROOT_FIELDS } from './channels.js';
import { addJoint } from './poses.js';
import { applyPose } from './blend.js';
import { basePose } from './perform.js';
import { groundLift } from './ground.js';

const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const DEG = Math.PI / 180;

/** A point one metre along the camera's forward axis (`Object3D` −Z, Euler YXZ).
 *
 *  Yaw and pitch are the same numbers written on the helper: `rotation.set(pitch,
 *  yaw, 0, 'YXZ')`. Positive pitch looks up; yaw 0 looks toward −Z. */
export function lookFromCamera(cam) {
  const at = cam?.at || [0, 0, 0];
  const yaw = (cam.yaw || 0) * DEG;
  const pitch = (cam.pitch || 0) * DEG;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const sy = Math.sin(yaw);
  const cy = Math.cos(yaw);
  return [
    at[0] - sy * cp,
    at[1] + sp,
    at[2] - cy * cp,
  ];
}

/** Yaw/pitch so a camera at `at` looks at `look`, matching `lookFromCamera`. */
export function yawPitchToward(at, look) {
  const dx = look[0] - at[0];
  const dy = look[1] - at[1];
  const dz = look[2] - at[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const pitch = Math.asin(Math.max(-1, Math.min(1, dy / len))) / DEG;
  const cp = Math.cos(pitch * DEG) || 1e-8;
  const yaw = Math.atan2(-(dx / len) / cp, -(dz / len) / cp) / DEG;
  return { yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3) };
}

export function applyOffsetChannels(pose, joints = [], root = []) {
  for (const ch of joints) {
    if (!ch.joint || !AXES.includes(ch.axis)) continue;
    const d = [0, 0, 0];
    d[AXIS_INDEX[ch.axis]] = ch.offset || 0;
    addJoint(pose, ch.joint, d[0], d[1], d[2]);
  }
  for (const ch of root) {
    if (!ROOT_FIELDS.includes(ch.field)) continue;
    pose.root[ch.field] = (pose.root[ch.field] || 0) + (ch.offset || 0);
  }
  return pose;
}

/** Resolves a Position document plus optional per-page joint overrides. */
export function poseFromPosition(position, extraJoints = []) {
  const pose = basePose(position?.pose || 'stand');
  applyOffsetChannels(pose, position?.joints, position?.root);
  applyOffsetChannels(pose, extraJoints, []);
  return pose;
}

export function groundedPose(mesh, pose) {
  const rise = groundLift(mesh.userData.contacts, mesh.userData.chain, pose, mesh.userData.height);
  if (!rise) return pose;
  return {
    root: { ...pose.root, lift: (pose.root.lift || 0) + rise / mesh.userData.height },
    joints: pose.joints,
  };
}

export function applyPosition(mesh, position, extraJoints = []) {
  applyPose(mesh, groundedPose(mesh, poseFromPosition(position, extraJoints)));
}

/** Diffs a live pose against a base into const offset channels. */
export function encodeConstOffsets(pose, baseName) {
  const rest = basePose(baseName);
  const joints = [];
  const root = [];
  for (const joint of JOINT_NAMES) {
    for (const [i, axis] of AXES.entries()) {
      const value = (pose.joints?.[joint]?.[i] || 0) - (rest.joints?.[joint]?.[i] || 0);
      if (Math.abs(value) > 1e-6) joints.push({ joint, axis, offset: +value.toFixed(6) });
    }
  }
  for (const field of ROOT_FIELDS) {
    const value = (pose.root?.[field] || 0) - (rest.root?.[field] || 0);
    if (Math.abs(value) > 1e-6) root.push({ field, offset: +value.toFixed(6) });
  }
  return { pose: baseName, joints, root };
}

export function readRigPose(mesh) {
  const pose = { root: { lift: 0, shift: 0, tiltZ: 0 }, joints: {} };
  for (const j of JOINT_NAMES) {
    const r = mesh.userData.pivots[j].rotation;
    pose.joints[j] = [r.x, r.y, r.z];
  }
  const body = mesh.userData.body || mesh;
  const height = mesh.userData.height || 1;
  pose.root = {
    lift: body.position.y / height,
    shift: body.position.x / height,
    tiltZ: body.rotation.z,
  };
  return pose;
}
