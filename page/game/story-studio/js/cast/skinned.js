import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { JOINT_ORDER, jointParent } from './rig.js';
import { CHARACTER_MODELS } from './models.js';
import { jointChain } from '../anim/ground.js';
import { resolvePaint, resolveFit } from './wardrobe.js';

const BASE = new URL('../../', import.meta.url);
const pending = new Map();
const models = new Map();

/** Load once before synchronous character builders (preview, film, export).
 * A rejected download is evicted so a later library refresh can retry it. */
export async function prepareCharacterModel(doc) {
  const id = doc?.model;
  const source = CHARACTER_MODELS[id];
  if (!source || models.has(id)) return;
  if (!pending.has(id)) {
    const job = Promise.all([
      new GLTFLoader().loadAsync(new URL(source.file, BASE).href),
      fetch(new URL(source.rig, BASE)).then((r) => {
        if (!r.ok) throw new Error(`Character rig: HTTP ${r.status}`);
        return r.json();
      }),
    ]).then(([gltf, metadata]) => {
      models.set(id, prepare(gltf.scene, metadata));
    }).finally(() => pending.delete(id));
    pending.set(id, job);
  }
  return pending.get(id);
}

function makeBones(joints, body) {
  const pivots = {};
  for (const name of JOINT_ORDER) {
    const j = joints[name];
    if (!j || ![j.x, j.y, j.z].every(Number.isFinite)) throw new Error(`Missing rig joint: ${name}`);
    const parent = jointParent(name);
    const pj = joints[parent];
    const b = new THREE.Bone();
    b.name = name;
    b.rotation.order = 'YXZ';
    b.position.set(j.x - (pj?.x || 0), j.y - (pj?.y || 0), j.z - (pj?.z || 0));
    (pivots[parent] || body).add(b);
    pivots[name] = b;
  }
  return pivots;
}

function prepare(scene, metadata) {
  if (metadata.rig !== 'story-studio-v1' || !(metadata.height > 0)) throw new Error('Unsupported character rig');
  scene.updateMatrixWorld(true);
  const template = new THREE.Group();
  const pivots = makeBones(metadata.joints, template);
  template.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(JOINT_ORDER.map((n) => pivots[n]));
  const bounds = new Map();
  let count = 0;
  scene.traverse((original) => {
    if (!original.isSkinnedMesh) return;
    count++;
    // Bake Blender's object/bone basis into the rest geometry. Animation then
    // uses the exact same +X-facing, YXZ bones as voxel actors, with no Euler
    // offsets or per-action retargeting. Keep the exported smooth skin weights.
    const geometry = original.geometry.clone().applyMatrix4(original.matrixWorld);
    const oldIndices = geometry.getAttribute('skinIndex');
    const weights = geometry.getAttribute('skinWeight');
    const positions = geometry.getAttribute('position');
    const indices = new Uint16Array(oldIndices.count * 4);
    const mapping = original.skeleton.bones.map((b) => JOINT_ORDER.indexOf(b.name));
    for (let i = 0; i < oldIndices.count; i++) {
      let dominant = 0;
      let largest = -1;
      for (let k = 0; k < 4; k++) {
        const nameIndex = mapping[oldIndices.getComponent(i, k)];
        const w = weights.getComponent(i, k);
        if (w > 0 && (nameIndex === undefined || nameIndex < 0)) throw new Error('GLB contains an unmapped deform bone');
        indices[i * 4 + k] = Math.max(0, nameIndex ?? 0);
        if (w > largest) { largest = w; dominant = indices[i * 4 + k]; }
      }
      // Conservative contact bounds use the actual body, not voxel dimensions.
      // Fabric and hair do not lift a seated actor off their chair.
      if (original.userData.bodyContact === true || /^Lia_(Body|Face|Arm_|Hand_)/.test(original.name)) {
        const name = JOINT_ORDER[dominant];
        if (!bounds.has(name)) bounds.set(name, new THREE.Box3());
        bounds.get(name).expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i));
      }
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    const mesh = new THREE.SkinnedMesh(geometry, original.material);
    mesh.name = original.name;
    let garment = original;
    while (garment && !garment.userData.wardrobe) garment = garment.parent;
    mesh.userData = { ...original.userData, wardrobe: garment?.userData.wardrobe,
      sharedCharacterGeometry: true };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Deformation changes the bounds at every seek; rest-pose culling would
    // make a crawling or waving actor disappear near the edge of the camera.
    mesh.frustumCulled = false;
    template.add(mesh);
    mesh.bind(skeleton);
    mesh.normalizeSkinWeights();
  });
  if (!count) throw new Error('Character GLB has no skinned meshes');
  const contacts = [];
  for (const [limb, b] of bounds) {
    const j = metadata.joints[limb];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      contacts.push({ limb, p: [x - j.x, y - j.y, z - j.z] });
    }
  }
  // Original imported buffers are no longer used. Materials stay in the cache.
  const originals = new Set();
  scene.traverse((o) => { if (o.geometry) originals.add(o.geometry); });
  originals.forEach((g) => g.dispose());
  return { template, metadata, contacts };
}

export function buildSkinnedCharacter(doc, wear) {
  const model = models.get(doc?.model);
  if (!model) return null;
  const { metadata } = model;
  const paint = resolvePaint(wear.outfit, wear.paint);
  // The voxel painting/sculpt tools address voxel cells, not a GLB's topology.
  // Preserve their behavior when an edited document asks for those features.
  if (Object.keys(paint?.spray || {}).length || resolveFit(wear.outfit)?.swell
    || Object.keys(doc.regions || {}).length) return null;
  // Outfit ids belong to a character; the garment type belongs to the model.
  // This also supports "try on" and copies whose wardrobe ids have changed.
  const garment = Object.keys(metadata.wardrobe).find((id) => metadata.wardrobe[id] === wear.outfit);
  if (!garment) return null;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const instance = clone(model.template);
  const scale = (doc.height || metadata.height) / metadata.height;
  instance.scale.setScalar(scale);
  body.add(instance);
  const color = wear.paint && paint ? paint.color : wear.color;
  const pivots = {};
  const removed = [];
  const materials = new Map();
  instance.traverse((o) => {
    if (o.isBone) pivots[o.name] = o;
    if (!o.isMesh) return;
    if (o.userData.wardrobe && o.userData.wardrobe !== garment) { removed.push(o); return; }
    const copyMaterial = (source) => {
      if (materials.has(source)) return materials.get(source);
      const m = source.clone();
      // Garment base-color roles were authored in Blender's custom properties.
      if ((source.userData.colorRole === 'main' || /^(Cloth|Seam)_/.test(source.name)) && color) m.color.set(color);
      materials.set(source, m);
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(copyMaterial) : copyMaterial(o.material);
  });
  removed.forEach((o) => o.removeFromParent());
  const joints = Object.fromEntries(Object.entries(metadata.joints).map(([n, j]) =>
    [n, { x: j.x * scale, y: j.y * scale, z: j.z * scale }]));
  root.userData = {
    model: doc.model, pivots, body, height: doc.height || metadata.height,
    hipY: joints.hips.y, chain: jointChain(joints),
    contacts: model.contacts.map((p) => ({ limb: p.limb, p: p.p.map((x) => x * scale) })),
    ownedMaterials: [...materials.values()],
  };
  return root;
}
