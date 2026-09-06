import * as THREE from 'three';
import { boxMesh } from './boxes.js';
import { loadGltfFile, loadGltfBlob, instance } from './gltf.js';
import { toHex } from '../render/geometry.js';

// A set document becomes a scene graph, and the story's own edits are folded
// in on top of it. Every placement keeps its id, because that id is what a
// story removes, repaints or sits an actor on.

function yawRad(deg) {
  return (deg * Math.PI) / 180;
}

export async function propObject(doc, blobs) {
  if (!doc?.source) return null;
  if (doc.source.type === 'boxes') return boxMesh(doc);
  if (doc.source.type === 'gltf') return instance(await loadGltfFile(doc.source.file));
  if (doc.source.type === 'gltfBlob') {
    const blob = await blobs?.(doc.source.blobId);
    if (!blob) return null;
    return instance(await loadGltfBlob(doc.source.blobId, blob));
  }
  return null;
}

/** A visible stand-in, so a story with one missing prop still plays. A silent
 *  hole is much harder to diagnose than a magenta box where the sofa was. */
function missingMesh() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd81b60 }),
  );
  mesh.position.y = 0.25;
  return mesh;
}

function tintOf(object, color) {
  const hex = toHex(color, 0xffffff);
  object.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color.setHex(hex);
    if ('vertexColors' in o.material) o.material.vertexColors = false;
  });
}

/** Every placement a set produces, with `repeat` already expanded. */
export function expandPlacements(setDoc, setEdits = []) {
  const list = [];
  for (const pl of setDoc.props) {
    const count = pl.repeat?.count ?? 1;
    const step = pl.repeat?.step ?? [0, 0, 0];
    for (let i = 0; i < count; i++) {
      list.push({
        id: count > 1 ? `${pl.id}.${i}` : pl.id,
        group: pl.id,
        prop: pl.prop,
        at: [pl.at[0] + step[0] * i, pl.at[1] + step[1] * i, pl.at[2] + step[2] * i],
        yaw: pl.yaw,
        scale: pl.scale,
        tint: pl.tint,
      });
    }
  }

  for (const edit of setEdits) {
    if (edit.op === 'add') {
      list.push({
        id: edit.id, group: edit.id, prop: edit.prop, at: edit.at,
        yaw: edit.yaw, scale: edit.scale, tint: edit.tint,
      });
    } else if (edit.op === 'remove') {
      // A repeated placement is removed by its group name, so "remove the
      // north fence" takes out all eight panels rather than one of them.
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].id === edit.id || list[i].group === edit.id) list.splice(i, 1);
      }
    } else if (edit.op === 'tint') {
      for (const pl of list) if (pl.id === edit.id || pl.group === edit.id) pl.tint = edit.color;
    }
  }
  return list;
}

/**
 * Builds the set.
 * @returns {{ root: THREE.Group, placements: Map, anchor(id, name) }}
 */
export async function buildSet(setDoc, setEdits, resolveProp, blobs) {
  const root = new THREE.Group();
  const placements = new Map();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(setDoc.ground.size[0], setDoc.ground.size[1]),
    new THREE.MeshLambertMaterial({ color: toHex(setDoc.ground.color, 0x6d8f4a) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const list = expandPlacements(setDoc, setEdits);
  const missing = new Set();

  for (const pl of list) {
    const doc = resolveProp(pl.prop);
    // Two layers of transform, and which one an anchor lives in matters.
    // `doc.scale` / `doc.yaw` correct the model file — a chair exported at
    // ten times life size, or facing the wrong way. `anchors` and
    // `footprint` are written in the CORRECTED space, so they are placed by
    // the placement's transform only and never by the model correction.
    const holder = new THREE.Group();
    holder.position.set(pl.at[0], pl.at[1], pl.at[2]);
    holder.rotation.y = yawRad(pl.yaw);
    holder.scale.setScalar(pl.scale);

    let object = null;
    try {
      object = await propObject(doc, blobs);
    } catch (_err) {
      object = null;
    }
    if (!object) {
      missing.add(pl.prop);
      object = missingMesh();
    } else {
      if (doc.yaw) object.rotation.y = yawRad(doc.yaw);
      if (doc.scale && doc.scale !== 1) object.scale.setScalar(doc.scale);
    }
    if (pl.tint) tintOf(object, pl.tint);

    holder.add(object);
    root.add(holder);
    placements.set(pl.id, { placement: pl, doc, object: holder, scale: pl.scale });
  }

  /** World-space anchor: the prop's own anchor point, scaled, spun by the
   *  placement's yaw and moved to where the placement sits. */
  const anchor = (id, name) => {
    const entry = placements.get(id) || placements.get(`${id}.0`);
    const a = entry?.doc?.anchors?.[name];
    if (!a) return null;
    const yaw = yawRad(entry.placement.yaw);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const [ax, ay, az] = a.pos;
    const s = entry.scale;
    return {
      pos: [
        entry.placement.at[0] + (ax * cos + az * sin) * s,
        entry.placement.at[1] + ay * s,
        entry.placement.at[2] + (-ax * sin + az * cos) * s,
      ],
      // Negated on the way out, because the two conventions differ in the
      // sign of Z: a prop's `rotation.y` sends its local +X to
      // (cos, 0, -sin), while an actor's yaw is an atan2 angle facing
      // (cos, 0, sin). Passing the number straight through seats people
      // mirrored — invisible on a chair at 0° or 180°, exactly backwards at
      // 90°, which is every chair along the side of a table.
      yaw: -(entry.placement.yaw + a.yaw),
    };
  };

  return { root, placements, anchor, missing: [...missing] };
}

export function disposeSet(set) {
  set.root.traverse((o) => {
    if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose?.();
  });
}
