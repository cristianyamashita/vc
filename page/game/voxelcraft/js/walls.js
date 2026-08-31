import { isWall, isReplaceable } from './blocks.js';
import {
  FACE_PZ, FACE_PX, FACE_NZ, FACE_NX, FACE_PY, FACE_NY,
  wallBox, aabbHitsBox,
} from './stairs.js';

function airAt(world, x, y, z) {
  return isReplaceable(world.get(x, y, z));
}

export function facingFromHitNormal(nx, ny, nz) {
  if (nx === 1) return FACE_PX;
  if (nx === -1) return FACE_NX;
  if (nz === 1) return FACE_PZ;
  if (nz === -1) return FACE_NZ;
  if (ny === 1) return FACE_NY;
  return FACE_PY;
}

function facingAxis(facing) {
  if (facing === FACE_PX || facing === FACE_NX) return 'x';
  if (facing === FACE_PY || facing === FACE_NY) return 'y';
  return 'z';
}

function isAlongPlane(facing, dx, dy, dz) {
  const axis = facingAxis(facing);
  if (axis === 'x') return dx === 0;
  if (axis === 'y') return dy === 0;
  return dz === 0;
}

function planeAxes(facing) {
  if (facing === FACE_PZ || facing === FACE_NZ) return { u: [1, 0, 0], v: [0, 1, 0] };
  if (facing === FACE_PX || facing === FACE_NX) return { u: [0, 0, 1], v: [0, 1, 0] };
  return { u: [1, 0, 0], v: [0, 0, 1] };
}

function lookVec(yaw, pitch) {
  const cy = Math.cos(pitch);
  return [-Math.sin(yaw) * cy, -Math.sin(pitch), -Math.cos(yaw) * cy];
}

function extendDir(yaw, pitch, facing, secondary = false) {
  const [lx, ly, lz] = lookVec(yaw, pitch);
  const { u, v } = planeAxes(facing);
  const du = lx * u[0] + ly * u[1] + lz * u[2];
  const dv = lx * v[0] + ly * v[1] + lz * v[2];
  const useU = secondary ? Math.abs(du) < Math.abs(dv) : Math.abs(du) >= Math.abs(dv);
  if (useU) {
    const s = du >= 0 ? 1 : -1;
    return [u[0] * s, u[1] * s, u[2] * s];
  }
  const s = dv >= 0 ? 1 : -1;
  return [v[0] * s, v[1] * s, v[2] * s];
}

function oppositeAcross(x, y, z, facing) {
  if (facing === FACE_PZ) return [x, y, z - 1, FACE_NZ];
  if (facing === FACE_NZ) return [x, y, z + 1, FACE_PZ];
  if (facing === FACE_PX) return [x - 1, y, z, FACE_NX];
  if (facing === FACE_NX) return [x + 1, y, z, FACE_PX];
  if (facing === FACE_NY) return [x, y - 1, z, FACE_PY];
  return [x, y + 1, z, FACE_NY];
}

function samePlaneOccupied(world, x, y, z, facing) {
  const [ox, oy, oz, of] = oppositeAcross(x, y, z, facing);
  return isWall(world.get(ox, oy, oz)) && world.blockFacing(ox, oy, oz) === of;
}

function snapToNeighbors(world, x, y, z, fallback) {
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let axisMatch = null;
  for (const [dx, dy, dz] of dirs) {
    const id = world.get(x + dx, y + dy, z + dz);
    if (!isWall(id)) continue;
    const f = world.blockFacing(x + dx, y + dy, z + dz);
    if (!isAlongPlane(f, dx, dy, dz)) continue;
    if (f === fallback) return f;
    if (facingAxis(f) === facingAxis(fallback) && axisMatch == null) axisMatch = f;
  }
  return axisMatch ?? fallback;
}

function playerHitsWall(player, x, y, z, facing) {
  if (!player) return false;
  if (!player.overlapsBlock(x, y, z)) return false;
  const w = 0.3;
  const h = player.bodyHeight ? player.bodyHeight() : 1.8;
  return aabbHitsBox(
    player.pos.x - w, player.pos.y, player.pos.z - w,
    player.pos.x + w, player.pos.y + h, player.pos.z + w,
    x, y, z, wallBox(facing),
  );
}

export function placeWall(world, hit, yaw, pitch, id, player) {
  if (!hit || !isWall(id)) return false;

  let x;
  let y;
  let z;
  let facing;

  if (isWall(hit.id)) {
    const hf = world.blockFacing(hit.x, hit.y, hit.z);
    if (isAlongPlane(hf, hit.nx, hit.ny, hit.nz)) {
      x = hit.x + hit.nx;
      y = hit.y + hit.ny;
      z = hit.z + hit.nz;
      facing = hf;
    } else {
      const [dx, dy, dz] = extendDir(yaw, pitch, hf, false);
      x = hit.x + dx;
      y = hit.y + dy;
      z = hit.z + dz;
      facing = hf;
      if (!world.inBounds(x, y, z) || !airAt(world, x, y, z) || samePlaneOccupied(world, x, y, z, facing)) {
        const [sx, sy, sz] = extendDir(yaw, pitch, hf, true);
        x = hit.x + sx;
        y = hit.y + sy;
        z = hit.z + sz;
      }
    }
  } else if (isReplaceable(hit.id)) {
    x = hit.x;
    y = hit.y;
    z = hit.z;
    facing = snapToNeighbors(world, x, y, z, facingFromHitNormal(hit.nx, hit.ny, hit.nz));
  } else {
    x = hit.x + hit.nx;
    y = hit.y + hit.ny;
    z = hit.z + hit.nz;
    facing = snapToNeighbors(world, x, y, z, facingFromHitNormal(hit.nx, hit.ny, hit.nz));
  }

  if (!world.inBounds(x, y, z) || !airAt(world, x, y, z)) return false;
  if (samePlaneOccupied(world, x, y, z, facing)) return false;
  if (playerHitsWall(player, x, y, z, facing)) return false;
  world.set(x, y, z, id);
  world.setBlockDir(x, y, z, facing);
  return true;
}
