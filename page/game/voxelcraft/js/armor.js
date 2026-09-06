import { ITEMS, armorInfo, isArmor } from './blocks.js';

// Body armour lives in its own inventory slot rather than in the hotbar: it is
// worn, not held, so it keeps working while the player swings a pickaxe.

/** The share of an incoming hit the worn plate soaks up, 0 when nothing is worn. */
export function wornProtection(inv) {
  return armorInfo(inv?.armor)?.protect || 0;
}

/** Durability left on the worn plate as a fraction, or 0 when nothing is worn. */
export function wornWear(inv) {
  const stack = inv?.armor;
  const max = stack ? ITEMS[stack.id]?.dura : 0;
  if (!max) return 0;
  return Math.max(0, Math.min(1, (stack.dura ?? max) / max));
}

/**
 * Runs one hit through the worn plate. Returns the damage that still reaches
 * the player, and grinds the plate down by the size of the hit it stopped —
 * so heavy blows wear armour out faster than scratches. A plate that runs out
 * of durability breaks and leaves the slot empty.
 */
export function absorbDamage(inv, amount) {
  const stack = inv?.armor;
  const info = armorInfo(stack);
  if (!info || amount <= 0) return { damage: amount, broke: false };
  const max = ITEMS[stack.id]?.dura || 1;
  const left = stack.dura ?? max;
  stack.dura = left - Math.max(1, Math.round(amount / 2));
  const broke = stack.dura <= 0;
  if (broke) inv.armor = null;
  // Rounded so health stays on whole points, and never down to nothing: even
  // the best plate leaves a hit worth feeling. A hit that breaks the plate is
  // still the hit it stopped.
  const through = Math.max(1, Math.round(amount * (1 - info.protect)));
  return { damage: Math.min(amount, through), broke };
}

/**
 * Puts the stack on, handing back whatever was worn before so the caller can
 * return it to the slot the new plate came from. Returns undefined when the
 * stack is not armour.
 */
export function equipArmor(inv, stack) {
  if (!stack || !isArmor(stack.id)) return undefined;
  const worn = inv.armor;
  inv.armor = stack;
  return worn ?? null;
}
