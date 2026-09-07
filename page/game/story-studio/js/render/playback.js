import * as THREE from 'three';
import { Stage } from './stage.js';
import { Balloons } from './balloons.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { applyPose } from '../anim/blend.js';
import { groundLift } from '../anim/ground.js';
import { buildSet, propObject } from '../stage/build.js';
import { compile } from '../script/director.js';
import { localised } from '../i18n.js';
import { toHex } from './geometry.js';

// Binds a compiled film to a canvas. The clock lives here and nowhere else:
// this class decides what time it is, asks the film what the world looks like
// at that time, and writes the answer onto the scene. It never accumulates
// anything into the scene, which is what lets `seek` be a one-line assignment.

export class Playback {
  constructor(canvas, labelHost) {
    this.stage = new Stage(canvas);
    this.balloons = new Balloons(labelHost);
    this.balloons.attachTo(this.stage.scene);
    this.film = null;
    this.set = null;
    this.actors = new Map();
    // One built instance per prop a film can put in a hand or on the floor,
    // loaded up front so drawing a frame never has to wait on a file.
    this.propTemplates = new Map();
    this.heldSlots = new Map();
    this.groupProps = new Map();
    this._lampAt = new THREE.Vector3();
    this.time = 0;
    this.playing = false;
    this.missing = [];
    this.onTick = null;
    this._last = 0;
    this._raf = 0;
    this._loop = this._loop.bind(this);
  }

  /**
   * @returns {{ ok: boolean, errors: Array }} compile errors are returned,
   * not thrown: a broken story should show its problems in the editor, not
   * take the page down.
   */
  async load(story, registry) {
    this.stop();
    this.clear();

    const setDoc = registry.get('set', story.set);
    if (!setDoc) {
      return { ok: false, errors: [{ path: 'set', message: `no set document with id "${story.set}"` }] };
    }

    this.set = await buildSet(
      setDoc,
      story.setEdits,
      (id) => registry.prop(id),
      (id) => registry.blob(id),
    );
    this.missing = this.set.missing;
    this.stage.content.add(this.set.root);
    this.stage.setSky(setDoc.sky, setDoc.light.intensity);
    this.stage.setSunDirection(setDoc.light.sun);
    this.baseSky = setDoc.sky;

    const world = {
      character: (id) => registry.character(id),
      action: (id) => registry.action(id),
      prop: (id) => registry.prop(id),
      anchor: (placementId, name) => this.set.anchor(placementId, name),
      // Where the set put a placement, before any propMove touched it. A
      // move needs somewhere to travel from, and this is the only side of
      // the app that knows.
      placement: (placementId) => this.set.placements.get(placementId)?.placement || null,
    };
    // Kept, so the editor can recompile a changed timeline without rebuilding
    // the set and every character: retiming an action must feel instant, and
    // rebuilding takes about a second.
    this.world = world;
    this.story = story;
    const compiled = compile(story, world);
    if (!compiled.ok) {
      // Draw the set anyway. A story that fails to compile still has a place
      // it happens in, and showing that beside the error is far more use than
      // a black rectangle while the message says something about the cast.
      this.stage.aim(story.camera.at, story.camera.look, story.camera.fov);
      this.render();
      return { ok: false, errors: compiled.errors };
    }

    this.film = compiled.film;
    this.film.sky = setDoc.sky;
    // Things that are wrong but not fatal: an action told to sit on something
    // that is not a seat. They reach the notice bar, the same place a missing
    // prop does, instead of being swallowed.
    this.warnings = compiled.warnings || [];

    for (const [id, a] of Object.entries(this.film.actors)) {
      const mesh = buildCharacter(a.doc, a.outfit);
      this.stage.content.add(mesh);
      this.actors.set(id, mesh);
    }

    for (const propId of this.film.propIds()) {
      const doc = registry.prop(propId);
      if (!doc) {
        this.missing = [...new Set([...this.missing, propId])];
        continue;
      }
      try {
        const object = await propObject(doc, (bid) => registry.blob(bid));
        if (object) this.propTemplates.set(propId, { doc, object });
        else this.missing = [...new Set([...this.missing, propId])];
      } catch (_err) {
        this.missing = [...new Set([...this.missing, propId])];
      }
    }

    this.seek(0);
    return { ok: true, errors: [], warnings: this.warnings };
  }

  /**
   * Swaps in a changed story without touching the meshes.
   *
   * Only safe while the set, the cast and the props in play are the same —
   * the caller reloads for those. What this is for is the edit you make fifty
   * times in a row: dragging an action to a different second.
   */
  recompile(story) {
    if (!this.world) return { ok: false, errors: [{ path: '', message: 'nothing loaded' }] };
    const compiled = compile(story, this.world);
    if (!compiled.ok) return { ok: false, errors: compiled.errors };
    this.story = story;
    this.film = compiled.film;
    this.film.sky = this.baseSky;
    this.warnings = compiled.warnings || [];
    this.seek(Math.min(this.time, this.film.duration));
    return { ok: true, errors: [], warnings: this.warnings };
  }

  clear() {
    for (const mesh of this.actors.values()) disposeCharacter(mesh);
    this.actors.clear();
    this.propTemplates.clear();
    this.heldSlots.clear();
    this.groupProps.clear();
    this.stage.clearContent();
    this.balloons.update([]);
    this.set = null;
    this.film = null;
    this.time = 0;
  }

  get duration() {
    return this.film?.duration ?? 0;
  }

  seek(t) {
    if (!this.film) return;
    this.time = Math.max(0, Math.min(this.duration, t));
    this.apply();
  }

  play() {
    if (!this.film || this.playing) return;
    if (this.time >= this.duration - 1e-3) this.time = 0;
    this.playing = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  stop() {
    this.pause();
    this.time = 0;
  }

  _loop(now) {
    if (!this.playing) return;
    // Clamped, so a tab that was in the background for a minute resumes from
    // where it paused instead of jumping a minute into the story.
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    this.time += dt;
    if (this.time >= this.duration) {
      this.time = this.duration;
      this.playing = false;
    }
    this.apply();
    this.onTick?.(this.time, this.duration, this.playing);
    if (this.playing) this._raf = requestAnimationFrame(this._loop);
  }

  /** Writes the film's state at the current time onto the scene. */
  apply() {
    if (!this.film) return;
    const frame = this.film.sample(this.time);

    for (const [id, state] of Object.entries(frame.actors)) {
      const mesh = this.actors.get(id);
      if (!mesh) continue;
      mesh.position.set(state.x, state.y, state.z);
      // The model faces +X and yaw is measured the same way, so the mesh
      // needs no extra quarter turn here.
      mesh.rotation.y = -state.yaw;
      // Enforced, not assumed. A blend between two grounded poses is not
      // itself grounded, and an imported pose was never calibrated at all.
      const rise = groundLift(mesh.userData.contacts, mesh.userData.chain,
        state.pose, mesh.userData.height);
      applyPose(mesh, rise
        ? { root: { ...state.pose.root, lift: (state.pose.root.lift || 0) + rise / mesh.userData.height },
          joints: state.pose.joints }
        : state.pose);
      this.applyHeld(id, mesh, state);
    }

    if (this.set) {
      for (const [id, entry] of this.set.placements) {
        const hidden = frame.stage.hidden.has(id) || frame.stage.hidden.has(entry.placement.group);
        entry.object.visible = !hidden;
        const move = frame.stage.moved.get(id) || frame.stage.moved.get(entry.placement.group);
        if (move?.at) entry.object.position.set(move.at[0], move.at[1], move.at[2]);
        if (move?.yaw !== undefined) entry.object.rotation.y = (move.yaw * Math.PI) / 180;
      }
    }
    if (frame.stage.sky && frame.stage.sky !== this.stage.sky) this.stage.setSky(frame.stage.sky);

    this.applyGroupProps(frame.groupProps);

    const items = [];
    for (const b of frame.balloons) {
      const a = frame.actors[b.actor];
      if (!a) continue;
      const height = a.doc?.height || 1.7;
      items.push({
        x: a.x, y: a.y + height * 1.16, z: a.z,
        text: localised(b.text), kind: b.kind,
      });
    }
    this.balloons.update(items);

    this.stage.aim(frame.camera.at, frame.camera.look, frame.camera.fov);
    this.stage.applyLamps(this.gatherLamps());
    this.render();
  }

  /**
   * Puts the right thing in the right hand.
   *
   * A held prop hangs off the hand joint itself, so it follows the whole arm
   * for free — the grip anchor says which point of the prop the fist closes
   * around, and everything else follows from that.
   */
  applyHeld(actorId, mesh, state) {
    const want = state.holds;
    const hand = state.hand === 'left' ? 'lHand' : 'rHand';
    const key = `${actorId}`;
    const tilt = state.grip || null;
    const slot = this.heldSlots.get(key);
    if (slot && slot.prop === want && slot.hand === hand && sameTilt(slot.tilt, tilt)) {
      slot.group.visible = !!want;
      return;
    }
    if (slot) slot.group.parent?.remove(slot.group);
    if (!want) {
      this.heldSlots.delete(key);
      return;
    }
    const template = this.propTemplates.get(want);
    const pivot = mesh.userData.pivots?.[hand];
    if (!template || !pivot) return;

    const group = new THREE.Group();
    const object = template.object.clone(true);
    const grip = template.doc.anchors?.grip;
    if (grip) object.position.set(-grip.pos[0], -grip.pos[1], -grip.pos[2]);
    // The angle is the sum of two: the prop's own `grip` anchor, which says
    // how the thing is normally carried, and the story's, which says how this
    // character carries it now. Rotation happens around the grip point,
    // because the object was offset by it first — turn the wrist and the
    // handle stays in the fist. YXZ to match every other pivot in the rig.
    //
    // pitch/yaw/roll are named for what the author means, then mapped onto
    // the rig's own axes: z swings forward and back, x sideways, y twists.
    // The same convention the joints use, and the same trap — writing pitch
    // into rotation.x tips the torch sideways instead of forward.
    const deg = Math.PI / 180;
    const pitch = ((grip?.pitch || 0) + (tilt ? tilt[0] : 0)) * deg;
    const yaw = ((grip?.yaw || 0) + (tilt ? tilt[1] : 0)) * deg;
    const roll = ((grip?.roll || 0) + (tilt ? tilt[2] : 0)) * deg;
    group.rotation.order = 'YXZ';
    group.rotation.set(roll, yaw, pitch);
    if (template.doc.scale && template.doc.scale !== 1) group.scale.setScalar(template.doc.scale);
    group.add(object);
    pivot.add(group);
    this.heldSlots.set(key, { prop: want, hand, tilt, group });
  }

  /** Props a group action lays out for its own duration. */
  applyGroupProps(list) {
    const live = new Set();
    for (const item of list) {
      live.add(item.key);
      let holder = this.groupProps.get(item.key);
      if (!holder) {
        const template = this.propTemplates.get(item.prop);
        if (!template) continue;
        holder = new THREE.Group();
        holder.userData.prop = item.prop;
        holder.add(template.object.clone(true));
        this.stage.content.add(holder);
        this.groupProps.set(item.key, holder);
      }
      holder.visible = true;
      holder.position.set(item.at[0], item.at[1], item.at[2]);
      holder.rotation.set(0, item.yaw, item.spin, 'YXZ');
      holder.scale.setScalar(item.scale);
    }
    for (const [key, holder] of this.groupProps) {
      if (!live.has(key)) holder.visible = false;
    }
  }

  /**
   * Every light burning right now, wherever its prop has ended up.
   *
   * A torch in a hand and a fire on the ground are the same thing here: the
   * emitter hangs off the object, so it is read out of the scene graph after
   * the pose has been applied rather than tracked separately.
   */
  gatherLamps() {
    const out = [];
    const t = this.time;
    const add = (doc, object) => {
      const light = doc?.light;
      if (!light || !object) return;
      this._lampAt.set(light.at[0], light.at[1], light.at[2]);
      object.updateWorldMatrix(true, false);
      this._lampAt.applyMatrix4(object.matrixWorld);
      out.push({
        pos: [this._lampAt.x, this._lampAt.y, this._lampAt.z],
        color: toHex(light.color, 0xffd9a0),
        intensity: light.intensity * flickerAt(light, t),
        distance: light.distance,
      });
    };

    if (this.set) {
      for (const entry of this.set.placements.values()) {
        if (entry.object.visible) add(entry.doc, entry.object);
      }
    }
    for (const slot of this.heldSlots.values()) {
      if (slot.group.visible) add(this.propTemplates.get(slot.prop)?.doc, slot.group);
    }
    for (const [key, holder] of this.groupProps) {
      if (holder.visible) add(this.propTemplates.get(holder.userData.prop)?.doc, holder);
    }
    return out;
  }

  render() {
    this.stage.render();
    this.balloons.render(this.stage.scene, this.stage.camera);
  }

  resize(width, height) {
    const { w, h } = this.stage.resize(width, height);
    this.balloons.resize(w, h);
    // Resizing the drawing buffer clears it, so anything already on the stage
    // has to be drawn again — including a set with no playable film behind it,
    // which is exactly the case a failed compile leaves us in.
    if (this.film) this.apply();
    else if (this.set) this.render();
  }

  dispose() {
    this.pause();
    this.clear();
    this.balloons.dispose();
    this.stage.dispose();
  }
}

/**
 * A fire's flicker, from the film's own clock.
 *
 * Two sines that do not share a period, so it never settles into an obvious
 * beat — and never uses a random number, which would mean a scene looked
 * different every time it was replayed from the same moment.
 */
/** Whether a held prop's angle changed, so the slot can be kept. */
function sameTilt(a, b) {
  if (!a || !b) return !a === !b;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function flickerAt(light, t) {
  if (!light.flicker) return 1;
  const hz = light.flickerHz;
  const n = Math.sin(t * hz) * 0.6 + Math.sin(t * hz * 2.37 + 1.3) * 0.4;
  return 1 + light.flicker * n * 0.5;
}

export { THREE };
