import * as THREE from 'three';
import { buildGeometry, BOX_MATERIAL, toHex } from '../render/geometry.js';

// Props written as a list of boxes inside the document itself. This is the
// only prop source a visitor can author by pasting text — a .glb needs a file
// — so it is what keeps "make your own chair" open to everyone, and it uses
// the same geometry pipeline the characters do.

// One entry per prop id, rebuilt when the boxes actually change.
//
// The key is the boxes themselves, not a stand-in for them. It used to be the
// id plus the box count plus the *length* of their JSON — and "#ff0000" and
// "#00ff00" are the same length, so editing a colour handed back the geometry
// built from the old one. The change appeared only after a reload, which
// emptied this map. Any key that summarises the content instead of being it
// has that failure somewhere; this one had it exactly where authors work.
const cache = new Map();      // prop id -> { key, geo }

function keyFor(doc) {
  return JSON.stringify(doc.source.boxes);
}

export function boxMesh(doc) {
  const key = keyFor(doc);
  let entry = cache.get(doc.id);
  if (!entry || entry.key !== key) {
    // The replaced geometry is dropped rather than disposed: meshes already
    // in a scene may still be drawing it, and a disposed geometry draws as
    // nothing at all. Keeping one entry per id bounds the map anyway.
    entry = {
      key,
      geo: buildGeometry(doc.source.boxes.map((b) => ({ ...b, color: toHex(b.color, 0xa0a0a0) }))),
    };
    cache.set(doc.id, entry);
  }
  const material = BOX_MATERIAL.clone();
  material.transparent = (doc.opacity ?? 1) < 1;
  material.opacity = doc.opacity ?? 1;
  const mesh = new THREE.Mesh(entry.geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function clearBoxCache() {
  for (const entry of cache.values()) entry.geo.dispose();
  cache.clear();
}
