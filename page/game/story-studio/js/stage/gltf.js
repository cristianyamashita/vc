import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// glTF props. Loaded once per file and cloned per placement, so a fence
// repeated twenty times along a wall is one download and one set of buffers.
//
// Two sources are supported: a .glb shipped with the app, and a .glb a
// visitor uploaded, which lives as a Blob in IndexedDB and is handed to the
// loader through an object URL.

const loader = new GLTFLoader();
const files = new Map();      // path or blob id -> Promise<THREE.Group>

const BASE = new URL('../../', import.meta.url);

function prepare(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return scene;
}

export function loadGltfFile(file) {
  if (!files.has(file)) {
    const url = new URL(file, BASE).href;
    files.set(file, loader.loadAsync(url).then((g) => prepare(g.scene)));
  }
  return files.get(file);
}

export function loadGltfBlob(blobId, blob) {
  if (!files.has(blobId)) {
    const url = URL.createObjectURL(blob);
    files.set(blobId, loader.loadAsync(url)
      .then((g) => prepare(g.scene))
      .finally(() => URL.revokeObjectURL(url)));
  }
  return files.get(blobId);
}

export function hasGltf(key) {
  return files.has(key);
}

/** A fresh instance sharing the original's geometry and materials. */
export function instance(scene) {
  return scene.clone(true);
}

export function clearGltfCache() {
  files.clear();
}

export { THREE };
