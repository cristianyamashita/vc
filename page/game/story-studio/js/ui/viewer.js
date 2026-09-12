import * as THREE from 'three';
import { Stage } from '../render/stage.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { boxMesh } from '../stage/boxes.js';
import { loadGltfFile, loadGltfBlob, instance } from '../stage/gltf.js';
import { applyPose } from '../anim/blend.js';
import { POSES } from '../anim/poses.js';

// The little turntable in the library. A character or an object you cannot
// look at is just an id in a list, so this is what makes the library
// browsable rather than merely enumerable.

export class Viewer {
  constructor(canvas) {
    this.stage = new Stage(canvas, { shadows: false, fog: false });
    this.stage.setSky('day');
    this.subject = null;
    this.radius = 3;
    this.centre = new THREE.Vector3(0, 1, 0);
    this.angle = 0.6;
    this.spin = true;
    this.useBlender = true;
    this._raf = 0;
    this._last = 0;
    this._loop = this._loop.bind(this);
  }

  clear() {
    if (this.subject) {
      disposeCharacter(this.subject);
      this.stage.content.remove(this.subject);
      this.subject = null;
    }
    this.stage.clearContent();
  }

  showCharacter(doc, outfitId) {
    this.clear();
    this.characterDoc = doc;
    this.outfitId = outfitId;
    this.subject = buildCharacter(this.useBlender ? doc : { ...doc, model: undefined }, outfitId);
    if (this.subject.userData.model) applyPose(this.subject, POSES.stand);
    this.stage.content.add(this.subject);
    this.frame(doc.height || 1.7);
  }

  compareModel(useBlender) {
    this.useBlender = useBlender;
    if (this.characterDoc) this.showCharacter(this.characterDoc, this.outfitId);
  }

  async showProp(doc, blobs) {
    this.clear();
    let object = null;
    try {
      if (doc.source?.type === 'boxes') object = boxMesh(doc);
      else if (doc.source?.type === 'gltf') object = instance(await loadGltfFile(doc.source.file));
      else if (doc.source?.type === 'gltfBlob') {
        const blob = await blobs?.(doc.source.blobId);
        if (blob) object = instance(await loadGltfBlob(doc.source.blobId, blob));
      }
    } catch (_err) {
      object = null;
    }
    if (!object) return false;
    if (doc.scale && doc.scale !== 1) object.scale.setScalar(doc.scale);
    if (doc.yaw) object.rotation.y = (doc.yaw * Math.PI) / 180;
    this.subject = object;
    this.stage.content.add(object);

    // Frame whatever came out of the file rather than guessing: an imported
    // model can be any size, and a chair filling one pixel is no preview.
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    this.centre.copy(centre);
    this.radius = Math.max(0.9, Math.max(size.x, size.y, size.z) * 2.1);
    return true;
  }

  frame(height) {
    // Three's `fov` is vertical, so the whole figure fits only if the
    // distance covers its height plus a margin; at 1.15x the head was
    // clipped off the top of the frame.
    this.centre.set(0, height * 0.50, 0);
    this.radius = height * 1.45;
  }

  resize(w, h) {
    this.stage.resize(w, h);
  }

  start() {
    if (this._raf) return;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _loop(now) {
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    if (this.spin) this.angle += dt * 0.5;
    const x = this.centre.x + Math.cos(this.angle) * this.radius;
    const z = this.centre.z + Math.sin(this.angle) * this.radius;
    this.stage.aim([x, this.centre.y + this.radius * 0.36, z],
      [this.centre.x, this.centre.y, this.centre.z], 45);
    if (this.subject?.userData.pivots && this.characterDoc?.model) {
      // A model review needs the full figure to fill a portrait viewport.
      // The film renderer preserves a wide shot by widening FOV; doing that
      // on this turntable made Lia too small to judge her face and clothing.
      this.stage.camera.fov = 45;
      this.stage.camera.updateProjectionMatrix();
      this.stage.sun.position.set(x + this.radius * .5,
        this.centre.y + this.radius * 1.3, z + this.radius * .3);
    }
    this.stage.render();
    this._raf = requestAnimationFrame(this._loop);
  }

  dispose() {
    this.stop();
    this.clear();
    this.stage.dispose();
  }
}
