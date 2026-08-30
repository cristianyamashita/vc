import { AIR, STAIRS, LADDER, isSolid } from './blocks.js';

export const FACE_PZ = 0;
export const FACE_PX = 1;
export const FACE_NZ = 2;
export const FACE_NX = 3;

const FULL = { x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 };

export function dirKey(x, y, z) {
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

export function facingFromYaw(yaw) {
  const lx = -Math.sin(yaw);
  const lz = -Math.cos(yaw);
  if (Math.abs(lx) > Math.abs(lz)) return lx > 0 ? FACE_PX : FACE_NX;
  return lz > 0 ? FACE_PZ : FACE_NZ;
}

export function ladderFacingFromHit(nx, ny, nz) {
  if (ny !== 0) return null;
  if (nx === 1) return FACE_NX;
  if (nx === -1) return FACE_PX;
  if (nz === 1) return FACE_NZ;
  if (nz === -1) return FACE_PZ;
  return null;
}

export function wallDelta(facing) {
  if (facing === FACE_PZ) return [0, 1];
  if (facing === FACE_PX) return [1, 0];
  if (facing === FACE_NZ) return [0, -1];
  return [-1, 0];
}

export function stairBoxes(facing) {
  const boxes = [{ x0: 0, y0: 0, z0: 0, x1: 1, y1: 0.5, z1: 1 }];
  if (facing === FACE_PZ) boxes.push({ x0: 0, y0: 0.5, z0: 0.5, x1: 1, y1: 1, z1: 1 });
  else if (facing === FACE_PX) boxes.push({ x0: 0.5, y0: 0.5, z0: 0, x1: 1, y1: 1, z1: 1 });
  else if (facing === FACE_NZ) boxes.push({ x0: 0, y0: 0.5, z0: 0, x1: 1, y1: 1, z1: 0.5 });
  else boxes.push({ x0: 0, y0: 0.5, z0: 0, x1: 0.5, y1: 1, z1: 1 });
  return boxes;
}

export function solidBoxes(world, x, y, z) {
  const id = world.get(x, y, z);
  if (id === STAIRS) return stairBoxes(world.blockFacing(x, y, z));
  if (id === LADDER) return [];
  if (isSolid(id)) return [FULL];
  return [];
}

export function aabbHitsBox(minX, minY, minZ, maxX, maxY, maxZ, bx, by, bz, box) {
  return minX < bx + box.x1 && maxX > bx + box.x0
    && minY < by + box.y1 && maxY > by + box.y0
    && minZ < bz + box.z1 && maxZ > bz + box.z0;
}

export function placeStairs(world, x, y, z, yaw) {
  if (!world.inBounds(x, y, z)) return false;
  const dest = world.get(x, y, z);
  if (dest && dest !== AIR) return false;
  world.set(x, y, z, STAIRS);
  world.setBlockDir(x, y, z, facingFromYaw(yaw));
  return true;
}

export function placeLadder(world, x, y, z, nx, ny, nz) {
  if (!world.inBounds(x, y, z)) return false;
  const dest = world.get(x, y, z);
  if (dest && dest !== AIR) return false;
  const facing = ladderFacingFromHit(nx, ny, nz);
  if (facing == null) return false;
  const [dx, dz] = wallDelta(facing);
  if (!isSolid(world.get(x + dx, y, z + dz))) return false;
  world.set(x, y, z, LADDER);
  world.setBlockDir(x, y, z, facing);
  return true;
}

export function serializeBlockDir(map) {
  if (!map) return {};
  return { ...map };
}

export function loadBlockDir(data) {
  return data && typeof data === 'object' ? { ...data } : {};
}
