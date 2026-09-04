// Sound effects.
//
// The clips live in ../audio as short mono MP3s, all CC0 or public domain —
// see audio/CREDITS.md for the sources. Each entry in BANKS is a small set of
// takes of the same event; playing one picks a take at random and nudges the
// pitch, which is what keeps a hundred footsteps from sounding like the same
// footstep a hundred times.
//
// Files are peak-normalised, so how loud an event actually is comes from the
// `gain` given at the call site here, not from the file. That keeps the whole
// mix tunable in one place.
//
// Blocks pick their sounds from a material family (grass, stone, wood, …), so
// a new block only needs one entry in MATERIAL_OF to step, mine, break and
// place correctly.

import {
  GRASS, DIRT, STONE, COBBLE, SAND, WATER, LOG, LEAVES, PLANKS, COAL_ORE, IRON_ORE,
  TABLE, TORCH, BEDROCK, CACTUS, FLOWER_RED, FLOWER_YELLOW, FLOWER_WHITE, FRUIT_HANG,
  RUG_COW, RUG_ZEBRA, RUG_SHEEP, FURNACE, DOOR, DOOR_UPPER, DOOR_OPEN, DOOR_UPPER_OPEN,
  DOOR_DOUBLE, STAIRS, LADDER, GLASS, STAIRS_SAND, STAIRS_STONE, WALL_WOOD, WALL_GLASS,
  WATER_SPRING, RED_EARTH, SURPRISE_BOX, GOLD_ORE, CASTLE_WALL,
} from './blocks.js';

const STORAGE_KEY = 'voxelcraft_sound';
// Resolved against this module rather than the page, so the folder is found
// no matter which URL the game is served from.
const AUDIO_DIR = new URL('../audio/', import.meta.url);
// Clips are normalised to -6 dBFS so lossy encoding never overshoots into
// clipping; the master makes that headroom back up.
const MASTER_GAIN = 1.25;
const LOAD_PARALLEL = 6;

// bank name -> how many takes of it are on disk (<bank>_1.mp3 … <bank>_N.mp3)
const BANKS = {
  step_grass: 4, step_sand: 4, step_stone: 4, step_wood: 4, step_soft: 4,
  dig_stone: 4, dig_wood: 3, dig_soft: 3, dig_glass: 3,
  break_stone: 3, break_wood: 3, break_glass: 3, break_soft: 3,
  place_stone: 3, place_wood: 3, place_glass: 2, place_soft: 2,
  jump: 2, land_soft: 2, land_hard: 2, ladder: 2,
  splash_big: 3, splash_small: 2, swim: 3,
  swing: 3, hit_mob: 3, gun: 2, bow: 2, arrow_hit: 2, lasso: 2, lasso_off: 1,
  hurt: 4, die: 1, respawn: 1,
  mob_cow: 3, mob_zebra: 1, mob_sheep: 1, mob_chicken: 2, mob_lion: 3, mob_person: 2,
  eat: 4, pickup: 2, drop_item: 2, coins: 2, craft: 2,
  click: 1, panel_open: 1, panel_close: 1, reward: 1, denied: 1,
  door_open: 2, door_close: 2, chest_open: 2, furnace_open: 1,
  sizzle: 1, torch: 2, sleep: 1, teleport: 1,
};

// Loaded first, because these are the ones the player can trigger within a
// second or two of the world appearing.
const PRIORITY = [
  'step_grass', 'step_sand', 'step_stone', 'step_wood', 'step_soft',
  'dig_stone', 'dig_soft', 'dig_wood', 'click', 'panel_open', 'panel_close',
  'break_stone', 'break_soft', 'break_wood', 'place_stone', 'place_soft',
  'place_wood', 'pickup', 'hurt', 'swing', 'jump', 'land_soft',
];

let enabled = true;
let ctx = null;
let master = null;
let loadStarted = false;
const buffers = new Map();  // 'step_grass_3' -> AudioBuffer
const pending = new Set();

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function initSfx() {
  const stored = localStorage.getItem(STORAGE_KEY);
  enabled = stored !== 'off';
  if (enabled) startLoading();
  return enabled;
}

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(on) {
  enabled = !!on;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* private mode: keep the choice for this session only */
  }
  if (!enabled) ctx?.suspend().catch(() => {});
  else {
    startLoading();
    resumeAudio();
  }
  return enabled;
}

// Browsers only let an AudioContext make noise after a user gesture, so it is
// created suspended — decoding works fine that way — and woken whenever the
// player clicks into the game.
export function resumeAudio() {
  if (!enabled) return;
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function audio() {
  if (!enabled) return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    enabled = false;
    return null;
  }
  try {
    ctx = new AC();
  } catch {
    enabled = false;
    return null;
  }
  // Overlapping cues — mining while a lion roars and a gun goes off — would
  // otherwise sum past full scale and crackle.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 20;
  comp.ratio.value = 6;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

function startLoading() {
  if (loadStarted || !audio()) return;
  loadStarted = true;
  const queue = [];
  const push = (bank) => {
    for (let i = 1; i <= BANKS[bank]; i += 1) queue.push(`${bank}_${i}`);
  };
  for (const bank of PRIORITY) if (BANKS[bank]) push(bank);
  for (const bank of Object.keys(BANKS)) if (!PRIORITY.includes(bank)) push(bank);

  let next = 0;
  const pump = () => {
    while (pending.size < LOAD_PARALLEL && next < queue.length) {
      load(queue[next]).finally(pump);
      next += 1;
    }
  };
  pump();
}

async function load(key) {
  if (buffers.has(key) || pending.has(key)) return;
  pending.add(key);
  try {
    const res = await fetch(new URL(`${key}.mp3`, AUDIO_DIR));
    if (!res.ok) throw new Error(res.status);
    const bytes = await res.arrayBuffer();
    const c = audio();
    if (!c) return;
    buffers.set(key, await c.decodeAudioData(bytes));
  } catch {
    // A clip that will not load simply stays silent; the game does not care.
  } finally {
    pending.delete(key);
  }
}

const rand = (a, b) => a + Math.random() * (b - a);

// Mob and impact cues fade out with distance, so a lion killed across the
// field is not as loud as the one chewing on you.
function distGain(dist, reach) {
  if (!(dist > 0)) return 1;
  return Math.max(0, 1 - dist / reach) ** 1.6;
}

function take(bank) {
  const n = BANKS[bank];
  if (!n) return null;
  // Start at a random take but accept any that has finished decoding, so an
  // early sound still plays while the bank is still arriving.
  const start = Math.floor(Math.random() * n);
  for (let i = 0; i < n; i += 1) {
    const buf = buffers.get(`${bank}_${((start + i) % n) + 1}`);
    if (buf) return buf;
  }
  return null;
}

// The one place a sound actually reaches the speakers.
function play(bank, o = {}) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const level = (o.gain ?? 0.5) * distGain(o.dist || 0, o.reach || 26);
  if (level <= 0.001) return;
  const buf = take(bank);
  if (!buf) return;

  const src = c.createBufferSource();
  src.buffer = buf;
  const spread = o.spread ?? 0.06;
  src.playbackRate.value = (o.rate || 1) * rand(1 - spread, 1 + spread);

  let node = src;
  if (o.lowpass) {
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = o.lowpass;
    src.connect(filt);
    node = filt;
  }
  const g = c.createGain();
  g.gain.value = level;
  node.connect(g).connect(master);
  src.start(c.currentTime + (o.delay || 0));
}

// ---------------------------------------------------------------------------
// Block materials
// ---------------------------------------------------------------------------

// Every material names the banks it uses. `rate` and `lowpass` are how the
// families that share a bank stay apart: dirt is grass slowed and muffled,
// leaves are grass sped up, glass is stone rung high.
const MATERIALS = {
  grass: { step: 'step_grass', dig: 'dig_soft', brk: 'break_soft', place: 'place_soft', rate: 1 },
  dirt: { step: 'step_grass', dig: 'dig_soft', brk: 'break_soft', place: 'place_soft', rate: 0.85, lowpass: 2400 },
  sand: { step: 'step_sand', dig: 'dig_soft', brk: 'break_soft', place: 'place_soft', rate: 1 },
  stone: { step: 'step_stone', dig: 'dig_stone', brk: 'break_stone', place: 'place_stone', rate: 1 },
  wood: { step: 'step_wood', dig: 'dig_wood', brk: 'break_wood', place: 'place_wood', rate: 1 },
  leaves: { step: 'step_grass', dig: 'dig_soft', brk: 'break_soft', place: 'place_soft', rate: 1.25 },
  wool: { step: 'step_soft', dig: 'dig_soft', brk: 'break_soft', place: 'place_soft', rate: 1 },
  glass: { step: 'step_stone', dig: 'dig_glass', brk: 'break_glass', place: 'place_glass', rate: 1.45 },
  metal: { step: 'step_stone', dig: 'dig_stone', brk: 'break_stone', place: 'place_stone', rate: 1.3 },
  water: { step: 'splash_small', dig: 'dig_soft', brk: 'splash_small', place: 'splash_small', rate: 1 },
};

const MATERIAL_OF = {
  [GRASS]: 'grass',
  [DIRT]: 'dirt',
  [RED_EARTH]: 'dirt',
  [STONE]: 'stone',
  [COBBLE]: 'stone',
  [COAL_ORE]: 'stone',
  [IRON_ORE]: 'stone',
  [GOLD_ORE]: 'stone',
  [BEDROCK]: 'stone',
  [CASTLE_WALL]: 'stone',
  [STAIRS_STONE]: 'stone',
  [FURNACE]: 'stone',
  [SAND]: 'sand',
  [STAIRS_SAND]: 'sand',
  [LOG]: 'wood',
  [PLANKS]: 'wood',
  [TABLE]: 'wood',
  [TORCH]: 'wood',
  [STAIRS]: 'wood',
  [LADDER]: 'wood',
  [WALL_WOOD]: 'wood',
  [SURPRISE_BOX]: 'wood',
  [DOOR]: 'wood',
  [DOOR_UPPER]: 'wood',
  [DOOR_OPEN]: 'wood',
  [DOOR_UPPER_OPEN]: 'wood',
  [DOOR_DOUBLE]: 'wood',
  [LEAVES]: 'leaves',
  [CACTUS]: 'leaves',
  [FLOWER_RED]: 'leaves',
  [FLOWER_YELLOW]: 'leaves',
  [FLOWER_WHITE]: 'leaves',
  [FRUIT_HANG]: 'leaves',
  [GLASS]: 'glass',
  [WALL_GLASS]: 'glass',
  [RUG_COW]: 'wool',
  [RUG_ZEBRA]: 'wool',
  [RUG_SHEEP]: 'wool',
  [WATER]: 'water',
  [WATER_SPRING]: 'water',
};

function mat(blockId) {
  return MATERIALS[MATERIAL_OF[blockId]] || MATERIALS.stone;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

export function step(blockId, { sneak = false, sprint = false } = {}) {
  const m = mat(blockId);
  play(m.step, {
    gain: sneak ? 0.2 : sprint ? 0.5 : 0.36,
    rate: m.rate * (sprint ? 1.06 : 1),
    lowpass: m.lowpass,
    spread: 0.1,
  });
}

export function jump() {
  play('jump', { gain: 0.22, spread: 0.12 });
}

export function land(blockId, hard = false) {
  const m = mat(blockId);
  play(hard ? 'land_hard' : 'land_soft', { gain: hard ? 0.75 : 0.4 });
  play(m.step, { gain: hard ? 0.4 : 0.28, rate: m.rate * 0.92, lowpass: m.lowpass, delay: 0.01 });
}

export function splash(big = true) {
  play(big ? 'splash_big' : 'splash_small', { gain: big ? 0.6 : 0.35 });
}

export function swim() {
  play('swim', { gain: 0.3, spread: 0.12 });
}

export function ladderStep() {
  play('ladder', { gain: 0.3, spread: 0.1 });
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export function dig(blockId) {
  const m = mat(blockId);
  play(m.dig, { gain: 0.42, rate: m.rate, spread: 0.1 });
}

export function blockBreak(blockId) {
  const m = mat(blockId);
  play(m.brk, { gain: 0.6, rate: m.rate, spread: 0.08 });
}

export function blockPlace(blockId) {
  const m = mat(blockId);
  play(m.place, { gain: 0.5, rate: m.rate, spread: 0.08 });
}

export function torchLight() {
  play('torch', { gain: 0.45 });
}

export function door(open) {
  play(open ? 'door_open' : 'door_close', { gain: 0.5, spread: 0.04 });
}

export function furnaceOpen() {
  play('furnace_open', { gain: 0.45 });
}

export function chestOpen() {
  play('chest_open', { gain: 0.55 });
}

export function sizzle() {
  play('sizzle', { gain: 0.35 });
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export function swing() {
  play('swing', { gain: 0.3, spread: 0.1 });
}

export function hitMob(dist = 0) {
  play('hit_mob', { gain: 0.6, dist, spread: 0.1 });
}

export function shoot(kind = 'gun', dist = 0) {
  if (kind === 'bow') {
    play('bow', { gain: 0.5, dist, reach: 40, spread: 0.08 });
    return;
  }
  // The loudest thing in the game, and the only event that needs a gain
  // above 1: even limited, a gunshot carries far less sustained energy
  // than anything else at the same peak.
  play('gun', { gain: 1.4, dist, reach: 40, spread: 0.05 });
}

export function arrowHit(dist = 0) {
  play('arrow_hit', { gain: 0.5, dist, reach: 34, spread: 0.1 });
}

export function lasso() {
  play('lasso', { gain: 0.4, spread: 0.1 });
}

export function lassoRelease() {
  play('lasso_off', { gain: 0.35, spread: 0.1 });
}

export function hurt() {
  play('hurt', { gain: 0.55, spread: 0.05 });
}

export function die() {
  play('die', { gain: 0.6, spread: 0 });
}

export function respawn() {
  play('respawn', { gain: 0.4 });
}

// ---------------------------------------------------------------------------
// Mobs
// ---------------------------------------------------------------------------

// Bull and tiger borrow the cow and lion recordings at a different pitch; the
// villagers and the guard share the same set of human grunts.
const VOICES = {
  cow: { bank: 'mob_cow', rate: 1 },
  bull: { bank: 'mob_cow', rate: 0.76 },
  zebra: { bank: 'mob_zebra', rate: 1 },
  sheep: { bank: 'mob_sheep', rate: 1 },
  chicken: { bank: 'mob_chicken', rate: 1.05 },
  lion: { bank: 'mob_lion', rate: 1 },
  tiger: { bank: 'mob_lion', rate: 1.18 },
  man: { bank: 'mob_person', rate: 1, person: true },
  woman: { bank: 'mob_person', rate: 1.3, person: true },
  guard: { bank: 'mob_person', rate: 0.95, person: true },
};

// The call a mob makes while it wanders near the player. People keep quiet:
// their only clips are pain grunts, and a villager groaning at nothing would
// read as a bug rather than as life.
export function mobIdle(kind, dist = 0) {
  const v = VOICES[kind];
  if (!v || v.person) return;
  play(v.bank, { gain: 0.5, rate: v.rate, dist, spread: 0.07 });
}

export function mobHurt(kind, dist = 0) {
  const v = VOICES[kind];
  play('hit_mob', { gain: 0.5, dist });
  if (v) play(v.bank, { gain: 0.55, rate: v.rate * 1.12, dist, delay: 0.03, spread: 0.07 });
}

export function mobDie(kind, dist = 0) {
  const v = VOICES[kind];
  play('hit_mob', { gain: 0.5, dist });
  if (v) play(v.bank, { gain: 0.6, rate: v.rate * 0.88, dist, delay: 0.03, spread: 0.05 });
}

// ---------------------------------------------------------------------------
// Items, inventory and UI
// ---------------------------------------------------------------------------

export function pickup() {
  play('pickup', { gain: 0.4, spread: 0.08 });
}

export function dropItem() {
  play('drop_item', { gain: 0.35 });
}

export function eat() {
  play('eat', { gain: 0.5, spread: 0.1 });
}

export function craft() {
  play('craft', { gain: 0.45, spread: 0.06 });
}

export function coins() {
  play('coins', { gain: 0.5 });
}

export function reward() {
  play('reward', { gain: 0.5 });
}

export function denied() {
  play('denied', { gain: 0.4 });
}

export function click() {
  play('click', { gain: 0.28, spread: 0.05 });
}

export function panel(open) {
  play(open ? 'panel_open' : 'panel_close', { gain: 0.35 });
}

export function sleep() {
  play('sleep', { gain: 0.4 });
}

export function teleport() {
  play('teleport', { gain: 0.45 });
}
