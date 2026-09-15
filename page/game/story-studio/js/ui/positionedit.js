import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Stage } from '../render/stage.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { JOINT_NAMES, jointParent } from '../cast/rig.js';
import { applyPose } from '../anim/blend.js';
import { basePose } from '../anim/perform.js';
import { poseFromPosition, encodeConstOffsets, readRigPose, groundedPose } from '../anim/position.js';
import { localised, t } from '../i18n.js';
import { validate } from '../script/schema.js';
import { download, toJson } from '../library/io.js';

const DEG = Math.PI / 180;
const JOINT_LABELS = {
  hips: 'aeHips', chest: 'aeChest', neck: 'aeNeck', head: 'aeHead',
  lArm: 'aeLArm', rArm: 'aeRArm', lFore: 'aeLFore', rFore: 'aeRFore',
  lHand: 'aeLHand', rHand: 'aeRHand', lThigh: 'aeLThigh', rThigh: 'aeRThigh',
  lShin: 'aeLShin', rShin: 'aeRShin', lFoot: 'aeLFoot', rFoot: 'aeRFoot',
};
const BASES = ['stand', 'sit', 'kneel', 'crouch', 'lieUp', 'lieDown', 'crawl', 'plank', 'swim'];
const END_CHAINS = {
  lHand: ['lFore', 'lArm'], rHand: ['rFore', 'rArm'],
  lFoot: ['lShin', 'lThigh'], rFoot: ['rShin', 'rThigh'],
};
const copy = (v) => JSON.parse(JSON.stringify(v));

export class PositionEditor {
  constructor(root, { registry, onSave, onCancel }) {
    Object.assign(this, {
      root, registry, onSave, onCancel, dirty: false, doc: null, model: null,
      markers: [], history: [], future: [], active: false, mode: 'rotate',
      selected: 'rHand', dragging: false, charId: 'rui',
    });
    root.innerHTML = `<div class="ss-edit-bar"><h2 data-i18n="posTitle"></h2><div class="ss-edit-tools">
      <button type="button" data-pe="undo" data-i18n="aeUndo"></button>
      <button type="button" data-pe="redo" data-i18n="aeRedo"></button>
      <button type="button" data-pe="export" data-i18n="export"></button>
      <button type="button" data-pe="save" class="ss-primary" data-i18n="save"></button>
      <button type="button" data-pe="cancel" data-i18n="cancel"></button></div></div>
      <div class="ss-ae-body"><aside class="ss-ae-panel">
      <label>ID<input data-pe="id" maxlength="64"></label>
      ${['en', 'pt', 'ja'].map((lang) => `<label><span><span data-i18n="propName"></span> ${lang.toUpperCase()}</span><input data-pe="name-${lang}" maxlength="160"></label>`).join('')}
      <label><span data-i18n="aeCharacter"></span><select data-pe="character"></select></label>
      <label><span data-i18n="aeBase"></span><select data-pe="base">${BASES.map((v) => `<option value="${v}" data-i18n="aeBase${v}"></option>`).join('')}</select></label>
      <p data-i18n="posHint"></p>
      </aside>
      <div id="ss-position-stage"><canvas id="ss-position-canvas"></canvas></div>
      <aside class="ss-ae-panel ss-ae-inspector">
      <div class="ss-ae-buttons">
        <button type="button" data-pe="rotate" data-i18n="aeRotate"></button>
        <button type="button" data-pe="move" data-i18n="aeMove"></button>
      </div>
      <label><span data-i18n="aeJoint"></span><select data-pe="joint">${JOINT_NAMES.map((j) => `<option value="${j}" data-i18n="${JOINT_LABELS[j]}"></option>`).join('')}</select></label>
      <div class="ss-ae-angles">${['x', 'y', 'z'].map((a) => `<label>${a.toUpperCase()} °<input type="number" step="1" min="-180" max="180" data-pe="angle-${a}"></label>`).join('')}</div>
      <button type="button" data-pe="reset" data-i18n="aeReset"></button>
      <output data-pe="message" role="status"></output>
      </aside></div>`;
    this.q = (key) => root.querySelector(`[data-pe="${key}"]`);
    this.canvas = root.querySelector('canvas');
    this.stage = new Stage(this.canvas, { shadows: false, fog: false });
    this.orbit = new OrbitControls(this.stage.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.gizmo = new TransformControls(this.stage.camera, this.canvas);
    this.gizmo.setSpace('local');
    this.stage.scene.add(this.gizmo.getHelper?.() || this.gizmo);
    this.proxy = new THREE.Object3D();
    this.stage.scene.add(this.proxy);
    this.markerGroup = new THREE.Group();
    this.stage.scene.add(this.markerGroup);
    this.stage.hemi.intensity = 1.3;
    this.stage.sun.position.set(6, 10, 8);
    this.stage.scene.add(new THREE.GridHelper(10, 20, 0x7d9990, 0xb4c3b8));
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (this.active && entry.contentRect.width && entry.contentRect.height) {
        this.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    this.resizeObserver.observe(this.canvas.parentElement);
    this.bind();
    this.translate();
  }

  translate() {
    for (const el of this.root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    if (this.doc) { this.populateLibraries(); this.refreshFields(); }
  }

  bind() {
    this.q('save').onclick = () => this.save();
    this.q('cancel').onclick = () => this.onCancel();
    this.q('export').onclick = () => {
      const result = this.validated();
      if (result) download(`position-${result.id}.json`, toJson(result));
    };
    this.q('undo').onclick = () => this.undo(false);
    this.q('redo').onclick = () => this.undo(true);
    this.q('id').onchange = (e) => { this.checkpoint(); this.doc.id = e.target.value.trim(); this.dirty = true; };
    for (const lang of ['en', 'pt', 'ja']) {
      this.q(`name-${lang}`).onchange = (e) => { this.checkpoint(); this.doc.name[lang] = e.target.value; this.dirty = true; };
    }
    this.q('character').onchange = () => {
      this.checkpoint();
      this.charId = this.q('character').value;
      this.dirty = true;
      this.buildModel();
    };
    this.q('base').onchange = () => {
      this.checkpoint();
      const old = basePose(this.doc.pose);
      const nextName = this.q('base').value;
      const next = basePose(nextName);
      const pose = this.currentPose();
      for (const j of JOINT_NAMES) {
        pose.joints[j] = [0, 1, 2].map((i) => (pose.joints[j]?.[i] || 0) - (old.joints[j]?.[i] || 0) + (next.joints[j]?.[i] || 0));
      }
      for (const k of ['lift', 'shift', 'tiltZ']) {
        pose.root[k] = (pose.root[k] || 0) - (old.root[k] || 0) + (next.root[k] || 0);
      }
      this.doc.pose = nextName;
      this.pose = pose;
      this.changed();
    };
    this.q('joint').onchange = () => {
      this.selected = this.q('joint').value;
      this.updateMarkers();
      this.attach();
      this.updateAngles();
    };
    for (const mode of ['move', 'rotate']) {
      this.q(mode).onclick = () => { this.mode = mode; this.attach(); };
    }
    for (const [i, axis] of ['x', 'y', 'z'].entries()) {
      this.q(`angle-${axis}`).onchange = () => {
        this.checkpoint();
        const pose = this.currentPose();
        pose.joints[this.selected] ||= [0, 0, 0];
        pose.joints[this.selected][i] = Math.max(-180, Math.min(180, +this.q(`angle-${axis}`).value || 0)) * DEG;
        this.record(pose);
      };
    }
    this.q('reset').onclick = () => {
      this.checkpoint();
      const pose = this.currentPose();
      pose.joints[this.selected] = copy(basePose(this.doc.pose).joints[this.selected] || [0, 0, 0]);
      this.record(pose);
    };
    this.canvas.addEventListener('pointerdown', (e) => this.pick(e));
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.dragging = e.value;
      this.orbit.enabled = !e.value;
      if (e.value) this.checkpoint();
      else if (this.doc) this.record(this.readRig());
    });
    this.gizmo.addEventListener('objectChange', () => {
      if (!this.dragging || !this.doc) return;
      if (this.mode === 'move') this.solveDrag();
      this.updateMarkers();
      this.updateAngles();
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.target.closest('input,select,textarea') || !this.doc) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo(e.shiftKey);
      }
    });
  }

  populateLibraries() {
    this.q('character').replaceChildren(...this.registry.list('character').map(({ doc: d }) => new Option(localised(d.name, d.id), d.id)));
  }

  pick(e) {
    if (e.button !== 0 || this.gizmo.axis || !this.doc) return;
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.stage.camera);
    const marker = this.ray.intersectObjects(this.markers)[0];
    if (marker) {
      this.selected = marker.object.userData.joint;
      this.refreshFields();
      this.seek();
    }
  }

  async load(doc) {
    this.doc = copy(doc);
    if (typeof this.doc.name === 'string') this.doc.name = { en: doc.name, pt: doc.name, ja: doc.name };
    this.doc.pose ||= 'stand';
    this.doc.joints ||= [];
    this.doc.root ||= [];
    this.charId = this.registry.character(doc.previewCast?.solo) ? doc.previewCast.solo : 'rui';
    this.pose = poseFromPosition(this.doc);
    this.mode = 'rotate';
    this.selected = 'rHand';
    this.history = [];
    this.future = [];
    this.dirty = false;
    this.q('message').textContent = '';
    this.populateLibraries();
    this.refreshFields();
    await this.buildModel();
    this.frameCamera();
    this.seek();
  }

  async buildModel() {
    this.gizmo.detach();
    if (this.model) {
      this.stage.content.remove(this.model);
      disposeCharacter(this.model);
    }
    const doc = this.registry.character(this.charId) || this.registry.character('rui');
    this.model = buildCharacter(doc, doc.defaultOutfit);
    this.stage.content.add(this.model);
    for (const dot of this.markers) { dot.geometry.dispose(); dot.material.dispose(); }
    this.markerGroup.clear();
    this.markers = [];
    for (const j of JOINT_NAMES) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), new THREE.MeshBasicMaterial({ color: 0x008f7d, depthTest: false }));
      dot.renderOrder = 10;
      dot.userData.joint = j;
      this.markerGroup.add(dot);
      this.markers.push(dot);
    }
    this.seek();
  }

  frameCamera() {
    const bounds = new THREE.Box3().setFromObject(this.stage.content);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    this.orbit.target.copy(center);
    this.stage.camera.position.copy(center).add(new THREE.Vector3(2.4, 1.6, 2.4));
    this.orbit.update();
  }

  currentPose() { return copy(this.pose); }
  readRig() { return readRigPose(this.model); }

  seek() {
    if (!this.doc || !this.model) return;
    applyPose(this.model, groundedPose(this.model, this.pose));
    this.stage.scene.updateMatrixWorld(true);
    this.updateMarkers();
    this.attach();
    this.updateAngles();
  }

  attach() {
    if (this.dragging) return;
    this.q('rotate').classList.toggle('is-active', this.mode === 'rotate');
    this.q('move').classList.toggle('is-active', this.mode === 'move');
    if (!this.model) { this.gizmo.detach(); return; }
    const joint = this.model.userData.pivots[this.selected];
    this.gizmo.setMode(this.mode === 'move' ? 'translate' : 'rotate');
    if (this.mode === 'rotate') {
      this.gizmo.setSpace('local');
      this.gizmo.attach(joint);
    } else {
      joint.getWorldPosition(this.proxy.position);
      this.proxy.rotation.set(0, 0, 0);
      this.gizmo.setSpace('world');
      this.gizmo.showZ = this.selected !== 'hips';
      this.gizmo.attach(this.proxy);
    }
  }

  solveDrag() {
    const m = this.model;
    const p = m.userData.pivots;
    const target = this.proxy.position.clone();
    if (this.selected === 'hips') {
      const local = m.worldToLocal(target);
      const pose = this.currentPose();
      const rest = p.hips.position.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), pose.root.tiltZ || 0);
      pose.root.lift = (local.y - rest.y) / m.userData.height;
      pose.root.shift = (local.x - rest.x) / m.userData.height;
      applyPose(m, pose);
      this.pose = pose;
      return;
    }
    const chain = END_CHAINS[this.selected] || [jointParent(this.selected)].filter(Boolean);
    const endpoint = p[this.selected];
    const distance = () => {
      m.updateMatrixWorld(true);
      return endpoint.getWorldPosition(new THREE.Vector3()).distanceToSquared(target);
    };
    for (const step of [0.18, 0.07, 0.025]) {
      for (let pass = 0; pass < 5; pass++) {
        for (const j of chain) {
          for (const axis of ['x', 'y', 'z']) {
            const r = p[j].rotation;
            const old = r[axis];
            let best = distance();
            let angle = old;
            for (const sign of [-1, 1]) {
              let value = old + step * sign;
              const lower = /Fore$/.test(j) && axis === 'z' ? 0 : -2.8;
              const upper = /Shin$/.test(j) && axis === 'z' ? 0.2 : 2.8;
              value = Math.max(lower, Math.min(upper, value));
              r[axis] = value;
              const d = distance();
              if (d < best) { best = d; angle = value; }
            }
            r[axis] = angle;
          }
        }
      }
    }
    m.updateMatrixWorld(true);
  }

  updateMarkers() {
    if (!this.model) return;
    this.model.updateMatrixWorld(true);
    for (const dot of this.markers) {
      this.model.userData.pivots[dot.userData.joint].getWorldPosition(dot.position);
      dot.material.color.setHex(dot.userData.joint === this.selected ? 0xf2a844 : 0x008f7d);
    }
  }

  updateAngles() {
    if (!this.model) return;
    const r = this.model.userData.pivots[this.selected].rotation;
    for (const a of ['x', 'y', 'z']) this.q(`angle-${a}`).value = (r[a] / DEG).toFixed(1);
  }

  record(pose) {
    this.pose = copy(pose);
    this.changed();
  }

  changed() {
    this.dirty = true;
    this.seek();
    this.refreshFields();
  }

  snapshot() {
    return copy({ doc: this.doc, pose: this.pose, charId: this.charId, selected: this.selected, mode: this.mode });
  }

  checkpoint() {
    this.history.push(this.snapshot());
    if (this.history.length > 40) this.history.shift();
    this.future = [];
  }

  async undo(redo) {
    const from = redo ? this.future : this.history;
    const to = redo ? this.history : this.future;
    if (!from.length) return;
    to.push(this.snapshot());
    Object.assign(this, from.pop());
    this.dirty = true;
    this.refreshFields();
    await this.buildModel();
  }

  refreshFields() {
    if (!this.doc) return;
    this.q('id').value = this.doc.id;
    for (const lang of ['en', 'pt', 'ja']) this.q(`name-${lang}`).value = this.doc.name[lang] || '';
    this.q('base').value = this.doc.pose || 'stand';
    this.q('character').value = this.charId;
    this.q('joint').value = this.selected;
    this.q('undo').disabled = !this.history.length;
    this.q('redo').disabled = !this.future.length;
  }

  document() {
    const encoded = encodeConstOffsets(this.pose, this.doc.pose || 'stand');
    const out = {
      kind: 'position',
      version: 1,
      id: this.doc.id,
      name: copy(this.doc.name),
      pose: encoded.pose,
      joints: encoded.joints,
      root: encoded.root,
      previewCast: { solo: this.charId },
    };
    if (this.doc.anchor) out.anchor = this.doc.anchor;
    if (this.doc.seatLift) out.seatLift = this.doc.seatLift;
    return out;
  }

  validated() {
    const v = validate(this.document());
    this.q('message').textContent = v.ok ? '' : v.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    return v.ok ? v.doc : null;
  }

  async save() {
    const doc = this.validated();
    if (doc) await this.onSave(doc);
  }

  start() {
    if (this.active) return;
    this.active = true;
    const tick = () => {
      if (!this.active) return;
      this.orbit.update();
      this.stage.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.gizmo.detach();
  }

  resize(w, h) {
    this.stage.resize(w, h);
    this.stage.render();
  }
}
