import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Stage } from '../render/stage.js';
import { buildGeometry, toHex, PAINT_N, FACE_BASIS, cellIndex, cellPoint } from '../render/geometry.js';
import { buildCharacter } from '../cast/build.js';
import { localised, t } from '../i18n.js';
import { getPreference, putPreference } from '../library/store.js';

const DEG = Math.PI / 180;
const SHAPES = ['box', 'rounded', 'sphere', 'cylinder', 'cone'];
const COMPARE_CHARACTER_KEY = 'propCompareCharacter';
const DEFAULT_COMPARE_CHARACTER = 'rui';

// A prop is a small model of parts, not a black-box thumbnail. This editor
// keeps the same boxes used by the renderer, so every visual edit remains
// exportable and usable by the story editor.
export class PropEditor {
  constructor(root, { registry, onSave, onCancel, onExportGlb }) {
    this.root = root; this.registry = registry; this.onSave = onSave; this.onCancel = onCancel; this.onExportGlb = onExportGlb;
    this.canvas = root.querySelector('#ss-prop-canvas');
    this.stage = new Stage(this.canvas, { shadows: true, fog: false });
    this.camera = this.stage.camera;
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true; this.orbit.target.set(0, 1, 0);
    this.gizmo = new TransformControls(this.camera, this.canvas);
    this.gizmoView = typeof this.gizmo.getHelper === 'function' ? this.gizmo.getHelper() : this.gizmo;
    this.stage.scene.add(this.gizmoView);
    this.proxy = new THREE.Object3D(); this.proxy.rotation.order = 'YXZ'; this.stage.scene.add(this.proxy);
    this.partsEl = root.querySelector('#ss-prop-parts');
    this.parts = []; this.meshes = []; this.selected = 0; this.doc = null; this.dirty = false;
    this.ray = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.paintPoint = new THREE.Vector3(); this.paintNormal = new THREE.Vector3();
    this.brush = 1; this.painting = false;
    this.bind();
  }

  bind() {
    const q = (s) => this.root.querySelector(s);
    q('#ss-prop-save').onclick = () => this.onSave(this.doc);
    q('#ss-prop-cancel').onclick = () => this.onCancel();
    q('#ss-prop-export').onclick = () => this.onExportGlb?.(this.doc);
    q('#ss-prop-remove').onclick = () => this.removeSelected();
    this.gizmo.addEventListener('dragging-changed', (e) => { this.orbit.enabled = !e.value; if (!e.value) this.commitTransform(); });
    this.gizmo.addEventListener('objectChange', () => { this.applyProxyVisual(); this.commitTransform(); });
    for (const tool of ['select', 'move', 'rotate', 'scale', 'pen', 'spray']) q(`#ss-prop-tool-${tool}`).onclick = () => this.setTool(tool);
    q('#ss-prop-brush').oninput = (e) => { this.brush = Number(e.target.value) || 1; q('#ss-prop-brush-out').textContent = String(this.brush); };
    q('#ss-prop-canvas').addEventListener('pointerdown', (e) => {
      this.painting = e.button === 0 && (this.tool === 'pen' || this.tool === 'spray');
      if (this.painting) this.canvas.setPointerCapture?.(e.pointerId);
      this.paintOrSelect(e);
    });
    q('#ss-prop-canvas').addEventListener('pointermove', (e) => { if (this.painting && (e.buttons & 1)) this.paintOrSelect(e); });
    q('#ss-prop-canvas').addEventListener('pointerup', (e) => this.stopPainting(e));
    q('#ss-prop-canvas').addEventListener('pointercancel', (e) => this.stopPainting(e));
    q('#ss-prop-color').oninput = (e) => this.changeColor(e.target.value);
    q('#ss-prop-opacity').oninput = (e) => { const p = this.editablePart(); if (!p) return; p.opacity = Number(e.target.value); q('#ss-prop-opacity-out').textContent = `${Math.round(Number(e.target.value) * 100)}%`; this.dirty = true; this.refresh(); };
    q('#ss-prop-shape').onchange = (e) => { const p = this.editablePart(); if (!p) return; p.shape = e.target.value; this.dirty = true; this.refresh(); };
    for (const key of ['w', 'h', 'd']) q(`#ss-prop-${key}`).onchange = (e) => {
      const p = this.editablePart();
      if (!p) return;
      const value = Math.max(0.01, Number(e.target.value) || 0.01);
      p[key] = value;
      this.dirty = true;
      this.refresh();
      this.renderProps();
    };
    q('#ss-prop-name').oninput = (e) => { this.doc.name = { en: e.target.value, pt: e.target.value, ja: e.target.value }; this.root.querySelector('#ss-prop-title').textContent = e.target.value; this.dirty = true; };
    q('#ss-prop-id').onchange = (e) => { this.doc.id = e.target.value.trim() || this.doc.id; this.dirty = true; };
    q('#ss-prop-light').onchange = (e) => { if (e.target.checked) this.doc.light = { color: '#ffd9a0', intensity: 2, distance: 8, at: [0, 1, 0] }; else delete this.doc.light; this.dirty = true; this.refresh(); };
    q('#ss-prop-pickup').onchange = (e) => { if (e.target.checked) this.doc.anchors = { ...(this.doc.anchors || {}), grip: { pos: [0, .4, 0], yaw: 0, pitch: 0, roll: 0 } }; else if (this.doc.anchors) delete this.doc.anchors.grip; this.dirty = true; this.refresh(); this.renderProps(); };
    for (const key of ['yaw', 'pitch', 'roll']) q(`#ss-prop-grip-${key}`).oninput = (e) => { if (!this.doc.anchors?.grip) return; this.doc.anchors.grip[key] = Number(e.target.value) || 0; this.dirty = true; this.refresh(); };
    q('#ss-prop-add-copy').onclick = () => {
      const base = this.registry.list('prop').find((x) => x.doc.id !== this.doc.id && x.doc.source?.type === 'boxes');
      if (!base) return;
      this.parts = JSON.parse(JSON.stringify(base.doc.source.boxes));
      this.dirty = true; this.renderParts(); this.refresh();
    };
    const shapes = q('#ss-prop-shapes');
    SHAPES.forEach((shape) => { const b = document.createElement('button'); b.className = 'ss-button'; b.textContent = shape; b.onclick = () => this.addPart(shape); shapes.appendChild(b); });
  }

  async load(doc) {
    this.doc = JSON.parse(JSON.stringify(doc));
    if (this.doc.source?.type !== 'boxes') this.doc.source = { type: 'boxes', boxes: [{ w: 1, h: 1, d: 1, x: 0, y: .5, z: 0, color: '#4fd1c5' }] };
    this.parts = JSON.parse(JSON.stringify(this.doc.source.boxes));
    this.dirty = false; this.tool = 'select'; this.compareId = null;
    const savedCompare = await getPreference(COMPARE_CHARACTER_KEY, DEFAULT_COMPARE_CHARACTER).catch(() => DEFAULT_COMPARE_CHARACTER);
    this.compareId = this.registry.character(savedCompare)
      ? savedCompare
      : this.registry.character(DEFAULT_COMPARE_CHARACTER)
        ? DEFAULT_COMPARE_CHARACTER
        : this.registry.list('character')[0]?.doc.id || null;
    this.root.querySelector('#ss-prop-title').textContent = localised(this.doc.name, this.doc.id);
    this.stage.clearContent(); this.renderParts(); this.renderProps(); this.refresh();
    this.camera.position.set(3.8, 2.7, 3.8); this.orbit.update(); this.start();
  }

  addPart(shape) { this.parts.push({ w: .6, h: .6, d: .6, x: 0, y: .8, z: 0, color: '#4fd1c5', shape: shape === 'box' ? undefined : shape, n: shape === 'box' ? 1 : 4 }); this.selected = this.parts.length - 1; this.dirty = true; this.renderParts(); this.refresh(); }
  setTool(tool) {
    this.tool = tool;
    this.orbit.mouseButtons = { LEFT: tool === 'select' ? THREE.MOUSE.ROTATE : null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.canvas.style.cursor = tool === 'pen' || tool === 'spray' ? 'crosshair' : tool === 'select' ? 'grab' : 'default';
    for (const name of ['select', 'move', 'rotate', 'scale', 'pen', 'spray']) this.root.querySelector(`#ss-prop-tool-${name}`).classList.toggle('is-active', name === tool);
    this.syncGizmo(); this.updateStatus();
  }
  editablePart(index = this.selected) { const part = this.parts[index]; return part && !part.locked ? part : null; }
  paintOrSelect(e) {
    const rect = this.canvas.getBoundingClientRect(); this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const targets = this.meshes.filter((mesh) => !this.parts[mesh.userData.part]?.locked);
    const hit = this.ray.intersectObjects(targets)[0]; if (!hit) return;
    const i = hit.object.userData.part;
    if (this.tool === 'select' || this.tool === 'move' || this.tool === 'rotate' || this.tool === 'scale') { this.selected = i; this.renderParts(); this.renderProps(); this.syncGizmo(); return; }
    if (this.selected !== i) { this.selected = i; this.renderParts(); this.renderProps(); this.refresh(); }
    this.paintSurface(hit.point);
  }
  stopPainting(e) { this.painting = false; if (this.canvas.hasPointerCapture?.(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId); }
  nearestPaintCell(point, part) {
    let best = null; let bestD = Infinity;
    for (let face = 0; face < FACE_BASIS.length; face++) {
      for (let gy = 0; gy < PAINT_N; gy++) for (let gx = 0; gx < PAINT_N; gx++) {
        cellPoint(part, face, gx, gy, this.paintPoint, this.paintNormal);
        const d = this.paintPoint.distanceToSquared(point);
        if (d < bestD) bestD = d, best = { face, gx, gy };
      }
    }
    return best;
  }
  paintSurface(point) {
    const part = this.editablePart(); if (!part) return;
    const center = this.nearestPaintCell(point, part); if (!center) return;
    if (!part.paint || typeof part.paint !== 'object' || part.paint instanceof Map) part.paint = {};
    const ink = this.root.querySelector('#ss-prop-ink').value;
    const cells = [];
    if (this.brush <= 1) {
      cells.push(center);
    } else {
      const basis = FACE_BASIS[center.face];
      const uSize = Math.hypot(basis.u[0] * part.w, basis.u[1] * part.h, basis.u[2] * part.d) / PAINT_N;
      const vSize = Math.hypot(basis.v[0] * part.w, basis.v[1] * part.h, basis.v[2] * part.d) / PAINT_N;
      const radius = Math.max(uSize, vSize) * this.brush * (this.tool === 'pen' ? 0.8 : 1.25);
      const r2 = radius * radius;
      for (let gy = 0; gy < PAINT_N; gy++) for (let gx = 0; gx < PAINT_N; gx++) {
        cellPoint(part, center.face, gx, gy, this.paintPoint, this.paintNormal);
        if (this.paintPoint.distanceToSquared(point) <= r2) cells.push({ face: center.face, gx, gy });
      }
    }
    let changed = false;
    for (const cell of cells) {
      const key = String(cellIndex(cell.face, cell.gx, cell.gy));
      if (part.paint[key] === ink) continue;
      part.paint[key] = ink; changed = true;
    }
    if (!changed) return;
    // The renderer promotes painted parts to the paint grid on its own. Keep
    // the authored subdivision within the document schema's normal 1..4
    // range; storing PAINT_N here would make saveAll reject an otherwise
    // valid painted object.
    this.dirty = true; this.refresh();
  }
  changeColor(color) { const p = this.editablePart(); if (!p) return; p.color = color; this.dirty = true; this.refresh(); this.renderParts(); }
  syncGizmo() {
    if (!this.gizmo || !this.editablePart() || !['move', 'rotate', 'scale'].includes(this.tool)) { this.gizmo?.detach(); return; }
    const p = this.parts[this.selected];
    this.proxy.position.set(p.x || 0, p.y || 0, p.z || 0);
    this.proxy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
    this.proxy.scale.set(1, 1, 1);
    this.gizmo.setMode(this.tool === 'move' ? 'translate' : this.tool === 'rotate' ? 'rotate' : 'scale');
    this.gizmo.showX = true; this.gizmo.showY = true; this.gizmo.showZ = true;
    this.gizmo.attach(this.proxy);
  }
  commitTransform() {
    const p = this.editablePart();
    if (!p || !['move', 'rotate', 'scale'].includes(this.tool) || this.gizmo.dragging) return;
    if (this.tool === 'scale') {
      p.w = Math.max(0.01, (p.w || 1) * this.proxy.scale.x);
      p.h = Math.max(0.01, (p.h || 1) * this.proxy.scale.y);
      p.d = Math.max(0.01, (p.d || 1) * this.proxy.scale.z);
    } else {
      p.x = this.proxy.position.x; p.y = this.proxy.position.y; p.z = this.proxy.position.z;
      p.rx = this.proxy.rotation.x; p.ry = this.proxy.rotation.y; p.rz = this.proxy.rotation.z;
    }
    this.dirty = true; this.refresh(); this.renderParts(); this.renderProps();
  }
  applyProxyVisual() {
    const mesh = this.meshes[this.selected];
    if (!mesh || !['move', 'rotate', 'scale'].includes(this.tool)) return;
    mesh.position.copy(this.proxy.position);
    mesh.rotation.copy(this.proxy.rotation);
    mesh.scale.copy(this.proxy.scale);
  }
  renderParts() {
    this.partsEl.innerHTML = '';
    this.parts.forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'ss-prop-part-row';
      const b = document.createElement('button'); b.className = `ss-edit-row ${i === this.selected ? 'is-active' : ''} ${p.locked ? 'is-locked' : ''}`; b.textContent = `${i + 1} · ${p.shape || 'box'}`;
      b.onclick = () => { if (p.locked) return; this.selected = i; this.renderParts(); this.renderProps(); this.refresh(); };
      const lock = document.createElement('label'); lock.className = 'ss-prop-lock-part'; lock.title = t('propLock');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!p.locked; input.setAttribute('aria-label', t('propLock'));
      input.onchange = () => {
        p.locked = input.checked;
        if (p.locked && this.selected === i) {
          const next = this.parts.findIndex((part, index) => index !== i && !part.locked);
          if (next >= 0) this.selected = next;
        }
        this.renderParts(); this.renderProps(); this.refresh();
      };
      const icon = document.createElement('span'); icon.textContent = '🔒'; icon.setAttribute('aria-hidden', 'true');
      lock.append(input, icon); row.append(b, lock); this.partsEl.appendChild(row);
    });
  }
  renderProps() {
    const p = this.parts[this.selected]; if (!p) return; const q = (s) => this.root.querySelector(s);
    const locked = !!p.locked;
    for (const id of ['#ss-prop-color', '#ss-prop-opacity', '#ss-prop-shape', '#ss-prop-w', '#ss-prop-h', '#ss-prop-d']) q(id).disabled = locked;
    q('#ss-prop-remove').disabled = this.parts.length <= 1 || locked;
    q('#ss-prop-color').value = p.color || '#a0a0a0'; q('#ss-prop-shape').value = p.shape || 'box'; q('#ss-prop-opacity').value = p.opacity ?? 1; q('#ss-prop-opacity-out').textContent = `${Math.round((p.opacity ?? 1) * 100)}%`;
    q('#ss-prop-w').value = Number(p.w || 1).toFixed(2); q('#ss-prop-h').value = Number(p.h || 1).toFixed(2); q('#ss-prop-d').value = Number(p.d || 1).toFixed(2);
    q('#ss-prop-name').value = localised(this.doc.name, this.doc.id); q('#ss-prop-id').value = this.doc.id;
    q('#ss-prop-light').checked = !!this.doc.light; q('#ss-prop-pickup').checked = !!this.doc.anchors?.grip;
    const g = this.doc.anchors?.grip || {}; for (const k of ['yaw', 'pitch', 'roll']) q(`#ss-prop-grip-${k}`).value = g[k] || 0;
    const character = q('#ss-prop-character');
    character.innerHTML = this.registry.list('character').map((x) => `<option value="${x.doc.id}">${localised(x.doc.name, x.doc.id)}</option>`).join('');
    character.value = this.compareId || DEFAULT_COMPARE_CHARACTER;
    character.onchange = (e) => this.compare(e.target.value);
  }
  removeSelected() {
    if (this.parts.length <= 1 || !this.editablePart()) return;
    if (!confirm(t('propRemoveConfirm'))) return;
    this.parts.splice(this.selected, 1);
    this.selected = Math.min(this.selected, this.parts.length - 1);
    this.dirty = true;
    this.renderParts(); this.refresh(); this.renderProps();
  }
  refresh() {
    this.doc.source.boxes = this.parts; this.doc.opacity = Math.min(...this.parts.map((p) => p.opacity ?? 1)); this.stage.clearContent(); this.meshes = [];
    this.parts.forEach((p, i) => {
      // Keep transforms on the mesh so the Three.js gizmo can update the
      // selected part live while dragging. The saved box still receives the
      // same transform when the edit is committed.
      const local = { ...p, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, color: toHex(p.color, 0xa0a0a0) };
      const m = new THREE.Mesh(buildGeometry([local], true), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: p.opacity ?? 1 }));
      m.position.set(p.x || 0, p.y || 0, p.z || 0); m.rotation.order = 'YXZ'; m.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      m.userData.part = i; m.castShadow = true; this.stage.content.add(m); this.meshes.push(m);
    });
    if (this.doc.light) { const l = new THREE.PointLight(toHex(this.doc.light.color, 0xffd9a0), this.doc.light.intensity ?? 2, this.doc.light.distance ?? 8); l.position.fromArray(this.doc.light.at || [0, 1, 0]); this.stage.content.add(l); }
    if (this.compareId) this.renderCompare();
    this.syncGizmo();
    this.updateStatus();
  }
  updateStatus() {
    const mode = this.tool === 'spray' ? t('propSpray') : this.tool === 'pen' ? t('propPen') : this.tool === 'move' ? t('propMove') : this.tool === 'rotate' ? t('propRotate') : this.tool === 'scale' ? t('propScale') : t('propSelect');
    this.root.querySelector('#ss-prop-status').textContent = `${this.parts.length} ${t('propParts').toLowerCase()} · ${mode}`;
  }
  refreshLanguage() {
    if (!this.doc) return;
    this.root.querySelector('#ss-prop-title').textContent = localised(this.doc.name, this.doc.id);
    this.renderProps();
    this.updateStatus();
  }
  compare(id) {
    if (!this.registry.character(id)) return;
    this.compareId = id;
    this.renderCompare();
    putPreference(COMPARE_CHARACTER_KEY, id).catch(() => {});
  }
  renderCompare() {
    const id = this.compareId;
    const old = this.stage.content.getObjectByName('compare'); if (old) this.stage.content.remove(old);
    const c = this.registry.character(id); if (!c) return;
    const g = buildCharacter(c, c.defaultOutfit); g.name = 'compare'; g.scale.setScalar(.92); g.position.set(1.45, 0, 0); g.rotation.y = Math.PI;
    if (this.doc.anchors?.grip) this.poseHoldingArm(g);
    this.stage.content.add(g);
    if (this.doc.anchors?.grip) {
      const hand = g.userData.pivots?.rHand;
      if (hand) { const held = new THREE.Group(); held.name = 'held-preview'; const m = new THREE.Mesh(buildGeometry(this.parts.map((p) => ({ ...p, color: toHex(p.color, 0xa0a0a0) })), true), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: this.doc.opacity ?? 1 })); const grip = this.doc.anchors.grip; held.position.set(-grip.pos[0], -grip.pos[1], -grip.pos[2]); held.rotation.order = 'YXZ'; held.rotation.set((grip.roll || 0) * DEG, (grip.yaw || 0) * DEG, (grip.pitch || 0) * DEG); held.add(m); hand.add(held); }
    }
  }
  poseHoldingArm(g) {
    const pivots = g.userData.pivots;
    if (!pivots?.rArm || !pivots?.rFore) return;
    // The rig faces +X. The preview character faces -X, toward the object.
    // Positive Z swings an arm toward its face side, so these two bends extend
    // the right arm in front of the torso and leave the hand at the object's
    // grip point instead of keeping it beside the body.
    pivots.rArm.rotation.order = 'YXZ';
    pivots.rFore.rotation.order = 'YXZ';
    pivots.rArm.rotation.z = 0.72;
    pivots.rFore.rotation.z = 0.95;
  }
  resize(w, h) { this.stage.resize(w, h); }
  start() { if (this.raf) return; const loop = () => { if (this.root.hidden) { this.raf = 0; return; } this.orbit.update(); this.stage.render(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
}
