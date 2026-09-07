import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Playback } from '../render/playback.js';
import { t, localised } from '../i18n.js';
import { thumbnail } from './thumbs.js';

// The visual story editor.
//
// A set is a floor plan and a story is a schedule, so this is a different
// problem from the set editor: the thing being edited is *when*, and no
// amount of dragging in three dimensions shows you that. Hence a timeline
// along the bottom, one lane per actor, and a stage that shows the film at
// whatever instant the playhead is on.
//
// The stage is the player. Not a lookalike — the actual `Playback`, compiling
// through the actual compiler, so what you are looking at while you edit is
// what will play. The compiler hands back the schedule it resolved (`t`,
// `after`, and "follows this actor's previous line" all become numbers there)
// and the timeline draws blocks straight from it. Working those times out a
// second time here is exactly how an editor and its format drift apart.

const CHAR_ROW = 'character';
const LANE_H = 27;
const NAME_W = 84;

/** Fields worth showing for each kind of action, in the order they read.
 *  Driven by the action document's own `type`, so an action added to the
 *  library gets a sensible form without this file being touched. */
const FIELDS_BY_TYPE = {
  move: ['to', 'speed', 'facing'],
  posture: ['on', 'anchor', 'face', 'side', 'facing', 'reps'],
  overlay: ['reps', 'side', 'facing'],
  turn: ['facing', 'yaw'],
  speech: ['text', 'facing'],
  wait: ['facing'],
  hold: ['prop', 'hand', 'grip', 'facing'],
  camera: ['at', 'look', 'fov', 'glide'],
  cameraFollow: ['target'],
  stage: ['id', 'at', 'yaw', 'arc', 'sky'],
};

export class StoryEditor {
  constructor(root, { registry, onSave, onCancel }) {
    this.root = root;
    this.registry = registry;
    this.onSave = onSave;
    this.onCancel = onCancel;

    this.canvas = root.querySelector('#ss-story-canvas');
    this.wrap = root.querySelector('#ss-story-stage');
    this.paletteEl = root.querySelector('#ss-story-palette');
    this.searchEl = root.querySelector('#ss-story-search');
    this.listEl = root.querySelector('#ss-story-list');
    this.propsEl = root.querySelector('#ss-story-props');
    this.lanesEl = root.querySelector('#ss-tl-lanes');
    this.statusEl = root.querySelector('#ss-story-status');
    this.setEl = root.querySelector('#ss-story-set');

    this.playback = new Playback(this.canvas, root.querySelector('#ss-story-labels'));
    this.stage = this.playback.stage;

    // Two cameras in one: the story's, which is what the film looks like, and
    // a free one for reaching round the back of things. The film's framing is
    // the default because that is the shot being made.
    this.orbit = new OrbitControls(this.stage.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.495;
    this.orbit.enabled = false;
    this.freeLook = false;

    this.doc = null;
    this.tab = CHAR_ROW;
    this.pick = null;          // { kind: 'cast'|'edit'|'entry', index }
    this.dirty = false;
    this.raf = 0;
    this.thumbJob = null;
    this.thumbCache = new Map();
    this.pxPerSecond = 46;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.bindings();
  }

  // ------------------------------------------------------------- listeners

  bindings() {
    this.searchEl.addEventListener('input', () => this.renderPalette());
    for (const b of this.root.querySelectorAll('.ss-story-tabs button')) {
      b.addEventListener('click', () => {
        this.tab = b.dataset.kind;
        for (const other of this.root.querySelectorAll('.ss-story-tabs button')) {
          other.classList.toggle('is-active', other === b);
        }
        this.renderPalette();
      });
    }

    this.setEl.addEventListener('change', () => this.changeSet(this.setEl.value));
    this.root.querySelector('#ss-story-shot').addEventListener('click', () => this.toggleFreeLook());
    this.root.querySelector('#ss-story-play').addEventListener('click', () => this.togglePlay());
    this.root.querySelector('#ss-story-save').addEventListener('click', () => this.save());
    this.root.querySelector('#ss-story-cancel').addEventListener('click', () => this.onCancel());
    this.root.querySelector('#ss-tl-add').addEventListener('click', () => this.addAction());
    this.root.querySelector('#ss-tl-dup').addEventListener('click', () => this.duplicateEntry());
    this.root.querySelector('#ss-tl-del').addEventListener('click', () => this.deleteSelected());

    this.canvas.addEventListener('pointerdown', (e) => this.pickOnStage(e));
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const [kind, id] = raw.split(':');
      const at = this.groundPointAt(e) || [0, 0, 0];
      if (kind === CHAR_ROW) this.addCharacter(id, at);
      else this.addObject(id, at);
    });

    this.playback.onTick = (time) => {
      this.root.querySelector('#ss-tl-clock').textContent = clock(time);
      this.movePlayhead(time);
    };
  }

  // ------------------------------------------------------------------ load

  async load(storyDoc) {
    this.doc = JSON.parse(JSON.stringify(storyDoc));
    this.dirty = false;
    this.pick = null;
    this.root.querySelector('#ss-story-title').textContent = localised(this.doc.name, this.doc.id);

    this.setEl.innerHTML = '';
    for (const { doc } of this.registry.list('set')) {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = localised(doc.name, doc.id);
      this.setEl.appendChild(option);
    }
    this.setEl.value = this.doc.set;

    await this.reload();
    this.renderPalette();
    this.renderList();
    this.renderProps();
    this.start();
  }

  /** The heavy path: rebuilds the set, the cast and every prop. Used when the
   *  scene itself changed, never for a retime. */
  async reload() {
    const res = await this.playback.load(this.doc, this.registry);
    this.report(res);
    this.playback.pause();
    this.playback.seek(this.playback.time || 0);
    this.renderTimeline();
    return res;
  }

  /** The light path: the same story with different times. */
  refresh() {
    const res = this.playback.recompile(this.doc);
    this.report(res);
    this.renderTimeline();
    return res;
  }

  report(res) {
    if (res && !res.ok) {
      this.statusEl.textContent = `${t('problems')}: ${res.errors.map((e) => `${e.path} ${e.message}`).join('; ')}`;
      this.statusEl.classList.add('is-bad');
      return;
    }
    this.statusEl.classList.remove('is-bad');
    const warnings = this.playback.warnings || [];
    if (warnings.length) {
      this.statusEl.textContent = warnings.map((w) => `${w.path} ${w.message}`).join(' · ');
      return;
    }
    const n = this.doc.cast.length;
    const m = this.doc.timeline.length;
    this.statusEl.textContent = `${n} ${t('castLabel').toLowerCase()} · ${m} ${t('actionsLabel').toLowerCase()}`
      + `${this.playback.film ? ` · ${clock(this.playback.film.duration)}` : ''}`;
  }

  // ---------------------------------------------------------------- adding

  freeId(stem, taken) {
    const base = String(stem).replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 40) || 'item';
    if (!taken.has(base)) return base;
    for (let n = 2; n < 9999; n += 1) if (!taken.has(`${base}.${n}`)) return `${base}.${n}`;
    return `${base}.${Date.now().toString(36)}`;
  }

  async addCharacter(characterId, at) {
    const doc = this.registry.character(characterId);
    if (!doc) return;
    const id = this.freeId(characterId, new Set(this.doc.cast.map((c) => c.id)));
    this.doc.cast.push({ id, character: characterId, outfit: doc.defaultOutfit, at, yaw: 0 });
    this.dirty = true;
    await this.reload();
    this.select({ kind: 'cast', index: this.doc.cast.length - 1 });
    this.renderList();
  }

  async addObject(propId, at) {
    if (!this.registry.prop(propId)) return;
    const taken = new Set(this.doc.setEdits.filter((e) => e.op === 'add').map((e) => e.id));
    const id = this.freeId(propId, taken);
    this.doc.setEdits.push({ op: 'add', prop: propId, id, at, yaw: 0 });
    this.dirty = true;
    await this.reload();
    this.select({ kind: 'edit', index: this.doc.setEdits.length - 1 });
    this.renderList();
  }

  async changeSet(setId) {
    if (!this.registry.get('set', setId) || setId === this.doc.set) return;
    this.doc.set = setId;
    // The `remove` and `tint` edits name placements of the old set, which the
    // new one has never heard of. Dropping them beats leaving edits that
    // quietly do nothing; the objects the story added are kept, because they
    // belong to the story rather than to the set.
    this.doc.setEdits = this.doc.setEdits.filter((e) => e.op === 'add');
    this.dirty = true;
    await this.reload();
    this.renderList();
    this.renderProps();
  }

  /** A new timeline entry for whoever is selected, at the playhead. */
  addAction() {
    const actor = this.selectedActorId();
    const at = Math.round(this.playback.time * 10) / 10;
    const entry = actor
      ? { t: at, actor, do: 'wait', for: 2 }
      : { t: at, do: 'cameraTo', at: [...this.doc.camera.at], look: [...this.doc.camera.look], fov: this.doc.camera.fov, for: 2 };
    this.doc.timeline.push(entry);
    this.dirty = true;
    this.refresh();
    this.select({ kind: 'entry', index: this.doc.timeline.length - 1 });
  }

  duplicateEntry() {
    if (this.pick?.kind !== 'entry') return;
    const src = this.doc.timeline[this.pick.index];
    const sched = this.scheduleOf(this.pick.index);
    const copy = JSON.parse(JSON.stringify(src));
    copy.t = round1((sched ? sched.start + Math.max(sched.dur, 0.5) : this.playback.time));
    delete copy.cue;
    this.doc.timeline.push(copy);
    this.dirty = true;
    this.refresh();
    this.select({ kind: 'entry', index: this.doc.timeline.length - 1 });
  }

  async deleteSelected() {
    if (!this.pick || this.pick.kind === 'camera') return;
    if (this.pick.kind === 'entry') {
      this.doc.timeline.splice(this.pick.index, 1);
      this.pick = null;
      this.dirty = true;
      this.refresh();
      this.renderProps();
      return;
    }
    if (this.pick.kind === 'cast') {
      const id = this.doc.cast[this.pick.index].id;
      this.doc.cast.splice(this.pick.index, 1);
      // Their lines go with them, or the story references an actor who is no
      // longer in it and refuses to compile.
      this.doc.timeline = this.doc.timeline.filter((e) => e.actor !== id);
    } else {
      this.doc.setEdits.splice(this.pick.index, 1);
    }
    this.pick = null;
    this.dirty = true;
    await this.reload();
    this.renderList();
    this.renderProps();
  }

  // ------------------------------------------------------------- selection

  selectedActorId() {
    if (this.pick?.kind === 'camera') return null;
    if (this.pick?.kind === 'cast') return this.doc.cast[this.pick.index]?.id || null;
    if (this.pick?.kind === 'entry') return this.doc.timeline[this.pick.index]?.actor || null;
    return null;
  }

  select(pick) {
    this.pick = pick;
    // Nothing else shows the opening framing: by the second second some
    // `cameraTo` has usually taken over.
    if (pick?.kind === 'camera' && this.playback.time > 0.01) this.seek(0);
    this.renderList();
    this.renderTimeline();
    this.renderProps();
  }

  pickOnStage(e) {
    if (this.freeLook || e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.stage.camera);
    const meshes = [...this.playback.actors.entries()];
    const hits = this.ray.intersectObjects(meshes.map(([, m]) => m), true);
    if (!hits.length) return;
    let o = hits[0].object;
    while (o && !meshes.some(([, m]) => m === o)) o = o.parent;
    if (!o) return;
    const id = meshes.find(([, m]) => m === o)?.[0];
    const index = this.doc.cast.findIndex((c) => c.id === id);
    if (index >= 0) this.select({ kind: 'cast', index });
  }

  groundPointAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.stage.camera);
    const point = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!this.ray.ray.intersectPlane(plane, point)) return null;
    return [round1(point.x), 0, round1(point.z)];
  }

  // ----------------------------------------------------------- the stage

  toggleFreeLook() {
    this.freeLook = !this.freeLook;
    this.orbit.enabled = this.freeLook;
    const button = this.root.querySelector('#ss-story-shot');
    button.classList.toggle('is-active', this.freeLook);
    if (this.freeLook) {
      // Start the free camera exactly where the film's camera is, so turning
      // it on does not throw you somewhere else in the room.
      const frame = this.playback.film?.sample(this.playback.time);
      const look = Array.isArray(frame?.camera?.look) ? frame.camera.look : [0, 1, 0];
      this.orbit.target.set(look[0], look[1], look[2]);
      this.orbit.update();
    } else {
      this.playback.seek(this.playback.time);
    }
  }

  togglePlay() {
    if (this.playback.playing) this.playback.pause();
    else this.playback.play();
    this.root.querySelector('#ss-story-play').textContent = this.playback.playing ? '❙❙' : '▶';
  }

  seek(time) {
    this.playback.pause();
    this.root.querySelector('#ss-story-play').textContent = '▶';
    this.playback.seek(time);
    this.root.querySelector('#ss-tl-clock').textContent = clock(this.playback.time);
    this.movePlayhead(this.playback.time);
  }

  // -------------------------------------------------------------- timeline

  scheduleOf(index) {
    return this.playback.film?.schedule?.find((s) => s.index === index) || null;
  }

  laneOf(entry) {
    if (entry.actor) return entry.actor;
    const spec = this.registry.action(entry.do);
    if (spec?.category === 'group') return '·group';
    if (spec?.type === 'camera' || spec?.type === 'cameraFollow') return '·camera';
    return '·stage';
  }

  renderTimeline() {
    const film = this.playback.film;
    this.lanesEl.innerHTML = '';
    if (!film) return;
    const duration = Math.max(film.duration, 1);
    const width = Math.max(320, duration * this.pxPerSecond);

    const ruler = document.createElement('div');
    ruler.className = 'ss-tl-ruler';
    ruler.style.width = `${width}px`;
    for (let s = 0; s <= duration; s += 5) {
      const tick = document.createElement('span');
      tick.className = 'ss-tl-tick';
      tick.style.left = `${(s / duration) * 100}%`;
      tick.textContent = `${s}s`;
      ruler.appendChild(tick);
    }
    ruler.addEventListener('pointerdown', (e) => {
      const r = ruler.getBoundingClientRect();
      this.seek(((e.clientX - r.left) / r.width) * duration);
    });
    this.lanesEl.appendChild(ruler);

    // A lane for everyone in the cast, then the shared ones. Actors first and
    // always all of them, so an actor with nothing to do still has a row to
    // drop an action into.
    const lanes = [...this.doc.cast.map((c) => c.id), '·group', '·camera', '·stage'];
    const names = { '·group': t('groupAction'), '·camera': t('editCamera'), '·stage': t('editStage') };
    const byLane = new Map(lanes.map((k) => [k, []]));
    for (const [i, e] of this.doc.timeline.entries()) {
      const key = this.laneOf(e);
      if (byLane.has(key)) byLane.get(key).push(i);
    }

    for (const key of lanes) {
      const lane = document.createElement('div');
      lane.className = 'ss-tl-lane';
      const name = document.createElement('span');
      name.className = 'ss-tl-name';
      name.textContent = names[key] || key;
      const track = document.createElement('div');
      track.className = 'ss-tl-track';
      track.style.width = `${width}px`;
      track.style.flex = `0 0 ${width}px`;
      track.addEventListener('pointerdown', (e) => {
        if (e.target !== track) return;
        const r = track.getBoundingClientRect();
        this.seek(((e.clientX - r.left) / r.width) * duration);
      });

      for (const i of byLane.get(key)) {
        track.appendChild(this.blockFor(i, duration, width));
      }
      lane.append(name, track);
      this.lanesEl.appendChild(lane);
    }

    this.playhead = document.createElement('div');
    this.playhead.className = 'ss-tl-head-line';
    this.lanesEl.appendChild(this.playhead);
    this.movePlayhead(this.playback.time);
  }

  blockFor(index, duration, width) {
    const entry = this.doc.timeline[index];
    const sched = this.scheduleOf(index);
    const start = sched ? sched.start : 0;
    const dur = Math.max(sched ? sched.dur : 0.4, 0.35);
    const spec = this.registry.action(entry.do);

    const block = document.createElement('button');
    block.type = 'button';
    block.className = 'ss-tl-block';
    if (spec?.type === 'camera' || spec?.type === 'cameraFollow') block.classList.add('is-camera');
    else if (spec?.type === 'stage') block.classList.add('is-stage');
    else if (spec?.type === 'speech') block.classList.add('is-speech');
    if (this.pick?.kind === 'entry' && this.pick.index === index) block.classList.add('is-active');
    block.style.left = `${(start / duration) * width}px`;
    block.style.width = `${Math.max(14, (dur / duration) * width)}px`;
    block.textContent = entry.do;
    block.title = `${entry.do} · ${start.toFixed(2)}s → ${(start + dur).toFixed(2)}s`;

    const grip = document.createElement('span');
    grip.className = 'ss-tl-grip';
    block.appendChild(grip);

    block.addEventListener('click', () => this.select({ kind: 'entry', index }));
    block.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const resizing = e.target === grip;
      const perSecond = width / duration;
      const from = e.clientX;
      const startT = start;
      const startDur = sched ? sched.dur : 1;
      const move = (ev) => {
        const delta = (ev.clientX - from) / perSecond;
        if (resizing) {
          // `for` is what an action's own length means; not every action has
          // one, but giving it one is a legitimate thing to say.
          entry.for = Math.max(0.1, round1(startDur + delta));
        } else {
          // Dragging pins the entry. Without `t` it followed whatever came
          // before it for that actor, and there is no honest way to drag
          // something whose time is somebody else's business.
          entry.t = Math.max(0, round1(startT + delta));
          delete entry.after;
        }
        this.dirty = true;
        this.refresh();
        this.select({ kind: 'entry', index });
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      e.preventDefault();
    });
    return block;
  }

  movePlayhead(time) {
    if (!this.playhead || !this.playback.film) return;
    const duration = Math.max(this.playback.film.duration, 1);
    const width = Math.max(320, duration * this.pxPerSecond);
    this.playhead.style.left = `${NAME_W + (time / duration) * width}px`;
    this.playhead.style.height = `${this.lanesEl.scrollHeight}px`;
  }

  // ------------------------------------------------------------- side list

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
      let since = performance.now();
      while (pending.length) {
        if (this.thumbJob !== token) return;
        const img = pending.shift();
        const key = img.dataset.thumb;
        if (!this.thumbCache.has(key)) {
          const [kind, id] = key.split(':');
          // A character has no `source`, so it is drawn as the one prop-shaped
          // thing it does have: its own body, baked to boxes.
          const doc = kind === CHAR_ROW ? this.characterAsProp(id) : this.registry.prop(id);
          // eslint-disable-next-line no-await-in-loop
          this.thumbCache.set(key, doc ? await thumbnail(doc, (b) => this.registry.blob(b)) : null);
        }
        const url = this.thumbCache.get(key);
        if (url) img.src = url;
        else img.classList.add('is-blank');
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

  characterAsProp(id) {
    const doc = this.registry.character(id);
    if (!doc) return null;
    const parts = this.charParts(doc);
    if (!parts) return null;
    return {
      id: `char.${id}`,
      source: { type: 'boxes', boxes: parts },
      scale: 1,
      yaw: 0,
    };
  }

  /** Set by the app, which owns the import of the character builder. */
  charParts(doc) {
    return this.partsFor ? this.partsFor(doc) : null;
  }

  /** The story's own `camera` — the framing the film opens on, before any
   *  `cameraTo` has run. It is part of the opening scene, so it sits in the
   *  list with the cast and the objects rather than hiding in the JSON. */
  cameraForm() {
    const cam = this.doc.camera;
    this.numberRow(t('editCamAt'), ['X', 'Y', 'Z'], (i) => cam.at[i], (i, v) => {
      cam.at[i] = v;
      this.dirty = true;
      this.refresh();
    });
    this.numberRow(t('editCamLook'), ['X', 'Y', 'Z'], (i) => (Array.isArray(cam.look) ? cam.look[i] : 0), (i, v) => {
      if (!Array.isArray(cam.look)) cam.look = [0, 1, 0];
      cam.look[i] = v;
      this.dirty = true;
      this.refresh();
    });
    this.numberRow('fov', ['°'], () => cam.fov, (_i, v) => {
      cam.fov = Math.max(15, Math.min(110, v));
      this.dirty = true;
      this.refresh();
    });
    this.fromViewButton(cam, () => {
      // The opening framing is only on screen at the very start, so this
      // takes you there to look at what you just chose.
      this.refresh();
      this.seek(0);
    });
  }

  renderList() {
    this.listEl.innerHTML = '';
    const row = (label, pick, sub) => {
      const b = document.createElement('button');
      b.className = `ss-edit-row${samePick(this.pick, pick) ? ' is-active' : ''}`;
      b.textContent = label;
      if (sub) b.title = sub;
      b.addEventListener('click', () => this.select(pick));
      this.listEl.appendChild(b);
    };
    row(`🎥 ${t('editOpeningShot')}`, { kind: 'camera', index: 0 });
    for (const [i, c] of this.doc.cast.entries()) {
      row(`${c.id} — ${c.character}`, { kind: 'cast', index: i }, c.outfit);
    }
    for (const [i, e] of this.doc.setEdits.entries()) {
      if (e.op !== 'add') continue;
      row(`${e.id} — ${e.prop}`, { kind: 'edit', index: i });
    }
  }

  // ------------------------------------------------------------ properties

  renderProps() {
    this.propsEl.innerHTML = '';
    if (!this.pick) {
      this.propsEl.innerHTML = `<p class="ss-prop-of">${t('editPickAnything')}</p>`;
      return;
    }
    const head = document.createElement('h3');
    head.className = 'ss-edit-heading';
    head.textContent = t('editProps');
    this.propsEl.appendChild(head);

    if (this.pick.kind === 'camera') this.cameraForm();
    else if (this.pick.kind === 'cast') this.castForm(this.doc.cast[this.pick.index]);
    else if (this.pick.kind === 'edit') this.objectForm(this.doc.setEdits[this.pick.index]);
    else this.entryForm(this.doc.timeline[this.pick.index]);
  }

  /** Small form helpers. Each writes straight into the document and then asks
   *  for the cheapest refresh that can show it. */
  field(label, node) {
    const wrap = document.createElement('label');
    wrap.className = 'ss-prop-row';
    const span = document.createElement('span');
    span.textContent = label;
    wrap.append(span, node);
    this.propsEl.appendChild(wrap);
    return node;
  }

  numberRow(label, keys, get, set) {
    const p = document.createElement('p');
    p.className = 'ss-prop-group';
    p.textContent = label;
    this.propsEl.appendChild(p);
    const trio = document.createElement('div');
    trio.className = 'ss-prop-trio';
    for (const [i, key] of keys.entries()) {
      const l = document.createElement('label');
      const s = document.createElement('span');
      s.textContent = key;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.value = get(i);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (Number.isFinite(v)) set(i, v);
      });
      l.append(s, input);
      trio.appendChild(l);
    }
    this.propsEl.appendChild(trio);
  }

  select_(label, options, value, onChange) {
    const sel = document.createElement('select');
    for (const o of options) {
      const option = document.createElement('option');
      option.value = o.value;
      option.textContent = o.label;
      sel.appendChild(option);
    }
    sel.value = value ?? '';
    sel.addEventListener('change', () => onChange(sel.value));
    return this.field(label, sel);
  }

  castForm(entry) {
    const chars = this.registry.list(CHAR_ROW).map(({ doc }) => ({ value: doc.id, label: doc.id }));
    this.select_(t('kindCharacter'), chars, entry.character, async (v) => {
      entry.character = v;
      const doc = this.registry.character(v);
      entry.outfit = doc?.wardrobe.some((w) => w.id === entry.outfit) ? entry.outfit : doc?.defaultOutfit;
      this.dirty = true;
      await this.reload();
      this.renderProps();
      this.renderList();
    });
    const doc = this.registry.character(entry.character);
    const outfits = (doc?.wardrobe || []).map((w) => ({ value: w.id, label: w.id }));
    this.select_(t('outfits'), outfits, entry.outfit, async (v) => {
      entry.outfit = v;
      this.dirty = true;
      await this.reload();
    });
    this.numberRow(t('editPos'), ['X', 'Y', 'Z'], (i) => entry.at[i], (i, v) => {
      entry.at[i] = v;
      this.dirty = true;
      this.refresh();
    });
    this.numberRow(t('editRot'), ['yaw'], () => entry.yaw || 0, (_i, v) => {
      entry.yaw = v;
      this.dirty = true;
      this.refresh();
    });
    const props = [{ value: '', label: '—' }, ...this.registry.list('prop')
      .filter(({ doc: p }) => p.anchors?.grip).map(({ doc: p }) => ({ value: p.id, label: p.id }))];
    this.select_(t('editHolds'), props, entry.holds || '', async (v) => {
      if (v) entry.holds = v;
      else delete entry.holds;
      this.dirty = true;
      await this.reload();
    });
  }

  objectForm(entry) {
    const props = this.registry.list('prop').map(({ doc }) => ({ value: doc.id, label: doc.id }));
    this.select_(t('kindProp'), props, entry.prop, async (v) => {
      entry.prop = v;
      this.dirty = true;
      await this.reload();
      this.renderList();
    });
    this.numberRow(t('editPos'), ['X', 'Y', 'Z'], (i) => entry.at[i], (i, v) => {
      entry.at[i] = v;
      this.dirty = true;
      this.reload();
    });
    this.numberRow(t('editRot'), ['yaw'], () => entry.yaw || 0, (_i, v) => {
      entry.yaw = v;
      this.dirty = true;
      this.reload();
    });
  }

  entryForm(entry) {
    const spec = this.registry.action(entry.do);
    const actions = this.registry.list('action')
      .filter(({ doc }) => doc.category !== 'group')
      .filter(({ doc }) => (entry.actor ? !STAGE_KINDS.has(doc.type) : STAGE_KINDS.has(doc.type)))
      .map(({ doc }) => ({ value: doc.id, label: doc.id }));
    this.select_(t('editDo'), actions, entry.do, (v) => {
      entry.do = v;
      this.dirty = true;
      this.refresh();
      this.renderProps();
    });

    if (entry.actor) {
      const cast = this.doc.cast.map((c) => ({ value: c.id, label: c.id }));
      this.select_(t('castLabel'), cast, entry.actor, (v) => {
        entry.actor = v;
        this.dirty = true;
        this.refresh();
      });
    }

    this.numberRow(t('editWhen'), ['t', 'for'], (i) => (i === 0
      ? (entry.t ?? round1(this.scheduleOf(this.pick.index)?.start ?? 0))
      : (entry.for ?? round1(this.scheduleOf(this.pick.index)?.dur ?? 0))), (i, v) => {
      if (i === 0) { entry.t = Math.max(0, v); delete entry.after; } else entry.for = Math.max(0, v);
      this.dirty = true;
      this.refresh();
    });

    for (const key of FIELDS_BY_TYPE[spec?.type] || []) this.entryField(entry, key);

    if (spec?.type === 'camera') this.fromViewButton(entry);
  }

  /** Where the eye is right now, as a camera would write it down.
   *
   *  In free look the target is the orbit pivot, which is what you have been
   *  turning around. Otherwise it is whatever the film itself is looking at,
   *  so the button still means something with free look off. */
  viewAsCamera() {
    const cam = this.stage.camera;
    let look = [this.orbit.target.x, this.orbit.target.y, this.orbit.target.z];
    if (!this.freeLook) {
      const frame = this.playback.film?.sample(this.playback.time);
      if (Array.isArray(frame?.camera?.look)) look = frame.camera.look;
    }
    return {
      at: [round1(cam.position.x), round1(cam.position.y), round1(cam.position.z)],
      look: [round1(look[0]), round1(look[1]), round1(look[2])],
      fov: Math.round(cam.fov * 10) / 10,
    };
  }

  fromViewButton(target, after) {
    const b = document.createElement('button');
    b.className = 'ss-button';
    b.type = 'button';
    b.textContent = t('editFromView');
    b.addEventListener('click', () => {
      const view = this.viewAsCamera();
      target.at = view.at;
      target.look = view.look;
      this.dirty = true;
      after ? after() : this.refresh();
      this.renderProps();
    });
    this.propsEl.appendChild(b);
  }

  /** One field of a timeline entry, drawn as whatever that field is. */
  entryField(entry, key) {
    if (key === 'text') {
      const area = document.createElement('textarea');
      area.value = localised(entry.text, '');
      area.addEventListener('input', () => {
        const line = area.value;
        entry.text = { en: line, pt: line, ja: line };
        this.dirty = true;
        this.refresh();
      });
      this.field(t('editText'), area);
      return;
    }
    if (key === 'to' || key === 'at' || key === 'look') {
      const cur = Array.isArray(entry[key]) ? entry[key] : [0, 0, 0];
      entry[key] = cur;
      this.numberRow(key, ['X', 'Y', 'Z'], (i) => cur[i], (i, v) => {
        cur[i] = v;
        this.dirty = true;
        this.refresh();
      });
      return;
    }
    if (key === 'glide') {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = !!entry.glide;
      box.addEventListener('change', () => {
        if (box.checked) entry.glide = true;
        else delete entry.glide;
        this.dirty = true;
        this.refresh();
      });
      this.field(key, box);
      return;
    }
    if (key === 'prop' || key === 'id' || key === 'on' || key === 'target') {
      const usable = this.optionsFor(key, entry);
      // A value already in the document stays in the list even when it is not
      // one this dropdown would offer: hiding it would silently rewrite the
      // story the moment you touched any other field.
      if (entry[key] && !usable.includes(entry[key])) usable.unshift(entry[key]);
      const options = [{ value: '', label: '—' }, ...usable.map((v) => ({ value: v, label: v }))];
      this.select_(key, options, entry[key] || '', (v) => {
        if (v) entry[key] = v;
        else delete entry[key];
        this.dirty = true;
        this.refresh();
        if (key === 'on') this.renderProps();     // the anchor list follows it
      });
      return;
    }
    if (key === 'hand' || key === 'side' || key === 'face' || key === 'sky' || key === 'anchor') {
      const values = key === 'anchor' ? this.anchorsOf(entry)
        : { hand: ['left', 'right'], side: ['left', 'right'], face: ['up', 'down'],
          sky: ['day', 'dawn', 'dusk', 'night', 'indoor'] }[key];
      const options = [{ value: '', label: '—' }, ...values.map((v) => ({ value: v, label: v }))];
      this.select_(key, options, entry[key] || '', (v) => {
        if (v) entry[key] = v;
        else delete entry[key];
        this.dirty = true;
        this.refresh();
      });
      return;
    }
    if (key === 'facing') {
      const options = [{ value: '', label: '—' },
        ...this.doc.cast.map((c) => ({ value: c.id, label: c.id }))];
      this.select_(key, options, typeof entry.facing === 'string' ? entry.facing : '', (v) => {
        if (v) entry.facing = v;
        else delete entry.facing;
        this.dirty = true;
        this.refresh();
      });
      return;
    }
    const input = document.createElement('input');
    input.type = 'number';
    input.step = key === 'reps' ? '1' : '0.1';
    input.value = entry[key] ?? '';
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (input.value === '') delete entry[key];
      else if (Number.isFinite(v)) entry[key] = key === 'reps' ? Math.round(v) : v;
      this.dirty = true;
      this.refresh();
    });
    this.field(key, input);
  }

  /** Every placement the story can address: the set's own, plus the ones it
   *  added, minus the ones it removed. */
  placements() {
    const setDoc = this.registry.get('set', this.doc.set);
    const out = new Map();
    for (const p of setDoc?.props || []) out.set(p.id, p);
    for (const e of this.doc.setEdits) {
      if (e.op === 'add') out.set(e.id, e);
      else if (e.op === 'remove') out.delete(e.id);
    }
    return out;
  }

  optionsFor(key, entry) {
    if (key === 'prop') return this.registry.list('prop').map(({ doc }) => doc.id);
    if (key === 'target') return this.doc.cast.map((c) => c.id);
    const places = [...this.placements().values()];
    // `id` is any placement — propMove and propHide address all of them.
    if (key !== 'on') return places.map((p) => p.id);
    // `on` is not. Sitting needs something with a seat on it, lying needs a
    // surface to lie on. Offering the concrete floor as a chair is how a
    // story gets written that the compiler then has to work around, and the
    // fix belongs here, where the choice is made.
    const spec = this.registry.action(entry?.do);
    const want = entry?.anchor || spec?.anchor || 'seat';
    return places
      .filter((p) => this.registry.prop(p.prop)?.anchors?.[want])
      .map((p) => p.id);
  }

  /** The anchors a chosen placement actually has, so `anchor` can only ever
   *  name one that exists. */
  anchorsOf(entry) {
    const pl = this.placements().get(entry?.on);
    const doc = pl && this.registry.prop(pl.prop);
    return Object.keys(doc?.anchors || {});
  }

  // ----------------------------------------------------------------- save

  build() {
    return { ...this.doc, kind: 'story', version: 1 };
  }

  save() {
    this.dirty = false;
    this.onSave(this.build());
  }

  // ------------------------------------------------------------ lifecycle

  start() {
    if (this.raf) return;
    const loop = () => {
      if (this.freeLook) {
        this.orbit.update();
        this.playback.render();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.thumbJob = null;
    this.playback.pause();
  }

  resize(w, h) {
    this.playback.resize(w, h);
    this.movePlayhead(this.playback.time);
  }
}

const STAGE_KINDS = new Set(['camera', 'cameraFollow', 'stage']);

function samePick(a, b) {
  return !!a && !!b && a.kind === b.kind && a.index === b.index;
}

function round1(v) {
  return Math.round(v * 100) / 100;
}

function clock(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s - m * 60)).padStart(2, '0')}`;
}
