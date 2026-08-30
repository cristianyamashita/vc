import * as THREE from 'three';
import {
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL,
  STONE_PICK, STONE_AXE, STONE_SHOVEL,
  IRON_PICK, IRON_AXE, IRON_SHOVEL,
  STICK, TORCH, isBlock,
} from './blocks.js';

const SKIN = 0xc8a07a;
const SLEEVE = 0x3aa38f;

export class Arms {
  constructor(camera) {
    this.root = new THREE.Group();
    this.root.layers.set(1);
    camera.add(this.root);

    this.right = this.makeArm(0.28, -0.28, -0.38, 1);
    this.left = this.makeArm(-0.34, -0.36, -0.48, -1);
    this.tool = new THREE.Group();
    this.right.hand.add(this.tool);
    this.swing = 0;
    this.bob = 0;
    this.heldId = -1;
  }

  makeArm(x, y, z, side) {
    const arm = new THREE.Group();
    arm.position.set(x, y, z);
    arm.layers.set(1);
    const matSkin = new THREE.MeshLambertMaterial({ color: SKIN });
    const matCloth = new THREE.MeshLambertMaterial({ color: SLEEVE });
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.12), matCloth);
    upper.position.set(0, -0.1, 0);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.11), matSkin);
    lower.position.set(0, -0.36, 0.02);
    const hand = new THREE.Group();
    hand.position.set(0, -0.52, 0.04);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), matSkin);
    hand.add(fist);
    for (const m of [upper, lower, fist, arm, hand]) m.layers.set(1);
    arm.add(upper, lower, hand);
    arm.rotation.x = 0.35;
    arm.rotation.z = side * 0.12;
    this.root.add(arm);
    return { group: arm, hand, side };
  }

  punch() {
    this.swing = 1;
  }

  setHeld(id) {
    if (id === this.heldId) return;
    this.heldId = id;
    while (this.tool.children.length) {
      const ch = this.tool.children[0];
      this.tool.remove(ch);
      ch.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    if (!id) return;
    const mesh = makeToolMesh(id);
    if (mesh) {
      mesh.layers.set(1);
      mesh.traverse((o) => o.layers.set(1));
      this.tool.add(mesh);
    }
  }

  update(dt, walking, mining) {
    if (mining) this.swing = Math.max(this.swing, 0.4);
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.2);
    this.bob += dt * (walking ? 10 : 2);
    const swingX = Math.sin((1 - this.swing) * Math.PI) * 1.1;
    this.right.group.rotation.x = 0.25 + swingX;
    this.right.group.rotation.y = -0.15 - this.swing * 0.4;
    this.left.group.rotation.x = 0.45 + Math.sin(this.bob) * 0.04;
    this.root.position.y = Math.sin(this.bob) * (walking ? 0.025 : 0.008);
    this.root.position.x = Math.cos(this.bob * 0.5) * (walking ? 0.01 : 0);
  }
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.layers.set(1);
  return m;
}

function makeToolMesh(id) {
  const g = new THREE.Group();
  const wood = 0x8b5a2b;
  let head = 0xc4a060;
  if ([STONE_PICK, STONE_AXE, STONE_SHOVEL].includes(id)) head = 0x8e8e96;
  if ([IRON_PICK, IRON_AXE, IRON_SHOVEL].includes(id)) head = 0xc8ccd4;

  if ([WOOD_PICK, STONE_PICK, IRON_PICK].includes(id)) {
    g.add(box(0.035, 0.42, 0.035, wood, 0, 0.05, 0));
    g.add(box(0.22, 0.06, 0.05, head, 0, 0.24, 0));
    g.rotation.z = 0.5;
    g.rotation.x = 0.4;
    g.position.set(0.04, 0.02, -0.08);
  } else if ([WOOD_AXE, STONE_AXE, IRON_AXE].includes(id)) {
    g.add(box(0.035, 0.4, 0.035, wood, 0, 0.04, 0));
    g.add(box(0.14, 0.1, 0.04, head, 0.06, 0.2, 0));
    g.rotation.z = 0.45;
    g.rotation.x = 0.35;
    g.position.set(0.04, 0.02, -0.08);
  } else if ([WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL].includes(id)) {
    g.add(box(0.03, 0.4, 0.03, wood, 0, 0.04, 0));
    g.add(box(0.08, 0.1, 0.03, head, 0, 0.24, 0));
    g.rotation.z = 0.4;
    g.rotation.x = 0.3;
    g.position.set(0.03, 0.02, -0.06);
  } else if (id === STICK) {
    g.add(box(0.03, 0.28, 0.03, wood, 0, 0, 0));
    g.position.set(0.02, -0.02, -0.05);
  } else if (id === TORCH) {
    g.add(box(0.03, 0.22, 0.03, wood, 0, 0, 0));
    g.add(box(0.04, 0.04, 0.04, 0xffaa33, 0, 0.12, 0));
    g.position.set(0.02, 0, -0.05);
  } else if (isBlock(id)) {
    g.add(box(0.16, 0.16, 0.16, 0x8fbf6a, 0, 0, -0.04));
    g.position.set(0.03, -0.02, -0.06);
  } else {
    g.add(box(0.1, 0.1, 0.04, 0xdddddd, 0, 0, -0.03));
  }
  g.layers.set(1);
  return g;
}
