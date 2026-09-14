import { initI18n, setLang, getLang, applyI18n, t, localised, LANGS, onLangChange } from './js/i18n.js';
import { initTheme, toggleTheme, getTheme } from './js/theme.js';
import { setDetailed } from './js/render/geometry.js';
import { Registry } from './js/library/registry.js';
import { available as storageAvailable } from './js/library/store.js';
import { readText, readFile, saveAll, removeDocument, importGlb, bundleFor, copyOf, toJson, download } from './js/library/io.js';
import { exportDocumentGlb } from './js/library/glb.js';
import { Playback } from './js/render/playback.js';
import { Viewer } from './js/ui/viewer.js';
import { Transport } from './js/ui/transport.js';
import { LibraryView } from './js/ui/library.js';
import { Editor } from './js/ui/editor.js';
import { SetEditor } from './js/ui/setedit.js';
import { StoryEditor } from './js/ui/storyedit.js';
import { OutfitEditor } from './js/ui/outfitedit.js';
import { ActionEditor } from './js/ui/actionedit.js';
import { PropEditor } from './js/ui/propedit.js';
import { CHARACTER_MODELS } from './js/cast/models.js';
import { characterParts } from './js/cast/build.js';
import { presetsFor } from './js/cast/wardrobe.js';
import { planOf } from './js/cast/body.js';
import { validate } from './js/script/schema.js';
import { expandPlacements } from './js/stage/build.js';

// Boot and routing. There are three views — the library, a film playing, and
// a turntable preview — and one rule that shapes the whole file: the app never
// special-cases official content. Opening a shipped story and opening one a
// visitor pasted in take exactly the same path, because the moment those
// diverge the import feature quietly becomes a second, worse system.

const $ = (sel) => document.querySelector(sel);

const registry = new Registry();
let playback = null;
let viewer = null;
let transport = null;
let libraryView = null;
let editor = null;
let setEditor = null;
let storyEditor = null;
let outfitEditor = null;
let propEditor = null;
let actionEditor = null;
let currentView = 'library';
// What is on screen, so the Edit button in the player and the preview has
// something to open. Watching and editing are the same loop — you play a
// story, see the thing that is wrong, and want the JSON right there — so the
// way back into the editor has to be one click, not a trip to the library.
let currentDoc = null;

// --------------------------------------------------------------- messages

function notice(message, kind = 'info') {
  const bar = $('#ss-notice');
  bar.textContent = message;
  bar.className = `ss-notice is-${kind}`;
  bar.hidden = !message;
}

function clearNotice() {
  $('#ss-notice').hidden = true;
}

function bootProgress(value) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  $('#ss-boot-progress').value = percent;
  $('#ss-boot-percent').value = `${percent}%`;
}

// ------------------------------------------------------------------ views

function show(view) {
  currentView = view;
  for (const name of ['library', 'player', 'preview', 'setedit', 'storyedit', 'fitedit', 'propedit', 'actionedit']) {
    $(`#view-${name}`).hidden = name !== view;
  }
  $('#ss-back').hidden = view === 'library';
  if (view !== 'player') playback?.pause();
  if (view === 'preview') viewer?.start();
  else viewer?.stop();
  if (view === 'setedit') setEditor?.start();
  else setEditor?.stop();
  if (view === 'storyedit') storyEditor?.start();
  else storyEditor?.stop();
  if (view === 'fitedit') outfitEditor?.start();
  else outfitEditor?.stop();
  if (view === 'propedit') propEditor?.start();
  else propEditor?.stop();
  if (view === 'actionedit') actionEditor?.start();
  else actionEditor?.stop();
  if (view !== 'library') resize();
}

function backToLibrary() {
  if (currentView === 'actionedit' && actionEditor?.dirty && !confirm(t('aeDiscard'))) return;
  clearNotice();
  currentDoc = null;
  playback?.pause();
  show('library');
  libraryView.render();
}

// ----------------------------------------------------------------- player

async function openStory(doc) {
  clearNotice();
  currentDoc = doc;
  $('#ss-player-title').textContent = localised(doc.name, doc.id);
  show('player');
  const res = await playback.load(doc, registry);
  if (!res.ok) {
    notice(`${t('problems')}: ${res.errors.map((e) => `${e.path} ${e.message}`).join('; ')}`, 'bad');
    // The notice bar takes height off the stage, so the canvas has to be
    // re-measured after it appears or the set is drawn at the wrong size.
    resize();
    transport.sync();
    return res;
  }
  const notes = [];
  if (playback.missing.length) notes.push(t('missingProps', { list: playback.missing.join(', ') }));
  // Warnings are things the compiler worked around rather than refused. They
  // belong on screen: a film that quietly plays something other than what was
  // written is worse than one that says so.
  for (const w of playback.warnings || []) notes.push(`${w.path} ${w.message}`);
  if (notes.length) {
    notice(notes.join(' · '), 'warn');
    resize();
  }
  transport.sync();
  playback.play();
  transport.sync();
  return res;
}

// ---------------------------------------------------------------- preview

async function openPreview(doc) {
  clearNotice();
  const model = doc.kind === 'character' && CHARACTER_MODELS[doc.model];
  $('#ss-model-options').hidden = !model;
  if (model) $('#ss-model-source').href = model.source;
  viewer.useBlender = true;
  $('#ss-model-blender').classList.add('is-active');
  $('#ss-model-voxel').classList.remove('is-active');
  $('#ss-model-blender').onclick = () => {
    viewer.compareModel(true);
    $('#ss-model-blender').classList.add('is-active');
    $('#ss-model-voxel').classList.remove('is-active');
  };
  $('#ss-model-voxel').onclick = () => {
    viewer.compareModel(false);
    $('#ss-model-blender').classList.remove('is-active');
    $('#ss-model-voxel').classList.add('is-active');
  };
  currentDoc = doc;
  $('#ss-preview-title').textContent = localised(doc.name, doc.id);
  show('preview');
  if (doc.kind === 'character') {
    viewer.showCharacter(doc, doc.defaultOutfit);
    renderOutfitPicker(doc);
    const worn = doc.wardrobe.find((w) => w.id === doc.defaultOutfit);
    renderPaintRow(doc, typeof worn?.outfit === 'string' ? worn.outfit : null, worn);
  } else if (doc.kind === 'prop') {
    clearPickers();
    const ok = await viewer.showProp(doc, (id) => registry.blob(id));
    if (!ok) notice(t('notFound'), 'warn');
  } else if (doc.kind === 'action') {
    clearPickers();
    const demo = demoStory(doc);
    if (!demo) {
      notice(t('noDemo'), 'warn');
      return;
    }
    show('player');
    $('#ss-player-title').textContent = localised(doc.name, doc.id);
    const res = await playback.load(demo, registry);
    if (!res.ok) notice(`${t('problems')}: ${res.errors.map((e) => `${e.path} ${e.message}`).join('; ')}`, 'bad');
    transport.sync();
    playback.play();
  } else if (doc.kind === 'outfit') {
    // An outfit is previewed the only way it can be seen: on somebody. The
    // stand-in is built here rather than kept as a document, because a body
    // that lived in the library would be a character nobody wrote.
    clearPickers();
    const plan = doc.plans?.length && !doc.plans.includes('man') ? doc.plans[0] : 'man';
    const paint = doc.paints[0];
    viewer.showCharacter(validate({
      kind: 'character', version: 1, id: `preview.${doc.id}`, name: doc.name, base: plan,
      look: { skin: '#c8a07a', hair: '#2a1810', hairStyle: 'short', hairLength: 0.2 },
      wardrobe: doc.paints.map((p) => ({ id: p.id, outfit: doc.id, paint: p.id, color: p.color })),
    }).doc, paint.id);
    renderPaintPicker(doc);
  } else if (doc.kind === 'set') {
    // A set previews as the story that would play in it: an empty stage with
    // nobody in it, which is exactly what a set is.
    clearPickers();
    show('player');
    $('#ss-player-title').textContent = localised(doc.name, doc.id);
    await playback.load({
      kind: 'story', version: 1, id: `preview.${doc.id}`,
      name: doc.name, set: doc.id,
      camera: setPreviewCamera(doc),
      setEdits: [], cast: [], timeline: [], embeds: [],
    }, registry);
    transport.sync();
  }
}

/** A throwaway story that performs one action on the empty stage.
 *
 *  Actions are documents now, so the honest way to preview one is to play it
 *  through the same pipeline a real story uses rather than to describe it.
 *  Group actions get one body per role. */
function demoStory(doc) {
  if (['camera', 'cameraFollow', 'stage', 'turn'].includes(doc.type)) return null;
  const pool = ['rui', 'carmen', 'tom', 'lia', 'leo', 'ana', 'mira', 'kai', 'noa', 'sol', 'vic']
    .filter((id) => registry.character(id));
  if (!pool.length) return null;

  const roles = doc.category === 'group' ? doc.roles : [{ id: 'solo' }];
  const cast = roles.map((role, i) => ({
    id: role.id,
    character: registry.character(doc.previewCast?.[role.id]) ? doc.previewCast[role.id] : pool[i % pool.length],
    at: [0, 0, 0],
    yaw: 0,
  }));

  const entry = doc.category === 'group'
    ? { do: doc.id, at: [0, 0, 0], yaw: 0, for: 8, cast: Object.fromEntries(roles.map((r) => [r.id, r.id])) }
    : { actor: 'solo', do: doc.id, for: 8, ...(doc.type === 'speech' ? { text: { en: '…', pt: '…', ja: '…' } } : {}),
      ...(doc.type === 'hold' ? { prop: 'torch' } : {}), ...(doc.type === 'move' ? { to: [3, 0, 0] } : {}) };

  const points = roles.map(r => r.at || [0, 0, 0]);
  const min = [0, 1, 2].map(i => Math.min(...points.map(p => p[i])));
  const max = [0, 1, 2].map(i => Math.max(...points.map(p => p[i])));
  const center = min.map((v, i) => (v + max[i]) / 2);center[1] += .9;
  const height = Math.max(3.2, Math.max(...max.map((v, i) => v - min[i])) * .75 + 1);
  return {
    kind: 'story', version: 1, id: `demo.${doc.id}`, name: doc.name,
    set: 'studio',
    camera: { at: [center[0] + height, center[1] + height * .55, center[2] + height], look: center, fov: 44 },
    setEdits: [{ op: 'remove', id: 'mark' }],
    cast,
    timeline: [entry],
    embeds: [],
  };
}

/** Frames a set by where its props actually are. A fixed camera works for
 *  one set and points at empty grass or the inside of a house for the next. */
function setPreviewCamera(doc) {
  const places = expandPlacements(doc, []);
  if (!places.length) return { at: [12, 8, 12], look: [0, 1, 0], fov: 50 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of places) {
    minX = Math.min(minX, p.at[0]);
    maxX = Math.max(maxX, p.at[0]);
    minZ = Math.min(minZ, p.at[2]);
    maxZ = Math.max(maxZ, p.at[2]);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(6, Math.hypot(maxX - minX, maxZ - minZ));
  return {
    at: [cx + span * 0.62, span * 0.46, cz + span * 0.62],
    look: [cx, 1.2, cz],
    fov: 48,
  };
}

/**
 * The turntable's outfit chips: everything the character owns, and then every
 * preset they do not.
 *
 * A character's wardrobe is a costume list, not a catalogue — four entries,
 * chosen for the stories they appear in — and the preview used to show only
 * those, so a new cut shipped in the format was invisible until somebody
 * edited a document to try it. The second row dresses the character in a
 * preset without touching the document: the entry exists for the length of
 * one click, in a copy, so trying `military` on somebody never writes
 * `military` into their wardrobe.
 */
function clearPickers() {
  $('#ss-outfits').innerHTML = '';
  $('#ss-paints').innerHTML = '';
}

/** The paint chips under an outfit preview: one per scheme the outfit ships,
 *  which is the whole reason a garment carries more than one. */
function renderPaintPicker(doc) {
  const host = $('#ss-outfits');
  host.innerHTML = '';
  if (doc.paints.length < 2) return;
  const mannequin = validate({
    kind: 'character', version: 1, id: `preview.${doc.id}`, name: doc.name,
    base: doc.plans?.length && !doc.plans.includes('man') ? doc.plans[0] : 'man',
    look: { skin: '#c8a07a', hair: '#2a1810', hairStyle: 'short', hairLength: 0.2 },
    wardrobe: doc.paints.map((p) => ({ id: p.id, outfit: doc.id, paint: p.id, color: p.color })),
  }).doc;
  doc.paints.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = localised(p.name, p.id);
    b.className = i === 0 ? 'is-active' : '';
    b.addEventListener('click', () => {
      viewer.showCharacter(mannequin, p.id);
      for (const other of host.children) other.className = '';
      b.className = 'is-active';
    });
    host.appendChild(b);
  });
}

/**
 * The paints of whichever outfit is currently on the figure.
 *
 * A garment carries its schemes — plain, camouflaged, striped — and a picker
 * that only ever showed the first would hide most of what an outfit document
 * is for. Picking one dresses the character in it here and now; writing it
 * into the story is a `paint` on the wardrobe entry.
 */
function renderPaintRow(doc, outfitId, wear) {
  const host = $('#ss-paints');
  host.innerHTML = '';
  const outfit = registry.outfit(outfitId);
  if (!outfit || outfit.paints.length < 2) return;
  outfit.paints.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = localised(p.name, p.id);
    b.className = i === 0 ? 'is-active' : '';
    b.addEventListener('click', () => {
      const fitting = {
        ...doc,
        wardrobe: [...doc.wardrobe, { id: `try.${p.id}`, outfit: outfitId, paint: p.id, color: p.color }],
      };
      viewer.showCharacter(fitting, `try.${p.id}`);
      for (const other of host.children) other.className = '';
      b.className = 'is-active';
    });
    host.appendChild(b);
  });
  // The entry's own colour beats the paint's, so the first chip is only
  // honest about what is on screen when nothing overrode it.
  if (wear?.color && !wear.paint) host.firstChild.className = '';
}

function renderOutfitPicker(doc) {
  const host = $('#ss-outfits');
  host.innerHTML = '';
  const own = doc.wardrobe;
  // Only string outfits can be matched against the preset list; a longhand
  // cut is its own thing and hides nothing from the second row.
  const worn = new Set(own.map((w) => w.outfit).filter((o) => typeof o === 'string'));
  const base = own.find((w) => w.id === doc.defaultOutfit) || own[0];
  const colour = base?.color || '#2a5caa';

  const chip = (label, extra, onPick) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = extra;
    b.dataset.rest = extra;
    b.addEventListener('click', () => {
      onPick();
      for (const other of host.children) {
        if (other.tagName === 'BUTTON') other.className = other.dataset.rest || '';
      }
      b.className = extra ? `${extra} is-active` : 'is-active';
    });
    host.appendChild(b);
    return b;
  };

  for (const w of own) {
    const b = chip(w.id, '', () => {
      viewer.showCharacter(doc, w.id);
      renderPaintRow(doc, typeof w.outfit === 'string' ? w.outfit : null, w);
    });
    if (w.id === doc.defaultOutfit) b.className = 'is-active';
  }

  const rest = presetsFor(planOf(doc.base)).filter((preset) => !worn.has(preset));
  if (!rest.length) return;
  // A line of its own, so the costumes the character actually owns are not
  // lost in a wall of presets.
  const brk = document.createElement('div');
  brk.className = 'ss-outfits-break';
  host.appendChild(brk);
  for (const preset of rest) {
    chip(preset, 'is-try', () => {
      const fitting = { ...doc, wardrobe: [...own, { id: `try.${preset}`, outfit: preset, color: colour }] };
      viewer.showCharacter(fitting, `try.${preset}`);
      renderPaintRow(doc, preset, { color: colour });
    });
  }
}

// ----------------------------------------------------------------- import

function openImport() {
  $('#ss-import-text').value = '';
  $('#ss-import-status').textContent = '';
  $('#dlg-import').showModal();
}

async function acceptDocuments(result) {
  const status = $('#ss-import-status');
  if (!result.ok) {
    status.className = 'ss-editor-status is-bad';
    status.textContent = result.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join('\n');
    return false;
  }
  const saved = await saveAll(result.documents, registry.actionMap());
  await registry.loadUser();
  libraryView.render();
  status.className = 'ss-editor-status is-ok';
  status.textContent = t('imported', { n: saved.length });
  return true;
}

// ---------------------------------------------------------- visual editor

/** The set editor, on the same document the JSON panel edits.
 *
 *  Saving writes a normal `set` through the normal validator, so a set laid
 *  out with the mouse and one typed by hand are the same thing afterwards —
 *  which is the property that stops this becoming a second format. */
async function openSetEditor(doc) {
  clearNotice();
  currentDoc = doc;
  show('setedit');
  await setEditor.load(doc);
  resize();
}

/** The outfit editor, on the same document the JSON panel edits. */
async function openOutfitEditor(doc) {
  clearNotice();
  currentDoc = doc;
  show('fitedit');
  outfitEditor.load(doc);
  resize();
}

async function openActionEditor(doc) {
  clearNotice();
  currentDoc = doc;
  show('actionedit');
  window.scrollTo({ top: 0 });
  await actionEditor.load(doc);
  resize();
}

async function openPropEditor(doc) {
  clearNotice();
  currentDoc = doc;
  show('propedit');
  await propEditor.load(doc);
  resize();
}

/** The story editor, on the same document the JSON panel edits. */
async function openStoryEditor(doc) {
  clearNotice();
  currentDoc = doc;
  show('storyedit');
  await storyEditor.load(doc);
  resize();
}

// ----------------------------------------------------------------- editor

function openEditor(doc) {
  if (!doc) return;
  // A film running behind the dialog is a distraction and keeps burning
  // frames, so opening the editor stops it where it stands.
  playback?.pause();
  transport?.sync();
  editor.load(doc);
  $('#dlg-editor').showModal();
}

/** Duplicate, then open the copy in the editor.
 *
 *  Nobody duplicates a document in order to keep an identical one: the copy
 *  exists to be changed, so the editor is the next click either way, and it
 *  is also where the new id is visible. */
async function duplicate(doc) {
  const copy = copyOf(doc, registry);
  const saved = await saveAll([copy], registry.actionMap());
  if (!saved.length) {
    notice(t('storageOff'), 'warn');
    return;
  }
  await registry.loadUser();
  libraryView.render();
  notice(t('duplicated', { id: copy.id }), 'info');
  openEditor(saved[0]);
}

async function applyEdited(doc) {
  await saveAll([doc], registry.actionMap());
  await registry.loadUser();
  libraryView.render();
  $('#dlg-editor').close();
  if (doc.kind === 'story') return openStory(doc);
  await openPreview(doc);
  return { ok: true, errors: [] };
}

// ----------------------------------------------------------------- layout

function resize() {
  const id = currentView === 'player' ? '#ss-stage-wrap'
    : currentView === 'setedit' ? '#ss-edit-stage'
      : currentView === 'storyedit' ? '#ss-story-stage'
        : currentView === 'fitedit' ? '#ss-fit-stage'
          : currentView === 'propedit' ? '#ss-prop-stage' : currentView === 'actionedit' ? '#ss-action-stage' : '#ss-preview-wrap';
  const stage = $(id);
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  if (currentView === 'player') playback?.resize(rect.width, rect.height);
  else if (currentView === 'setedit') setEditor?.resize(rect.width, rect.height);
  else if (currentView === 'storyedit') storyEditor?.resize(rect.width, rect.height);
  else if (currentView === 'fitedit') outfitEditor?.resize(rect.width, rect.height);
  else if (currentView === 'propedit') propEditor?.resize(rect.width, rect.height);
  else if (currentView === 'actionedit') actionEditor?.resize(rect.width, rect.height);
  else viewer?.resize(rect.width, rect.height);
}

// ------------------------------------------------------------------- boot

async function main() {
  initI18n();
  initTheme();
  applyI18n();
  bootProgress(0);

  // Inside the desktop shell the window already carries the app's name, so
  // repeating it in the page's own header just spends a row of the frame.
  if (window.parent !== window) document.body.classList.add('is-embedded');

  $('#langSelect').value = getLang();
  $('#langSelect').addEventListener('change', (e) => setLang(e.target.value));
  onLangChange(() => {
    libraryView?.render();
    transport?.sync();
    propEditor?.refreshLanguage();
    actionEditor?.translate();
  });
  $('#themeBtn').addEventListener('click', () => {
    toggleTheme();
    $('#themeBtn').textContent = getTheme() === 'dark' ? '☾' : '☀';
  });
  $('#themeBtn').textContent = getTheme() === 'dark' ? '☾' : '☀';

  const detail = $('#ss-detail');
  detail.addEventListener('change', () => setDetailed(detail.checked));
  setDetailed(detail.checked);

  playback = new Playback($('#ss-canvas'), $('#ss-stage-wrap'));
  viewer = new Viewer($('#ss-preview-canvas'));
  transport = new Transport($('#ss-transport'), playback);
  editor = new Editor($('#dlg-editor'), { onApply: applyEdited, actions: () => registry.actionMap() });
  setEditor = new SetEditor($('#view-setedit'), {
    registry,
    onSave: async (doc) => {
      const saved = await saveAll([doc], registry.actionMap());
      if (!saved.length) {
        notice(t('storageOff'), 'warn');
        return;
      }
      await registry.loadUser();
      backToLibrary();
      notice(t('editSaved', { id: doc.id }), 'info');
    },
    onCancel: () => {
      if (setEditor.dirty && !confirm(t('editDiscard'))) return;
      backToLibrary();
    },
  });

  storyEditor = new StoryEditor($('#view-storyedit'), {
    registry,
    onSave: async (doc) => {
      const saved = await saveAll([doc], registry.actionMap());
      if (!saved.length) {
        notice(t('storageOff'), 'warn');
        return;
      }
      await registry.loadUser();
      backToLibrary();
      notice(t('storySaved', { id: doc.id }), 'info');
    },
    onCancel: () => {
      if (storyEditor.dirty && !confirm(t('storyDiscard'))) return;
      backToLibrary();
    },
  });
  // The palette draws a character by baking its body to boxes, which is the
  // cast builder's job and not the editor's to import for itself.
  storyEditor.partsFor = (doc) => characterParts(doc, doc.defaultOutfit).parts;

  outfitEditor = new OutfitEditor($('#view-fitedit'), {
    onSave: async (doc) => {
      const saved = await saveAll([doc], registry.actionMap());
      if (!saved.length) {
        notice(t('storageOff'), 'warn');
        return;
      }
      await registry.loadUser();
      backToLibrary();
      notice(t('fitSaved', { id: doc.id }), 'info');
    },
    onCancel: () => {
      if (outfitEditor.dirty && !confirm(t('fitDiscard'))) return;
      backToLibrary();
    },
  });

  propEditor = new PropEditor($('#view-propedit'), {
    registry,
    onExportGlb: async (doc) => {
      try {
        await exportDocumentGlb(doc);
        notice(t('exportedGlb'), 'info');
      } catch (err) {
        console.error(err);
        notice(t('exportGlbFailed'), 'warn');
      }
    },
    onSave: async (doc) => {
      const saved = await saveAll([doc], registry.actionMap());
      if (!saved.length) { notice(t('storageOff'), 'warn'); return; }
      await registry.loadUser();
      backToLibrary();
      notice(t('propSaved', { id: doc.id }), 'info');
    },
    onCancel: () => {
      if (propEditor.dirty && !confirm(t('propDiscard'))) return;
      backToLibrary();
    },
  });

  actionEditor = new ActionEditor($('#view-actionedit'), {
    registry,
    onSave: async (doc) => {
      const saved = await saveAll([doc], registry.actionMap());
      if (!saved.length) { notice(t('storageOff'), 'warn'); return; }
      await registry.loadUser();
      actionEditor.dirty = false;
      backToLibrary();
      notice(t('aeSaved', { id: doc.id }));
    },
    onCancel: backToLibrary,
  });

  libraryView = new LibraryView($('#view-library'), {
    registry,
    onOpen: (doc) => (doc.kind === 'story' ? openStory(doc) : openPreview(doc)),
    onEdit: openEditor,
    onVisualEdit: (doc) => (doc.kind === 'action' ? openActionEditor(doc) : doc.kind === 'outfit' ? openOutfitEditor(doc) : doc.kind === 'prop' ? openPropEditor(doc) : openSetEditor(doc)),
    onStoryEdit: openStoryEditor,
    onDuplicate: duplicate,
    onExport: (doc) => download(`${doc.kind}-${doc.id}.json`, toJson(doc)),
    onExportGlb: async (doc) => {
      try {
        await exportDocumentGlb(doc);
        notice(t('exportedGlb'), 'info');
      } catch (err) {
        console.error(err);
        notice(t('exportGlbFailed'), 'warn');
      }
    },
    onExportBundle: (doc) => download(`story-${doc.id}.bundle.json`, toJson(bundleFor(doc, registry))),
    onDelete: async (doc) => {
      if (!confirm(t('removeConfirm', { name: localised(doc.name, doc.id) }))) return;
      await removeDocument(doc.kind, doc.id);
      await registry.loadUser();
      libraryView.render();
    },
    onNewAction: () => openActionEditor({ kind: 'action', version: 1, id: `action-${Date.now().toString(36)}`, name: { en: 'New movement', pt: 'Novo movimento', ja: '新しい動き' }, category: 'solo', type: 'overlay', pose: 'stand', duration: 4, joints: [], root: [], props: [] }),
    onNewProp: async () => {
      const id = `object-${Date.now().toString(36)}`;
      const doc = { kind: 'prop', version: 1, id, name: { en: 'New object', pt: 'Novo objeto', ja: '新しい物体' }, source: { type: 'boxes', boxes: [{ w: 1, h: 1, d: 1, x: 0, y: .5, z: 0, color: '#4fd1c5' }] }, footprint: [1, 1] };
      const saved = await saveAll([doc], registry.actionMap());
      await registry.loadUser(); libraryView.render(); openPropEditor(saved[0] || doc);
    },
  });

  $('#ss-back').addEventListener('click', backToLibrary);
  $('#ss-player-edit').addEventListener('click', () => openEditor(currentDoc));
  $('#ss-preview-edit').addEventListener('click', () => openEditor(currentDoc));
  $('#ss-import').addEventListener('click', openImport);
  $('#ss-import-do').addEventListener('click', async () => {
    await acceptDocuments(readText($('#ss-import-text').value, registry.actionMap()));
  });
  $('#ss-import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await acceptDocuments(await readFile(file, registry.actionMap()));
    e.target.value = '';
  });
  $('#ss-import-glb').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const id = file.name.replace(/\.glb$/i, '').replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 60) || 'model';
      const res = await importGlb(file, id, file.name.replace(/\.glb$/i, ''));
      await acceptDocuments({ ok: res.ok, documents: res.ok ? [] : [], errors: res.errors });
      if (res.ok) {
        await registry.loadUser();
        libraryView.render();
        $('#ss-import-status').className = 'ss-editor-status is-ok';
        $('#ss-import-status').textContent = t('imported', { n: 1 });
      }
    }
    e.target.value = '';
  });

  // Dropping a file anywhere is the shortest path from "someone sent me a
  // story" to watching it.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    openImport();
    if (/\.glb$/i.test(file.name)) {
      const id = file.name.replace(/\.glb$/i, '').replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 60) || 'model';
      const res = await importGlb(file, id, file.name.replace(/\.glb$/i, ''));
      if (res.ok) {
        await registry.loadUser();
        libraryView.render();
      }
      return;
    }
    await acceptDocuments(await readFile(file, registry.actionMap()));
  });

  addEventListener('beforeunload', (e) => {
    if (currentView === 'actionedit' && actionEditor?.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  addEventListener('resize', resize);
  addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape' && currentView !== 'library') backToLibrary();
    if (e.key === ' ' && currentView === 'player') {
      e.preventDefault();
      transport.toggle();
    }
  });

  if (!(await storageAvailable())) notice(t('storageOff'), 'warn');
  bootProgress(5 / 100);
  await registry.loadOfficial((progress) => bootProgress(.05 + progress * .9));
  bootProgress(96 / 100);
  await registry.loadUser();
  bootProgress(1);
  if (registry.problems.length) {
    notice(t('libraryProblems', { list: registry.problems.slice(0, 3).join('; ') }), 'warn');
  }
  libraryView.render();
  show('library');
  $('#ss-boot').hidden = true;
}

main().catch((err) => {
  $('#ss-boot').hidden = true;
  notice(`${err.name}: ${err.message}`, 'bad');
  console.error(err);
});

export { registry, validate };
