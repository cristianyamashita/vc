// Renderer, cameras, orbit controls, picking and the render loop.
// World units are metres (1 unit = 100 cm of the document).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const M = 0.01; // cm -> m
export const CM = 100; // m -> cm

export class Scene3D {
  constructor(canvas, host) {
    this.canvas = canvas;
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, logarithmicDepthBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.perspective = new THREE.PerspectiveCamera(45, 1, 0.05, 800);
    this.perspective.position.set(14, 11, 16);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 800);
    this.ortho.position.set(0, 120, 0);
    this.ortho.up.set(0, 0, -1);
    this.ortho.lookAt(0, 0, 0);
    this.camera = this.perspective;
    this.view = "3d";

    this.world = new THREE.Group();
    this.world.name = "world";
    this.scene.add(this.world);
    this.overlay = new THREE.Group(); // ghosts, handles, highlights
    this.scene.add(this.overlay);

    this.grid = new THREE.GridHelper(100, 100, 0x008f7d, 0x8aa39c);
    this.grid.material.opacity = 0.16;
    this.grid.material.transparent = true;
    this.grid.position.y = 0.002;
    this.scene.add(this.grid);

    this.controls = null;
    this.toolActive = false;
    this.makeControls();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.needsRender = true;
    this.onFrame = null;
    this.onTick = null; // called every frame with the elapsed seconds (walk mode)
    this.lastTime = 0;
    this.walking = false; // orbit controls stand still while walking
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  makeControls() {
    const target = this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0);
    this.controls?.dispose();
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.maxPolarAngle = Math.PI * 0.495;
    c.minDistance = 0.5;
    c.maxDistance = 400;
    c.screenSpacePanning = false;
    c.target.copy(target);
    c.enableRotate = this.view !== "top";
    c.addEventListener("change", () => this.requestRender());
    this.controls = c;
    this.applyButtons();
  }
  /** Left button orbits only while the select tool is active; right pans. */
  setToolActive(active) {
    this.toolActive = active;
    this.applyButtons();
  }
  applyButtons(forceOrbit = false) {
    this.controls.mouseButtons = {
      LEFT: this.toolActive && !forceOrbit ? null : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
  }
  setView(view) {
    if (view === this.view) return;
    this.view = view;
    this.camera = view === "top" ? this.ortho : this.perspective;
    if (view === "top") {
      this.ortho.position.set(this.controls.target.x, 120, this.controls.target.z);
      this.ortho.lookAt(this.controls.target);
    }
    this.makeControls();
    this.resize();
    this.requestRender();
  }
  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.perspective.aspect = w / h;
    this.perspective.updateProjectionMatrix();
    const span = this.ortho.userData.span || 20;
    this.ortho.left = (-span * w) / h / 2;
    this.ortho.right = (span * w) / h / 2;
    this.ortho.top = span / 2;
    this.ortho.bottom = -span / 2;
    this.ortho.updateProjectionMatrix();
    this.requestRender();
  }
  requestRender() {
    this.needsRender = true;
  }
  loop(now = 0) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (this.walking) this.onTick?.(dt);
    const moved = this.walking ? false : this.controls.update();
    if (moved || this.needsRender) {
      this.needsRender = false;
      this.onFrame?.();
      this.renderer.render(this.scene, this.camera);
    }
  }
  setBackground(dark) {
    this.scene.background = new THREE.Color(dark ? "#1c2426" : "#dfe9ec");
    this.grid.material.color.set(dark ? 0x4e6e68 : 0x8aa39c);
    this.requestRender();
  }
  /** Orbit around a point without moving the camera. */
  centerOn(point) {
    this.controls.target.copy(point);
    if (this.view === "top") {
      this.ortho.position.set(point.x, 120, point.z);
      this.ortho.lookAt(point);
    }
    this.controls.update();
    this.requestRender();
  }
  /** Frame a Box3 (metres). keepDirection keeps the current viewing angle. */
  fit(box, { keepDirection = false } = {}) {
    if (!box || box.isEmpty()) box = new THREE.Box3(new THREE.Vector3(-8, 0, -6), new THREE.Vector3(8, 3, 6));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(2, size.length() / 2);
    this.controls.target.copy(center);
    if (this.view === "top") {
      this.ortho.userData.span = radius * 2.2;
      this.ortho.position.set(center.x, 120, center.z);
      this.ortho.lookAt(center);
      this.resize();
    } else {
      const dist = radius / Math.sin((this.perspective.fov * Math.PI) / 360);
      const dir = keepDirection ? this.perspective.position.clone().sub(this.controls.target).normalize() : new THREE.Vector3(0.6, 0.55, 0.7).normalize();
      if (dir.lengthSq() < 0.01 || dir.y < 0.05) dir.set(0.6, 0.55, 0.7).normalize();
      this.perspective.position.copy(center).addScaledVector(dir, dist * 1.05);
    }
    this.controls.update();
    this.requestRender();
  }
  /** Raycaster from a pointer event. */
  ray(event) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster;
  }
  /** Intersection with a horizontal plane at y metres. Returns Vector3 or null. */
  pickPlane(event, y = 0) {
    const ray = this.ray(event).ray;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const out = new THREE.Vector3();
    return ray.intersectPlane(plane, out) ? out : null;
  }
  pickObjects(event, objects, recursive = true) {
    if (!objects.length) return [];
    return this.ray(event).intersectObjects(objects, recursive);
  }
  /**
   * Walk mode: the perspective camera is driven directly; the orbit
   * controls are disabled and the camera and target are restored on exit.
   */
  setWalking(on) {
    if (on === this.walking) return;
    this.walking = on;
    if (on) {
      this.saved = { view: this.view, pos: this.perspective.position.clone(), quat: this.perspective.quaternion.clone(), target: this.controls.target.clone() };
      if (this.view !== "3d") {
        this.view = "3d";
        this.camera = this.perspective;
        this.resize();
      }
      this.controls.enabled = false;
    } else {
      this.controls.enabled = true;
      const s = this.saved;
      if (s) {
        this.perspective.position.copy(s.pos);
        this.perspective.quaternion.copy(s.quat);
        this.controls.target.copy(s.target);
        this.view = "3d";
        if (s.view !== "3d") this.setView(s.view);
        else this.makeControls();
      }
      this.saved = null;
    }
    this.requestRender();
  }
  /** Render now and return the canvas as a PNG blob. */
  capture() {
    this.onFrame?.();
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve) => this.canvas.toBlob(resolve, "image/png"));
  }
  cameraState() {
    return { pos: this.perspective.position.toArray().map((v) => v * CM), target: this.controls.target.toArray().map((v) => v * CM) };
  }
  restoreCamera(cam) {
    if (!cam) return;
    this.perspective.position.fromArray(cam.pos.map((v) => v * M));
    this.controls.target.fromArray(cam.target.map((v) => v * M));
    this.controls.update();
    this.requestRender();
  }
}
