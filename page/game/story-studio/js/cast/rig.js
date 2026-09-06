// The skeleton every character shares. VoxelCraft's humans have six joints
// (two arms, two thighs, two shins), which is enough to walk and nothing
// else. Sitting needs a hip bend that does not drag the torso through the
// chair, a push-up needs elbows, a sit-up needs a waist, and looking at
// another actor needs a neck. So the tree here is thirteen joints deep.
//
// The tree is the shape only. Where each joint actually sits depends on the
// body plan and the character's height, so `cast/body.js` supplies the rest
// positions and this module never hard-codes a measurement.
//
// Axis convention, inherited from the forked model code: a character faces
// +X, up is +Y, and its left and right sides are ±Z. That makes
//   rotation.z  the forward/back swing (a stride, a bow, a curl)
//   rotation.x  the sideways swing (arms out in a jumping jack)
//   rotation.y  the twist (a head turning to look at someone)
// and the root group's rotation.y the direction the character faces.

export const JOINTS = [
  { name: 'hips', parent: null },
  { name: 'chest', parent: 'hips' },
  { name: 'neck', parent: 'chest' },
  { name: 'head', parent: 'neck' },
  { name: 'lArm', parent: 'chest' },
  { name: 'lFore', parent: 'lArm' },
  { name: 'lHand', parent: 'lFore' },
  { name: 'rArm', parent: 'chest' },
  { name: 'rFore', parent: 'rArm' },
  { name: 'rHand', parent: 'rFore' },
  { name: 'lThigh', parent: 'hips' },
  { name: 'lShin', parent: 'lThigh' },
  { name: 'lFoot', parent: 'lShin' },
  { name: 'rThigh', parent: 'hips' },
  { name: 'rShin', parent: 'rThigh' },
  { name: 'rFoot', parent: 'rShin' },
];

export const JOINT_NAMES = JOINTS.map((j) => j.name);

const BY_NAME = new Map(JOINTS.map((j) => [j.name, j]));

export function jointParent(name) {
  return BY_NAME.get(name)?.parent ?? null;
}

export function isJoint(name) {
  return BY_NAME.has(name);
}

/** Joints ordered parents-before-children, so a builder can attach each one
 *  to a pivot that already exists. */
export const JOINT_ORDER = (() => {
  const out = [];
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    const parent = jointParent(name);
    if (parent) visit(parent);
    seen.add(name);
    out.push(name);
  };
  for (const j of JOINTS) visit(j.name);
  return out;
})();

/** Left/right mirror of a joint name, for poses that only spell out one side. */
export function mirrorJoint(name) {
  if (name.startsWith('l')) return `r${name.slice(1)}`;
  if (name.startsWith('r')) return `l${name.slice(1)}`;
  return name;
}
