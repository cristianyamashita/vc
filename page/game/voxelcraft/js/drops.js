import * as THREE from 'three';
import { itemIcon } from './textures.js';
import { HEIGHT } from './world.js';
import { solidBoxes, aabbHitsBox } from './stairs.js';

const SIZE = 0.22;
const HALF = SIZE * 0.5;
const GRAVITY = 22;
const PICK_DELAY = 0.65;
const PICK_DIST = 1.35;
const MAX_DROPS = 80;
const THROW_SPEED = 7.2;

const texCache = new Map();

function dropTexture(id, atlas) {
  if (texCache.has(id)) return texCache.get(id);
  const url = itemIcon(id, atlas);
  const img = new Image();
  const tex = new THREE.Texture(img);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  img.onload = () => { tex.needsUpdate = true; };
  img.src = url || '';
  if (img.complete) tex.needsUpdate = true;
  texCache.set(id, tex);
  return tex;
}

function makeMesh(id, atlas) {
  const geo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
  const mat = new THREE.MeshBasicMaterial({
    map: dropTexture(id, atlas),
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  return mesh;
}

function collides(world, x, y, z) {
  const minX = x - HALF;
  const maxX = x + HALF;
  const minY = y;
  const maxY = y + SIZE;
  const minZ = z - HALF;
  const maxZ = z + HALF;
  const x0 = Math.floor(minX);
  const x1 = Math.floor(maxX - 1e-6);
  const y0 = Math.floor(minY);
  const y1 = Math.floor(maxY - 1e-6);
  const z0 = Math.floor(minZ);
  const z1 = Math.floor(maxZ - 1e-6);
  for (let iy = y0; iy <= y1; iy++) {
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        for (const box of solidBoxes(world, ix, iy, iz)) {
          if (aabbHitsBox(minX, minY, minZ, maxX, maxY, maxZ, ix, iy, iz, box)) return true;
        }
      }
    }
  }
  return false;
}

export class ItemDrops {
  constructor(scene, atlas) {
    this.atlas = atlas;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.nextId = 1;
  }

  spawn(id, n, x, y, z, vx, vy, vz, dura) {
    if (!id || n <= 0) return null;
    if (this.list.length >= MAX_DROPS) this.remove(this.list[0]);
    const mesh = makeMesh(id, this.atlas);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const drop = {
      id: this.nextId++,
      item: id,
      n,
      dura,
      x, y, z,
      vx: vx || 0,
      vy: vy || 0,
      vz: vz || 0,
      age: 0,
      mesh,
    };
    this.list.push(drop);
    return drop;
  }

  throwFrom(player, yaw, pitch, stack) {
    if (!player || !stack) return null;
    const cy = Math.cos(pitch);
    const dx = -Math.sin(yaw) * cy;
    const dy = -Math.sin(pitch);
    const dz = -Math.cos(yaw) * cy;
    const eye = player.eyeHeight();
    let x = player.pos.x + dx * 0.55;
    let y = player.pos.y + eye - 0.12;
    let z = player.pos.z + dz * 0.55;
    return this.spawn(
      stack.id,
      stack.n,
      x, y, z,
      dx * THROW_SPEED + (player.vel?.x || 0),
      dy * THROW_SPEED + 1.6,
      dz * THROW_SPEED + (player.vel?.z || 0),
      stack.dura,
    );
  }

  remove(drop) {
    const i = this.list.indexOf(drop);
    if (i >= 0) this.list.splice(i, 1);
    if (drop.mesh) {
      this.group.remove(drop.mesh);
      drop.mesh.geometry.dispose();
      drop.mesh.material.dispose();
      drop.mesh = null;
    }
  }

  update(dt, world, player, inv) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.age += dt;
      d.vy -= GRAVITY * dt;

      const step = (axis, amount) => {
        if (!amount) return;
        d[axis] += amount;
        if (collides(world, d.x, d.y, d.z)) {
          d[axis] -= amount;
          if (axis === 'y') {
            if (amount < 0) {
              d.vy = Math.abs(d.vy) > 2.4 ? d.vy * -0.28 : 0;
            } else {
              d.vy = 0;
            }
          } else if (axis === 'x') d.vx = 0;
          else d.vz = 0;
        }
      };
      step('x', d.vx * dt);
      step('z', d.vz * dt);
      step('y', d.vy * dt);

      if (d.y < 1) {
        d.y = 1;
        d.vy = 0;
      }
      if (d.y > HEIGHT - 2) {
        d.y = HEIGHT - 2;
        d.vy = 0;
      }

      const grounded = collides(world, d.x, d.y - 0.02, d.z);
      if (grounded && d.vy <= 0) {
        d.vx *= Math.max(0, 1 - dt * 6);
        d.vz *= Math.max(0, 1 - dt * 6);
        if (Math.abs(d.vx) < 0.05) d.vx = 0;
        if (Math.abs(d.vz) < 0.05) d.vz = 0;
      }

      if (d.mesh) {
        d.mesh.position.set(d.x, d.y + 0.04 + Math.sin(d.age * 3.2) * 0.05, d.z);
        d.mesh.rotation.y = d.age * 2.1;
      }

      if (!player || !inv || d.age < PICK_DELAY) continue;
      const dx = player.pos.x - d.x;
      const dy = player.pos.y + 0.7 - d.y;
      const dz = player.pos.z - d.z;
      if (dx * dx + dy * dy + dz * dz > PICK_DIST * PICK_DIST) continue;
      if (!inv.canFit({ id: d.item, n: d.n, dura: d.dura })) continue;
      inv.add(d.item, d.n, d.dura);
      this.remove(d);
    }
  }

  serialize() {
    return this.list.map((d) => ({
      item: d.item,
      n: d.n,
      dura: d.dura,
      x: d.x, y: d.y, z: d.z,
      vx: d.vx, vy: d.vy, vz: d.vz,
      age: d.age,
    }));
  }

  load(data) {
    this.clear();
    if (!Array.isArray(data)) return;
    for (const raw of data) {
      if (!raw?.item || !raw.n) continue;
      const drop = this.spawn(raw.item, raw.n, raw.x, raw.y, raw.z, raw.vx, raw.vy, raw.vz, raw.dura);
      if (drop) drop.age = raw.age || PICK_DELAY;
    }
  }

  clear() {
    while (this.list.length) this.remove(this.list[0]);
  }

  dispose() {
    this.clear();
    this.group.parent?.remove(this.group);
  }
}
