import * as THREE from 'three';
import { ITEMS, isBlock, BLOCKS } from './blocks.js';

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
  flower_red: 18,
  flower_yellow: 19,
  flower_white: 20,
  fruit: 21,
  rug_cow: 22,
  rug_zebra: 23,
  rug_sheep: 24,
  furnace_top: 25,
  furnace_side: 26,
  door_lower: 27,
  door_upper: 28,
  ladder: 29,
  glass: 30,
  spring_top: 31,
  spring_side: 32,
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
    put(d, 6, 3, 255, 160, 30);
    put(d, 7, 3, 255, 200, 50);
    put(d, 8, 3, 255, 170, 30);
    put(d, 9, 3, 255, 140, 20);
    put(d, 7, 2, 255, 230, 90);
    put(d, 8, 2, 255, 220, 70);
    put(d, 7, 1, 255, 255, 180);
    put(d, 8, 1, 255, 240, 120);
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
  } else if (name.startsWith('flower_')) {
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
    const petal = name === 'flower_red' ? [210, 45, 55] : name === 'flower_yellow' ? [230, 190, 40] : [240, 240, 245];
    const dark = name === 'flower_red' ? [150, 20, 30] : name === 'flower_yellow' ? [180, 140, 20] : [200, 200, 210];
    for (let y = 6; y < 16; y++) {
      put(d, 7, y, 40, 120, 48);
      put(d, 8, y, 32, 100, 40);
    }
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const cx = Math.round(8 + Math.cos(ang) * 3.2);
      const cy = Math.round(5 + Math.sin(ang) * 2.6);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const col = ox === 0 && oy === 0 ? dark : petal;
          put(d, cx + ox, cy + oy, col[0], col[1], col[2]);
        }
      }
    }
    put(d, 7, 5, 255, 220, 70);
    put(d, 8, 5, 255, 210, 50);
  } else if (name === 'fruit') {
    fillNoise(d, [40, 110, 38], 12, rng);
    for (let y = 3; y < 14; y++) {
      for (let x = 4; x < 12; x++) {
        const dx = x - 8;
        const dy = y - 8;
        if (dx * dx + dy * dy * 0.8 < 16) {
          put(d, x, y, 190 + (rng() - 0.5) * 20, 40, 36);
        }
      }
    }
    put(d, 8, 3, 50, 110, 40);
    put(d, 8, 2, 50, 110, 40);
    put(d, 7, 2, 40, 90, 32);
  } else if (name === 'rug_cow') {
    fillNoise(d, [120, 78, 48], 18, rng);
    blot(d, [90, 55, 32], rng, 6, 2);
    blot(d, [160, 120, 90], rng, 4, 1);
  } else if (name === 'rug_zebra') {
    fillNoise(d, [236, 232, 220], 10, rng);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        if (((x + Math.floor(y / 2)) % 4) < 2) put(d, x, y, 28, 26, 24);
      }
    }
  } else if (name === 'rug_sheep') {
    fillNoise(d, [228, 224, 214], 14, rng);
    blot(d, [210, 206, 196], rng, 8, 2);
  } else if (name === 'furnace_top') {
    fillNoise(d, [88, 88, 92], 16, rng);
    blot(d, [50, 50, 54], rng, 6, 2);
    for (let i = 3; i < 13; i++) {
      put(d, i, 3, 40, 40, 44);
      put(d, i, 12, 40, 40, 44);
      put(d, 3, i, 40, 40, 44);
      put(d, 12, i, 40, 40, 44);
    }
  } else if (name === 'furnace_side') {
    fillNoise(d, [80, 80, 84], 14, rng);
    for (let y = 5; y < 13; y++) {
      for (let x = 4; x < 12; x++) put(d, x, y, 18, 16, 16);
    }
    put(d, 6, 7, 255, 140, 40);
    put(d, 7, 8, 255, 90, 20);
    put(d, 8, 7, 255, 160, 50);
    put(d, 9, 9, 220, 70, 16);
  } else if (name === 'door_lower') {
    fillNoise(d, [168, 122, 62], 12, rng);
    for (let i = 0; i < TILE; i++) {
      put(d, 0, i, 92, 62, 28);
      put(d, 15, i, 92, 62, 28);
      put(d, i, 0, 92, 62, 28);
      put(d, i, 15, 92, 62, 28);
    }
    put(d, 12, 8, 40, 40, 44);
    put(d, 13, 8, 70, 70, 76);
    put(d, 12, 7, 70, 70, 76);
  } else if (name === 'door_upper') {
    fillNoise(d, [168, 122, 62], 12, rng);
    for (let i = 0; i < TILE; i++) {
      put(d, 0, i, 92, 62, 28);
      put(d, 15, i, 92, 62, 28);
      put(d, i, 0, 92, 62, 28);
      put(d, i, 15, 92, 62, 28);
    }
    for (let y = 3; y < 8; y++) {
      for (let x = 4; x < 12; x++) {
        if (x === 4 || x === 11 || y === 3 || y === 7) put(d, x, y, 92, 62, 28);
        else put(d, x, y, 140, 190, 210);
      }
    }
  } else if (name === 'ladder') {
    const rail = [118, 78, 38];
    const rung = [168, 118, 58];
    for (let y = 0; y < TILE; y++) {
      put(d, 2, y, rail[0], rail[1], rail[2]);
      put(d, 3, y, rail[0] + 16, rail[1] + 10, rail[2]);
      put(d, 12, y, rail[0] + 16, rail[1] + 10, rail[2]);
      put(d, 13, y, rail[0], rail[1], rail[2]);
    }
    for (const ry of [2, 6, 10, 14]) {
      for (let x = 2; x <= 13; x++) put(d, x, ry, rung[0], rung[1], rung[2]);
    }
  } else if (name === 'glass') {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const edge = x === 0 || y === 0 || x === 15 || y === 15 || x === 8 || y === 8;
        if (edge) put(d, x, y, 214, 236, 244, 255);
        else put(d, x, y, 150, 210, 228, 255);
      }
    }
    put(d, 3, 3, 255, 255, 255);
    put(d, 4, 3, 255, 255, 255);
    put(d, 3, 4, 240, 250, 255);
  } else if (name === 'spring_top') {
    fillNoise(d, [108, 108, 114], 16, rng);
    blot(d, [88, 88, 94], rng, 5, 2);
    for (let i = 0; i < TILE; i++) {
      put(d, i, 0, 72, 72, 78);
      put(d, i, 15, 72, 72, 78);
      put(d, 0, i, 72, 72, 78);
      put(d, 15, i, 72, 72, 78);
    }
    for (let y = 3; y < 13; y++) {
      for (let x = 3; x < 13; x++) {
        const dx = x - 7.5;
        const dy = y - 7.5;
        if (dx * dx + dy * dy < 22) {
          const wave = Math.sin(x * 0.9 + y * 0.4) * 12;
          put(d, x, y, clamp(46 + wave, 0, 255), clamp(118 + wave, 0, 255), clamp(198 + wave, 0, 255));
        }
      }
    }
    put(d, 6, 6, 120, 190, 240);
    put(d, 7, 5, 160, 210, 250);
  } else if (name === 'spring_side') {
    fillNoise(d, [110, 110, 116], 16, rng);
    blot(d, [90, 90, 96], rng, 5, 2);
    for (let x = 0; x < TILE; x++) {
      put(d, x, 3, 168, 170, 180);
      put(d, x, 4, 140, 142, 152);
      put(d, x, 11, 168, 170, 180);
      put(d, x, 12, 140, 142, 152);
    }
    for (let y = 6; y < 10; y++) {
      for (let x = 5; x < 11; x++) {
        put(d, x, y, 40, 96, 168);
      }
    }
    put(d, 7, 7, 90, 160, 220);
    put(d, 8, 8, 70, 140, 210);
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
  } else if (kind.startsWith('sword_')) {
    const head = kind.endsWith('wood') ? wood() : kind.endsWith('stone') ? stone() : iron();
    g.fillStyle = '#8a5a2a';
    g.fillRect(14, 20, 4, 10);
    g.fillStyle = '#c4a060';
    g.fillRect(12, 18, 8, 4);
    g.fillStyle = head;
    g.fillRect(13, 4, 6, 16);
    g.fillRect(14, 2, 4, 4);
  } else if (kind === 'meat_raw') {
    g.fillStyle = '#c45a5a';
    g.fillRect(8, 10, 16, 12);
    g.fillStyle = '#e8a0a0';
    g.fillRect(10, 12, 6, 4);
  } else if (kind === 'meat_cooked') {
    g.fillStyle = '#7a3e22';
    g.fillRect(8, 10, 16, 12);
    g.fillStyle = '#c47838';
    g.fillRect(10, 12, 6, 4);
  } else if (kind === 'fruit') {
    g.fillStyle = '#c83228';
    g.beginPath();
    g.arc(16, 18, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a8a32';
    g.fillRect(15, 6, 3, 6);
    g.fillRect(18, 7, 5, 3);
  } else if (kind === 'fruit_cooked') {
    g.fillStyle = '#c47828';
    g.beginPath();
    g.arc(16, 18, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8a4a14';
    g.beginPath();
    g.arc(16, 18, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a8a32';
    g.fillRect(15, 6, 3, 6);
  } else if (kind === 'hide_cow') {
    g.fillStyle = '#7a4e2e';
    g.fillRect(6, 8, 20, 16);
    g.fillStyle = '#c4b090';
    g.fillRect(10, 12, 6, 6);
  } else if (kind === 'hide_zebra') {
    g.fillStyle = '#f0ece4';
    g.fillRect(6, 8, 20, 16);
    g.fillStyle = '#1a1816';
    g.fillRect(8, 8, 4, 16);
    g.fillRect(16, 8, 4, 16);
    g.fillRect(24, 8, 2, 16);
  } else if (kind === 'hide_sheep') {
    g.fillStyle = '#e8e4d8';
    g.fillRect(6, 8, 20, 16);
    g.fillStyle = '#d0ccbe';
    g.fillRect(10, 12, 8, 6);
  } else if (kind === 'door') {
    g.fillStyle = '#a87838';
    g.fillRect(10, 2, 12, 28);
    g.fillStyle = '#6a4820';
    g.fillRect(10, 2, 12, 2);
    g.fillRect(10, 28, 12, 2);
    g.fillRect(10, 2, 2, 28);
    g.fillRect(20, 2, 2, 28);
    g.fillStyle = '#8ec4d8';
    g.fillRect(13, 6, 6, 6);
    g.fillStyle = '#c8c8d0';
    g.fillRect(18, 18, 3, 3);
  } else if (kind === 'door_double') {
    g.fillStyle = '#a87838';
    g.fillRect(4, 2, 11, 28);
    g.fillRect(17, 2, 11, 28);
    g.fillStyle = '#6a4820';
    g.fillRect(4, 2, 11, 2);
    g.fillRect(17, 2, 11, 2);
    g.fillRect(4, 28, 11, 2);
    g.fillRect(17, 28, 11, 2);
    g.fillStyle = '#8ec4d8';
    g.fillRect(7, 6, 5, 5);
    g.fillRect(20, 6, 5, 5);
  } else if (kind === 'stairs') {
    g.fillStyle = '#c48a48';
    g.fillRect(4, 20, 24, 8);
    g.fillRect(16, 12, 12, 8);
    g.fillStyle = '#8a5a28';
    g.fillRect(4, 20, 24, 2);
    g.fillRect(16, 12, 12, 2);
  } else if (kind === 'stairs_sand') {
    g.fillStyle = '#d2c078';
    g.fillRect(4, 20, 24, 8);
    g.fillRect(16, 12, 12, 8);
    g.fillStyle = '#a89048';
    g.fillRect(4, 20, 24, 2);
    g.fillRect(16, 12, 12, 2);
  } else if (kind === 'stairs_stone') {
    g.fillStyle = '#9a9aa2';
    g.fillRect(4, 20, 24, 8);
    g.fillRect(16, 12, 12, 8);
    g.fillStyle = '#6e6e76';
    g.fillRect(4, 20, 24, 2);
    g.fillRect(16, 12, 12, 2);
  } else if (kind === 'ladder') {
    g.fillStyle = '#8a5a28';
    g.fillRect(8, 2, 3, 28);
    g.fillRect(21, 2, 3, 28);
    g.fillStyle = '#c48a48';
    g.fillRect(8, 6, 16, 3);
    g.fillRect(8, 14, 16, 3);
    g.fillRect(8, 22, 16, 3);
  } else if (kind === 'wall_wood') {
    g.fillStyle = '#c48a48';
    g.fillRect(10, 2, 6, 28);
    g.fillStyle = '#8a5a28';
    g.fillRect(10, 2, 6, 2);
    g.fillRect(10, 28, 6, 2);
    g.fillRect(10, 2, 2, 28);
    g.fillRect(14, 2, 2, 28);
  } else if (kind === 'wall_glass') {
    g.fillStyle = 'rgba(170, 220, 235, 0.85)';
    g.fillRect(10, 2, 6, 28);
    g.fillStyle = '#d8eef4';
    g.fillRect(10, 2, 6, 2);
    g.fillRect(10, 28, 6, 2);
    g.fillRect(10, 2, 2, 28);
    g.fillRect(14, 2, 2, 28);
    g.fillRect(10, 16, 6, 2);
  }
  return c.toDataURL();
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ATLAS, ATLAS);
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
    'sword_wood', 'sword_stone', 'sword_iron',
    'meat_raw', 'meat_cooked', 'fruit', 'fruit_cooked',
    'hide_cow', 'hide_zebra', 'hide_sheep',
    'door', 'door_double', 'stairs', 'stairs_sand', 'stairs_stone', 'ladder',
    'wall_wood', 'wall_glass',
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
  const item = ITEMS[id];
  if (item?.icon && atlas.icons[item.icon]) return atlas.icons[item.icon];
  if (isBlock(id)) {
    const b = BLOCKS[id];
    if (b.icon && atlas.icons[b.icon]) return atlas.icons[b.icon];
    const tile = b.tiles.top || b.tiles.all || b.tiles.side;
    return atlas.icons[tile] || '';
  }
  return '';
}
