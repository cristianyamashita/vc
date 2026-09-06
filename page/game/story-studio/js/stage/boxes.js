import * as THREE from 'three';
import { buildGeometry, BOX_MATERIAL, toHex } from '../render/geometry.js';

// Props written as a list of boxes inside the document itself. This is the
// only prop source a visitor can author by pasting text — a .glb needs a file
// — so it is what keeps "make your own chair" open to everyone, and it uses
// the same geometry pipeline the characters do.

const cache = new Map();

function keyFor(doc) {
  return `${doc.id}|${doc.source.boxes.length}|${JSON.stringify(doc.source.boxes).length}`;
}

export function boxMesh(doc) {
  let geo = cache.get(keyFor(doc));
  if (!geo) {
    geo = buildGeometry(doc.source.boxes.map((b) => ({ ...b, color: toHex(b.color, 0xa0a0a0) })));
    cache.set(keyFor(doc), geo);
  }
  const mesh = new THREE.Mesh(geo, BOX_MATERIAL);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function clearBoxCache() {
  for (const geo of cache.values()) geo.dispose();
  cache.clear();
}
