import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Stage } from '../render/stage.js';
import { buildBody, BODY_PLANS, DEFAULT_HEIGHT } from '../cast/body.js';
import {
  LEGS, TOPS, SLEEVES, FEET, CUT_FLAGS, SWELL_RANGE, sprayCells, sprayKey, sprayGrid,
  upscaleSpray,
} from '../cast/wardrobe.js';
import {
  buildGeometry, BOX_MATERIAL, PAINT_N, FACE_BASIS, cellPoint, toHex,
} from '../render/geometry.js';
import { t, localised } from '../i18n.js';

// The visual outfit editor.
//
// An outfit is a document like any other and the JSON panel can edit all of
// it. But two of its fields are not things anybody can hold in their head as
// numbers: how far the cloth stands off the body, which you judge by looking,
// and where the paint goes, which is four thousand cells nobody is going to
// type. So this dresses a body in the draft and lets you turn it, pull the
// cloth in and out, and spray on it.
//
// Like the set editor, it is not a second format: it loads an `outfit`, edits
// it, and hands back an `outfit` that goes through the same validator an
// import does. Nothing it produces is beyond what you could have typed.

const TOOLS = ['move', 'spray', 'erase', 'pick'];
const BRUSH_MAX = 8;
/** A single cell at 1 — under a centimetre of cloth on the paint grid — and a
 *  patch about a hand wide at 8. Measured on a 1.76 m figure, the frame every
 *  other measurement in the app is stated on. */
function brushRadius(dots) {
  return 0.008 + (dots - 2) * 0.024;
}

/** The draft's cells, read fresh. `sprayCells` keeps its answer alongside the
 *  paint it was given, and the paint being edited changes under the brush, so
 *  the editor hands it a new wrapper rather than the object it is mutating. */
function cellsOf(paint) {
  return sprayCells({ spray: paint.spray, grid: paint.grid, grids: paint.grids });
}

/** The body the draft is tried on. A real character would drag its own
 *  colours and hair into a judgement about cloth. */
const MANNEQUIN = {
  build: 0.5,
  look: { skin: '#c8a07a', hair: '#2a1810', hairStyle: 'short', hairLength: 0.2 },
};

export class OutfitEditor {
  constructor(root, { onSave, onCancel }) {
    this.root = root;
    this.onSave = onSave;
    this.onCancel = onCancel;

    this.canvas = root.querySelector('#ss-fit-canvas');
    this.wrap = root.querySelector('#ss-fit-stage');

    this.stage = new Stage(this.canvas, { shadows: false, fog: false });
    // Daylight, and no fog: this is a workbench, and cloth has to be judged
    // against a neutral ground rather than a warm interior that tints it.
    this.stage.setSky('day');
    this.camera = this.stage.camera;
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.maxPolarAngle = Math.PI * 0.495;
    this.orbit.target.set(0, 0.9, 0);

    this.doc = null;          // the draft, edited in place
    this.plan = 'man';        // whose body wears it in the preview
    this.paintIndex = 0;
    this.tool = 'move';
    this.brush = 3;
    this.dirty = false;
    this.raf = 0;

    this.mesh = null;
    this.cells = null;        // the sprayable cell table, rebuilt with the body
    this.ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._view = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this.painting = false;

    this.els = {
      title: root.querySelector('#ss-fit-title'),
      name: root.querySelector('#ss-fit-name'),
      legs: root.querySelector('#ss-fit-legs'),
      top: root.querySelector('#ss-fit-top'),
      sleeve: root.querySelector('#ss-fit-sleeve'),
      feet: root.querySelector('#ss-fit-feet'),
      flags: root.querySelector('#ss-fit-flags'),
      swell: root.querySelector('#ss-fit-swell'),
      swellOut: root.querySelector('#ss-fit-swell-out'),
      plans: root.querySelector('#ss-fit-plans'),
      plan: root.querySelector('#ss-fit-plan'),
      paints: root.querySelector('#ss-fit-paints'),
      paintName: root.querySelector('#ss-fit-paint-name'),
      color: root.querySelector('#ss-fit-color'),
      tools: root.querySelector('#ss-fit-tools'),
      ink: root.querySelector('#ss-fit-ink'),
      dots: root.querySelector('#ss-fit-dots'),
      dotsOut: root.querySelector('#ss-fit-dots-out'),
      count: root.querySelector('#ss-fit-count'),
      clear: root.querySelector('#ss-fit-clear'),
    };

    this.fillSelects();
    this.bindings();
  }

  // -------------------------------------------------------------- controls

  fillSelects() {
    const fill = (el, values) => {
      for (const v of values) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        el.appendChild(o);
      }
    };
    fill(this.els.legs, LEGS);
    fill(this.els.top, TOPS);
    fill(this.els.sleeve, SLEEVES);
    fill(this.els.feet, FEET);
    fill(this.els.plan, BODY_PLANS);

    for (const flag of CUT_FLAGS) {
      const label = document.createElement('label');
      label.className = 'ss-fit-check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.flag = flag;
      const span = document.createElement('span');
      span.textContent = flag;
      label.append(box, span);
      this.els.flags.appendChild(label);
    }
    for (const plan of BODY_PLANS) {
      const label = document.createElement('label');
      label.className = 'ss-fit-check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.plan = plan;
      const span = document.createElement('span');
      span.textContent = plan;
      label.append(box, span);
      this.els.plans.appendChild(label);
    }
    for (const tool of TOOLS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.tool = tool;
      b.className = 'ss-button';
      b.textContent = t(`fitTool_${tool}`);
      this.els.tools.appendChild(b);
    }
    this.els.swell.min = String(SWELL_RANGE[0]);
    this.els.swell.max = String(SWELL_RANGE[1]);
    this.els.swell.step = '0.002';
    this.els.dots.min = '1';
    this.els.dots.max = String(BRUSH_MAX);
  }

  bindings() {
    const touched = () => {
      this.dirty = true;
      this.rebuild();
    };

    this.els.name.addEventListener('input', () => {
      // One field, every language: an outfit named in the editor is named
      // once. A document that wants three names still says so in JSON.
      const s = this.els.name.value;
      this.doc.name = { en: s, pt: s, ja: s };
      this.els.title.textContent = s || this.doc.id;
      this.dirty = true;
    });

    for (const key of ['legs', 'top', 'sleeve', 'feet']) {
      this.els[key].addEventListener('change', () => {
        this.doc.cut[key] = this.els[key].value;
        touched();
      });
    }
    this.els.flags.addEventListener('change', (e) => {
      const flag = e.target.dataset.flag;
      if (!flag) return;
      if (e.target.checked) this.doc.cut[flag] = true;
      else delete this.doc.cut[flag];
      touched();
    });
    this.els.plans.addEventListener('change', (e) => {
      const plan = e.target.dataset.plan;
      if (!plan) return;
      const list = this.doc.plans.filter((p) => p !== plan);
      if (e.target.checked) list.push(plan);
      // Kept in the app's own plan order rather than click order, so the
      // document reads the same however the boxes were ticked.
      this.doc.plans = BODY_PLANS.filter((p) => list.includes(p));
      this.dirty = true;
    });
    this.els.swell.addEventListener('input', () => {
      this.doc.fit.swell = Number(this.els.swell.value);
      this.els.swellOut.textContent = `${Math.round(this.doc.fit.swell * 1000)} mm`;
      touched();
    });
    this.els.plan.addEventListener('change', () => {
      this.plan = this.els.plan.value;
      this.rebuild();
    });

    this.els.paints.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-index]');
      if (!b) return;
      this.paintIndex = Number(b.dataset.index);
      this.renderPaints();
      this.rebuild();
    });
    this.els.paintName.addEventListener('input', () => {
      const s = this.els.paintName.value;
      this.paint().name = { en: s, pt: s, ja: s };
      this.dirty = true;
      this.renderPaints();
    });
    this.els.color.addEventListener('input', () => {
      this.paint().color = this.els.color.value;
      touched();
    });

    this.root.querySelector('#ss-fit-paint-add').addEventListener('click', () => this.addPaint(false));
    this.root.querySelector('#ss-fit-paint-copy').addEventListener('click', () => this.addPaint(true));
    this.root.querySelector('#ss-fit-paint-del').addEventListener('click', () => this.removePaint());
    this.els.clear.addEventListener('click', () => {
      const paint = this.paint();
      if (!paint.spray || !Object.keys(paint.spray).length) return;
      delete paint.spray;
      delete paint.grid;
      delete paint.grids;
      touched();
      this.syncSpray();
    });

    this.els.tools.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tool]');
      if (!b) return;
      this.setTool(b.dataset.tool);
    });
    this.els.dots.addEventListener('input', () => {
      this.brush = Number(this.els.dots.value);
      this.els.dotsOut.textContent = String(this.brush);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.tool === 'move' || e.button !== 0) return;
      this.painting = true;
      this.canvas.setPointerCapture(e.pointerId);
      this.strokeAt(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.painting) this.strokeAt(e);
    });
    const stop = (e) => {
      if (!this.painting) return;
      this.painting = false;
      if (this.canvas.hasPointerCapture?.(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);

    this.root.querySelector('#ss-fit-save').addEventListener('click', () => {
      this.dirty = false;
      this.onSave(this.build());
    });
    this.root.querySelector('#ss-fit-cancel').addEventListener('click', () => this.onCancel());
  }

  setTool(tool) {
    this.tool = TOOLS.includes(tool) ? tool : 'move';
    // The left button either turns the model or paints on it; it cannot do
    // both, and the right button turns it either way so a stroke never has to
    // be interrupted to look at the other side.
    this.orbit.mouseButtons = {
      LEFT: this.tool === 'move' ? THREE.MOUSE.ROTATE : null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    for (const b of this.els.tools.children) {
      b.className = b.dataset.tool === this.tool ? 'ss-button is-active' : 'ss-button';
    }
    this.canvas.style.cursor = this.tool === 'move' ? 'grab' : 'crosshair';
  }

  // ------------------------------------------------------------- the draft

  paint() {
    return this.doc.paints[this.paintIndex] || this.doc.paints[0];
  }

  /** Loads a document into the editor. The draft is a deep copy: cancelling
   *  has to leave the library exactly as it was. */
  load(doc) {
    this.doc = JSON.parse(JSON.stringify(doc));
    this.doc.cut = this.doc.cut || {};
    this.doc.fit = this.doc.fit || { swell: 0 };
    this.doc.plans = this.doc.plans || [];
    this.doc.paints = this.doc.paints?.length ? this.doc.paints
      : [{ id: 'plain', name: { en: 'Plain', pt: 'Liso', ja: '無地' }, color: '#2a5caa' }];
    this.paintIndex = Math.max(0, this.doc.paints.findIndex((p) => p.id === this.doc.defaultPaint));
    this.dirty = false;
    // A dress previews on the body it was written for, so opening one does
    // not open on a man wearing a skirt and a question.
    this.plan = this.doc.plans.includes('man') || !this.doc.plans.length ? 'man' : this.doc.plans[0];

    this.els.title.textContent = localised(this.doc.name, this.doc.id);
    this.els.name.value = localised(this.doc.name, this.doc.id);
    for (const key of ['legs', 'top', 'sleeve', 'feet']) {
      this.els[key].value = this.doc.cut[key] || this.els[key].options[0].value;
    }
    for (const box of this.els.flags.querySelectorAll('input')) {
      box.checked = !!this.doc.cut[box.dataset.flag];
    }
    for (const box of this.els.plans.querySelectorAll('input')) {
      box.checked = this.doc.plans.includes(box.dataset.plan);
    }
    this.els.swell.value = String(this.doc.fit.swell ?? 0);
    this.els.swellOut.textContent = `${Math.round((this.doc.fit.swell ?? 0) * 1000)} mm`;
    this.els.plan.value = this.plan;
    this.els.dots.value = String(this.brush);
    this.els.dotsOut.textContent = String(this.brush);
    this.setTool('move');
    this.renderPaints();
    this.rebuild();
    this.frame();
  }

  addPaint(copy) {
    const from = this.paint();
    const base = copy ? `${from.id}Copy` : 'paint';
    let id = base;
    let n = 2;
    while (this.doc.paints.some((p) => p.id === id)) id = `${base}${n++}`;
    const label = copy ? `${localised(from.name, from.id)} 2` : t('fitNewPaint');
    const entry = { id, name: { en: label, pt: label, ja: label }, color: from.color };
    if (copy && from.spray) entry.spray = { ...from.spray };
    this.doc.paints.push(entry);
    this.paintIndex = this.doc.paints.length - 1;
    this.dirty = true;
    this.renderPaints();
    this.rebuild();
  }

  removePaint() {
    if (this.doc.paints.length < 2) return;
    const [gone] = this.doc.paints.splice(this.paintIndex, 1);
    if (this.doc.defaultPaint === gone.id) this.doc.defaultPaint = this.doc.paints[0].id;
    this.paintIndex = Math.min(this.paintIndex, this.doc.paints.length - 1);
    this.dirty = true;
    this.renderPaints();
    this.rebuild();
  }

  renderPaints() {
    this.els.paints.innerHTML = '';
    this.doc.paints.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.index = String(i);
      b.className = i === this.paintIndex ? 'ss-button is-active' : 'ss-button';
      const swatch = document.createElement('i');
      swatch.className = 'ss-fit-swatch';
      swatch.style.background = p.color;
      b.append(swatch, document.createTextNode(localised(p.name, p.id)));
      this.els.paints.appendChild(b);
    });
    const paint = this.paint();
    this.els.paintName.value = localised(paint.name, paint.id);
    this.els.color.value = paint.color;
    this.els.ink.value = this.els.ink.value || '#20242c';
    this.syncSpray();
  }

  syncSpray() {
    const n = Object.keys(this.paint().spray || {}).length;
    this.els.count.textContent = t('fitSprayed', { n: String(n) });
    this.els.clear.disabled = n === 0;
  }

  // ------------------------------------------------------------- the body

  /** Rebuilds the dressed body from the draft, and with it the table of
   *  cells the brush tests against. */
  rebuild() {
    const paint = this.paint();
    const body = buildBody({
      base: this.plan,
      height: DEFAULT_HEIGHT[this.plan],
      build: MANNEQUIN.build,
      outfit: this.doc.cut,
      color: paint.color,
      fit: this.doc.fit,
      paint: cellsOf(paint),
      look: MANNEQUIN.look,
    });
    this.parts = body.parts;
    this.height = body.height;

    if (this.mesh) {
      this.stage.content.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    // Forced to the detailed tier: this is the surface being painted, and a
    // cell the editor cannot show is a cell nobody can aim at.
    this.mesh = new THREE.Mesh(buildGeometry(this.parts, true), BOX_MATERIAL);
    this.stage.content.add(this.mesh);
    this.cells = this.buildCellTable(this.parts);
  }

  frame() {
    const h = this.height || 1.76;
    this.orbit.target.set(0, h * 0.52, 0);
    this.camera.position.set(h * 1.05, h * 0.60, h * 0.42);
    this.camera.near = 0.05;
    this.camera.far = 50;
    this.camera.updateProjectionMatrix();
    this.orbit.update();
  }

  /**
   * Every sprayable cell of every garment box, in model space.
   *
   * The brush is a sphere tested against this table rather than a hit on one
   * face, so a stroke wraps around a sleeve and across the seam between two
   * boxes instead of stopping where the box it started on ends. Only boxes
   * with a `pid` are in it, which is what confines paint to cloth: skin, hair
   * and eyes are not addressable, so they cannot be sprayed by accident.
   */
  buildCellTable(parts) {
    const boxes = parts.filter((b) => b.pid);
    const per = 6 * PAINT_N * PAINT_N;
    const count = boxes.length * per;
    const table = {
      count,
      px: new Float32Array(count), py: new Float32Array(count), pz: new Float32Array(count),
      nx: new Float32Array(count), ny: new Float32Array(count), nz: new Float32Array(count),
      box: new Uint16Array(count),
      face: new Uint8Array(count),
      gx: new Uint8Array(count),
      gy: new Uint8Array(count),
      pids: boxes.map((b) => b.pid),
      colors: boxes.map((b) => b.color),
    };
    let i = 0;
    boxes.forEach((b, bi) => {
      for (let f = 0; f < FACE_BASIS.length; f++) {
        for (let gy = 0; gy < PAINT_N; gy++) {
          for (let gx = 0; gx < PAINT_N; gx++) {
            cellPoint(b, f, gx, gy, this._p, this._n);
            table.px[i] = this._p.x;
            table.py[i] = this._p.y;
            table.pz[i] = this._p.z;
            table.nx[i] = this._n.x;
            table.ny[i] = this._n.y;
            table.nz[i] = this._n.z;
            table.box[i] = bi;
            table.face[i] = f;
            table.gx[i] = gx;
            table.gy[i] = gy;
            i++;
          }
        }
      }
    });
    return table;
  }

  // ------------------------------------------------------------- painting

  pickPoint(e) {
    if (!this.mesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(this._ndc, this.camera);
    const hits = this.ray.intersectObject(this.mesh, false);
    return hits.length ? hits[0].point : null;
  }

  /** Whether a cell can be reached from where the camera is standing. Paint
   *  lands on what you can see, never on the far side of an arm. */
  facing(i) {
    const t2 = this.cells;
    return t2.nx[i] * this._view.x + t2.ny[i] * this._view.y + t2.nz[i] * this._view.z < -0.05;
  }

  nearestCell(point) {
    const table = this.cells;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < table.count; i++) {
      if (!this.facing(i)) continue;
      const dx = table.px[i] - point.x;
      const dy = table.py[i] - point.y;
      const dz = table.pz[i] - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD) {
        bestD = d2;
        best = i;
      }
    }
    return best;
  }

  /**
   * Brings one garment up to the brush's grid, if it is not there already.
   *
   * The brush addresses the finest grid. Cloth painted on a coarser one is
   * rewritten onto the fine grid the moment a stroke lands on that garment,
   * and only that garment: spraying a badge on a pocket must not make the
   * trousers and the boots pay for cells nobody asked for.
   */
  makeFine(paint, pid, erase) {
    if (sprayGrid(paint, pid) === PAINT_N) return true;
    // Erasing from cloth that carries nothing is not a reason to refine it.
    if (erase && !Object.keys(paint.spray || {}).some((k) => k.startsWith(`${pid}|`))) return false;
    upscaleSpray(paint, pid);
    return true;
  }

  writeCell(i, erase, ink) {
    const table = this.cells;
    const paint = this.paint();
    const pid = table.pids[table.box[i]];
    if (!this.makeFine(paint, pid, erase)) return false;
    const key = sprayKey(pid, table.face[i], table.gx[i], table.gy[i]);
    if (erase) {
      if (!paint.spray || paint.spray[key] === undefined) return false;
      delete paint.spray[key];
      return true;
    }
    if (!paint.spray) paint.spray = {};
    if (paint.spray[key] === ink) return false;
    paint.spray[key] = ink;
    return true;
  }

  strokeAt(e) {
    const point = this.pickPoint(e);
    if (!point || !this.cells) return;
    this.camera.getWorldDirection(this._view);

    if (this.tool === 'pick') {
      const i = this.nearestCell(point);
      if (i < 0) return;
      const table = this.cells;
      const pid = table.pids[table.box[i]];
      // The cursor is on a fine cell; the colour under it may have been
      // sprayed on a coarser one, so the address is taken back to that grid.
      const step = PAINT_N / sprayGrid(this.paint(), pid);
      const key = sprayKey(pid, table.face[i],
        Math.floor(table.gx[i] / step), Math.floor(table.gy[i] / step));
      const had = this.paint().spray?.[key];
      this.els.ink.value = hex6(had !== undefined ? had : table.colors[table.box[i]]);
      return;
    }

    const erase = this.tool === 'erase';
    const ink = this.els.ink.value;
    let changed = false;
    if (this.brush <= 1) {
      const i = this.nearestCell(point);
      changed = i >= 0 && this.writeCell(i, erase, ink);
    } else {
      const r = brushRadius(this.brush);
      const r2 = r * r;
      const table = this.cells;
      for (let i = 0; i < table.count; i++) {
        const dx = table.px[i] - point.x;
        const dy = table.py[i] - point.y;
        const dz = table.pz[i] - point.z;
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        if (!this.facing(i)) continue;
        if (this.writeCell(i, erase, ink)) changed = true;
      }
    }
    if (!changed) return;
    this.dirty = true;
    this.repaint();
    this.syncSpray();
  }

  /**
   * Re-colours the mesh in place.
   *
   * A stroke changes colours and nothing else, so rebuilding the body — and
   * with it the four thousand cell positions the brush is being tested
   * against — on every pointermove would be work in the wrong place. The
   * geometry is rebuilt; the cell table is not.
   */
  repaint() {
    // One rebuild per frame, not one per pointer event. A refined garment is
    // a few tens of thousands of vertices, and a dragged stroke can report
    // faster than that can be rebuilt; without this the strokes queue up and
    // the brush lags behind the cursor.
    if (this.repaintQueued) return;
    this.repaintQueued = true;
    requestAnimationFrame(() => {
      this.repaintQueued = false;
      if (this.mesh) this.repaintNow();
    });
  }

  repaintNow() {
    const cells = cellsOf(this.paint());
    for (const b of this.parts) {
      if (!b.pid) continue;
      const sprayed = cells?.get(b.pid);
      if (sprayed) {
        b.paint = sprayed.cells;
        b.paintGrid = sprayed.grid;
      } else {
        delete b.paint;
        delete b.paintGrid;
      }
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = buildGeometry(this.parts, true);
  }

  // ------------------------------------------------------------- document

  /** The draft as a document. Empty fields are left out rather than written
   *  as blanks, so a plain outfit stays a six-line file. */
  build() {
    const cut = { ...this.doc.cut };
    for (const flag of CUT_FLAGS) if (!cut[flag]) delete cut[flag];
    const out = {
      kind: 'outfit',
      version: 1,
      id: this.doc.id,
      name: this.doc.name,
      cut,
      plans: this.doc.plans.slice(),
      paints: this.doc.paints.map((p) => {
        const entry = { id: p.id, name: p.name, color: p.color };
        if (p.spray && Object.keys(p.spray).length) entry.spray = p.spray;
        return entry;
      }),
      defaultPaint: this.doc.defaultPaint || this.doc.paints[0].id,
    };
    if (this.doc.fit?.swell) out.fit = { swell: this.doc.fit.swell };
    return out;
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
  }

  resize(w, h) {
    this.stage.resize(w, h);
  }
}

function hex6(value) {
  return `#${toHex(value, 0x808080).toString(16).padStart(6, '0')}`;
}
