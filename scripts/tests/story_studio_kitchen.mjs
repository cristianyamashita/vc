// Node 22.15+; reuses three@0.164.1 from SS_TEST_NODE_MODULES or /tmp/story-studio-lia-qa/node_modules.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
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

const THREE=await import('three');
const {Registry}=await import('../../page/game/story-studio/js/library/registry.js');
const {compile}=await import('../../page/game/story-studio/js/script/director.js');
const {buildSet}=await import('../../page/game/story-studio/js/stage/build.js');
const {buildCharacter}=await import('../../page/game/story-studio/js/cast/build.js');
const {applyPose}=await import('../../page/game/story-studio/js/anim/blend.js');
const {groundLift}=await import('../../page/game/story-studio/js/anim/ground.js');
const registry=await new Registry().loadOfficial();
assert.deepEqual(registry.problems,[]);
const story=JSON.parse(await readFile(new URL('../../page/game/story-studio/_local/stories/kitchen-family-dinner.json', import.meta.url), 'utf8'));
assert.equal(story.id,'kitchen-family-dinner');
const set=await buildSet(registry.get('set',story.set),story.setEdits,id=>registry.prop(id));
assert.deepEqual(set.missing,[]);
const world={character:id=>registry.character(id),action:id=>registry.action(id),prop:id=>registry.prop(id),anchor:(id,n)=>set.anchor(id,n),placement:id=>set.placements.get(id)?.placement};
const result=compile(story,world);
assert.equal(result.ok,true,JSON.stringify(result.errors));
assert.deepEqual(result.warnings,[]);
const film=result.film;
const meshes=new Map(story.cast.map(c=>[c.id,buildCharacter(registry.character(c.character),c.outfit)]));
for(const [id,m] of meshes)assert.equal(m.userData.model,`${id}-v1`);
function sample(t){
 const frame=film.sample(t);
 for(const [id,m] of meshes){const a=frame.actors[id];m.position.set(a.x,a.y,a.z);m.rotation.y=-a.yaw;
 const rise=groundLift(m.userData.contacts,m.userData.chain,a.pose,m.userData.height);
 applyPose(m,{root:{...a.pose.root,lift:(a.pose.root.lift||0)+rise/m.userData.height},joints:a.pose.joints});m.updateMatrixWorld(true);}
 return frame;
}
// Validate the shipped documents, not an embedded copy of the scene.
assert.equal(film.duration,65);
assert.deepEqual(story.cast.map(c=>c.character).sort(),['carmen','lia','rui','tom']);
for(const id of ['kitchen-stove','kitchen-sink','kitchen-fridge','kitchen-counter','kitchen-table'])assert(registry.prop(id));
const actionIds=['chopFood','stirPot','washFood','mixSalad','carryDish','carryDishTo','serveFood','eatMeal'];
for(const id of actionIds){const a=registry.action(id);assert(a);for(const lang of ['en','pt','ja'])assert(a.name[lang]);}
for(const pr of film.propIds())assert(registry.prop(pr),pr);
const initial=sample(5);
assert.equal(initial.actors.rui.holds,'kitchen-knife');
assert.equal(initial.actors.carmen.holds,'cooking-spoon');
assert.equal(initial.actors.tom.holds,'cooking-spoon');
assert(!initial.stage.hidden.has('water'));
for(const id of ['rui','carmen','lia','tom'])assert(initial.stage.hidden.has('meal.'+id));
assert(sample(24).stage.hidden.has('water'));
for(const id of ['rui','carmen'])assert.equal(registry.action(story.timeline.find(e=>e.actor===id&&e.do==='carryDishTo').do).type,'move');
// Contact checks for the tool tips in real world metres, after posing the
// actual skinned models and applying the same ground clamp as Playback.
function toolPoint(id,t,local){const frame=sample(t),m=meshes.get(id),a=frame.actors[id],pr=registry.prop(a.holds),g=pr.anchors.grip;
 const p=new THREE.Vector3(...local).sub(new THREE.Vector3(...g.pos));
 p.applyEuler(new THREE.Euler((g.roll||0)*Math.PI/180,(g.yaw||0)*Math.PI/180,(g.pitch||0)*Math.PI/180,'YXZ'));
 return m.userData.pivots[a.hand==='left'?'lHand':'rHand'].localToWorld(p);}
const knife=toolPoint('rui',5,[0,-.245,0]);
assert(Math.abs(knife.y-.985)<.05 && Math.abs(knife.x+2.16)<.15 && Math.abs(knife.z+2.60)<.15,'knife must meet the chopping board');
const spoon=toolPoint('carmen',5,[0,-.14,0]);
assert(spoon.y>1.0&&spoon.y<1.25&&Math.hypot(spoon.x+.93,spoon.z+2.55)<.20,'spoon must enter the pot');
const salad=toolPoint('tom',5,[0,-.14,0]);
assert(salad.y>.82&&salad.y<1.01&&Math.hypot(salad.x+1.10,salad.z-.47)<.20,'salad spoon must meet the bowl');
for(const [i,id] of ['rui','carmen','lia','tom'].entries()){
 const peak=41+i*.23+1.6,tip=toolPoint(id,peak,[0,.13,0]),m=meshes.get(id);
 const mouth=m.userData.pivots.head.localToWorld(new THREE.Vector3(.1,.046,0));
 assert(tip.distanceTo(mouth)<.085,`${id}: fork reaches the mouth (${tip.distanceTo(mouth)})`);
 const f=sample(44),hip=m.userData.pivots.hips.getWorldPosition(new THREE.Vector3());
 assert(Math.abs(hip.y-set.anchor('chair.'+id,'seat').pos[1])<.015,`${id}: hips meet seat`);
 assert.equal(f.actors[id].holds,'dinner-fork');
 assert(f.stage.hidden.has('plate.'+id)&&!f.stage.hidden.has('meal.'+id));
}
// The eating elbow must remain outside and in front of the shoulder for
// the whole cycle; matching the fork tip alone can fold the arm into the body.
for(let phase=0;phase<=3.2;phase+=.1){
 for(const [i,id] of ['rui','carmen','lia','tom'].entries()){
  sample(44.2+i*.23+phase);
  const m=meshes.get(id),h=m.userData.height;
  const shoulder=m.worldToLocal(m.userData.pivots.rArm.getWorldPosition(new THREE.Vector3()));
  const elbow=m.worldToLocal(m.userData.pivots.rFore.getWorldPosition(new THREE.Vector3()));
  assert(elbow.z<shoulder.z-.048*h,`${id}: eating elbow stays outside the torso at ${phase}`);
  assert(elbow.x>shoulder.x+.08*h,`${id}: eating elbow stays in front of the torso at ${phase}`);
 }
}
// Every frame stays finite, and sampling backwards has no compiler memory.
for(let t=0;t<=65;t+=.25){const f=film.sample(t);for(const a of Object.values(f.actors)){
 assert([a.x,a.y,a.z,a.yaw,...Object.values(a.pose.root),...Object.values(a.pose.joints).flat()].every(Number.isFinite));}}
function plain(t){const f=film.sample(t);return JSON.stringify({...f,stage:{sky:f.stage.sky,hidden:[...f.stage.hidden],moved:[...f.stage.moved]}});}
const before=plain(5);sample(60);assert.equal(plain(5),before);
// Exercise the actual Playback path with rendering stubbed. A moved platter
// must return to the counter on rewind, and reset its yaw as well.
const {Playback}=await import('../../page/game/story-studio/js/render/playback.js');
const playback=Object.create(Playback.prototype);
Object.assign(playback,{time:44,film,set,actors:new Map(),stage:{sky:film.sky,setSky(){},aim(){},applyLamps(){}},balloons:{update(){}},applyGroupProps(){},gatherLamps(){return[]},render(){}});
playback.apply();assert.notDeepEqual(set.placements.get('platter').object.position.toArray(),set.placements.get('platter').placement.at);
set.placements.get('platter').object.rotation.y=1.2;
playback.time=0;playback.apply();
assert.equal(set.placements.get('platter').object.rotation.y,set.placements.get('platter').placement.yaw*Math.PI/180);
for(const id of ['platter','pasta','salad'])assert.deepEqual(set.placements.get(id).object.position.toArray(),set.placements.get(id).placement.at,`${id}: resets on backward seek`);
// New actions and scene remain normal JSON documents in exported bundles.
const {validate}=await import('../../page/game/story-studio/js/script/schema.js');
const roundtrip=validate(JSON.parse(JSON.stringify(story)),{actions:registry.actionMap()});
assert.equal(roundtrip.ok,true);assert.equal(roundtrip.doc.timeline.length,story.timeline.length);
// Compile every existing shipped film to catch regression in seated poses.
let films=0;
for(const {doc} of registry.list('story')){
 const stage=await buildSet(registry.get('set',doc.set),doc.setEdits,id=>registry.prop(id));
 const result=compile(doc,{...world,anchor:(id,n)=>stage.anchor(id,n),placement:id=>stage.placements.get(id)?.placement});
 assert(result.ok,`${doc.id}: ${JSON.stringify(result.errors)}`);films++;
}
console.log(`PASS: kitchen + 4 Blender characters, 8 actions, tool contacts, elbow clearance, seated heights, meal sequence, 261 timeline samples, rewind, JSON round-trip and ${films} story compilations.`);
