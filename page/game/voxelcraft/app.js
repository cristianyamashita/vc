import * as THREE from 'three';
import { initLang, setLang, t, applyI18n } from './js/i18n.js';
import { initTheme, toggleTheme, getTheme } from './js/theme.js';
import {
  AIR, GRASS, SAND, LOG, LEAVES, TABLE, TORCH, BEDROCK, CACTUS, FURNACE, DOOR, DOOR_DOUBLE, LADDER, ITEMS, BLOCKS,
  SURPRISE_BOX, BOW, GOLD, COMPASS,
  isPlaceable, isSolid, isFlower, isRug, isStair, isWall, isLiquid, isReplaceable, mineSeconds, nameKey, stackMax,
  foodInfo, attackDamage, canHarvest, ammoOf, consumeAmmo, crateLoot, hasLasso, isUnbreakable,
} from './js/blocks.js';
import { World, GEN_PER_TICK, biomeNameKey, CHUNK, mapRgb, torchFacingFromHit } from './js/world.js';
import { createAtlas, itemIcon } from './js/textures.js';
import { createWorldMeshes, remeshDirty, disposeMeshes, syncChunkMeshes, setWorldLight } from './js/mesher.js';
import { Player, raycast } from './js/player.js';
import { Arms } from './js/arms.js';
import { Inventory, HOTBAR, clickSlot } from './js/inventory.js';
import { matchRecipe, consumeCraft } from './js/crafting.js';
import { RECIPE_GUIDE, MAT } from './js/recipes.js';
import { SHOP_SECTIONS, buyShopItem, ownedRanged, ammoRestock } from './js/shop.js';
import {
  loadWorldSave, saveWorldSave, deleteWorldSave, saveSettings,
  loadWorldIndex, saveWorldIndex, migrateLegacyWorld, newWorldId,
} from './js/save.js';
import { Life, KINDS } from './js/entities.js';
import { ItemDrops } from './js/drops.js';
import { initQuality, getQuality, setQuality } from './js/quality.js';
import * as sfx from './js/sfx.js';
import { initItemModels } from './js/itemmodels.js';
import { renderItemIcons } from './js/itemicons.js';
import { clearVoxCache } from './js/voxmodel.js';
import {
  emptyFurnace, furnaceKey, tickFurnace, dropFurnaceStacks,
  serializeFurnaces, loadFurnaces, COOK_SEC,
} from './js/furnace.js';
import { isDoorId, isDoorOpenId, placeDoor, toggleDoor, removeDoor, serializeDoors, loadDoors } from './js/doors.js';
import { placeStairs, placeLadder, serializeBlockDir } from './js/stairs.js';
import { placeWall } from './js/walls.js';
import { tickLeafDecay, serializeLeafDecay, loadLeafDecay } from './js/leaves.js';
import { tickWater, serializeWaterMeta, loadWaterMeta, serializeWaterWait, loadWaterWait } from './js/water.js';
import { tickSprings, serializeSprings, loadSprings } from './js/spring.js';
import { inCastleArea, isCastleChest, castleRespawn, getCastle, castleNeedleDeg } from './js/castle.js';

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
const shopBook = document.getElementById('shop-book');
const shopBtn = document.getElementById('shop-btn');
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
const freezeTimeEl = document.getElementById('freeze-time');
const soundToggleEl = document.getElementById('sound-toggle');
const mapOverlay = document.getElementById('map-overlay');
const mapCanvas = document.getElementById('world-map');
const mapMeta = document.getElementById('map-meta');
const compassEl = document.getElementById('compass');
const compassNeedleEl = document.getElementById('compass-needle');
const crateLootEl = document.getElementById('crate-loot');
const crateLootIcon = document.getElementById('crate-loot-icon');
const crateLootName = document.getElementById('crate-loot-name');
const crateLootAmmo = document.getElementById('crate-loot-ammo');
const crateLootOk = document.getElementById('crate-loot-ok');
let lastCrateLoot = null;
let castleDeath = false;

const DAY_CYCLE = 480;
const TIME_PRESETS = { dawn: 40, noon: 120, dusk: 200, night: 360 };
const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 24;
const mapView = { zoom: 4, cx: 0, cz: 0, dragging: false, lastX: 0, lastY: 0, fromPause: false };
const mapTeleportBtn = document.getElementById('map-teleport');
let mapMark = null;

const keys = Object.create(null);
const mouse = { left: false, right: false };
let world;
let bundle;
let player;
let inv;
let arms;
let atlas;
let life;
let drops;
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
let freezeTime = false;
let saving = false;
let currentWorldId = null;
let worldBusy = false;
let last = performance.now();
// Bookkeeping for the sound effects: footsteps are paced by distance walked and
// the one-shot cues (jump, landing, hurt, splash) fire on state changes.
let stepAcc = 0;
let swimAcc = 0;
let ladderAcc = 0;
let wasOnGround = true;
let wasInWater = false;
let wasOnLadder = false;
let fallPeak = 0;
let lastHealth = 20;
let mobCallCool = 5;
let furnaceOut = 0;
const tracers = [];
const flyArrows = [];
const crosshairEl = document.getElementById('crosshair');

initLang();
initTheme();
initQuality();
sfx.initSfx();
syncThemeBtn();
syncSoundUi();

const atlasData = createAtlas();
atlas = atlasData;
initItemModels(atlas);
renderItemIcons(atlas);

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

arms = new Arms(camera, atlas);
buildHearts();
buildFoods();
buildHotbarHud();
buildInvDom();
syncGfxUi();

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
    renderShop();
    syncShopBtn();
    if (player) playBtn.textContent = menuPaused ? t('resume') : t('clickToPlay');
    syncTimeUi();
    refreshWorldList();
    fillCrateLootModal();
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
soundToggleEl.addEventListener('pointerdown', (e) => e.stopPropagation());
soundToggleEl.addEventListener('change', () => {
  sfx.setSoundOn(soundToggleEl.checked);
  if (soundToggleEl.checked) sfx.click();
});

// Every button in the game clicks. This also doubles as the user gesture that
// lets the browser start the audio context.
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest?.('button')) sfx.click();
}, true);

freezeTimeEl.addEventListener('pointerdown', (e) => e.stopPropagation());
freezeTimeEl.addEventListener('change', () => {
  freezeTime = !!freezeTimeEl.checked;
  if (player) persist();
});
document.querySelectorAll('[data-tod]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const key = btn.getAttribute('data-tod');
    if (TIME_PRESETS[key] == null) return;
    setWorldTime(TIME_PRESETS[key], true);
  });
});
document.querySelectorAll('[data-gfx]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyQuality(btn.getAttribute('data-gfx'));
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
  else if (act === 'duplicate') duplicateWorld(id);
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
mapTeleportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  teleportToMapMark();
});
mapCanvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2) {
    e.preventDefault();
    const pos = mapClientToWorld(e.clientX, e.clientY);
    mapMark = { x: pos.x, z: pos.z };
    syncMapMarkUi();
    drawWorldMap();
    return;
  }
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
mapCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const pos = mapClientToWorld(e.clientX, e.clientY);
  mapMark = { x: pos.x, z: pos.z };
  syncMapMarkUi();
  drawWorldMap();
});
respawnBtn.addEventListener('click', () => {
  if (castleDeath && world) {
    const outside = castleRespawn(world);
    castleDeath = false;
    player.health = player.maxHealth;
    player.hunger = player.maxHunger;
    player.starveAcc = 0;
    player.vel.set(0, 0, 0);
    player.fallY = null;
    if (outside) player.pos.set(outside.x, outside.y, outside.z);
    else player.respawn();
    player.fallY = player.pos.y;
  } else {
    player.respawn();
  }
  deathEl.hidden = true;
  lastHealth = player.health;
  wasOnGround = true;
  fallPeak = 0;
  sfx.respawn();
  requestPlay();
});
document.getElementById('inv-close').addEventListener('click', () => closeInv());
crateLootOk?.addEventListener('click', (e) => {
  e.stopPropagation();
  closeCrateLoot();
});
recipesBtn.addEventListener('click', () => setRecipesOpen(recipeBook.hidden));
document.getElementById('recipes-hide').addEventListener('click', () => setRecipesOpen(false));
shopBtn.addEventListener('click', () => setShopOpen(shopBook.hidden));
document.getElementById('shop-hide').addEventListener('click', () => setShopOpen(false));
document.getElementById('shop-list').addEventListener('click', (e) => {
  const row = e.target.closest('.shop-row');
  if (!row || row.disabled) return;
  buyFromShopRow(row);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
  if (!document.pointerLockElement && !invOpen() && deathEl.hidden && !mapOpen() && !crateLootOpen()) requestPlay();
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
let awaitingLock = false;

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) {
    awaitingLock = false;
    return;
  }
  if (awaitingLock) {
    awaitingLock = false;
    return;
  }
  if (!invOpen() && player?.health > 0 && menuEl.hidden && !mapOpen() && !crateLootOpen() && deathEl.hidden) {
    showMenu(true);
    ignoreEscUntil = performance.now() + 250;
  }
});
document.addEventListener('pointerlockerror', () => {
  awaitingLock = false;
});

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'ControlLeft' && isPlaying()) e.preventDefault();
  if (e.code === 'Escape') {
    if (e.repeat || performance.now() < ignoreEscUntil) return;
    if (crateLootOpen()) {
      closeCrateLoot();
      return;
    }
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
  if (crateLootOpen() && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    closeCrateLoot();
    return;
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    if (!loadingEl.hidden || invOpen() || crateLootOpen() || !deathEl.hidden) return;
    toggleMap();
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyE') {
    e.preventDefault();
    if (mapOpen() || crateLootOpen()) return;
    if (invOpen()) closeInv();
    else if (player && menuEl.hidden && player.health > 0) openInv(false);
  }
  if (e.code === 'KeyQ' && isPlaying()) {
    e.preventDefault();
    const thrown = inv.dropOne();
    if (thrown) sfx.dropItem();
    if (thrown && drops) {
      const drop = drops.throwFrom(player, player.yaw, player.pitch, thrown);
      if (life && foodInfo(thrown)) life.assignFoodHome(drop);
    }
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

function syncSoundUi() {
  soundToggleEl.checked = sfx.isSoundOn();
}

// Entering a world starts the sound bookkeeping from the player's real state,
// so loading a wounded save does not sound a hurt cue on the first frame.
function resetSfxState() {
  stepAcc = 0;
  swimAcc = 0;
  ladderAcc = 0;
  fallPeak = 0;
  mobCallCool = 5;
  furnaceOut = 0;
  wasOnGround = true;
  wasInWater = !!player?.inWater;
  wasOnLadder = false;
  lastHealth = player?.health ?? 20;
}

function persistUi() {
  saveSettings({ lang: document.documentElement.lang, theme: getTheme(), quality: getQuality() })
    .catch(() => {});
}

function syncGfxUi() {
  const level = getQuality();
  document.querySelectorAll('[data-gfx]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-gfx') === level);
  });
}

// Models are baked per quality level, so switching means dropping the cached
// geometry and re-mounting everything currently on screen.
function applyQuality(next) {
  if (next === getQuality()) return;
  setQuality(next);
  clearVoxCache();
  renderItemIcons(atlas);
  life?.rebuildModels();
  arms?.rebuild();
  drops?.rebuildMeshes();
  if (world && bundle) {
    // Torches are built differently per setting, so the chunks must remesh.
    for (const key of bundle.meshes.keys()) world.dirty.add(key);
    remeshDirty(world, bundle);
  }
  refreshHud();
  refreshInv();
  renderRecipeBook();
  fillCrateLootModal();
  renderShop();
  syncGfxUi();
  persistUi();
}

let menuPaused = false;

function showMenu(paused) {
  closeMapSilent();
  menuPaused = !!paused;
  menuEl.hidden = false;
  playBtn.textContent = paused ? t('resume') : t('clickToPlay');
  syncTimeUi();
  syncGfxUi();
  syncSoundUi();
  refreshWorldList();
}

function hideMenu() {
  menuEl.hidden = true;
}

function crateLootOpen() {
  return crateLootEl && !crateLootEl.hidden;
}

function fillCrateLootModal() {
  if (!lastCrateLoot || !crateLootEl) return;
  const name = t(nameKey(lastCrateLoot.id));
  crateLootName.textContent = name;
  crateLootIcon.style.backgroundImage = atlas ? `url(${itemIcon(lastCrateLoot.id, atlas)})` : 'none';
  const ranged = !!ITEMS[lastCrateLoot.id]?.ranged;
  if (lastCrateLoot.alreadyHad && ranged && lastCrateLoot.ammoAdded > 0) {
    crateLootAmmo.hidden = false;
    crateLootAmmo.textContent = t('crateAmmoAdded')
      .replace('{n}', String(lastCrateLoot.ammoAdded))
      .replace('{total}', String(lastCrateLoot.ammoTotal));
  } else if (lastCrateLoot.alreadyHad) {
    crateLootAmmo.hidden = false;
    crateLootAmmo.textContent = t('crateAlreadyHave');
  } else if (ranged) {
    const ammo = lastCrateLoot.ammo ?? lastCrateLoot.ammoAdded ?? ammoOf(lastCrateLoot);
    crateLootAmmo.hidden = false;
    crateLootAmmo.textContent = t('crateAmmo').replace('{n}', String(ammo));
  } else if (lastCrateLoot.goldHoard) {
    crateLootAmmo.hidden = false;
    crateLootAmmo.textContent = t('crateGold').replace('{n}', String(lastCrateLoot.n || 100));
  } else {
    crateLootAmmo.hidden = true;
    crateLootAmmo.textContent = '';
  }
}

function openCrateLoot(loot) {
  if (!loot || !crateLootEl) return;
  lastCrateLoot = loot;
  mouse.left = false;
  mouse.right = false;
  document.exitPointerLock();
  fillCrateLootModal();
  crateLootEl.hidden = false;
  sfx.reward();
}

function closeCrateLoot() {
  if (!crateLootOpen()) return;
  crateLootEl.hidden = true;
  lastCrateLoot = null;
  mouse.left = false;
  mouse.right = false;
  keys.Space = false;
  keys.Enter = false;
  if (player?.health > 0 && menuEl.hidden) canvas.requestPointerLock();
}

function invOpen() {
  return !invEl.hidden;
}

function mapOpen() {
  return !mapOverlay.hidden;
}

function isPlaying() {
  return !!player && player.health > 0 && !invOpen() && menuEl.hidden && deathEl.hidden && !mapOpen() && !crateLootOpen();
}

function requestPlay() {
  if (!player) return;
  if (player.health <= 0) {
    hideMenu();
    deathEl.hidden = false;
    return;
  }
  awaitingLock = true;
  sfx.resumeAudio();
  try {
    const ret = canvas.requestPointerLock?.();
    if (ret && typeof ret.catch === 'function') ret.catch(() => { awaitingLock = false; });
  } catch {
    awaitingLock = false;
  }
  closeMapSilent();
  hideMenu();
  deathEl.hidden = true;
  resize();
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
  sfx.panel(true);
  refreshInv();
  setRecipesOpen(true);
  setShopOpen(false);
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
  furnaceOut = currentFurnace().out?.n || 0;
  refreshInv();
  setRecipesOpen(false);
  setShopOpen(false);
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
  sfx.panel(false);
  setShopOpen(false);
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
  const out = f.out?.n || 0;
  if (out > furnaceOut) sfx.sizzle();
  furnaceOut = out;
  paintSlot(document.getElementById('furnace-in'), f.input, false);
  paintSlot(document.getElementById('furnace-fuel'), f.fuel, false);
  paintSlot(document.getElementById('furnace-out'), f.out, false);
  paintFurnaceBars(f);
}

function tickDecay(dt) {
  if (!world || !bundle) return;
  let dirty = false;
  if (tickLeafDecay(world, dt)) dirty = true;
  if (tickWater(world, dt)) dirty = true;
  if (tickSprings(world, dt)) dirty = true;
  if (dirty) remeshDirty(world, bundle);
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
  const name = id ? t(nameKey(id)) : (slot.getAttribute('aria-label') || slot.title || '');
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
  if (drops) {
    drops.dispose();
    drops = null;
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
  resetSfxState();
  inv = new Inventory();
  worldTime = 120;
  freezeTime = false;
  if (freezeTimeEl) freezeTimeEl.checked = false;
  mine = null;
  furnacePos = null;
  furnaceRow.hidden = true;
  sleepAcc = 0;
  sleeping = false;
  eatAcc = 0;
  mapMark = null;
  syncMapMarkUi();
  life = new Life(scene);
  life.populate(world, player, false);
  drops = new ItemDrops(scene, atlas);
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
    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.setAttribute('data-act', 'duplicate');
    dupBtn.textContent = t('duplicateWorld');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.setAttribute('data-act', 'delete');
    delBtn.textContent = t('deleteWorld');
    actions.append(loadBtn, renameBtn, dupBtn, delBtn);
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
  if (player && player.health <= 0) {
    deathEl.hidden = false;
    menuEl.hidden = true;
  } else {
    showMenu(false);
  }
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

function uniqueCopyName(name, list) {
  const base = name || t('worldNamePrefix');
  const suffix = t('worldCopySuffix');
  const taken = new Set(list.map((w) => w.name));
  let candidate = `${base}${suffix}`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${suffix} ${n}`;
    n += 1;
  }
  return candidate;
}

async function duplicateWorld(id) {
  if (worldBusy || !id) return;
  const index = await loadWorldIndex();
  const entry = index.list.find((w) => w.id === id);
  if (!entry) return;
  const suggested = uniqueCopyName(entry.name, index.list);
  const entered = window.prompt(t('worldNamePrompt'), suggested);
  if (entered == null) return;
  const name = entered.trim() || suggested;
  worldBusy = true;
  try {
    if (id === currentWorldId && player && world) await persist();
    const save = await loadWorldSave(id);
    if (!save?.seed) return;
    const copyId = newWorldId();
    await saveWorldSave(copyId, structuredClone(save));
    const next = await loadWorldIndex();
    next.list.push({
      id: copyId,
      name,
      created: Date.now(),
      updated: Date.now(),
    });
    await saveWorldIndex(next);
    await refreshWorldList();
  } finally {
    worldBusy = false;
  }
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
  if (drops) {
    drops.dispose();
    drops = null;
  }
  world = new World(save.seed);
  world.applyEdits(save.edits || {});
  world.loadTorchDir(save.torchDir);
  world.furnaces = loadFurnaces(save.furnaces);
  world.doors = loadDoors(save.doors);
  world.leafDecay = loadLeafDecay(save.leafDecay);
  world.loadBlockDir(save.blockDir);
  world.waterMeta = loadWaterMeta(save.waterMeta);
  world.waterWait = loadWaterWait(save.waterWait);
  loadSprings(world, save.springs, save.edits);
  world.castleGuardsSpawned = !!(save.castleGuards || save.entities?.some((e) => e.castle));
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
  freezeTime = !!save.freezeTime;
  life = new Life(scene);
  if (save.entities?.length) life.load(save.entities, world);
  else life.populate(world, player, false);
  drops = new ItemDrops(scene, atlas);
  if (save.drops?.length) drops.load(save.drops);
  mapMark = save.mapMark && Number.isFinite(save.mapMark.x) && Number.isFinite(save.mapMark.z)
    ? { x: save.mapMark.x, z: save.mapMark.z }
    : null;
  syncMapMarkUi();
  resetSfxState();
  refreshHud();
  syncTimeUi();
}

function snapshot() {
  return {
    seed: world.seed,
    edits: world.edits,
    worldTime,
    freezeTime,
    map: world.encodeMap(),
    torchDir: world.torchDir,
    furnaces: serializeFurnaces(world.furnaces),
    doors: serializeDoors(world.doors),
    leafDecay: serializeLeafDecay(world.leafDecay),
    blockDir: serializeBlockDir(world.blockDir),
    waterMeta: serializeWaterMeta(world.waterMeta),
    waterWait: serializeWaterWait(world.waterWait),
    springs: serializeSprings(world.springs),
    player: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch, health: player.health,
      hunger: player.hunger,
      sx: player.spawn.x, sy: player.spawn.y, sz: player.spawn.z,
    },
    inventory: inv.serialize(),
    entities: life ? life.serialize() : [],
    drops: drops ? drops.serialize() : [],
    mapMark: mapMark ? { x: mapMark.x, z: mapMark.z } : null,
    castleGuards: !!world.castleGuardsSpawned,
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

// The block the player is standing on, which decides how a footstep or a
// landing sounds.
function groundBlockId() {
  const bx = Math.floor(player.pos.x);
  const bz = Math.floor(player.pos.z);
  const below = world.get(bx, Math.floor(player.pos.y - 0.2), bz);
  if (below) return below;
  return world.get(bx, Math.floor(player.pos.y - 0.9), bz);
}

// Footsteps, jumps, landings, swimming and getting hurt, all driven off the
// player state that player.update() just produced.
function movementSfx(dt) {
  const speed = Math.hypot(player.vel.x, player.vel.z);
  const ground = groundBlockId();

  if (player.inWater !== wasInWater) {
    sfx.splash(player.inWater);
    swimAcc = 0;
  } else if (player.inWater) {
    swimAcc += speed * dt;
    if (swimAcc > 1.4) {
      swimAcc = 0;
      sfx.swim();
    }
  }

  if (player.onLadder && !player.inWater) {
    ladderAcc += Math.abs(player.vel.y) * dt;
    if (ladderAcc > 0.9) {
      ladderAcc = 0;
      sfx.ladderStep();
    }
  } else if (!player.onLadder) {
    ladderAcc = 0;
  }

  if (player.onGround) {
    if (!wasOnGround) {
      // fallPeak is the fastest the player was falling before touching down.
      sfx.land(ground, fallPeak < -13);
      stepAcc = 0;
    } else if (!player.inWater && speed > 0.6) {
      stepAcc += speed * dt;
      const stride = player.sneak ? 1.35 : player.sprint ? 2.35 : 1.85;
      if (stepAcc >= stride) {
        stepAcc = 0;
        sfx.step(ground, { sneak: player.sneak, sprint: player.sprint });
      }
    }
    fallPeak = 0;
  } else {
    if (wasOnGround && player.vel.y > 0.5 && !player.inWater && !player.onLadder) sfx.jump();
    fallPeak = Math.min(fallPeak, player.vel.y);
  }

  if (player.health < lastHealth && player.health > 0) sfx.hurt();
  lastHealth = player.health;
  wasOnGround = player.onGround;
  wasInWater = player.inWater;
  wasOnLadder = player.onLadder;
}

// Animals and villagers call out now and then when they are close enough to
// hear.
function ambientMobSfx(dt) {
  if (!life?.list?.length) return;
  mobCallCool -= dt;
  if (mobCallCool > 0) return;
  mobCallCool = 3.5 + Math.random() * 6;
  const near = life.list.filter((e) => !e.dying
    && Math.hypot(e.x - player.pos.x, e.z - player.pos.z) < 22);
  if (!near.length) return;
  const e = near[Math.floor(Math.random() * near.length)];
  sfx.mobIdle(e.kind, distTo(e));
}

function distTo(e) {
  return Math.hypot(e.x - player.pos.x, e.y - player.pos.y, e.z - player.pos.z);
}

// One call for a blow that landed: a cry if the mob survived, a death sound if
// it did not.
function mobHitSfx(e) {
  if (!e) return;
  const d = distTo(e);
  if (e.hp <= 0) sfx.mobDie(e.kind, d);
  else sfx.mobHurt(e.kind, d);
}

function tick(dt) {
  if (!freezeTime) worldTime += dt;
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
  movementSfx(dt);
  ambientMobSfx(dt);

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
      holdingFood: life.holdingFood(inv),
      drops,
      hitPlayer: false,
      deaths: [],
      guardShot(from, to) {
        spawnTracer(
          new THREE.Vector3(from.x, from.y, from.z),
          new THREE.Vector3(to.x, to.y, to.z),
          0xff6a3a,
        );
        sfx.shoot('gun', Math.hypot(from.x - player.pos.x, from.y - player.pos.y, from.z - player.pos.z));
        player.hurt(7);
      },
    };
    life.update(dt, world, player, lifeCtx);
    if (life.getLassoed() && !hasLasso(inv)) life.clearLasso();
    if (lifeCtx.deaths.length) {
      for (const d of lifeCtx.deaths) giveEntityLoot(d.loot, d);
      refreshHud();
    }
    if (lifeCtx.hitPlayer) {
      player.pitch = Math.max(player.pitch - 0.06, -Math.PI / 2 + 0.04);
      player.yaw += (Math.random() - 0.5) * 0.1;
    }
  }
  if (drops) {
    const before = drops.list.length;
    drops.update(dt, world, player, inv);
    if (drops.list.length !== before) {
      if (drops.list.length < before) sfx.pickup();
      refreshHud();
    }
  }

  if (player.health <= 0) {
    sfx.die();
    if (life) life.clearLasso();
    castleDeath = inCastleArea(world, player.pos.x, player.pos.z);
    document.exitPointerLock();
    deathEl.hidden = false;
    persist();
    return;
  }

  const origin = player.eyePosition();
  player.applyLook(camera);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const held = inv.selectedStack();
  const heldDef = held ? ITEMS[held.id] : null;
  const usingLasso = !!heldDef?.lasso;
  const usingRanged = !!heldDef?.ranged;
  const aimRange = usingRanged ? (heldDef.range || 48) : usingLasso ? (heldDef.range || 10) : 5.5;
  const hit = raycast(world, origin, dir);
  const placeHit = raycast(world, origin, dir, 5.5, true);
  const longHit = (usingRanged || usingLasso) ? raycast(world, origin, dir, aimRange) : hit;
  const entHit = life ? life.raycast(origin, dir, aimRange) : null;
  const preferEnt = entHit && (!longHit || entHit.dist <= longHit.dist);
  updateHighlight(hit, preferEnt ? entHit : null);
  if (crosshairEl) crosshairEl.classList.toggle('aim', !!(preferEnt && (usingLasso || usingRanged)));
  tickTracers(dt);
  tickArrows(dt);

  const walking = input.forward || input.back || input.left || input.right;
  attackCool = Math.max(0, attackCool - dt);
  const mining = mouse.left && !preferEnt && !usingRanged && !usingLasso && hit && BLOCKS[hit.id] && !isUnbreakable(hit.id);
  arms.setHeld(held?.id || 0);
  arms.setOffhand(inv.offhand?.id || 0);
  arms.update(dt, walking && player.onGround, mining || (mouse.left && (preferEnt || usingRanged || usingLasso)));

  if (mouse.left && usingLasso) {
    mine = null;
    breakBar.hidden = true;
    if (attackCool <= 0 && preferEnt) {
      life.setLassoed(entHit.e);
      sfx.lasso();
      arms.punch();
      attackCool = 0.35;
      refreshHud();
    }
  } else if (mouse.left && usingRanged) {
    mine = null;
    breakBar.hidden = true;
    if (attackCool <= 0) {
      if (ammoOf(held) > 0) {
        consumeAmmo(held);
        sfx.shoot(held.id === BOW ? 'bow' : 'gun');
        const reach = preferEnt ? entHit.dist : (longHit?.dist ?? heldDef.range);
        const end = origin.clone().addScaledVector(dir, Math.max(0.4, reach));
        const from = origin.clone().addScaledVector(dir, 0.45);
        if (held.id === BOW) {
          const target = preferEnt && !entHit.e.dying ? entHit.e : null;
          spawnWhiteArrow(from, end, target, () => {
            sfx.arrowHit(target ? distTo(target) : end.distanceTo(player.pos));
            if (!target || target.dying || !life?.list.includes(target)) return;
            life.hurt(target, 999, player.pos, { delayDeath: true, deathDelay: 0.12 });
            mobHitSfx(target);
          });
        } else {
          spawnTracer(from, end, 0xffe08a);
          if (preferEnt) {
            life.hurt(entHit.e, 999, player.pos, { delayDeath: true });
            mobHitSfx(entHit.e);
          }
        }
        arms.punch();
      } else {
        sfx.denied();
      }
      attackCool = heldDef.cool || 0.45;
      refreshHud();
    }
  } else if (mouse.left && preferEnt) {
    mine = null;
    breakBar.hidden = true;
    if (attackCool <= 0) {
      const loot = life.hurt(entHit.e, attackDamage(held), player.pos);
      mobHitSfx(entHit.e);
      giveEntityLoot(loot, entHit.e);
      if (ITEMS[held?.id]?.tool) inv.wearSelected();
      arms.punch();
      attackCool = 0.4;
      refreshHud();
    }
  } else if (mining) {
    if (!mine || mine.x !== hit.x || mine.y !== hit.y || mine.z !== hit.z) {
      mine = { x: hit.x, y: hit.y, z: hit.z, t: 0, need: mineSeconds(hit.id, inv.selectedStack()) };
      sfx.dig(hit.id);
    }
    mine.t += dt;
    if (mine.t >= 0.28 && mine.t % 0.28 < dt) {
      arms.punch();
      sfx.dig(hit.id);
    }
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
    if (mouse.left && attackCool <= 0) {
      sfx.swing();
      attackCool = 0.4;
    }
    if (!mouse.right) {
      breakBar.hidden = true;
      breakBar.classList.remove('eat');
    }
  }

  const sneak = keys.ShiftLeft || keys.ShiftRight;
  const selFood = foodInfo(inv.selectedStack());
  const offFood = foodInfo(inv.offhand);
  if (mouse.right) {
    if (isDoorId(hit?.id) && !sneak) {
      if (placeCool <= 0) {
        placeCool = 0.18;
        const wasOpen = isDoorOpenId(hit.id);
        if (toggleDoor(world, hit.x, hit.y, hit.z, player, life, KINDS)) {
          sfx.door(!wasOpen);
          remeshDirty(world, bundle);
        }
      }
      eatAcc = 0;
    } else if (usingLasso) {
      if (placeCool <= 0 && life?.getLassoed()) {
        placeCool = 0.18;
        life.clearLasso();
        sfx.lassoRelease();
      }
      eatAcc = 0;
    } else if (usingRanged) {
      eatAcc = 0;
    } else if (hit?.id === TABLE && !sneak) {
      if (placeCool <= 0) {
        placeCool = 0.18;
        openInv(true);
      }
      eatAcc = 0;
    } else if (hit?.id === FURNACE && !sneak) {
      if (placeCool <= 0) {
        placeCool = 0.18;
        sfx.furnaceOpen();
        openFurnace(hit.x, hit.y, hit.z);
      }
      eatAcc = 0;
    } else if (selFood && canEatFood(selFood)) {
      eatAcc += dt;
      const pct = eatAcc / selFood.eatTime;
      breakBar.hidden = false;
      breakBar.classList.add('eat');
      breakBar.querySelector('i').style.width = `${Math.min(100, pct * 100)}%`;
      if (eatAcc >= selFood.eatTime) {
        if (player.eat(selFood.hunger, selFood.heal || 0)) {
          inv.takeSelected(1);
          sfx.eat();
        }
        eatAcc = 0;
        refreshHud();
        arms.punch();
      }
    } else if (placeCool <= 0 && placeHit) {
      placeCool = 0.18;
      const placed = placeBlock(placeHit);
      if (placed === TORCH) sfx.torchLight();
      else if (placed) sfx.blockPlace(placed);
      eatAcc = 0;
    } else if (offFood && canEatFood(offFood)) {
      eatAcc += dt;
      const pct = eatAcc / offFood.eatTime;
      breakBar.hidden = false;
      breakBar.classList.add('eat');
      breakBar.querySelector('i').style.width = `${Math.min(100, pct * 100)}%`;
      if (eatAcc >= offFood.eatTime) {
        if (player.eat(offFood.hunger, offFood.heal || 0)) {
          inv.takeOffhand(1);
          sfx.eat();
        }
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
    const caught = entHit.e.lassoed ? ` · ${t('lassoed')}` : '';
    blockLabel.textContent = `${t(def.nameKey)}  ${Math.max(0, Math.ceil(entHit.e.hp))}/${def.hp}${caught}`;
  } else if (hit?.id === SURPRISE_BOX && !canHarvest(SURPRISE_BOX, held)) {
    blockLabel.textContent = `${t('blockSurpriseBox')} · ${t('crateNeedsAxe')}`;
  } else if (usingRanged && held) {
    blockLabel.textContent = hit ? `${t(nameKey(hit.id))} · ${t(nameKey(held.id))} ${ammoOf(held)}` : `${t(nameKey(held.id))} ${ammoOf(held)}`;
  } else {
    blockLabel.textContent = hit ? t(nameKey(hit.id)) : '';
  }
  const biome = t(biomeNameKey(world.biomeAt(player.pos.x, player.pos.z)));
  coordsEl.textContent = `${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)} · ${biome}`;
  refreshHearts();
  refreshFoods();
}

function giveOrDrop(id, n, x, y, z, extra = {}) {
  if (!id || n <= 0) return;
  if (inv.add(id, n, extra.dura, extra.ammo)) return;
  drops?.spawn(
    id, n,
    x, y, z,
    (Math.random() - 0.5) * 1.8, 3.1, (Math.random() - 0.5) * 1.8,
    extra.dura, extra.ammo,
  );
}

function applyCrateLoot(loot, x, y, z) {
  const existing = inv.findId(loot.id);
  if (existing) {
    if (ITEMS[loot.id]?.ranged) {
      const add = loot.ammo ?? ITEMS[loot.id].ammoStart ?? 0;
      existing.ammo = ammoOf(existing) + add;
      return { ...loot, alreadyHad: true, ammoAdded: add, ammoTotal: existing.ammo };
    }
    return { ...loot, alreadyHad: true, ammoAdded: 0, ammoTotal: 0 };
  }
  giveOrDrop(loot.id, loot.n, x, y, z, { ammo: loot.ammo });
  return { ...loot, alreadyHad: false, ammoAdded: loot.ammo || 0, ammoTotal: loot.ammo || 0 };
}

function giveEntityLoot(loot, e) {
  const x = (e?.x ?? player.pos.x) + (Math.random() - 0.5) * 0.3;
  const y = (e?.y ?? player.pos.y) + 0.4;
  const z = (e?.z ?? player.pos.z) + (Math.random() - 0.5) * 0.3;
  for (const d of loot) giveOrDrop(d.id, d.n, x, y, z);
}

function spawnWhiteArrow(from, to, track, onHit) {
  const mesh = makeWhiteArrowMesh();
  scene.add(mesh);
  const dist = from.distanceTo(to);
  flyArrows.push({
    mesh,
    from: from.clone(),
    to: to.clone(),
    track: track || null,
    t: 0,
    dur: Math.max(0.08, Math.min(0.34, dist / 85)),
    hold: 0.16,
    holdT: 0,
    onHit,
    hit: false,
  });
}

function makeWhiteArrowMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.58), mat);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.14), mat);
  head.position.z = -0.36;
  const fletchA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.1), mat);
  const fletchB = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.1), mat);
  fletchA.position.z = 0.26;
  fletchB.position.z = 0.26;
  g.add(shaft, head, fletchA, fletchB);
  return g;
}

function tickArrows(dt) {
  for (let i = flyArrows.length - 1; i >= 0; i--) {
    const a = flyArrows[i];
    if (a.track && !a.track.mesh) a.track = null;
    if (a.track) {
      const def = KINDS[a.track.kind];
      a.to.set(a.track.x, a.track.y + def.h * 0.55, a.track.z);
    }
    if (!a.hit) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.mesh.position.lerpVectors(a.from, a.to, k);
      const dx = a.to.x - a.from.x;
      const dy = a.to.y - a.from.y;
      const dz = a.to.z - a.from.z;
      if (dx * dx + dy * dy + dz * dz > 1e-6) {
        a.mesh.lookAt(a.mesh.position.x + dx, a.mesh.position.y + dy, a.mesh.position.z + dz);
      }
      if (k >= 1) {
        a.hit = true;
        a.holdT = a.hold;
        a.onHit?.();
      }
    } else {
      a.mesh.position.copy(a.to);
      a.holdT -= dt;
      if (a.holdT <= 0) {
        scene.remove(a.mesh);
        a.mesh.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        flyArrows.splice(i, 1);
      }
    }
  }
}

function spawnTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, geo, t: 0.1 });
}

function tickTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t -= dt;
    if (tr.t <= 0) {
      scene.remove(tr.line);
      tr.geo.dispose();
      tr.line.material.dispose();
      tracers.splice(i, 1);
    } else if (tr.line.material) {
      tr.line.material.opacity = Math.max(0, tr.t / 0.1);
    }
  }
}

function breakBlock(hit) {
  const id = world.get(hit.x, hit.y, hit.z);
  if (!id || isUnbreakable(id) || id === AIR) return;
  sfx.blockBreak(id);
  if (isDoorId(id)) {
    const drop = removeDoor(world, hit.x, hit.y, hit.z);
    if (drop) inv.add(drop, 1);
    if (ITEMS[inv.selectedStack()?.id]?.tool) inv.wearSelected();
    remeshDirty(world, bundle);
    refreshHud();
    arms.punch();
    return;
  }
  if (id === SURPRISE_BOX) {
    if (!canHarvest(id, inv.selectedStack())) return;
    sfx.chestOpen();
    const ox = hit.x + 0.5;
    const oy = hit.y + 0.4;
    const oz = hit.z + 0.5;
    if (isCastleChest(world, hit.x, hit.y, hit.z)) {
      giveOrDrop(GOLD, 64, ox, oy, oz);
      giveOrDrop(GOLD, 36, ox, oy, oz);
      openCrateLoot({ id: GOLD, n: 100, goldHoard: true });
    } else {
      const loot = crateLoot();
      if (loot) {
        const result = applyCrateLoot(loot, ox, oy, oz);
        openCrateLoot(result);
      }
    }
    if (ITEMS[inv.selectedStack()?.id]?.tool) inv.wearSelected();
    world.set(hit.x, hit.y, hit.z, AIR);
    remeshDirty(world, bundle);
    refreshHud();
    arms.punch();
    return;
  }
  const blockDrops = BLOCKS[id]?.drops || [];
  for (const d of blockDrops) inv.add(d.id, d.n);
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

// Returns the id of the block that was placed, or 0 when nothing was, so the
// caller knows which sound to play.
function placeBlock(hit) {
  let fromOff = false;
  let stack = inv.selectedStack();
  if (!stack || !isPlaceable(stack.id)) {
    stack = inv.offhand;
    fromOff = true;
  }
  if (!stack || !isPlaceable(stack.id)) return 0;
  if (isWall(stack.id)) {
    if (!placeWall(world, hit, player.yaw, player.pitch, stack.id, player)) return 0;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return stack.id;
  }
  const replaceHit = isLiquid(hit.id);
  const px = replaceHit ? hit.x : hit.x + hit.nx;
  const py = replaceHit ? hit.y : hit.y + hit.ny;
  const pz = replaceHit ? hit.z : hit.z + hit.nz;
  if (!world.inBounds(px, py, pz)) return 0;
  const dest = world.get(px, py, pz);
  if (!isReplaceable(dest)) return 0;
  if (player.overlapsBlock(px, py, pz) && isSolid(stack.id) && !isStair(stack.id)) return 0;
  if (stack.id === TORCH && !isSolid(world.get(hit.x, hit.y, hit.z))) return 0;
  if ((isFlower(stack.id) || isRug(stack.id)) && !isSolid(world.get(px, py - 1, pz))) return 0;
  if (stack.id === DOOR || stack.id === DOOR_DOUBLE) {
    if (!placeDoor(world, px, py, pz, player.yaw, stack.id === DOOR_DOUBLE, player)) return 0;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return stack.id;
  }
  if (isStair(stack.id)) {
    if (player.overlapsBlock(px, py, pz)) return 0;
    if (!placeStairs(world, px, py, pz, player.yaw, stack.id)) return 0;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return stack.id;
  }
  if (stack.id === LADDER) {
    if (!placeLadder(world, px, py, pz, hit.nx, hit.ny, hit.nz)) return 0;
    if (fromOff) inv.takeOffhand(1);
    else inv.takeSelected(1);
    remeshDirty(world, bundle);
    refreshHud();
    return stack.id;
  }
  world.set(px, py, pz, stack.id);
  if (stack.id === TORCH) world.setTorchFacing(px, py, pz, torchFacingFromHit(hit.nx, hit.ny, hit.nz));
  if (stack.id === FURNACE) world.furnaces[furnaceKey(px, py, pz)] = emptyFurnace();
  if (isFlower(stack.id) && life) life.assignFlowerHome(px, py, pz);
  const placedId = stack.id;
  if (fromOff) inv.takeOffhand(1);
  else inv.takeSelected(1);
  remeshDirty(world, bundle);
  refreshHud();
  return placedId;
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
  sfx.sleep();
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
  if (freezeTimeEl) freezeTimeEl.checked = !!freezeTime;
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
  syncMapMarkUi();
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

function mapClientToWorld(clientX, clientY) {
  const rect = mapCanvas.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  return {
    x: mapView.cx + (mx - rect.width / 2) / mapView.zoom,
    z: mapView.cz + (my - rect.height / 2) / mapView.zoom,
  };
}

function syncMapMarkUi() {
  if (!mapTeleportBtn) return;
  mapTeleportBtn.disabled = !mapMark;
}

function teleportToMapMark() {
  if (!mapMark || !player || !world || player.health <= 0) return;
  const x = Math.floor(mapMark.x) + 0.5;
  const z = Math.floor(mapMark.z) + 0.5;
  world.ensureAround(x, z, 4);
  const { h } = world.surfaceForMap(Math.floor(x), Math.floor(z));
  const y = Math.max(1, (h || 0) + 1);
  player.pos.set(x, y, z);
  player.vel.set(0, 0, 0);
  player.fallY = y;
  player.onGround = true;
  if (life) life.snapLassoedTo(x, y, z, player.yaw);
  sfx.teleport();
  wasOnGround = true;
  fallPeak = 0;
  world.ensureAround(x, z);
  if (bundle) syncChunkMeshes(world, bundle, x, z);
  closeMapSilent();
  mapView.fromPause = false;
  requestPlay();
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
  if (mapMark) {
    const mx = (mapMark.x - originX) * zoom;
    const mz = (mapMark.z - originZ) * zoom;
    const s = Math.max(1.1, dpr);
    ctx.save();
    ctx.translate(mx, mz);
    ctx.scale(s, s);
    ctx.fillStyle = '#e23d48';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(8, 1, 6, -9, 0, -9);
    ctx.bezierCurveTo(-6, -9, -8, 1, 0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -3.2, 2.3, 0, Math.PI * 2);
    ctx.fill();
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

function updateCompass() {
  if (!compassEl || !compassNeedleEl) return;
  const holding = !!(inv && (inv.selectedStack()?.id === COMPASS || inv.offhand?.id === COMPASS));
  const show = holding && isPlaying() && world && player;
  compassEl.hidden = !show;
  if (!show) return;
  const deg = castleNeedleDeg(world, player.pos.x, player.pos.z, player.yaw);
  compassNeedleEl.style.transform = `rotate(${deg}deg)`;
}

function render(dt = 0.016) {
  updateCompass();
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
  if (life && arms) {
    const mainLasso = !ITEMS[inv?.offhand?.id]?.lasso || !!ITEMS[inv?.selectedStack()?.id]?.lasso;
    life.syncRope(player, arms.heldWorld(mainLasso));
  }
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
  if (!el || el.id === 'inv-trash') return;
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
  } else if (stack && ITEMS[stack.id]?.ranged) {
    const c = document.createElement('span');
    c.className = 'count';
    c.textContent = String(ammoOf(stack));
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
  if (list === 'trash') {
    if (!inv.cursor) return;
    if (right) {
      inv.cursor.n -= 1;
      if (inv.cursor.n <= 0) inv.cursor = null;
    } else {
      inv.cursor = null;
    }
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
  sfx.craft();
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
  const trash = document.getElementById('inv-trash');
  if (trash) trash.classList.toggle('ready', !!inv.cursor);
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
  if (!shopBook.hidden) renderShop();
}

function setRecipesOpen(open) {
  recipeBook.hidden = !open;
  if (open) shopBook.hidden = true;
  syncRecipesBtn();
  syncShopBtn();
  if (open) renderRecipeBook();
}

function syncRecipesBtn() {
  recipesBtn.textContent = recipeBook.hidden ? t('recipes') : t('hideRecipes');
}

function setShopOpen(open) {
  shopBook.hidden = !open;
  if (open) recipeBook.hidden = true;
  syncShopBtn();
  syncRecipesBtn();
  if (open) {
    renderShop();
    requestAnimationFrame(() => {
      shopBook.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
}

function syncShopBtn() {
  shopBtn.textContent = shopBook.hidden ? t('shop') : t('hideShop');
}

function setShopStatus(key, vars) {
  const el = document.getElementById('shop-status');
  if (!el) return;
  if (!key) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('ok');
    return;
  }
  let text = t(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  }
  el.hidden = false;
  el.classList.toggle('ok', key === 'shopAmmoAdded');
  el.textContent = text;
}

function renderShop() {
  const list = document.getElementById('shop-list');
  const goldEl = document.getElementById('shop-gold');
  if (!list || !goldEl || !atlas) return;
  const gold = inv.count(GOLD);
  goldEl.replaceChildren();
  goldEl.appendChild(guideCell(GOLD));
  const goldLabel = document.createElement('span');
  goldLabel.textContent = t('shopGold').replace('{n}', String(gold));
  goldEl.appendChild(goldLabel);

  list.replaceChildren();
  SHOP_SECTIONS.forEach((section, sIdx) => {
    const wrap = document.createElement('section');
    wrap.className = 'shop-section';
    const title = document.createElement('h3');
    title.textContent = t(section.titleKey);
    wrap.appendChild(title);
    section.items.forEach((item, iIdx) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'shop-row';
      row.dataset.section = String(sIdx);
      row.dataset.index = String(iIdx);
      const canBuy = gold >= item.cost;
      const owned = ownedRanged(inv, item.id);
      const restock = owned ? ammoRestock(item.id) : 0;
      row.classList.toggle('can-buy', canBuy);
      row.disabled = !canBuy;
      const itemName = t(nameKey(item.id));
      const qty = item.n > 1 ? ` ×${item.n}` : '';
      row.title = canBuy ? t(owned ? 'shopBuyAmmo' : 'shopBuy') : t('shopNeedGold');
      row.setAttribute(
        'aria-label',
        owned
          ? `${itemName} +${restock}, ${item.cost} ${t('itemGold')}`
          : `${itemName}${qty}, ${item.cost} ${t('itemGold')}`,
      );
      row.appendChild(guideCell(item.id));
      const name = document.createElement('span');
      name.className = 'shop-row-name';
      name.append(itemName);
      if (owned) {
        const ammoEl = document.createElement('span');
        ammoEl.className = 'shop-row-count';
        ammoEl.textContent = ` +${restock}`;
        name.appendChild(ammoEl);
      } else if (qty) {
        const qtyEl = document.createElement('span');
        qtyEl.className = 'shop-row-count';
        qtyEl.textContent = qty;
        name.appendChild(qtyEl);
      }
      row.appendChild(name);
      const cost = document.createElement('span');
      cost.className = 'shop-row-cost';
      cost.appendChild(guideCell(GOLD));
      cost.append(`×${item.cost}`);
      row.appendChild(cost);
      const buy = document.createElement('span');
      buy.className = 'shop-buy-label';
      buy.textContent = t(owned ? 'shopBuyAmmo' : 'shopBuy');
      row.appendChild(buy);
      wrap.appendChild(row);
    });
    list.appendChild(wrap);
  });
}

function buyFromShopRow(row) {
  const section = SHOP_SECTIONS[Number(row.dataset.section)];
  const item = section?.items[Number(row.dataset.index)];
  if (!item) return;
  const result = buyShopItem(inv, item);
  if (result.ok) {
    if (result.ammo) {
      setShopStatus('shopAmmoAdded', { n: result.ammoAdded, total: result.ammoTotal });
    } else {
      setShopStatus('');
    }
    sfx.coins();
    refreshInv();
    refreshHud();
    return;
  }
  sfx.denied();
  setShopStatus(result.reason === 'full' ? 'shopFull' : 'shopNeedGold');
  renderShop();
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
    badge.textContent = rec.furnace
      ? t('furnace')
      : rec.table ? t('recipeNeedsTable') : t('recipeInventoryGrid');
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
    if (rec.furnace) {
      grid.appendChild(guideCell(rec.input));
      if (rec.fuel) grid.appendChild(guideCell(rec.fuel));
      while (grid.childElementCount < rec.size * rec.size) grid.appendChild(guideCell(0));
    } else if (rec.shapeless) {
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
        const count = variant.n ? ` ×${variant.n}` : '';
        label.textContent = `${t(nameKey(variant.out))}${count}`;
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
      note.textContent = t(rec.matKey || 'recipeMaterial');
      card.appendChild(note);
    }

    list.appendChild(card);
  }
}

window.__VC = {
  get world() { return world; },
  get player() { return player; },
  get inv() { return inv; },
  get life() { return life; },
  get bundle() { return bundle; },
  get castle() { return world ? getCastle(world) : null; },
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







