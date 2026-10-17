// The sun: one directional light with an orthographic shadow camera fitted
// to the buildings, a hemisphere fill, and the "sun roof": an invisible slab
// over each building that only casts shadow, so a house drawn without a roof
// (or with the upper storeys cut away) is still lit only through its
// windows and doors. After story-studio js/render/sunlight.js and
// Stage.setSunRoof.
import * as THREE from "three";

const DEG = Math.PI / 180;
const SUN_LOW = new THREE.Color(0xffae6e);
const SUN_HIGH = new THREE.Color(0xfff4e0);

/** Unit vector toward the sun. Azimuth 0 = +X, 90 = +Z (clockwise seen from above). */
export function sunDirection(azimuth, elevation) {
  const az = azimuth * DEG, el = Math.max(-89, Math.min(89.9, elevation)) * DEG;
  return new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
}
/** Azimuth/elevation from local solar time, latitude and month (approximate). */
export function sunFromTime(time, latitude, month) {
  const day = Math.round((month - 0.5) * 30.4);
  const decl = 23.44 * Math.sin(((360 * (284 + day)) / 365) * DEG) * DEG;
  const lat = latitude * DEG;
  const ha = (time - 12) * 15 * DEG;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosAz = (Math.sin(decl) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) || 1e-6);
  let azN = Math.acos(Math.max(-1, Math.min(1, cosAz))); // from north, 0..180
  if (ha > 0) azN = Math.PI * 2 - azN; // afternoon: west of north
  // Scene convention: +X = east, +Z = south, so azimuth(fromEast,cw) = azN - 90°
  let azimuth = (azN / DEG - 90 + 360) % 360;
  return { azimuth: Math.round(azimuth * 10) / 10, elevation: Math.round((el / DEG) * 10) / 10 };
}

export class Sun {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xe4edf5, 0x7a7262, 1.2);
    scene.add(this.hemi);
    this.light = new THREE.DirectionalLight(0xffffff, 3);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.bias = -0.0005;
    this.light.shadow.normalBias = 0.02;
    this.light.shadow.camera.near = 0.5;
    this.light.shadow.camera.far = 200;
    scene.add(this.light);
    scene.add(this.light.target);
    this.roofs = new THREE.Group();
    this.roofs.name = "sunRoof";
    scene.add(this.roofs);
    this.bounds = new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 4, 10));
    this.dir = new THREE.Vector3(0, 1, 0);
  }
  /** Effective angles of a sun document. */
  static angles(sun) {
    if (sun.useTime) {
      const a = sunFromTime(sun.time, sun.latitude, sun.month);
      return { azimuth: a.azimuth, elevation: Math.max(2, a.elevation) };
    }
    return { azimuth: sun.azimuth, elevation: sun.elevation };
  }
  apply(sun) {
    const { azimuth, elevation } = Sun.angles(sun);
    this.dir = sunDirection(azimuth, elevation);
    const horizon = THREE.MathUtils.smoothstep(elevation, -2, 4);
    const color = SUN_LOW.clone().lerp(SUN_HIGH, THREE.MathUtils.smoothstep(elevation, 4, 35));
    this.light.color.copy(color);
    this.light.intensity = 3.2 * sun.intensity * horizon;
    this.light.castShadow = sun.shadows;
    this.hemi.intensity = 0.9 + 0.6 * sun.intensity * (0.4 + 0.6 * horizon);
    this.place();
  }
  /** Fit the shadow frustum to a Box3 (metres) of everything that matters. */
  fit(box) {
    if (box && !box.isEmpty()) this.bounds.copy(box).expandByScalar(1.5);
    this.place();
  }
  place() {
    const center = this.bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(4, this.bounds.getSize(new THREE.Vector3()).length() / 2);
    this.light.target.position.copy(center);
    this.light.position.copy(center).addScaledVector(this.dir, radius * 2.5);
    const cam = this.light.shadow.camera;
    cam.left = cam.bottom = -radius;
    cam.right = cam.top = radius;
    cam.near = 0.1;
    cam.far = radius * 5;
    cam.updateProjectionMatrix();
    this.light.target.updateMatrixWorld();
    this.light.shadow.needsUpdate = true;
  }
  /** list: [{min:[x,y,z], max:[x,y,z]}] in metres. */
  setRoofs(list) {
    const key = JSON.stringify(list || []);
    if (key === this._roofKey) return;
    this._roofKey = key;
    for (const m of [...this.roofs.children]) {
      this.roofs.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    for (const { min, max } of list || []) {
      const thick = 0.15;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.1, max[0] - min[0]), thick, Math.max(0.1, max[2] - min[2])),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
      );
      mesh.position.set((min[0] + max[0]) / 2, max[1] + thick / 2, (min[2] + max[2]) / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.raycast = () => {};
      this.roofs.add(mesh);
    }
  }
}
