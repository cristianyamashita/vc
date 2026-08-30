import { stackMax, ITEMS } from './blocks.js';

export const HOTBAR = 9;
export const INV_SIZE = 36;

export function emptyStack() {
  return null;
}

export function cloneStack(s) {
  return s ? { id: s.id, n: s.n, dura: s.dura } : null;
}

export class Inventory {
  constructor() {
    this.slots = Array(INV_SIZE).fill(null);
    this.selected = 0;
    this.offhand = null;
    this.cursor = null;
    this.craft2 = Array(4).fill(null);
    this.craft3 = Array(9).fill(null);
  }

  hotbar() {
    return this.slots.slice(0, HOTBAR);
  }

  selectedStack() {
    return this.slots[this.selected];
  }

  add(id, n = 1, dura) {
    const max = stackMax(id);
    let left = n;
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && !ITEMS[id]?.tool) {
        const room = max - s.n;
        const take = Math.min(room, left);
        s.n += take;
        left -= take;
      }
    }
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, left);
        this.slots[i] = { id, n: take, dura };
        left -= take;
      }
    }
    return left === 0;
  }

  takeSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return null;
    const take = Math.min(n, s.n);
    s.n -= take;
    const out = { id: s.id, n: take, dura: s.dura };
    if (s.n <= 0) this.slots[this.selected] = null;
    return out;
  }

  wearSelected() {
    const s = this.slots[this.selected];
    if (!s || !ITEMS[s.id]?.dura) return;
    s.dura = (s.dura ?? ITEMS[s.id].dura) - 1;
    if (s.dura <= 0) this.slots[this.selected] = null;
  }

  dropOne() {
    return this.takeSelected(1);
  }

  swapOffhand() {
    const held = this.slots[this.selected];
    this.slots[this.selected] = this.offhand;
    this.offhand = held;
  }

  takeOffhand(n = 1) {
    const s = this.offhand;
    if (!s) return null;
    const take = Math.min(n, s.n);
    s.n -= take;
    const out = { id: s.id, n: take, dura: s.dura };
    if (s.n <= 0) this.offhand = null;
    return out;
  }

  canFit(stack) {
    if (!stack) return true;
    const copy = this.slots.map(cloneStack);
    const inv = new Inventory();
    inv.slots = copy;
    return inv.add(stack.id, stack.n, stack.dura);
  }

  serialize() {
    return {
      slots: this.slots.map(cloneStack),
      selected: this.selected,
      offhand: cloneStack(this.offhand),
    };
  }

  load(data) {
    if (!data?.slots) return;
    this.slots = Array(INV_SIZE).fill(null);
    for (let i = 0; i < INV_SIZE; i++) this.slots[i] = cloneStack(data.slots[i]);
    this.selected = Math.max(0, Math.min(8, data.selected || 0));
    this.offhand = cloneStack(data.offhand);
  }

  returnCraft(grid) {
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]) {
        this.add(grid[i].id, grid[i].n, grid[i].dura);
        grid[i] = null;
      }
    }
  }
}

export function clickSlot(list, index, cursor, right) {
  const slot = list[index];
  if (right) {
    if (cursor) {
      if (!slot) {
        list[index] = { id: cursor.id, n: 1, dura: cursor.dura };
        cursor.n -= 1;
        return cursor.n <= 0 ? null : cursor;
      }
      if (slot.id === cursor.id && !ITEMS[cursor.id]?.tool && slot.n < stackMax(slot.id)) {
        slot.n += 1;
        cursor.n -= 1;
        return cursor.n <= 0 ? null : cursor;
      }
      return cursor;
    }
    if (slot) {
      const half = Math.max(1, Math.ceil(slot.n / 2));
      const take = { id: slot.id, n: half, dura: slot.dura };
      slot.n -= half;
      if (slot.n <= 0) list[index] = null;
      return take;
    }
    return cursor;
  }

  if (!cursor) {
    const picked = slot;
    list[index] = null;
    return picked;
  }
  if (!slot) {
    list[index] = cursor;
    return null;
  }
  if (slot.id === cursor.id && !ITEMS[cursor.id]?.tool) {
    const max = stackMax(slot.id);
    const room = max - slot.n;
    const take = Math.min(room, cursor.n);
    slot.n += take;
    cursor.n -= take;
    return cursor.n <= 0 ? null : cursor;
  }
  list[index] = cursor;
  return slot;
}
