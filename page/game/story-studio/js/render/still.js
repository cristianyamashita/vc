import * as THREE from 'three';
import { Stage } from './stage.js';
import { Balloons } from './balloons.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { buildSet, propObject, scaleTriple } from '../stage/build.js';
import { applyPosition, lookFromCamera } from '../anim/position.js';
import { localised } from '../i18n.js';
import { toHex } from './geometry.js';

const DEG = Math.PI / 180;

/** Builds one static-story page onto a canvas. No timeline, no clock. */
export class Still {
  constructor(canvas, labelHost) {
    this.stage = new Stage(canvas);
    this.balloons = labelHost ? new Balloons(labelHost) : null;
    this.balloons?.attachTo(this.stage.scene);
    this.set = null;
    this.actors = new Map();
    this.pageProps = new Map();
    this.missing = [];
    this.page = null;
    this.registry = null;
    this._lampAt = new THREE.Vector3();
  }

  async load(page, registry) {
    this.clear();
    this.page = page;
    this.registry = registry;
    const setDoc = registry.get('set', page.set);
    if (!setDoc) {
      return { ok: false, errors: [{ path: 'set', message: `no set document with id "${page.set}"` }] };
    }

    this.set = await buildSet(setDoc, [], (id) => registry.prop(id), (id) => registry.blob(id));
    this.missing = [...this.set.missing];
    this.stage.content.add(this.set.root);
    const sky = page.sky || setDoc.sky || 'day';
    this.stage.setSky(sky, page.light?.intensity ?? setDoc.light?.intensity ?? 1);
    if (setDoc.light?.sun) this.stage.setSunDirection(setDoc.light.sun);

    for (const c of page.cast || []) {
      const doc = registry.character(c.character);
      if (!doc) {
        this.missing.push(c.character);
        continue;
      }
      const mesh = buildCharacter(doc, c.outfit || doc.defaultOutfit);
      mesh.userData.actorId = c.id;
      mesh.userData.kind = 'cast';
      this.placeActor(mesh, c);
      this.stage.content.add(mesh);
      this.actors.set(c.id, mesh);
    }

    for (const pr of page.props || []) {
      const doc = registry.prop(pr.prop);
      let object = null;
      try { object = doc ? await propObject(doc, (id) => registry.blob(id)) : null; }
      catch { object = null; }
      if (!object) {
        this.missing.push(pr.prop);
        continue;
      }
      const holder = new THREE.Group();
      holder.rotation.order = 'YXZ';
      holder.userData.propId = pr.id;
      holder.userData.kind = 'prop';
      holder.add(object);
      this.placeProp(holder, pr);
      this.stage.content.add(holder);
      this.pageProps.set(pr.id, holder);
    }

    this.aimPage();
    this.updateBalloons();
    this.stage.applyLamps(this.gatherLamps());
    this.render();
    return { ok: true, errors: [], missing: this.missing };
  }

  placeActor(mesh, c) {
    mesh.position.set(c.at[0], c.at[1], c.at[2]);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set((c.roll || 0) * DEG, (c.yaw || 0) * DEG, (c.pitch || 0) * DEG);
    const position = this.registry.get('position', c.position) || { pose: 'stand', joints: [], root: [] };
    applyPosition(mesh, position, c.joints || []);
  }

  placeProp(holder, pr) {
    holder.position.set(pr.at[0], pr.at[1], pr.at[2]);
    holder.rotation.set((pr.roll || 0) * DEG, (pr.yaw || 0) * DEG, (pr.pitch || 0) * DEG);
    const size = scaleTriple(pr.scale);
    holder.scale.set(size[0], size[1], size[2]);
  }

  refreshActors() {
    if (!this.page) return;
    for (const c of this.page.cast || []) {
      const mesh = this.actors.get(c.id);
      if (mesh) this.placeActor(mesh, c);
    }
    for (const pr of this.page.props || []) {
      const holder = this.pageProps.get(pr.id);
      if (holder) this.placeProp(holder, pr);
    }
    this.updateBalloons();
    this.stage.applyLamps(this.gatherLamps());
  }

  aimPage() {
    if (!this.page) return;
    const look = lookFromCamera(this.page.camera);
    this.stage.aim(this.page.camera.at, look, this.page.camera.fov);
  }

  updateBalloons() {
    if (!this.balloons || !this.page) return;
    const items = [];
    for (const c of this.page.cast || []) {
      const line = c.text && localised(c.text);
      if (!line) continue;
      const mesh = this.actors.get(c.id);
      if (!mesh) continue;
      const height = mesh.userData.height || 1.7;
      items.push({
        x: mesh.position.x,
        y: mesh.position.y + height * 1.16,
        z: mesh.position.z,
        text: line,
        kind: c.balloon === 'think' ? 'think' : 'say',
      });
    }
    this.balloons.update(items);
  }

  gatherLamps() {
    const out = [];
    const add = (doc, object) => {
      const light = doc?.light;
      if (!light || !object) return;
      this._lampAt.set(light.at[0], light.at[1], light.at[2]);
      object.updateWorldMatrix(true, false);
      this._lampAt.applyMatrix4(object.matrixWorld);
      out.push({
        pos: [this._lampAt.x, this._lampAt.y, this._lampAt.z],
        color: toHex(light.color, 0xffd9a0),
        intensity: light.intensity,
        distance: light.distance,
      });
    };
    if (this.set) {
      for (const entry of this.set.placements.values()) add(entry.doc, entry.object);
    }
    if (this.page) {
      for (const pr of this.page.props || []) {
        add(this.registry.prop(pr.prop), this.pageProps.get(pr.id));
      }
      for (const lamp of this.page.lamps || []) {
        out.push({
          pos: [lamp.at[0], lamp.at[1], lamp.at[2]],
          color: toHex(lamp.color, 0xffd9a0),
          intensity: lamp.intensity,
          distance: lamp.distance,
        });
      }
    }
    return out;
  }

  objectFor(kind, id) {
    if (kind === 'cast') return this.actors.get(id);
    if (kind === 'prop') return this.pageProps.get(id);
    return null;
  }

  clear() {
    for (const mesh of this.actors.values()) disposeCharacter(mesh);
    this.actors.clear();
    this.pageProps.clear();
    this.stage.clearContent();
    this.balloons?.update([]);
    this.set = null;
    this.page = null;
  }

  render() {
    this.stage.render();
    this.balloons?.render(this.stage.scene, this.stage.camera);
  }

  resize(w, h) {
    this.stage.resize(w, h);
    this.balloons?.resize(w, h);
    this.render();
  }
}

export function visiblePages(doc) {
  return (doc.pages || []).filter((p) => !p.hidden);
}
