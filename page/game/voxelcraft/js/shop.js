import {
  GOLD, ITEMS,
  DIRT, STONE, COBBLE, SAND, LOG, PLANKS, GLASS, TORCH, CACTUS,
  RED_EARTH, TABLE, FURNACE, DOOR, DOOR_DOUBLE,
  STAIRS, STAIRS_SAND, STAIRS_STONE, LADDER, WALL_WOOD, WALL_GLASS, WATER_SPRING,
  FLOWER_RED, FLOWER_YELLOW, FLOWER_WHITE,
  RUG_COW, RUG_ZEBRA, RUG_SHEEP,
  STICK, COAL, IRON,
  RAW_MEAT, COOKED_MEAT, FRUIT, COOKED_FRUIT,
  HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP,
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
  STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
  IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
  GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_SWORD,
  LASSO, REVOLVER, BOW, COMPASS,
  ammoOf,
} from './blocks.js';
import { Inventory, cloneStack } from './inventory.js';

function offer(id, n, cost) {
  return { id, n, cost };
}

export const SHOP_SECTIONS = [
  {
    titleKey: 'shopSpecial',
    items: [
      offer(LASSO, 1, 3),
      offer(BOW, 1, 4),
      offer(REVOLVER, 1, 5),
      // Intended price is 20 gold; 1 while testing the castle hunt.
      offer(COMPASS, 1, 1),
    ],
  },
  {
    titleKey: 'shopWeapons',
    items: [
      offer(WOOD_SWORD, 1, 2),
      offer(STONE_SWORD, 1, 3),
      offer(IRON_SWORD, 1, 4),
      offer(GOLD_SWORD, 1, 5),
    ],
  },
  {
    titleKey: 'shopTools',
    items: [
      offer(WOOD_PICK, 1, 1),
      offer(WOOD_AXE, 1, 1),
      offer(WOOD_SHOVEL, 1, 1),
      offer(STONE_PICK, 1, 1),
      offer(STONE_AXE, 1, 1),
      offer(STONE_SHOVEL, 1, 1),
      offer(IRON_PICK, 1, 2),
      offer(IRON_AXE, 1, 2),
      offer(IRON_SHOVEL, 1, 1),
      offer(GOLD_PICK, 1, 2),
      offer(GOLD_AXE, 1, 2),
      offer(GOLD_SHOVEL, 1, 1),
    ],
  },
  {
    titleKey: 'shopBlocks',
    items: [
      offer(DIRT, 64, 1),
      offer(SAND, 64, 1),
      offer(COBBLE, 64, 1),
      offer(STONE, 64, 1),
      offer(PLANKS, 64, 1),
      offer(LOG, 64, 1),
      offer(RED_EARTH, 64, 1),
      offer(GLASS, 32, 1),
      offer(CACTUS, 16, 1),
      offer(FLOWER_RED, 16, 1),
      offer(FLOWER_YELLOW, 16, 1),
      offer(FLOWER_WHITE, 16, 1),
      offer(TORCH, 16, 1),
      offer(STAIRS, 16, 1),
      offer(STAIRS_SAND, 16, 1),
      offer(STAIRS_STONE, 16, 1),
      offer(LADDER, 16, 1),
      offer(WALL_WOOD, 16, 1),
      offer(WALL_GLASS, 16, 1),
      offer(TABLE, 1, 1),
      offer(FURNACE, 1, 1),
      offer(DOOR, 4, 1),
      offer(DOOR_DOUBLE, 2, 1),
      offer(WATER_SPRING, 1, 3),
      offer(RUG_COW, 1, 1),
      offer(RUG_ZEBRA, 1, 1),
      offer(RUG_SHEEP, 1, 1),
    ],
  },
  {
    titleKey: 'shopItems',
    items: [
      offer(STICK, 64, 1),
      offer(COAL, 16, 1),
      offer(IRON, 8, 1),
      offer(RAW_MEAT, 8, 1),
      offer(COOKED_MEAT, 4, 1),
      offer(FRUIT, 16, 1),
      offer(COOKED_FRUIT, 8, 1),
      offer(HIDE_COW, 4, 1),
      offer(HIDE_ZEBRA, 4, 1),
      offer(HIDE_SHEEP, 4, 1),
    ],
  },
];

export function offerStack(item) {
  const def = ITEMS[item.id];
  const out = { id: item.id, n: item.n || 1 };
  if (def?.dura) out.dura = def.dura;
  if (def?.ranged) out.ammo = def.ammoStart;
  return out;
}

export function ammoRestock(id) {
  return ITEMS[id]?.ranged ? (ITEMS[id].ammoStart || 0) : 0;
}

export function ownedRanged(inv, id) {
  if (!ITEMS[id]?.ranged) return null;
  if (inv.cursor?.id === id) return inv.cursor;
  return inv.findId(id);
}

export function buyShopItem(inv, item) {
  const cost = item.cost || 0;
  if (inv.count(GOLD) < cost) return { ok: false, reason: 'needGold' };
  const made = offerStack(item);
  const existing = ownedRanged(inv, item.id);
  if (existing) {
    const add = made.ammo ?? ammoRestock(item.id);
    inv.takeId(GOLD, cost);
    existing.ammo = ammoOf(existing) + add;
    return { ok: true, ammo: true, ammoAdded: add, ammoTotal: existing.ammo };
  }
  const sim = new Inventory();
  sim.slots = inv.slots.map(cloneStack);
  sim.offhand = cloneStack(inv.offhand);
  sim.takeId(GOLD, cost);
  if (!sim.add(made.id, made.n, made.dura, made.ammo)) return { ok: false, reason: 'full' };
  inv.takeId(GOLD, cost);
  inv.add(made.id, made.n, made.dura, made.ammo);
  return { ok: true, ammo: false };
}
