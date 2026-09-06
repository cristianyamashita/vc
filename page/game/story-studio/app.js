import { initI18n, setLang, getLang, applyI18n, t, localised, LANGS, onLangChange } from './js/i18n.js';
import { initTheme, toggleTheme, getTheme } from './js/theme.js';
import { setDetailed } from './js/render/geometry.js';
import { Registry } from './js/library/registry.js';
import { available as storageAvailable } from './js/library/store.js';
import { readText, readFile, saveAll, removeDocument, importGlb, bundleFor, toJson, download } from './js/library/io.js';
import { Playback } from './js/render/playback.js';
import { Viewer } from './js/ui/viewer.js';
import { Transport } from './js/ui/transport.js';
import { LibraryView } from './js/ui/library.js';
import { Editor } from './js/ui/editor.js';
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
let currentView = 'library';

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

// ------------------------------------------------------------------ views

function show(view) {
  currentView = view;
  for (const name of ['library', 'player', 'preview']) {
    $(`#view-${name}`).hidden = name !== view;
  }
  $('#ss-back').hidden = view === 'library';
  if (view !== 'player') playback?.pause();
  if (view === 'preview') viewer?.start();
  else viewer?.stop();
  if (view !== 'library') resize();
}

function backToLibrary() {
  clearNotice();
  playback?.pause();
  show('library');
  libraryView.render();
}

// ----------------------------------------------------------------- player

async function openStory(doc) {
  clearNotice();
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
  if (playback.missing.length) {
    notice(t('missingProps', { list: playback.missing.join(', ') }), 'warn');
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
  $('#ss-preview-title').textContent = localised(doc.name, doc.id);
  show('preview');
  if (doc.kind === 'character') {
    viewer.showCharacter(doc, doc.defaultOutfit);
    renderOutfitPicker(doc);
  } else if (doc.kind === 'prop') {
    $('#ss-outfits').innerHTML = '';
    const ok = await viewer.showProp(doc, (id) => registry.blob(id));
    if (!ok) notice(t('notFound'), 'warn');
  } else if (doc.kind === 'action') {
    $('#ss-outfits').innerHTML = '';
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
  } else if (doc.kind === 'set') {
    // A set previews as the story that would play in it: an empty stage with
    // nobody in it, which is exactly what a set is.
    $('#ss-outfits').innerHTML = '';
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
  const pool = ['leo', 'ana', 'tom', 'mira', 'kai', 'noa', 'sol', 'vic']
    .filter((id) => registry.character(id));
  if (!pool.length) return null;

  const roles = doc.category === 'group' ? doc.roles : [{ id: 'solo' }];
  const cast = roles.map((role, i) => ({
    id: role.id,
    character: pool[i % pool.length],
    at: [0, 0, 0],
    yaw: 0,
  }));

  const entry = doc.category === 'group'
    ? { do: doc.id, at: [0, 0, 0], yaw: 0, for: 8, cast: Object.fromEntries(roles.map((r) => [r.id, r.id])) }
    : { actor: 'solo', do: doc.id, for: 8, ...(doc.type === 'speech' ? { text: { en: '…', pt: '…', ja: '…' } } : {}),
      ...(doc.type === 'hold' ? { prop: 'torch' } : {}), ...(doc.type === 'move' ? { to: [3, 0, 0] } : {}) };

  const height = doc.category === 'group' ? 4.4 : 3.2;
  return {
    kind: 'story', version: 1, id: `demo.${doc.id}`, name: doc.name,
    set: 'studio',
    camera: { at: [height, height * 0.55, height], look: [0, 0.9, 0], fov: 44 },
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

function renderOutfitPicker(doc) {
  const host = $('#ss-outfits');
  host.innerHTML = '';
  if (doc.wardrobe.length < 2) return;
  for (const w of doc.wardrobe) {
    const b = document.createElement('button');
    b.textContent = w.id;
    b.className = w.id === doc.defaultOutfit ? 'is-active' : '';
    b.addEventListener('click', () => {
      viewer.showCharacter(doc, w.id);
      for (const other of host.children) other.className = '';
      b.className = 'is-active';
    });
    host.appendChild(b);
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

// ----------------------------------------------------------------- editor

function openEditor(doc) {
  editor.load(doc);
  $('#dlg-editor').showModal();
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
  const stage = currentView === 'player' ? $('#ss-stage-wrap') : $('#ss-preview-wrap');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  if (currentView === 'player') playback?.resize(rect.width, rect.height);
  else viewer?.resize(rect.width, rect.height);
}

// ------------------------------------------------------------------- boot

async function main() {
  initI18n();
  initTheme();
  applyI18n();

  // Inside the desktop shell the window already carries the app's name, so
  // repeating it in the page's own header just spends a row of the frame.
  if (window.parent !== window) document.body.classList.add('is-embedded');

  $('#langSelect').value = getLang();
  $('#langSelect').addEventListener('change', (e) => setLang(e.target.value));
  onLangChange(() => {
    libraryView?.render();
    transport?.sync();
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

  libraryView = new LibraryView($('#view-library'), {
    registry,
    onOpen: (doc) => (doc.kind === 'story' ? openStory(doc) : openPreview(doc)),
    onEdit: openEditor,
    onExport: (doc) => download(`${doc.kind}-${doc.id}.json`, toJson(doc)),
    onExportBundle: (doc) => download(`story-${doc.id}.bundle.json`, toJson(bundleFor(doc, registry))),
    onDelete: async (doc) => {
      if (!confirm(t('removeConfirm', { name: localised(doc.name, doc.id) }))) return;
      await removeDocument(doc.kind, doc.id);
      await registry.loadUser();
      libraryView.render();
    },
  });

  $('#ss-back').addEventListener('click', backToLibrary);
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
  await registry.loadOfficial();
  await registry.loadUser();
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
