// Move / rotate / scale handles (three's TransformControls) attached to a
// proxy object, never to the real mesh: the proxy is read back into the
// document in centimetres and degrees, snapped, and the mesh is laid out
// from the numbers. After story-studio js/ui/setedit.js and js/ui/gizmo.js.
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { M, CM } from "./scene.js";

const DEG = Math.PI / 180;
const SPEEDS = { translate: 0.55, rotate: 0.3, scale: 0.55 };

/** Scale pointer travel so a short drag is a short move. */
function softenGizmo(gizmo) {
  const raw = gizmo._getPointer;
  if (typeof raw !== "function") return gizmo;
  let ox = 0, oy = 0;
  gizmo._getPointer = (event) => {
    const p = raw(event);
    if (!gizmo.dragging) {
      ox = p.x;
      oy = p.y;
      return p;
    }
    const f = SPEEDS[gizmo.mode] ?? 1;
    p.x = ox + (p.x - ox) * f;
    p.y = oy + (p.y - oy) * f;
    return p;
  };
  return gizmo;
}
const snapTo = (v, step) => (step ? Math.round(v / step) * step : v);

export class Gizmo {
  constructor(app) {
    this.app = app;
    const scene = app.scene;
    this.control = softenGizmo(new TransformControls(scene.camera, scene.canvas));
    this.view = typeof this.control.getHelper === "function" ? this.control.getHelper() : this.control;
    scene.scene.add(this.view);
    this.proxy = new THREE.Object3D();
    this.proxy.rotation.order = "YXZ";
    scene.scene.add(this.proxy);
    this.target = null; // {group, placement, parent}
    this.mode = "translate";
    this.control.setMode(this.mode);
    this.control.setSize(0.9);
    this.applySnap();
    this.control.addEventListener("dragging-changed", (e) => {
      scene.controls.enabled = !e.value;
      if (e.value) app.checkpoint();
      else this.commit(true);
    });
    this.control.addEventListener("objectChange", () => this.live());
    this.control.addEventListener("change", () => scene.requestRender());
    this.highlight = new THREE.BoxHelper(new THREE.Object3D(), 0x008f7d);
    this.highlight.visible = false;
    this.highlight.material.depthTest = false;
    this.highlight.renderOrder = 20;
    scene.scene.add(this.highlight);
  }
  setCamera(camera) {
    this.control.camera = camera;
  }
  applySnap() {
    const snap = this.app.state.snap;
    this.control.setTranslationSnap(snap ? this.app.project.grid.snap * M : null);
    this.control.setRotationSnap(snap ? 15 * DEG : null);
    this.control.setScaleSnap(snap ? 0.05 : null);
  }
  setMode(mode) {
    const modes = this.target?.modes;
    if (modes && !modes.includes(mode)) return;
    this.mode = mode;
    this.control.setMode(mode);
    this.control.setSpace(this.target?.adapter?.space || (mode === "rotate" ? "local" : "world"));
    this.applyAxes();
    this.app.scene.requestRender();
  }
  /**
   * Attach to a placement: group (child of parent), placement doc. An
   * `adapter` {planar, modes, apply(group, snap), rebuild} writes other
   * document shapes (stairs: at[2] + yaw; polygons: shifted points).
   */
  attach(group, placement, parent, { lockedOnly = false, adapter = null } = {}) {
    const modes = adapter?.modes || null;
    this.target = { group, placement, parent, adapter, modes, baseY: group.position.y };
    this.refreshHighlight();
    if (lockedOnly) {
      this.control.detach();
      return;
    }
    this.syncProxy();
    this.control.attach(this.proxy);
    if (modes && !modes.includes(this.mode)) this.setMode(modes[0]);
    this.applyAxes();
    this.app.scene.requestRender();
  }
  /** Planar targets slide on XZ and turn about Y only. */
  applyAxes() {
    const c = this.control;
    c.showX = c.showY = c.showZ = true;
    const adapter = this.target?.adapter;
    if (!adapter) return;
    if (adapter.axes && this.mode === "translate") {
      c.showX = !!adapter.axes.x;
      c.showY = !!adapter.axes.y;
      c.showZ = !!adapter.axes.z;
      return;
    }
    if (!adapter.planar) return;
    if (this.mode === "translate") c.showY = false;
    if (this.mode === "rotate") c.showX = c.showZ = false;
  }
  detach() {
    this.target = null;
    this.control.detach();
    this.highlight.visible = false;
    this.app.scene.requestRender();
  }
  syncProxy() {
    if (!this.target) return;
    const { group } = this.target;
    group.updateMatrixWorld(true);
    group.matrixWorld.decompose(this.proxy.position, this.proxy.quaternion, this.proxy.scale);
    this.proxy.rotation.setFromQuaternion(this.proxy.quaternion, "YXZ");
  }
  refreshHighlight() {
    if (!this.target) return;
    this.highlight.setFromObject(this.target.group);
    this.highlight.visible = true;
  }
  /** Proxy moved: lay the group out live (local to its parent). */
  live() {
    if (!this.target) return;
    const { group, parent } = this.target;
    parent.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const local = new THREE.Matrix4().compose(this.proxy.position, this.proxy.quaternion, this.proxy.scale).premultiply(inv);
    local.decompose(group.position, group.quaternion, group.scale);
    group.rotation.setFromQuaternion(group.quaternion, "YXZ");
    if (this.target.adapter?.planar) {
      group.position.y = this.target.baseY;
      group.rotation.set(0, group.rotation.y, 0);
      group.scale.set(1, 1, 1);
    }
    this.refreshHighlight();
    this.app.dims?.show(this.app.dims.group);
    this.app.scene.requestRender();
  }
  /** Write the group's local transform into the document, snapped. */
  commit(final = false) {
    if (!this.target) return;
    const { group, placement, adapter } = this.target;
    const snap = this.app.state.snap;
    const step = snap ? this.app.project.grid.snap : 0.1;
    const turn = snap ? 15 : 0.5;
    if (adapter) {
      adapter.apply(group, { step, turn, snapTo });
      this.syncProxy();
      this.refreshHighlight();
      if (final) this.app.changed({ rebuild: adapter.rebuild || "none", buildingId: adapter.buildingId || null });
      return;
    }
    placement.at = [snapTo(group.position.x * CM, step), snapTo(group.position.y * CM, step), snapTo(group.position.z * CM, step)].map((v) => Math.round(v * 10) / 10);
    placement.rotation = [snapTo(group.rotation.x / DEG, turn), snapTo(group.rotation.y / DEG, turn), snapTo(group.rotation.z / DEG, turn)].map((v) => Math.round(v * 10) / 10);
    if (this.mode === "scale") {
      const grain = snap ? 0.05 : 0.01;
      placement.scale = group.scale.toArray().map((v) => Math.round(Math.max(0.05, Math.min(50, snapTo(v, grain))) * 100) / 100);
    }
    group.position.fromArray(placement.at.map((v) => v * M));
    group.rotation.set(placement.rotation[0] * DEG, placement.rotation[1] * DEG, placement.rotation[2] * DEG, "YXZ");
    group.scale.fromArray(placement.scale);
    this.syncProxy();
    this.refreshHighlight();
    if (final) this.app.changed({ rebuild: "none", light: true });
  }
  get dragging() {
    return this.control.dragging;
  }
  get hovering() {
    return !!this.control.axis;
  }
}
