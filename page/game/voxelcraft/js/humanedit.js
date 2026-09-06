import * as THREE from 'three';
import { t } from './i18n.js';
import { FACE_BASIS, PAINT_N, buildVoxGeometry, shadeHex } from './voxmodel.js';
import { humanParts } from './entities.js';
import { isAdvanced } from './quality.js';
import { outfitsFor } from './outfits.js';
import {
  PRESETS, REGIONS, SCALE_MIN, SCALE_MAX, PUSH_MIN, PUSH_MAX, MAX_DESIGNS, MAX_SPRAY,
  cloneDesign, defaultEdit, deleteDesign, designFromPreset, duplicateDesign,
  blockEditFor, editFor, getDesign, hasBlockEdit, listDesigns, saveDesign,
  setBlockEdit, setEdit, setOutfit, sprayKey, sprayCount,
} from './humandesign.js';

// The human editor: pick one of six starting people, then paint and sculpt any
// body region until it is worth saving as an egg. Everything is drawn from the
// same box list the game renders, so what you shape here is exactly what walks
// around the world.

const SWATCHES = [
  0xc8a07a, 0xf0d0b0, 0x8a5a3c, 0x5a3820, 0x2e1e14,
  0xe8e2d6, 0xb8b0a0, 0x6a7078, 0x2b323c, 0x14100c,
  0xc62828, 0xe85a9a, 0xe8c220, 0xe07020, 0x1e5a32,
  0x2a5caa, 0x18a0a8, 0x7a3cb0, 0xa83818, 0x3d8b3d,
];

const SLIDERS = [
  { key: 'sx', labelKey: 'eggWidth', min: SCALE_MIN, max: SCALE_MAX, step: 0.05, base: 1 },
  { key: 'sy', labelKey: 'eggHeight', min: SCALE_MIN, max: SCALE_MAX, step: 0.05, base: 1 },
  { key: 'sz', labelKey: 'eggDepth', min: SCALE_MIN, max: SCALE_MAX, step: 0.05, base: 1 },
  { key: 'ox', labelKey: 'eggPushX', min: PUSH_MIN, max: PUSH_MAX, step: 0.01, base: 0 },
  { key: 'oy', labelKey: 'eggPushY', min: PUSH_MIN, max: PUSH_MAX, step: 0.01, base: 0 },
  { key: 'oz', labelKey: 'eggPushZ', min: PUSH_MIN, max: PUSH_MAX, step: 0.01, base: 0 },
];

const hex6 = (c) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
const fromHex6 = (s) => parseInt(String(s).replace('#', ''), 16) & 0xffffff;

let els = null;
let hooks = { onSave: null, onDelete: null, sfx: null };
let draft = null;
let region = 'head';
let view = { yaw: 0.6, pitch: 0.05, dist: 4.4, dragging: false, lastX: 0, lastY: 0 };

// Spray state. `tool` is what a drag on the model does: 'turn' orbits the
// camera, 'spray' lays paint down, 'erase' lifts it off again.
let tool = 'turn';
// Brush 1 is a single cell — one "dot"; above that it is a sphere whose radius
// grows with the slider.
let brush = 3;
const BRUSH_MAX = 8;
let sprayOnlyRegion = false;
// The box being sculpted on its own, or null while the whole region is shaped.
let blockPid = null;

function brushRadius() {
  return 0.018 + (brush - 2) * 0.022;
}

// --------------------------------------------------------------- rendering

function makeScene() {
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff4e2, 2.0);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.8);
  const amb = new THREE.AmbientLight(0xffffff, 0.72);
  key.position.set(4, 7, 5);
  fill.position.set(-5, 2, -4);
  scene.add(key, fill, amb);
  return scene;
}

const MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

/** Boxes for `design`, with `hi` (if any) lifted so the selected part reads
 *  as selected without a second material or an outline pass. Sprayed cells are
 *  lifted with it, or the highlight would erase the paint from view. */
function previewParts(design, hi, hiPid) {
  const parts = humanParts(design);
  if (!hi && !hiPid) return parts;
  return parts.map((b) => {
    if (hiPid ? b.pid !== hiPid : b.reg !== hi) return b;
    const out = { ...b, color: shadeHex(b.color, 1.45), flat: true };
    if (b.paint) {
      const lifted = new Map();
      for (const [cell, color] of b.paint) lifted.set(cell, shadeHex(color, 1.45));
      out.paint = lifted;
    }
    return out;
  });
}

/** Which region the highlight should show, or null while spraying freehand —
 *  a lit-up part would misreport the colours being laid down. */
function highlightRegion() {
  if (tool === 'turn') return region;
  return sprayOnlyRegion ? region : null;
}

/** While one block is picked, only that block lights up. */
function highlightPid() {
  return tool === 'turn' && blockPid ? blockPid : null;
}

/** The sculpt sliders act on one block when a number is picked, otherwise on
 *  the whole region. */
function currentEdit() {
  return blockPid ? blockEditFor(draft, blockPid) : editFor(draft, region);
}

function writeEdit(edit) {
  if (blockPid) setBlockEdit(draft, blockPid, edit);
  else setEdit(draft, region, edit);
}

// ------------------------------------------------------------- paint cells

const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();
const _v = new THREE.Vector3();

/**
 * Every sprayable cell of every box, in model space. The spray brush is a
 * sphere tested against this table, so a stroke can wrap around an arm and
 * across box seams instead of stopping at the face it started on. Depends
 * only on the box geometry, so it survives a whole stroke unchanged.
 */
function buildCellTable(parts) {
  const boxes = parts.filter((b) => b.pid);
  const per = 6 * PAINT_N * PAINT_N;
  const count = boxes.length * per;
  const t = {
    count,
    px: new Float32Array(count), py: new Float32Array(count), pz: new Float32Array(count),
    nx: new Float32Array(count), ny: new Float32Array(count), nz: new Float32Array(count),
    pidIdx: new Uint16Array(count),
    regIdx: new Uint8Array(count),
    face: new Uint8Array(count),
    gx: new Uint8Array(count),
    gy: new Uint8Array(count),
    pids: [],
    regs: [],
    colors: [],
  };
  const regIndex = new Map();
  let i = 0;
  boxes.forEach((b, bi) => {
    t.pids.push(b.pid);
    t.colors.push(b.color);
    let ri = regIndex.get(b.reg);
    if (ri === undefined) {
      ri = t.regs.length;
      t.regs.push(b.reg || '');
      regIndex.set(b.reg, ri);
    }
    const rot = !!(b.rx || b.ry || b.rz);
    if (rot) {
      _euler.set(b.rx || 0, b.ry || 0, b.rz || 0, 'YXZ');
      _mat.makeRotationFromEuler(_euler);
    }
    for (let f = 0; f < 6; f++) {
      const F = FACE_BASIS[f];
      const ox = F.o[0] * b.w;
      const oy = F.o[1] * b.h;
      const oz = F.o[2] * b.d;
      const ux = F.u[0] * b.w;
      const uy = F.u[1] * b.h;
      const uz = F.u[2] * b.d;
      const vx = F.v[0] * b.w;
      const vy = F.v[1] * b.h;
      const vz = F.v[2] * b.d;
      for (let gy = 0; gy < PAINT_N; gy++) {
        for (let gx = 0; gx < PAINT_N; gx++) {
          const ta = (gx + 0.5) / PAINT_N - 0.5;
          const tb = (gy + 0.5) / PAINT_N - 0.5;
          _v.set(ox + ux * ta + vx * tb, oy + uy * ta + vy * tb, oz + uz * ta + vz * tb);
          if (rot) _v.applyMatrix4(_mat);
          t.px[i] = _v.x + b.x;
          t.py[i] = _v.y + b.y;
          t.pz[i] = _v.z + b.z;
          _v.set(F.n[0], F.n[1], F.n[2]);
          if (rot) _v.applyMatrix4(_mat).normalize();
          t.nx[i] = _v.x;
          t.ny[i] = _v.y;
          t.nz[i] = _v.z;
          t.pidIdx[i] = bi;
          t.regIdx[i] = ri;
          t.face[i] = f;
          t.gx[i] = gx;
          t.gy[i] = gy;
          i++;
        }
      }
    }
  });
  return t;
}

let thumbRenderer = null;
let thumbScene = null;
let thumbCam = null;

/** A small three-quarter portrait of `design` as a data URL, for the cards. */
function renderThumb(design, size = 132) {
  try {
    if (!thumbRenderer) {
      thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
      thumbScene = makeScene();
      thumbCam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    }
  } catch {
    return '';
  }
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.setSize(size, size, false);
  const geo = buildVoxGeometry(humanParts(design), true);
  const mesh = new THREE.Mesh(geo, MAT);
  thumbScene.add(mesh);
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const cy = (box.min.y + box.max.y) / 2;
  const height = Math.max(0.5, box.max.y - box.min.y);
  const dist = height * 2.05;
  thumbCam.position.set(Math.cos(0.62) * dist, cy + height * 0.16, Math.sin(0.62) * dist);
  thumbCam.lookAt(0, cy, 0);
  thumbCam.updateProjectionMatrix();
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL();
  thumbScene.remove(mesh);
  geo.dispose();
  return url;
}

let stage = null;

function ensureStage() {
  if (stage) return stage;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: els.canvas });
  } catch {
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  stage = {
    renderer,
    scene: makeScene(),
    camera: new THREE.PerspectiveCamera(30, 1, 0.05, 80),
    mesh: null,
    centre: 0.85,
    cells: null,
    parts: null,
  };
  return stage;
}

/** Full rebuild: the boxes themselves changed (sculpt, outfit, preset), so the
 *  spray cell table has to be measured again. */
function rebuildPreview() {
  const st = ensureStage();
  if (!st || !draft) return;
  st.parts = humanParts(draft, false);
  st.cells = buildCellTable(st.parts);
  renderBlocks();
  repaintPreview();
}

/** Cheap rebuild: only colours changed, so the cell table still stands. */
function repaintPreview() {
  const st = ensureStage();
  if (!st || !draft) return;
  if (st.mesh) {
    st.scene.remove(st.mesh);
    st.mesh.geometry.dispose();
    st.mesh = null;
  }
  const geo = buildVoxGeometry(previewParts(draft, highlightRegion(), highlightPid()), true);
  geo.computeBoundingBox();
  st.centre = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
  st.mesh = new THREE.Mesh(geo, MAT);
  st.scene.add(st.mesh);
  drawPreview();
}

// ------------------------------------------------------------ spray stroke

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _viewDir = new THREE.Vector3();
let sprayN = 0;
let repaintQueued = false;

function queueRepaint() {
  if (repaintQueued) return;
  repaintQueued = true;
  requestAnimationFrame(() => {
    repaintQueued = false;
    repaintPreview();
    syncSprayCount();
  });
}

/** Where the pointer meets the model, or null if it missed. */
function pickPoint(e) {
  const st = stage;
  if (!st?.mesh) return null;
  const rect = els.canvas.getBoundingClientRect();
  _ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(_ndc, st.camera);
  const hits = raycaster.intersectObject(st.mesh, false);
  return hits.length ? hits[0].point : null;
}

/**
 * Lays paint on every cell inside the brush sphere that faces the camera, so
 * a stroke covers what the player can actually see and never bleeds through
 * to the far side of a limb.
 */
/** Whether cell `i` can be painted from where the camera is standing. */
function cellEligible(t, i, limit) {
  if (t.nx[i] * _viewDir.x + t.ny[i] * _viewDir.y + t.nz[i] * _viewDir.z > -0.05) return false;
  return !limit || t.regs[t.regIdx[i]] === limit;
}

/** The one cell nearest `point`, for the single-dot brush and the dropper. */
function nearestCell(point, limit) {
  const t = stage?.cells;
  if (!t) return -1;
  stage.camera.getWorldDirection(_viewDir);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < t.count; i++) {
    if (!cellEligible(t, i, limit)) continue;
    const dx = t.px[i] - point.x;
    const dy = t.py[i] - point.y;
    const dz = t.pz[i] - point.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

function writeCell(t, i, erase, color) {
  const key = sprayKey(t.pids[t.pidIdx[i]], t.face[i], t.gx[i], t.gy[i]);
  const had = draft.spray[key];
  if (erase) {
    if (had === undefined) return false;
    delete draft.spray[key];
    sprayN--;
    return true;
  }
  if (had === color) return false;
  if (had === undefined) {
    if (sprayN >= MAX_SPRAY) return false;
    sprayN++;
  }
  draft.spray[key] = color;
  return true;
}

/**
 * Lays paint on every cell inside the brush sphere that faces the camera, so
 * a stroke covers what the player can actually see and never bleeds through
 * to the far side of a limb. At size 1 it is a single cell instead.
 */
function sprayAt(point, erase) {
  const t = stage?.cells;
  if (!t || !draft) return false;
  if (!draft.spray) draft.spray = {};
  const limit = sprayOnlyRegion ? region : null;
  const color = fromHex6(els.color.value);
  if (brush <= 1) {
    const i = nearestCell(point, limit);
    return i >= 0 && writeCell(t, i, erase, color);
  }
  stage.camera.getWorldDirection(_viewDir);
  const r = brushRadius();
  const r2 = r * r;
  let changed = false;
  for (let i = 0; i < t.count; i++) {
    const dx = t.px[i] - point.x;
    const dy = t.py[i] - point.y;
    const dz = t.pz[i] - point.z;
    if (dx * dx + dy * dy + dz * dz > r2) continue;
    if (!cellEligible(t, i, limit)) continue;
    if (writeCell(t, i, erase, color)) changed = true;
  }
  return changed;
}

/** Eyedropper: loads the colour already on the model into the picker. */
function pickColorAt(point) {
  const t = stage?.cells;
  const i = nearestCell(point, null);
  if (!t || i < 0) return;
  const key = sprayKey(t.pids[t.pidIdx[i]], t.face[i], t.gx[i], t.gy[i]);
  const sprayed = draft.spray?.[key];
  els.color.value = hex6(sprayed !== undefined ? sprayed : t.colors[t.pidIdx[i]]);
  hooks.sfx?.click?.();
}

function strokeAt(e) {
  const point = pickPoint(e);
  if (!point) return;
  if (tool === 'pick') {
    pickColorAt(point);
    return;
  }
  if (sprayAt(point, tool === 'erase')) queueRepaint();
}

function drawPreview() {
  const st = stage;
  if (!st || !st.mesh) return;
  const rect = els.canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (els.canvas.width !== w * st.renderer.getPixelRatio()
    || els.canvas.height !== h * st.renderer.getPixelRatio()) {
    st.renderer.setSize(w, h, false);
    st.camera.aspect = w / h;
  }
  const d = view.dist;
  st.camera.position.set(
    Math.cos(view.yaw) * Math.cos(view.pitch) * d,
    st.centre + Math.sin(view.pitch) * d,
    Math.sin(view.yaw) * Math.cos(view.pitch) * d,
  );
  st.camera.lookAt(0, st.centre, 0);
  st.camera.updateProjectionMatrix();
  st.renderer.render(st.scene, st.camera);
}

// ---------------------------------------------------------------- gallery

function card({ title, thumb, actions, onPick }) {
  const wrap = document.createElement('div');
  wrap.className = 'egg-card-item';
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'egg-thumb';
  if (thumb) pick.style.backgroundImage = `url(${thumb})`;
  pick.title = title;
  pick.setAttribute('aria-label', title);
  if (onPick) pick.addEventListener('click', onPick);
  else pick.disabled = true;
  wrap.appendChild(pick);
  const name = document.createElement('p');
  name.className = 'egg-card-name';
  name.textContent = title;
  wrap.appendChild(name);
  if (actions?.length) {
    const row = document.createElement('div');
    row.className = 'egg-card-actions';
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'text-btn';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      row.appendChild(b);
    }
    wrap.appendChild(row);
  }
  return wrap;
}

function renderGallery() {
  els.presets.replaceChildren();
  PRESETS.forEach((preset, i) => {
    const design = designFromPreset(i);
    els.presets.appendChild(card({
      title: t(preset.nameKey),
      thumb: renderThumb(design),
      onPick: () => openEditor(designFromPreset(i, t(preset.nameKey))),
    }));
  });

  const saved = listDesigns();
  els.saved.replaceChildren();
  els.empty.hidden = saved.length > 0;
  els.limit.hidden = saved.length < MAX_DESIGNS;
  for (const d of saved) {
    els.saved.appendChild(card({
      title: d.name || t('itemEgg'),
      thumb: renderThumb(d),
      onPick: () => openEditor(cloneDesign(d)),
      actions: [
        { label: t('eggEdit'), onClick: () => openEditor(cloneDesign(d)) },
        {
          label: t('eggDuplicate'),
          onClick: () => {
            const copy = duplicateDesign(d.id);
            if (!copy) {
              hooks.sfx?.denied?.();
              return;
            }
            copy.name = `${d.name || t('itemEgg')}${t('worldCopySuffix')}`.slice(0, 24);
            saveDesign(copy);
            hooks.sfx?.coins?.();
            hooks.onSave?.();
            renderGallery();
          },
        },
        {
          label: t('eggDelete'),
          onClick: () => {
            if (!window.confirm(t('eggDeleteConfirm'))) return;
            deleteDesign(d.id);
            hooks.onDelete?.();
            renderGallery();
          },
        },
      ],
    }));
  }
}

// ----------------------------------------------------------------- editor

/** The boxes of the selected region, in build order, as the numbered chips the
 *  player clicks to sculpt one detail at a time. */
function regionBlocks() {
  const parts = stage?.parts;
  if (!parts) return [];
  return parts.filter((b) => b.reg === region && b.pid);
}

function renderBlocks() {
  els.blocks.replaceChildren();
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'egg-region egg-block';
  all.textContent = t('eggBlockAll');
  all.classList.toggle('on', blockPid === null);
  all.addEventListener('click', () => selectBlock(null));
  els.blocks.appendChild(all);

  regionBlocks().forEach((b, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'egg-region egg-block';
    btn.textContent = String(i + 1);
    btn.title = b.pid;
    btn.setAttribute('aria-label', `${t('eggBlock')} ${i + 1} · ${b.pid}`);
    btn.classList.toggle('on', blockPid === b.pid);
    btn.classList.toggle('edited', hasBlockEdit(draft, b.pid));
    btn.addEventListener('click', () => selectBlock(b.pid));
    els.blocks.appendChild(btn);
  });
}

function selectBlock(pid) {
  blockPid = pid;
  renderBlocks();
  syncControls();
  repaintPreview();
}

function renderRegions() {
  els.regions.replaceChildren();
  for (const r of REGIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'egg-region';
    b.textContent = t(r.labelKey);
    b.classList.toggle('on', r.key === region);
    b.classList.toggle('edited', !!draft.edits?.[r.key] || regionHasBlockEdit(r.key) || regionHasSpray(r.key));
    b.addEventListener('click', () => {
      region = r.key;
      blockPid = null;
      renderRegions();
      renderBlocks();
      syncControls();
      repaintPreview();
    });
    els.regions.appendChild(b);
  }
}

function renderOutfits() {
  els.outfits.replaceChildren();
  for (const o of outfitsFor(draft.base)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'egg-region';
    b.textContent = t(o.labelKey);
    b.classList.toggle('on', o.key === (draft.outfit || 'default'));
    b.addEventListener('click', () => {
      setOutfit(draft, o.key);
      renderOutfits();
      rebuildPreview();
    });
    els.outfits.appendChild(b);
  }
}

const TOOLS = [
  { key: 'turn', labelKey: 'eggToolShape' },
  { key: 'spray', labelKey: 'eggToolSpray' },
  { key: 'erase', labelKey: 'eggToolErase' },
  { key: 'pick', labelKey: 'eggToolPick' },
];

function renderTools() {
  els.tools.replaceChildren();
  for (const item of TOOLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'egg-region';
    b.textContent = t(item.labelKey);
    b.classList.toggle('on', item.key === tool);
    b.addEventListener('click', () => {
      tool = item.key;
      renderTools();
      syncSprayUi();
      repaintPreview();
    });
    els.tools.appendChild(b);
  }
}

function syncBrush() {
  els.brushRange.value = String(brush);
  els.brushVal.textContent = brush <= 1 ? t('eggBrushDot') : String(brush);
}

function syncSprayCount() {
  els.sprayCount.textContent = t('eggSprayCount').replace('{n}', String(sprayN));
  els.sprayClear.disabled = sprayN === 0;
}

function syncSprayUi() {
  const shaping = tool === 'turn';
  const spraying = tool === 'spray' || tool === 'erase';
  els.blockRow.hidden = !shaping;
  els.sculptWrap.hidden = !shaping;
  els.sprayRow.hidden = !spraying;
  els.canvas.classList.toggle('painting', !shaping);
  els.gfxNote.hidden = shaping || isAdvanced();
  els.onlyRegion.checked = sprayOnlyRegion;
  syncBrush();
  syncSprayCount();
}

/** True when any box of `key` has been sculpted on its own. */
function regionHasBlockEdit(key) {
  const parts = stage?.parts;
  if (!parts || !draft.blocks) return false;
  return parts.some((b) => b.reg === key && b.pid && draft.blocks[b.pid]);
}

/** True when any cell of `key` carries spray, so the region chip can show it. */
function regionHasSpray(key) {
  const t = stage?.cells;
  if (!t || !sprayN) return false;
  const pids = new Set();
  for (let i = 0; i < t.count; i += 6 * PAINT_N * PAINT_N) {
    if (t.regs[t.regIdx[i]] === key) pids.add(t.pids[t.pidIdx[i]]);
  }
  for (const cell of Object.keys(draft.spray || {})) {
    if (pids.has(cell.slice(0, cell.indexOf('|')))) return true;
  }
  return false;
}

function renderSliders() {
  els.sliders.replaceChildren();
  for (const s of SLIDERS) {
    const row = document.createElement('label');
    row.className = 'egg-slider';
    const label = document.createElement('span');
    label.textContent = t(s.labelKey);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.dataset.key = s.key;
    const val = document.createElement('i');
    val.className = 'egg-slider-val';
    input.addEventListener('input', () => {
      const edit = { ...currentEdit() };
      edit[s.key] = Number(input.value);
      writeEdit(edit);
      val.textContent = fmt(s, Number(input.value));
      renderRegions();
      renderBlocks();
      rebuildPreview();
    });
    row.append(label, input, val);
    els.sliders.appendChild(row);
  }
}

function fmt(s, v) {
  return s.base === 1 ? `${Math.round(v * 100)}%` : v.toFixed(2);
}

function syncControls() {
  const edit = currentEdit();
  for (const input of els.sliders.querySelectorAll('input[type="range"]')) {
    const s = SLIDERS.find((x) => x.key === input.dataset.key);
    input.value = String(edit[s.key]);
    input.nextElementSibling.textContent = fmt(s, edit[s.key]);
  }
  els.color.value = hex6(edit.color ?? baseColor());
  els.paintClear.disabled = edit.color == null;
  const regionName = t(REGIONS.find((r) => r.key === region)?.labelKey || '');
  if (blockPid) {
    // Name the block by the number on its chip, not by its internal id.
    const n = regionBlocks().findIndex((b) => b.pid === blockPid) + 1;
    els.sculptScope.textContent = t('eggScopeBlock')
      .replace('{n}', String(n))
      .replace('{name}', regionName);
  } else {
    els.sculptScope.textContent = t('eggScopeRegion').replace('{name}', regionName);
  }
}

/** A sensible starting colour for the picker when nothing is painted yet:
 *  the picked block's own colour, or the region's biggest box. */
function baseColor() {
  const parts = humanParts(draft, false);
  if (blockPid) return parts.find((b) => b.pid === blockPid)?.color ?? 0xc8a07a;
  const inRegion = parts.filter((b) => b.reg === region);
  if (!inRegion.length) return 0xc8a07a;
  let best = inRegion[0];
  for (const b of inRegion) {
    if (b.w * b.h * b.d > best.w * best.h * best.d) best = b;
  }
  return best.color;
}

function renderSwatches() {
  els.swatches.replaceChildren();
  for (const c of SWATCHES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'egg-swatch';
    b.style.background = hex6(c);
    b.title = hex6(c);
    b.setAttribute('aria-label', hex6(c));
    b.addEventListener('click', () => {
      els.color.value = hex6(c);
      // With a spray tool up, a swatch only loads the can; it must not
      // repaint the whole selected part behind the player's back.
      if (tool === 'turn') paint(c);
    });
    els.swatches.appendChild(b);
  }
}

function paint(color) {
  writeEdit({ ...currentEdit(), color });
  els.paintClear.disabled = false;
  renderRegions();
  renderBlocks();
  repaintPreview();
}

function openEditor(next) {
  draft = next;
  region = 'head';
  tool = 'turn';
  blockPid = null;
  if (!draft.spray) draft.spray = {};
  if (!draft.blocks) draft.blocks = {};
  sprayN = sprayCount(draft);
  els.gallery.hidden = true;
  els.editor.hidden = false;
  els.name.value = draft.name || '';
  // Rebuilt on every open so the labels follow a language change.
  renderSliders();
  renderRegions();
  renderOutfits();
  renderTools();
  syncBrush();
  syncControls();
  syncSprayUi();
  rebuildPreview();
}

function closeEditor() {
  draft = null;
  els.editor.hidden = true;
  els.gallery.hidden = false;
  renderGallery();
}

function commit() {
  if (!draft) return;
  draft.name = (els.name.value || '').trim().slice(0, 24) || t('itemEgg');
  const saved = saveDesign(draft);
  if (!saved) {
    hooks.sfx?.denied?.();
    els.limit.hidden = false;
    return;
  }
  hooks.sfx?.reward?.();
  hooks.onSave?.();
  closeEditor();
}

// -------------------------------------------------------------------- API

export function eggsOpen() {
  return !!els && !els.overlay.hidden;
}

/** Esc steps back one level: editor to gallery, gallery to closed. */
export function eggsBack() {
  if (!eggsOpen()) return false;
  if (!els.editor.hidden) {
    closeEditor();
    return true;
  }
  closeEggs();
  return false;
}

export function openEggs() {
  if (!els) return;
  els.overlay.hidden = false;
  els.editor.hidden = true;
  els.gallery.hidden = false;
  renderGallery();
}

export function closeEggs() {
  if (!els) return;
  els.overlay.hidden = true;
  draft = null;
}

/** Called when the world's graphics setting changes, so the cards and the
 *  live preview are rebuilt against the new look. */
export function refreshEggUI() {
  if (!eggsOpen()) return;
  if (els.editor.hidden) {
    renderGallery();
    return;
  }
  renderSliders();
  renderRegions();
  renderOutfits();
  renderTools();
  syncBrush();
  syncControls();
  syncSprayUi();
  rebuildPreview();
}

export function initEggUI(opts = {}) {
  hooks = { ...hooks, ...opts };
  els = {
    overlay: document.getElementById('egg-overlay'),
    gallery: document.getElementById('egg-gallery'),
    editor: document.getElementById('egg-editor'),
    presets: document.getElementById('egg-presets'),
    saved: document.getElementById('egg-saved'),
    empty: document.getElementById('egg-empty'),
    limit: document.getElementById('egg-limit'),
    canvas: document.getElementById('egg-canvas'),
    regions: document.getElementById('egg-regions'),
    sliders: document.getElementById('egg-sliders'),
    swatches: document.getElementById('egg-swatches'),
    color: document.getElementById('egg-color'),
    paintApply: document.getElementById('egg-paint-apply'),
    paintClear: document.getElementById('egg-paint-clear'),
    name: document.getElementById('egg-name'),
    outfits: document.getElementById('egg-outfits'),
    tools: document.getElementById('egg-tools'),
    brushRange: document.getElementById('egg-brush-range'),
    brushVal: document.getElementById('egg-brush-val'),
    blocks: document.getElementById('egg-blocks'),
    blockRow: document.getElementById('egg-block-row'),
    sculptScope: document.getElementById('egg-sculpt-scope'),
    sprayRow: document.getElementById('egg-spray-row'),
    sculptWrap: document.getElementById('egg-sculpt-wrap'),
    onlyRegion: document.getElementById('egg-only-region'),
    sprayCount: document.getElementById('egg-spray-count'),
    sprayClear: document.getElementById('egg-spray-clear'),
    gfxNote: document.getElementById('egg-gfx-note'),
  };
  if (!els.overlay) {
    els = null;
    return;
  }

  renderSwatches();

  els.brushRange.min = '1';
  els.brushRange.max = String(BRUSH_MAX);
  els.brushRange.addEventListener('input', () => {
    brush = Math.max(1, Math.min(BRUSH_MAX, Number(els.brushRange.value) || 1));
    syncBrush();
  });

  els.color.addEventListener('input', () => {
    if (tool === 'turn') paint(fromHex6(els.color.value));
  });
  els.paintApply.addEventListener('click', () => paint(fromHex6(els.color.value)));
  els.paintClear.addEventListener('click', () => {
    writeEdit({ ...currentEdit(), color: null });
    syncControls();
    renderRegions();
    renderBlocks();
    repaintPreview();
  });

  els.onlyRegion.addEventListener('change', () => {
    sprayOnlyRegion = els.onlyRegion.checked;
    repaintPreview();
  });
  els.sprayClear.addEventListener('click', () => {
    draft.spray = {};
    sprayN = 0;
    syncSprayCount();
    renderRegions();
    repaintPreview();
  });

  document.getElementById('egg-reset').addEventListener('click', () => {
    writeEdit(defaultEdit());
    syncControls();
    renderRegions();
    rebuildPreview();
  });
  document.getElementById('egg-reset-all').addEventListener('click', () => {
    draft.edits = {};
    draft.blocks = {};
    draft.spray = {};
    sprayN = 0;
    blockPid = null;
    syncControls();
    syncSprayCount();
    renderRegions();
    rebuildPreview();
  });
  document.getElementById('egg-back').addEventListener('click', closeEditor);
  document.getElementById('egg-save').addEventListener('click', commit);
  document.getElementById('egg-close').addEventListener('click', closeEggs);

  // Left drag turns the model, or sprays when a paint tool is picked; the
  // right button always turns, so the view stays reachable mid-stroke.
  els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  els.canvas.addEventListener('pointerdown', (e) => {
    els.canvas.setPointerCapture(e.pointerId);
    if (tool !== 'turn' && e.button === 0) {
      view.painting = true;
      strokeAt(e);
      return;
    }
    view.dragging = true;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
  });
  els.canvas.addEventListener('pointermove', (e) => {
    if (view.painting) {
      strokeAt(e);
      return;
    }
    if (!view.dragging) return;
    view.yaw -= (e.clientX - view.lastX) * 0.012;
    view.pitch = Math.max(-1.1, Math.min(1.1, view.pitch + (e.clientY - view.lastY) * 0.008));
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    drawPreview();
  });
  const stop = (e) => {
    view.dragging = false;
    view.painting = false;
    els.canvas.releasePointerCapture?.(e.pointerId);
  };
  els.canvas.addEventListener('pointerup', stop);
  els.canvas.addEventListener('pointercancel', stop);
  els.canvas.addEventListener('pointerleave', stop);
  els.canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.dist = Math.max(1.4, Math.min(10, view.dist + Math.sign(e.deltaY) * 0.32));
    drawPreview();
  }, { passive: false });

  window.addEventListener('resize', () => {
    if (eggsOpen() && !els.editor.hidden) drawPreview();
  });
}
