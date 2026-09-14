// Calibrate the shipped adult arm-wrestling formation against its actual rigs.
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
const {Registry}=await import('../page/game/story-studio/js/library/registry.js');
const {buildCharacter}=await import('../page/game/story-studio/js/cast/build.js');
const {applyPose}=await import('../page/game/story-studio/js/anim/blend.js');
const registry=await new Registry().loadOfficial();
assert.deepEqual(registry.problems,[]);

const {performAction}=await import('../page/game/story-studio/js/anim/perform.js');

const {encodeFrames}=await import('../page/game/story-studio/js/ui/actionframes.js');
const a=registry.action('armWrestle');
for(const [i,role] of a.roles.entries()){
 const m=buildCharacter(registry.character(i?'carmen':'rui'));m.position.set(...role.at);m.rotation.y=-role.yaw*Math.PI/180;
 const frames=[];
 for(let k=0;k<=32;k++){
  const t=k/32,pose=performAction(a,{},0,a.parts[role.id]);applyPose(m,pose);
  const target=new THREE.Vector3(i?.013:-.013,1.44,Math.sin(t*Math.PI*2)*.065);
  const p=m.userData.pivots;
  const cost=()=>{m.updateMatrixWorld(true);return p.rHand.getWorldPosition(new THREE.Vector3()).distanceToSquared(target);};
  for(const step of [.15,.06,.025,.01,.003])for(let iter=0;iter<22;iter++)for(const j of ['rArm','rFore'])for(const axis of ['x','y','z']){
   const r=p[j].rotation,old=r[axis];let score=cost(),best=old;
   for(const sign of [-1,1]){r[axis]=Math.max(j==='rFore'&&axis==='z'?.1:-2.8,Math.min(2.8,old+step*sign));const c=cost();if(c<score){score=c;best=r[axis];}}r[axis]=best;
  }
  for(const j of ['rArm','rFore']){const r=p[j].rotation;pose.joints[j]=[r.x,r.y,r.z];}
  frames.push({t,pose});
  if(k===0)console.log(role.id,'hand error',Math.sqrt(cost()),'elbow',p.rFore.getWorldPosition(new THREE.Vector3()).toArray());
 }
 frames[32].pose=structuredClone(frames[0].pose);a.parts[role.id]=encodeFrames(frames,'stand',true,'smooth');
}
await writeFile(new URL('../page/game/story-studio/data/actions/armWrestle.json',import.meta.url),JSON.stringify(a,null,2)+'\n');

// Bring the writing tools onto the lap, with hands meeting the paper/keys.
for(const id of ['writeNotebook','typeLaptop']){
 const action=registry.action(id),m=buildCharacter(registry.character('rui'));
 const pose=performAction(action,{},0);applyPose(m,pose);m.updateMatrixWorld(true);
 const hips=m.userData.pivots.hips.getWorldPosition(new THREE.Vector3()),size=m.userData.height/1.76;
 action.props[0].at=id==='writeNotebook'?[.33,.11,0]:[.37,.11,0];
 for(const side of ['r','l']){
  const wrist=m.userData.pivots[side+'Hand'];
  const local=id==='writeNotebook'?(side==='r'?[.33,.235,-.08]:[.30,.15,.13]):[.32,.175,side==='r'?-.13:.13];
  const target=hips.clone().add(new THREE.Vector3(...local).multiplyScalar(size));
  const distance=()=>{m.updateMatrixWorld(true);return wrist.getWorldPosition(new THREE.Vector3()).distanceToSquared(target);};
  for(const step of [.15,.06,.025,.008,.002])for(let pass=0;pass<20;pass++)for(const name of [side+'Arm',side+'Fore'])for(const axis of ['x','y','z']){
   const rot=m.userData.pivots[name].rotation,old=rot[axis];let score=distance(),best=old;
   for(const sign of [-1,1]){rot[axis]=Math.max(name.endsWith('Fore')&&axis==='z'?.05:-2.7,Math.min(2.7,old+step*sign));const scoreNext=distance();if(scoreNext<score){best=rot[axis];score=scoreNext;}}rot[axis]=best;
  }
  for(const name of [side+'Arm',side+'Fore'])for(const [index,axis] of ['x','y','z'].entries()){
   const difference=m.userData.pivots[name].rotation[axis]-(pose.joints[name]?.[index]||0);
   if(Math.abs(difference)>1e-6)action.joints.push({joint:name,axis,wave:'const',amp:0,offset:difference});
  }
  assert(Math.sqrt(distance())<.025,`${id} ${side} hand contact`);
 }
 if(id==='writeNotebook'){
  const up=new THREE.Vector3(0,1,0).applyQuaternion(m.userData.pivots.rHand.getWorldQuaternion(new THREE.Quaternion()).invert());
  action.props[1].spinPhase=Math.acos(Math.max(-1,Math.min(1,up.y)))/(Math.PI*2);
  action.props[1].yaw=Math.atan2(up.z,-up.x)*180/Math.PI;
 }
 await writeFile(new URL(`../page/game/story-studio/data/actions/${id}.json`,import.meta.url),JSON.stringify(action,null,2)+'\n');
}
