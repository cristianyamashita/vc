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

const {validate}=await import('../../page/game/story-studio/js/script/schema.js');
const {performAction,basePose}=await import('../../page/game/story-studio/js/anim/perform.js');
const {sampleKeys}=await import('../../page/game/story-studio/js/anim/keyframes.js');
const {sampleFrames,encodeFrames,bakeMotion,upsertFrame}=await import('../../page/game/story-studio/js/ui/actionframes.js');
const {JOINT_NAMES}=await import('../../page/game/story-studio/js/cast/rig.js');
const {propObject}=await import('../../page/game/story-studio/js/stage/build.js');
const sets=['hospital-room','deep-grove','cave','child-bedroom','hotel-room','camping-tent','garden-bench'];
const actions=['hulaStanding','rollDice','celebrate','rideHorse','writeNotebook','typeLaptop','armWrestle'];
for(const id of sets){const set=await buildSet(registry.get('set',id),[],id=>registry.prop(id));assert.deepEqual(set.missing,[],id);}
for(const id of ['hula-hoop','dice-six','hospital-bed','mechanical-bull','notebook','laptop']){const p=registry.prop(id);assert(p);const obj=await propObject(p);const bounds=new THREE.Box3().setFromObject(obj);assert(!bounds.isEmpty(),id);}
assert.equal(registry.prop('dice-six').source.boxes.filter(b=>b.shape==='sphere').length,42);
assert(registry.prop('hospital-bed').anchors.lie);assert(registry.prop('mechanical-bull').anchors.seat);
assert(registry.get('set','deep-grove').props.filter(p=>['tree','pine'].includes(p.prop)).length>=60);
const keys=[{t:0,value:0},{t:.5,value:1},{t:1,value:0}];
assert.equal(sampleKeys(keys,.25,'linear'),.5);assert.equal(sampleKeys(keys,.5,'step'),1);
assert.equal(sampleKeys(keys,.75,'step'),1);assert.equal(sampleKeys(keys,1,'step'),0);
assert.equal(sampleKeys(keys,1.5,'linear',true),1);assert.equal(sampleKeys(keys,-1),0);
const doc={kind:'action',version:1,id:'qa-keys',name:'QA',category:'solo',type:'overlay',pose:'stand',duration:4,joints:[{joint:'rArm',axis:'z',keys}],root:[]};
assert(validate(doc).ok);
for(const bad of [[{t:.5,value:0},{t:.4,value:1}],[{t:0,value:0},{t:0,value:1}],[{t:2,value:0}],[{t:0}],[{value:1}],[]])assert(!validate({...doc,joints:[{...doc.joints[0],keys:bad}]}).ok);
for(const mode of ['linear','smooth','step']){
 const frames=[{t:0,pose:basePose('stand')},{t:1,pose:basePose('stand')}],middle=basePose('stand');middle.joints.rArm=[.3,.2,1.1];middle.root.lift=.06;
 upsertFrame(frames,.5,middle);assert.equal(frames.length,3);
 const motion=encodeFrames(frames,'stand',false,mode),v=validate({...doc,...motion});assert(v.ok,JSON.stringify(v.errors));
 const baked=bakeMotion(v.doc);assert.equal(baked.length,3);
 for(const t of [0,.1,.25,.5,.63,.75,1]){
  const preview=sampleFrames(frames,t,mode),actual=performAction(v.doc,{duration:4},t*4);
  for(const j of JOINT_NAMES)for(let axis=0;axis<3;axis++)assert(Math.abs((actual.joints[j]?.[axis]||0)-(preview.joints[j]?.[axis]||0))<1e-6);
  assert(Math.abs(preview.root.lift-actual.root.lift)<1e-6);
 }
 upsertFrame(frames,0,middle,true);assert.deepEqual(frames[0].pose,frames.at(-1).pose);
}
const stage=await buildSet(registry.get('set','studio'),[],id=>registry.prop(id));
const world={character:id=>registry.character(id),action:id=>registry.action(id),prop:id=>registry.prop(id),anchor:(id,n)=>stage.anchor(id,n),placement:id=>stage.placements.get(id)?.placement};
function story(action,extra=[],castIds=['rui']){const group=action.category==='group';return {kind:'story',version:1,id:'qa',set:'studio',setEdits:[],camera:{at:[4,3,4],look:[0,1,0],fov:45},cast:castIds.map((id,i)=>({id:'p'+i,character:id,at:[i*2,0,0],yaw:0})),timeline:[group?{do:action.id,t:0,for:4,at:[0,0,0],cast:{a:'p0',b:'p1'}}:{do:action.id,t:0,for:4,actor:'p0'},...extra],embeds:[]};}
for(const id of actions){const a=registry.action(id),st=story(a,[],a.category==='group'?['rui','carmen']:['rui']),v=validate(st,{actions:registry.actionMap()});assert(v.ok,id+JSON.stringify(v.errors));const c=compile(v.doc,world);assert(c.ok,id+JSON.stringify(c.errors));assert.deepEqual(c.warnings,[]);
 for(let t=0;t<4;t+=.08){const frame=c.film.sample(t);for(const actor of Object.values(frame.actors)){assert([actor.x,actor.y,actor.z,actor.yaw,...Object.values(actor.pose.root),...Object.values(actor.pose.joints).flat()].every(Number.isFinite),id+' finite');}for(const p of frame.groupProps)assert(p.at.every(Number.isFinite));}
 for(const cid of ['rui','carmen','lia','tom']){const m=buildCharacter(registry.character(cid));for(const t of [0,.25,.5,.75]){const pose=performAction(a,{},t*(a.period||a.duration),a.category==='group'?a.parts.a:undefined);applyPose(m,pose);m.updateMatrixWorld(true);for(const j of JOINT_NAMES)assert(m.userData.pivots[j].getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));}}
}
// Identical simultaneous actions must keep a separate accessory per actor.
const twins=compile(story(registry.action('hulaStanding'),[{do:'hulaStanding',actor:'p1',t:0,for:4}],['rui','tom']),world).film;
const hoops=twins.sample(1).groupProps;assert.equal(hoops.length,2);assert.equal(new Set(hoops.map(p=>p.key)).size,2);assert.deepEqual(new Set(hoops.map(p=>p.actor)),new Set(['p0','p1']));assert(hoops.every(p=>p.joint==='hips'&&p.spinAxis==='y'));
const ride=compile(story(registry.action('rideHorse'),[{do:'wait',actor:'p0',t:4,for:3},{do:'stand',actor:'p0',t:7,for:1}]),world).film;
assert(ride.sample(6).groupProps.some(p=>p.prop==='saddle-horse'));assert(!ride.sample(7.2).groupProps.some(p=>p.prop==='saddle-horse'));
const bullWorld={...world,anchor:()=>({pos:[0,1.34,0],yaw:0})};const mounted=story(registry.action('rideHorse'));mounted.timeline[0].on='bull';const mountedFilm=compile(mounted,bullWorld).film;assert(mountedFilm);assert(!mountedFilm.sample(1).groupProps.some(p=>p.prop==='saddle-horse'));
// The two authored adult roles maintain contact throughout the rocking cycle.
const wrestle=registry.action('armWrestle'),players=['rui','carmen'].map((id,i)=>{const m=buildCharacter(registry.character(id));m.position.set(...wrestle.roles[i].at);m.rotation.y=-wrestle.roles[i].yaw*Math.PI/180;return m;});
for(let t=0;t<=1;t+=.025){for(const [i,m] of players.entries()){applyPose(m,performAction(wrestle,{},t*wrestle.period,wrestle.parts[wrestle.roles[i].id]));m.updateMatrixWorld(true);}const hands=players.map(m=>m.userData.pivots.rHand.getWorldPosition(new THREE.Vector3()));assert(hands[0].distanceTo(hands[1])<.045,'wrist contact '+t);}
// Dragging solves rotations while keeping every bone offset intact.
const {ActionEditor}=await import('../../page/game/story-studio/js/ui/actionedit.js');
for(const id of ['rui','carmen','lia','tom']){
 const m=buildCharacter(registry.character(id));applyPose(m,basePose('stand'));m.updateMatrixWorld(true);
 const offsets=Object.fromEntries(JOINT_NAMES.map(j=>[j,m.userData.pivots[j].position.toArray()]));
 const before=m.userData.pivots.rHand.getWorldPosition(new THREE.Vector3()),target=before.clone().add(new THREE.Vector3(.15,.12,0));
 const ctx={models:new Map([['solo',m]]),role:'solo',selected:'rHand',proxy:{position:target}};
 ActionEditor.prototype.solveDrag.call(ctx);const after=m.userData.pivots.rHand.getWorldPosition(new THREE.Vector3());
 assert(after.distanceTo(target)<before.distanceTo(target)*.5,id+' IK improves reach');
 for(const j of JOINT_NAMES)assert.deepEqual(m.userData.pivots[j].position.toArray(),offsets[j],id+' bone '+j);
}
const still=[{t:0,pose:basePose('stand')},{t:.3,pose:basePose('stand')},{t:1,pose:basePose('stand')}];
assert.equal(bakeMotion({...doc,...encodeFrames(still,'stand',false)}).length,3);
console.log('PASS: 17 objects, 7 sets, 8 actions, 4 body rigs, keyframe interpolation/validation/round-trip, 2-person contact, simultaneous hoops and anchored accessory lifetime.');
