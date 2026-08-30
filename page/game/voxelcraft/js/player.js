import * as THREE from 'three';
import { AIR, WATER, isSolid, isLiquid } from './blocks.js';
import { HEIGHT } from './world.js';

const WIDTH = 0.6;
const HEIGHT_STAND = 1.8;
const HEIGHT_SNEAK = 1.5;
export const EYE_STAND = 1.62;
export const EYE_SNEAK = 1.32;

export class Player {
  constructor() {
    this.pos = new THREE.Vector3(64.5, 40, 64.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.28;
    this.onGround = false;
    this.inWater = false;
    this.sneak = false;
    this.sprint = false;
    this.health = 20;
    this.maxHealth = 20;
    this.hunger = 20;
    this.maxHunger = 20;
    this.starveAcc = 0;
    this.fallY = null;
    this.spawn = this.pos.clone();
    this.regenAcc = 0;
    this.hurtAcc = 0;
  }

  eyeHeight() {
    return this.sneak ? EYE_SNEAK : EYE_STAND;
  }

  bodyHeight() {
    return this.sneak ? HEIGHT_SNEAK : HEIGHT_STAND;
  }

  eyePosition(target = new THREE.Vector3()) {
    return target.set(this.pos.x, this.pos.y + this.eyeHeight(), this.pos.z);
  }

  applyLook(camera) {
    camera.position.copy(this.eyePosition());
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  lookDelta(dx, dy, sens = 0.0022) {
    if (Math.abs(dx) > 80 || Math.abs(dy) > 80) return;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const lim = Math.PI / 2 - 0.04;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt, world, input) {
    this.hurtAcc = Math.max(0, this.hurtAcc - dt);
    const feet = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const body = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.1), Math.floor(this.pos.z));
    this.inWater = isLiquid(feet) || isLiquid(body);
    this.sneak = input.sneak && this.onGround && !this.inWater;

    const wish = new THREE.Vector3();
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    if (input.forward) wish.add(new THREE.Vector3(-s, 0, -c));
    if (input.back) wish.add(new THREE.Vector3(s, 0, c));
    if (input.left) wish.add(new THREE.Vector3(-c, 0, s));
    if (input.right) wish.add(new THREE.Vector3(c, 0, -s));
    if (wish.lengthSq() > 0) wish.normalize();

    this.sprint = !!input.sprint && wish.lengthSq() > 0 && !this.sneak && !this.inWater && this.hunger >= 6;

    let speed = this.sneak ? 2.2 : this.sprint ? 6.4 : 4.4;
    if (this.inWater) speed = 2.1;
    const accel = this.onGround ? 40 : 12;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, accel * dt);

    const autoJump = this.sprint && this.onGround && this.shouldAutoJump(world, wish.x, wish.z);
    const wantJump = !!input.jump || autoJump;

    if (this.inWater) {
      this.vel.y += (wantJump ? 8 : -4) * dt;
      this.vel.y *= Math.pow(0.7, dt * 10);
      this.fallY = this.pos.y;
    } else {
      this.vel.y -= 28 * dt;
      if (wantJump && this.onGround) {
        this.vel.y = 8.4;
        this.onGround = false;
      }
    }

    this.moveAxis(world, this.vel.x * dt, 0, 0);
    this.onGround = false;
    const beforeY = this.pos.y;
    this.moveAxis(world, 0, this.vel.y * dt, 0);
    if (this.onGround && this.vel.y < 0) {
      const dist = (this.fallY ?? beforeY) - this.pos.y;
      if (dist > 3.2 && !this.inWater) {
        const dmg = Math.floor((dist - 3) * 1.4);
        if (dmg > 0) this.hurt(dmg);
      }
      this.vel.y = 0;
      this.fallY = this.pos.y;
    } else if (!this.onGround && this.vel.y < 0 && this.fallY == null) {
      this.fallY = beforeY;
    }
    this.moveAxis(world, 0, 0, this.vel.z * dt);

    const drain = (this.sprint ? 0.16 : 0.07) * dt / 3;
    this.hunger = Math.max(0, this.hunger - drain);
    if (this.hunger <= 0) {
      this.starveAcc += dt;
      if (this.starveAcc >= 4) {
        this.hurt(1);
        this.starveAcc = 0;
      }
    } else {
      this.starveAcc = 0;
    }

    if (this.health < this.maxHealth && this.hurtAcc <= 0 && this.hunger >= 16) {
      this.regenAcc += dt;
      if (this.regenAcc > 4) {
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.regenAcc = 0;
      }
    } else {
      this.regenAcc = 0;
    }
  }

  shouldAutoJump(world, wishX, wishZ) {
    if (!wishX && !wishZ) return false;
    return this.columnIsStep(world, wishX, wishZ, 0.75)
      || this.columnIsStep(world, wishX, wishZ, 1.05);
  }

  columnIsStep(world, wishX, wishZ, dist) {
    const bx = Math.floor(this.pos.x + wishX * dist);
    const bz = Math.floor(this.pos.z + wishZ * dist);
    const by = Math.floor(this.pos.y + 0.01);
    if (bx === Math.floor(this.pos.x) && bz === Math.floor(this.pos.z)) return false;
    if (!isSolid(world.get(bx, by, bz))) return false;
    if (isSolid(world.get(bx, by + 1, bz))) return false;
    if (isSolid(world.get(bx, by + 2, bz))) return false;
    return true;
  }

  eat(amount, heal = 0) {
    const fillHunger = amount > 0 && this.hunger < this.maxHunger;
    const fillHealth = heal > 0 && this.health < this.maxHealth;
    if (!fillHunger && !fillHealth) return false;
    if (fillHunger) this.hunger = Math.min(this.maxHunger, this.hunger + amount);
    if (heal > 0) this.health = Math.min(this.maxHealth, this.health + heal);
    return true;
  }

  hurt(amount) {
    if (amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtAcc = 0.8;
  }

  respawn() {
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.starveAcc = 0;
    this.fallY = this.pos.y;
    this.pitch = 0.28;
  }

  overlaps(world, ox = 0, oy = 0, oz = 0) {
    const h = this.bodyHeight();
    const w = WIDTH * 0.5;
    const minX = this.pos.x + ox - w;
    const maxX = this.pos.x + ox + w;
    const minY = this.pos.y + oy;
    const maxY = this.pos.y + oy + h;
    const minZ = this.pos.z + oz - w;
    const maxZ = this.pos.z + oz + w;
    const x0 = Math.floor(minX);
    const x1 = Math.floor(maxX - 1e-6);
    const y0 = Math.floor(minY);
    const y1 = Math.floor(maxY - 1e-6);
    const z0 = Math.floor(minZ);
    const z1 = Math.floor(maxZ - 1e-6);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (isSolid(world.get(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  moveAxis(world, dx, dy, dz) {
    if (dx) {
      this.pos.x += dx;
      if (this.overlaps(world)) {
        let stepped = false;
        if (this.onGround && dy === 0 && !this.overlaps(world, 0, 0.51, 0)) {
          this.pos.y += 0.51;
          if (!this.overlaps(world)) stepped = true;
          else this.pos.y -= 0.51;
        }
        if (!stepped) {
          this.pos.x -= dx;
          this.vel.x = 0;
        }
      }
    }
    if (dz) {
      this.pos.z += dz;
      if (this.overlaps(world)) {
        let stepped = false;
        if (this.onGround && dy === 0 && !this.overlaps(world, 0, 0.51, 0)) {
          this.pos.y += 0.51;
          if (!this.overlaps(world)) stepped = true;
          else this.pos.y -= 0.51;
        }
        if (!stepped) {
          this.pos.z -= dz;
          this.vel.z = 0;
        }
      }
    }
    if (dy) {
      this.pos.y += dy;
      if (this.overlaps(world)) {
        this.pos.y -= dy;
        if (dy < 0) {
          this.onGround = true;
          this.vel.y = 0;
        } else {
          this.vel.y = 0;
        }
      }
    }
    this.pos.y = Math.max(1, Math.min(HEIGHT - 2, this.pos.y));
  }

  overlapsBlock(bx, by, bz) {
    const w = WIDTH * 0.5;
    const h = this.bodyHeight();
    return !(this.pos.x + w <= bx || this.pos.x - w >= bx + 1
      || this.pos.y + h <= by || this.pos.y >= by + 1
      || this.pos.z + w <= bz || this.pos.z - w >= bz + 1);
  }
}

export function raycast(world, origin, dir, maxDist = 5.5) {
  const x = Math.floor(origin.x);
  const y = Math.floor(origin.y);
  const z = Math.floor(origin.z);
  const stepX = dir.x >= 0 ? 1 : -1;
  const stepY = dir.y >= 0 ? 1 : -1;
  const stepZ = dir.z >= 0 ? 1 : -1;
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  const frac = (v, step) => (step > 0 ? 1 - (v - Math.floor(v)) : v - Math.floor(v));
  let tMaxX = tDeltaX < Infinity ? tDeltaX * frac(origin.x, stepX) : Infinity;
  let tMaxY = tDeltaY < Infinity ? tDeltaY * frac(origin.y, stepY) : Infinity;
  let tMaxZ = tDeltaZ < Infinity ? tDeltaZ * frac(origin.z, stepZ) : Infinity;
  let ix = x;
  let iy = y;
  let iz = z;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;
  for (let i = 0; i < 64; i++) {
    const id = world.get(ix, iy, iz);
    if (id && id !== AIR && id !== WATER) {
      return { x: ix, y: iy, z: iz, nx, ny, nz, dist, id };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      dist = tMaxX;
      tMaxX += tDeltaX;
      ix += stepX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      dist = tMaxY;
      tMaxY += tDeltaY;
      iy += stepY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
      iz += stepZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if (dist > maxDist) return null;
  }
  return null;
}

export function lookDir(yaw, pitch, target = new THREE.Vector3()) {
  const cy = Math.cos(pitch);
  return target.set(-Math.sin(yaw) * cy, -Math.sin(pitch), -Math.cos(yaw) * cy);
}
