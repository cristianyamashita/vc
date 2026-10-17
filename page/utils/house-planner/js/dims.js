// Dimension labels for the selection: the item's own (local) bounding box
// drawn as a teal outline, with width, depth and height in centimetres as
// HTML labels that follow the camera.
import * as THREE from "three";
import { CM } from "./scene.js";

export class Dims {
  constructor(app) {
    this.app = app;
    this.enabled = app.prefs.showDims !== false;
    this.host = document.querySelector("#dims");
    this.labels = ["w", "d", "h"].map(() => {
      const el = document.createElement("div");
      el.className = "dim";
      el.hidden = true;
      this.host.append(el);
      return el;
    });
    this.anchors = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x008f7d, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    this.lines.renderOrder = 25;
    this.lines.visible = false;
    app.scene.overlay.add(this.lines);
    this.group = null;
  }
  setEnabled(on) {
    this.enabled = on;
    this.app.prefs.showDims = on;
    this.app.savePrefs();
    if (on && this.group) this.show(this.group);
    else this.hide();
  }
  hide() {
    this.lines.visible = false;
    for (const l of this.labels) l.hidden = true;
    this.app.scene.requestRender();
  }
  /** Outline and measure a group (its local bounding box, in world space). */
  show(group) {
    this.group = group;
    if (!group || !this.enabled) return this.hide();
    group.updateMatrixWorld(true);
    const inv = group.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    group.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (o !== group && o.material?.visible === false) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      box.union(tmp);
    });
    if (box.isEmpty()) return this.hide();
    const { min, max } = box;
    const c = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld);
    const p = [
      c(min.x, min.y, min.z), c(max.x, min.y, min.z), c(max.x, min.y, max.z), c(min.x, min.y, max.z),
      c(min.x, max.y, min.z), c(max.x, max.y, min.z), c(max.x, max.y, max.z), c(min.x, max.y, max.z),
    ];
    const edges = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    const arr = new Float32Array(edges.length * 3);
    edges.forEach((i, k) => p[i].toArray(arr, k * 3));
    this.lines.geometry.dispose();
    this.lines.geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.lines.visible = true;
    const size = box.getSize(new THREE.Vector3());
    const sx = group.getWorldScale(new THREE.Vector3());
    const dims = [size.x * sx.x, size.z * sx.z, size.y * sx.y];
    this.anchors[0].copy(p[2]).lerp(p[3], 0.5); // width: front bottom edge (max z)
    this.anchors[1].copy(p[1]).lerp(p[2], 0.5); // depth: right bottom edge (max x)
    this.anchors[2].copy(p[2]).lerp(p[6], 0.5); // height: front-right vertical edge
    const names = ["width", "depth", "height"];
    this.labels.forEach((el, i) => {
      el.textContent = `${this.app.t(names[i])[0]} ${Math.round(dims[i] * CM)} cm`;
      el.hidden = false;
    });
    this.update();
    this.app.scene.requestRender();
  }
  /** Reposition the labels (called every rendered frame). */
  update() {
    if (!this.lines.visible) return;
    const cam = this.app.scene.camera;
    const r = this.app.scene.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    this.labels.forEach((el, i) => {
      v.copy(this.anchors[i]).project(cam);
      const behind = v.z > 1;
      el.hidden = behind;
      if (behind) return;
      el.style.left = `${((v.x + 1) / 2) * r.width}px`;
      el.style.top = `${((1 - v.y) / 2) * r.height}px`;
    });
  }
}
