// Catalog thumbnails: each prop rendered once, offscreen, into a small
// canvas and kept as a data URL. One shared renderer for all of them,
// because browsers allow only a handful of WebGL contexts.
import * as THREE from "three";
import { propObject } from "./props.js";

const SIZE = 96;
let shared = null;
const cache = new Map();

function ensure() {
  if (shared) return shared;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 500);
  shared = { canvas, renderer, scene, camera };
  return shared;
}
export function thumbKey(doc) {
  return `${doc.id}|${doc.updatedAt || ""}|${doc.source.boxes.length}`;
}
export function invalidateThumb(id) {
  for (const k of [...cache.keys()]) if (k.startsWith(`${id}|`)) cache.delete(k);
}
/** PNG data URL for a prop document (cached). */
export function thumbnail(doc) {
  const key = thumbKey(doc);
  if (cache.has(key)) return cache.get(key);
  const { renderer, scene, camera, canvas } = ensure();
  const object = propObject(doc);
  scene.add(object);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(0.05, size.length() / 2);
  const dist = radius / Math.sin((camera.fov * Math.PI) / 360);
  camera.position.copy(center).add(new THREE.Vector3(0.75, 0.6, 1).normalize().multiplyScalar(dist * 1.08));
  camera.lookAt(center);
  camera.near = Math.max(0.01, dist * 0.05);
  camera.far = dist * 4;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = canvas.toDataURL("image/png");
  scene.remove(object);
  object.traverse((o) => {
    if (o.isMesh && !o.material.userData?.shared) o.material.dispose?.();
  });
  cache.set(key, url);
  return url;
}
