import * as THREE from 'three';
import {
  WOOD_PICK, WOOD_AXE, WOOD_SHOVEL, WOOD_SWORD,
  STONE_PICK, STONE_AXE, STONE_SHOVEL, STONE_SWORD,
  IRON_PICK, IRON_AXE, IRON_SHOVEL, IRON_SWORD,
  GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_SWORD,
  STICK, TORCH, LASSO, REVOLVER, BOW, COMPASS,
  isFlower,
} from './blocks.js';
import { buildVoxGeometry, shadeHex } from './voxmodel.js';
import { itemMesh, isBlockMesh, initItemModels, legacyHold } from './itemmodels.js';
import { isOriginal } from './quality.js';

const SKIN = 0xc8a07a;
const SLEEVE = 0x3aa38f;

// Held gear is baked to one merged, cached geometry per item, so switching
// hotbar slots never rebuilds meshes or uploads new buffers mid-game.
const HELD_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

// First-person rest pose. The shoulder sits just below and beside the camera,
// the upper arm drops down and forward from it, and the elbow bends so the
// forearm rises back into frame. Without that bend the limb reads as a
// straight bar hinged behind the player, and the fist ends up below the
// screen while the held item floats on its own.
const SHOULDER = { x: 0.45, y: -0.30, z: -0.10 };
const REST_ARM_X = 0.62;
const REST_ELBOW = 1.78;
// The forearm swings inwards from the elbow, not the shoulder, so the fist
// crosses towards the middle of the screen and the limb reads as a diagonal
// coming out of the corner.
const REST_ELBOW_Z = 0.45;

function restGrip(arm) {
  // Items are authored in camera space, so the group they hang from cancels
  // out the arm's rest rotation: at rest the item is framed exactly as
  // before, and during a swing it travels with the fist.
  const q = new THREE.Quaternion().setFromEuler(arm.group.rotation);
  q.multiply(new THREE.Quaternion().setFromEuler(arm.elbow.rotation));
  return q.invert();
}

export class Arms {
  constructor(camera, atlas) {
    this.root = new THREE.Group();
    this.root.layers.set(1);
    camera.add(this.root);
    initItemModels(atlas);
    this.swing = 0;
    this.bob = 0;
    this.build();
  }

  build() {
    this.ownGeo = [];
    this.right = this.makeArm(SHOULDER.x, SHOULDER.y, SHOULDER.z, 1);
    this.left = this.makeArm(-SHOULDER.x - 0.03, SHOULDER.y - 0.04, SHOULDER.z, -1);
    // The held item hangs off the fist, so hand and gear move as one. Each
    // fist gets a fixed anchor; the mount group inside it is emptied whenever
    // the item changes, so nothing that must survive a swap lives in there.
    this.toolHold = new THREE.Group();
    this.toolHold.quaternion.copy(restGrip(this.right));
    this.toolHold.layers.set(1);
    this.right.hand.add(this.toolHold);
    this.offHold = new THREE.Group();
    this.offHold.quaternion.copy(restGrip(this.left));
    this.offHold.layers.set(1);
    this.left.hand.add(this.offHold);
    this.tool = new THREE.Group();
    this.tool.position.set(0.01, 0.05, -0.05);
    this.toolHold.add(this.tool);
    this.offTool = new THREE.Group();
    this.offHold.add(this.offTool);
    this.ropeGrip = new THREE.Object3D();
    this.ropeGrip.position.set(0.06, 0.06, -0.11);
    this.toolHold.add(this.ropeGrip);
    this.offRopeGrip = new THREE.Object3D();
    this.offRopeGrip.position.set(-0.04, 0.05, -0.09);
    this.offHold.add(this.offRopeGrip);
    this._gripWorld = new THREE.Vector3();
    this.heldId = -1;
    this.offId = -1;
  }

  /**
   * World position of the held item in the right hand, or the off-hand
   * grip when `mainHand` is false. Used so a lasso rope leaves the fist
   * instead of the player's waist.
   */
  heldWorld(mainHand = true) {
    const grip = mainHand ? this.ropeGrip : this.offRopeGrip;
    return grip.getWorldPosition(this._gripWorld);
  }

  /**
   * Rebuild the arms and whatever they are holding, keeping the current
   * items. Used when the graphics quality changes under us.
   */
  rebuild() {
    const held = this.heldId > 0 ? this.heldId : 0;
    const off = this.offId > 0 ? this.offId : 0;
    this.root.remove(this.right.group, this.left.group);
    for (const geo of this.ownGeo) geo.dispose();
    this.build();
    this.setHeld(held);
    this.setOffhand(off);
  }

  makeArm(x, y, z, side) {
    const arm = new THREE.Group();
    arm.position.set(x, y, z);
    arm.layers.set(1);
    const old = isOriginal();
    const sleeve = new THREE.Mesh(buildVoxGeometry(old ? [
      { w: 0.12, h: 0.22, d: 0.12, color: SLEEVE, x: 0, y: -0.05, z: 0, flat: true, grain: 0 },
    ] : [
      { w: 0.13, h: 0.2, d: 0.13, color: SLEEVE, x: 0, y: -0.04, z: 0, n: 2, grain: 0.05 },
      { w: 0.135, h: 0.04, d: 0.135, color: shadeHex(SLEEVE, 0.82), x: 0, y: -0.15, z: 0, detail: true },
    ]), HELD_MAT);
    // Everything below the elbow is parented to a joint so the forearm can
    // fold up towards the camera instead of continuing the upper arm's line.
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.16, 0);
    const forearm = new THREE.Mesh(buildVoxGeometry(old ? [
      { w: 0.11, h: 0.3, d: 0.11, color: SKIN, x: 0, y: -0.19, z: 0, flat: true, grain: 0 },
    ] : [
      { w: 0.105, h: 0.26, d: 0.105, color: SKIN, x: 0, y: -0.17, z: 0, grain: 0.04 },
    ]), HELD_MAT);
    const hand = new THREE.Group();
    hand.position.set(0, -0.36, 0.01);
    const fist = new THREE.Mesh(buildVoxGeometry(old ? [
      { w: 0.1, h: 0.1, d: 0.1, color: SKIN, x: 0, y: 0, z: 0, flat: true, grain: 0 },
    ] : [
      { w: 0.105, h: 0.1, d: 0.11, color: SKIN, x: 0, y: 0, z: 0, grain: 0.05 },
      { w: 0.045, h: 0.055, d: 0.05, color: shadeHex(SKIN, 0.94), x: side * 0.05, y: 0.02, z: 0.03, detail: true },
    ]), HELD_MAT);
    hand.add(fist);
    for (const m of [sleeve, forearm, fist, arm, hand, elbow]) m.layers.set(1);
    this.ownGeo.push(sleeve.geometry, forearm.geometry, fist.geometry);
    elbow.add(forearm, hand);
    arm.add(sleeve, elbow);
    arm.rotation.x = REST_ARM_X;
    elbow.rotation.x = REST_ELBOW;
    elbow.rotation.z = -side * REST_ELBOW_Z;
    this.root.add(arm);
    return { group: arm, elbow, hand, side };
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
    // Meshes are thrown away, but their geometry and material are cached and
    // shared, so nothing is disposed here.
    while (group.children.length) group.remove(group.children[0]);
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
      GOLD_PICK, GOLD_AXE, GOLD_SHOVEL, GOLD_SWORD,
      LASSO, REVOLVER, BOW,
    ].includes(this.heldId);
    // A swing drops the shoulder forward and straightens the elbow, so the
    // fist punches out and down instead of the whole limb pivoting.
    const restElbow = (holdingTool ? REST_ELBOW : REST_ELBOW - 0.2) + Math.sin(this.bob) * 0.02;
    this.right.group.rotation.x = REST_ARM_X + swingX * 0.35;
    this.right.group.rotation.y = -0.08 - this.swing * 0.2;
    this.right.elbow.rotation.x = restElbow - swingX * 0.8;
    this.tool.rotation.x = -0.04 - this.swing * 0.3;
    this.left.group.rotation.x = REST_ARM_X + Math.sin(this.bob) * 0.04;
    this.left.elbow.rotation.x = REST_ELBOW - 0.24 + (this.offId ? 0.12 : 0)
      + Math.sin(this.bob) * 0.03;
    this.root.position.y = Math.sin(this.bob) * (walking ? 0.025 : 0.008);
    this.root.position.x = Math.cos(this.bob * 0.5) * (walking ? 0.01 : 0);
  }
}

// A held block shows its real atlas faces instead of a stand-in colour cube.
function makeToolMesh(id) {
  const mesh = itemMesh(id);
  if (isBlockMesh(id)) {
    mesh.position.set(0.03, -0.02, -0.06);
    mesh.rotation.set(0.2, 0.7, 0);
    return mesh;
  }
  const old = legacyHold(id);
  if (old) {
    mesh.rotation.set(old.rot[0], old.rot[1], old.rot[2]);
    mesh.position.set(old.pos[0], old.pos[1], old.pos[2]);
    mesh.scale.setScalar(old.scale);
    return mesh;
  }
  applyHold(mesh, id);
  return mesh;
}

function applyHold(mesh, id) {
  // Tools are aimed the way they are actually used: pick and axe head swung
  // forward at the block ahead, shovel blade turned down at the ground.
  if ([WOOD_PICK, STONE_PICK, IRON_PICK, GOLD_PICK].includes(id)) {
    mesh.rotation.set(0.3, -1.2, 0.5);
    mesh.position.set(0.06, -0.02, -0.06);
  } else if ([WOOD_AXE, STONE_AXE, IRON_AXE, GOLD_AXE].includes(id)) {
    mesh.rotation.set(0.28, 0.85, 0.5);
    mesh.position.set(0.1, -0.05, -0.12);
    mesh.scale.setScalar(0.75);
  } else if ([WOOD_SHOVEL, STONE_SHOVEL, IRON_SHOVEL, GOLD_SHOVEL].includes(id)) {
    mesh.rotation.set(-2.0, 0, 0.35);
    mesh.position.set(0.12, -0.04, 0.0);
  } else if ([WOOD_SWORD, STONE_SWORD, IRON_SWORD, GOLD_SWORD].includes(id)) {
    mesh.rotation.set(0.25, 0, 0.45);
    mesh.position.set(0.03, 0.02, -0.06);
  } else if (id === LASSO) {
    mesh.rotation.set(0.2, 0, 0.35);
    mesh.position.set(0.03, 0.02, -0.05);
  } else if (id === REVOLVER) {
    mesh.rotation.set(0.15, 0.15, 0);
    mesh.position.set(0.02, 0.02, -0.08);
  } else if (id === BOW) {
    mesh.rotation.set(0.1, 0, 0.15);
    mesh.position.set(0.02, 0.02, -0.06);
  } else if (id === COMPASS) {
    mesh.rotation.set(-1.05, 0, 0.08);
    mesh.position.set(0.04, -0.01, -0.07);
  } else if (id === STICK || id === TORCH || isFlower(id)) {
    mesh.position.set(0.02, -0.02, -0.05);
  } else {
    mesh.position.set(0.03, -0.02, -0.05);
  }
}

