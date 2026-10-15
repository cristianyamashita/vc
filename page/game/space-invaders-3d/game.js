// Space Invaders 3D — Three.js scene, gameplay, explosion effects and audio.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { I18N } from './i18n.js';

// ----------------------------------------------------------------------------
// Storage, language, theme
// ----------------------------------------------------------------------------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const SAVE_KEY = 'vc.space-invaders-3d.v1';
const $ = (id) => document.getElementById(id);

let lang = store.get('app_lang');
if (!I18N[lang]) lang = 'en';
let theme = store.get('app_theme') === 'light' ? 'light' : 'dark';
const t = (k) => (I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.en[k]);
const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

const saved = (() => { try { return JSON.parse(store.get(SAVE_KEY)) || {}; } catch { return {}; } })();
const prefs = {
  difficulty: ['easy', 'normal', 'hard'].includes(saved.difficulty) ? saved.difficulty : 'normal',
  sound: saved.sound !== false,
  fx: saved.fx !== false,
  hi: Object.assign({ easy: 0, normal: 0, hard: 0 }, saved.hi || {}),
  games: saved.games || 0,
};
function savePrefs() { store.set(SAVE_KEY, JSON.stringify(prefs)); }

const DIFF = {
  easy:   { stepScale: 1.3, fireRate: 0.45, bombSpeed: 8.5, maxBombs: 2 },
  normal: { stepScale: 1.0, fireRate: 0.8,  bombSpeed: 10.5, maxBombs: 3 },
  hard:   { stepScale: 0.8, fireRate: 1.25, bombSpeed: 12.5, maxBombs: 4 },
};

// ----------------------------------------------------------------------------
// Audio (recorded CC0 clips, see audio/CREDITS.md)
// ----------------------------------------------------------------------------
const AUDIO_DIR = new URL('./audio/', import.meta.url);
const BANKS = {
  shoot: ['shoot_1', 'shoot_2'],
  alienShoot: ['alien_shoot_1', 'alien_shoot_2'],
  explosion: ['explosion_1', 'explosion_2', 'explosion_3'],
  big: ['big_explosion_1', 'big_explosion_2'],
  shield: ['shield_hit_1', 'shield_hit_2'],
  playerHit: ['player_hit'],
  ufo: ['ufo_hum'],
  wave: ['wave_clear'],
  click: ['ui_click'],
  ambience: ['ambience'],
};
const sfx = {
  ctx: null, master: null, buffers: new Map(), loading: false, ambience: null,
  init() {
    if (this.ctx || this.loading) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = prefs.sound ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.loading = true;
    const names = new Set(Object.values(BANKS).flat());
    Promise.all([...names].map(async (n) => {
      try {
        const res = await fetch(new URL(`${n}.mp3`, AUDIO_DIR));
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(n, buf);
      } catch { /* a missing clip only mutes that sound */ }
    })).then(() => { this.loading = false; this.startAmbience(); });
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  play(bank, { vol = 1, rate = 1, x = 0 } = {}) {
    if (!this.ctx || !prefs.sound) return;
    const names = BANKS[bank];
    const buf = this.buffers.get(names[Math.floor(Math.random() * names.length)]);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    let node = g;
    if (this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = THREE.MathUtils.clamp(x / FIELD_X, -1, 1) * 0.6;
      g.connect(pan); node = pan;
    }
    src.connect(g); node.connect(this.master);
    src.start();
  },
  startAmbience() {
    if (!this.ctx || this.ambience) return;
    const buf = this.buffers.get('ambience');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0.35;
    src.connect(g); g.connect(this.master); src.start();
    this.ambience = src;
  },
  setEnabled(on) {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  },
};

// ----------------------------------------------------------------------------
// World constants
// ----------------------------------------------------------------------------
const FIELD_X = 13;          // playable half width
const PLAYER_Z = 13;
const BUNKER_Z = 8.6;
const COLS = 11, ROWS = 5;
const COL_GAP = 2.3, ROW_GAP = 2.4;
const STEP_X = 0.45, STEP_Z = 0.9;
const VOX = 0.175;            // invader voxel size

const ALIEN_TYPES = [
  { name: 'squid', score: 30, color: 0xff5fa2, frames: [[
    '   XX   ', '  XXXX  ', ' XXXXXX ', 'XX XX XX', 'XXXXXXXX', '  X  X  ', ' X XX X ', 'X X  X X'], [
    '   XX   ', '  XXXX  ', ' XXXXXX ', 'XX XX XX', 'XXXXXXXX', ' X    X ', 'X      X', ' X    X ']] },
  { name: 'crab', score: 20, color: 0x2ee6c8, frames: [[
    '  X     X  ', '   X   X   ', '  XXXXXXX  ', ' XX XXX XX ', 'XXXXXXXXXXX', 'X XXXXXXX X', 'X X     X X', '   XX XX   '], [
    '  X     X  ', 'X  X   X  X', 'X XXXXXXX X', 'XXX XXX XXX', 'XXXXXXXXXXX', ' XXXXXXXXX ', '  X     X  ', ' X       X ']] },
  { name: 'octopus', score: 10, color: 0xffb347, frames: [[
    '    XXXX    ', ' XXXXXXXXXX ', 'XXXXXXXXXXXX', 'XXX  XX  XXX', 'XXXXXXXXXXXX', '   XX  XX   ', '  XX XX XX  ', 'XX        XX'], [
    '    XXXX    ', ' XXXXXXXXXX ', 'XXXXXXXXXXXX', 'XXX  XX  XXX', 'XXXXXXXXXXXX', '  XXX  XXX  ', ' XX  XX  XX ', '  XX    XX  ']] },
];
const ROW_TYPE = [0, 1, 1, 2, 2];

const PALETTES = {
  dark:  { bg: 0x04060f, fog: 0x04060f, grid1: 0x1d6e63, grid2: 0x0d2a2a, floor: 0x060a14, stars: 1.0, hemi: 0.5, sun: 1.4, ambient: 0.25 },
  light: { bg: 0x7fa9d2, fog: 0x7fa9d2, grid1: 0xd8f3ee, grid2: 0x4f7f9a, floor: 0x4e6f8c, stars: 0.3, hemi: 0.9, sun: 1.8, ambient: 0.5 },
};

// ----------------------------------------------------------------------------
// Renderer / scene
// ----------------------------------------------------------------------------
const canvas = $('scene');
const stage = $('stage');
let renderer, composer, bloomPass;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('fail').hidden = false;
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
const CAM_HOME = new THREE.Vector3(0, 12.5, 27.5);
const CAM_BASE = CAM_HOME.clone();
const CAM_LOOK = new THREE.Vector3(0, 0.5, -5);
camera.position.copy(CAM_BASE);
camera.lookAt(CAM_LOOK);

const renderPass = new RenderPass(scene, camera);
bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.5, 0.62);
composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Lights
const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x1a2630, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.4);
sun.position.set(-18, 26, 10);
scene.add(sun);
const ambient = new THREE.AmbientLight(0x6b7f99, 0.25);
scene.add(ambient);
const playerLight = new THREE.PointLight(0x7df9ff, 1.4, 14, 2);
scene.add(playerLight);

// Floor + grid
const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x060a14, roughness: 0.9, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.7;
scene.add(floor);
const grid = new THREE.GridHelper(140, 70, 0x1d6e63, 0x0d2a2a);
grid.position.y = -0.69;
grid.material.transparent = true;
grid.material.opacity = 0.75;
scene.add(grid);

// Lane markers: subtle glowing edge lines of the playfield
const laneMat = new THREE.MeshBasicMaterial({ color: 0x1fb5a0, transparent: true, opacity: 0.35 });
for (const sx of [-1, 1]) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 48), laneMat);
  lane.position.set(sx * (FIELD_X + 1.6), -0.6, -8);
  scene.add(lane);
}
const baseLine = new THREE.Mesh(new THREE.BoxGeometry((FIELD_X + 1.6) * 2, 0.05, 0.08), new THREE.MeshBasicMaterial({ color: 0xff5f6d, transparent: true, opacity: 0.45 }));
baseLine.position.set(0, -0.6, PLAYER_Z + 1.4);
scene.add(baseLine);

// Stars
const starGeo = new THREE.BufferGeometry();
{
  const n = 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = 180 + Math.random() * 120;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(THREE.MathUtils.randFloatSpread(2));
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.9 - 20;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    c.setHSL(0.55 + Math.random() * 0.15, 0.4, 0.7 + Math.random() * 0.3);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    size[i] = 0.6 + Math.random() * 1.8;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
}
const starMat = new THREE.ShaderMaterial({
  uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } },
  vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; varying float vS; uniform float uTime;
    void main(){ vC = aColor; vS = 0.75 + 0.25 * sin(uTime * (0.6 + aSize) + position.x);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * 2.2; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; varying float vS; uniform float uOpacity;
    void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vS * uOpacity; gl_FragColor = vec4(vC * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// Planet with ring and atmosphere
const planet = new THREE.Group();
let planetAtmo;
{
  const body = new THREE.Mesh(new THREE.SphereGeometry(34, 48, 32), new THREE.MeshStandardMaterial({ color: 0x2b5f8a, roughness: 0.85, metalness: 0.05, emissive: 0x0b1f33, emissiveIntensity: 0.6 }));
  planet.add(body);
  const bands = new THREE.Mesh(new THREE.SphereGeometry(34.05, 48, 32), new THREE.MeshStandardMaterial({ color: 0x7fc6d9, roughness: 1, transparent: true, opacity: 0.22 }));
  bands.scale.set(1, 0.35, 1);
  planet.add(bands);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(36.5, 48, 32), new THREE.MeshBasicMaterial({ color: 0x3aa7ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  planet.add(atmo);
  planetAtmo = atmo;
  const ring = new THREE.Mesh(new THREE.RingGeometry(42, 60, 96), new THREE.MeshBasicMaterial({ color: 0xa9d5ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = Math.PI / 2 - 0.35;
  ring.rotation.z = 0.3;
  planet.add(ring);
  planet.position.set(-70, 22, -170);
}
scene.add(planet);

// Distant nebula glow (a few soft sprites)
const nebula = new THREE.Group();
for (let i = 0; i < 5; i++) {
  const geo = new THREE.SphereGeometry(18 + i * 6, 16, 12);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.72 + i * 0.03, 0.8, 0.5), transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(60 + i * 10, 8 - i * 5, -200 + i * 6);
  nebula.add(m);
}
scene.add(nebula);

scene.fog = new THREE.Fog(0x04060f, 60, 260);

// ----------------------------------------------------------------------------
// Geometry builders
// ----------------------------------------------------------------------------
function voxelGeometry(rows, size) {
  const h = rows.length, w = rows[0].length;
  const parts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] !== 'X') continue;
      const cx = (x - (w - 1) / 2), cy = ((h - 1) / 2 - y);
      const depth = size * (1.2 + 1.3 * (1 - Math.abs(cx) / (w / 2)));
      const g = new THREE.BoxGeometry(size * 0.98, size * 0.98, depth);
      g.translate(cx * size, cy * size, 0);
      parts.push(g);
    }
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingBox();
  return merged;
}
const alienGeos = ALIEN_TYPES.map((tp) => tp.frames.map((f) => voxelGeometry(f, VOX)));
const alienMats = ALIEN_TYPES.map((tp) => new THREE.MeshStandardMaterial({ color: tp.color, emissive: tp.color, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.25 }));

function buildPlayerShip() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xcfe6ef, roughness: 0.35, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e3a4a, roughness: 0.5, metalness: 0.5 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.4 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 6), hull);
  body.rotation.x = -Math.PI / 2; body.scale.y = 1; body.position.set(0, 0.25, -0.1);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.6), dark);
  belly.position.set(0, 0.05, 0.4);
  g.add(belly);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.1), hull);
    wing.position.set(s * 1.1, 0.1, 0.55); wing.rotation.z = s * 0.12; wing.rotation.y = -s * 0.25;
    g.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.9), glow);
    tip.position.set(s * 1.85, 0.12, 0.75); tip.rotation.y = -s * 0.25;
    g.add(tip);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 10), dark);
    engine.rotation.x = Math.PI / 2; engine.position.set(s * 0.45, 0.1, 1.1);
    g.add(engine);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 8), glow);
    flame.rotation.x = Math.PI / 2; flame.position.set(s * 0.45, 0.1, 1.6); flame.name = 'flame';
    g.add(flame);
  }
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3fd9ff, emissive: 0x1a90c0, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 }));
  cockpit.scale.set(1, 0.7, 1.4); cockpit.position.set(0, 0.5, 0.1);
  g.add(cockpit);
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8), glow);
  gun.rotation.x = Math.PI / 2; gun.position.set(0, 0.22, -1.4);
  g.add(gun);
  return g;
}

function buildUfo() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x9b6bff, emissive: 0x4a2fa0, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.5 });
  const disc = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 12), hull);
  disc.scale.set(1, 0.32, 1);
  g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 10, 36), new THREE.MeshStandardMaterial({ color: 0xd9c9ff, emissive: 0xd9c9ff, emissiveIntensity: 0.9 }));
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9f0ff, emissive: 0x6fd8ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 }));
  dome.position.y = 0.3;
  g.add(dome);
  const lightsMat = new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0xfff3a0, emissiveIntensity: 1.6 });
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lightsMat);
    const a = (i / 8) * Math.PI * 2;
    l.position.set(Math.cos(a) * 1.0, -0.2, Math.sin(a) * 1.0);
    g.add(l);
  }
  return g;
}

// ----------------------------------------------------------------------------
// Effects: particles, debris, shockwaves, flashes, camera shake
// ----------------------------------------------------------------------------
class ParticleSystem {
  constructor(count) {
    this.n = count; this.cursor = 0;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.grav = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC;
        void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (420.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ if (vA <= 0.001) discard; float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          float a = pow(1.0 - d * 2.0, 1.6) * vA; gl_FragColor = vec4(vC * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -1000;
  }
  emit(p, { count = 20, speed = 6, spread = 1, color, color2, size = 0.5, life = 0.8, gravity = 4, drag = 0.9, dir = null, up = 0 }) {
    const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 !== undefined ? color2 : color);
    const tmp = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
      let vx = THREE.MathUtils.randFloatSpread(2), vy = THREE.MathUtils.randFloatSpread(2), vz = THREE.MathUtils.randFloatSpread(2);
      const len = Math.hypot(vx, vy, vz) || 1;
      vx /= len; vy /= len; vz /= len;
      if (dir) { vx = vx * spread + dir.x; vy = vy * spread + dir.y; vz = vz * spread + dir.z; }
      const s = speed * (0.35 + Math.random() * 0.65);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.vel[i * 3] = vx * s; this.vel[i * 3 + 1] = vy * s + up; this.vel[i * 3 + 2] = vz * s;
      tmp.copy(c1).lerp(c2, Math.random());
      this.col[i * 3] = tmp.r; this.col[i * 3 + 1] = tmp.g; this.col[i * 3 + 2] = tmp.b;
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.alpha[i] = 1;
      this.age[i] = 0; this.life[i] = life * (0.6 + Math.random() * 0.7);
      this.drag[i] = drag; this.grav[i] = gravity;
    }
  }
  update(dt) {
    const { pos, vel, alpha, age, life } = this;
    for (let i = 0; i < this.n; i++) {
      if (alpha[i] <= 0) continue;
      age[i] += dt;
      if (age[i] >= life[i]) { alpha[i] = 0; pos[i * 3 + 1] = -1000; continue; }
      const k = Math.pow(this.drag[i], dt * 60);
      vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k - this.grav[i] * dt; vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = 1 - age[i] / life[i];
      alpha[i] = f * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

class DebrisSystem {
  constructor(count) {
    this.n = count; this.cursor = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.3 }), count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items = Array.from({ length: count }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 0, age: 0, life: 1 }));
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    for (let i = 0; i < count; i++) { this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, this.color.set(0)); }
  }
  emit(p, { count = 10, speed = 7, size = 0.16, color, color2, life = 1.2, up = 2 }) {
    const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 !== undefined ? color2 : color);
    for (let k = 0; k < count; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
      const it = this.items[i];
      it.alive = true; it.p.copy(p);
      it.v.set(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2)).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      it.v.y += up;
      it.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      it.w.set(THREE.MathUtils.randFloatSpread(14), THREE.MathUtils.randFloatSpread(14), THREE.MathUtils.randFloatSpread(14));
      it.s = size * (0.5 + Math.random()); it.age = 0; it.life = life * (0.6 + Math.random() * 0.8);
      this.mesh.setColorAt(i, this.color.copy(c1).lerp(c2, Math.random()));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      if (!it.alive) continue;
      it.age += dt;
      if (it.age >= it.life) { it.alive = false; d.scale.setScalar(0); d.position.set(0, -1000, 0); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); continue; }
      it.v.y -= 9 * dt; it.v.multiplyScalar(Math.pow(0.985, dt * 60));
      it.p.addScaledVector(it.v, dt);
      if (it.p.y < -0.55) { it.p.y = -0.55; it.v.y = Math.abs(it.v.y) * 0.35; it.v.x *= 0.7; it.v.z *= 0.7; }
      it.r.x += it.w.x * dt; it.r.y += it.w.y * dt; it.r.z += it.w.z * dt;
      const f = 1 - it.age / it.life;
      d.position.copy(it.p); d.rotation.copy(it.r); d.scale.setScalar(it.s * (0.3 + 0.7 * f)); d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class RingPool {
  constructor(count) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.8, 1.0, 56);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.visible = false;
      this.items.push({ m, age: 0, life: 0.5, size: 4, vertical: false });
    }
  }
  addTo(scene) { this.items.forEach((it) => scene.add(it.m)); }
  spawn(p, color, size = 4, life = 0.55, vertical = false) {
    const it = this.items.find((x) => !x.m.visible) || this.items[0];
    it.m.visible = true; it.m.position.copy(p); it.m.material.color.set(color); it.age = 0; it.life = life; it.size = size;
    it.m.rotation.set(vertical ? 0 : -Math.PI / 2, 0, 0);
    it.m.scale.setScalar(0.05);
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.age += dt;
      const f = it.age / it.life;
      if (f >= 1) { it.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - f, 3);
      it.m.scale.setScalar(0.05 + it.size * e);
      it.m.material.opacity = (1 - f) * 0.9;
    }
  }
}

class FlashPool {
  constructor(count) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 26, 2);
      const core = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.visible = false;
      this.items.push({ light, core, age: 0, life: 0.3, power: 1, size: 1 });
    }
  }
  addTo(scene) { this.items.forEach((it) => { scene.add(it.light); scene.add(it.core); }); }
  spawn(p, color, power = 1, size = 1, life = 0.3) {
    const it = this.items.find((x) => !x.core.visible) || this.items[0];
    it.light.position.copy(p); it.light.color.set(color); it.light.intensity = 60 * power;
    it.core.position.copy(p); it.core.material.color.set(color); it.core.visible = true;
    it.age = 0; it.life = life; it.power = power; it.size = size;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.core.visible) continue;
      it.age += dt;
      const f = it.age / it.life;
      if (f >= 1) { it.core.visible = false; it.light.intensity = 0; continue; }
      it.light.intensity = 60 * it.power * (1 - f) * (1 - f);
      it.core.scale.setScalar(it.size * (0.4 + 1.6 * Math.sqrt(f)));
      it.core.material.opacity = (1 - f) * 0.85;
    }
  }
}

const particles = new ParticleSystem(7000);
scene.add(particles.points);
const debris = new DebrisSystem(500);
scene.add(debris.mesh);
const rings = new RingPool(10);
rings.addTo(scene);
const flashes = new FlashPool(4);
flashes.addTo(scene);
let trauma = 0; // camera shake

function explodeAlien(p, color) {
  particles.emit(p, { count: 70, speed: 7, color, color2: 0xffffff, size: 0.45, life: 0.7, gravity: 3, drag: 0.9 });
  particles.emit(p, { count: 24, speed: 2.5, color: 0xffffff, color2: color, size: 0.9, life: 0.35, gravity: 0, drag: 0.85 });
  particles.emit(p, { count: 18, speed: 10, color, size: 0.25, life: 1.1, gravity: 9, drag: 0.97 });
  debris.emit(p, { count: 14, speed: 6, size: 0.17, color, color2: 0xffffff, life: 1.3, up: 3 });
  rings.spawn(p, color, 3.2, 0.5);
  flashes.spawn(p, color, 0.7, 0.9, 0.28);
  trauma = Math.min(1, trauma + 0.15);
}
function explodeBig(p, color, color2 = 0xffffff) {
  particles.emit(p, { count: 220, speed: 11, color, color2: 0xfff2c0, size: 0.6, life: 1.2, gravity: 4, drag: 0.92 });
  particles.emit(p, { count: 80, speed: 3, color: 0xffffff, color2: color, size: 1.4, life: 0.5, gravity: 0, drag: 0.85 });
  particles.emit(p, { count: 60, speed: 16, color: color2, size: 0.28, life: 1.6, gravity: 10, drag: 0.98 });
  debris.emit(p, { count: 40, speed: 9, size: 0.22, color, color2, life: 1.8, up: 5 });
  rings.spawn(p, color, 7, 0.75);
  rings.spawn(p, 0xffffff, 4, 0.45, true);
  flashes.spawn(p, color, 1.6, 1.8, 0.45);
  trauma = Math.min(1, trauma + 0.55);
}
function sparks(p, color, count = 10) {
  particles.emit(p, { count, speed: 4, color, color2: 0xffffff, size: 0.3, life: 0.4, gravity: 6, drag: 0.9 });
}
function shieldChip(p, color) {
  particles.emit(p, { count: 16, speed: 4, color, color2: 0xffffff, size: 0.3, life: 0.5, gravity: 7, drag: 0.92 });
  debris.emit(p, { count: 4, speed: 4, size: 0.14, color, life: 1.0, up: 2.5 });
}

// ----------------------------------------------------------------------------
// Game objects
// ----------------------------------------------------------------------------
const player = buildPlayerShip();
player.position.set(0, 0, PLAYER_Z);
scene.add(player);
const flames = player.children.filter((c) => c.name === 'flame');

const shotGeo = new THREE.CapsuleGeometry(0.09, 1.1, 4, 8);
shotGeo.rotateX(Math.PI / 2);
const shotMat = new THREE.MeshBasicMaterial({ color: 0x9dfbff });
const bombGeo = new THREE.OctahedronGeometry(0.28, 0);
bombGeo.scale(1, 1, 1.6);
const bombMat = new THREE.MeshBasicMaterial({ color: 0xff7a45 });

const bunkerMat = new THREE.MeshStandardMaterial({ color: 0x1fb5a0, emissive: 0x0f6a5d, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.92 });
const BUNKER_SHAPE = [
  ' XXXXX ',
  'XXXXXXX',
  'XXXXXXX',
  'XXXXXXX',
  'XX   XX',
];
const BLOCK = 0.42;

const ufo = buildUfo();
ufo.visible = false;
scene.add(ufo);

const G = {
  state: 'ready', // ready | playing | paused | dying | wave | over
  score: 0, lives: 3, wave: 1, nextLifeAt: 5000,
  aliens: [], shots: [], bombs: [], blocks: [],
  dir: 1, stepTimer: 0, frame: 0, formZ: 0,
  fireTimer: 0, ufoTimer: 20, ufoDir: 1, ufoScore: 0,
  shotCooldown: 0, timer: 0, pendingResume: false,
  overReason: '',
};
const input = { left: false, right: false, fire: false, pointerX: null, firePulse: false };

function clearField() {
  for (const a of G.aliens) scene.remove(a.mesh);
  for (const s of G.shots) scene.remove(s.mesh);
  for (const b of G.bombs) scene.remove(b.mesh);
  for (const b of G.blocks) scene.remove(b.mesh);
  G.aliens = []; G.shots = []; G.bombs = []; G.blocks = [];
  ufo.visible = false; G.ufoTimer = 18 + Math.random() * 10;
}

function spawnFleet() {
  const startZ = -15.5 + Math.min(5, (G.wave - 1) * 0.9);
  G.formZ = startZ;
  for (let r = 0; r < ROWS; r++) {
    const type = ROW_TYPE[r];
    for (let c = 0; c < COLS; c++) {
      const mesh = new THREE.Mesh(alienGeos[type][0], alienMats[type]);
      const x = (c - (COLS - 1) / 2) * COL_GAP;
      const z = startZ + r * ROW_GAP;
      mesh.position.set(x, 0.75, z);
      scene.add(mesh);
      G.aliens.push({ mesh, type, row: r, col: c, alive: true, x, z, punch: 0, phase: Math.random() * 6.28 });
    }
  }
  G.dir = 1; G.stepTimer = 0; G.frame = 0;
}

function spawnBunkers() {
  const xs = [-9.4, -3.1, 3.1, 9.4];
  for (const bx of xs) {
    for (let r = 0; r < BUNKER_SHAPE.length; r++) {
      for (let c = 0; c < BUNKER_SHAPE[r].length; c++) {
        if (BUNKER_SHAPE[r][c] !== 'X') continue;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(BLOCK * 0.94, BLOCK * 0.94, BLOCK * 0.94), bunkerMat);
        const x = bx + (c - 3) * BLOCK;
        const y = (BUNKER_SHAPE.length - 1 - r) * BLOCK + 0.2;
        mesh.position.set(x, y, BUNKER_Z);
        scene.add(mesh);
        G.blocks.push({ mesh, x, y, z: BUNKER_Z, alive: true });
      }
    }
  }
}

function startGame() {
  clearField();
  G.score = 0; G.lives = 3; G.wave = 1; G.nextLifeAt = 5000; G.overReason = '';
  prefs.games++; savePrefs();
  spawnFleet(); spawnBunkers();
  player.visible = true; player.position.x = 0;
  G.shotCooldown = 0; G.fireTimer = 1.5;
  G.state = 'playing';
  hideCard();
  banner(fmt(t('waveBanner'), { n: 1 }));
  setStatus(fmt(t('statusPlay'), { n: COLS * ROWS }));
  updateHud();
}

function nextWave() {
  G.wave++;
  for (const s of G.shots) scene.remove(s.mesh);
  for (const b of G.bombs) scene.remove(b.mesh);
  G.shots = []; G.bombs = [];
  for (const a of G.aliens) scene.remove(a.mesh);
  G.aliens = [];
  // Rebuild destroyed bunkers partially on each wave
  for (const b of G.blocks) scene.remove(b.mesh);
  G.blocks = [];
  spawnBunkers();
  spawnFleet();
  G.fireTimer = 1.8;
  G.state = 'playing';
  sfx.play('wave', { vol: 0.8 });
  banner(fmt(t('waveBanner'), { n: G.wave }));
  setStatus(fmt(t('statusPlay'), { n: COLS * ROWS }));
  updateHud();
}

function gameOver(reason) {
  G.state = 'over';
  G.overReason = reason;
  const d = prefs.difficulty;
  const record = G.score > prefs.hi[d];
  if (record) { prefs.hi[d] = G.score; savePrefs(); }
  updateHud();
  showCard({
    cls: 'over', title: t('gameOver'),
    line1: reason === 'invaded' ? t('invaded') : `${t('finalScore')}: <b>${G.score}</b>`,
    line2: reason === 'invaded' ? `${t('finalScore')}: <b>${G.score}</b> · ${t('bestScore')}: <b>${prefs.hi[d]}</b>` : `${t('bestScore')}: <b>${prefs.hi[d]}</b>`,
    record: record && G.score > 0,
    primary: t('playAgain'), onPrimary: startGame,
  });
  setStatus(t('statusOver'));
}

// ----------------------------------------------------------------------------
// Gameplay update
// ----------------------------------------------------------------------------
const diff = () => DIFF[prefs.difficulty];
const aliveAliens = () => G.aliens.filter((a) => a.alive);
const tmpV = new THREE.Vector3();

function fireShot() {
  if (G.shotCooldown > 0 || G.shots.length >= 2) return;
  const mesh = new THREE.Mesh(shotGeo, shotMat);
  mesh.position.set(player.position.x, 0.25, PLAYER_Z - 2.0);
  scene.add(mesh);
  G.shots.push({ mesh, speed: 34 });
  G.shotCooldown = 0.22;
  sfx.play('shoot', { vol: 0.5, rate: 0.95 + Math.random() * 0.1, x: player.position.x });
  particles.emit(mesh.position, { count: 6, speed: 1.5, color: 0x9dfbff, size: 0.35, life: 0.2, gravity: 0, drag: 0.8 });
}

function alienFire() {
  const alive = aliveAliens();
  if (!alive.length || G.bombs.length >= diff().maxBombs) return;
  const cols = new Map();
  for (const a of alive) { const cur = cols.get(a.col); if (!cur || a.row > cur.row) cols.set(a.col, a); }
  const shooters = [...cols.values()];
  // Prefer shooters near the player a bit
  shooters.sort((a, b) => Math.abs(a.x - player.position.x) - Math.abs(b.x - player.position.x));
  const a = Math.random() < 0.45 ? shooters[0] : shooters[Math.floor(Math.random() * shooters.length)];
  const mesh = new THREE.Mesh(bombGeo, bombMat);
  mesh.position.set(a.x, 0.5, a.z + 0.9);
  scene.add(mesh);
  G.bombs.push({ mesh, speed: diff().bombSpeed * (1 + 0.05 * (G.wave - 1)), spin: Math.random() * 6 });
  sfx.play('alienShoot', { vol: 0.35, x: a.x });
}

function stepFleet() {
  const alive = aliveAliens();
  if (!alive.length) return;
  let minX = Infinity, maxX = -Infinity;
  for (const a of alive) { minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x); }
  const limit = FIELD_X - 0.4;
  let advance = false;
  if ((G.dir > 0 && maxX + STEP_X > limit) || (G.dir < 0 && minX - STEP_X < -limit)) { G.dir = -G.dir; advance = true; }
  G.frame ^= 1;
  for (const a of alive) {
    if (advance) a.z += STEP_Z; else a.x += G.dir * STEP_X;
    a.mesh.position.x = a.x; a.mesh.position.z = a.z;
    a.mesh.geometry = alienGeos[a.type][G.frame];
    a.punch = 1;
    // Fleet crushes shields it reaches
    if (a.z > BUNKER_Z - 2.2) {
      for (const b of G.blocks) {
        if (b.alive && Math.abs(b.x - a.x) < 1.1 && Math.abs(b.z - a.z) < 1.2) { killBlock(b, false); }
      }
    }
    if (a.z >= PLAYER_Z - 1.2) { gameOver('invaded'); return; }
  }
  if (advance) G.formZ += STEP_Z;
}

function killBlock(b, fx = true) {
  b.alive = false; scene.remove(b.mesh);
  if (fx) shieldChip(b.mesh.position, 0x2ee6c8);
}

function hitAlien(a, by) {
  a.alive = false; scene.remove(a.mesh);
  const tp = ALIEN_TYPES[a.type];
  explodeAlien(a.mesh.position, tp.color);
  sfx.play('explosion', { vol: 0.55, rate: 0.9 + Math.random() * 0.25, x: a.x });
  addScore(tp.score, a.mesh.position, tp.color);
  if (by) scene.remove(by.mesh);
  // Speed burst feedback
  const left = aliveAliens().length;
  setStatus(fmt(t('statusPlay'), { n: left }));
  if (left === 0) {
    G.state = 'wave';
    G.timer = 2.2;
    banner(t('waveClear'));
    sfx.play('wave', { vol: 0.7, rate: 1.15 });
    addScore(100 * G.wave, player.position.clone().setY(1.6), 0xffffff);
  }
}

function addScore(n, worldPos, color) {
  G.score += n;
  if (worldPos) popup(`+${n}`, worldPos, color);
  if (G.score >= G.nextLifeAt) {
    G.nextLifeAt += 5000;
    if (G.lives < 5) { G.lives++; banner(t('extraLife')); sfx.play('wave', { vol: 0.8 }); }
  }
  updateHud(true);
}

function killPlayer() {
  G.state = 'dying'; G.timer = 1.9;
  G.lives--;
  explodeBig(player.position.clone().setY(0.4), 0x7df9ff, 0xffffff);
  sfx.play('big', { vol: 0.9 });
  sfx.play('playerHit', { vol: 0.6 });
  player.visible = false;
  for (const b of G.bombs) scene.remove(b.mesh);
  G.bombs = [];
  $('vignette').classList.add('on');
  setTimeout(() => $('vignette').classList.remove('on'), 140);
  updateHud(true);
}

function spawnUfo() {
  G.ufoDir = Math.random() < 0.5 ? 1 : -1;
  ufo.position.set(-G.ufoDir * (FIELD_X + 6), 2.6, Math.max(-24, G.formZ - 4.5));
  ufo.visible = true;
  G.ufoScore = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
  sfx.play('ufo', { vol: 0.5, x: ufo.position.x });
  G.ufoHumTimer = 0;
}

function updatePlaying(dt) {
  const d = diff();
  // Player movement
  const speed = 16;
  let vx = 0;
  if (input.left) vx -= 1;
  if (input.right) vx += 1;
  if (vx !== 0) {
    player.position.x = THREE.MathUtils.clamp(player.position.x + vx * speed * dt, -FIELD_X, FIELD_X);
    input.pointerX = null;
  } else if (input.pointerX !== null) {
    const target = THREE.MathUtils.clamp(input.pointerX, -FIELD_X, FIELD_X);
    const delta = target - player.position.x;
    const maxMove = speed * 1.4 * dt;
    player.position.x += THREE.MathUtils.clamp(delta, -maxMove, maxMove);
    vx = Math.sign(delta) * Math.min(1, Math.abs(delta) / 1.5);
  }
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -vx * 0.35, 1 - Math.pow(0.001, dt));
  player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, -vx * 0.12, 1 - Math.pow(0.001, dt));
  player.position.y = Math.sin(performance.now() * 0.003) * 0.06;
  for (const f of flames) f.scale.y = 0.8 + Math.random() * 0.5 + Math.abs(vx) * 0.5;

  G.shotCooldown = Math.max(0, G.shotCooldown - dt);
  if (input.fire || input.firePulse) { fireShot(); input.firePulse = false; }

  // Shots
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i];
    s.mesh.position.z -= s.speed * dt;
    const sp = s.mesh.position;
    let hit = false;
    if (sp.z < -32) hit = true;
    if (!hit) {
      for (const a of G.aliens) {
        if (!a.alive) continue;
        if (Math.abs(a.x - sp.x) < 0.95 && Math.abs(a.z - sp.z) < 0.75) { hitAlien(a, s); hit = true; if (G.state !== 'playing') return; break; }
      }
    }
    if (!hit && ufo.visible && Math.abs(ufo.position.x - sp.x) < 1.5 && Math.abs(ufo.position.z - sp.z) < 1.2) {
      ufo.visible = false;
      explodeBig(ufo.position, 0x9b6bff, 0xfff3a0);
      sfx.play('big', { vol: 0.8, rate: 1.1, x: ufo.position.x });
      addScore(G.ufoScore, ufo.position, 0xd9c9ff);
      G.ufoTimer = 20 + Math.random() * 12;
      scene.remove(s.mesh); hit = true;
    }
    if (!hit) {
      for (const b of G.blocks) {
        if (b.alive && Math.abs(b.x - sp.x) < BLOCK * 0.55 && Math.abs(b.z - sp.z) < 0.7 && sp.y < b.y + BLOCK * 0.6) {
          killBlock(b); sfx.play('shield', { vol: 0.35, x: b.x }); scene.remove(s.mesh); hit = true; break;
        }
      }
    }
    if (!hit) {
      for (let j = G.bombs.length - 1; j >= 0; j--) {
        const b = G.bombs[j];
        if (Math.abs(b.mesh.position.x - sp.x) < 0.45 && Math.abs(b.mesh.position.z - sp.z) < 0.9) {
          sparks(b.mesh.position, 0xffb347, 24); rings.spawn(b.mesh.position, 0xffb347, 1.5, 0.3);
          sfx.play('shield', { vol: 0.3, rate: 1.3, x: sp.x });
          scene.remove(b.mesh); G.bombs.splice(j, 1);
          scene.remove(s.mesh); hit = true; addScore(5, null); break;
        }
      }
    }
    if (hit) { if (s.mesh.parent) scene.remove(s.mesh); G.shots.splice(i, 1); }
  }

  // Fleet march
  const alive = aliveAliens().length;
  const frac = alive / (COLS * ROWS);
  const waveScale = Math.max(0.55, 1 - 0.07 * (G.wave - 1));
  const interval = (0.035 + 0.62 * Math.pow(frac, 1.35)) * d.stepScale * waveScale;
  G.stepTimer += dt;
  if (G.stepTimer >= interval) { G.stepTimer -= interval; stepFleet(); if (G.state !== 'playing') return; }
  const now = performance.now() * 0.001;
  for (const a of G.aliens) {
    if (!a.alive) continue;
    a.punch = Math.max(0, a.punch - dt * 7);
    const s = 1 + a.punch * 0.18;
    a.mesh.scale.set(s, 1 / s * 1, s);
    a.mesh.position.y = 0.75 + Math.sin(now * 2 + a.phase) * 0.06 + a.punch * 0.12;
  }

  // Alien fire
  G.fireTimer -= dt;
  if (G.fireTimer <= 0) {
    alienFire();
    const rate = d.fireRate * (1 + 0.12 * (G.wave - 1)) * (0.6 + 0.4 * (1 - frac));
    G.fireTimer = (0.6 + Math.random() * 0.9) / rate;
  }

  // Bombs
  for (let i = G.bombs.length - 1; i >= 0; i--) {
    const b = G.bombs[i];
    b.mesh.position.z += b.speed * dt;
    b.mesh.rotation.z += dt * 9; b.mesh.rotation.x += dt * 4;
    b.mesh.position.x += Math.sin(performance.now() * 0.012 + b.spin) * dt * 1.4;
    const bp = b.mesh.position;
    let gone = false;
    if (bp.z > PLAYER_Z + 2.5) gone = true;
    if (!gone) {
      for (const bl of G.blocks) {
        if (bl.alive && Math.abs(bl.x - bp.x) < BLOCK * 0.6 && Math.abs(bl.z - bp.z) < 0.6) {
          killBlock(bl); sfx.play('shield', { vol: 0.4, x: bl.x });
          // bombs chip a second block occasionally
          const nb = G.blocks.find((o) => o.alive && Math.abs(o.x - bl.x) < BLOCK * 1.1 && Math.abs(o.y - bl.y) < BLOCK * 1.1 && o !== bl);
          if (nb && Math.random() < 0.5) killBlock(nb);
          gone = true; break;
        }
      }
    }
    if (!gone && Math.abs(bp.x - player.position.x) < 1.3 && Math.abs(bp.z - PLAYER_Z) < 1.3) {
      scene.remove(b.mesh); G.bombs.splice(i, 1);
      killPlayer();
      return;
    }
    if (gone) { scene.remove(b.mesh); G.bombs.splice(i, 1); }
  }

  // UFO
  if (ufo.visible) {
    ufo.position.x += G.ufoDir * 7.5 * dt;
    ufo.rotation.y += dt * 2.5;
    ufo.position.y = 2.6 + Math.sin(performance.now() * 0.004) * 0.25;
    G.ufoHumTimer += dt;
    if (G.ufoHumTimer > 0.85) { G.ufoHumTimer = 0; sfx.play('ufo', { vol: 0.35, x: ufo.position.x }); }
    if (Math.abs(ufo.position.x) > FIELD_X + 7) { ufo.visible = false; G.ufoTimer = 18 + Math.random() * 12; }
  } else if (alive >= 8) {
    G.ufoTimer -= dt;
    if (G.ufoTimer <= 0) spawnUfo();
  }
}

// ----------------------------------------------------------------------------
// HUD, cards, banners
// ----------------------------------------------------------------------------
function updateHud(pulseScore = false) {
  $('score').textContent = G.score;
  $('hi').textContent = Math.max(prefs.hi[prefs.difficulty], G.state === 'over' ? 0 : G.score);
  $('wave').textContent = G.wave;
  $('lives').textContent = G.lives;
  if (pulseScore) { const c = document.querySelector('.chip.score'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
}
function setStatus(html) { $('status').innerHTML = html; }
function banner(text) {
  const el = $('banner');
  el.classList.remove('show'); void el.offsetWidth;
  el.textContent = text; el.classList.add('show');
}
function popup(text, worldPos, color) {
  tmpV.copy(worldPos).project(camera);
  const w = stage.clientWidth, h = stage.clientHeight;
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.left = `${(tmpV.x * 0.5 + 0.5) * w}px`;
  el.style.top = `${(-tmpV.y * 0.5 + 0.5) * h}px`;
  el.style.color = `#${new THREE.Color(color).getHexString()}`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
let cardActions = { primary: null, secondary: null };
function showCard({ cls = '', title, line1 = '', line2 = '', record = false, primary, onPrimary, secondary, onSecondary }) {
  const card = $('card');
  card.className = `card ${cls}`;
  $('card-title').textContent = title;
  $('card-line1').innerHTML = line1; $('card-line1').hidden = !line1;
  $('card-line2').innerHTML = line2; $('card-line2').hidden = !line2;
  $('card-record').hidden = !record; $('card-record').textContent = t('newRecord');
  $('card-primary').textContent = primary;
  $('card-secondary').hidden = !secondary;
  if (secondary) $('card-secondary').textContent = secondary;
  cardActions = { primary: onPrimary, secondary: onSecondary };
  $('overlay').hidden = false;
}
function hideCard() { $('overlay').hidden = true; }
$('card-primary').addEventListener('click', () => { sfx.init(); sfx.resume(); sfx.play('click', { vol: 0.4 }); cardActions.primary && cardActions.primary(); });
$('card-secondary').addEventListener('click', () => { sfx.play('click', { vol: 0.4 }); cardActions.secondary && cardActions.secondary(); });

function showStart() {
  G.state = 'ready';
  showCard({
    title: t('startTitle'), line1: t('startLine'), line2: t('startHint'),
    primary: t('start'), onPrimary: startGame,
  });
  setStatus(t('statusReady'));
  updateHud();
}
function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  showCard({ title: t('paused'), line1: `${t('finalScore')}: <b>${G.score}</b> · ${t('wave')} <b>${G.wave}</b>`, primary: t('resume'), onPrimary: resumeGame, secondary: t('restart'), onSecondary: startGame });
  setStatus(t('statusPaused'));
}
function resumeGame() {
  if (G.state !== 'paused') return;
  G.state = 'playing'; hideCard();
  setStatus(fmt(t('statusPlay'), { n: aliveAliens().length }));
}
function togglePause() { if (G.state === 'playing') pauseGame(); else if (G.state === 'paused') resumeGame(); }

// ----------------------------------------------------------------------------
// Language & theme
// ----------------------------------------------------------------------------
function renderHelp() {
  const li = (arr) => arr.map((s) => `<li>${s}</li>`).join('');
  $('help-title').textContent = t('title');
  $('help-body').innerHTML = `
    <p>${t('helpIntro')}</p>
    <h3>${t('helpControlsTitle')}</h3><ul>${li(t('helpControls'))}</ul>
    <h3>${t('helpScoringTitle')}</h3>
    <table>${t('helpScoring').map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
    <h3>${t('helpRulesTitle')}</h3><ul>${li(t('helpRules'))}</ul>
    <h3>${t('helpTipsTitle')}</h3><ul>${li(t('helpTips'))}</ul>
    <h3>${t('bestScore')}</h3>
    <table><tr><td>${t('easy')}</td><td>${prefs.hi.easy}</td></tr><tr><td>${t('normal')}</td><td>${prefs.hi.normal}</td></tr><tr><td>${t('hard')}</td><td>${prefs.hi.hard}</td></tr></table>
    <p style="margin-top:12px;color:var(--muted);font-size:12px">${t('helpCredits')}</p>`;
}
function applyLang() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
  $('lang-switcher').value = lang;
  renderHelp();
  if (G.state === 'ready') showStart();
  else if (G.state === 'paused') pauseGame();
  else if (G.state === 'over') gameOver(G.overReason);
  else setStatus(fmt(t('statusPlay'), { n: aliveAliens().length }));
}
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $('theme-switcher').querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  const pal = PALETTES[theme];
  scene.background = new THREE.Color(pal.bg);
  scene.fog.color.set(pal.fog);
  stage.style.background = `#${new THREE.Color(pal.bg).getHexString()}`;
  floor.material.color.set(pal.floor);
  grid.material.color.set(pal.grid1);
  if (grid.geometry.attributes.color) {
    const c1 = new THREE.Color(pal.grid1), c2 = new THREE.Color(pal.grid2);
    const arr = grid.geometry.attributes.color.array;
    for (let i = 0; i < arr.length; i += 3) {
      // center lines are the first and the (count/2)th segment in GridHelper: approximate by brightness compare
      const isMain = (i / 12) === 35 || (i / 12) === 105;
      const c = isMain ? c1 : c2;
      arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b;
    }
    grid.geometry.attributes.color.needsUpdate = true;
  }
  starMat.uniforms.uOpacity.value = pal.stars;
  hemi.intensity = pal.hemi; sun.intensity = pal.sun; ambient.intensity = pal.ambient;
  bloomPass.strength = theme === 'dark' ? 0.85 : 0.5;
  bloomPass.threshold = theme === 'dark' ? 0.62 : 0.9;
  renderer.toneMappingExposure = theme === 'dark' ? 1.05 : 0.95;
  nebula.visible = theme === 'dark';
  planetAtmo.material.opacity = theme === 'dark' ? 0.16 : 0.05;
  grid.material.opacity = theme === 'dark' ? 0.75 : 0.5;
}
function applySound() {
  $('sound-btn').setAttribute('aria-pressed', String(prefs.sound));
  $('sound-btn').querySelector('i').className = prefs.sound ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  sfx.setEnabled(prefs.sound);
}
function applyFx() { $('fx-btn').setAttribute('aria-pressed', String(prefs.fx)); }

// ----------------------------------------------------------------------------
// Input
// ----------------------------------------------------------------------------
function userGesture() { sfx.init(); sfx.resume(); }
$('diff-select').value = prefs.difficulty;
$('diff-select').addEventListener('change', (e) => {
  prefs.difficulty = e.target.value; savePrefs(); updateHud(); renderHelp();
  if (G.state === 'playing' || G.state === 'paused' || G.state === 'dying' || G.state === 'wave') startGame();
});
$('new-btn').addEventListener('click', () => { userGesture(); sfx.play('click', { vol: 0.4 }); startGame(); });
$('pause-btn').addEventListener('click', () => { userGesture(); togglePause(); });
$('sound-btn').addEventListener('click', () => { userGesture(); prefs.sound = !prefs.sound; savePrefs(); applySound(); if (prefs.sound) sfx.play('click', { vol: 0.4 }); });
$('fx-btn').addEventListener('click', () => { prefs.fx = !prefs.fx; savePrefs(); applyFx(); });
$('lang-switcher').addEventListener('change', (e) => { lang = I18N[e.target.value] ? e.target.value : 'en'; store.set('app_lang', lang); applyLang(); });
$('theme-switcher').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.set('app_theme', theme); applyTheme(); });
$('help-btn').addEventListener('click', openHelp);
$('help-close').addEventListener('click', () => $('help').close());
function openHelp() {
  renderHelp();
  if (G.state === 'playing') { pauseGame(); G.pendingResume = true; }
  $('help').showModal();
}
$('help').addEventListener('close', () => { if (G.pendingResume) { G.pendingResume = false; resumeGame(); } });

const keyState = (e, down) => {
  switch (e.code) {
    case 'ArrowLeft': case 'KeyA': input.left = down; return true;
    case 'ArrowRight': case 'KeyD': input.right = down; return true;
    case 'Space': case 'ArrowUp': case 'KeyW': input.fire = down; if (down) input.firePulse = true; return true;
  }
  return false;
};
document.addEventListener('keydown', (e) => {
  if ($('help').open) { if (e.key === '?' || e.key === 'Escape') { e.preventDefault(); $('help').close(); } return; }
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && e.key !== '?' && e.code !== 'Space') { if (e.code !== 'Space') return; }
  if (e.key === '?') { e.preventDefault(); openHelp(); return; }
  if (e.repeat && !keyState(e, true)) return;
  userGesture();
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
  if (e.code === 'KeyR') { e.preventDefault(); startGame(); return; }
  if (e.code === 'KeyM') { e.preventDefault(); prefs.sound = !prefs.sound; savePrefs(); applySound(); return; }
  if (keyState(e, true)) {
    e.preventDefault();
    if (G.state === 'ready' && e.code === 'Space') startGame();
    else if (G.state === 'paused' && e.code === 'Space') resumeGame();
    else if (G.state === 'over' && e.code === 'Space') startGame();
  }
});
document.addEventListener('keyup', (e) => { keyState(e, false); });
window.addEventListener('blur', () => { input.left = input.right = input.fire = false; if (G.state === 'playing') pauseGame(); });

// Pointer: ship follows the pointer x on the player plane; click/tap fires
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
function pointerToFieldX(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.ray.intersectPlane(plane, tmpV);
  if (!hit) return null;
  // Scale by depth so that pointing anywhere on screen maps comfortably to the player lane
  return hit.x * (PLAYER_Z - camera.position.z) / (hit.z - camera.position.z);
}
let dragging = false, dragMoved = false;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && !dragging) return;
  const x = pointerToFieldX(e);
  if (x === null) return;
  if (e.pointerType === 'touch') { if (Math.abs(x - (input.pointerX ?? x)) > 0.2) dragMoved = true; }
  input.pointerX = x;
});
canvas.addEventListener('pointerdown', (e) => {
  userGesture();
  if (e.button !== 0) return;
  if (e.pointerType === 'touch') { dragging = true; dragMoved = false; const x = pointerToFieldX(e); if (x !== null) input.pointerX = x; canvas.setPointerCapture(e.pointerId); return; }
  if (G.state === 'ready' || G.state === 'over') { startGame(); return; }
  if (G.state === 'paused') { resumeGame(); return; }
  input.fire = true; input.firePulse = true;
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') {
    dragging = false;
    if (!dragMoved) {
      if (G.state === 'ready' || G.state === 'over') startGame();
      else if (G.state === 'paused') resumeGame();
      else input.firePulse = true;
    }
    return;
  }
  input.fire = false;
});
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') input.fire = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Touch buttons
const hold = (id, on, off) => {
  const el = $(id);
  const start = (e) => { e.preventDefault(); userGesture(); on(); };
  const end = (e) => { e.preventDefault(); off(); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
};
hold('touch-left', () => { input.left = true; }, () => { input.left = false; });
hold('touch-right', () => { input.right = true; }, () => { input.right = false; });
hold('touch-fire', () => {
  if (G.state === 'ready' || G.state === 'over') { startGame(); return; }
  if (G.state === 'paused') { resumeGame(); return; }
  input.fire = true; input.firePulse = true;
}, () => { input.fire = false; });

// ----------------------------------------------------------------------------
// Resize & main loop
// ----------------------------------------------------------------------------
function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // Widen the view on narrow screens so the whole field stays visible
  camera.fov = THREE.MathUtils.clamp(50 * Math.max(1, 1.45 / camera.aspect), 50, 66);
  // Portrait screens: pull the camera back so the whole field stays in view
  const k = THREE.MathUtils.clamp(1.35 / camera.aspect, 1, 2.4);
  CAM_BASE.set(CAM_HOME.x, CAM_HOME.y * (0.8 + 0.2 * k), CAM_HOME.z * k);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

let last = performance.now();
const shakeV = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const tsec = now * 0.001;

  if (G.state === 'playing') updatePlaying(dt);
  else if (G.state === 'dying') {
    G.timer -= dt;
    if (G.timer <= 0) {
      if (G.lives <= 0) gameOver('dead');
      else {
        player.visible = true; player.position.x = 0;
        G.state = 'playing'; G.fireTimer = 1.6;
        banner(t('ready'));
        rings.spawn(player.position.clone().setY(0.2), 0x7df9ff, 3, 0.6);
        sparks(player.position.clone().setY(0.4), 0x7df9ff, 30);
      }
    }
  } else if (G.state === 'wave') {
    G.timer -= dt;
    // keep stray shots moving for feel
    for (let i = G.shots.length - 1; i >= 0; i--) { const s = G.shots[i]; s.mesh.position.z -= s.speed * dt; if (s.mesh.position.z < -32) { scene.remove(s.mesh); G.shots.splice(i, 1); } }
    if (G.timer <= 0) nextWave();
  } else if (G.state === 'ready' || G.state === 'over') {
    player.position.y = Math.sin(tsec * 3) * 0.06;
    for (const f of flames) f.scale.y = 0.8 + Math.random() * 0.4;
  }

  // Idle animation for fleet when not playing (slow hover)
  if (G.state !== 'playing') {
    for (const a of G.aliens) if (a.alive) a.mesh.position.y = 0.75 + Math.sin(tsec * 2 + a.phase) * 0.06;
  }

  // Effects
  particles.update(dt);
  debris.update(dt);
  rings.update(dt);
  flashes.update(dt);
  stars.rotation.y += dt * 0.004;
  starMat.uniforms.uTime.value = tsec;
  planet.rotation.y += dt * 0.02;
  playerLight.position.set(player.position.x, 1.2, PLAYER_Z + 0.6);
  playerLight.intensity = player.visible ? 1.4 : 0;

  // Camera: gentle follow + shake
  trauma = Math.max(0, trauma - dt * 1.6);
  const sh = trauma * trauma;
  shakeV.set(Math.sin(tsec * 97) * 0.6, Math.sin(tsec * 113 + 1) * 0.45, Math.sin(tsec * 89 + 2) * 0.3).multiplyScalar(sh);
  camera.position.set(CAM_BASE.x + player.position.x * 0.12 + shakeV.x, CAM_BASE.y + shakeV.y, CAM_BASE.z + shakeV.z);
  camera.lookAt(CAM_LOOK.x + player.position.x * 0.08, CAM_LOOK.y, CAM_LOOK.z);
  camera.rotation.z += Math.sin(tsec * 71) * 0.01 * sh;

  if (prefs.fx) composer.render(); else renderer.render(scene, camera);
}

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------
applyTheme();
applySound();
applyFx();
spawnFleet();
spawnBunkers();
applyLang();
requestAnimationFrame(frame);
