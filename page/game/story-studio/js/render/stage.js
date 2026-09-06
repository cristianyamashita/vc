import * as THREE from 'three';

// The renderer, the lights and the sky. One of these exists per canvas, and
// the library's little turntable preview uses the same class as the player,
// so there is only one place where lighting is decided.

const SKIES = {
  day: { top: 0x8fbfe8, bottom: 0xdaeaf5, sun: 0xfff4e0, ambient: 0x9fb4c8, intensity: 1.0, fog: 0xcfe1ee },
  dawn: { top: 0x6d84b4, bottom: 0xf0c9a0, sun: 0xffd9a8, ambient: 0x8f8ea8, intensity: 0.85, fog: 0xe7c7ac },
  dusk: { top: 0x3c4a72, bottom: 0xe09a6a, sun: 0xffb87a, ambient: 0x6a6a90, intensity: 0.72, fog: 0xc79a80 },
  night: { top: 0x0e1526, bottom: 0x1c2740, sun: 0xb9c8ee, ambient: 0x3a4460, intensity: 0.34, fog: 0x18213a },
};

export const SKY_NAMES = Object.keys(SKIES);

export class Stage {
  constructor(canvas, { shadows = true, fog = true } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.useFog = fog;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x40492f, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(-12, 22, 9);
    if (shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const c = this.sun.shadow.camera;
      c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 70;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.content = new THREE.Group();
    this.scene.add(this.content);
    this.setSky('day');
    this._look = new THREE.Vector3();
    this._fov = 50;
  }

  setSky(name, intensity = 1) {
    const s = SKIES[name] || SKIES.day;
    this.sky = name in SKIES ? name : 'day';
    this.scene.background = new THREE.Color(s.bottom);
    this.scene.fog = this.useFog ? new THREE.Fog(s.fog, 30, 140) : null;
    this.hemi.color.setHex(s.top);
    this.hemi.groundColor.setHex(s.bottom);
    this.hemi.intensity = 0.7 * s.intensity * intensity;
    this.sun.color.setHex(s.sun);
    this.sun.intensity = 1.25 * s.intensity * intensity;
  }

  setSunDirection(dir) {
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    this.sun.position.set((dir[0] / len) * 26, (dir[1] / len) * 26, (dir[2] / len) * 26);
  }

  /** Points the camera, and keeps the shadow frustum near whatever it is
   *  looking at — a fixed frustum loses its shadows the moment a story walks
   *  someone to the far end of a street. */
  aim(at, look, fov) {
    this.camera.position.set(at[0], at[1], at[2]);
    this._look.set(look[0], look[1], look[2]);
    this.camera.lookAt(this._look);
    if (fov) this._fov = fov;
    this.applyFov();
    this.sun.target.position.copy(this._look);
    this.sun.position.set(this._look.x - 12, this._look.y + 22, this._look.z + 9);
  }

  /**
   * Three's `fov` is VERTICAL, so a story framed on a wide screen loses its
   * sides on a phone held upright — the shot the author composed is simply
   * not what a portrait viewer sees. So the authored fov is treated as the
   * framing at 16:9, and the vertical angle is widened on narrower screens to
   * hold the same horizontal field. The cap stops a very tall window from
   * filling itself with sky and grass.
   */
  applyFov() {
    const ref = 16 / 9;
    const aspect = this.camera.aspect || ref;
    let fov = this._fov;
    if (aspect < ref) {
      const half = Math.tan((this._fov * Math.PI) / 360) * ref;
      fov = Math.min(this._fov * 1.75, (2 * Math.atan(half / aspect) * 180) / Math.PI);
    }
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyFov();
    this.camera.updateProjectionMatrix();
    return { w, h };
  }

  clearContent() {
    for (let i = this.content.children.length - 1; i >= 0; i--) {
      this.content.remove(this.content.children[i]);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
