import * as THREE from 'three';
import { BLOCKS, ITEMS, isBlock } from './blocks.js';
import { itemMesh, isBlockMesh } from './itemmodels.js';
import { isOriginal } from './quality.js';

// Inventory icons are rendered from the item's own 3D model rather than drawn
// by hand, so the picture in the slot is always the object you get. Runs once,
// at startup, on a throwaway renderer.

const SIZE = 112;

// Blocks get the familiar three-quarter cube; most items are turned and tilted
// like a tool in the hand. Plate-shaped items (hides, doors) are the exception:
// seen edge-on they are just a sliver, so they are viewed down their thin axis.
const BLOCK_DIR = new THREE.Vector3(1, 0.82, 1);
const ITEM_DIR = new THREE.Vector3(0.34, 0.22, 1);

// Hafted tools always get the three-quarter pose: their heads are plates too,
// but seen flat-on they read as a flag on a stick rather than a tool.
const HAFTED = new Set(['pickaxe', 'axe', 'shovel', 'sword']);

function poseFor(id, size) {
  if (isBlockMesh(id)) return { dir: BLOCK_DIR, spin: 0, tilt: 0, pad: 1.08 };
  const tool = { dir: ITEM_DIR, spin: -0.5, tilt: -0.62, pad: 1.08 };
  if (HAFTED.has(ITEMS[id]?.tool)) return tool;
  const dims = [size.x, size.y, size.z];
  const sorted = [...dims].sort((a, b) => a - b);
  if (sorted[0] < sorted[1] * 0.4) {
    const dir = new THREE.Vector3(0.28, 0.3, 0.28);
    dir.setComponent(dims.indexOf(sorted[0]), 1);
    return { dir, spin: 0, tilt: 0, pad: 1.08 };
  }
  return tool;
}

/**
 * Renders one icon per item into `atlas.icons` under `item:<id>`.
 * Falls back silently to the existing tile icons if WebGL is unavailable.
 */
export function renderItemIcons(atlas) {
  if (!atlas) return;
  // Original graphics keep the drawn icons that createAtlas already made.
  for (const key of Object.keys(atlas.icons)) {
    if (key.startsWith('item:')) delete atlas.icons[key];
  }
  if (isOriginal()) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return;
  }
  renderer.setSize(SIZE, SIZE, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff4e2, 2.05);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.75);
  const amb = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(key, fill, amb);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
  const holder = new THREE.Group();
  scene.add(holder);

  const box = new THREE.Box3();
  const centre = new THREE.Vector3();
  const extent = new THREE.Vector3();

  for (const id of iconIds()) {
    const mesh = itemMesh(id, { full: true });
    if (!mesh) continue;

    // Measure the model unposed, so the pose can be chosen from its shape.
    holder.rotation.set(0, 0, 0);
    holder.add(mesh);
    holder.updateMatrixWorld(true);
    box.setFromObject(mesh);
    box.getSize(extent);
    const pose = poseFor(id, extent);

    holder.rotation.set(pose.tilt, 0, pose.spin);
    holder.updateMatrixWorld(true);
    box.setFromObject(mesh);
    box.getCenter(centre);

    camera.position.copy(pose.dir).normalize().multiplyScalar(12).add(centre);
    camera.lookAt(centre);
    camera.updateMatrixWorld(true);
    key.position.copy(camera.position).add(new THREE.Vector3(-2, 5, 2));
    fill.position.set(-camera.position.x, 1, -camera.position.z);

    // Frame on the model's real silhouette. Its bounding box would drag in
    // empty corners and leave long diagonal items adrift in a small icon.
    const seen = measure(mesh, camera);
    const cx = (seen.minX + seen.maxX) * 0.5;
    const cy = (seen.minY + seen.maxY) * 0.5;
    const half = Math.max(seen.maxX - seen.minX, seen.maxY - seen.minY, 0.02) * 0.5 * pose.pad;
    camera.left = cx - half;
    camera.right = cx + half;
    camera.top = cy + half;
    camera.bottom = cy - half;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    atlas.icons[`item:${id}`] = renderer.domElement.toDataURL();

    holder.remove(mesh);
  }

  renderer.dispose();
  renderer.forceContextLoss?.();
}

// The model's exact extents in camera space, from its own vertices.
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

function measure(mesh, camera) {
  const pos = mesh.geometry.getAttribute('position');
  _m.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
    if (_v.x < minX) minX = _v.x;
    if (_v.x > maxX) maxX = _v.x;
    if (_v.y < minY) minY = _v.y;
    if (_v.y > maxY) maxY = _v.y;
  }
  return { minX, maxX, minY, maxY };
}

function iconIds() {
  const ids = new Set();
  for (const k of Object.keys(ITEMS)) ids.add(Number(k));
  for (const k of Object.keys(BLOCKS)) {
    const id = Number(k);
    if (isBlock(id)) ids.add(id);
  }
  return ids;
}
