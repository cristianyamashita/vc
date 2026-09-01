import * as THREE from 'three';
import {
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
  STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
  IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
  STICK, TORCH, RAW_MEAT, COOKED_MEAT, FRUIT, COOKED_FRUIT,
  HIDE_COW, HIDE_ZEBRA, HIDE_SHEEP, DOOR, DOOR_DOUBLE,
  FLOWER_RED, FLOWER_YELLOW, FLOWER_WHITE,
  LASSO, REVOLVER, BOW,
  isBlock, isFlower,
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
    this.toolHold = new THREE.Group();
    this.toolHold.position.set(0.24, -0.06, -0.4);
    this.toolHold.layers.set(1);
    this.root.add(this.toolHold);
    this.tool = new THREE.Group();
    this.offTool = new THREE.Group();
    this.toolHold.add(this.tool);
    this.left.hand.add(this.offTool);
    this.swing = 0;
    this.bob = 0;
    this.heldId = -1;
    this.offId = -1;
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
    this.heldId = this.mountHeld(this.tool, this.heldId, id, 1);
  }

  setOffhand(id) {
    this.offId = this.mountHeld(this.offTool, this.offId, id, -1);
  }

  mountHeld(group, prev, id, side) {
    if (id === prev) return prev;
    while (group.children.length) {
      const ch = group.children[0];
      group.remove(ch);
      ch.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    if (!id) return 0;
    const mesh = makeToolMesh(id);
    if (mesh) {
      mesh.layers.set(1);
      mesh.traverse((o) => o.layers.set(1));
      if (side < 0) {
        mesh.rotation.z *= -1;
        mesh.position.x *= -1;
      }
      group.add(mesh);
    }
    return id;
  }

  update(dt, walking, mining) {
    if (mining) this.swing = Math.max(this.swing, 0.4);
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.2);
    this.bob += dt * (walking ? 10 : 2);
    const swingX = Math.sin((1 - this.swing) * Math.PI) * 1.1;
    const holdingTool = [
      WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
      STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
      IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
      LASSO, REVOLVER, BOW,
    ].includes(this.heldId);
    const restX = holdingTool ? 0.48 : 0.22;
    this.right.group.rotation.x = restX + swingX * 0.85;
    this.right.group.rotation.y = -0.12 - this.swing * 0.35;
    this.toolHold.rotation.x = -0.05 - this.swing * 0.9;
    this.toolHold.rotation.y = -0.12;
    this.toolHold.rotation.z = 0.08;
    this.left.group.rotation.x = 0.45 + Math.sin(this.bob) * 0.04 - (this.offId ? 0.12 : 0);
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
    g.add(box(0.028, 0.58, 0.028, wood, 0, 0.22, 0));
    g.add(box(0.08, 0.12, 0.08, head, 0, 0.48, 0));
    g.add(box(0.24, 0.16, 0.05, head, 0.12, 0.5, 0.02));
    g.rotation.set(0.05, 0.45, 0.08);
    g.position.set(0.04, 0.02, 0);
    g.scale.setScalar(1.2);
  } else if ([WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL].includes(id)) {
    g.add(box(0.03, 0.4, 0.03, wood, 0, 0.04, 0));
    g.add(box(0.08, 0.1, 0.03, head, 0, 0.24, 0));
    g.rotation.z = 0.4;
    g.rotation.x = 0.3;
    g.position.set(0.03, 0.02, -0.06);
  } else if ([WOOD_SWORD, STONE_SWORD, IRON_SWORD].includes(id)) {
    if ([STONE_SWORD].includes(id)) head = 0x8e8e96;
    if ([IRON_SWORD].includes(id)) head = 0xc8ccd4;
    g.add(box(0.03, 0.22, 0.03, wood, 0, -0.04, 0));
    g.add(box(0.08, 0.04, 0.03, 0xc4a060, 0, 0.08, 0));
    g.add(box(0.05, 0.32, 0.02, head, 0, 0.26, 0));
    g.rotation.z = 0.45;
    g.rotation.x = 0.25;
    g.position.set(0.03, 0.02, -0.06);
  } else if (id === LASSO) {
    g.add(box(0.16, 0.03, 0.16, 0xc4a060, 0, 0.12, 0));
    g.add(box(0.12, 0.03, 0.12, 0x8a5a28, 0, 0.12, 0));
    g.add(box(0.03, 0.22, 0.03, 0xc4a060, 0.08, 0, 0));
    g.rotation.z = 0.35;
    g.rotation.x = 0.2;
    g.position.set(0.03, 0.02, -0.05);
  } else if (id === REVOLVER) {
    g.add(box(0.04, 0.12, 0.05, 0x6a4a28, 0, -0.04, 0.02));
    g.add(box(0.05, 0.06, 0.16, 0x3a3a42, 0, 0.04, -0.04));
    g.add(box(0.03, 0.03, 0.14, 0x8a8a96, 0, 0.055, -0.06));
    g.add(box(0.07, 0.07, 0.04, 0x2a2a30, 0, 0.01, 0.04));
    g.rotation.x = 0.15;
    g.rotation.y = 0.15;
    g.position.set(0.02, 0.02, -0.08);
  } else if (id === BOW) {
    g.add(box(0.03, 0.36, 0.03, 0x8a5a28, 0, 0.04, 0));
    g.add(box(0.02, 0.02, 0.14, 0xe8e0d0, 0, 0.2, -0.06));
    g.add(box(0.02, 0.02, 0.14, 0xe8e0d0, 0, -0.12, -0.06));
    g.add(box(0.015, 0.32, 0.015, 0xe8e0d0, 0, 0.04, -0.12));
    g.rotation.z = 0.15;
    g.rotation.x = 0.1;
    g.position.set(0.02, 0.02, -0.06);
  } else if (id === STICK) {
    g.add(box(0.03, 0.28, 0.03, wood, 0, 0, 0));
    g.position.set(0.02, -0.02, -0.05);
  } else if (id === TORCH) {
    g.add(box(0.03, 0.22, 0.03, wood, 0, 0, 0));
    g.add(box(0.04, 0.04, 0.04, 0xffaa33, 0, 0.12, 0));
    g.position.set(0.02, 0, -0.05);
  } else if (isFlower(id)) {
    const petal = id === FLOWER_RED ? 0xd22d37 : id === FLOWER_YELLOW ? 0xe6be28 : 0xf0f0f4;
    g.add(box(0.02, 0.18, 0.02, 0x2e8a38, 0, 0.02, 0));
    g.add(box(0.08, 0.06, 0.08, petal, 0, 0.14, 0));
    g.position.set(0.02, -0.02, -0.05);
  } else if (id === RAW_MEAT) {
    g.add(box(0.12, 0.07, 0.08, 0xc45a5a, 0, 0, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === COOKED_MEAT) {
    g.add(box(0.12, 0.07, 0.08, 0x7a3e22, 0, 0, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === FRUIT) {
    g.add(box(0.08, 0.08, 0.08, 0xc83228, 0, 0.02, -0.03));
    g.add(box(0.03, 0.05, 0.03, 0x3a8a32, 0, 0.08, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === COOKED_FRUIT) {
    g.add(box(0.08, 0.08, 0.08, 0xc47828, 0, 0.02, -0.03));
    g.add(box(0.05, 0.05, 0.05, 0x8a4a14, 0, 0.02, -0.03));
    g.add(box(0.03, 0.05, 0.03, 0x3a8a32, 0, 0.08, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === HIDE_COW) {
    g.add(box(0.16, 0.02, 0.12, 0x7a4e2e, 0, 0, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === HIDE_ZEBRA) {
    g.add(box(0.16, 0.02, 0.12, 0xf0ece4, 0, 0, -0.03));
    g.add(box(0.04, 0.025, 0.12, 0x1a1816, -0.04, 0, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === HIDE_SHEEP) {
    g.add(box(0.16, 0.03, 0.12, 0xe8e4d8, 0, 0, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (id === DOOR || id === DOOR_DOUBLE) {
    g.add(box(0.12, 0.28, 0.04, 0xa87838, 0, 0.02, -0.03));
    if (id === DOOR_DOUBLE) g.add(box(0.12, 0.28, 0.04, 0xa87838, 0.1, 0.02, -0.03));
    g.position.set(0.03, -0.02, -0.05);
  } else if (isBlock(id)) {
    g.add(box(0.16, 0.16, 0.16, 0x8fbf6a, 0, 0, -0.04));
    g.position.set(0.03, -0.02, -0.06);
  } else {
    g.add(box(0.1, 0.1, 0.04, 0xdddddd, 0, 0, -0.03));
  }
  g.layers.set(1);
  return g;
}
