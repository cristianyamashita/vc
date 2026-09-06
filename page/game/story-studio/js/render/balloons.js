import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Comic-book speech. The balloons are real HTML positioned by CSS2DRenderer,
// not textured quads, which means they stay crisp at any zoom, wrap their own
// text, and can be styled and translated like the rest of the page.

export class Balloons {
  constructor(host) {
    this.renderer = new CSS2DRenderer();
    this.renderer.domElement.className = 'ss-labels';
    host.appendChild(this.renderer.domElement);
    this.pool = [];
    this.root = new THREE.Group();
  }

  attachTo(scene) {
    scene.add(this.root);
  }

  take(i) {
    if (!this.pool[i]) {
      const el = document.createElement('div');
      el.className = 'ss-balloon';
      const obj = new CSS2DObject(el);
      // CSS2DRenderer writes `transform` inline every frame, so a stylesheet
      // rule cannot move the balloon off its anchor. `center` is the knob it
      // exposes for that: (0.5, 1) hangs the balloon by its bottom edge, so
      // the tail lands on the anchor point above the actor's head.
      obj.center.set(0.5, 1);
      this.pool[i] = { el, obj };
      this.root.add(obj);
    }
    return this.pool[i];
  }

  /** @param {Array<{x,y,z,text,kind}>} items world-space balloons to show */
  update(items) {
    for (let i = 0; i < items.length; i++) {
      const { el, obj } = this.take(i);
      const item = items[i];
      el.textContent = item.text;
      el.className = `ss-balloon ${item.kind === 'think' ? 'is-think' : 'is-say'}`;
      obj.visible = true;
      el.style.display = '';
      obj.position.set(item.x, item.y, item.z);
    }
    // Both flags, and in this order. CSS2DRenderer rewrites `display` from
    // the frustum test on every frame, so setting it alone does not stick;
    // but it skips an invisible object before touching the element at all,
    // which is what leaves our 'none' in place.
    for (let i = items.length; i < this.pool.length; i++) {
      this.pool[i].obj.visible = false;
      this.pool[i].el.style.display = 'none';
    }
  }

  resize(w, h) {
    this.renderer.setSize(w, h);
  }

  render(scene, camera) {
    this.renderer.render(scene, camera);
  }

  dispose() {
    this.renderer.domElement.remove();
  }
}
