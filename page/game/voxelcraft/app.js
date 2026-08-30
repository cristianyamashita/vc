import * as THREE from 'three';
import { initLang, setLang, t, applyI18n } from './js/i18n.js';
import { initTheme, toggleTheme, getTheme } from './js/theme.js';
import {
  AIR, TABLE, TORCH, BEDROCK, ITEMS, BLOCKS,
  isPlaceable, isSolid, canHarvest, mineSeconds, nameKey, stackMax,
} from './js/blocks.js';
import { World, GEN_PER_TICK, biomeNameKey, CHUNK, mapRgb } from './js/world.js';
import { createAtlas, itemIcon } from './js/textures.js';
import { createWorldMeshes, remeshDirty, disposeMeshes, syncChunkMeshes } from './js/mesher.js';
import { Player, raycast } from './js/player.js';
import { Arms } from './js/arms.js';
import { Inventory, HOTBAR, clickSlot } from './js/inventory.js';
import { matchRecipe, consumeCraft } from './js/crafting.js';
import { RECIPE_GUIDE, MAT } from './js/recipes.js';
import { loadWorldSave, saveWorldSave, clearWorldSave, saveSettings } from './js/save.js';

const canvas = document.getElementById('view');
const menuEl = document.getElementById('menu');
const deathEl = document.getElementById('death');
const loadingEl = document.getElementById('loading');
const invEl = document.getElementById('inv-overlay');
const playBtn = document.getElementById('play-btn');
const newWorldBtn = document.getElementById('new-world-btn');
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
const hotbarEl = document.getElementById('hotbar');
const offhandSlotEl = document.getElementById('offhand-slot');
const coordsEl = document.getElementById('coords');
const savePill = document.getElementById('save-pill');
const cursorEl = document.getElementById('cursor-item');
const timeSlider = document.getElementById('time-slider');
const timeClock = document.getElementById('time-clock');
const mapCanvas = document.getElementById('world-map');
const mapMeta = document.getElementById('map-meta');

const DAY_CYCLE = 480;
const TIME_PRESETS = { dawn: 40, noon: 120, dusk: 200, night: 360 };

const keys = Object.create(null);
const mouse = { left: false, right: false };
let world;
let bundle;
let player;
let inv;
let arms;
let atlas;
let renderer;
let scene;
let camera;
let sun;
let hemi;
let highlight;
let tableMode = false;
let mine = null;
let placeCool = 0;
let saveCool = 0;
let worldTime = 0;
let saving = false;
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

hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3d4a32, 0.55);
hemi.layers.enable(1);
scene.add(hemi);
sun = new THREE.DirectionalLight(0xfff4d6, 1.05);
sun.position.set(40, 80, 20);
sun.layers.enable(1);
scene.add(sun);
const ambient = new THREE.AmbientLight(0xffffff, 0.18);
ambient.layers.enable(1);
scene.add(ambient);
const armLight = new THREE.PointLight(0xffffff, 0.9, 5);
armLight.position.set(0.1, 0.1, 0.2);
armLight.layers.set(1);
camera.add(armLight);

highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
  new THREE.LineBasicMaterial({ color: 0x000000 }),
);
highlight.visible = false;
scene.add(highlight);

arms = new Arms(camera);
buildHearts();
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
    if (player) playBtn.textContent = t('resume');
    syncTimeUi();
    drawWorldMap();
  });
});

themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTheme();
  syncThemeBtn();
  persistUi();
  if (!menuEl.hidden) drawWorldMap();
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
newWorldBtn.addEventListener('click', () => {
  if (!confirm(t('newWorldConfirm'))) return;
  startNewWorld();
});
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
  if (!document.pointerLockElement && !invOpen() && deathEl.hidden) requestPlay();
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
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !invOpen() && player?.health > 0 && menuEl.hidden) {
    showMenu(true);
  }
});
document.addEventListener('pointerlockerror', () => {});

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'ControlLeft' && isPlaying()) e.preventDefault();
  if (e.code === 'Escape') {
    if (invOpen()) closeInv();
    else if (menuEl.hidden && player?.health > 0) {
      document.exitPointerLock?.();
      showMenu(true);
    }
    return;
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    if (invOpen()) closeInv();
    if (player?.health > 0 && menuEl.hidden) {
      document.exitPointerLock?.();
      showMenu(true);
    }
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyE') {
    e.preventDefault();
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
  if (!menuEl.hidden) drawWorldMap();
}

function syncThemeBtn() {
  themeBtn.textContent = getTheme() === 'dark' ? '☾' : '☀';
}

function persistUi() {
  saveSettings({ lang: document.documentElement.lang, theme: getTheme() }).catch(() => {});
}

function showMenu(paused) {
  menuEl.hidden = false;
  playBtn.textContent = paused ? t('resume') : t('clickToPlay');
  syncTimeUi();
  drawWorldMap();
}

function hideMenu() {
  menuEl.hidden = true;
}

function invOpen() {
  return !invEl.hidden;
}

function isPlaying() {
  return !!player && player.health > 0 && !invOpen() && menuEl.hidden && deathEl.hidden;
}

function requestPlay() {
  if (!player || player.health <= 0) return;
  hideMenu();
  resize();
  canvas.requestPointerLock?.();
}

function openInv(table) {
  tableMode = table;
  document.exitPointerLock();
  invEl.hidden = false;
  craft2Row.hidden = table;
  craft3Row.hidden = !table;
  invTitle.textContent = table ? t('craftingTable') : t('inventory');
  refreshInv();
  renderRecipeBook();
  syncRecipesBtn();
}

function closeInv() {
  if (tableMode) inv.returnCraft(inv.craft3);
  else inv.returnCraft(inv.craft2);
  tableMode = false;
  invEl.hidden = true;
  cursorEl.hidden = true;
  refreshHud();
  if (player.health > 0) canvas.requestPointerLock();
}

async function boot() {
  loadingEl.hidden = false;
  const save = await loadWorldSave();
  if (save?.seed) await loadFromSave(save);
  else await startNewWorld(false);
  loadingEl.hidden = true;
  showMenu(false);
}

async function startNewWorld(reset = true) {
  loadingEl.hidden = false;
  hideMenu();
  if (reset) await clearWorldSave();
  if (bundle) {
    scene.remove(bundle.group);
    disposeMeshes(bundle);
    bundle = null;
  }
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
  syncChunkMeshes(world, bundle, spawn.x, spawn.z);
  await persist();
  refreshHud();
  loadingEl.hidden = true;
  resize();
  showMenu(false);
}

async function loadFromSave(save) {
  world = new World(save.seed);
  world.applyEdits(save.edits || {});
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
  if (!world.map.size) world.rebuildMapFromChunks();
  worldTime = save.worldTime ?? 120;
  refreshHud();
  syncTimeUi();
}

function snapshot() {
  return {
    seed: world.seed,
    edits: world.edits,
    worldTime,
    map: world.encodeMap(),
    player: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch, health: player.health,
      sx: player.spawn.x, sy: player.spawn.y, sz: player.spawn.z,
    },
    inventory: inv.serialize(),
  };
}

async function persist() {
  saving = true;
  savePill.textContent = t('saving');
  try {
    await saveWorldSave(snapshot());
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
  if (saveCool > 8 && !saving) {
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
  updateHighlight(hit);

  const walking = input.forward || input.back || input.left || input.right;
  const mining = mouse.left && hit && BLOCKS[hit.id] && hit.id !== BEDROCK;
  arms.setHeld(inv.selectedStack()?.id || 0);
  arms.setOffhand(inv.offhand?.id || 0);
  arms.update(dt, walking && player.onGround, mining);

  if (mining) {
    if (!mine || mine.x !== hit.x || mine.y !== hit.y || mine.z !== hit.z) {
      mine = { x: hit.x, y: hit.y, z: hit.z, t: 0, need: mineSeconds(hit.id, inv.selectedStack()) };
    }
    mine.t += dt;
    if (mine.t >= 0.28 && mine.t % 0.28 < dt) arms.punch();
    const pct = mine.need === Infinity ? 0 : mine.t / mine.need;
    breakBar.hidden = false;
    breakBar.querySelector('i').style.width = `${Math.min(100, pct * 100)}%`;
    if (mine.t >= mine.need) {
      breakBlock(hit);
      mine = null;
      breakBar.hidden = true;
    }
  } else {
    mine = null;
    breakBar.hidden = true;
  }

  if (mouse.right && placeCool <= 0 && hit) {
    placeCool = 0.18;
    const sneak = keys.ShiftLeft || keys.ShiftRight;
    if (hit.id === TABLE && !sneak) openInv(true);
    else placeBlock(hit);
  }

  blockLabel.textContent = hit ? t(nameKey(hit.id)) : '';
  const biome = t(biomeNameKey(world.biomeAt(player.pos.x, player.pos.z)));
  coordsEl.textContent = `${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)} · ${biome}`;
  refreshHearts();
}

function breakBlock(hit) {
  const id = world.get(hit.x, hit.y, hit.z);
  if (!id || id === BEDROCK || id === AIR) return;
  if (canHarvest(id, inv.selectedStack())) {
    const drops = BLOCKS[id]?.drops || [];
    for (const d of drops) inv.add(d.id, d.n);
  }
  if (ITEMS[inv.selectedStack()?.id]?.tool) inv.wearSelected();
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
  world.set(px, py, pz, stack.id);
  if (fromOff) inv.takeOffhand(1);
  else inv.takeSelected(1);
  remeshDirty(world, bundle);
  refreshHud();
}

function updateHighlight(hit) {
  if (!hit) {
    highlight.visible = false;
    return;
  }
  highlight.visible = true;
  highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
}

function dayFactor() {
  const a = ((worldTime % DAY_CYCLE) / DAY_CYCLE) * Math.PI * 2;
  return { a, day: Math.max(0, Math.sin(a)) };
}

function clockFromWorldTime(wt) {
  const hours = (((wt % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE) / DAY_CYCLE * 24 + 6;
  const wrapped = hours % 24;
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

function drawWorldMap() {
  const ctx = mapCanvas.getContext('2d');
  const view = 256;
  if (mapCanvas.width !== view) {
    mapCanvas.width = view;
    mapCanvas.height = view;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = getTheme() === 'light' ? '#c5d4d0' : '#081012';
  ctx.fillRect(0, 0, view, view);
  if (!world || !world.map.size) {
    mapMeta.textContent = `0 ${t('mapChunks')}`;
    return;
  }

  let minCx = Infinity;
  let maxCx = -Infinity;
  let minCz = Infinity;
  let maxCz = -Infinity;
  for (const key of world.map.keys()) {
    const [cx, cz] = key.split(',').map(Number);
    if (cx < minCx) minCx = cx;
    if (cx > maxCx) maxCx = cx;
    if (cz < minCz) minCz = cz;
    if (cz > maxCz) maxCz = cz;
  }
  const blocksW = (maxCx - minCx + 1) * CHUNK;
  const blocksH = (maxCz - minCz + 1) * CHUNK;
  const scale = Math.max(1, Math.floor(view / Math.max(blocksW, blocksH)));
  const usedW = blocksW * scale;
  const usedH = blocksH * scale;
  const ox = Math.floor((view - usedW) / 2);
  const oz = Math.floor((view - usedH) / 2);
  const originX = minCx * CHUNK;
  const originZ = minCz * CHUNK;

  const img = ctx.createImageData(usedW, usedH);
  const data = img.data;
  for (const [key, buf] of world.map) {
    const [cx, cz] = key.split(',').map(Number);
    const bx = (cx - minCx) * CHUNK;
    const bz = (cz - minCz) * CHUNK;
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const i = (lz * CHUNK + lx) * 2;
        const [r, g, b] = mapRgb(buf[i], buf[i + 1]);
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = (bx + lx) * scale + sx;
            const py = (bz + lz) * scale + sy;
            const p = (py * usedW + px) * 4;
            data[p] = r;
            data[p + 1] = g;
            data[p + 2] = b;
            data[p + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(img, ox, oz);

  if (player) {
    const mx = ox + (player.pos.x - originX) * scale;
    const mz = oz + (player.pos.z - originZ) * scale;
    ctx.save();
    ctx.translate(mx, mz);
    ctx.rotate(-player.yaw);
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

function render(dt = 0.016) {
  if (!player) return;
  const { a, day } = dayFactor();
  sun.position.set(Math.cos(a) * 90, Math.sin(a) * 90 + 8, 30);
  sun.intensity = 0.15 + day * 0.95;
  hemi.intensity = 0.2 + day * 0.4;
  const sky = new THREE.Color().lerpColors(new THREE.Color(0x070b18), new THREE.Color(0x87b7e0), 0.15 + day * 0.85);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);

  const wantFov = player.sprint ? 82 : 75;
  camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();

  player.applyLook(camera);
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

function refreshHearts() {
  const hp = player?.health ?? 20;
  heartsEl.querySelectorAll('.heart').forEach((el, i) => {
    const v = hp - i * 2;
    el.classList.toggle('on', v >= 2);
    el.classList.toggle('half', v === 1);
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
  const paintList = (node, arr, offset = 0) => {
    node.querySelectorAll('.slot').forEach((el, i) => paintSlot(el, arr[offset + i], false));
  };
  paintList(document.getElementById('inv-grid'), inv.slots, 9);
  paintList(document.getElementById('inv-hotbar'), inv.slots, 0);
  paintSlot(document.getElementById('inv-offhand'), inv.offhand, false);
  paintList(document.getElementById('craft2-grid'), inv.craft2);
  paintList(document.getElementById('craft3-grid'), inv.craft3);
  const r2 = matchRecipe(inv.craft2, 2);
  const r3 = matchRecipe(inv.craft3, 3);
  paintSlot(document.getElementById('craft2-out'), r2 ? { id: r2.id, n: r2.n } : null, false);
  paintSlot(document.getElementById('craft3-out'), r3 ? { id: r3.id, n: r3.n } : null, false);
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
  for (const rec of RECIPE_GUIDE) {
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

try {
  await boot();
} catch (err) {
  loadingEl.hidden = true;
  console.error(err);
  coordsEl.textContent = String(err && err.message ? err.message : err);
  showMenu(false);
}
