import {
  LOG, PLANKS, STICK, TABLE, TORCH, COAL, COBBLE, STONE, SAND, IRON, GOLD, FURNACE, GLASS,
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
  STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
  IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
  GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_SWORD,
  HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP,
  RUG_COW, RUG_ZEBRA, RUG_SHEEP,
  DOOR, DOOR_DOUBLE, STAIRS, STAIRS_SAND, STAIRS_STONE, LADDER, WALL_WOOD, WALL_GLASS,
  WATER_SPRING,
} from './blocks.js';

function cell(id) {
  return id || 0;
}

function normalizeGrid(slots, size) {
  const g = [];
  for (let i = 0; i < size * size; i++) {
    g.push(slots[i]?.id || 0);
  }
  return g;
}

function matchesShaped(grid, size, pattern) {
  const ph = pattern.length;
  const pw = pattern[0].length;
  for (let oy = 0; oy <= size - ph; oy++) {
    for (let ox = 0; ox <= size - pw; ox++) {
      let ok = true;
      const used = new Set();
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          const want = cell(pattern[y][x]);
          const got = grid[(oy + y) * size + (ox + x)];
          if (got !== want) {
            ok = false;
            break;
          }
          used.add((oy + y) * size + (ox + x));
        }
        if (!ok) break;
      }
      if (!ok) continue;
      for (let i = 0; i < grid.length; i++) {
        if (!used.has(i) && grid[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
  }
  return false;
}

function matchesMirror(grid, size, pattern) {
  if (matchesShaped(grid, size, pattern)) return true;
  const mirrored = pattern.map((row) => [...row].reverse());
  return matchesShaped(grid, size, mirrored);
}

function matchesShapeless(grid, ids) {
  const need = {};
  for (const id of ids) need[id] = (need[id] || 0) + 1;
  const got = {};
  let extra = 0;
  for (const id of grid) {
    if (!id) continue;
    got[id] = (got[id] || 0) + 1;
    extra += 1;
  }
  let needCount = 0;
  for (const id of Object.keys(need)) {
    needCount += need[id];
    if ((got[id] || 0) !== need[id]) return false;
  }
  return extra === needCount;
}

const RECIPES = [
  { shapeless: [LOG], out: { id: PLANKS, n: 4 } },
  { shapeless: [COAL, STICK], out: { id: TORCH, n: 4 } },
  { shapeless: [SAND, COAL], out: { id: GLASS, n: 1 } },
  { shapeless: [HIDE_COW], out: { id: RUG_COW, n: 1 } },
  { shapeless: [HIDE_ZEBRA], out: { id: RUG_ZEBRA, n: 1 } },
  { shapeless: [HIDE_SHEEP, HIDE_SHEEP], out: { id: RUG_SHEEP, n: 1 } },
  { pattern: [[PLANKS, PLANKS], [PLANKS, PLANKS]], out: { id: TABLE, n: 1 } },
  { pattern: [[PLANKS], [PLANKS]], out: { id: STICK, n: 4 } },
];

function toolSet(mat, pick, axe, shovel, sword) {
  RECIPES.push(
    { pattern: [[mat, mat, mat], [0, STICK, 0], [0, STICK, 0]], out: { id: pick, n: 1 } },
    { pattern: [[mat, mat], [mat, STICK], [0, STICK]], out: { id: axe, n: 1 } },
    { pattern: [[mat], [STICK], [STICK]], out: { id: shovel, n: 1 } },
    { pattern: [[mat], [mat], [STICK]], out: { id: sword, n: 1 } },
  );
}

toolSet(PLANKS, WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD);
toolSet(COBBLE, STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD);
toolSet(IRON, IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD);
toolSet(GOLD, GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_SWORD);

RECIPES.push({
  pattern: [
    [COBBLE, COBBLE, COBBLE],
    [COBBLE, 0, COBBLE],
    [COBBLE, COBBLE, COBBLE],
  ],
  out: { id: FURNACE, n: 1 },
});

RECIPES.push({
  pattern: [
    [PLANKS, PLANKS],
    [PLANKS, PLANKS],
    [PLANKS, PLANKS],
  ],
  out: { id: DOOR, n: 1 },
});

RECIPES.push({ shapeless: [DOOR, DOOR], out: { id: DOOR_DOUBLE, n: 1 } });

function stairSet(mat, out) {
  RECIPES.push({
    pattern: [
      [mat, 0, 0],
      [mat, mat, 0],
      [mat, mat, mat],
    ],
    out: { id: out, n: 4 },
  });
}

stairSet(PLANKS, STAIRS);
stairSet(SAND, STAIRS_SAND);
stairSet(COBBLE, STAIRS_STONE);
stairSet(STONE, STAIRS_STONE);

RECIPES.push({
  pattern: [
    [STICK, 0, STICK],
    [STICK, STICK, STICK],
    [STICK, 0, STICK],
  ],
  out: { id: LADDER, n: 3 },
});

RECIPES.push({ pattern: [[PLANKS, PLANKS]], out: { id: WALL_WOOD, n: 4 } });
RECIPES.push({ pattern: [[GLASS, GLASS]], out: { id: WALL_GLASS, n: 4 } });

RECIPES.push({
  pattern: [
    [COBBLE, IRON, COBBLE],
    [IRON, SAND, IRON],
    [COBBLE, IRON, COBBLE],
  ],
  out: { id: WATER_SPRING, n: 1 },
});

/** Sentinel for the variable material cell in the recipe book. */
export const MAT = -1;

export const RECIPE_GUIDE = [
  { shapeless: [LOG], out: { id: PLANKS, n: 4 }, size: 2 },
  { pattern: [[PLANKS], [PLANKS]], out: { id: STICK, n: 4 }, size: 2 },
  { pattern: [[PLANKS, PLANKS], [PLANKS, PLANKS]], out: { id: TABLE, n: 1 }, size: 2 },
  { shapeless: [COAL, STICK], out: { id: TORCH, n: 4 }, size: 2 },
  { shapeless: [SAND, COAL], out: { id: GLASS, n: 1 }, size: 2, titleKey: 'recipeGlass' },
  {
    pattern: [[MAT, MAT, MAT], [0, STICK, 0], [0, STICK, 0]],
    size: 3,
    table: true,
    titleKey: 'recipePickaxe',
    results: [
      { mat: PLANKS, out: WOOD_PICK },
      { mat: COBBLE, out: STONE_PICK },
      { mat: IRON, out: IRON_PICK },
      { mat: GOLD, out: GOLD_PICK },
    ],
  },
  {
    pattern: [[MAT, MAT], [MAT, STICK], [0, STICK]],
    size: 3,
    table: true,
    mirror: true,
    titleKey: 'recipeAxe',
    results: [
      { mat: PLANKS, out: WOOD_AXE },
      { mat: COBBLE, out: STONE_AXE },
      { mat: IRON, out: IRON_AXE },
      { mat: GOLD, out: GOLD_AXE },
    ],
  },
  {
    pattern: [[MAT], [STICK], [STICK]],
    size: 3,
    table: true,
    titleKey: 'recipeShovel',
    results: [
      { mat: PLANKS, out: WOOD_SHOVEL },
      { mat: COBBLE, out: STONE_SHOVEL },
      { mat: IRON, out: IRON_SHOVEL },
      { mat: GOLD, out: GOLD_SHOVEL },
    ],
  },
  {
    pattern: [[MAT], [MAT], [STICK]],
    size: 3,
    table: true,
    titleKey: 'recipeSword',
    results: [
      { mat: PLANKS, out: WOOD_SWORD },
      { mat: COBBLE, out: STONE_SWORD },
      { mat: IRON, out: IRON_SWORD },
      { mat: GOLD, out: GOLD_SWORD },
    ],
  },
  {
    pattern: [
      [COBBLE, COBBLE, COBBLE],
      [COBBLE, 0, COBBLE],
      [COBBLE, COBBLE, COBBLE],
    ],
    out: { id: FURNACE, n: 1 },
    size: 3,
    table: true,
    titleKey: 'recipeFurnace',
  },
  {
    pattern: [
      [PLANKS, PLANKS],
      [PLANKS, PLANKS],
      [PLANKS, PLANKS],
    ],
    out: { id: DOOR, n: 1 },
    size: 3,
    table: true,
    titleKey: 'recipeDoor',
  },
  { shapeless: [DOOR, DOOR], out: { id: DOOR_DOUBLE, n: 1 }, size: 2, titleKey: 'recipeDoorDouble' },
  {
    pattern: [
      [MAT, 0, 0],
      [MAT, MAT, 0],
      [MAT, MAT, MAT],
    ],
    size: 3,
    table: true,
    mirror: true,
    titleKey: 'recipeStairs',
    matKey: 'recipeMaterialStairs',
    results: [
      { mat: PLANKS, out: STAIRS, n: 4 },
      { mat: SAND, out: STAIRS_SAND, n: 4 },
      { mat: COBBLE, out: STAIRS_STONE, n: 4 },
    ],
  },
  {
    pattern: [
      [STICK, 0, STICK],
      [STICK, STICK, STICK],
      [STICK, 0, STICK],
    ],
    out: { id: LADDER, n: 3 },
    size: 3,
    table: true,
    titleKey: 'recipeLadder',
  },
  {
    pattern: [[MAT, MAT]],
    size: 2,
    titleKey: 'recipeWall',
    matKey: 'recipeMaterialWalls',
    results: [
      { mat: PLANKS, out: WALL_WOOD, n: 4 },
      { mat: GLASS, out: WALL_GLASS, n: 4 },
    ],
  },
  {
    pattern: [
      [COBBLE, IRON, COBBLE],
      [IRON, SAND, IRON],
      [COBBLE, IRON, COBBLE],
    ],
    out: { id: WATER_SPRING, n: 1 },
    size: 3,
    table: true,
    titleKey: 'recipeWaterSpring',
  },
  { shapeless: [HIDE_COW], out: { id: RUG_COW, n: 1 }, size: 2 },
  { shapeless: [HIDE_ZEBRA], out: { id: RUG_ZEBRA, n: 1 }, size: 2 },
  { shapeless: [HIDE_SHEEP, HIDE_SHEEP], out: { id: RUG_SHEEP, n: 1 }, size: 2 },
];

export function matchRecipe(slots, size) {
  const grid = normalizeGrid(slots, size);
  for (const rec of RECIPES) {
    if (rec.shapeless && matchesShapeless(grid, rec.shapeless)) return rec.out;
    if (rec.pattern && matchesMirror(grid, size, rec.pattern)) return rec.out;
  }
  return null;
}

export function consumeCraft(slots) {
  for (const slot of slots) {
    if (!slot) continue;
    slot.n -= 1;
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] && slots[i].n <= 0) slots[i] = null;
  }
}
