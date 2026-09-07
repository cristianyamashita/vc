import * as THREE from 'three';
import { propObject } from '../stage/build.js';

// Little pictures of objects, for the palette in the visual set editor.
//
// A palette of ninety-seven names is a list you read; a palette of ninety-
// seven pictures is one you browse, and browsing is the whole point of
// picking furniture. So each prop is rendered once, offscreen, into a small
// canvas and kept as a data URL.
//
// One renderer and one scene are shared by every thumbnail. Ninety-seven
// WebGL contexts would exhaust the browser's limit long before the list
// finished drawing — that limit is around sixteen — so this is not an
// optimisation, it is the only way it works at all.

const SIZE = 96;

let shared = null;

function ensure() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x707868, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-6, 10, 8);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
  shared = { canvas, renderer, scene, camera };
  return shared;
}

/**
 * Renders one prop and hands back a PNG data URL.
 *
 * The camera is framed from the object's own bounding box rather than from a
 * fixed distance: these props run from a 6 cm mug to a nine-metre volleyball
 * net, and one distance cannot show both.
 */
export async function thumbnail(doc, blobs) {
  const { renderer, scene, camera, canvas } = ensure();
  let object = null;
  try {
    object = await propObject(doc, blobs);
  } catch (_err) {
    object = null;
  }
  if (!object) return null;

  if (doc.yaw) object.rotation.y = (doc.yaw * Math.PI) / 180;
  if (doc.scale && doc.scale !== 1) object.scale.setScalar(doc.scale);
  scene.add(object);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) || 1;
  const dist = span * 1.9;
  camera.position.set(centre.x + dist * 0.72, centre.y + dist * 0.58, centre.z + dist * 0.72);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');

  scene.remove(object);
  // Only the material clones and per-instance geometry: the box cache owns
  // the geometry it hands out, and disposing that here would empty the very
  // cache the stage is about to draw from.
  object.traverse((o) => {
    if (o.isMesh && o.material && o.material.__thumbClone) o.material.dispose();
  });
  return url;
}

/** Frees the shared context. The editor is a page you leave. */
export function disposeThumbs() {
  if (!shared) return;
  shared.renderer.dispose();
  shared = null;
}
