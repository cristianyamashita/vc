import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Still } from '../render/still.js';
import { thumbnail } from './thumbs.js';
import { JOINT_NAMES, jointParent } from '../cast/rig.js';
import { poseFromPosition, readRigPose, lookFromCamera } from '../anim/position.js';
import { scaleTriple } from '../stage/build.js';
import { localised, t } from '../i18n.js';
import { validate } from '../script/schema.js';
import { SKY_NAMES } from '../render/stage.js';
import { toHex } from '../render/geometry.js';

const DEG = Math.PI / 180;
const VIEW_STORE = 'storyStudio.staticView';
const CHAR_ROW = 'character';
const END_CHAINS = {
  lHand: ['lFore', 'lArm'], rHand: ['rFore', 'rArm'],
  lFoot: ['lShin', 'lThigh'], rFoot: ['rShin', 'rThigh'],
};

function snapTo(v, step) {
  return Math.round(v / step) * step;
}
function degrees(rad) {
  return rad / DEG;
}
const copy = (v) => JSON.parse(JSON.stringify(v));

export class StaticStoryEditor {
  constructor(root, { registry, onSave, onBack, partsFor }) {
    this.root = root;
    this.registry = registry;
    this.onSave = onSave;
    this.onBack = onBack;
    this.partsFor = partsFor;
    this.doc = null;
    this.pageIndex = 0;
    this.selected = null;
    this.mode = 'translate';
    this.freeLook = true;
    this.poseMode = false;
    this.poseJoint = 'rHand';
    this.poseDragging = false;
    this.active = false;
    this.saveTimer = 0;
    this.viewTimer = 0;
    this.thumbCache = new Map();
    this.tab = CHAR_ROW;
    this._orbitKey = null;
    this.rigDragging = false;
    this.rigStart = null;

    this.canvas = root.querySelector('#ss-static-canvas');
    this.wrap = root.querySelector('#ss-static-stage');
    this.paletteEl = root.querySelector('#ss-static-palette');
    this.searchEl = root.querySelector('#ss-static-search');
    this.listEl = root.querySelector('#ss-static-list');
    this.propsEl = root.querySelector('#ss-static-props');
    this.statusEl = root.querySelector('#ss-static-status');
    this.stripEl = root.querySelector('#ss-static-strip');
    this.titleEl = root.querySelector('#ss-static-title');

    this.still = new Still(this.canvas, root.querySelector('#ss-static-labels'));
    this.orbit = new OrbitControls(this.still.stage.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.gizmo = new TransformControls(this.still.stage.camera, this.canvas);
    this.gizmo.setMode('translate');
    this.gizmoView = typeof this.gizmo.getHelper === 'function' ? this.gizmo.getHelper() : this.gizmo;
    this.still.stage.scene.add(this.gizmoView);
    this.proxy = new THREE.Object3D();
    this.proxy.rotation.order = 'YXZ';
    this.still.stage.scene.add(this.proxy);
    this.camHelper = this.makeCameraHelper();
    this.still.stage.scene.add(this.camHelper);
    this.lampGroup = new THREE.Group();
    this.still.stage.scene.add(this.lampGroup);
    this.lampHelpers = new Map();
    this.markerGroup = new THREE.Group();
    this.still.stage.scene.add(this.markerGroup);
    this.markers = [];
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.initCamRig();

    this.bind();
  }

  makeCameraHelper() {
    const group = new THREE.Group();
    group.userData.kind = 'camera';
    group.userData.id = 'camera';
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x008f7d }),
    );
    const lens = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.28, 12),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.28;
    group.add(body, lens);
    group.visible = false;
    return group;
  }

  makeLampHelper(id) {
    const group = new THREE.Group();
    group.userData.kind = 'lamp';
    group.userData.lampId = id;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    group.add(core, glow);
    return group;
  }

  initCamRig() {
    this.rigWrap = this.root.querySelector('#ss-static-camrig');
    this.rigCanvas = this.root.querySelector('#ss-static-camrig-canvas');
    if (!this.rigWrap || !this.rigCanvas) return;
    this.rigWrap.setAttribute('aria-label', t('editCamera'));
    this.rigRenderer = new THREE.WebGLRenderer({ canvas: this.rigCanvas, antialias: true, alpha: true });
    this.rigRenderer.setClearColor(0x000000, 0);
    this.rigScene = new THREE.Scene();
    this.rigCam = new THREE.PerspectiveCamera(50, 1, 0.1, 40);
    this.rigCam.position.set(2.2, 1.7, 2.2);
    this.rigCam.lookAt(0, 0, 0);
    this.rigScene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(2, 4, 3);
    this.rigScene.add(sun);
    // Root stays unrotated so translate stays in world axes; orient holds yaw/pitch.
    this.rigRoot = new THREE.Object3D();
    this.rigOrient = new THREE.Object3D();
    this.rigOrient.rotation.order = 'YXZ';
    this.rigRoot.add(this.rigOrient);
    const helper = this.makeCameraHelper();
    helper.visible = true;
    this.rigOrient.add(helper);
    this.rigScene.add(this.rigRoot);
    this.rigTarget = this.rigRoot;
    this.rigGizmo = new TransformControls(this.rigCam, this.rigCanvas);
    this.rigGizmo.setMode('translate');
    this.rigGizmo.setSpace('world');
    this.rigGizmo.setSize(2.1);
    this.rigGizmoView = typeof this.rigGizmo.getHelper === 'function' ? this.rigGizmo.getHelper() : this.rigGizmo;
    this.rigScene.add(this.rigGizmoView);
    this.rigGizmo.attach(this.rigRoot);
    this.rigGizmo.addEventListener('dragging-changed', (e) => {
      this.rigDragging = !!e.value;
      if (e.value) this.captureRigStart();
      else this.finishRigDrag();
    });
    this.rigGizmo.addEventListener('objectChange', () => this.applyRig());
    this.rigWrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  bind() {
    this.root.querySelector('#ss-static-move').addEventListener('click', () => this.setMode('translate'));
    this.root.querySelector('#ss-static-rotate').addEventListener('click', () => this.setMode('rotate'));
    this.root.querySelector('#ss-static-scale').addEventListener('click', () => this.setMode('scale'));
    this.root.querySelector('#ss-static-shot').addEventListener('click', () => this.toggleFreeLook());
    this.root.querySelector('#ss-static-page-new').addEventListener('click', () => this.addPage(false));
    this.root.querySelector('#ss-static-page-dup').addEventListener('click', () => this.addPage(true));
    this.root.querySelector('#ss-static-page-left').addEventListener('click', () => this.movePage(-1));
    this.root.querySelector('#ss-static-page-right').addEventListener('click', () => this.movePage(1));
    this.root.querySelector('#ss-static-page-hide').addEventListener('click', () => this.toggleHide());
    this.root.querySelector('#ss-static-page-del').addEventListener('click', () => this.deletePage());
    this.searchEl.addEventListener('input', () => this.renderPalette());
    for (const b of this.root.querySelectorAll('.ss-static-tabs button')) {
      b.addEventListener('click', () => {
        this.tab = b.dataset.kind;
        for (const x of this.root.querySelectorAll('.ss-static-tabs button')) x.classList.toggle('is-active', x === b);
        this.renderPalette();
      });
    }
    this.canvas.addEventListener('pointerdown', (e) => this.onPick(e));
    this.wrap.addEventListener('dragover', (e) => e.preventDefault());
    this.wrap.addEventListener('drop', (e) => this.onDrop(e));
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = this.freeLook && !e.value;
      if (this.poseMode) {
        this.poseDragging = e.value;
        if (!e.value) this.commitPose();
      } else if (!e.value) this.commitProxy();
    });
    this.gizmo.addEventListener('objectChange', () => {
      if (this.poseMode) {
        if (this.poseMove) this.solvePoseDrag();
        this.updateMarkers();
      } else this.commitProxy();
    });
    this.orbit.addEventListener('change', () => {
      if (!this.freeLook || !this.active) return;
      clearTimeout(this.viewTimer);
      this.viewTimer = setTimeout(() => this.persistView(), 250);
    });
    this.keys = (e) => {
      if (!this.active || !this.doc || e.target.closest('input,select,textarea')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'm') {
        e.preventDefault();
        this.setMode('translate');
      } else if (key === 'r') {
        e.preventDefault();
        this.setMode('rotate');
      } else if (key === 's') {
        e.preventDefault();
        this.setMode('scale');
      } else if (e.key === 'Escape' && this.poseMode) {
        e.preventDefault();
        e.stopPropagation();
        this.clearPoseJoint();
      }
    };
    addEventListener('keydown', this.keys, true);
  }

  async leave() {
    await this.flushSave();
    this.onBack();
  }

  page() {
    return this.doc?.pages[this.pageIndex] || null;
  }

  async load(doc, pageId) {
    this.doc = copy(doc);
    if (!this.doc.pages?.length) {
      this.doc.pages = [this.blankPage()];
    }
    const fromId = pageId ? this.doc.pages.findIndex((p) => p.id === pageId) : 0;
    this.pageIndex = fromId >= 0 ? fromId : 0;
    this.selected = null;
    this.poseMode = false;
    this._orbitKey = null;
    this.restoreFreeLookFlag();
    this.titleEl.textContent = localised(this.doc.name, this.doc.id);
    this.renderPalette();
    await this.reloadPage();
    this.renderStrip();
    this.report(t('staticAutosave'));
  }

  blankPage() {
    const cur = this.page();
    return {
      id: `p${Date.now().toString(36)}`,
      hidden: false,
      set: cur?.set || 'studio',
      sky: cur?.sky || 'day',
      light: { intensity: cur?.light?.intensity ?? 1 },
      camera: copy(cur?.camera || { at: [8, 4, 8], yaw: -45, pitch: -18, fov: 50 }),
      cast: [],
      props: [],
      lamps: [],
    };
  }

  async reloadPage() {
    const page = this.page();
    if (!page) return;
    if (this.poseMode) {
      this.poseMode = false;
      this.markerGroup.visible = false;
    }
    this.gizmo.detach();
    await this.still.load(page, this.registry);
    this.layoutCameraHelper();
    this.layoutLamps();
    this.camHelper.visible = this.freeLook;
    this.orbit.enabled = this.freeLook;
    if (this.freeLook) {
      if (!this.applyStoredOrbit()) this.frameOrbit();
    } else {
      this.still.aimPage();
    }
    this._orbitKey = this.viewKey();
    this.syncCamRig();
    this.renderList();
    this.renderProps();
    this.select(this.selected);
    this.still.render();
  }

  frameOrbit() {
    const page = this.page();
    if (!page) return;
    const look = lookFromCamera(page.camera);
    this.orbit.target.set(look[0], look[1], look[2]);
    this.still.stage.camera.position.set(page.camera.at[0] + 4, page.camera.at[1] + 2, page.camera.at[2] + 4);
    this.orbit.update();
  }

  layoutCameraHelper() {
    const cam = this.page()?.camera;
    if (!cam) return;
    this.camHelper.position.set(cam.at[0], cam.at[1], cam.at[2]);
    this.camHelper.rotation.set((cam.pitch || 0) * DEG, (cam.yaw || 0) * DEG, 0, 'YXZ');
    this.syncRigPose(false);
  }

  layoutLamps() {
    const page = this.page();
    const wanted = new Set((page?.lamps || []).map((l) => l.id));
    for (const [id, helper] of [...this.lampHelpers.entries()]) {
      if (wanted.has(id)) continue;
      this.lampGroup.remove(helper);
      this.lampHelpers.delete(id);
    }
    for (const lamp of page?.lamps || []) {
      let helper = this.lampHelpers.get(lamp.id);
      if (!helper) {
        helper = this.makeLampHelper(lamp.id);
        this.lampHelpers.set(lamp.id, helper);
        this.lampGroup.add(helper);
      }
      helper.position.set(lamp.at[0], lamp.at[1], lamp.at[2]);
      const hex = toHex(lamp.color, 0xffd9a0);
      for (const child of helper.children) {
        if (child.material?.color) child.material.color.setHex(hex);
      }
      helper.visible = !this.poseMode;
    }
  }

  viewKey() {
    return `${this.doc?.id || ''}::${this.page()?.id || ''}`;
  }

  readViewStore() {
    try { return JSON.parse(localStorage.getItem(VIEW_STORE) || '{}'); }
    catch { return {}; }
  }

  persistView() {
    if (!this.doc) return;
    try {
      const store = this.readViewStore();
      store.freeLook = this.freeLook;
      if (this.freeLook && this._orbitKey) {
        store.pages = store.pages || {};
        store.pages[this._orbitKey] = {
          pos: this.still.stage.camera.position.toArray(),
          target: this.orbit.target.toArray(),
        };
      }
      localStorage.setItem(VIEW_STORE, JSON.stringify(store));
    } catch { /* private mode / quota */ }
  }

  restoreFreeLookFlag() {
    const store = this.readViewStore();
    if (typeof store.freeLook === 'boolean') this.freeLook = store.freeLook;
    this.root.querySelector('#ss-static-shot').classList.toggle('is-active', this.freeLook);
  }

  applyStoredOrbit() {
    const saved = this.readViewStore().pages?.[this.viewKey()];
    if (!saved?.pos || !saved?.target) return false;
    this.still.stage.camera.position.fromArray(saved.pos);
    this.orbit.target.fromArray(saved.target);
    this.orbit.update();
    return true;
  }

  syncCamRig() {
    if (!this.rigWrap || !this.rigGizmo) return;
    const on = !!this.doc && !this.freeLook && !this.poseMode;
    this.rigWrap.hidden = !on;
    this.rigGizmo.enabled = on;
    if (on) {
      this.resizeRig();
      this.syncRigMode();
    }
  }

  syncRigMode() {
    if (!this.rigGizmo || !this.rigRoot || !this.rigOrient) return;
    const rotate = this.mode === 'rotate';
    this.rigGizmo.setMode(rotate ? 'rotate' : 'translate');
    this.rigGizmo.setSpace(rotate ? 'local' : 'world');
    this.rigTarget = rotate ? this.rigOrient : this.rigRoot;
    if (!this.rigDragging) {
      this.syncRigPose(true);
    }
  }

  syncRigPose(reattach = false) {
    if (!this.rigRoot || !this.rigOrient || this.rigDragging) return;
    const cam = this.page()?.camera;
    if (!cam) return;
    this.rigRoot.position.set(0, 0, 0);
    this.rigRoot.rotation.set(0, 0, 0);
    this.rigOrient.position.set(0, 0, 0);
    this.rigOrient.rotation.set((cam.pitch || 0) * DEG, (cam.yaw || 0) * DEG, 0, 'YXZ');
    this.rigRoot.updateMatrixWorld(true);
    if (reattach && this.rigGizmo && !this.rigWrap.hidden) {
      this.rigGizmo.detach();
      this.rigGizmo.attach(this.rigTarget);
    }
  }

  captureRigStart() {
    const cam = this.page()?.camera;
    if (!cam) return;
    this.rigStart = {
      at: [...cam.at],
      yaw: cam.yaw || 0,
      pitch: cam.pitch || 0,
    };
  }

  applyRig() {
    const cam = this.page()?.camera;
    if (!cam || !this.rigStart || !this.rigRoot || !this.rigOrient) return;
    if (this.rigGizmo.getMode() === 'rotate') {
      cam.yaw = snapTo(degrees(this.rigOrient.rotation.y), 1);
      cam.pitch = Math.max(-89, Math.min(89, snapTo(degrees(this.rigOrient.rotation.x), 1)));
    } else {
      const p = this.rigRoot.position;
      cam.at = [
        snapTo(this.rigStart.at[0] + p.x, 0.01),
        snapTo(this.rigStart.at[1] + p.y, 0.01),
        snapTo(this.rigStart.at[2] + p.z, 0.01),
      ];
    }
    this.camHelper.position.set(cam.at[0], cam.at[1], cam.at[2]);
    this.camHelper.rotation.set((cam.pitch || 0) * DEG, (cam.yaw || 0) * DEG, 0, 'YXZ');
    this.still.aimPage();
    this.scheduleSave();
    this.still.render();
  }

  finishRigDrag() {
    this.rigDragging = false;
    this.syncRigPose(true);
    this.renderProps();
  }

  resizeRig() {
    if (!this.rigRenderer || !this.rigWrap) return;
    const size = Math.max(1, Math.round(this.rigWrap.clientWidth) || 148);
    this.rigRenderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.rigRenderer.setSize(size, size, false);
    this.rigCam.aspect = 1;
    this.rigCam.updateProjectionMatrix();
  }

  toggleFreeLook() {
    this.persistView();
    this.freeLook = !this.freeLook;
    this.root.querySelector('#ss-static-shot').classList.toggle('is-active', this.freeLook);
    this.orbit.enabled = this.freeLook && !this.poseMode;
    this.camHelper.visible = this.freeLook;
    if (this.freeLook) {
      if (!this.applyStoredOrbit()) this.frameOrbit();
    } else {
      this.still.aimPage();
    }
    this._orbitKey = this.viewKey();
    this.syncCamRig();
    this.attachGizmo();
    this.persistView();
    this.still.render();
  }

  setMode(mode) {
    if (mode === 'scale' && this.selected?.kind !== 'prop' && !this.poseMode) mode = 'translate';
    this.mode = mode;
    this.gizmo.setMode(mode === 'scale' && this.poseMode ? 'rotate' : mode);
    this.root.querySelector('#ss-static-move').classList.toggle('is-active', mode === 'translate');
    this.root.querySelector('#ss-static-rotate').classList.toggle('is-active', mode === 'rotate');
    this.root.querySelector('#ss-static-scale').classList.toggle('is-active', mode === 'scale');
    this.syncRigMode();
    if (this.poseMode) {
      if (this.poseJoint) this.attachPose();
      return;
    }
    if (this.selected) this.attachGizmo();
  }

  onPick(e) {
    if (e.button !== 0 || this.gizmo.dragging || this.poseDragging) return;
    if (this.poseMode) return this.pickJoint(e);
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.still.stage.camera);
    const hits = this.ray.intersectObjects([
      this.camHelper,
      ...this.lampHelpers.values(),
      ...this.still.actors.values(),
      ...this.still.pageProps.values(),
    ], true);
    for (const h of hits) {
      let o = h.object;
      while (o) {
        if (o.userData.kind === 'camera') { this.select({ kind: 'camera' }); return; }
        if (o.userData.kind === 'lamp') { this.select({ kind: 'lamp', id: o.userData.lampId }); return; }
        if (o.userData.kind === 'cast') { this.select({ kind: 'cast', id: o.userData.actorId }); return; }
        if (o.userData.kind === 'prop') { this.select({ kind: 'prop', id: o.userData.propId }); return; }
        o = o.parent;
      }
    }
    this.select(null);
  }

  pickJoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.still.stage.camera);
    const hit = this.ray.intersectObjects(this.markers)[0];
    if (hit) {
      this.poseJoint = hit.object.userData.joint;
      this.attachPose();
      this.renderProps();
    }
  }

  select(sel) {
    if (this.poseMode && sel?.kind !== 'cast') this.endPoseMode();
    this.selected = sel;
    if (sel?.kind === 'lamp' && this.mode !== 'translate') this.setMode('translate');
    else if (this.mode === 'scale' && sel?.kind !== 'prop') this.setMode('translate');
    this.attachGizmo();
    this.renderList();
    this.renderProps();
  }

  targetObject() {
    const sel = this.selected;
    if (!sel) return null;
    if (sel.kind === 'camera') return this.camHelper;
    if (sel.kind === 'lamp') return this.lampHelpers.get(sel.id);
    if (sel.kind === 'cast') return this.still.actors.get(sel.id);
    if (sel.kind === 'prop') return this.still.pageProps.get(sel.id);
    return null;
  }

  targetEntry() {
    const page = this.page();
    const sel = this.selected;
    if (!page || !sel) return null;
    if (sel.kind === 'camera') return page.camera;
    if (sel.kind === 'lamp') return (page.lamps || []).find((l) => l.id === sel.id);
    if (sel.kind === 'cast') return page.cast.find((c) => c.id === sel.id);
    if (sel.kind === 'prop') return page.props.find((p) => p.id === sel.id);
    return null;
  }

  attachGizmo() {
    if (this.poseMode) return;
    const obj = this.targetObject();
    const entry = this.targetEntry();
    if (!obj || !entry) {
      this.gizmo.detach();
      return;
    }
    if (this.selected.kind === 'camera' && !this.freeLook) {
      this.gizmo.detach();
      return;
    }
    if (this.selected.kind === 'camera') {
      this.proxy.position.copy(this.camHelper.position);
      this.proxy.rotation.copy(this.camHelper.rotation);
      this.proxy.scale.set(1, 1, 1);
    } else if (this.selected.kind === 'lamp') {
      this.proxy.position.set(entry.at[0], entry.at[1], entry.at[2]);
      this.proxy.rotation.set(0, 0, 0);
      this.proxy.scale.set(1, 1, 1);
    } else {
      this.proxy.position.set(entry.at[0], entry.at[1], entry.at[2]);
      this.proxy.rotation.set((entry.roll || 0) * DEG, (entry.yaw || 0) * DEG, (entry.pitch || 0) * DEG);
      if (this.selected.kind === 'prop') {
        const size = scaleTriple(entry.scale);
        this.proxy.scale.set(size[0], size[1], size[2]);
      } else {
        this.proxy.scale.set(1, 1, 1);
      }
    }
    const mode = (this.mode === 'scale' && this.selected.kind !== 'prop')
      || this.selected.kind === 'lamp'
      ? 'translate'
      : this.mode;
    this.gizmo.setMode(mode);
    this.gizmo.setSpace(mode === 'rotate' ? 'local' : 'world');
    this.gizmo.attach(this.proxy);
  }

  commitProxy() {
    const entry = this.targetEntry();
    if (!entry || this.poseMode) return;
    const p = this.proxy.position;
    if (this.selected.kind === 'camera') {
      const cam = this.page().camera;
      cam.at = [snapTo(p.x, 0.01), snapTo(p.y, 0.01), snapTo(p.z, 0.01)];
      cam.yaw = snapTo(degrees(this.proxy.rotation.y), 1);
      cam.pitch = Math.max(-89, Math.min(89, snapTo(degrees(this.proxy.rotation.x), 1)));
      this.layoutCameraHelper();
      if (!this.freeLook) this.still.aimPage();
    } else if (this.selected.kind === 'lamp') {
      entry.at = [snapTo(p.x, 0.01), snapTo(p.y, 0.01), snapTo(p.z, 0.01)];
      this.layoutLamps();
      this.still.refreshActors();
    } else {
      entry.at = [snapTo(p.x, 0.01), snapTo(p.y, 0.01), snapTo(p.z, 0.01)];
      entry.roll = snapTo(degrees(this.proxy.rotation.x), 1);
      entry.yaw = snapTo(degrees(this.proxy.rotation.y), 1);
      entry.pitch = snapTo(degrees(this.proxy.rotation.z), 1);
      if (this.selected.kind === 'prop') {
        const s = this.proxy.scale;
        entry.scale = [Math.max(0.01, snapTo(s.x, 0.01)), Math.max(0.01, snapTo(s.y, 0.01)), Math.max(0.01, snapTo(s.z, 0.01))];
      }
      this.still.refreshActors();
    }
    this.touch();
    this.renderProps();
  }

  onDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const [kind, id] = (raw || '').split(':');
    const at = this.groundPoint(e) || [0, 0, 0];
    if (kind === CHAR_ROW) this.addCharacter(id, at);
    else if (kind === 'prop') this.addObject(id, at);
  }

  groundPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.still.stage.camera);
    const point = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.ground, point)) return null;
    return [snapTo(point.x, 0.05), 0, snapTo(point.z, 0.05)];
  }

  addCharacter(characterId, at) {
    const page = this.page();
    const doc = this.registry.character(characterId);
    if (!page || !doc) return;
    let id = characterId;
    let n = 2;
    while (page.cast.some((c) => c.id === id)) id = `${characterId}-${n++}`;
    const entry = {
      id, character: characterId, outfit: doc.defaultOutfit, position: 'stand',
      at, yaw: 0, pitch: 0, roll: 0, joints: [],
    };
    page.cast.push(entry);
    this.touch();
    this.reloadPage().then(() => this.select({ kind: 'cast', id }));
  }

  addObject(propId, at) {
    const page = this.page();
    if (!page || !this.registry.prop(propId)) return;
    let id = propId;
    let n = 2;
    while (page.props.some((p) => p.id === id)) id = `${propId}-${n++}`;
    page.props.push({ id, prop: propId, at, yaw: 0, pitch: 0, roll: 0, scale: [1, 1, 1] });
    this.touch();
    this.reloadPage().then(() => this.select({ kind: 'prop', id }));
  }

  addLamp(at) {
    const page = this.page();
    if (!page) return;
    page.lamps = page.lamps || [];
    let id = 'lamp';
    let n = 2;
    while (page.lamps.some((l) => l.id === id)) id = `lamp-${n++}`;
    const point = at || [
      snapTo(this.orbit.target.x, 0.05),
      snapTo(Math.max(0.4, this.orbit.target.y), 0.05),
      snapTo(this.orbit.target.z, 0.05),
    ];
    page.lamps.push({
      id,
      at: point,
      color: '#ffd9a0',
      intensity: 2,
      distance: 8,
    });
    this.layoutLamps();
    this.still.refreshActors();
    this.touch();
    this.select({ kind: 'lamp', id });
  }

  removeSelected() {
    const page = this.page();
    const sel = this.selected;
    if (!page || !sel || sel.kind === 'camera') return;
    if (sel.kind === 'cast') page.cast = page.cast.filter((c) => c.id !== sel.id);
    if (sel.kind === 'prop') page.props = page.props.filter((p) => p.id !== sel.id);
    if (sel.kind === 'lamp') {
      page.lamps = (page.lamps || []).filter((l) => l.id !== sel.id);
      this.layoutLamps();
      this.still.refreshActors();
      this.selected = null;
      this.touch();
      this.renderList();
      this.renderProps();
      this.attachGizmo();
      return;
    }
    this.selected = null;
    this.touch();
    this.reloadPage();
  }

  addPage(duplicate) {
    const src = this.page();
    const page = duplicate && src ? copy(src) : this.blankPage();
    page.id = `p${Date.now().toString(36)}`;
    page.hidden = false;
    this.persistView();
    this.doc.pages.splice(this.pageIndex + 1, 0, page);
    this.pageIndex += 1;
    this.selected = null;
    this.touch();
    this.reloadPage();
    this.renderStrip();
  }

  movePage(dir) {
    const i = this.pageIndex;
    const j = i + dir;
    if (j < 0 || j >= this.doc.pages.length) return;
    const pages = this.doc.pages;
    [pages[i], pages[j]] = [pages[j], pages[i]];
    this.pageIndex = j;
    this.touch();
    this.renderStrip();
  }

  toggleHide() {
    const page = this.page();
    if (!page) return;
    page.hidden = !page.hidden;
    this.touch();
    this.renderStrip();
  }

  deletePage() {
    if (this.doc.pages.length <= 1) return;
    this.persistView();
    this.doc.pages.splice(this.pageIndex, 1);
    this.pageIndex = Math.min(this.pageIndex, this.doc.pages.length - 1);
    this.selected = null;
    this.touch();
    this.reloadPage();
    this.renderStrip();
  }

  renderPalette() {
    const q = (this.searchEl.value || '').trim().toLowerCase();
    const list = this.registry.list(this.tab)
      .filter(({ doc }) => !q || doc.id.includes(q) || localised(doc.name, doc.id).toLowerCase().includes(q));
    this.paletteEl.innerHTML = '';
    for (const { doc } of list) {
      const item = document.createElement('button');
      item.className = 'ss-pal-item';
      item.draggable = true;
      item.title = `${localised(doc.name, doc.id)} — ${doc.id}`;
      const img = document.createElement('img');
      img.alt = '';
      img.dataset.thumb = `${this.tab}:${doc.id}`;
      const label = document.createElement('span');
      label.textContent = localised(doc.name, doc.id);
      item.append(img, label);
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', `${this.tab}:${doc.id}`);
        e.dataTransfer.effectAllowed = 'copy';
      });
      item.addEventListener('click', () => {
        if (this.tab === CHAR_ROW) this.addCharacter(doc.id, [0, 0, 0]);
        else this.addObject(doc.id, [0, 0, 0]);
      });
      this.paletteEl.appendChild(item);
    }
    this.fillThumbs();
  }

  fillThumbs() {
    const token = {};
    this.thumbJob = token;
    const pending = [...this.paletteEl.querySelectorAll('img[data-thumb]')];
    const run = async () => {
      while (pending.length) {
        if (this.thumbJob !== token) return;
        const img = pending.shift();
        const key = img.dataset.thumb;
        if (!this.thumbCache.has(key)) {
          const [kind, id] = key.split(':');
          const doc = kind === CHAR_ROW ? this.characterAsProp(id) : this.registry.prop(id);
          this.thumbCache.set(key, doc ? await thumbnail(doc, (b) => this.registry.blob(b)) : null);
        }
        const url = this.thumbCache.get(key);
        if (url) img.src = url;
        else img.classList.add('is-blank');
      }
    };
    run();
  }

  characterAsProp(id) {
    const doc = this.registry.character(id);
    if (!doc || !this.partsFor) return null;
    const parts = this.partsFor(doc);
    if (!parts) return null;
    return { id: `char.${id}`, source: { type: 'boxes', boxes: parts }, scale: 1, yaw: 0 };
  }

  renderList() {
    const page = this.page();
    this.listEl.innerHTML = '';
    if (!page) return;
    const row = (kind, id, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ss-edit-row';
      if (this.selected?.kind === kind && (kind === 'camera' || this.selected.id === id)) b.classList.add('is-active');
      b.textContent = label;
      b.onclick = () => this.select(kind === 'camera' ? { kind } : { kind, id });
      this.listEl.appendChild(b);
    };
    row('camera', 'camera', t('editCamera'));
    for (const lamp of page.lamps || []) {
      row('lamp', lamp.id, `${t('staticLamp')} · ${lamp.id}`);
    }
    for (const c of page.cast) {
      row('cast', c.id, localised(this.registry.character(c.character)?.name, c.id));
    }
    for (const p of page.props) {
      row('prop', p.id, localised(this.registry.prop(p.prop)?.name, p.id));
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'ss-button';
    add.textContent = t('staticAddLamp');
    add.onclick = () => this.addLamp();
    this.listEl.appendChild(add);
  }

  renderStrip() {
    this.stripEl.innerHTML = '';
    for (const [i, page] of this.doc.pages.entries()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ss-page-card';
      if (i === this.pageIndex) b.classList.add('is-active');
      if (page.hidden) b.classList.add('is-hidden');
      b.innerHTML = `<strong>${i + 1}</strong><span>${page.set}</span>`;
      b.onclick = () => {
        if (i === this.pageIndex) return;
        this.persistView();
        this.pageIndex = i;
        this.selected = null;
        this.poseMode = false;
        this.reloadPage();
        this.renderStrip();
      };
      this.stripEl.appendChild(b);
    }
  }

  renderProps() {
    const page = this.page();
    this.propsEl.innerHTML = '';
    if (!page) return;
    this.field(t('editSet'), this.selectEl(this.registry.list('set').map(({ doc }) => [doc.id, localised(doc.name, doc.id)]), page.set, (v) => {
      const cur = this.page();
      if (!cur) return;
      cur.set = v;
      this.touch();
      this.reloadPage();
    }));
    this.field(t('editSky'), this.selectEl(SKY_NAMES.map((s) => [s, s]), page.sky, (v) => {
      const cur = this.page();
      if (!cur) return;
      cur.sky = v;
      this.still.stage.setSky(v, cur.light.intensity);
      this.touch();
    }));
    this.field(t('staticLight'), this.numberEl(page.light.intensity, 0.05, (v) => {
      const cur = this.page();
      if (!cur) return;
      cur.light.intensity = Math.max(0, Math.min(4, v));
      this.still.stage.setSky(cur.sky, cur.light.intensity);
      this.touch();
    }));

    const sel = this.selected;
    const entry = this.targetEntry();
    if (!sel || !entry) {
      const hint = document.createElement('p');
      hint.className = 'ss-hint';
      hint.textContent = t('staticPickHint');
      this.propsEl.appendChild(hint);
      return;
    }

    if (sel.kind === 'camera') {
      this.heading(t('editCamera'));
      this.trio('XYZ', entry.at, (i, v) => {
        const cam = this.targetEntry();
        if (!cam) return;
        cam.at[i] = v;
        this.layoutCameraHelper();
        if (!this.freeLook) this.still.aimPage();
        this.touch();
      });
      this.field(t('editYaw'), this.numberEl(entry.yaw, 1, (v) => {
        const cam = this.targetEntry();
        if (!cam) return;
        cam.yaw = v;
        this.layoutCameraHelper();
        if (!this.freeLook) this.still.aimPage();
        this.touch();
      }));
      this.field(t('editPitch'), this.numberEl(entry.pitch, 1, (v) => {
        const cam = this.targetEntry();
        if (!cam) return;
        cam.pitch = Math.max(-89, Math.min(89, v));
        this.layoutCameraHelper();
        if (!this.freeLook) this.still.aimPage();
        this.touch();
      }));
      this.field('fov', this.numberEl(entry.fov, 1, (v) => {
        const cam = this.targetEntry();
        if (!cam) return;
        cam.fov = Math.max(15, Math.min(110, v));
        if (!this.freeLook) this.still.aimPage();
        this.touch();
      }));
      return;
    }

    if (sel.kind === 'lamp') {
      this.heading(t('staticLamp'));
      this.trio('XYZ', entry.at, (i, v) => {
        const lamp = this.targetEntry();
        if (!lamp) return;
        lamp.at[i] = v;
        this.layoutLamps();
        this.still.refreshActors();
        this.attachGizmo();
        this.touch();
      });
      this.field(t('propColor'), this.colorEl(entry.color || '#ffd9a0', (v) => {
        const lamp = this.targetEntry();
        if (!lamp) return;
        lamp.color = v;
        this.layoutLamps();
        this.still.refreshActors();
        this.touch();
      }));
      this.field(t('staticLampIntensity'), this.numberEl(entry.intensity, 0.1, (v) => {
        const lamp = this.targetEntry();
        if (!lamp) return;
        lamp.intensity = Math.max(0, Math.min(40, v));
        this.still.refreshActors();
        this.touch();
      }));
      this.field(t('staticLampDistance'), this.numberEl(entry.distance, 0.1, (v) => {
        const lamp = this.targetEntry();
        if (!lamp) return;
        lamp.distance = Math.max(0.2, Math.min(200, v));
        this.still.refreshActors();
        this.touch();
      }));
      this.removeButton();
      return;
    }

    if (sel.kind === 'prop') {
      this.heading(localised(this.registry.prop(entry.prop)?.name, entry.id));
      this.trio('XYZ', entry.at, (i, v) => {
        const prop = this.targetEntry();
        if (!prop) return;
        prop.at[i] = v;
        this.still.refreshActors();
        this.attachGizmo();
        this.touch();
      });
      this.field(t('editYaw'), this.numberEl(entry.yaw, 1, (v) => {
        const prop = this.targetEntry();
        if (!prop) return;
        prop.yaw = v;
        this.still.refreshActors();
        this.attachGizmo();
        this.touch();
      }));
      this.field(t('editPitch'), this.numberEl(entry.pitch, 1, (v) => {
        const prop = this.targetEntry();
        if (!prop) return;
        prop.pitch = v;
        this.still.refreshActors();
        this.attachGizmo();
        this.touch();
      }));
      this.field(t('editRoll'), this.numberEl(entry.roll, 1, (v) => {
        const prop = this.targetEntry();
        if (!prop) return;
        prop.roll = v;
        this.still.refreshActors();
        this.attachGizmo();
        this.touch();
      }));
      const size = scaleTriple(entry.scale);
      this.trio(t('editSize'), size, (i, v) => {
        const prop = this.targetEntry();
        if (!prop) return;
        const next = scaleTriple(prop.scale);
        next[i] = Math.max(0.01, v);
        prop.scale = next;
        this.still.refreshActors();
        this.touch();
      });
      this.removeButton();
      return;
    }

    const char = this.registry.character(entry.character);
    this.heading(localised(char?.name, entry.id));
    const outfits = (char?.wardrobe || []).map((w) => [w.id, w.id]);
    this.field(t('outfits'), this.selectEl(outfits, entry.outfit || char?.defaultOutfit, (v) => {
      const cast = this.targetEntry();
      if (!cast) return;
      cast.outfit = v;
      this.touch();
      this.reloadPage().then(() => this.select(this.selected));
    }));
    const positions = this.registry.list('position').map(({ doc }) => [doc.id, localised(doc.name, doc.id)]);
    this.field(t('positions'), this.selectEl(positions, entry.position || 'stand', (v) => {
      const cast = this.targetEntry();
      if (!cast) return;
      cast.position = v;
      cast.joints = [];
      this.still.refreshActors();
      this.touch();
    }));
    this.trio('XYZ', entry.at, (i, v) => {
      const cast = this.targetEntry();
      if (!cast) return;
      cast.at[i] = v;
      this.still.refreshActors();
      this.attachGizmo();
      this.touch();
    });
    this.field(t('editYaw'), this.numberEl(entry.yaw, 1, (v) => {
      const cast = this.targetEntry();
      if (!cast) return;
      cast.yaw = v;
      this.still.refreshActors();
      this.attachGizmo();
      this.touch();
    }));
    this.field(t('staticSpeech'), this.textEl(localised(entry.text || { en: '', pt: '', ja: '' }), (v) => {
      const cast = this.targetEntry();
      if (!cast) return;
      cast.text = { en: v, pt: v, ja: v };
      if (v && !cast.balloon) cast.balloon = 'say';
      this.still.updateBalloons();
      this.still.render();
      this.touch();
    }));
    this.field(t('staticBalloon'), this.selectEl([['say', t('staticSay')], ['think', t('staticThink')]], entry.balloon || 'say', (v) => {
      const cast = this.targetEntry();
      if (!cast) return;
      cast.balloon = v;
      this.still.updateBalloons();
      this.still.render();
      this.touch();
    }));
    const poseBtn = document.createElement('button');
    poseBtn.type = 'button';
    poseBtn.className = 'ss-button';
    poseBtn.textContent = this.poseMode ? t('staticPoseDone') : t('staticCustomize');
    poseBtn.onclick = () => (this.poseMode ? this.endPoseMode() : this.startPoseMode());
    this.propsEl.appendChild(poseBtn);
    this.removeButton();
  }

  removeButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ss-button ss-danger';
    b.textContent = t('remove');
    b.onclick = () => this.removeSelected();
    this.propsEl.appendChild(b);
  }

  heading(text) {
    const h = document.createElement('h3');
    h.className = 'ss-edit-heading';
    h.textContent = text;
    this.propsEl.appendChild(h);
  }

  field(label, el) {
    const row = document.createElement('label');
    row.className = 'ss-prop-row';
    const span = document.createElement('span');
    span.textContent = label;
    row.append(span, el);
    this.propsEl.appendChild(row);
  }

  trio(label, values, onChange) {
    const group = document.createElement('p');
    group.className = 'ss-prop-group';
    group.textContent = label;
    this.propsEl.appendChild(group);
    const row = document.createElement('div');
    row.className = 'ss-prop-trio';
    for (const [i, axis] of ['X', 'Y', 'Z'].entries()) {
      const lab = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = axis;
      const input = this.numberEl(values[i], 0.05, (v) => onChange(i, v));
      lab.append(name, input);
      row.appendChild(lab);
    }
    this.propsEl.appendChild(row);
  }

  numberEl(value, step, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(step);
    input.value = Number.isFinite(value) ? String(value) : '0';
    input.addEventListener('change', () => onChange(+input.value));
    return input;
  }

  colorEl(value, onChange) {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffd9a0';
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }

  textEl(value, onChange) {
    const input = document.createElement('textarea');
    input.value = value || '';
    input.addEventListener('change', () => onChange(input.value));
    return input;
  }

  selectEl(options, value, onChange) {
    const sel = document.createElement('select');
    for (const [id, label] of options) sel.appendChild(new Option(label, id));
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  startPoseMode() {
    if (this.selected?.kind !== 'cast') return;
    this.poseMode = true;
    this.poseMove = false;
    this.poseView = {
      freeLook: this.freeLook,
      pos: this.still.stage.camera.position.toArray(),
      target: this.orbit.target.toArray(),
    };
    this.persistView();
    this.freeLook = true;
    this.root.querySelector('#ss-static-shot').classList.toggle('is-active', true);
    this.orbit.enabled = true;
    this.camHelper.visible = false;
    this.layoutLamps();
    this.syncCamRig();
    this.gizmo.detach();
    const mesh = this.still.actors.get(this.selected.id);
    if (!mesh) return;
    if (!this.markers.length) {
      for (const j of JOINT_NAMES) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), new THREE.MeshBasicMaterial({ color: 0x008f7d, depthTest: false }));
        dot.renderOrder = 10;
        dot.userData.joint = j;
        this.markerGroup.add(dot);
        this.markers.push(dot);
      }
    }
    this.markerGroup.visible = true;
    this.framePoseSubject();
    this.attachPose();
    this.renderProps();
  }

  framePoseSubject() {
    const mesh = this.still.actors.get(this.selected?.id);
    if (!mesh) return;
    mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    let radius = 1.8;
    if (bounds.isEmpty()) {
      center.set(mesh.position.x, mesh.position.y + 0.9, mesh.position.z);
    } else {
      bounds.getCenter(center);
      const size = bounds.getSize(new THREE.Vector3());
      radius = Math.max(1.2, Math.max(size.x, size.y, size.z) * 1.55);
    }
    this.orbit.target.copy(center);
    this.still.stage.camera.position.set(center.x + radius, center.y + radius * 0.45, center.z + radius);
    this.orbit.update();
  }

  attachPose() {
    const mesh = this.still.actors.get(this.selected?.id);
    if (!mesh || !this.poseJoint) {
      this.gizmo.detach();
      this.updateMarkers();
      return;
    }
    const joint = mesh.userData.pivots[this.poseJoint];
    if (!joint) {
      this.gizmo.detach();
      this.updateMarkers();
      return;
    }
    if (this.mode === 'translate' || this.poseMove) {
      this.poseMove = true;
      joint.getWorldPosition(this.proxy.position);
      this.proxy.rotation.set(0, 0, 0);
      this.gizmo.setMode('translate');
      this.gizmo.setSpace('world');
      this.gizmo.attach(this.proxy);
    } else {
      this.poseMove = false;
      this.gizmo.setMode('rotate');
      this.gizmo.setSpace('local');
      this.gizmo.attach(joint);
    }
    this.updateMarkers();
  }

  clearPoseJoint() {
    if (!this.poseMode) return;
    if (this.poseJoint) this.commitPose();
    this.poseJoint = null;
    this.poseMove = false;
    this.gizmo.detach();
    this.updateMarkers();
    this.renderProps();
  }

  updateMarkers() {
    const mesh = this.still.actors.get(this.selected?.id);
    if (!mesh) return;
    mesh.updateMatrixWorld(true);
    for (const dot of this.markers) {
      mesh.userData.pivots[dot.userData.joint].getWorldPosition(dot.position);
      dot.material.color.setHex(this.poseJoint && dot.userData.joint === this.poseJoint ? 0xf2a844 : 0x008f7d);
    }
  }

  solvePoseDrag() {
    const m = this.still.actors.get(this.selected.id);
    if (!m) return;
    const p = m.userData.pivots;
    const target = this.proxy.position.clone();
    const chain = END_CHAINS[this.poseJoint] || [jointParent(this.poseJoint)].filter(Boolean);
    const endpoint = p[this.poseJoint];
    const distance = () => {
      m.updateMatrixWorld(true);
      return endpoint.getWorldPosition(new THREE.Vector3()).distanceToSquared(target);
    };
    for (const step of [0.18, 0.07, 0.025]) {
      for (let pass = 0; pass < 4; pass++) {
        for (const j of chain) {
          for (const axis of ['x', 'y', 'z']) {
            const r = p[j].rotation;
            const old = r[axis];
            let best = distance();
            let angle = old;
            for (const sign of [-1, 1]) {
              let value = Math.max(-2.8, Math.min(2.8, old + step * sign));
              r[axis] = value;
              const d = distance();
              if (d < best) { best = d; angle = value; }
            }
            r[axis] = angle;
          }
        }
      }
    }
  }

  commitPose() {
    const entry = this.targetEntry();
    const mesh = this.still.actors.get(this.selected?.id);
    if (!entry || !mesh) return;
    const live = readRigPose(mesh);
    const position = this.registry.get('position', entry.position) || { pose: 'stand' };
    const base = poseFromPosition(position);
    const extra = [];
    for (const joint of JOINT_NAMES) {
      for (const [i, axis] of ['x', 'y', 'z'].entries()) {
        const value = (live.joints[joint]?.[i] || 0) - (base.joints[joint]?.[i] || 0);
        if (Math.abs(value) > 1e-4) extra.push({ joint, axis, offset: +value.toFixed(6) });
      }
    }
    entry.joints = extra;
    this.touch();
  }

  endPoseMode() {
    this.commitPose();
    this.poseMode = false;
    this.markerGroup.visible = false;
    this.gizmo.detach();
    if (this.poseView) {
      this.freeLook = this.poseView.freeLook;
      this.root.querySelector('#ss-static-shot').classList.toggle('is-active', this.freeLook);
      this.still.stage.camera.position.fromArray(this.poseView.pos);
      this.orbit.target.fromArray(this.poseView.target);
      this.orbit.update();
      this.poseView = null;
    }
    this.orbit.enabled = this.freeLook;
    this.camHelper.visible = this.freeLook;
    this.layoutLamps();
    if (!this.freeLook) this.still.aimPage();
    this.syncCamRig();
    this.attachGizmo();
    this.renderProps();
  }

  touch() {
    this.scheduleSave();
    this.still.render();
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 400);
  }

  async flushSave() {
    if (!this.doc) return;
    const v = validate(this.doc, this.registry.libraryOptions());
    if (!v.ok) {
      this.report(`${t('problems')}: ${v.errors[0].path} ${v.errors[0].message}`);
      return;
    }
    // validate() returns a fresh tree. Keep the live Still (and later edits) on
    // the same page object the editor is writing to, or the next camera/cast
    // tweak updates a detached copy while the viewport stays frozen.
    const pageId = this.page()?.id;
    this.doc = v.doc;
    if (pageId) {
      const idx = this.doc.pages.findIndex((p) => p.id === pageId);
      if (idx >= 0) this.pageIndex = idx;
    }
    if (this.still) this.still.page = this.page();
    await this.onSave(this.doc);
    this.report(t('staticSaved', { id: this.doc.id }));
    // Inspector fields close over entry objects; rebuild them against the new tree.
    if (this.active && !this.gizmo.dragging && !this.rigDragging && !this.poseDragging) {
      this.layoutCameraHelper();
      this.layoutLamps();
      this.attachGizmo();
      this.renderList();
      this.renderProps();
    }
  }

  refreshLanguage() {
    if (!this.doc) return;
    this.titleEl.textContent = localised(this.doc.name, this.doc.id);
    this.renderPalette();
    this.renderList();
    this.renderStrip();
    this.renderProps();
  }

  report(message) {
    this.statusEl.textContent = message || '';
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.orbit.enabled = this.freeLook;
    this.syncCamRig();
    const tick = () => {
      if (!this.active) return;
      if (this.freeLook) this.orbit.update();
      this.still.render();
      if (this.rigRenderer && !this.rigWrap.hidden) {
        this.rigRenderer.render(this.rigScene, this.rigCam);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.viewTimer);
    this.persistView();
    this.gizmo.detach();
    clearTimeout(this.saveTimer);
    this.flushSave();
  }

  resize(w, h) {
    this.still.resize(w, h);
    this.resizeRig();
  }
}
