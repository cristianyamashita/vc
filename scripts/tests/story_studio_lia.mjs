// Node 22.15+; npm install --prefix /tmp/story-studio-lia-qa three@0.164.1 gltf-validator
// node scripts/tests/story_studio_lia.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const characterId = process.argv[2] || 'lia';
assert(['lia', 'carmen', 'rui', 'tom'].includes(characterId));
const characterName = characterId[0].toUpperCase() + characterId.slice(1);
const modelId = `${characterId}-v1`;
const deps = process.env.SS_TEST_NODE_MODULES || '/tmp/story-studio-lia-qa/node_modules';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: pathToFileURL(`${deps}/three/build/three.module.js`).href, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return {
    url: pathToFileURL(`${deps}/three/examples/jsm/${specifier.slice(13)}`).href, shortCircuit: true,
  };
  return next(specifier, context);
} });
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url || input.href;
  if (url.startsWith('file:')) {
    try { const bytes = await readFile(new URL(url)); return new Response(bytes, { headers: { 'Content-Length': bytes.length } }); }
    catch { return new Response('', { status: 404 }); }
  }
  return nativeFetch(input, init);
};
globalThis.ProgressEvent = class { constructor(type, props) { Object.assign(this, { type }, props); } };
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((r) => {
    this.result = `data:${blob.type};base64,${Buffer.from(r).toString('base64')}`; this.onloadend?.();
  }); }
};
let downloaded = '';
const mockDocument = { createElement(tag) {
  assert.equal(tag, 'a'); return { click() { downloaded = this.download; } };
} };

const THREE = await import('three');
const { Registry } = await import('../../page/game/story-studio/js/library/registry.js');
const { buildCharacter, disposeCharacter } = await import('../../page/game/story-studio/js/cast/build.js');
const { applyPose } = await import('../../page/game/story-studio/js/anim/blend.js');
const { POSES } = await import('../../page/game/story-studio/js/anim/poses.js');
const { performAction } = await import('../../page/game/story-studio/js/anim/perform.js');
const { validate } = await import('../../page/game/story-studio/js/script/schema.js');
const { compile } = await import('../../page/game/story-studio/js/script/director.js');
const { groundLift } = await import('../../page/game/story-studio/js/anim/ground.js');
const modelURL = new URL(`../../page/game/story-studio/models/${characterId}/${characterId}.glb`, import.meta.url);
const initialModelBytes = await readFile(modelURL);
// A detached arm can have perfectly finite matrices and short triangle edges.
// Require an actual triangle path from the chest into both upper arms.
function assertConnectedShoulders(meshes, label, clothed = false) {
  const parent=[], marks=[], positions=new Map();
  const find=(a)=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  const unite=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  for(const mesh of meshes){
    const pos=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index;
    const offset=parent.length;
    for(let i=0;i<pos.count;i++){
      const id=offset+i,x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      parent.push(id);
      let bits=0;
      const skin=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
      for(let k=0;k<4;k++) if(weights.getComponent(i,k)>.85){
        const joint=mesh.skeleton.bones[skin.getComponent(i,k)].name;
        if(joint==='chest')bits|=1;
        if(joint==='lArm')bits|=2;
        if(joint==='rArm')bits|=4;
      }
      marks.push(bits);
      // glTF can duplicate a vertex at material/normal boundaries.
      const key=[x,y,z].map(v=>Math.round(v*1e6)).join(',');
      if(positions.has(key))unite(id,positions.get(key));else positions.set(key,id);
    }
    for(let i=0;i<(indices?.count||pos.count);i+=3){
      const a=offset+(indices?indices.getX(i):i);
      unite(a,offset+(indices?indices.getX(i+1):i+1));
      unite(a,offset+(indices?indices.getX(i+2):i+2));
    }
  }
  const components=new Map();
  marks.forEach((mark,i)=>{const root=find(i);components.set(root,(components.get(root)||0)|mark);});
  assert([...components.values()].includes(7),`${label}: chest and both arms must share a connected surface`);
}
const shoulderPoses=Object.fromEntries([45,90,135,170].map(deg=>[
  `armsSide${deg}`,{root:{},joints:{lArm:[-deg*Math.PI/180,0,0],rArm:[deg*Math.PI/180,0,0]}}
]));
shoulderPoses.armsForward170={root:{},joints:{lArm:[0,0,170*Math.PI/180],rArm:[0,0,170*Math.PI/180]}};
const posesToCheck={...POSES,...shoulderPoses};
const registry = await new Registry().loadOfficial();
assert.deepEqual(registry.problems, []);
const doc = registry.character(characterId);
assert.equal(validate(JSON.parse(JSON.stringify(doc))).doc.model, modelId, 'model survives JSON backup/import');
assert.equal(validate({ ...doc, model: 'https://invalid.example/model.glb' }).ok, false);
const second = buildCharacter(doc, doc.wardrobe.at(-1).id);
let samples = 0;
let maxEdgeGrowth = 0;
for (const wear of doc.wardrobe) {
  const root = buildCharacter(doc, wear.id);
  assert.equal(root.userData.model, modelId, wear.id);
  assert.equal(Object.keys(root.userData.pivots).length, 16);
  const meshes = [];
  root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  assert(meshes.length > 0);
  assert(meshes.some((o) => o.userData.wardrobe === wear.id));
  assert(meshes.every((o) => !o.userData.wardrobe || o.userData.wardrobe === wear.id), `only ${wear.id} is visible`);
  assert.notEqual(root.userData.pivots.head, second.userData.pivots.head, 'actors own their bones');
  for (const mesh of meshes) {
    assert(mesh.skeleton.bones.every((b) => root.getObjectById(b.id)), 'cloned skeleton belongs to this actor');
    const w = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < w.count; i++) {
      const sum = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
      assert(Math.abs(sum - 1) < 1e-5, 'normalized weights');
    }
  }
  assertConnectedShoulders(meshes.filter(m=>m.name.startsWith(`${characterName}_Body`)),`${wear.id}/skin`);
  if(['casual','shortsTee','dress','suit','shirt','overalls','pyjamas','military'].includes(wear.outfit))
    assertConnectedShoulders(meshes.filter(m=>m.userData.wardrobe===wear.id),`${wear.id}/sleeves`,true);
  for (const [poseName, pose] of Object.entries(posesToCheck)) {
    const rise = groundLift(root.userData.contacts, root.userData.chain, pose, doc.height);
    assert(Number.isFinite(rise));
    applyPose(root, pose); root.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const pos = mesh.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 37) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i);
        mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld);
        assert([p.x,p.y,p.z].every(Number.isFinite));
        assert(p.length() < 3.5, `${wear.id} has an exploding vertex`);
        samples++;
      }
      // Finite matrices alone miss a wrist accidentally welded to a thigh.
      // Detect long skin spikes by comparing deformed edges with rest edges.
      const deformed = new Float32Array(pos.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, v);
        deformed.set([v.x, v.y, v.z], i * 3);
      }
      const index = mesh.geometry.index;
      const edgeCount = index?.count || pos.count;
      for (let i = 0; i < edgeCount; i += 3) for (let e = 0; e < 3; e++) {
        const a = index ? index.getX(i + e) : i + e;
        const b = index ? index.getX(i + (e + 1) % 3) : i + (e + 1) % 3;
        const rest = Math.hypot(pos.getX(a)-pos.getX(b),pos.getY(a)-pos.getY(b),pos.getZ(a)-pos.getZ(b));
        const after = Math.hypot(deformed[a*3]-deformed[b*3],deformed[a*3+1]-deformed[b*3+1],deformed[a*3+2]-deformed[b*3+2]);
        const growth = after-rest; maxEdgeGrowth=Math.max(maxEdgeGrowth,growth);
        assert(growth < .12, `${wear.id}/${poseName}/${mesh.name}: skin spike ${growth.toFixed(3)} m; rest ${[pos.getX(a),pos.getY(a),pos.getZ(a)]} -> ${[pos.getX(b),pos.getY(b),pos.getZ(b)]}`);
      }
    }
  }
  const actionPoses = registry.list('action').filter(({ doc }) => doc.joints?.length || doc.pose);
  for (const { doc: action } of actionPoses) for (const time of [0,.3,.75,1.5]) {
    const pose = performAction(action, { speed: 1.2, side: 'left' }, time);
    applyPose(root, pose); root.updateMatrixWorld(true);
    assert(Object.values(root.userData.pivots).every((b) => b.matrixWorld.elements.every(Number.isFinite)));
  }
  // Hand attachment stays in the same coordinate frame as a voxel character.
  const voxel = buildCharacter({ ...doc, model: undefined }, wear.id);
  applyPose(root, POSES.stand); applyPose(voxel, POSES.stand);
  root.updateMatrixWorld(true); voxel.updateMatrixWorld(true);
  for (const [name, bone] of Object.entries(root.userData.pivots)) {
    const expected = voxel.userData.pivots[name].getWorldPosition(new THREE.Vector3());
    assert(bone.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-6, `${name}: original body-plan landmark`);
  }
  for (const pose of [POSES.stand, POSES.sit, POSES.crouch]) {
    applyPose(root, pose); applyPose(voxel, pose);
    root.updateMatrixWorld(true); voxel.updateMatrixWorld(true);
    const a = root.userData.pivots.rHand.getWorldPosition(new THREE.Vector3());
    const b = voxel.userData.pivots.rHand.getWorldPosition(new THREE.Vector3());
    assert(a.distanceTo(b) < 1e-6, 'held props use unchanged hand pivots');
  }
  assert.equal(second.userData.pivots.head.rotation.y, 0);
  disposeCharacter(voxel); disposeCharacter(root);
}
const rebuilt = buildCharacter(doc, 'casual');
assert(rebuilt.getObjectByName(`${characterName}_Body`).geometry.getAttribute('position').count > 1000, 'cache survives disposal');
assert.equal(buildCharacter(registry.character('ana')).userData.model, undefined, 'other cast remains voxel');

const bytes = new Uint8Array(await readFile(modelURL));
assert.deepEqual(bytes, new Uint8Array(initialModelBytes), 'model changed during validation; finish the Blender build before testing');
const validator = await import(pathToFileURL(`${deps}/gltf-validator/index.js`));
const result = await validator.default.validateBytes(bytes, { maxIssues: 100 });
assert.equal(result.issues.numErrors, 0, JSON.stringify(result.issues.messages.slice(0,5)));
globalThis.document = mockDocument;
const { exportCharacterGlb } = await import('../../page/game/story-studio/js/library/glb.js');
const exported = await exportCharacterGlb(doc);
assert.equal(downloaded, `${characterId}.glb`);
const exportedBytes = new Uint8Array(await exported.arrayBuffer());
const exportReport = await validator.default.validateBytes(exportedBytes, { maxIssues: 100 });
assert.equal(exportReport.issues.numErrors, 0, 'Export GLB generates a valid skinned file');
const jsonLength = new DataView(exportedBytes.buffer).getUint32(12, true);
const exportedDoc = JSON.parse(new TextDecoder().decode(exportedBytes.slice(20,20+jsonLength)));
assert(exportedDoc.skins?.length > 0, 'export retains deform bones');
assert(exportedDoc.nodes.filter((n) => n.extras?.wardrobe).every((n) => n.extras.wardrobe === doc.defaultOutfit));
const story = registry.get('story', `${characterId}-blender`);
const film = compile(story, {
  character: (id) => registry.character(id), action: (id) => registry.action(id),
  prop: (id) => registry.prop(id), anchor: () => null, placement: () => null,
});
assert(film.ok, JSON.stringify(film.errors));
for (let t=0; t<=film.film.duration; t+=.25) {
  const frame=film.film.sample(t);
  for(const state of Object.values(frame.actors)) {
    assert([state.x,state.y,state.z,state.yaw].every(Number.isFinite));
    applyPose(rebuilt,state.pose);rebuilt.updateMatrixWorld(true);
  }
}
assert(rebuilt.userData.contacts.length > 0, 'body contacts are available for grounding');
const report = { character: characterId, outfits: doc.wardrobe.length, bones: 16, poses: Object.keys(POSES).length,
  shoulderPoses: Object.keys(shoulderPoses).length, actions: registry.list('action').length, vertexSamples: samples, maxEdgeGrowth, glbBytes: bytes.length,
  exportedGlbBytes: exportedBytes.length, demoSeconds: film.film.duration,
  gltfErrors: result.issues.numErrors, gltfWarnings: result.issues.numWarnings,
  checks: ['wardrobe isolation', 'independent skeletons', 'normalized weights', 'finite deformations',
    'connected chest and arms', 'connected shirt and sleeves', 'raised-arm deformations',
    'no skin spikes over 12 cm', 'original body-plan landmarks', 'unchanged hand attachments', 'cache disposal', 'JSON round trip',
    'voxel regression', 'skinned GLB export', 'demo timeline seeking'] };
await writeFile(new URL(`../../page/game/story-studio/models/${characterId}/validation.json`, import.meta.url), JSON.stringify(report,null,2)+'\n');
disposeCharacter(second); disposeCharacter(rebuilt);
console.log(JSON.stringify(report,null,2));
