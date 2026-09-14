// Node 22.15+, with the same Three.js runtime used by the other Story Studio tests.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
const deps = process.env.SS_TEST_NODE_MODULES || '/tmp/story-studio-lia-qa/node_modules';
registerHooks({ resolve(specifier, context, next) {
  if(specifier === 'three') return { url:pathToFileURL(`${deps}/three/build/three.module.js`).href,shortCircuit:true };
  if(specifier.startsWith('three/addons/')) return { url:pathToFileURL(`${deps}/three/examples/jsm/${specifier.slice(13)}`).href,shortCircuit:true };
  return next(specifier,context);
} });
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input.url||input.href;
  if(url.startsWith('file:')){try{const data=await readFile(new URL(url));return new Response(data,{headers:{'Content-Length':data.length}});}catch{return new Response('',{status:404});}}
  return nativeFetch(input,init);
};
globalThis.ProgressEvent=class {constructor(type,props){Object.assign(this,{type},props);}};
const THREE=await import('three');
const {Registry}=await import('../../page/game/story-studio/js/library/registry.js');
const {ActionEditor}=await import('../../page/game/story-studio/js/ui/actionedit.js');
const {Playback}=await import('../../page/game/story-studio/js/render/playback.js');
const {validate}=await import('../../page/game/story-studio/js/script/schema.js');
const {compile}=await import('../../page/game/story-studio/js/script/director.js');
const {buildCharacter}=await import('../../page/game/story-studio/js/cast/build.js');
const {applyPose}=await import('../../page/game/story-studio/js/anim/blend.js');
const {copy,bakeMotion,sampleFrames}=await import('../../page/game/story-studio/js/ui/actionframes.js');
const {editableProp,bakePropMotion,samplePropTransform,samplePropKeys,upsertPropKey}=await import('../../page/game/story-studio/js/anim/prop-motion.js');
const registry=await new Registry().loadOfficial();assert.deepEqual(registry.problems,[]);
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-6,`${message}: ${a} / ${b}`);

const keys=[{t:0,at:[0,0,0],rotation:[0,0,0],scale:1},{t:.5,at:[1,2,3],rotation:[.2,.4,.6],scale:2},{t:1,at:[0,0,0],rotation:[0,Math.PI*2,0],scale:1}];
for(const interpolation of ['smooth','linear','step']){
  const source={...copy(registry.action('typeLaptop')),props:[{id:'laptop',prop:'laptop',at:[99,99,99],joint:'hips',bodyScale:true,transform:{keys,interpolation,loop:false}}]};
  const v=validate(JSON.parse(JSON.stringify(source)));assert(v.ok,JSON.stringify(v.errors));
  for(const time of [0,.1,.25,.5,.6,.9,1]){
    const expected=samplePropKeys(keys,time,interpolation),actual=samplePropTransform(v.doc.props[0],time,time*4);
    assert.deepEqual(actual,expected,'serialized transforms override legacy placement');
  }
  assert.deepEqual(bakePropMotion(v.doc.props[0],4),keys);
}
const loopKeys=copy(keys);upsertPropKey(loopKeys,0,{...keys[0],at:[.2,.3,.4]},true);
assert.deepEqual(loopKeys[0].at,loopKeys.at(-1).at);near(loopKeys.at(-1).rotation[1]-loopKeys[0].rotation[1],Math.PI*2,'loop preserves whole turn');
assert.equal(samplePropKeys(keys,.5,'step').scale,2);
assert.deepEqual(samplePropKeys(keys,1.5,'linear',true),samplePropKeys(keys,.5,'linear'));
const base=copy(registry.action('typeLaptop'));
for(const transform of [{keys:[]},{keys:[keys[1],keys[0]]},{keys:[keys[0],{...keys[1],scale:-1}]},{keys:[keys[0],{...keys[1],t:2}]},{keys:[keys[0],{...keys[1],rotation:[Infinity,0,0]}]}])assert(!validate({...base,props:[{id:'a',prop:'laptop',transform}]}).ok);
assert(!validate({...base,props:[base.props[0],base.props[0]]}).ok,'duplicate accessory ids rejected');

// Exercise authoring state independently of DOM/WebGL, keeping the production
// model, history, prop, roster and serialization methods.
function editor(action){
  const e=Object.create(ActionEditor.prototype),doc=copy(action),roles=doc.category==='group'?copy(doc.roles):[{id:'solo',name:'Solo',at:[0,0,0],yaw:0}];
  const fields=new Map();
  Object.assign(e,{registry,doc,roles,parts:{},frames:{},propFrames:{},editedProps:{},charByRole:{},role:roles[0].id,target:'actor',propId:null,selected:'rHand',mode:'rotate',duration:doc.period||doc.duration||4,time:0,loop:!!doc.reps,interpolation:'smooth',history:[],future:[],models:new Map(),props:[],stage:{content:new THREE.Group(),scene:new THREE.Scene()},q:key=>{if(!fields.has(key))fields.set(key,{value:'key',textContent:''});return fields.get(key);},refreshFields(){},buildModels:async()=>{},frameCamera(){},changed(){this.dirty=true;}});
  e.stage.scene.add(e.stage.content);
  for(const [i,r] of roles.entries()){
    e.parts[r.id]=copy(doc.category==='group'?doc.parts[r.id]:doc);e.frames[r.id]=bakeMotion(doc,e.parts[r.id]);e.charByRole[r.id]=['rui','carmen','tom','lia'][i%4];
  }
  for(const pr of doc.props)e.propFrames[pr.id]=bakePropMotion(editableProp(pr,registry.prop(pr.prop)),e.duration);
  return e;
}
const e=editor(base);e.target='prop';e.propId=base.props[0].id;e.time=.5;
const adjusted=e.currentPropPose();adjusted.at[0]+=.2;adjusted.rotation[0]+=.3;adjusted.scale=1.3;e.recordProp(adjusted);
assert.equal(e.propFrames[e.propId].length,3);near(e.propFrames[e.propId][1].at[0],adjusted.at[0],'object key');
e.q('scope').value='all';const previous=copy(e.propFrames[e.propId]),shift=e.currentPropPose();shift.at[2]+=.8;e.recordProp(shift);
e.propFrames[e.propId].forEach((k,i)=>near(k.at[2]-previous[i].at[2],.8,'whole animation offset'));
const saved=validate(e.document());assert(saved.ok,JSON.stringify(saved.errors));assert.equal(saved.doc.props[0].transform.keys.length,3);assert.deepEqual(saved.doc.previewCast,{solo:'rui'});

await e.addRole();await e.addRole();await e.addRole();
assert.equal(e.doc.id,'typeLaptop-group');assert.equal(e.roles.length,4);assert.deepEqual(Object.values(e.charByRole),['rui','carmen','tom','lia']);assert.equal(e.doc.props[0].role,'solo');
const group=validate(e.document());assert(group.ok,JSON.stringify(group.errors));
const st={kind:'story',id:'qa',name:'QA',set:'studio',cast:e.roles.map(r=>({id:r.id,character:e.charByRole[r.id],at:r.at,yaw:r.yaw})),timeline:[{do:group.doc.id,for:4,cast:Object.fromEntries(e.roles.map(r=>[r.id,r.id]))}]};
const world={character:id=>registry.character(id),prop:id=>registry.prop(id),action:id=>id===group.doc.id?group.doc:registry.action(id)};
const checkedStory=validate(st,{actions:new Map([[group.doc.id,group.doc]])});assert(checkedStory.ok,JSON.stringify(checkedStory.errors));
const result=compile(checkedStory.doc,world);assert(result.ok,JSON.stringify(result.errors));
const sample=result.film.sample(1);assert.equal(Object.keys(sample.actors).length,4);assert.equal(sample.groupProps.length,4);
assert.equal(new Set(sample.groupProps.map(p=>p.key)).size,4,'independent copied accessories');
assert.deepEqual(sample.groupProps[0].rotation,samplePropTransform(group.doc.props[0],1/group.doc.period,1).rotation);
for(const [role,a] of Object.entries(sample.actors)){const model=buildCharacter(a.doc);applyPose(model,a.pose);e.models.set(role,model);e.stage.content.add(model);}
const render={stage:e.stage,actors:e.models,groupProps:new Map(),propTemplates:new Map([['laptop',{object:new THREE.Group()}]])};
Playback.prototype.applyGroupProps.call(render,sample.groupProps);
const rendered=render.groupProps.values().next().value;assert.equal(rendered.parent,e.models.get('solo').userData.pivots.hips);near(rendered.rotation.x,sample.groupProps[0].rotation[0],'playback rotation');
const originalRoster=copy(e.roles);await e.removeRole();assert.equal(e.roles.length,3);await e.undo(false);assert.deepEqual(e.roles,originalRoster,'undo restores cast');await e.undo(true);assert.equal(e.roles.length,3);
while(e.roles.length<8)await e.addRole();await e.addRole();assert.equal(e.roles.length,8);
e.role='solo';await e.removeRole();assert(!e.doc.props.some(p=>p.role==='solo'),'remove dependent object');assert(validate(e.document()).ok);

// Detaching a prop from moving bones preserves the world-space trajectory,
// including body-size compensation and the legacy grip geometry offset.
const held={id:'held',prop:'rope-handle',hand:'right',grip:[15,20,30]};
const converted=editableProp(held,registry.prop(held.prop));assert.equal(converted.joint,'rHand');assert(!converted.hand);assert(converted.offset);
const attachment=editor({...base,props:[converted]});attachment.target='prop';attachment.propId=converted.id;
const model=buildCharacter(registry.character('rui'));attachment.models.set('solo',model);attachment.stage.content.add(model);
const holder=new THREE.Group();model.userData.pivots.rHand.add(holder);
const item={object:holder,pr:converted,role:'solo',joint:'rHand'};attachment.props=[item];attachment.q('attachment').value='world';
const before=[];for(const u of [0,.25,.5,.75,1]){attachment.time=u;applyPose(model,sampleFrames(attachment.frames.solo,u));attachment.stage.scene.updateMatrixWorld(true);before.push(attachment.propToWorld(item,attachment.currentPropPose()).clone());}
await attachment.changeAttachment();assert(!attachment.doc.props[0].joint);assert(attachment.editedProps.held);
for(const [i,u] of [0,.25,.5,.75,1].entries()){
  const transform=samplePropKeys(attachment.propFrames.held,u),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...transform.at),new THREE.Quaternion().setFromEuler(new THREE.Euler(...transform.rotation,'YXZ')),new THREE.Vector3().setScalar(transform.scale));
  matrix.elements.forEach((v,j)=>near(v,before[i].elements[j],'detach world matrix'));
}
assert(validate(attachment.document()).ok);
console.log('PASS: object transforms, loops and whole-animation offsets; serialization and runtime playback; 1–8 participants, saved casting, copy-on-role-change, undo/redo; grip attachment and detachment paths.');
