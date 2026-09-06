import * as THREE from 'three';
import { Stage } from './stage.js';
import { Balloons } from './balloons.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { applyPose } from '../anim/blend.js';
import { groundLift } from '../anim/ground.js';
import { buildSet, propObject } from '../stage/build.js';
import { compile } from '../script/director.js';
import { localised } from '../i18n.js';

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
    };
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
    return { ok: true, errors: [] };
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
    const slot = this.heldSlots.get(key);
    if (slot && slot.prop === want && slot.hand === hand) {
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
    if (grip) {
      object.position.set(-grip.pos[0], -grip.pos[1], -grip.pos[2]);
      group.rotation.y = (grip.yaw * Math.PI) / 180;
    }
    if (template.doc.scale && template.doc.scale !== 1) group.scale.setScalar(template.doc.scale);
    group.add(object);
    pivot.add(group);
    this.heldSlots.set(key, { prop: want, hand, group });
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

export { THREE };
