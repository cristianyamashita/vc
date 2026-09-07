import * as THREE from 'three';
import { buildGeometry, BOX_MATERIAL, toHex } from '../render/geometry.js';
import { buildBody, DEFAULT_HEIGHT, planOf } from './body.js';
import { resolvePaint, resolveFit, sprayCells } from './wardrobe.js';
import { JOINT_ORDER, jointParent } from './rig.js';
import { contactPoints, jointChain } from '../anim/ground.js';

// A character document becomes a rigged THREE.Group: one mesh per joint,
// nested so that bending the chest carries the head and both arms with it.

/** Body regions a document may sculpt, and the edge each one grows away from.
 *  A limb hangs from its joint, so it lengthens downward; a head and a foot
 *  grow up off their base; everything else swells about its own middle. */
const REGION_ANCHOR = {
  head: 'min',
  hair: 'min',
  eyes: 'center',
  torso: 'center',
  belly: 'center',
  bust: 'center',
  arms: 'max',
  hands: 'max',
  legs: 'max',
  feet: 'min',
};

export const REGION_KEYS = Object.keys(REGION_ANCHOR);

const SCALE_MIN = 0.5;
const SCALE_MAX = 2.0;

function clampScale(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, n));
}

function readScale(entry) {
  if (Array.isArray(entry)) return entry.slice(0, 3).map(clampScale);
  if (entry && typeof entry === 'object' && Array.isArray(entry.scale)) {
    return entry.scale.slice(0, 3).map(clampScale);
  }
  if (typeof entry === 'number') {
    const s = clampScale(entry);
    return [s, s, s];
  }
  return null;
}

/**
 * Applies a document's per-region sculpt in place.
 *
 * The scale is taken about the region's own bounding box rather than about
 * each box's own centre: a head made 1.2x tall should rise as one piece, not
 * scatter its hair, ears and nose apart from the skull.
 */
export function applyRegions(parts, regions) {
  if (!regions || typeof regions !== 'object') return parts;
  for (const [key, entry] of Object.entries(regions)) {
    const anchor = REGION_ANCHOR[key];
    if (!anchor) continue;
    const scale = readScale(entry);
    if (!scale) continue;
    const [sx, sy, sz] = scale;
    if (sx === 1 && sy === 1 && sz === 1) continue;

    const boxes = parts.filter((b) => b.reg === key);
    if (!boxes.length) continue;

    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    for (const b of boxes) {
      minY = Math.min(minY, b.y - b.h / 2);
      maxY = Math.max(maxY, b.y + b.h / 2);
      sumX += b.x;
    }
    const originY = anchor === 'min' ? minY : anchor === 'max' ? maxY : (minY + maxY) / 2;
    const originX = sumX / boxes.length;

    for (const b of boxes) {
      b.w *= sx;
      b.h *= sy;
      b.d *= sz;
      b.x = originX + (b.x - originX) * sx;
      b.y = originY + (b.y - originY) * sy;
      b.z *= sz;                     // mirrored pairs stay mirrored
      if (b.joint) b.joint = null;
    }
  }
  return parts;
}

/** Fills in the defaults a sparse character document leaves out. */
export function normaliseCharacter(doc) {
  const base = planOf(doc?.base);
  return {
    base,
    height: Number.isFinite(doc?.height) && doc.height > 0 ? doc.height : DEFAULT_HEIGHT[base],
    build: Number.isFinite(doc?.build) ? doc.build : 0.5,
    bust: Number.isFinite(doc?.bust) ? doc.bust : undefined,
    look: doc?.look || {},
    regions: doc?.regions || null,
  };
}

/** The wardrobe entry an actor should wear, by id, falling back sensibly. */
export function outfitEntry(doc, wanted) {
  const list = Array.isArray(doc?.wardrobe) ? doc.wardrobe : [];
  if (!list.length) return { id: 'default', outfit: 'casual', color: '#2a5caa' };
  const byId = wanted && list.find((w) => w?.id === wanted);
  if (byId) return byId;
  const fallback = doc.defaultOutfit && list.find((w) => w?.id === doc.defaultOutfit);
  return fallback || list[0];
}

/** The box list for one character in one outfit, sculpt applied. */
export function characterParts(doc, outfitId) {
  const spec = normaliseCharacter(doc);
  const wear = outfitEntry(doc, outfitId);
  // Which paint the entry wears, and therefore what colour it is. An entry
  // that names a paint takes that paint's colour; one that does not keeps
  // its own, which is how every character written before outfits had paints
  // still says what colour their shirt is.
  const paint = resolvePaint(wear.outfit, wear.paint);
  const body = buildBody({
    base: spec.base,
    height: spec.height,
    build: spec.build,
    bust: spec.bust,
    outfit: wear.outfit,
    color: wear.paint && paint ? paint.color : wear.color,
    fit: resolveFit(wear.outfit),
    paint: sprayCells(paint),
    look: spec.look,
  });
  applyRegions(body.parts, spec.regions);
  return body;
}

/**
 * Builds the rigged mesh. Returns the root group plus its pivot table, which
 * is what the animation layer writes joint rotations into.
 */
export function buildCharacter(doc, outfitId) {
  const { parts, joints, height } = characterParts(doc, outfitId);

  const byLimb = new Map();
  for (const b of parts) {
    const key = joints[b.limb] ? b.limb : 'hips';
    if (!byLimb.has(key)) byLimb.set(key, []);
    byLimb.get(key).push(b);
  }

  // Two groups, not one: the outer root carries the actor's place in the
  // world and the direction it faces, while the inner body carries the pose's
  // own tilt and lift. Keeping them apart is what lets a pose lay a character
  // on its back without the walk track having to know about it.
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pivots = {};

  // Parents before children, so every pivot has somewhere to attach.
  for (const name of JOINT_ORDER) {
    const joint = joints[name];
    if (!joint) continue;
    const pivot = new THREE.Group();
    // The ground clamp walks this same chain on the CPU, so the two have to
    // agree on how three axes compose. Stated here rather than left to the
    // library default.
    pivot.rotation.order = 'YXZ';
    const parentName = jointParent(name);
    const parentJoint = parentName ? joints[parentName] : null;
    pivot.position.set(
      joint.x - (parentJoint?.x ?? 0),
      joint.y - (parentJoint?.y ?? 0),
      joint.z - (parentJoint?.z ?? 0),
    );
    const list = byLimb.get(name);
    if (list?.length) {
      const geo = buildGeometry(list.map((b) => ({
        ...b,
        x: b.x - joint.x,
        y: b.y - joint.y,
        z: b.z - joint.z,
      })));
      const mesh = new THREE.Mesh(geo, BOX_MATERIAL);
      mesh.castShadow = true;
      pivot.add(mesh);
    }
    (parentName && pivots[parentName] ? pivots[parentName] : body).add(pivot);
    pivots[name] = pivot;
  }

  root.userData.pivots = pivots;
  root.userData.body = body;
  root.userData.height = height;
  root.userData.hipY = joints.hips.y;
  root.userData.contacts = contactPoints(parts, joints);
  root.userData.chain = jointChain(joints);
  return root;
}

/** Frees the per-character geometry. Materials are shared and stay. */
export function disposeCharacter(root) {
  root.traverse((o) => {
    if (o.isMesh) o.geometry?.dispose();
  });
}

export { toHex };
