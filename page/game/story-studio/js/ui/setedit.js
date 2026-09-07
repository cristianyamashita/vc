import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Stage, SKY_NAMES } from '../render/stage.js';
import { propObject, scaleTriple, tintOf } from '../stage/build.js';
import { t, localised } from '../i18n.js';
import { thumbnail } from './thumbs.js';

// The visual set editor.
//
// The JSON panel is the honest interface to the format and stays the one that
// can do everything. But laying out a room by typing coordinates is a bad way
// to spend an evening, and "the sofa is a metre into the wall" is something
// you see instantly and compute slowly. So this edits the same document with
// a mouse.
//
// The thing it must never become is a second, parallel format. It loads a
// `set` document, edits the placement list, and writes a `set` document back
// through the same validator every import goes through. Nothing it produces
// is beyond what you could have typed.

const DEG = Math.PI / 180;

/** The authored list is edited, and the expansion is what you see.
 *
 *  A `repeat` block is one entry that draws eight fence panels. Editing the
 *  expansion instead would flatten that row into eight entries the moment you
 *  nudged it — the document would come back longer and dumber than it went
 *  in. So an entry owns a group, the group holds its instances, and moving
 *  the group is what moves the row. */
function instanceCount(entry) {
  return Math.max(1, entry.repeat?.count ?? 1);
}

export class SetEditor {
  constructor(root, { registry, onSave, onCancel }) {
    this.root = root;
    this.registry = registry;
    this.onSave = onSave;
    this.onCancel = onCancel;

    this.canvas = root.querySelector('#ss-edit-canvas');
    this.wrap = root.querySelector('#ss-edit-stage');
    this.paletteEl = root.querySelector('#ss-edit-palette');
    this.searchEl = root.querySelector('#ss-edit-search');
    this.statusEl = root.querySelector('#ss-edit-status');
    this.listEl = root.querySelector('#ss-edit-list');
    this.propsEl = root.querySelector('#ss-edit-props');
    // Every field of the properties box, by the entry field it writes to.
    // Named this way so binding them is one loop rather than twenty lines
    // that each say the same thing about a different number.
    this.fields = {
      x: root.querySelector('#ss-prop-x'), y: root.querySelector('#ss-prop-y'),
      z: root.querySelector('#ss-prop-z'),
      yaw: root.querySelector('#ss-prop-yaw'), pitch: root.querySelector('#ss-prop-pitch'),
      roll: root.querySelector('#ss-prop-roll'),
      sx: root.querySelector('#ss-prop-sx'), sy: root.querySelector('#ss-prop-sy'),
      sz: root.querySelector('#ss-prop-sz'),
      count: root.querySelector('#ss-prop-count'),
      stepx: root.querySelector('#ss-prop-stepx'), stepz: root.querySelector('#ss-prop-stepz'),
    };

    this.stage = new Stage(this.canvas, { shadows: true, fog: false });
    this.scene = this.stage.scene;
    this.camera = this.stage.camera;

    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.maxPolarAngle = Math.PI * 0.495;   // never under the floor
    this.orbit.screenSpacePanning = false;

    this.gizmo = new TransformControls(this.camera, this.canvas);
    this.gizmo.setMode('translate');
    // Three moved the gizmo's visuals onto a helper object partway through
    // the r16x line. Ask for one, and fall back to adding the control itself.
    this.gizmoView = typeof this.gizmo.getHelper === 'function'
      ? this.gizmo.getHelper()
      : this.gizmo;
    this.scene.add(this.gizmoView);

    // What the gizmo actually holds. Dragging the entry's own group would
    // fight the code that lays the group out again from the numbers, and the
    // handle would snap back under the cursor on every frame.
    this.proxy = new THREE.Object3D();
    // YXZ so that reading the proxy's euler back gives exactly the three
    // numbers the document stores: x is roll, y is yaw, z is pitch.
    this.proxy.rotation.order = 'YXZ';
    this.scene.add(this.proxy);

    this.entries = [];
    this.groups = [];
    this.selected = -1;
    this.snap = false;
    this.doc = null;
    this.dirty = false;
    this.raf = 0;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.highlight = new THREE.BoxHelper(new THREE.Object3D(), 0x2ec5b6);
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    const sky = root.querySelector('#ss-edit-sky');
    for (const name of SKY_NAMES) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      sky.appendChild(option);
    }

    this.bindings();
  }

  // ------------------------------------------------------------- listeners

  bindings() {
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
      if (!e.value) this.commitProxy();
    });
    this.gizmo.addEventListener('objectChange', () => this.commitProxy());

    this.canvas.addEventListener('pointerdown', (e) => this.onPick(e));
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;
      const at = this.groundPointAt(e) || [0, 0, 0];
      this.addProp(id, at);
    });

    this.searchEl.addEventListener('input', () => this.renderPalette());

    for (const [key, input] of Object.entries(this.fields)) {
      input.addEventListener('input', () => this.applyField(key, input));
    }
    this.root.querySelector('#ss-prop-uniform').addEventListener('change', () => {
      if (this.root.querySelector('#ss-prop-uniform').checked) this.applyField('sx', this.fields.sx);
    });
    this.root.querySelector('#ss-prop-id').addEventListener('change', (e) => this.renameTo(e.target.value));
    this.root.querySelector('#ss-prop-tint').addEventListener('input', (e) => {
      const entry = this.entries[this.selected];
      if (!entry) return;
      entry.tint = e.target.value;
      this.dirty = true;
      this.refreshEntry();
    });
    this.root.querySelector('#ss-prop-tint-clear').addEventListener('click', () => {
      const entry = this.entries[this.selected];
      if (!entry) return;
      delete entry.tint;
      this.dirty = true;
      this.refreshEntry();
      this.renderProps();
    });
    this.root.querySelector('#ss-prop-lock').addEventListener('click', () => this.toggleLock());

    this.root.querySelector('#ss-edit-move').addEventListener('click', () => this.setMode('translate'));
    this.root.querySelector('#ss-edit-rotate').addEventListener('click', () => this.setMode('rotate'));
    this.root.querySelector('#ss-edit-snap').addEventListener('click', () => this.toggleSnap());
    this.root.querySelector('#ss-edit-duplicate').addEventListener('click', () => this.duplicate());
    this.root.querySelector('#ss-edit-delete').addEventListener('click', () => this.remove());
    this.root.querySelector('#ss-edit-save').addEventListener('click', () => this.save());
    this.root.querySelector('#ss-edit-cancel').addEventListener('click', () => this.onCancel());
    this.root.querySelector('#ss-edit-sky').addEventListener('change', (e) => {
      this.doc.sky = e.target.value;
      this.stage.setSky(this.doc.sky, this.doc.light?.intensity ?? 1);
      this.dirty = true;
      this.report();
    });

    // Blender's keys, because they are the ones in the fingers of anyone who
    // has laid out a scene before: G to move, R to rotate, X to delete.
    this.keys = (e) => {
      if (this.root.hidden) return;
      if (e.target.matches('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 'g') this.setMode('translate');
      else if (k === 'r') this.setMode('rotate');
      else if (k === 'x' || e.key === 'Delete' || e.key === 'Backspace') this.remove();
      else if (k === 'd' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.duplicate(); }
      else if (e.key === 'Escape') this.select(-1);
      else return;
      e.stopPropagation();
    };
    addEventListener('keydown', this.keys, true);
  }

  // ------------------------------------------------------------------ load

  /** Opens a set document. The document is copied, not referenced: cancelling
   *  has to leave the original exactly as it was. */
  async load(setDoc) {
    this.doc = JSON.parse(JSON.stringify(setDoc));
    this.entries = this.doc.props.map((p) => JSON.parse(JSON.stringify(p)));
    this.dirty = false;
    this.selected = -1;

    this.stage.setSky(this.doc.sky, this.doc.light?.intensity ?? 1);
    if (this.doc.light?.sun) this.stage.setSunDirection(this.doc.light.sun);
    this.root.querySelector('#ss-edit-sky').value = this.doc.sky;
    this.root.querySelector('#ss-edit-title').textContent = localised(this.doc.name, this.doc.id);

    this.stage.clearContent();
    this.buildGround();
    await this.rebuild();

    const span = Math.max(this.doc.ground.size[0], this.doc.ground.size[1]);
    this.camera.position.set(span * 0.42, span * 0.34, span * 0.42);
    this.orbit.target.set(0, 0.5, 0);
    this.orbit.update();

    this.renderPalette();
    this.renderList();
    this.renderProps();
    this.report();
    this.start();
  }

  buildGround() {
    const g = this.doc.ground;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(g.size[0], g.size[1]),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(g.color) }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.userData.isGround = true;
    this.stage.content.add(mesh);
    // A metre grid, so "two metres left" is something you can see rather than
    // something you have to measure.
    const grid = new THREE.GridHelper(Math.max(g.size[0], g.size[1]), Math.round(Math.max(g.size[0], g.size[1])), 0x000000, 0x000000);
    grid.material.opacity = 0.13;
    grid.material.transparent = true;
    grid.position.y = 0.01;
    this.stage.content.add(grid);
  }

  /** Draws every entry from scratch. Used on load and after a structural
   *  change; a drag re-lays out only the entry being dragged. */
  async rebuild() {
    for (const group of this.groups) group.parent?.remove(group);
    this.groups = [];
    for (let i = 0; i < this.entries.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      this.groups.push(await this.buildEntry(this.entries[i], i));
    }
    this.refreshHighlight();
  }

  async buildEntry(entry, index) {
    const group = new THREE.Group();
    group.userData.entryIndex = index;
    const doc = this.registry.prop(entry.prop);
    for (let i = 0; i < instanceCount(entry); i++) {
      let object = null;
      try {
        // eslint-disable-next-line no-await-in-loop
        object = doc ? await propObject(doc, (id) => this.registry.blob(id)) : null;
      } catch (_err) {
        object = null;
      }
      if (!object) {
        object = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshLambertMaterial({ color: 0xd81b60 }),
        );
        object.position.y = 0.25;
      } else if (doc) {
        if (doc.yaw) object.rotation.y = doc.yaw * DEG;
        if (doc.scale && doc.scale !== 1) object.scale.setScalar(doc.scale);
      }
      const holder = new THREE.Group();
      holder.add(object);
      // The repeat step is in world axes, exactly as `expandPlacements`
      // applies it, so it must not be spun by the entry's yaw.
      const step = entry.repeat?.step ?? [0, 0, 0];
      holder.position.set(step[0] * i, step[1] * i, step[2] * i);
      holder.rotation.order = 'YXZ';
      holder.rotation.set((entry.roll || 0) * DEG, (entry.yaw || 0) * DEG, (entry.pitch || 0) * DEG);
      const size = scaleTriple(entry.scale);
      holder.scale.set(size[0], size[1], size[2]);
      if (entry.tint) tintOf(object, entry.tint);
      holder.userData.entryIndex = index;
      group.add(holder);
    }
    group.position.set(entry.at[0], entry.at[1], entry.at[2]);
    this.stage.content.add(group);
    return group;
  }

  /** Puts one entry's group back where its numbers say, without rebuilding
   *  its meshes. This is what runs on every frame of a drag. */
  layout(index) {
    const entry = this.entries[index];
    const group = this.groups[index];
    if (!entry || !group) return;
    group.position.set(entry.at[0], entry.at[1], entry.at[2]);
    const size = scaleTriple(entry.scale);
    for (const holder of group.children) {
      holder.rotation.set((entry.roll || 0) * DEG, (entry.yaw || 0) * DEG, (entry.pitch || 0) * DEG);
      holder.scale.set(size[0], size[1], size[2]);
    }
  }

  // ------------------------------------------------------------ selection

  onPick(e) {
    if (this.gizmo.dragging) return;
    if (e.button !== 0) return;
    const hit = this.pickEntry(e);
    this.select(hit);
  }

  pickEntry(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.groups, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.entryIndex === undefined) o = o.parent;
      if (o) return o.userData.entryIndex;
    }
    return -1;
  }

  groundPointAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.ground, point)) return null;
    return [round(point.x), 0, round(point.z)];
  }

  select(index) {
    this.selected = index;
    if (index < 0 || !this.groups[index]) {
      this.gizmo.detach();
      this.highlight.visible = false;
    } else if (this.entries[index].locked) {
      // Selectable but not draggable: you still need to reach it to unlock
      // it, read its numbers, or copy it.
      this.gizmo.detach();
      this.refreshHighlight();
    } else {
      const entry = this.entries[index];
      this.proxy.position.set(entry.at[0], entry.at[1], entry.at[2]);
      this.proxy.rotation.set((entry.roll || 0) * DEG, (entry.yaw || 0) * DEG, (entry.pitch || 0) * DEG);
      this.gizmo.attach(this.proxy);
      this.refreshHighlight();
    }
    this.renderList();
    this.renderProps();
    this.report();
  }

  refreshHighlight() {
    const group = this.groups[this.selected];
    if (!group) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.setFromObject(group);
    this.highlight.visible = true;
  }

  /** The gizmo moved: write the proxy's transform back into the document. */
  commitProxy() {
    const entry = this.entries[this.selected];
    if (!entry || entry.locked) return;
    const p = this.proxy.position;
    const step = this.snap ? 0.25 : 0.01;
    entry.at = [snapTo(p.x, step), snapTo(p.y, step), snapTo(p.z, step)];
    const turn = this.snap ? 15 : 1;
    entry.roll = snapTo(degrees(this.proxy.rotation.x), turn);
    entry.yaw = snapTo(degrees(this.proxy.rotation.y), turn);
    entry.pitch = snapTo(degrees(this.proxy.rotation.z), turn);
    // Snapping is applied to the numbers, so the handle is put back on them
    // rather than drifting a hair off what the document now says.
    this.proxy.position.set(entry.at[0], entry.at[1], entry.at[2]);
    this.proxy.rotation.set(entry.roll * DEG, entry.yaw * DEG, entry.pitch * DEG);
    this.layout(this.selected);
    this.refreshHighlight();
    this.dirty = true;
    this.report();
  }

  // -------------------------------------------------------------- editing

  setMode(mode) {
    // All three handles in both modes: up and down is a real place to put
    // something — a picture on a wall, a lamp on a shelf — and a prop that
    // can only be spun about its upright cannot be a leaning ladder.
    this.gizmo.setMode(mode);
    this.gizmo.showX = true;
    this.gizmo.showY = true;
    this.gizmo.showZ = true;
    this.root.querySelector('#ss-edit-move').classList.toggle('is-active', mode === 'translate');
    this.root.querySelector('#ss-edit-rotate').classList.toggle('is-active', mode === 'rotate');
  }

  toggleSnap() {
    this.snap = !this.snap;
    this.root.querySelector('#ss-edit-snap').classList.toggle('is-active', this.snap);
    this.gizmo.setTranslationSnap(this.snap ? 0.25 : null);
    this.gizmo.setRotationSnap(this.snap ? 15 * DEG : null);
    this.report();
  }

  freeId(propId) {
    const taken = new Set(this.entries.map((e) => e.id));
    const stem = String(propId).replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 40) || 'item';
    if (!taken.has(stem)) return stem;
    for (let n = 2; n < 9999; n += 1) {
      if (!taken.has(`${stem}.${n}`)) return `${stem}.${n}`;
    }
    return `${stem}.${Date.now().toString(36)}`;
  }

  async addProp(propId, at) {
    if (!this.registry.prop(propId)) return;
    const entry = { id: this.freeId(propId), prop: propId, at, yaw: 0, scale: 1 };
    this.entries.push(entry);
    const index = this.entries.length - 1;
    this.groups.push(await this.buildEntry(entry, index));
    this.dirty = true;
    this.select(index);
    this.renderList();
  }

  async duplicate() {
    const entry = this.entries[this.selected];
    if (!entry) return;
    const copy = JSON.parse(JSON.stringify(entry));
    copy.id = this.freeId(entry.prop);
    // Offset by a little, so the copy is visibly a second object rather than
    // sitting invisibly inside the first and looking like nothing happened.
    copy.at = [round(entry.at[0] + 0.6), entry.at[1], round(entry.at[2] + 0.6)];
    this.entries.push(copy);
    const index = this.entries.length - 1;
    this.groups.push(await this.buildEntry(copy, index));
    this.dirty = true;
    this.select(index);
    this.renderList();
  }

  async remove() {
    if (this.selected < 0) return;
    if (this.entries[this.selected].locked) {
      this.statusEl.textContent = t('editLockedHint');
      return;
    }
    this.entries.splice(this.selected, 1);
    this.gizmo.detach();
    this.selected = -1;
    this.dirty = true;
    await this.rebuild();
    this.renderList();
    this.report();
  }

  // ------------------------------------------------------------------- UI

  /** Rebuilds just the selected entry's meshes. Position, angle and size are
   *  laid out without this; a tint or a repeat count changes what is there. */
  async refreshEntry() {
    const index = this.selected;
    const entry = this.entries[index];
    if (!entry) return;
    this.groups[index]?.parent?.remove(this.groups[index]);
    this.groups[index] = await this.buildEntry(entry, index);
    this.refreshHighlight();
    this.report();
  }

  toggleLock() {
    const entry = this.entries[this.selected];
    if (!entry) return;
    if (entry.locked) delete entry.locked;
    else entry.locked = true;
    this.dirty = true;
    this.select(this.selected);       // re-attaches or drops the gizmo
  }

  /** A placement id is what a story says to remove, repaint or sit somebody
   *  on, so renaming one is a real edit and duplicates have to be refused. */
  renameTo(raw) {
    const entry = this.entries[this.selected];
    if (!entry) return;
    const want = String(raw || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 60);
    if (!want || want === entry.id) {
      this.renderProps();
      return;
    }
    if (this.entries.some((e, i) => i !== this.selected && e.id === want)) {
      this.statusEl.textContent = `${want}: ${t('problems').toLowerCase()}`;
      this.renderProps();
      return;
    }
    entry.id = want;
    this.dirty = true;
    this.renderList();
    this.renderProps();
    this.report();
  }

  /** One numeric field changed. Everything the panel writes goes through
   *  here, so there is one place that decides what a field means and one
   *  place that puts the scene back in step with the numbers. */
  applyField(key, input) {
    const entry = this.entries[this.selected];
    if (!entry) return;
    if (entry.locked) {
      // Put the box back on what the document says. A refused edit that
      // leaves the wrong number on screen is worse than no lock at all.
      this.renderProps();
      return;
    }
    const v = Number(input.value);
    if (!Number.isFinite(v)) return;
    const size = scaleTriple(entry.scale);
    switch (key) {
      case 'x': case 'y': case 'z':
        entry.at[{ x: 0, y: 1, z: 2 }[key]] = v;
        break;
      case 'yaw': case 'pitch': case 'roll':
        entry[key] = v;
        break;
      case 'sx': case 'sy': case 'sz': {
        const linked = this.root.querySelector('#ss-prop-uniform').checked;
        const clamped = Math.max(0.01, Math.min(100, v));
        if (linked) {
          entry.scale = clamped;
        } else {
          size[{ sx: 0, sy: 1, sz: 2 }[key]] = clamped;
          entry.scale = size;
        }
        break;
      }
      case 'count': case 'stepx': case 'stepz': {
        const count = Math.max(1, Math.round(Number(this.fields.count.value) || 1));
        const step = [
          Number(this.fields.stepx.value) || 0, 0, Number(this.fields.stepz.value) || 0,
        ];
        if (count > 1) entry.repeat = { count: Math.min(200, count), step };
        else delete entry.repeat;
        this.dirty = true;
        this.refreshEntry();       // the instance count changed
        this.renderList();
        return;
      }
      default:
        return;
    }
    this.dirty = true;
    this.layout(this.selected);
    // The gizmo has to follow the numbers, or the handle sits where the
    // object used to be and the next drag jumps it back there.
    this.proxy.position.set(entry.at[0], entry.at[1], entry.at[2]);
    this.proxy.rotation.set((entry.roll || 0) * DEG, (entry.yaw || 0) * DEG, (entry.pitch || 0) * DEG);
    this.refreshHighlight();
    if (key.startsWith('s')) this.syncSizeFields(entry);
    this.report();
  }

  syncSizeFields(entry) {
    const size = scaleTriple(entry.scale);
    const linked = this.root.querySelector('#ss-prop-uniform').checked;
    if (!linked) return;
    this.fields.sy.value = round(size[1]);
    this.fields.sz.value = round(size[2]);
  }

  /** Fills the properties box from the selected entry, or hides it. */
  renderProps() {
    const entry = this.entries[this.selected];
    this.propsEl.hidden = !entry;
    if (!entry) return;
    const locked = !!entry.locked;
    const size = scaleTriple(entry.scale);
    const set = (el, v) => { if (document.activeElement !== el) el.value = v; };

    this.root.querySelector('#ss-prop-of').textContent = entry.prop;
    set(this.root.querySelector('#ss-prop-id'), entry.id);
    set(this.fields.x, round(entry.at[0]));
    set(this.fields.y, round(entry.at[1]));
    set(this.fields.z, round(entry.at[2]));
    set(this.fields.yaw, Math.round(entry.yaw || 0));
    set(this.fields.pitch, Math.round(entry.pitch || 0));
    set(this.fields.roll, Math.round(entry.roll || 0));
    set(this.fields.sx, round(size[0]));
    set(this.fields.sy, round(size[1]));
    set(this.fields.sz, round(size[2]));
    set(this.fields.count, instanceCount(entry));
    set(this.fields.stepx, round(entry.repeat?.step?.[0] ?? 0));
    set(this.fields.stepz, round(entry.repeat?.step?.[2] ?? 0));
    this.root.querySelector('#ss-prop-tint').value = entry.tint || '#ffffff';

    const lock = this.root.querySelector('#ss-prop-lock');
    lock.textContent = locked ? `🔒 ${t('editUnlock')}` : `🔓 ${t('editLock')}`;
    lock.classList.toggle('is-active', locked);
    // Every field the lock is supposed to protect, disabled together: a lock
    // that only stopped the gizmo would be a lock you could type straight
    // through.
    for (const el of this.propsEl.querySelectorAll('input')) {
      if (el.id !== 'ss-prop-uniform') el.disabled = locked;
    }
    this.root.querySelector('#ss-prop-tint-clear').disabled = locked;
  }

  renderPalette() {
    const q = (this.searchEl.value || '').trim().toLowerCase();
    const list = this.registry.list('prop')
      .filter(({ doc }) => !q || doc.id.includes(q) || localised(doc.name, doc.id).toLowerCase().includes(q));
    this.paletteEl.innerHTML = '';
    for (const { doc } of list) {
      const item = document.createElement('button');
      item.className = 'ss-pal-item';
      item.draggable = true;
      item.title = `${localised(doc.name, doc.id)} — ${doc.id}`;
      const img = document.createElement('img');
      img.alt = '';
      img.dataset.prop = doc.id;
      const label = document.createElement('span');
      label.textContent = localised(doc.name, doc.id);
      item.append(img, label);
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', doc.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      // Clicking adds it in the middle of what you are looking at, which is
      // the shorter path when you already know what you want.
      item.addEventListener('click', () => {
        const c = this.orbit.target;
        this.addProp(doc.id, [round(c.x), 0, round(c.z)]);
      });
      this.paletteEl.appendChild(item);
    }
    this.fillThumbs();
  }

  /** Draws the palette pictures, a few at a time.
   *
   *  In chunks with a timer between them rather than one per animation frame:
   *  a hidden or backgrounded tab stops painting, and the queue would stall
   *  with the palette half empty — the pictures are not animation, they are
   *  work that has to finish. */
  fillThumbs() {
    const token = {};
    this.thumbJob = token;
    this.thumbCache = this.thumbCache || new Map();
    const pending = [...this.paletteEl.querySelectorAll('img[data-prop]')];
    const run = async () => {
      let since = performance.now();
      while (pending.length) {
        if (this.thumbJob !== token) return;      // a new search superseded us
        const img = pending.shift();
        const id = img.dataset.prop;
        if (!this.thumbCache.has(id)) {
          const doc = this.registry.prop(id);
          // eslint-disable-next-line no-await-in-loop
          this.thumbCache.set(id, doc ? await thumbnail(doc, (b) => this.registry.blob(b)) : null);
        }
        const url = this.thumbCache.get(id);
        if (url) img.src = url;
        else img.classList.add('is-blank');
        // Yield about every 12 ms so the editor stays responsive while the
        // palette fills in behind it.
        if (performance.now() - since > 12) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 0));
          since = performance.now();
        }
      }
      this.thumbJob = null;
    };
    run();
  }

  renderList() {
    this.listEl.innerHTML = '';
    for (const [i, entry] of this.entries.entries()) {
      const row = document.createElement('button');
      row.className = `ss-edit-row${i === this.selected ? ' is-active' : ''}`;
      const n = instanceCount(entry);
      row.textContent = `${entry.locked ? '🔒 ' : ''}${entry.id}${n > 1 ? ` ×${n}` : ''}`;
      row.title = entry.prop;
      row.addEventListener('click', () => this.select(i));
      this.listEl.appendChild(row);
    }
  }

  report() {
    const entry = this.entries[this.selected];
    const bits = [`${this.entries.length} ${t('props').toLowerCase()}`];
    if (entry) {
      const lean = entry.pitch || entry.roll
        ? ` · ${Math.round(entry.pitch || 0)}°/${Math.round(entry.roll || 0)}°`
        : '';
      bits.push(`${entry.id} · ${entry.at[0].toFixed(2)}, ${entry.at[1].toFixed(2)}, ${entry.at[2].toFixed(2)}`
        + ` · ${Math.round(entry.yaw || 0)}°${lean}`);
    } else {
      bits.push(t('editPickHint'));
    }
    if (entry?.locked) bits.push(t('editLocked'));
    if (this.snap) bits.push(t('editSnapOn'));
    this.statusEl.textContent = bits.join('  ·  ');
  }

  // ----------------------------------------------------------------- save

  /** The document this editor produces. Field for field a `set`, because it
   *  goes back through the same validator an imported one does. */
  build() {
    return {
      ...this.doc,
      kind: 'set',
      version: 1,
      props: this.entries.map((e) => {
        const out = { id: e.id, prop: e.prop, at: e.at, yaw: e.yaw || 0 };
        // Only when they are doing something: a document full of `pitch: 0`
        // is harder to read for no gain.
        if (e.pitch) out.pitch = e.pitch;
        if (e.roll) out.roll = e.roll;
        const uniform = !Array.isArray(e.scale);
        if (!uniform || (e.scale && e.scale !== 1)) out.scale = e.scale;
        if (e.tint) out.tint = e.tint;
        if (e.locked) out.locked = true;
        if (e.repeat) out.repeat = e.repeat;
        return out;
      }),
    };
  }

  save() {
    this.dirty = false;
    this.onSave(this.build());
  }

  // ------------------------------------------------------------ lifecycle

  start() {
    if (this.raf) return;
    const loop = () => {
      this.orbit.update();
      this.stage.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.thumbJob = null;
  }

  resize(w, h) {
    this.stage.resize(w, h);
  }
}

function round(v) {
  return Math.round(v * 100) / 100;
}

function snapTo(v, step) {
  return Math.round(v / step) * step;
}

/** Radians to whole degrees in 0..360, so the document never carries -179.99
 *  where 180 was meant. */
function degrees(rad) {
  const d = (rad / DEG) % 360;
  return d < 0 ? d + 360 : d;
}
