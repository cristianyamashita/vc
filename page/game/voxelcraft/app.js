import * as THREE from 'three';
import { initLang, setLang, t, applyI18n } from './js/i18n.js';
import { initTheme, toggleTheme, getTheme } from './js/theme.js';
import {
  AIR, GRASS, SAND, LOG, LEAVES, TABLE, TORCH, BEDROCK, CACTUS, FURNACE, DOOR, DOOR_DOUBLE, STAIRS, LADDER, ITEMS, BLOCKS,
  isPlaceable, isSolid, isFlower, isRug, mineSeconds, nameKey, stackMax,
  foodInfo, attackDamage,
} from './js/blocks.js';
import { World, GEN_PER_TICK, biomeNameKey, CHUNK, mapRgb, torchFacingFromHit } from './js/world.js';
import { createAtlas, itemIcon } from './js/textures.js';
import { createWorldMeshes, remeshDirty, disposeMeshes, syncChunkMeshes, setWorldLight } from './js/mesher.js';
import { Player, raycast } from './js/player.js';
import { Arms } from './js/arms.js';
import { Inventory, HOTBAR, clickSlot } from './js/inventory.js';
import { matchRecipe, consumeCraft } from './js/crafting.js';
import { RECIPE_GUIDE, MAT } from './js/recipes.js';
import {
  loadWorldSave, saveWorldSave, deleteWorldSave, saveSettings,
  loadWorldIndex, saveWorldIndex, migrateLegacyWorld, newWorldId,
} from './js/save.js';
import { Life, KINDS } from './js/entities.js';
import {
  emptyFurnace, furnaceKey, tickFurnace, dropFurnaceStacks,
  serializeFurnaces, loadFurnaces, COOK_SEC,
} from './js/furnace.js';
import { isDoorId, placeDoor, toggleDoor, removeDoor, serializeDoors, loadDoors } from './js/doors.js';
import { placeStairs, placeLadder, serializeBlockDir } from './js/stairs.js';
import { tickLeafDecay, serializeLeafDecay, loadLeafDecay } from './js/leaves.js';

const canvas = document.getElementById('view');
const menuEl = document.getElementById('menu');
const deathEl = document.getElementById('death');
const loadingEl = document.getElementById('loading');
const invEl = document.getElementById('inv-overlay');
const playBtn = document.getElementById('play-btn');
const newWorldBtn = document.getElementById('new-world-btn');
const saveWorldBtn = document.getElementById('save-world-btn');
const worldListEl = document.getElementById('world-list');
const respawnBtn = document.getElementById('respawn-btn');
const themeBtn = document.getElementById('theme-btn');
const invTitle = document.getElementById('inv-title');
const craft2Row = document.getElementById('craft-2x2-row');
const craft3Row = document.getElementById('craft-3x3-row');
const recipeBook = document.getElementById('recipe-book');
const recipesBtn = document.getElementById('recipes-btn');
const breakBar = document.getElementById('break-bar');
const blockLabel = document.getElementById('block-label');
const heartsEl = document.getElementById('hearts');
const foodsEl = document.getElementById('foods');
const sleepVeil = document.getElementById('sleep-veil');
const hurtVeil = document.getElementById('hurt-veil');
const hotbarEl = document.getElementById('hotbar');
const offhandSlotEl = document.getElementById('offhand-slot');
const coordsEl = document.getElementById('coords');
const savePill = document.getElementById('save-pill');
const cursorEl = document.getElementById('cursor-item');
const itemTip = document.getElementById('item-tip');
const furnaceRow = document.getElementById('furnace-row');
const timeSlider = document.getElementById('time-slider');
const timeClock = document.getElementById('time-clock');
const mapOverlay = document.getElementById('map-overlay');
const mapCanvas = document.getElementById('world-map');
const mapMeta = document.getElementById('map-meta');

const DAY_CYCLE = 480;
const TIME_PRESETS = { dawn: 40, noon: 120, dusk: 200, night: 360 };
const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 24;
const mapView = { zoom: 4, cx: 0, cz: 0, dragging: false, lastX: 0, lastY: 0, fromPause: false };

const keys = Object.create(null);
const mouse = { left: false, right: false };
let world;
let bundle;
let player;
let inv;
let arms;
let atlas;
let life;
let renderer;
let scene;
let camera;
let sun;
let hemi;
let highlight;
let tableMode = false;
let furnacePos = null;
let mine = null;
let placeCool = 0;
let attackCool = 0;
let eatAcc = 0;
let sleepAcc = 0;
let sleeping = false;
let saveCool = 0;
let worldTime = 0;
let saving = false;
let currentWorldId = null;
let worldBusy = false;
let last = performance.now();

initLang();
initTheme();
syncThemeBtn();

const atlasData = createAtlas();
atlas = atlasData;

renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b7e0);
scene.fog = new THREE.Fog(0x87b7e0, 40, 86);

camera = new THREE.PerspectiveCamera(75, 2, 0.08, 100);
camera.layers.enable(0);
camera.layers.enable(1);
scene.add(camera);

hemi = new THREE.HemisphereLight(0xd4e8ff, 0x6a7a58, 1.05);
hemi.layers.enable(1);
scene.add(hemi);
sun = new THREE.DirectionalLight(0xfff6e4, 1.45);
sun.position.set(40, 80, 20);
sun.layers.enable(1);
scene.add(sun);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
ambient.layers.enable(1);
scene.add(ambient);
const armLight = new THREE.PointLight(0xffffff, 0.9, 5);
armLight.position.set(0.1, 0.1, 0.2);
armLight.layers.set(1);
camera.add(armLight);
const heldTorchLight = new THREE.PointLight(0xffc060, 0, 8, 1.4);
heldTorchLight.position.set(0.18, -0.08, -0.28);
heldTorchLight.layers.set(1);
camera.add(heldTorchLight);

highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
  new THREE.LineBasicMaterial({ color: 0x000000 }),
);
highlight.visible = false;
scene.add(highlight);

arms = new Arms(camera);
buildHearts();
buildFoods();
buildHotbarHud();
buildInvDom();

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);

document.querySelectorAll('[data-lang]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setLang(btn.getAttribute('data-lang'));
    persistUi();
    refreshHud();
    refreshInv();
    renderRecipeBook();
    syncRecipesBtn();
    if (player) playBtn.textContent = menuPaused ? t('resume') : t('clickToPlay');
    syncTimeUi();
    refreshWorldList();
    if (mapOpen()) drawWorldMap();
  });
});

themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTheme();
  syncThemeBtn();
  persistUi();
  if (mapOpen()) drawWorldMap();
});

timeSlider.addEventListener('pointerdown', (e) => e.stopPropagation());
timeSlider.addEventListener('input', () => {
  setWorldTime(Number(timeSlider.value), false);
});
timeSlider.addEventListener('change', () => {
  setWorldTime(Number(timeSlider.value), true);
});
document.querySelectorAll('[data-tod]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const key = btn.getAttribute('data-tod');
    if (TIME_PRESETS[key] == null) return;
    setWorldTime(TIME_PRESETS[key], true);
  });
});

playBtn.addEventListener('click', () => requestPlay());
newWorldBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startNewWorld({ promptName: true });
});
saveWorldBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!player || !world || worldBusy) return;
  persist().then(() => refreshWorldList());
});
worldListEl.addEventListener('click', (e) => {
  e.stopPropagation();
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.world-row');
  const id = row?.dataset.id;
  if (!id) return;
  const act = btn.getAttribute('data-act');
  if (act === 'load') switchWorld(id);
  else if (act === 'rename') renameWorld(id);
  else if (act === 'delete') deleteWorld(id);
});
document.getElementById('open-map-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  openMap(true);
});
document.getElementById('map-close').addEventListener('click', (e) => {
  e.stopPropagation();
  closeMap();
});
document.getElementById('map-zoom-in').addEventListener('click', (e) => {
  e.stopPropagation();
  zoomMapCenter(1.25);
});
document.getElementById('map-zoom-out').addEventListener('click', (e) => {
  e.stopPropagation();
  zoomMapCenter(0.8);
});
mapCanvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  mapView.dragging = true;
  mapView.lastX = e.clientX;
  mapView.lastY = e.clientY;
  mapCanvas.classList.add('dragging');
  mapCanvas.setPointerCapture(e.pointerId);
});
mapCanvas.addEventListener('pointermove', (e) => {
  if (!mapView.dragging) return;
  mapView.cx -= (e.clientX - mapView.lastX) / mapView.zoom;
  mapView.cz -= (e.clientY - mapView.lastY) / mapView.zoom;
  mapView.lastX = e.clientX;
  mapView.lastY = e.clientY;
  drawWorldMap();
});
function endMapDrag() {
  mapView.dragging = false;
  mapCanvas.classList.remove('dragging');
}
mapCanvas.addEventListener('pointerup', endMapDrag);
mapCanvas.addEventListener('pointercancel', endMapDrag);
mapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
respawnBtn.addEventListener('click', () => {
  player.respawn();
  deathEl.hidden = true;
  requestPlay();
});
document.getElementById('inv-close').addEventListener('click', () => closeInv());
recipesBtn.addEventListener('click', () => setRecipesOpen(recipeBook.hidden));
document.getElementById('recipes-hide').addEventListener('click', () => setRecipesOpen(false));

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
  if (!document.pointerLockElement && !invOpen() && deathEl.hidden && !mapOpen()) requestPlay();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement && player) player.lookDelta(e.movementX, e.movementY);
  if (invOpen()) {
    cursorEl.style.left = `${e.clientX + 8}px`;
    cursorEl.style.top = `${e.clientY + 8}px`;
  }
  updateItemTip(e);
});
let ignoreEscUntil = 0;

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !invOpen() && player?.health > 0 && menuEl.hidden && !mapOpen()) {
    showMenu(true);
    ignoreEscUntil = performance.now() + 250;
  }
});
document.addEventListener('pointerlockerror', () => {});

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'ControlLeft' && isPlaying()) e.preventDefault();
  if (e.code === 'Escape') {
    if (e.repeat || performance.now() < ignoreEscUntil) return;
    if (mapOpen()) {
      closeMap({ toPause: true });
      return;
    }
    if (invOpen()) {
      closeInv();
      return;
    }
    if (!player || player.health <= 0 || !loadingEl.hidden || !deathEl.hidden) return;
    if (menuEl.hidden) {
      document.exitPointerLock?.();
      showMenu(true);
    } else if (menuPaused) {
      e.preventDefault();
      requestPlay();
    }
    return;
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    if (!loadingEl.hidden || invOpen() || !deathEl.hidden) return;
    toggleMap();
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyE') {
    e.preventDefault();
    if (mapOpen()) return;
    if (invOpen()) closeInv();
    else if (player && menuEl.hidden && player.health > 0) openInv(false);
  }
  if (e.code === 'KeyQ' && isPlaying()) {
    inv.dropOne();
    refreshHud();
  }
  if (e.code === 'KeyF' && player && player.health > 0 && (isPlaying() || invOpen())) {
    e.preventDefault();
    inv.swapOffhand();
    refreshHud();
    if (invOpen()) refreshInv();
  }
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 9) {
      inv.selected = n - 1;
      refreshHud();
    }
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('wheel', (e) => {
  if (mapOpen()) {
    e.preventDefault();
    zoomMapAt(e.clientX, e.clientY, e.deltaY > 0 ? 0.85 : 1.18);
    return;
  }
  if (!player || invOpen() || !menuEl.hidden) return;
  e.preventDefault();
  const dir = e.deltaY > 0 ? 1 : -1;
  inv.selected = (inv.selected + dir + HOTBAR) % HOTBAR;
  refreshHud();
}, { passive: false });

hotbarEl.addEventListener('click', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  inv.selected = Number(slot.dataset.index);
  refreshHud();
});
offhandSlotEl.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!inv) return;
  inv.swapOffhand();
  refreshHud();
});

invEl.addEventListener('mousedown', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  e.preventDefault();
  handleSlotClick(slot, e.button === 2);
});
invEl.addEventListener('contextmenu', (e) => e.preventDefault());

function resize() {
  const w = Math.max(1, innerWidth);
  const h = Math.max(1, innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (mapOpen()) drawWorldMap();
}

function syncThemeBtn() {
  themeBtn.textContent = getTheme() === 'dark' ? '☾' : '☀';
}

function persistUi() {
  saveSettings({ lang: document.documentElement.lang, theme: getTheme() }).catch(() => {});
}

let menuPaused = false;

function showMenu(paused) {
  closeMapSilent();
  menuPaused = !!paused;
  menuEl.hidden = false;
  playBtn.textContent = paused ? t('resume') : t('clickToPlay');
  syncTimeUi();
  refreshWorldList();
}

function hideMenu() {
  menuEl.hidden = true;
}

function invOpen() {
  return !invEl.hidden;
}

function mapOpen() {
  return !mapOverlay.hidden;
}

function isPlaying() {
  return !!player && player.health > 0 && !invOpen() && menuEl.hidden && deathEl.hidden && !mapOpen();
}

function requestPlay() {
  if (!player || player.health <= 0) return;
  closeMapSilent();
  hideMenu();
  resize();
  canvas.requestPointerLock?.();
}

function openInv(table) {
  furnacePos = null;
  furnaceRow.hidden = true;
  tableMode = table;
  document.exitPointerLock();
  invEl.hidden = false;
  craft2Row.hidden = table;
  craft3Row.hidden = !table;
  invTitle.textContent = table ? t('craftingTable') : t('inventory');
  refreshInv();
  setRecipesOpen(true);
  requestAnimationFrame(() => {
    recipeBook.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

function openFurnace(x, y, z) {
  const key = furnaceKey(x, y, z);
  if (!world.furnaces[key]) world.furnaces[key] = emptyFurnace();
  furnacePos = { x, y, z, key };
  tableMode = false;
  document.exitPointerLock();
  invEl.hidden = false;
  craft2Row.hidden = true;
  craft3Row.hidden = true;
  furnaceRow.hidden = false;
  invTitle.textContent = t('furnace');
  refreshInv();
  setRecipesOpen(false);
}

function closeInv() {
  hideItemTip();
  if (furnacePos) {
    furnacePos = null;
    furnaceRow.hidden = true;
  } else if (tableMode) inv.returnCraft(inv.craft3);
  else inv.returnCraft(inv.craft2);
  tableMode = false;
  invEl.hidden = true;
  cursorEl.hidden = true;
  refreshHud();
  if (player.health > 0) canvas.requestPointerLock();
}

function canEatFood(food) {
  if (!food || !player) return false;
  if (player.hunger < player.maxHunger) return true;
  return (food.heal || 0) > 0 && player.health < player.maxHealth;
}

function currentFurnace() {
  if (!furnacePos || !world) return emptyFurnace();
  if (!world.furnaces[furnacePos.key]) world.furnaces[furnacePos.key] = emptyFurnace();
  return world.furnaces[furnacePos.key];
}

function tickFurnaces(dt) {
  if (!world?.furnaces) return;
  for (const f of Object.values(world.furnaces)) tickFurnace(f, dt);
  if (!furnacePos) return;
  const f = currentFurnace();
  paintSlot(document.getElementById('furnace-in'), f.input, false);
  paintSlot(document.getElementById('furnace-fuel'), f.fuel, false);
  paintSlot(document.getElementById('furnace-out'), f.out, false);
  paintFurnaceBars(f);
}

function tickDecay(dt) {
  if (!world || !bundle) return;
  if (tickLeafDecay(world, dt)) remeshDirty(world, bundle);
}

function paintFurnaceBars(f) {
  const cook = document.querySelector('#furnace-cook i');
  const burn = document.querySelector('#furnace-burn i');
  if (cook) cook.style.width = `${Math.min(100, (f.cook / COOK_SEC) * 100)}%`;
  if (burn) burn.style.width = f.burnMax ? `${Math.min(100, (f.burn / f.burnMax) * 100)}%` : '0%';
}

function handleFurnaceClick(list, right) {
  const f = currentFurnace();
  if (list === 'fout') {
    if (!f.out) return;
    if (!inv.cursor) {
      inv.cursor = f.out;
      f.out = null;
    } else if (inv.cursor.id === f.out.id && !ITEMS[inv.cursor.id]?.tool) {
      const room = stackMax(inv.cursor.id) - inv.cursor.n;
      const take = Math.min(room, f.out.n);
      inv.cursor.n += take;
      f.out.n -= take;
      if (f.out.n <= 0) f.out = null;
    }
    return;
  }
  const arr = list === 'fin' ? [f.input] : [f.fuel];
  inv.cursor = clickSlot(arr, 0, inv.cursor, right);
  if (list === 'fin') f.input = arr[0];
  else f.fuel = arr[0];
}

function hideItemTip() {
  itemTip.hidden = true;
}

function updateItemTip(e) {
  if (document.pointerLockElement || !itemTip) {
    hideItemTip();
    return;
  }
  const slot = e.target?.closest?.('.slot, .guide-cell');
  if (!slot) {
    hideItemTip();
    return;
  }
  const id = Number(slot.dataset.itemId);
  const name = id ? t(nameKey(id)) : (slot.title || '');
  if (!name) {
    hideItemTip();
    return;
  }
  itemTip.hidden = false;
  itemTip.textContent = name;
  itemTip.style.left = `${e.clientX + 14}px`;
  itemTip.style.top = `${e.clientY + 16}px`;
}

function setLoadingText(key) {
  const p = loadingEl.querySelector('p');
  if (p) p.textContent = t(key);
}

function teardownWorld() {
  if (bundle) {
    scene.remove(bundle.group);
    disposeMeshes(bundle);
    bundle = null;
  }
  if (life) {
    life.dispose();
    life = null;
  }
}

function generateFreshWorld() {
  teardownWorld();
  const seed = (Math.random() * 0xffffffff) >>> 0;
  world = new World(seed);
  bundle = createWorldMeshes(atlas.texture);
  scene.add(bundle.group);
  player = new Player();
  const spawn = world.findSpawn();
  world.ensureAround(spawn.x, spawn.z);
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.spawn.copy(player.pos);
  player.fallY = player.pos.y;
  inv = new Inventory();
  worldTime = 120;
  mine = null;
  furnacePos = null;
  furnaceRow.hidden = true;
  sleepAcc = 0;
  sleeping = false;
  eatAcc = 0;
  life = new Life(scene);
  life.populate(world, player, false);
  syncChunkMeshes(world, bundle, spawn.x, spawn.z);
}

async function refreshWorldList() {
  if (!worldListEl) return;
  const index = await loadWorldIndex();
  worldListEl.replaceChildren();
  const locale = document.documentElement.lang || 'en';
  const sorted = index.list.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
  for (const w of sorted) {
    const li = document.createElement('li');
    li.className = 'world-row' + (w.id === currentWorldId ? ' current' : '');
    li.dataset.id = w.id;

    const meta = document.createElement('div');
    meta.className = 'world-meta';
    const title = document.createElement('strong');
    title.textContent = w.name || t('worldNamePrefix');
    if (w.id === currentWorldId) {
      const badge = document.createElement('span');
      badge.className = 'world-badge';
      badge.textContent = t('currentWorld');
      title.appendChild(badge);
    }
    meta.appendChild(title);
    const date = document.createElement('span');
    date.className = 'world-date';
    date.textContent = w.updated ? new Date(w.updated).toLocaleString(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }) : '';
    meta.appendChild(date);
    li.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'world-row-actions';
    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.setAttribute('data-act', 'load');
    loadBtn.textContent = t('loadWorld');
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.setAttribute('data-act', 'rename');
    renameBtn.textContent = t('renameWorld');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.setAttribute('data-act', 'delete');
    delBtn.textContent = t('deleteWorld');
    actions.append(loadBtn, renameBtn, delBtn);
    li.appendChild(actions);
    worldListEl.appendChild(li);
  }
}

async function boot() {
  loadingEl.hidden = false;
  setLoadingText('loading');
  const index = await migrateLegacyWorld(`${t('worldNamePrefix')} 1`);
  currentWorldId = index.current;
  if (currentWorldId) {
    const save = await loadWorldSave(currentWorldId);
    if (save?.seed) await loadFromSave(save);
    else {
      generateFreshWorld();
      await persist();
    }
  } else {
    await startNewWorld({ promptName: false });
  }
  loadingEl.hidden = true;
  showMenu(false);
}

async function startNewWorld({ promptName = true } = {}) {
  if (worldBusy) return;
  const index = await loadWorldIndex();
  const suggested = `${t('worldNamePrefix')} ${index.list.length + 1}`;
  let name = suggested;
  if (promptName) {
    const entered = window.prompt(t('worldNamePrompt'), suggested);
    if (entered == null) return;
    name = entered.trim() || suggested;
  }
  worldBusy = true;
  try {
    if (player && world && currentWorldId) await persist();
    loadingEl.hidden = false;
    hideMenu();
    setLoadingText('loading');
    generateFreshWorld();
    const id = newWorldId();
    currentWorldId = id;
    const next = await loadWorldIndex();
    next.list.push({ id, name, created: Date.now(), updated: Date.now() });
    next.current = id;
    await saveWorldIndex(next);
    await persist();
    refreshHud();
    loadingEl.hidden = true;
    resize();
    showMenu(false);
  } finally {
    worldBusy = false;
  }
}

async function switchWorld(id) {
  if (worldBusy || !id) return;
  if (id === currentWorldId && player) {
    requestPlay();
    return;
  }
  worldBusy = true;
  try {
    if (player && world && currentWorldId) await persist();
    loadingEl.hidden = false;
    hideMenu();
    setLoadingText('loadingWorld');
    const save = await loadWorldSave(id);
    currentWorldId = id;
    const index = await loadWorldIndex();
    index.current = id;
    await saveWorldIndex(index);
    if (save?.seed) await loadFromSave(save);
    else {
      generateFreshWorld();
      await persist();
    }
    refreshHud();
    loadingEl.hidden = true;
    resize();
    showMenu(true);
  } finally {
    worldBusy = false;
  }
}

async function renameWorld(id) {
  const index = await loadWorldIndex();
  const entry = index.list.find((w) => w.id === id);
  if (!entry) return;
  const entered = window.prompt(t('worldNamePrompt'), entry.name);
  if (entered == null) return;
  entry.name = entered.trim() || entry.name;
  await saveWorldIndex(index);
  await refreshWorldList();
}

async function deleteWorld(id) {
  if (worldBusy) return;
  if (!window.confirm(t('deleteWorldConfirm'))) return;
  worldBusy = true;
  try {
    const index = await loadWorldIndex();
    const remaining = index.list.filter((w) => w.id !== id);
    await deleteWorldSave(id);
    if (!remaining.length) {
      currentWorldId = null;
      await saveWorldIndex({ current: null, list: [] });
      worldBusy = false;
      await startNewWorld({ promptName: false });
      return;
    }
    index.list = remaining;
    if (id === currentWorldId) {
      const next = remaining.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
      currentWorldId = null;
      index.current = next.id;
      await saveWorldIndex(index);
      worldBusy = false;
      await switchWorld(next.id);
      return;
    }
    await saveWorldIndex(index);
    await refreshWorldList();
  } finally {
    worldBusy = false;
  }
}

async function loadFromSave(save) {
  if (bundle) {
    scene.remove(bundle.group);
    disposeMeshes(bundle);
    bundle = null;
  }
  if (life) {
    life.dispose();
    life = null;
  }
  world = new World(save.seed);
  world.applyEdits(save.edits || {});
  world.loadTorchDir(save.torchDir);
  world.furnaces = loadFurnaces(save.furnaces);
  world.doors = loadDoors(save.doors);
  world.leafDecay = loadLeafDecay(save.leafDecay);
  world.loadBlockDir(save.blockDir);
  furnacePos = null;
  furnaceRow.hidden = true;
  world.loadMap(save.map);
  bundle = createWorldMeshes(atlas.texture);
  scene.add(bundle.group);
  player = new Player();
  inv = new Inventory();
  if (save.player) {
    player.pos.set(save.player.x, save.player.y, save.player.z);
    player.yaw = save.player.yaw || 0;
    player.pitch = save.player.pitch || 0;
    player.health = save.player.health ?? 20;
    player.hunger = save.player.hunger ?? 20;
    if (save.player.sx != null) player.spawn.set(save.player.sx, save.player.sy, save.player.sz);
    else player.spawn.copy(player.pos);
  } else {
    const spawn = world.findSpawn();
    player.pos.set(spawn.x, spawn.y, spawn.z);
    player.spawn.copy(player.pos);
  }
  player.fallY = player.pos.y;
  if (save.inventory) inv.load(save.inventory);
  world.ensureAround(player.pos.x, player.pos.z);
  syncChunkMeshes(world, bundle, player.pos.x, player.pos.z);
  world.rebuildMapFromChunks();
  worldTime = save.worldTime ?? 120;
  life = new Life(scene);
  if (save.entities?.length) life.load(save.entities, world);
  else life.populate(world, player, false);
  refreshHud();
  syncTimeUi();
}

function snapshot() {
  return {
    seed: world.seed,
    edits: world.edits,
    worldTime,
    map: world.encodeMap(),
    torchDir: world.torchDir,
    furnaces: serializeFurnaces(world.furnaces),
    doors: serializeDoors(world.doors),
    leafDecay: serializeLeafDecay(world.leafDecay),
    blockDir: serializeBlockDir(world.blockDir),
    player: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch, health: player.health,
      hunger: player.hunger,
      sx: player.spawn.x, sy: player.spawn.y, sz: player.spawn.z,
    },
    inventory: inv.serialize(),
    entities: life ? life.serialize() : [],
  };
}

async function persist() {
  if (!player || !world || !currentWorldId) return;
  saving = true;
  savePill.textContent = t('saving');
  try {
    await saveWorldSave(currentWorldId, snapshot());
    const index = await loadWorldIndex();
    let entry = index.list.find((w) => w.id === currentWorldId);
    if (!entry) {
      entry = {
        id: currentWorldId,
        name: `${t('worldNamePrefix')} ${index.list.length + 1}`,
        created: Date.now(),
        updated: Date.now(),
      };
      index.list.push(entry);
    } else {
      entry.updated = Date.now();
    }
    index.current = currentWorldId;
    await saveWorldIndex(index);
    savePill.textContent = t('saved');
  } catch {
    savePill.textContent = t('saved');
  }
  saving = false;
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (isPlaying()) tick(dt);
    else if (player && world) {
      tickFurnaces(dt);
      tickDecay(dt);
      if (furnacePos) {
        const d = Math.hypot(player.pos.x - furnacePos.x - 0.5, player.pos.y - furnacePos.y, player.pos.z - furnacePos.z - 0.5);
        if (d > 6) closeInv();
      }
      const biome = t(biomeNameKey(world.biomeAt(player.pos.x, player.pos.z)));
      coordsEl.textContent = `${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)} · ${biome}`;
    }
    render(dt);
  } catch (err) {
    coordsEl.textContent = String(err && err.message ? err.message : err);
    console.error(err);
  }
  requestAnimationFrame(loop);
}

function tick(dt) {
  worldTime += dt;
  placeCool = Math.max(0, placeCool - dt);
  saveCool += dt;
  if (saveCool > 8 && !saving && !worldBusy) {
    saveCool = 0;
    persist();
  }

  const input = {
    forward: keys.KeyW || keys.ArrowUp,
    back: keys.KeyS || keys.ArrowDown,
    left: keys.KeyA || keys.ArrowLeft,
    right: keys.KeyD || keys.ArrowRight,
    jump: keys.Space,
    sneak: keys.ShiftLeft || keys.ShiftRight,
    sprint: keys.ControlLeft,
  };
  world.ensureAround(player.pos.x, player.pos.z, undefined, GEN_PER_TICK);
  player.update(dt, world, input);
  world.ensureAround(player.pos.x, player.pos.z, undefined, GEN_PER_TICK);
  world.unloadFar(player.pos.x, player.pos.z);
  syncChunkMeshes(world, bundle, player.pos.x, player.pos.z);
  player.applyLook(camera);

  const hour = hourFromWorldTime(worldTime);
  const night = hour >= 19 || hour < 6;
  const duskNight = hour >= 16 || hour < 6;
  tickFurnaces(dt);
  tickDecay(dt);
  if (life) {
    const lifeCtx = {
      night,
      duskNight,
      sleeping: sleeping || sleepAcc > 0,
      holdingFlower: life.holdingFlower(inv),
      hitPlayer: false,
    };
    life.update(dt, world, player, lifeCtx);
    if (lifeCtx.hitPlayer) {
      player.pitch = Math.max(player.pitch - 0.06, -Math.PI / 2 + 0.04);
      player.yaw += (Math.random() - 0.5) * 0.1;
    }
  }

  if (player.health <= 0) {
    document.exitPointerLock();
    deathEl.hidden = false;
    persist();
    return;
  }

  const origin = player.eyePosition();
  player.applyLook(camera);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = raycast(world, origin, dir);
  const entHit = life ? life.raycast(origin, dir) : null;
  const preferEnt = entHit && (!hit || entHit.dist <= hit.dist);
  updateHighlight(hit, preferEnt ? entHit : null);

  const walking = input.forward || input.back || input.left || input.right;
  attackCool = Math.max(0, attackCool - dt);
  const mining = mouse.left && !preferEnt && hit && BLOCKS[hit.id] && hit.id !== BEDROCK;
  arms.setHeld(inv.selectedStack()?.id || 0);
  arms.setOffhand(inv.offhand?.id || 0);
  arms.update(dt, walking && player.onGround, mining || (mouse.left && preferEnt));

  if (mouse.left && preferEnt) {
    mine = null;
    breakBar.hidden = true;
    if (attackCool <= 0) {
      const loot = life.hurt(entHit.e, attackDamage(inv.selectedStack()), player.pos);
      for (const d of loot) inv.add(d.id, d.n);
      if (ITEMS[inv.selectedStack()?.id]?.tool) inv.wearSelected();
      arms.punch();
      attackCool = 0.4;
      refreshHud();
    }
  } else if (mining) {
    if (!mine || mine.x !== hit.x || mine.y !== hit.y || mine.z !== hit.z) {
      mine = { x: hit.x, y: hit.y, z: hit.z, t: 0, need: mineSeconds(hit.id, inv.selectedStack()) };
    }
    mine.t += dt;
    if (mine.t >= 0.28 && mine.t % 0.28 < dt) arms.punch();
    const pct = mine.need === Infinity ? 0 : mine.t / mine.need;
    breakBar.hidden = false;
    breakBar.classList.remove('eat');
    breakBar.querySelector('i').style.width = `${Math.min(100, pct * 100)}%`;
    if (mine.t >= mine.need) {
      breakBlock(hit);
      mine = null;
      breakBar.hidden = true;
    }
  } else {
    mine = null;
    if (!mouse.right) {
      breakBar.hidden = true;
      breakBar.classList.remove('eat');
    }
  }

  const sneak = keys.ShiftLeft || keys.ShiftRight;
  const selFood = foodInfo(inv.selectedStack());
  const offFood = foodInfo(inv.offhand);
  if (mouse.right) {
    if (hit?.id === TABLE && !sneak) {
      if (placeCool <= 0) {
        placeCool = 0.18;
        openInv(true);
      }
      eatAcc = 0;
    } else if (hit?.id === FURNACE && !sneak) {
      if (placeCool <= 0) {
        placeCool = 0.18;
        openFurnace(hit.x, hit.y, hit.z);
      }
      eatAcc = 0;
    } else if (isDoorId(hit?.id) && !sneak) {
      if (placeCool <= 0) {
        placeCool = 0.18;
        if (toggleDoor(world, hit.x, hit.y, hit.z, player, life, KINDS)) {
          remeshDirty(world, bundle);
        }
      }
      eatAcc = 0;
    } else if (selFood && canEatFood(selFood)) {
      eatAcc += dt;
      const pct = eatAcc / selFood.eatTime;
      breakBar.hidden = false;
      breakBar.classList.add('eat');
      breakBar.querySelector('i').style.width = `${Math.min(100, pct * 100)}%`;
      if (eatAcc >= selFood.eatTime) {
        if (player.eat(selFood.hunger, selFood.heal || 0)) inv.takeSelected(1);
        eatAcc = 0;
        refreshHud();
        arms.punch();
      }
    } else if (placeCool <= 0 && hit) {
      placeCool = 0.18;
      placeBlock(hit);
      eatAcc = 0;
    } else if (offFood && canEatFood(offFood)) {
      eatAcc += dt;
      const pct = eatAcc / offFood.eatTime;
      breakBar.hidden = false;
      breakBar.classList.add('eat');
      breakBar.querySelector('i').style.width = `${Math.min(100, pct * 100)}%`;
      if (eatAcc >= offFood.eatTime) {
        if (player.eat(offFood.hunger, offFood.heal || 0)) inv.takeOffhand(1);
        eatAcc = 0;
        refreshHud();
        arms.punch();
      }
    }
  } else {
    eatAcc = 0;
    if (!mining) {
      breakBar.classList.remove('eat');
    }
  }

  const rugId = world.get(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.05), Math.floor(player.pos.z));
  const onRug = isRug(rugId);
  const still = player.onGround && !walking && Math.hypot(player.vel.x, player.vel.z) < 0.35;
  const canSleep = hour >= 16 || hour < 6;
  if (onRug && still && canSleep && player.hurtAcc <= 0) {
    sleepAcc += dt;
    if (sleepAcc >= 3) {
      doSleep();
      sleepAcc = 0;
    }
  } else {
    sleepAcc = 0;
  }

  if (preferEnt) {
    const def = KINDS[entHit.e.kind];
    blockLabel.textContent = `${t(def.nameKey)}  ${Math.max(0, Math.ceil(entHit.e.hp))}/${def.hp}`;
  } else {
    blockLabel.textContent = hit ? t(nameKey(hit.id)) : '';
  }
  const biome = t(biomeNameKey(world.biomeAt(player.pos.x, player.pos.z)));
  coordsEl.textContent = `${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)} · ${biome}`;
  refreshHearts();
  refreshFoods();
}

function breakBlock(hit) {
  const id = world.get(hit.x, hit.y, hit.z);
  if (!id || id === BEDROCK || id === AIR) return;
  if (isDoorId(id)) {
    const drop = removeDoor(world, hit.x, hit.y, hit.z);
    if (drop) inv.add(drop, 1);
    if (ITEMS[inv.selectedStack()?.id]?.tool) inv.wearSelected();
    remeshDirty(world, bundle);
    refreshHud();
    arms.punch();
    return;
  }
  const drops = BLOCKS[id]?.drops || [];
  for (const d of drops) inv.add(d.id, d.n);
  if (id === FURNACE) {
    const key = furnaceKey(hit.x, hit.y, hit.z);
    for (const s of dropFurnaceStacks(world.furnaces[key])) inv.add(s.id, s.n, s.dura);
  }
  if (ITEMS[inv.selectedStack()?.id]?.tool) inv.wearSelected();
  if (isFlower(id) && life) life.clearFlowerHome(hit.x, hit.y, hit.z);
  world.set(hit.x, hit.y, hit.z, AIR);
  remeshDirty(world, bundle);
  refreshHud();
  arms.punch();
}

function placeBlock(hit) {
  let fromOff = false;
  let stack = inv.selectedStack();
  if (!stack || !isPlaceable(stack.id)) {
    stack = inv.offhand;
    fromOff = true;
  }
  if (!stack || !isPlaceable(stack.id)) return;
  const px = hit.x + hit.nx;
  const py = hit.y + hit.ny;
  const pz = hit.z + hit.nz;
  if (!world.inBounds(px, py, pz)) return;
  const dest = world.get(px, py, pz);
  if (dest && dest !== AIR) return;
  if (player.overlapsBlock(px, py, pz) && isSolid(stack.id)) return;
  if (stack.id === TORCH && !isSolid(world.get(hit.x, hit.y, hit.z))) return;
  if ((isFlower(stack.id) || isRug(stack.id)) && !isSolid(world.get(px, py - 1, pz))) return;
  if (stack.id === DOOR || stack.id === DOOR_DOUBLE) {
    if (!placeDoor(world, px, py, pz, player.yaw, stack.id === DOOR_DOUBLE, player)) return;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return;
  }
  if (stack.id === STAIRS) {
    if (player.overlapsBlock(px, py, pz)) return;
    if (!placeStairs(world, px, py, pz, player.yaw)) return;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return;
  }
  if (stack.id === LADDER) {
    if (!placeLadder(world, px, py, pz, hit.nx, hit.ny, hit.nz)) return;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return;
  }
  world.set(px, py, pz, stack.id);
  if (stack.id === TORCH) world.setTorchFacing(px, py, pz, torchFacingFromHit(hit.nx, hit.ny, hit.nz));
  if (stack.id === FURNACE) world.furnaces[furnaceKey(px, py, pz)] = emptyFurnace();
  if (isFlower(stack.id) && life) life.assignFlowerHome(px, py, pz);
  if (fromOff) inv.takeOffhand(1);
  else inv.takeSelected(1);
  remeshDirty(world, bundle);
  refreshHud();
}

function updateHighlight(hit, entHit) {
  if (entHit) {
    const def = KINDS[entHit.e.kind];
    highlight.visible = true;
    highlight.position.set(entHit.e.x, entHit.e.y + def.h * 0.5, entHit.e.z);
    highlight.scale.set(def.w + 0.08, def.h + 0.08, def.w + 0.08);
    return;
  }
  highlight.scale.set(1, 1, 1);
  if (!hit) {
    highlight.visible = false;
    return;
  }
  highlight.visible = true;
  highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
}

function doSleep() {
  const rx = Math.floor(player.pos.x);
  const rz = Math.floor(player.pos.z);
  player.spawn.set(rx + 0.5, player.pos.y, rz + 0.5);
  sleeping = true;
  sleepVeil.hidden = false;
  requestAnimationFrame(() => sleepVeil.classList.add('show'));
  window.setTimeout(() => {
    setWorldTime(TIME_PRESETS.dawn, true);
    sleepVeil.classList.remove('show');
    window.setTimeout(() => {
      sleepVeil.hidden = true;
      sleeping = false;
    }, 380);
  }, 420);
}

function hourFromWorldTime(wt) {
  const hours = (((wt % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE) / DAY_CYCLE * 24 + 6;
  return hours % 24;
}

function dayFactor() {
  const t = ((worldTime % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE;
  const a = (t / DAY_CYCLE) * Math.PI * 2;
  const hour = hourFromWorldTime(t);
  let day = 0;
  if (hour >= 7 && hour < 17) day = 1;
  else if (hour >= 6 && hour < 7) day = hour - 6;
  else if (hour >= 17 && hour < 19) day = 1 - (hour - 17) / 2;
  return { a, day, hour };
}

function clockFromWorldTime(wt) {
  const wrapped = hourFromWorldTime(wt);
  const h = Math.floor(wrapped);
  const m = Math.floor((wrapped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function setWorldTime(value, save = false) {
  worldTime = ((Number(value) % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE;
  syncTimeUi();
  if (save && player) persist();
}

function syncTimeUi() {
  const tval = ((worldTime % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE;
  timeSlider.value = String(Math.round(tval));
  timeClock.textContent = clockFromWorldTime(tval);
  document.querySelectorAll('[data-tod]').forEach((btn) => {
    const key = btn.getAttribute('data-tod');
    btn.classList.toggle('active', Math.abs(tval - TIME_PRESETS[key]) < 16);
  });
}

function closeMapSilent() {
  mapOverlay.hidden = true;
  mapView.dragging = false;
  mapCanvas.classList.remove('dragging');
}

function openMap(fromPause) {
  if (!world || !player || player.health <= 0 || !deathEl.hidden || !loadingEl.hidden) return;
  mapView.fromPause = !!fromPause;
  mapView.zoom = 4;
  mapView.cx = player.pos.x;
  mapView.cz = player.pos.z;
  mapOverlay.hidden = false;
  if (fromPause) hideMenu();
  document.exitPointerLock?.();
  requestAnimationFrame(() => {
    drawWorldMap();
    requestAnimationFrame(() => drawWorldMap());
  });
}

function closeMap({ toPause = false } = {}) {
  if (!mapOpen()) return;
  const fromMenu = mapView.fromPause;
  closeMapSilent();
  if (fromMenu) showMenu(menuPaused);
  else if (toPause) showMenu(true);
  else requestPlay();
}

function toggleMap() {
  if (mapOpen()) {
    closeMap();
    return;
  }
  if (!player || player.health <= 0) return;
  openMap(!menuEl.hidden);
}

function zoomMapCenter(factor) {
  const rect = mapCanvas.getBoundingClientRect();
  zoomMapAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

function zoomMapAt(clientX, clientY, factor) {
  const rect = mapCanvas.getBoundingClientRect();
  let mx = clientX - rect.left;
  let my = clientY - rect.top;
  if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) {
    mx = rect.width / 2;
    my = rect.height / 2;
  }
  const wx = mapView.cx + (mx - rect.width / 2) / mapView.zoom;
  const wz = mapView.cz + (my - rect.height / 2) / mapView.zoom;
  mapView.zoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, mapView.zoom * factor));
  mapView.cx = wx - (mx - rect.width / 2) / mapView.zoom;
  mapView.cz = wz - (my - rect.height / 2) / mapView.zoom;
  drawWorldMap();
}

function groundMapRgb(id, h) {
  if (!id) return null;
  if (id === LEAVES || id === LOG) return mapRgb(GRASS, Math.max(1, h - 5));
  if (id === CACTUS) return mapRgb(SAND, h);
  return mapRgb(id, h);
}

function drawWorldMap() {
  if (!mapOpen()) return;
  const rect = mapCanvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (mapCanvas.width !== w || mapCanvas.height !== h) {
    mapCanvas.width = w;
    mapCanvas.height = h;
  }
  const ctx = mapCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const bg = getTheme() === 'light' ? [197, 212, 208] : [8, 16, 18];
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg[0];
    data[i + 1] = bg[1];
    data[i + 2] = bg[2];
    data[i + 3] = 255;
  }

  if (!world || !world.map.size) {
    ctx.putImageData(img, 0, 0);
    mapMeta.textContent = `0 ${t('mapChunks')}`;
    return;
  }

  const zoom = mapView.zoom * dpr;
  const originX = mapView.cx - w / 2 / zoom;
  const originZ = mapView.cz - h / 2 / zoom;
  const minCx = Math.floor(originX) >> 4;
  const maxCx = Math.floor(originX + w / zoom) >> 4;
  const minCz = Math.floor(originZ) >> 4;
  const maxCz = Math.floor(originZ + h / zoom) >> 4;

  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const buf = world.map.get(world.chunkKey(cx, cz));
      if (!buf) continue;
      const x0 = cx * CHUNK;
      const z0 = cz * CHUNK;
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const i = (lz * CHUNK + lx) * 2;
          const rgb = groundMapRgb(buf[i], buf[i + 1]);
          if (!rgb) continue;
          const wx = x0 + lx;
          const wz = z0 + lz;
          const sx = Math.floor((wx - originX) * zoom);
          const sy = Math.floor((wz - originZ) * zoom);
          const ex = Math.max(sx + 1, Math.floor((wx + 1 - originX) * zoom));
          const ey = Math.max(sy + 1, Math.floor((wz + 1 - originZ) * zoom));
          const x1 = Math.max(0, sx);
          const y1 = Math.max(0, sy);
          const x2 = Math.min(w, ex);
          const y2 = Math.min(h, ey);
          const [r, g, b] = rgb;
          for (let py = y1; py < y2; py++) {
            let p = (py * w + x1) * 4;
            for (let px = x1; px < x2; px++) {
              data[p] = r;
              data[p + 1] = g;
              data[p + 2] = b;
              data[p + 3] = 255;
              p += 4;
            }
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  if (player) {
    const mx = (player.pos.x - originX) * zoom;
    const mz = (player.pos.z - originZ) * zoom;
    const mark = Math.max(1.2, dpr);
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(-player.yaw);
    ctx.scale(mark, mark);
    ctx.fillStyle = '#f4f7f6';
    ctx.strokeStyle = '#006056';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  mapMeta.textContent = `${world.map.size} ${t('mapChunks')}`;
}

function syncTorchLights() {
  const holding = inv?.selectedStack()?.id === TORCH || inv?.offhand?.id === TORCH;
  heldTorchLight.intensity = holding ? 1.4 : 0;
  if (!bundle || !player) return;
  setWorldLight(bundle, dayFactor().day, camera.position, holding);
}

function syncHurtVeil() {
  if (!hurtVeil) return;
  const flash = player && player.health > 0 ? Math.min(1, player.hurtAcc / 1.15) : 0;
  if (flash <= 0.02) {
    hurtVeil.hidden = true;
    hurtVeil.style.opacity = '0';
    return;
  }
  hurtVeil.hidden = false;
  hurtVeil.style.opacity = String(flash);
}

function render(dt = 0.016) {
  if (!player) return;
  const { a, day } = dayFactor();
  sun.position.set(Math.cos(a) * 90, Math.max(12, Math.sin(a) * 90 + 8), 30);
  sun.intensity = 0.2 + day * 1.35;
  hemi.intensity = 0.22 + day * 0.88;
  ambient.intensity = 0.16 + day * 0.48;
  const sky = new THREE.Color().lerpColors(new THREE.Color(0x070b18), new THREE.Color(0x9ecdf0), 0.12 + day * 0.88);
  if (player.hurtAcc > 0 && player.health > 0) {
    const k = Math.min(1, player.hurtAcc / 1.15) * 0.42;
    sky.lerp(new THREE.Color(0xb01010), k);
  }
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  syncHurtVeil();

  const wantFov = player.sprint ? 82 : 75;
  camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();

  player.applyLook(camera);
  syncTorchLights();
  const bg = scene.background;
  renderer.clear();
  camera.layers.set(0);
  renderer.render(scene, camera);
  scene.background = null;
  renderer.clearDepth();
  camera.layers.set(1);
  renderer.render(scene, camera);
  scene.background = bg;
  camera.layers.enable(0);
  camera.layers.enable(1);
}

function buildHearts() {
  heartsEl.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const h = document.createElement('div');
    h.className = 'heart';
    heartsEl.appendChild(h);
  }
}

function buildFoods() {
  foodsEl.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const h = document.createElement('div');
    h.className = 'food';
    foodsEl.appendChild(h);
  }
}

function refreshHearts() {
  const hp = player?.health ?? 20;
  heartsEl.querySelectorAll('.heart').forEach((el, i) => {
    const v = hp - i * 2;
    el.classList.toggle('on', v >= 2);
    el.classList.toggle('half', v === 1);
  });
}

function refreshFoods() {
  const hg = player?.hunger ?? 20;
  foodsEl.querySelectorAll('.food').forEach((el, i) => {
    const v = hg - i * 2;
    el.classList.toggle('on', v >= 2);
    el.classList.toggle('half', v >= 1 && v < 2);
  });
}

function buildHotbarHud() {
  hotbarEl.innerHTML = '';
  for (let i = 0; i < HOTBAR; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.dataset.index = String(i);
    hotbarEl.appendChild(b);
  }
}

function paintSlot(el, stack, selected) {
  el.classList.toggle('selected', !!selected);
  el.style.backgroundImage = stack ? `url(${itemIcon(stack.id, atlas)})` : 'none';
  el.innerHTML = '';
  if (stack) {
    const name = t(nameKey(stack.id));
    el.setAttribute('aria-label', name);
    el.dataset.itemId = String(stack.id);
  } else {
    if (el.id === 'offhand-slot' || el.id === 'inv-offhand') el.setAttribute('aria-label', t('offhand'));
    else el.removeAttribute('aria-label');
    el.dataset.itemId = '';
  }
  if (stack && stack.n > 1) {
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = String(stack.n);
    el.appendChild(c);
  }
  const maxD = ITEMS[stack?.id]?.dura;
  if (stack && maxD) {
    const bar = document.createElement('span');
    bar.className = 'dura';
    const i = document.createElement('i');
    i.style.width = `${Math.max(0, (stack.dura ?? maxD) / maxD * 100)}%`;
    bar.appendChild(i);
    el.appendChild(bar);
  }
}

function refreshHud() {
  hotbarEl.querySelectorAll('.slot').forEach((el, i) => {
    paintSlot(el, inv?.slots[i], inv && inv.selected === i);
  });
  paintSlot(offhandSlotEl, inv?.offhand, false);
  refreshHearts();
  refreshFoods();
}

function buildInvDom() {
  const fill = (node, count, list) => {
    node.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.dataset.list = list;
      b.dataset.index = String(i);
      node.appendChild(b);
    }
  };
  fill(document.getElementById('inv-grid'), 27, 'inv');
  fill(document.getElementById('inv-hotbar'), 9, 'hot');
  fill(document.getElementById('craft2-grid'), 4, 'c2');
  fill(document.getElementById('craft3-grid'), 9, 'c3');
  const out2 = document.getElementById('craft2-out');
  out2.dataset.list = 'out2';
  out2.dataset.index = '0';
  const out3 = document.getElementById('craft3-out');
  out3.dataset.list = 'out3';
  out3.dataset.index = '0';
}

function gridOf(listName) {
  if (listName === 'inv') return { arr: inv.slots, offset: 9 };
  if (listName === 'hot') return { arr: inv.slots, offset: 0 };
  if (listName === 'c2') return { arr: inv.craft2, offset: 0 };
  if (listName === 'c3') return { arr: inv.craft3, offset: 0 };
  return null;
}

function handleSlotClick(el, right) {
  const list = el.dataset.list;
  if (!list) return;
  const index = Number(el.dataset.index);
  if (list === 'off') {
    const arr = [inv.offhand];
    inv.cursor = clickSlot(arr, 0, inv.cursor, right);
    inv.offhand = arr[0];
    refreshInv();
    refreshHud();
    return;
  }
  if (list === 'out2' || list === 'out3') {
    takeCraft(list === 'out3' ? 3 : 2, right);
    refreshInv();
    return;
  }
  if (list === 'fin' || list === 'ffuel' || list === 'fout') {
    handleFurnaceClick(list, right);
    refreshInv();
    refreshHud();
    return;
  }
  const g = gridOf(list);
  const i = g.offset + index;
  inv.cursor = clickSlot(g.arr, i, inv.cursor, right);
  refreshInv();
}

function takeCraft(size, right) {
  const grid = size === 3 ? inv.craft3 : inv.craft2;
  const out = matchRecipe(grid, size);
  if (!out) return;
  const made = { id: out.id, n: out.n, dura: ITEMS[out.id]?.dura };
  if (inv.cursor && (inv.cursor.id !== made.id || ITEMS[made.id]?.tool)) return;
  if (inv.cursor && inv.cursor.n + made.n > stackMax(made.id)) return;
  if (right) return;
  consumeCraft(grid);
  if (!inv.cursor) inv.cursor = made;
  else inv.cursor.n += made.n;
}

function refreshInv() {
  const paintList = (node, arr, offset = 0, selectedOffset = -1) => {
    node.querySelectorAll('.slot').forEach((el, i) => {
      paintSlot(el, arr[offset + i], selectedOffset === offset + i);
    });
  };
  paintList(document.getElementById('inv-grid'), inv.slots, 9);
  paintList(document.getElementById('inv-hotbar'), inv.slots, 0, inv.selected);
  paintSlot(document.getElementById('inv-offhand'), inv.offhand, false);
  paintList(document.getElementById('craft2-grid'), inv.craft2);
  paintList(document.getElementById('craft3-grid'), inv.craft3);
  const r2 = matchRecipe(inv.craft2, 2);
  const r3 = matchRecipe(inv.craft3, 3);
  paintSlot(document.getElementById('craft2-out'), r2 ? { id: r2.id, n: r2.n } : null, false);
  paintSlot(document.getElementById('craft3-out'), r3 ? { id: r3.id, n: r3.n } : null, false);
  if (furnacePos) {
    const f = currentFurnace();
    paintSlot(document.getElementById('furnace-in'), f.input, false);
    paintSlot(document.getElementById('furnace-fuel'), f.fuel, false);
    paintSlot(document.getElementById('furnace-out'), f.out, false);
    paintFurnaceBars(f);
  }
  if (inv.cursor) {
    cursorEl.hidden = false;
    cursorEl.style.backgroundImage = `url(${itemIcon(inv.cursor.id, atlas)})`;
  } else {
    cursorEl.hidden = true;
  }
}

function setRecipesOpen(open) {
  recipeBook.hidden = !open;
  syncRecipesBtn();
  if (open) renderRecipeBook();
}

function syncRecipesBtn() {
  recipesBtn.textContent = recipeBook.hidden ? t('recipes') : t('hideRecipes');
}

function guideCell(id) {
  const cell = document.createElement('div');
  cell.className = 'guide-cell';
  if (id === MAT) {
    const mark = document.createElement('span');
    mark.className = 'mat-mark';
    mark.textContent = 'M';
    cell.appendChild(mark);
  } else if (id) {
    cell.style.backgroundImage = `url(${itemIcon(id, atlas)})`;
    cell.title = t(nameKey(id));
    cell.dataset.itemId = String(id);
  }
  return cell;
}

function padPattern(pattern, size) {
  const rows = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      rows[y][x] = pattern[y][x] || 0;
    }
  }
  return rows;
}

function renderRecipeBook() {
  const list = document.getElementById('recipe-list');
  list.innerHTML = '';
  const recs = tableMode
    ? [...RECIPE_GUIDE.filter((r) => r.table), ...RECIPE_GUIDE.filter((r) => !r.table)]
    : RECIPE_GUIDE;
  for (const rec of recs) {
    const card = document.createElement('article');
    card.className = 'recipe-card';
    const title = document.createElement('h3');
    title.textContent = rec.titleKey ? t(rec.titleKey) : t(nameKey(rec.out.id));
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'recipe-meta';
    const badge = document.createElement('span');
    badge.textContent = rec.table ? t('recipeNeedsTable') : t('recipeInventoryGrid');
    meta.appendChild(badge);
    if (rec.shapeless) {
      const s = document.createElement('span');
      s.textContent = t('recipeShapeless');
      meta.appendChild(s);
    }
    if (rec.mirror) {
      const s = document.createElement('span');
      s.textContent = t('recipeMirror');
      meta.appendChild(s);
    }
    card.appendChild(meta);

    const body = document.createElement('div');
    body.className = 'recipe-body';

    const grid = document.createElement('div');
    grid.className = `guide-grid size-${rec.size}`;
    if (rec.shapeless) {
      const cells = rec.shapeless.slice();
      while (cells.length < rec.size * rec.size) cells.push(0);
      for (const id of cells) grid.appendChild(guideCell(id));
    } else {
      for (const row of padPattern(rec.pattern, rec.size)) {
        for (const id of row) grid.appendChild(guideCell(id));
      }
    }
    body.appendChild(grid);

    const arrow = document.createElement('span');
    arrow.className = 'craft-arrow';
    arrow.textContent = '→';
    body.appendChild(arrow);

    const results = document.createElement('div');
    results.className = 'recipe-results';
    if (rec.out) {
      const item = document.createElement('div');
      item.className = 'recipe-result';
      item.appendChild(guideCell(rec.out.id));
      const label = document.createElement('span');
      label.textContent = `${t(nameKey(rec.out.id))} ×${rec.out.n}`;
      item.appendChild(label);
      results.appendChild(item);
    } else {
      for (const variant of rec.results) {
        const item = document.createElement('div');
        item.className = 'recipe-result';
        item.appendChild(guideCell(variant.mat));
        const plus = document.createElement('span');
        plus.className = 'recipe-count';
        plus.textContent = '→';
        item.appendChild(plus);
        item.appendChild(guideCell(variant.out));
        const label = document.createElement('span');
        label.textContent = t(nameKey(variant.out));
        item.appendChild(label);
        results.appendChild(item);
      }
    }
    body.appendChild(results);
    card.appendChild(body);

    if (rec.results) {
      const note = document.createElement('p');
      note.className = 'recipe-intro';
      note.style.margin = '8px 0 0';
      note.textContent = t('recipeMaterial');
      card.appendChild(note);
    }

    list.appendChild(card);
  }
}

window.__VC = {
  get world() { return world; },
  get player() { return player; },
  get bundle() { return bundle; },
  remesh() { remeshDirty(world, bundle); },
};

try {
  await boot();
} catch (err) {
  loadingEl.hidden = true;
  console.error(err);
  coordsEl.textContent = String(err && err.message ? err.message : err);
  showMenu(false);
}
