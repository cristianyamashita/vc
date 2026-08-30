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
export const FLOWER_RED = 16;
export const FLOWER_YELLOW = 17;
export const FLOWER_WHITE = 18;
export const FRUIT_HANG = 19;

export const STICK = 20;
export const COAL = 21;
export const IRON = 22;
export const RAW_MEAT = 23;
export const COOKED_MEAT = 24;
export const FRUIT = 25;
export const HIDE_COW = 26;
export const HIDE_ZEBRA = 27;
export const HIDE_SHEEP = 28;
export const COOKED_FRUIT = 29;

export const WOOD_PICK = 30;
export const WOOD_AXE = 31;
export const WOOD_SHOVEL = 32;
export const STONE_PICK = 33;
export const STONE_AXE = 34;
export const STONE_SHOVEL = 35;
export const IRON_PICK = 36;
export const IRON_AXE = 37;
export const IRON_SHOVEL = 38;
export const WOOD_SWORD = 39;
export const STONE_SWORD = 40;
export const IRON_SWORD = 41;

export const RUG_COW = 42;
export const RUG_ZEBRA = 43;
export const RUG_SHEEP = 44;
export const FURNACE = 45;
export const DOOR = 46;
export const DOOR_UPPER = 47;
export const DOOR_OPEN = 48;
export const DOOR_UPPER_OPEN = 49;
export const DOOR_DOUBLE = 50;
export const STAIRS = 51;
export const LADDER = 52;

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
  [FLOWER_RED]: {
    nameKey: 'blockFlowerRed',
    solid: false,
    opaque: false,
    plant: true,
    hardness: 0.05,
    tool: null,
    minTier: 0,
    drops: [{ id: FLOWER_RED, n: 1 }],
    tiles: { all: 'flower_red' },
  },
  [FLOWER_YELLOW]: {
    nameKey: 'blockFlowerYellow',
    solid: false,
    opaque: false,
    plant: true,
    hardness: 0.05,
    tool: null,
    minTier: 0,
    drops: [{ id: FLOWER_YELLOW, n: 1 }],
    tiles: { all: 'flower_yellow' },
  },
  [FLOWER_WHITE]: {
    nameKey: 'blockFlowerWhite',
    solid: false,
    opaque: false,
    plant: true,
    hardness: 0.05,
    tool: null,
    minTier: 0,
    drops: [{ id: FLOWER_WHITE, n: 1 }],
    tiles: { all: 'flower_white' },
  },
  [FRUIT_HANG]: {
    nameKey: 'itemFruit',
    solid: false,
    opaque: false,
    fruit: true,
    hardness: 0.08,
    tool: null,
    minTier: 0,
    drops: [{ id: FRUIT, n: 1 }],
    tiles: { all: 'fruit' },
  },
  [RUG_COW]: {
    nameKey: 'blockRugCow',
    solid: false,
    opaque: false,
    rug: true,
    hardness: 0.2,
    tool: null,
    minTier: 0,
    drops: [{ id: RUG_COW, n: 1 }],
    tiles: { all: 'rug_cow' },
  },
  [RUG_ZEBRA]: {
    nameKey: 'blockRugZebra',
    solid: false,
    opaque: false,
    rug: true,
    hardness: 0.2,
    tool: null,
    minTier: 0,
    drops: [{ id: RUG_ZEBRA, n: 1 }],
    tiles: { all: 'rug_zebra' },
  },
  [RUG_SHEEP]: {
    nameKey: 'blockRugSheep',
    solid: false,
    opaque: false,
    rug: true,
    hardness: 0.2,
    tool: null,
    minTier: 0,
    drops: [{ id: RUG_SHEEP, n: 1 }],
    tiles: { all: 'rug_sheep' },
  },
  [FURNACE]: {
    nameKey: 'blockFurnace',
    solid: true,
    opaque: true,
    hardness: 3.5,
    tool: 'pickaxe',
    minTier: 1,
    drops: [{ id: FURNACE, n: 1 }],
    tiles: { top: 'furnace_top', side: 'furnace_side', bottom: 'cobble' },
  },
  [DOOR]: {
    nameKey: 'blockDoor',
    solid: true,
    opaque: false,
    door: true,
    hardness: 3,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: DOOR, n: 1 }],
    tiles: { all: 'door_lower' },
  },
  [DOOR_UPPER]: {
    nameKey: 'blockDoor',
    solid: true,
    opaque: false,
    door: true,
    hardness: 3,
    tool: 'axe',
    minTier: 0,
    drops: [],
    tiles: { all: 'door_upper' },
  },
  [DOOR_OPEN]: {
    nameKey: 'blockDoor',
    solid: false,
    opaque: false,
    door: true,
    hardness: 3,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: DOOR, n: 1 }],
    tiles: { all: 'door_lower' },
  },
  [DOOR_UPPER_OPEN]: {
    nameKey: 'blockDoor',
    solid: false,
    opaque: false,
    door: true,
    hardness: 3,
    tool: 'axe',
    minTier: 0,
    drops: [],
    tiles: { all: 'door_upper' },
  },
  [STAIRS]: {
    nameKey: 'blockStairs',
    solid: true,
    opaque: false,
    stair: true,
    hardness: 2,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: STAIRS, n: 1 }],
    tiles: { all: 'planks' },
    icon: 'stairs',
  },
  [LADDER]: {
    nameKey: 'blockLadder',
    solid: false,
    opaque: false,
    ladder: true,
    hardness: 0.4,
    tool: 'axe',
    minTier: 0,
    drops: [{ id: LADDER, n: 1 }],
    tiles: { all: 'ladder' },
    icon: 'ladder',
  },
};

export const ITEMS = {
  [STICK]: { nameKey: 'itemStick', stack: 64, place: 0, icon: 'stick' },
  [COAL]: { nameKey: 'itemCoal', stack: 64, place: 0, icon: 'coal' },
  [IRON]: { nameKey: 'itemIron', stack: 64, place: 0, icon: 'iron' },
  [RAW_MEAT]: { nameKey: 'itemRawMeat', stack: 64, place: 0, icon: 'meat_raw', food: { hunger: 5, eatTime: 0.5 } },
  [COOKED_MEAT]: { nameKey: 'itemCookedMeat', stack: 64, place: 0, icon: 'meat_cooked', food: { hunger: 14, eatTime: 0.45, heal: 4 } },
  [FRUIT]: { nameKey: 'itemFruit', stack: 64, place: 0, icon: 'fruit', food: { hunger: 3, eatTime: 0.4 } },
  [COOKED_FRUIT]: { nameKey: 'itemCookedFruit', stack: 64, place: 0, icon: 'fruit_cooked', food: { hunger: 8, eatTime: 0.4, heal: 2 } },
  [HIDE_COW]: { nameKey: 'itemHideCow', stack: 64, place: 0, icon: 'hide_cow' },
  [HIDE_ZEBRA]: { nameKey: 'itemHideZebra', stack: 64, place: 0, icon: 'hide_zebra' },
  [HIDE_SHEEP]: { nameKey: 'itemHideSheep', stack: 64, place: 0, icon: 'hide_sheep' },
  [WOOD_PICK]: { nameKey: 'itemWoodPick', stack: 1, tool: 'pickaxe', tier: 1, speed: 2, dura: 60, icon: 'pick_wood' },
  [WOOD_AXE]: { nameKey: 'itemWoodAxe', stack: 1, tool: 'axe', tier: 1, speed: 2, dura: 60, icon: 'axe_wood' },
  [WOOD_SHOVEL]: { nameKey: 'itemWoodShovel', stack: 1, tool: 'shovel', tier: 1, speed: 2, dura: 60, icon: 'shovel_wood' },
  [STONE_PICK]: { nameKey: 'itemStonePick', stack: 1, tool: 'pickaxe', tier: 2, speed: 4, dura: 132, icon: 'pick_stone' },
  [STONE_AXE]: { nameKey: 'itemStoneAxe', stack: 1, tool: 'axe', tier: 2, speed: 4, dura: 132, icon: 'axe_stone' },
  [STONE_SHOVEL]: { nameKey: 'itemStoneShovel', stack: 1, tool: 'shovel', tier: 2, speed: 4, dura: 132, icon: 'shovel_stone' },
  [IRON_PICK]: { nameKey: 'itemIronPick', stack: 1, tool: 'pickaxe', tier: 3, speed: 6, dura: 251, icon: 'pick_iron' },
  [IRON_AXE]: { nameKey: 'itemIronAxe', stack: 1, tool: 'axe', tier: 3, speed: 6, dura: 251, icon: 'axe_iron' },
  [IRON_SHOVEL]: { nameKey: 'itemIronShovel', stack: 1, tool: 'shovel', tier: 3, speed: 6, dura: 251, icon: 'shovel_iron' },
  [WOOD_SWORD]: { nameKey: 'itemWoodSword', stack: 1, tool: 'sword', tier: 1, speed: 1, dura: 60, damage: 4, icon: 'sword_wood' },
  [STONE_SWORD]: { nameKey: 'itemStoneSword', stack: 1, tool: 'sword', tier: 2, speed: 1, dura: 132, damage: 5, icon: 'sword_stone' },
  [IRON_SWORD]: { nameKey: 'itemIronSword', stack: 1, tool: 'sword', tier: 3, speed: 1, dura: 251, damage: 7, icon: 'sword_iron' },
  [DOOR_DOUBLE]: { nameKey: 'itemDoorDouble', stack: 64, place: 0, icon: 'door_double' },
};

export function def(id) {
  return BLOCKS[id] || ITEMS[id] || null;
}

export function isBlock(id) {
  return id > 0 && !!BLOCKS[id];
}

export function isPlaceable(id) {
  if (id === DOOR_DOUBLE) return true;
  return isBlock(id) && id !== WATER && id !== BEDROCK && id !== FRUIT_HANG
    && id !== DOOR_UPPER && id !== DOOR_OPEN && id !== DOOR_UPPER_OPEN;
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

export function isPlant(id) {
  return !!BLOCKS[id]?.plant;
}

export function isFlower(id) {
  return id === FLOWER_RED || id === FLOWER_YELLOW || id === FLOWER_WHITE;
}

export function isRug(id) {
  return !!BLOCKS[id]?.rug;
}

export function isFruitHang(id) {
  return !!BLOCKS[id]?.fruit;
}

export function isDecor(id) {
  return id === TORCH || id === LADDER || isPlant(id) || isRug(id) || isFruitHang(id) || !!BLOCKS[id]?.door;
}

export function foodInfo(stack) {
  if (!stack) return null;
  return ITEMS[stack.id]?.food || null;
}

export function attackDamage(stack) {
  if (!stack) return 2;
  const item = ITEMS[stack.id];
  if (item?.tool === 'sword') return item.damage || 4;
  if (item?.tool) return 3;
  return 2;
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
