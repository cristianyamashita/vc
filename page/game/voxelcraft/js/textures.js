import * as THREE from 'three';
import {
  STICK, COAL, IRON,
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL,
  STONE_PICK, STONE_AXE, STONE_SHOVEL,
  IRON_PICK, IRON_AXE, IRON_SHOVEL,
  isBlock, BLOCKS,
} from './blocks.js';

export const TILE = 16;
export const ATLAS = 256;
const COLS = ATLAS / TILE;

const TILE_INDEX = {
  grass_top: 0,
  grass_side: 1,
  dirt: 2,
  stone: 3,
  cobble: 4,
  sand: 5,
  water: 6,
  log_side: 7,
  log_top: 8,
  leaves: 9,
  planks: 10,
  coal_ore: 11,
  iron_ore: 12,
  table_top: 13,
  table_side: 14,
  torch: 15,
  bedrock: 16,
  cactus: 17,
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function put(data, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function fillNoise(data, rgb, vary, rng) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = (rng() - 0.5) * vary;
      put(data, x, y, clamp(rgb[0] + n, 0, 255), clamp(rgb[1] + n, 0, 255), clamp(rgb[2] + n, 0, 255));
    }
  }
}

function blot(data, rgb, rng, count, rad) {
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rng() * TILE);
    const cy = Math.floor(rng() * TILE);
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad; x <= rad; x++) {
        if (x * x + y * y > rad * rad) continue;
        put(data, cx + x, cy + y, rgb[0], rgb[1], rgb[2]);
      }
    }
  }
}

function drawTile(name) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  const d = img.data;
  const rng = mulberry32(name.split('').reduce((s, c) => s + c.charCodeAt(0) * 17, 1));

  if (name === 'grass_top') {
    fillNoise(d, [70, 160, 55], 28, rng);
  } else if (name === 'grass_side') {
    fillNoise(d, [130, 90, 50], 22, rng);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = (rng() - 0.5) * 20;
        put(d, x, y, clamp(70 + n, 0, 255), clamp(150 + n, 0, 255), clamp(50 + n, 0, 255));
      }
    }
  } else if (name === 'dirt') {
    fillNoise(d, [130, 90, 50], 24, rng);
  } else if (name === 'stone') {
    fillNoise(d, [120, 120, 125], 22, rng);
  } else if (name === 'cobble') {
    fillNoise(d, [110, 110, 115], 18, rng);
    blot(d, [90, 90, 95], rng, 8, 2);
    blot(d, [140, 140, 145], rng, 6, 1);
  } else if (name === 'sand') {
    fillNoise(d, [210, 195, 130], 20, rng);
  } else if (name === 'water') {
    fillNoise(d, [50, 110, 190], 18, rng);
    for (let x = 0; x < TILE; x++) put(d, x, 4, 80, 150, 220, 180);
  } else if (name === 'log_side') {
    fillNoise(d, [110, 75, 40], 16, rng);
    for (let x = 0; x < TILE; x += 4) {
      for (let y = 0; y < TILE; y++) put(d, x, y, 80, 52, 28);
    }
  } else if (name === 'log_top') {
    fillNoise(d, [150, 115, 70], 12, rng);
    for (let i = 2; i < 7; i++) {
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        put(d, Math.round(8 + Math.cos(ang) * i), Math.round(8 + Math.sin(ang) * i), 90, 60, 32);
      }
    }
  } else if (name === 'leaves') {
    fillNoise(d, [45, 130, 40], 30, rng);
    blot(d, [30, 90, 28], rng, 10, 1);
  } else if (name === 'planks') {
    fillNoise(d, [175, 140, 80], 14, rng);
    for (let y = 0; y < TILE; y += 4) {
      for (let x = 0; x < TILE; x++) put(d, x, y, 120, 90, 50);
    }
  } else if (name === 'coal_ore') {
    fillNoise(d, [120, 120, 125], 18, rng);
    blot(d, [30, 30, 32], rng, 7, 2);
  } else if (name === 'iron_ore') {
    fillNoise(d, [120, 120, 125], 18, rng);
    blot(d, [210, 180, 150], rng, 7, 2);
  } else if (name === 'table_top') {
    fillNoise(d, [160, 110, 55], 12, rng);
    for (let i = 1; i < 15; i++) {
      put(d, i, 1, 90, 60, 30);
      put(d, i, 14, 90, 60, 30);
      put(d, 1, i, 90, 60, 30);
      put(d, 14, i, 90, 60, 30);
    }
    put(d, 8, 8, 70, 45, 20);
  } else if (name === 'table_side') {
    fillNoise(d, [140, 95, 45], 14, rng);
    for (let x = 0; x < TILE; x++) put(d, x, 3, 90, 60, 30);
  } else if (name === 'torch') {
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
    for (let y = 4; y < 16; y++) {
      put(d, 7, y, 110, 75, 40);
      put(d, 8, y, 90, 60, 30);
    }
    put(d, 7, 3, 255, 180, 40);
    put(d, 8, 3, 255, 140, 20);
    put(d, 7, 2, 255, 220, 80);
    put(d, 8, 2, 255, 200, 60);
  } else if (name === 'bedrock') {
    fillNoise(d, [50, 50, 55], 20, rng);
    blot(d, [20, 20, 22], rng, 6, 2);
  } else if (name === 'cactus') {
    fillNoise(d, [46, 138, 52], 16, rng);
    for (let x = 0; x < TILE; x += 5) {
      for (let y = 0; y < TILE; y++) put(d, x, y, 28, 92, 36);
    }
    for (let y = 2; y < TILE; y += 4) {
      for (let x = 1; x < TILE; x++) {
        if (x % 5 === 0) continue;
        put(d, x, y, 36, 110, 42);
      }
    }
  } else {
    fillNoise(d, [200, 0, 200], 10, rng);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

function stamp(atlasCtx, name, index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  atlasCtx.drawImage(drawTile(name), col * TILE, row * TILE);
}

function drawItemIcon(kind) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;

  function handle(color) {
    g.fillStyle = color;
    g.fillRect(14, 12, 4, 16);
  }
  function wood() { return '#c48a48'; }
  function stone() { return '#9a9aa2'; }
  function iron() { return '#d8d8e0'; }

  if (kind === 'stick') {
    g.fillStyle = '#c48a48';
    g.fillRect(14, 4, 4, 24);
  } else if (kind === 'coal') {
    g.fillStyle = '#2a2a2e';
    g.beginPath();
    g.moveTo(16, 6);
    g.lineTo(24, 14);
    g.lineTo(20, 26);
    g.lineTo(10, 24);
    g.lineTo(8, 12);
    g.closePath();
    g.fill();
  } else if (kind === 'iron') {
    g.fillStyle = '#d0d4dc';
    g.fillRect(8, 10, 16, 12);
    g.fillStyle = '#a8b0bc';
    g.fillRect(8, 18, 16, 4);
  } else if (kind.startsWith('pick_')) {
    const head = kind.endsWith('wood') ? wood() : kind.endsWith('stone') ? stone() : iron();
    handle('#8a5a2a');
    g.fillStyle = head;
    g.fillRect(6, 6, 20, 6);
    g.fillRect(6, 6, 4, 8);
    g.fillRect(22, 6, 4, 8);
  } else if (kind.startsWith('axe_')) {
    const head = kind.endsWith('wood') ? wood() : kind.endsWith('stone') ? stone() : iron();
    handle('#8a5a2a');
    g.fillStyle = head;
    g.fillRect(8, 4, 14, 10);
    g.fillRect(16, 4, 8, 14);
  } else if (kind.startsWith('shovel_')) {
    const head = kind.endsWith('wood') ? wood() : kind.endsWith('stone') ? stone() : iron();
    handle('#8a5a2a');
    g.fillStyle = head;
    g.fillRect(12, 4, 8, 10);
  }
  return c.toDataURL();
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ATLAS, ATLAS);
  for (const [name, index] of Object.entries(TILE_INDEX)) stamp(ctx, name, index);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const icons = {};
  for (const [name, index] of Object.entries(TILE_INDEX)) {
    icons[name] = drawTile(name).toDataURL();
    icons[`tile:${index}`] = icons[name];
  }
  const itemKinds = [
    'stick', 'coal', 'iron',
    'pick_wood', 'axe_wood', 'shovel_wood',
    'pick_stone', 'axe_stone', 'shovel_stone',
    'pick_iron', 'axe_iron', 'shovel_iron',
  ];
  for (const kind of itemKinds) icons[kind] = drawItemIcon(kind);

  return { texture, canvas, icons };
}

export function tileUV(name) {
  const index = TILE_INDEX[name] ?? 3;
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const inset = 0.5 / ATLAS;
  const u0 = col * TILE / ATLAS + inset;
  const u1 = (col + 1) * TILE / ATLAS - inset;
  const v1 = 1 - (row * TILE / ATLAS + inset);
  const v0 = 1 - ((row + 1) * TILE / ATLAS - inset);
  return { u0, v0, u1, v1 };
}

export function itemIcon(id, atlas) {
  if (!id) return '';
  if (id === STICK) return atlas.icons.stick;
  if (id === COAL) return atlas.icons.coal;
  if (id === IRON) return atlas.icons.iron;
  const tools = {
    [WOOD_PICK]: 'pick_wood', [WOOD_AXE]: 'axe_wood', [WOOD_SHOVEL]: 'shovel_wood',
    [STONE_PICK]: 'pick_stone', [STONE_AXE]: 'axe_stone', [STONE_SHOVEL]: 'shovel_stone',
    [IRON_PICK]: 'pick_iron', [IRON_AXE]: 'axe_iron', [IRON_SHOVEL]: 'shovel_iron',
  };
  if (tools[id]) return atlas.icons[tools[id]];
  if (isBlock(id)) {
    const b = BLOCKS[id];
    const tile = b.tiles.top || b.tiles.all || b.tiles.side;
    return atlas.icons[tile] || '';
  }
  return '';
}
