import {
  AIR, DOOR, DOOR_UPPER, DOOR_OPEN, DOOR_UPPER_OPEN, DOOR_DOUBLE,
  isSolid,
} from './blocks.js';

export function isDoorId(id) {
  return id === DOOR || id === DOOR_UPPER || id === DOOR_OPEN || id === DOOR_UPPER_OPEN;
}

export function isDoorBottom(id) {
  return id === DOOR || id === DOOR_OPEN;
}

export function isDoorOpenId(id) {
  return id === DOOR_OPEN || id === DOOR_UPPER_OPEN;
}

export function doorKey(x, y, z) {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

export function doorFacingFromYaw(yaw) {
  const lx = -Math.sin(yaw);
  const lz = -Math.cos(yaw);
  if (Math.abs(lx) > Math.abs(lz)) return lx > 0 ? 1 : 3;
  return lz > 0 ? 0 : 2;
}

function rightOf(facing) {
  if (facing === 0) return [1, 0];
  if (facing === 1) return [0, -1];
  if (facing === 2) return [-1, 0];
  return [0, 1];
}

export function doorBase(world, x, y, z) {
  const id = world.get(x, y, z);
  if (id === DOOR_UPPER || id === DOOR_UPPER_OPEN) return { x, y: y - 1, z };
  if (id === DOOR || id === DOOR_OPEN) return { x, y, z };
  return null;
}

export function doorSlab(facing, open, hinge, t = 0.14) {
  if (!open) {
    if (facing === 0) return { x0: 0, x1: 1, z0: 0, z1: t };
    if (facing === 1) return { x0: 0, x1: t, z0: 0, z1: 1 };
    if (facing === 2) return { x0: 0, x1: 1, z0: 1 - t, z1: 1 };
    return { x0: 1 - t, x1: 1, z0: 0, z1: 1 };
  }
  if (facing === 0 || facing === 2) {
    if (hinge === 0) return { x0: 0, x1: t, z0: 0, z1: 1 };
    return { x0: 1 - t, x1: 1, z0: 0, z1: 1 };
  }
  if (hinge === 0) return { x0: 0, x1: 1, z0: 0, z1: t };
  return { x0: 0, x1: 1, z0: 1 - t, z1: 1 };
}

function airAt(world, x, y, z) {
  const id = world.get(x, y, z);
  return !id || id === AIR;
}

function floorOk(world, x, y, z) {
  return isSolid(world.get(x, y - 1, z));
}

function setLeaf(world, x, y, z, open, meta) {
  world.set(x, y, z, open ? DOOR_OPEN : DOOR);
  world.set(x, y + 1, z, open ? DOOR_UPPER_OPEN : DOOR_UPPER);
  world.doors[doorKey(x, y, z)] = meta;
}

function clearLeaf(world, x, y, z) {
  delete world.doors[doorKey(x, y, z)];
  if (isDoorId(world.get(x, y, z))) world.set(x, y, z, AIR);
  if (isDoorId(world.get(x, y + 1, z))) world.set(x, y + 1, z, AIR);
}

export function spaceOccupied(player, life, KINDS, cells) {
  for (const [x, y, z] of cells) {
    if (player?.overlapsBlock(x, y, z)) return true;
  }
  if (!life?.list || !KINDS) return false;
  for (const e of life.list) {
    const def = KINDS[e.kind];
    if (!def) continue;
    const hw = def.w * 0.5;
    for (const [bx, by, bz] of cells) {
      const hit = !(e.x + hw <= bx || e.x - hw >= bx + 1
        || e.y + def.h <= by || e.y >= by + 1
        || e.z + hw <= bz || e.z - hw >= bz + 1);
      if (hit) return true;
    }
  }
  return false;
}

export function toggleDoor(world, x, y, z, player, life, KINDS) {
  const b = doorBase(world, x, y, z);
  if (!b) return false;
  const id = world.get(b.x, b.y, b.z);
  if (!isDoorBottom(id)) return false;
  const open = !isDoorOpenId(id);
  const meta = world.doors[doorKey(b.x, b.y, b.z)] || { facing: 0, hinge: 0 };
  const cells = [[b.x, b.y, b.z], [b.x, b.y + 1, b.z]];
  if (meta.px != null) {
    cells.push([meta.px, b.y, meta.pz], [meta.px, b.y + 1, meta.pz]);
  }
  if (!open && spaceOccupied(player, life, KINDS, cells)) return false;
  setLeaf(world, b.x, b.y, b.z, open, meta);
  if (meta.px != null && isDoorBottom(world.get(meta.px, b.y, meta.pz))) {
    const other = world.doors[doorKey(meta.px, b.y, meta.pz)] || { ...meta, px: b.x, pz: b.z, hinge: meta.hinge ? 0 : 1 };
    setLeaf(world, meta.px, b.y, meta.pz, open, other);
  }
  return true;
}

export function placeDoor(world, x, y, z, yaw, wide, player) {
  if (!world.inBounds(x, y, z) || !world.inBounds(x, y + 1, z)) return false;
  const facing = doorFacingFromYaw(yaw);
  if (!wide) {
    if (!airAt(world, x, y, z) || !airAt(world, x, y + 1, z)) return false;
    if (!floorOk(world, x, y, z)) return false;
    if (player?.overlapsBlock(x, y, z) || player?.overlapsBlock(x, y + 1, z)) return false;
    setLeaf(world, x, y, z, false, { facing, hinge: 0 });
    return true;
  }
  const [rx, rz] = rightOf(facing);
  const options = [
    { ox: 0, oz: 0, dx: rx, dz: rz },
    { ox: 0, oz: 0, dx: -rx, dz: -rz },
  ];
  for (const o of options) {
    const ax = x + o.ox;
    const az = z + o.oz;
    const bx = x + o.dx;
    const bz = z + o.dz;
    if (!world.inBounds(bx, y, bz) || !world.inBounds(bx, y + 1, bz)) continue;
    if (!airAt(world, ax, y, az) || !airAt(world, ax, y + 1, az)) continue;
    if (!airAt(world, bx, y, bz) || !airAt(world, bx, y + 1, bz)) continue;
    if (!floorOk(world, ax, y, az) || !floorOk(world, bx, y, bz)) continue;
    if (player?.overlapsBlock(ax, y, az) || player?.overlapsBlock(ax, y + 1, az)) continue;
    if (player?.overlapsBlock(bx, y, bz) || player?.overlapsBlock(bx, y + 1, bz)) continue;
    const leftIsA = (o.dx === rx && o.dz === rz);
    const leftX = leftIsA ? ax : bx;
    const leftZ = leftIsA ? az : bz;
    const rightX = leftIsA ? bx : ax;
    const rightZ = leftIsA ? bz : az;
    setLeaf(world, leftX, y, leftZ, false, { facing, hinge: 0, px: rightX, pz: rightZ });
    setLeaf(world, rightX, y, rightZ, false, { facing, hinge: 1, px: leftX, pz: leftZ });
    return true;
  }
  return false;
}

export function removeDoor(world, x, y, z) {
  const b = doorBase(world, x, y, z);
  if (!b) return 0;
  const meta = world.doors[doorKey(b.x, b.y, b.z)];
  const paired = meta && meta.px != null && isDoorId(world.get(meta.px, b.y, meta.pz));
  const drop = paired ? DOOR_DOUBLE : DOOR;
  if (paired) clearLeaf(world, meta.px, b.y, meta.pz);
  clearLeaf(world, b.x, b.y, b.z);
  return drop;
}

export function serializeDoors(map) {
  const out = {};
  if (!map) return out;
  for (const [key, d] of Object.entries(map)) {
    out[key] = { facing: d.facing || 0, hinge: d.hinge || 0, px: d.px, pz: d.pz };
  }
  return out;
}

export function loadDoors(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [key, d] of Object.entries(data)) {
    out[key] = { facing: d.facing || 0, hinge: d.hinge || 0, px: d.px, pz: d.pz };
  }
  return out;
}
