export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const COBBLE = 4;
export const SAND = 5;
export const WATER = 6;
export const LOG = 7;
export const LEAVES = 8;
export const PLANKS = 9;
export const COAL_ORE = 10;
export const IRON_ORE = 11;
export const TABLE = 12;
export const TORCH = 13;
export const BEDROCK = 14;
export const CACTUS = 15;

export const STICK = 20;
export const COAL = 21;
export const IRON = 22;

export const WOOD_PICK = 30;
export const WOOD_AXE = 31;
export const WOOD_SHOVEL = 32;
export const STONE_PICK = 33;
export const STONE_AXE = 34;
export const STONE_SHOVEL = 35;
export const IRON_PICK = 36;
export const IRON_AXE = 37;
export const IRON_SHOVEL = 38;

export const BLOCKS = {
  [GRASS]: {
    nameKey: 'blockGrass',
    solid: true,
    opaque: true,
    hardness: 0.6,
    tool: 'shovel',
    minTier: 0,
    drops: [{ id: DIRT, n: 1 }],
    tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' },
  },
  [DIRT]: {
    nameKey: 'blockDirt',
    solid: true,
    opaque: true,
    hardness: 0.5,
    tool: 'shovel',
    minTier: 0,
    drops: [{ id: DIRT, n: 1 }],
    tiles: { all: 'dirt' },
  },
  [STONE]: {
    nameKey: 'blockStone',
    solid: true,
    opaque: true,
    hardness: 1.5,
    tool: 'pickaxe',
    minTier: 1,
    drops: [{ id: COBBLE, n: 1 }],
    tiles: { all: 'stone' },
  },
  [COBBLE]: {
    nameKey: 'blockCobble',
    solid: true,
    opaque: true,
    hardness: 2,
    tool: 'pickaxe',
    minTier: 1,
    drops: [{ id: COBBLE, n: 1 }],
    tiles: { all: 'cobble' },
  },
  [SAND]: {
    nameKey: 'blockSand',
    solid: true,
    opaque: true,
    hardness: 0.5,
    tool: 'shovel',
    minTier: 0,
    drops: [{ id: SAND, n: 1 }],
    tiles: { all: 'sand' },
  },
  [WATER]: {
    nameKey: 'blockWater',
    solid: false,
    opaque: false,
    liquid: true,
    hardness: 0,
    tool: null,
    minTier: 0,
    drops: [],
    tiles: { all: 'water' },
  },
  [LOG]: {
    nameKey: 'blockLog',
    solid: true,
    opaque: true,
    hardness: 2,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: LOG, n: 1 }],
    tiles: { top: 'log_top', side: 'log_side', bottom: 'log_top' },
  },
  [LEAVES]: {
    nameKey: 'blockLeaves',
    solid: true,
    opaque: false,
    hardness: 0.2,
    tool: 'axe',
    minTier: 0,
    drops: [],
    tiles: { all: 'leaves' },
  },
  [PLANKS]: {
    nameKey: 'blockPlanks',
    solid: true,
    opaque: true,
    hardness: 2,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: PLANKS, n: 1 }],
    tiles: { all: 'planks' },
  },
  [COAL_ORE]: {
    nameKey: 'blockCoalOre',
    solid: true,
    opaque: true,
    hardness: 3,
    tool: 'pickaxe',
    minTier: 1,
    drops: [{ id: COAL, n: 1 }],
    tiles: { all: 'coal_ore' },
  },
  [IRON_ORE]: {
    nameKey: 'blockIronOre',
    solid: true,
    opaque: true,
    hardness: 3,
    tool: 'pickaxe',
    minTier: 2,
    drops: [{ id: IRON, n: 1 }],
    tiles: { all: 'iron_ore' },
  },
  [TABLE]: {
    nameKey: 'blockTable',
    solid: true,
    opaque: true,
    hardness: 2.5,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: TABLE, n: 1 }],
    tiles: { top: 'table_top', side: 'table_side', bottom: 'planks' },
  },
  [TORCH]: {
    nameKey: 'blockTorch',
    solid: false,
    opaque: false,
    hardness: 0.05,
    tool: null,
    minTier: 0,
    drops: [{ id: TORCH, n: 1 }],
    tiles: { all: 'torch' },
    replaceable: false,
  },
  [BEDROCK]: {
    nameKey: 'blockStone',
    solid: true,
    opaque: true,
    hardness: Infinity,
    tool: 'pickaxe',
    minTier: 99,
    drops: [],
    tiles: { all: 'bedrock' },
  },
  [CACTUS]: {
    nameKey: 'blockCactus',
    solid: true,
    opaque: true,
    hardness: 0.4,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: CACTUS, n: 1 }],
    tiles: { all: 'cactus' },
  },
};

export const ITEMS = {
  [STICK]: { nameKey: 'itemStick', stack: 64, place: 0, icon: 'stick' },
  [COAL]: { nameKey: 'itemCoal', stack: 64, place: 0, icon: 'coal' },
  [IRON]: { nameKey: 'itemIron', stack: 64, place: 0, icon: 'iron' },
  [WOOD_PICK]: { nameKey: 'itemWoodPick', stack: 1, tool: 'pickaxe', tier: 1, speed: 2, dura: 60, icon: 'pick_wood' },
  [WOOD_AXE]: { nameKey: 'itemWoodAxe', stack: 1, tool: 'axe', tier: 1, speed: 2, dura: 60, icon: 'axe_wood' },
  [WOOD_SHOVEL]: { nameKey: 'itemWoodShovel', stack: 1, tool: 'shovel', tier: 1, speed: 2, dura: 60, icon: 'shovel_wood' },
  [STONE_PICK]: { nameKey: 'itemStonePick', stack: 1, tool: 'pickaxe', tier: 2, speed: 4, dura: 132, icon: 'pick_stone' },
  [STONE_AXE]: { nameKey: 'itemStoneAxe', stack: 1, tool: 'axe', tier: 2, speed: 4, dura: 132, icon: 'axe_stone' },
  [STONE_SHOVEL]: { nameKey: 'itemStoneShovel', stack: 1, tool: 'shovel', tier: 2, speed: 4, dura: 132, icon: 'shovel_stone' },
  [IRON_PICK]: { nameKey: 'itemIronPick', stack: 1, tool: 'pickaxe', tier: 3, speed: 6, dura: 251, icon: 'pick_iron' },
  [IRON_AXE]: { nameKey: 'itemIronAxe', stack: 1, tool: 'axe', tier: 3, speed: 6, dura: 251, icon: 'axe_iron' },
  [IRON_SHOVEL]: { nameKey: 'itemIronShovel', stack: 1, tool: 'shovel', tier: 3, speed: 6, dura: 251, icon: 'shovel_iron' },
};

export function def(id) {
  return BLOCKS[id] || ITEMS[id] || null;
}

export function isBlock(id) {
  return id > 0 && !!BLOCKS[id];
}

export function isPlaceable(id) {
  return isBlock(id) && id !== WATER && id !== BEDROCK;
}

export function isSolid(id) {
  return !!BLOCKS[id]?.solid;
}

export function isOpaque(id) {
  return !!BLOCKS[id]?.opaque;
}

export function isLiquid(id) {
  return !!BLOCKS[id]?.liquid;
}

export function nameKey(id) {
  return def(id)?.nameKey || 'blockAir';
}

export function stackMax(id) {
  if (ITEMS[id]) return ITEMS[id].stack;
  if (BLOCKS[id]) return 64;
  return 64;
}

export function heldTool(stack) {
  if (!stack) return { tool: null, tier: 0, speed: 1 };
  const item = ITEMS[stack.id];
  if (item?.tool) return { tool: item.tool, tier: item.tier, speed: item.speed, dura: item.dura };
  return { tool: null, tier: 0, speed: 1 };
}

export function mineSeconds(blockId, stack) {
  const b = BLOCKS[blockId];
  if (!b || !isFinite(b.hardness)) return Infinity;
  if (b.hardness <= 0) return 0;
  const held = heldTool(stack);
  let speed = 1;
  if (held.tool && held.tool === b.tool) speed = held.speed;
  const ok = !b.tool || b.minTier === 0 || (held.tool === b.tool && held.tier >= b.minTier);
  if (!ok && b.minTier > 0) speed = 0.2;
  return b.hardness * 1.5 / speed;
}

export function canHarvest(blockId, stack) {
  const b = BLOCKS[blockId];
  if (!b) return false;
  if (b.minTier <= 0) return true;
  const held = heldTool(stack);
  return held.tool === b.tool && held.tier >= b.minTier;
}

export function tileName(blockId, face) {
  const b = BLOCKS[blockId];
  if (!b) return 'stone';
  const tiles = b.tiles;
  if (face === 'py') return tiles.top || tiles.all;
  if (face === 'ny') return tiles.bottom || tiles.all;
  return tiles.side || tiles.all;
}
