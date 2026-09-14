import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Stage } from '../render/stage.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { JOINT_NAMES, jointParent } from '../cast/rig.js';
import { bakePropMotion, editableProp, samplePropKeys, samplePropTransform, upsertPropKey } from '../anim/prop-motion.js';
import { applyPose } from '../anim/blend.js';
import { basePose } from '../anim/perform.js';
import { propObject } from '../stage/build.js';
import { localised, t } from '../i18n.js';
import { validate, LIMITS } from '../script/schema.js';
import { download, toJson } from '../library/io.js';
import { bakeMotion, encodeFrames, sampleFrames, upsertFrame, copy } from './actionframes.js';

const DEG=Math.PI/180;
const JOINT_LABELS={hips:'aeHips',chest:'aeChest',neck:'aeNeck',head:'aeHead',lArm:'aeLArm',rArm:'aeRArm',lFore:'aeLFore',rFore:'aeRFore',lHand:'aeLHand',rHand:'aeRHand',lThigh:'aeLThigh',rThigh:'aeRThigh',lShin:'aeLShin',rShin:'aeRShin',lFoot:'aeLFoot',rFoot:'aeRFoot'};
const BASES=['stand','sit','kneel','crouch','lieUp','lieDown','crawl','plank','swim'];
const END_CHAINS={lHand:['lFore','lArm'],rHand:['rFore','rArm'],lFoot:['lShin','lThigh'],rFoot:['rShin','rThigh']};

export class ActionEditor {
  constructor(root,{registry,onSave,onCancel}){
    Object.assign(this,{root,registry,onSave,onCancel,dirty:false,doc:null,models:new Map(),markers:[],history:[],future:[],playing:false,active:false,time:0,mode:'rotate',selected:'rHand',dragging:false,target:'actor',propId:null,propFrames:{},editedProps:{}});
    root.innerHTML=`<div class="ss-edit-bar"><h2 data-i18n="aeTitle"></h2><div class="ss-edit-tools">
      <button type="button" data-ae="undo" data-i18n="aeUndo"></button><button type="button" data-ae="redo" data-i18n="aeRedo"></button>
      <button type="button" data-ae="export" data-i18n="aeExport"></button><button type="button" data-ae="save" class="ss-primary" data-i18n="save"></button><button type="button" data-ae="cancel" data-i18n="cancel"></button></div></div>
      <details class="ss-ae-settings"><summary data-i18n="aeSettings"></summary><div>
      <label>ID<input data-ae="id" maxlength="64"></label>
      ${['en','pt','ja'].map(lang=>`<label><span><span data-i18n="propName"></span> ${lang.toUpperCase()}</span><input data-ae="name-${lang}" maxlength="160"></label>`).join('')}
      <label><span data-i18n="aeDuration"></span><input type="number" data-ae="duration" min=".2" max="30" step=".1"></label>
      <label class="ss-ae-check"><input type="checkbox" data-ae="loop"><span data-i18n="aeLoop"></span></label>
      <label><span data-i18n="aeInterpolation"></span><select data-ae="interpolation"><option value="smooth" data-i18n="aeSmooth"></option><option value="linear" data-i18n="aeLinear"></option><option value="step" data-i18n="aeStep"></option></select></label>
      </div></details>
      <div class="ss-ae-body"><aside class="ss-ae-panel ss-ae-entities">
      <h3><span data-i18n="aeParticipants"></span> <small data-ae="participants-count"></small></h3>
      <div class="ss-ae-list" data-ae="participants"></div>
      <div class="ss-ae-buttons"><button type="button" data-ae="add-role" data-i18n="aeAddRole"></button><button type="button" data-ae="remove-role" data-i18n="aeRemove"></button></div>
      <details class="ss-ae-fold"><summary data-i18n="aeCastHelp"></summary><p data-i18n="aeCastHint"></p></details>
      <h3 data-i18n="aeObjects"></h3><div class="ss-ae-list" data-ae="objects"></div>
      <label><span data-i18n="aeObjectLibrary"></span><select data-ae="prop-library"></select></label>
      <button type="button" data-ae="add-prop" data-i18n="aeAddObject"></button>
      <button type="button" data-ae="frame" data-i18n="aeFrame"></button>
      </aside><div id="ss-action-stage"><canvas id="ss-action-canvas"></canvas><div class="ss-ae-stage-label" data-ae="selection"></div></div>
      <aside class="ss-ae-panel ss-ae-inspector"><h3 data-ae="inspector-title"></h3>
      <div class="ss-ae-buttons"><button type="button" data-ae="rotate" data-i18n="aeRotate"></button><button type="button" data-ae="move" data-i18n="aeMove"></button><button type="button" data-ae="scale" data-i18n="aeSize"></button></div>
      <div class="ss-ae-angles">${['x','y','z'].map(a=>`<label>${a.toUpperCase()} °<input type="number" step="1" min="-180" max="180" data-ae="angle-${a}"></label>`).join('')}</div>
      <div data-ae="actor-fields" class="ss-ae-fields">
      <label><span data-i18n="aeJoint"></span><select data-ae="joint">${JOINT_NAMES.map(j=>`<option value="${j}" data-i18n="${JOINT_LABELS[j]}"></option>`).join('')}</select></label>
      <label><span data-i18n="aeCharacter"></span><select data-ae="character"></select></label>
      <select data-ae="role" hidden></select>
      <label><span data-i18n="aeBase"></span><select data-ae="base">${BASES.map(v=>`<option value="${v}" data-i18n="aeBase${v}"></option>`).join('')}</select></label>
      <details data-ae="formation" class="ss-ae-fold"><summary data-i18n="aeFormation"></summary><div class="ss-ae-fields">
      <div class="ss-ae-angles">${['x','y','z'].map(a=>`<label>${a.toUpperCase()} m<input type="number" step=".05" min="-20" max="20" data-ae="role-${a}"></label>`).join('')}</div>
      <label><span data-i18n="aeFacing"></span><input data-ae="role-yaw" type="number" step="5" min="-360" max="360"></label></div></details>
      </div>
      <div data-ae="prop-fields" class="ss-ae-fields" hidden>
      <label><span data-i18n="aeAttachment"></span><select data-ae="attachment"></select></label>
      <label class="ss-ae-check"><input data-ae="body-scale" type="checkbox"><span data-i18n="aeBodyScale"></span></label>
      <span data-i18n="aePosition"></span><div class="ss-ae-angles">${['x','y','z'].map(a=>`<label>${a.toUpperCase()} m<input type="number" step=".01" min="-100" max="100" data-ae="pos-${a}"></label>`).join('')}</div>
      <label><span data-i18n="aeSize"></span><input data-ae="prop-scale" type="number" min=".01" max="100" step=".05"></label>
      <label><span data-i18n="aeEditScope"></span><select data-ae="scope"><option value="key" data-i18n="aeScopeKey"></option><option value="all" data-i18n="aeScopeAll"></option></select></label>
      <button type="button" data-ae="remove-prop" data-i18n="aeRemoveObject"></button>
      </div>
      <button type="button" data-ae="reset" data-i18n="aeReset"></button>
      <p data-ae="hint"></p></aside></div><output data-ae="message" role="status"></output>
      <div class="ss-ae-timeline"><div class="ss-ae-buttons"><button type="button" data-ae="play" data-i18n="play"></button><label><span data-i18n="aeTime"></span> <input data-ae="time" type="number" min="0" step=".05"></label><button type="button" data-ae="previous" data-i18n="aePrevious"></button><button type="button" data-ae="next" data-i18n="aeNext"></button><button type="button" data-ae="key" data-i18n="aeKey"></button><button type="button" data-ae="delete" data-i18n="aeDelete"></button><button type="button" data-ae="copy" data-i18n="aeCopy"></button><button type="button" data-ae="paste" data-i18n="aePaste"></button><output data-ae="count"></output></div>
      <input data-ae="scrub" type="range" min="0" max="1" step=".001" value="0" data-i18n-aria="aeTimeline"><div class="ss-ae-keys" data-ae="keys"></div></div>`;
    this.q=key=>root.querySelector(`[data-ae="${key}"]`);
    this.canvas=root.querySelector('canvas');this.stage=new Stage(this.canvas,{shadows:false,fog:false});
    this.orbit=new OrbitControls(this.stage.camera,this.canvas);this.orbit.enableDamping=true;
    this.gizmo=new TransformControls(this.stage.camera,this.canvas);this.gizmo.setSpace('local');
    this.stage.scene.add(this.gizmo.getHelper?.()||this.gizmo);
    this.proxy=new THREE.Object3D();this.stage.scene.add(this.proxy);
    this.markerGroup=new THREE.Group();this.stage.scene.add(this.markerGroup);
    this.stage.hemi.intensity=1.3;this.stage.sun.position.set(6,10,8);
    this.stage.scene.add(new THREE.GridHelper(10,20,0x7d9990,0xb4c3b8));
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.props=[];
    this.resizeObserver=new ResizeObserver(([entry])=>{if(this.active&&entry.contentRect.width&&entry.contentRect.height)this.resize(entry.contentRect.width,entry.contentRect.height);});
    this.resizeObserver.observe(this.canvas.parentElement);
    this.bind();this.translate();
  }
  translate(){for(const el of this.root.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);this.q('scrub').setAttribute('aria-label',t('aeTimeline'));if(this.doc){this.populateLibraries();this.refreshFields();this.drawKeys();}}
  bind(){
    this.q('save').onclick=()=>this.save();this.q('cancel').onclick=()=>this.onCancel();
    this.q('export').onclick=()=>{const result=this.validated();if(result)download(`action-${result.id}.json`,toJson(result));};
    this.q('undo').onclick=()=>this.undo(false);this.q('redo').onclick=()=>this.undo(true);
    this.q('id').onchange=e=>{this.checkpoint();this.doc.id=e.target.value.trim();this.dirty=true;};
    for(const lang of ['en','pt','ja'])this.q('name-'+lang).onchange=e=>{this.checkpoint();this.doc.name[lang]=e.target.value;this.dirty=true;};
    this.q('character').onchange=()=>{this.checkpoint();this.charByRole[this.role]=this.q('character').value;this.dirty=true;this.refreshFields();this.buildModels();};
    this.q('role').onchange=()=>this.selectActor(this.q('role').value);
    this.q('add-role').onclick=()=>this.addRole();
    this.q('remove-role').onclick=()=>this.removeRole();
    this.q('add-prop').onclick=()=>this.addProp();
    this.q('remove-prop').onclick=()=>this.removeProp();
    this.q('frame').onclick=()=>this.frameCamera();
    for(const [i,axis] of ['x','y','z'].entries())this.q('role-'+axis).onchange=()=>{this.checkpoint();this.roles.find(r=>r.id===this.role).at[i]=Math.max(-20,Math.min(20,+this.q('role-'+axis).value||0));this.changed();};
    this.q('role-yaw').onchange=()=>{this.checkpoint();this.roles.find(r=>r.id===this.role).yaw=Math.max(-360,Math.min(360,+this.q('role-yaw').value||0));this.changed();};
    this.q('attachment').onchange=()=>this.changeAttachment();
    this.q('body-scale').onchange=()=>{this.checkpoint();this.preparePropEdit();this.selectedProp().bodyScale=this.q('body-scale').checked;this.changed();};
    for(const [i,axis] of ['x','y','z'].entries())this.q('pos-'+axis).onchange=()=>{this.checkpoint();const pose=this.currentPropPose();pose.at[i]=Math.max(-100,Math.min(100,+this.q('pos-'+axis).value||0));this.recordProp(pose);};
    this.q('prop-scale').onchange=()=>{this.checkpoint();const pose=this.currentPropPose();pose.scale=Math.max(.01,Math.min(100,+this.q('prop-scale').value||1));this.recordProp(pose);};
    this.q('base').onchange=()=>{this.checkpoint();const old=basePose(this.parts[this.role].pose),next=basePose(this.q('base').value);
      for(const f of this.frames[this.role]){for(const j of JOINT_NAMES)f.pose.joints[j]=[0,1,2].map(i=>(f.pose.joints[j]?.[i]||0)-(old.joints[j]?.[i]||0)+(next.joints[j]?.[i]||0));for(const k of ['lift','shift','tiltZ'])f.pose.root[k]=(f.pose.root[k]||0)-(old.root[k]||0)+(next.root[k]||0);}
      this.parts[this.role].pose=this.q('base').value;this.changed();};
    this.q('duration').onchange=()=>{this.checkpoint();this.duration=Math.max(.2,Math.min(30,+this.q('duration').value||4));for(const pr of this.doc.props||[])if(!this.editedProps[pr.id])this.propFrames[pr.id]=bakePropMotion(editableProp(pr,this.registry.prop(pr.prop)),this.duration);this.changed();};
    this.q('loop').onchange=()=>{this.checkpoint();this.loop=this.q('loop').checked;if(this.loop)for(const frames of Object.values(this.frames))frames[frames.length-1].pose=copy(frames[0].pose);this.changed();};
    this.q('interpolation').onchange=()=>{this.checkpoint();this.interpolation=this.q('interpolation').value;this.changed();};
    this.q('joint').onchange=()=>{this.selected=this.q('joint').value;this.updateMarkers();this.attach();this.updateAngles();};
    for(const mode of ['move','rotate','scale'])this.q(mode).onclick=()=>{this.mode=mode;this.attach();};
    for(const [i,axis] of ['x','y','z'].entries())this.q('angle-'+axis).onchange=()=>{this.checkpoint();if(this.target==='prop'){const pose=this.currentPropPose();pose.rotation[i]=Math.max(-180000,Math.min(180000,+this.q('angle-'+axis).value||0))*DEG;this.recordProp(pose);}else{const pose=this.currentPose();pose.joints[this.selected]||=[0,0,0];pose.joints[this.selected][i]=Math.max(-180,Math.min(180,+this.q('angle-'+axis).value||0))*DEG;this.record(pose);}};
    this.q('reset').onclick=()=>{this.checkpoint();const pose=this.currentPose();pose.joints[this.selected]=copy(basePose(this.parts[this.role].pose).joints[this.selected]||[0,0,0]);this.record(pose);};
    this.q('key').onclick=()=>{this.checkpoint();if(this.target==='prop')this.recordProp(this.currentPropPose(),true);else this.record(this.currentPose());};
    this.q('delete').onclick=()=>{const frames=this.activeFrames(),i=frames.findIndex(f=>Math.abs(f.t-this.time)<.0001);if(i<=0||i===frames.length-1)return;this.checkpoint();if(this.target==='prop')this.preparePropEdit();frames.splice(i,1);this.changed();};
    for(const direction of ['previous','next'])this.q(direction).onclick=()=>{this.playing=false;const frames=this.activeFrames();const f=direction==='previous'?[...frames].reverse().find(f=>f.t<this.time-.0001):frames.find(f=>f.t>this.time+.0001);this.seek(f?.t??(direction==='previous'?0:1));};
    this.q('copy').onclick=()=>{this.clipboard={type:this.target,pose:copy(this.target==='prop'?this.currentPropPose():this.currentPose())};this.refreshFields();};
    this.q('paste').onclick=()=>{if(this.clipboard?.type!==this.target)return;this.checkpoint();if(this.target==='prop')this.recordProp(this.clipboard.pose,true);else this.record(this.clipboard.pose);};
    this.q('scrub').oninput=()=>{this.playing=false;this.seek(+this.q('scrub').value);};
    this.q('time').oninput=()=>{this.playing=false;this.seek(+this.q('time').value/this.duration);};
    this.q('play').onclick=()=>{this.playing=!this.playing;if(this.time>=1)this.seek(0);this.q('play').textContent=t(this.playing?'pause':'play');};
    this.canvas.addEventListener('pointerdown',e=>this.pick(e));
    this.gizmo.addEventListener('dragging-changed',e=>{this.dragging=e.value;this.orbit.enabled=!e.value;this.playing=false;if(e.value)this.checkpoint();else if(this.doc){if(this.target==='prop')this.recordProp(this.readProp());else this.record(this.readRig());}});
    this.gizmo.addEventListener('objectChange',()=>{if(!this.dragging||!this.doc)return;if(this.target==='prop'&&this.mode==='scale'){const object=this.props.find(p=>p.pr.id===this.propId)?.object;if(object){const axis=this.gizmo.axis==='Y'?'y':this.gizmo.axis==='Z'?'z':'x',value=Math.max(.01,Math.min(100,object.scale[axis]));object.scale.setScalar(value);}}else if(this.target==='actor'&&this.mode==='move')this.solveDrag();this.updateMarkers();this.updateAngles();});
    this.root.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea')||!this.doc)return;if(e.code==='Space'&&!e.target.closest('button,summary')){e.preventDefault();this.q('play').click();}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.undo(e.shiftKey);}});
  }
  populateLibraries(){
    this.q('character').replaceChildren(...this.registry.list('character').map(({doc:d})=>new Option(localised(d.name,d.id),d.id)));
    this.q('prop-library').replaceChildren(...this.registry.list('prop').map(({doc:d})=>new Option(localised(d.name,d.id),d.id)));
  }
  selectActor(role){this.role=role;this.target='actor';if(this.mode==='scale')this.mode='rotate';this.refreshFields();this.seek(this.time);this.root.querySelector('.ss-ae-inspector').scrollTop=0;}
  selectProp(id){this.propId=id;this.target='prop';this.mode='move';this.refreshFields();this.seek(this.time);this.root.querySelector('.ss-ae-inspector').scrollTop=0;}
  propLabel(pr){
    const role=pr.role||((pr.joint||pr.hand||this.doc.category!=='group')?this.roles[0].id:null),character=role&&this.registry.character(this.charByRole[role]);
    return `${this.doc.props.indexOf(pr)+1}. ${localised(this.registry.prop(pr.prop)?.name,pr.prop)}${character?' · '+localised(character.name,character.id):''}`;
  }
  selectedProp(){return this.doc.props.find(p=>p.id===this.propId);}
  activeFrames(){return this.target==='prop'?this.propFrames[this.propId]:this.frames[this.role];}
  currentPropPose(){return samplePropKeys(this.propFrames[this.propId],this.time,this.propInterpolation(this.propId));}
  propInterpolation(id){return this.editedProps[id]?this.interpolation:(this.doc.props.find(p=>p.id===id)?.transform?.interpolation||this.interpolation);}
  preparePropEdit(){
    const i=this.doc.props.findIndex(p=>p.id===this.propId);
    this.doc.props[i]=editableProp(this.doc.props[i],this.registry.prop(this.doc.props[i].prop));
    this.editedProps[this.propId]=true;
    const item=this.props.find(p=>p.pr.id===this.propId);if(item)item.pr=this.doc.props[i];
  }
  recordProp(pose,forceKey=false){
    const before=this.currentPropPose();this.preparePropEdit();
    const frames=this.propFrames[this.propId];
    if(!forceKey&&this.q('scope').value==='all'){
      for(const f of frames){f.at=f.at.map((v,i)=>v+pose.at[i]-before.at[i]);f.rotation=f.rotation.map((v,i)=>v+pose.rotation[i]-before.rotation[i]);f.scale=Math.max(.01,Math.min(100,f.scale*pose.scale/before.scale));}
    }else upsertPropKey(frames,this.time,pose,this.loop);
    this.changed();
  }
  forkForRoles(){
    // Existing stories refer to the old role contract. A different number of
    // participants is a new action, so those stories keep their original cast.
    if(!this.registry.action(this.doc.id))return;
    const base=this.doc.id.slice(0,48)+'-group';let id=base,n=2;
    while(this.registry.action(id))id=base+'-'+n++;
    this.doc.id=id;this.q('message').textContent=t('aeGroupCopy',{id});
  }
  async addRole(){
    if(this.roles.length>=LIMITS.roles)return;
    const owned=this.doc.props.filter(pr=>this.doc.category!=='group'||pr.role===this.role);
    if(this.doc.props.length+owned.length>24){this.q('message').textContent=t('aePropLimit');return;}
    this.checkpoint();this.playing=false;this.forkForRoles();
    if(this.doc.category!=='group'){
      this.doc.category='group';
      for(const pr of this.doc.props||[])pr.role=this.roles[0].id;
      // A formation plays the authored poses; solo path/seat controls belong
      // to the source action and cannot describe several independently cast people.
      this.doc.type='overlay';for(const key of ['seatLift','anchor','posture','hold','speed','poseByFace'])delete this.doc[key];
    }
    let n=1;while(this.roles.some(r=>r.id==='person'+n))n++;
    const id='person'+n,source=this.roles.find(r=>r.id===this.role),at=[+(Math.max(...this.roles.map(r=>r.at[0]))+1.2).toFixed(3),source.at[1],source.at[2]];
    this.roles.push({id,name:{en:`Participant ${this.roles.length+1}`,pt:`Participante ${this.roles.length+1}`,ja:`参加者 ${this.roles.length+1}`},at,yaw:source.yaw,optional:false});
    this.parts[id]=copy(this.parts[this.role]);this.frames[id]=copy(this.frames[this.role]);
    for(const original of owned){
      const base=`${original.prop.slice(0,44)}-${id}`;let propId=base,k=2;while(this.doc.props.some(p=>p.id===propId))propId=`${base}-${k++}`;
      this.doc.props.push({...copy(original),id:propId,role:id});this.propFrames[propId]=copy(this.propFrames[original.id]);if(this.editedProps[original.id])this.editedProps[propId]=true;
    }
    const pool=['rui','carmen','tom','lia'].filter(id=>this.registry.character(id));
    this.charByRole[id]=pool.find(id=>!Object.values(this.charByRole).includes(id))||pool[this.roles.length%pool.length]||this.charByRole[this.role];
    this.role=id;this.target='actor';if(this.mode==='scale')this.mode='rotate';this.dirty=true;this.refreshFields();await this.buildModels();this.frameCamera();this.revealParticipants();
  }
  async removeRole(){
    if(this.roles.length<=1)return;
    this.checkpoint();this.playing=false;this.forkForRoles();
    // Objects owned by the removed participant are removed with that role.
    const removed=this.doc.props.filter(p=>p.role===this.role);for(const p of removed){delete this.propFrames[p.id];delete this.editedProps[p.id];}
    this.doc.props=this.doc.props.filter(p=>p.role!==this.role);this.roles=this.roles.filter(r=>r.id!==this.role);
    delete this.frames[this.role];delete this.parts[this.role];delete this.charByRole[this.role];
    this.role=this.roles[0].id;this.target='actor';if(this.mode==='scale')this.mode='rotate';this.dirty=true;this.refreshFields();await this.buildModels();this.frameCamera();this.revealParticipants();
  }
  revealParticipants(){for(const panel of this.root?.querySelectorAll('.ss-ae-panel')||[])panel.scrollTop=0;}
  async addProp(){
    if(this.doc.props.length>=24)return;
    const definition=this.registry.prop(this.q('prop-library').value);if(!definition)return;
    this.checkpoint();this.playing=false;let n=1;while(this.doc.props.some(p=>p.id==='object'+n))n++;
    const prop={id:'object'+n,prop:definition.id,at:[0,0,1],yaw:0,scale:definition.scale||1,space:'ground',motion:[]};
    this.doc.props.push(prop);this.propFrames[prop.id]=bakePropMotion(prop,this.duration);this.propId=prop.id;this.target='prop';this.mode='move';this.dirty=true;this.refreshFields();await this.buildModels();
  }
  async removeProp(){
    this.checkpoint();this.playing=false;this.doc.props=this.doc.props.filter(p=>p.id!==this.propId);delete this.propFrames[this.propId];delete this.editedProps[this.propId];
    this.propId=null;this.target='actor';if(this.mode==='scale')this.mode='rotate';this.dirty=true;this.refreshFields();await this.buildModels();
  }
  async changeAttachment(){
    const value=this.q('attachment').value;this.checkpoint();this.playing=false;this.preparePropEdit();
    const pr=this.selectedProp(),item=this.props.find(p=>p.pr.id===pr.id);if(!item)return;
    const oldParent=item.object.parent,oldItem={...item,pr:copy(pr)};let parent=this.stage.content;
    delete pr.hand;delete pr.joint;delete pr.role;delete pr.bodyScale;pr.space='ground';
    if(value!=='world'){
      const [role,joint]=value.split(':');pr.role=role;
      if(joint==='$body')delete pr.space;
      else if(joint!=='$ground'){pr.joint=joint;parent=this.models.get(role).userData.pivots[joint];}
    }
    // Re-express every key in its new attachment frame, preserving the path.
    const saved=this.time;
    const original=this.propFrames[pr.id],times=new Set(original.map(f=>f.t));
    const count=Math.min(120,Math.max(16,Math.ceil(this.duration*12)));for(let i=0;i<=count;i++)times.add(i/count);
    const converted=[...times].sort((a,b)=>a-b).map(t=>({...samplePropKeys(original,t,this.interpolation),t}));let previous;
    for(const f of converted){
      this.time=f.t;for(const [r,m] of this.models)applyPose(m,sampleFrames(this.frames[r],f.t,this.interpolation));this.stage.scene.updateMatrixWorld(true);
      const transform=this.propToWorld(oldItem,f,oldParent);
      const destination={pr,role:pr.role||this.roles[0].id,joint:pr.joint};
      const basis=this.propToWorld(destination,{at:[0,0,0],rotation:[0,0,0],scale:1},parent);
      const local=basis.invert().multiply(transform);
      const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();local.decompose(pos,quat,scale);
      f.at=pos.toArray();const euler=new THREE.Euler().setFromQuaternion(quat,'YXZ');f.rotation=[euler.x,euler.y,euler.z].map((v,i)=>previous?v+Math.round((previous[i]-v)/(Math.PI*2))*Math.PI*2:v);previous=f.rotation;f.scale=scale.x;
    }
    this.propFrames[pr.id]=converted;
    this.time=saved;this.dirty=true;this.refreshFields();await this.buildModels();
  }
  pick(e){
    if(e.button!==0||this.gizmo.axis||!this.doc)return;
    const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.stage.camera);
    const marker=this.target==='actor'&&this.ray.intersectObjects(this.markers)[0];
    if(marker){this.selected=marker.object.userData.joint;this.refreshFields();this.seek(this.time);return;}
    const hit=this.ray.intersectObjects([...this.props.map(p=>p.object),...this.models.values()],true)[0];if(!hit)return;
    for(let obj=hit.object;obj;obj=obj.parent){const prop=this.props.find(p=>p.object===obj);if(prop){this.selectProp(prop.pr.id);return;}const role=[...this.models].find(([,m])=>m===obj);if(role){this.selectActor(role[0]);return;}}
  }
  async load(doc){
    this.doc=copy(doc);if(typeof this.doc.name==='string')this.doc.name={en:doc.name,pt:doc.name,ja:doc.name};
    this.duration=Math.max(.2,Math.min(30,doc.reps?doc.period:(doc.duration||4)));this.loop=!!doc.reps;
    this.interpolation=[...(doc.joints||[]),...(doc.root||[]),...Object.values(doc.parts||{}).flatMap(p=>[...(p.joints||[]),...(p.root||[])])].find(c=>c.keys)?.interpolation||'smooth';
    this.roles=doc.category==='group'?copy(doc.roles):[{id:'solo',name:{en:'Solo',pt:'Individual',ja:'単独'},at:[0,0,0],yaw:0}];
    this.parts={};this.frames={};this.charByRole={};
    for(const [i,r] of this.roles.entries()){this.parts[r.id]=copy(doc.category==='group'?(doc.parts[r.id]||{pose:doc.pose||'stand'}):doc);this.frames[r.id]=bakeMotion(doc,this.parts[r.id]);this.charByRole[r.id]=this.registry.character(doc.previewCast?.[r.id])?doc.previewCast[r.id]:['rui','carmen','tom','lia'][i%4];}
    this.doc.props||=[];this.propFrames={};this.editedProps={};for(const pr of this.doc.props)this.propFrames[pr.id]=bakePropMotion(editableProp(pr,this.registry.prop(pr.prop)),this.duration);
    this.target='actor';this.propId=null;this.mode='rotate';this.clipboard=null;this.q('message').textContent='';this.q('scope').value='key';
    this.role=this.roles[0].id;this.time=0;this.playing=false;this.history=[];this.future=[];this.dirty=false;
    this.q('role').replaceChildren(...this.roles.map(r=>new Option(localised(r.name,r.id),r.id)));this.q('role').disabled=this.roles.length===1;
    this.populateLibraries();
    this.refreshFields();await this.buildModels();this.frameCamera();this.seek(0);this.revealParticipants();this.root.scrollTop=0;
  }
  async buildModels(){
    const load=(this.modelLoad||0)+1;this.modelLoad=load;this.gizmo.detach();
    for(const m of this.models.values()){this.stage.content.remove(m);disposeCharacter(m);}this.models.clear();
    for(const p of this.props){p.object.parent?.remove(p.object);p.object.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});}this.props=[];
    for(const r of this.roles){const doc=this.registry.character(this.charByRole[r.id])||this.registry.character('rui'),m=buildCharacter(doc,doc.defaultOutfit);m.position.set(...r.at);m.rotation.y=-r.yaw*DEG;this.models.set(r.id,m);this.stage.content.add(m);}
    for(const pr of this.doc.props||[]){const d=this.registry.prop(pr.prop);if(!d)continue;let object;try{object=await propObject(d,id=>this.registry.blob(id));}catch{continue;}if(load!==this.modelLoad){object?.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});return;}if(!object)continue;
      const display=editableProp(pr,d),holder=new THREE.Group();holder.rotation.order='YXZ';holder.add(object);const role=pr.role||this.roles[0].id;const actor=this.models.get(role),joint=display.joint;
      const parent=joint&&actor?.userData.pivots[joint]||this.stage.content;parent.add(holder);
      if(display.offset)object.position.set(...display.offset);
      this.props.push({object:holder,pr,role,joint,display});}
    for(const dot of this.markers){dot.geometry.dispose();dot.material.dispose();}
    this.markerGroup.clear();this.markers=[];
    for(const j of JOINT_NAMES){const dot=new THREE.Mesh(new THREE.SphereGeometry(.023,10,8),new THREE.MeshBasicMaterial({color:0x008f7d,depthTest:false}));dot.renderOrder=10;dot.userData.joint=j;this.markerGroup.add(dot);this.markers.push(dot);}
    this.seek(this.time);
  }
  frameCamera(){
    const bounds=new THREE.Box3().setFromObject(this.stage.content);if(bounds.isEmpty())return;
    const center=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(1,.65,1).normalize();
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
    const tan=Math.tan(this.stage.camera.fov*DEG/2),aspect=this.stage.camera.aspect||1;let distance=1.5;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const corner=new THREE.Vector3(x,y,z).sub(center),depth=corner.dot(direction);
      distance=Math.max(distance,depth+Math.abs(corner.dot(right))/(tan*aspect),depth+Math.abs(corner.dot(up))/tan);
    }
    this.orbit.target.copy(center);this.stage.camera.position.copy(center).addScaledVector(direction,distance*1.12);this.orbit.update();
  }
  currentPose(){return sampleFrames(this.frames[this.role],this.time,this.interpolation);}
  readRig(){const m=this.models.get(this.role),pose=this.currentPose();for(const j of JOINT_NAMES){const r=m.userData.pivots[j].rotation;pose.joints[j]=[r.x,r.y,r.z];}const body=m.userData.body||m;pose.root={lift:body.position.y/m.userData.height,shift:body.position.x/m.userData.height,tiltZ:body.rotation.z};return pose;}
  seek(time){if(!this.doc)return;this.time=Math.max(0,Math.min(1,time||0));for(const [r,m] of this.models){const role=this.roles.find(role=>role.id===r);if(!role||!this.frames[r])continue;m.position.set(...role.at);m.rotation.y=-role.yaw*DEG;applyPose(m,sampleFrames(this.frames[r],this.time,this.interpolation));}this.stage.scene.updateMatrixWorld(true);this.updateProps();this.updateMarkers();this.attach();this.updateAngles();this.q('scrub').value=this.time;if(document.activeElement!==this.q('time'))this.q('time').value=(this.time*this.duration).toFixed(2);this.q('play').textContent=t(this.playing?'pause':'play');this.drawKeys();}
  updateProps(){
    for(const item of this.props){
      const {object,pr}=item;
      const pose=this.editedProps[pr.id]?samplePropKeys(this.propFrames[pr.id],this.time,this.interpolation):samplePropTransform(item.display,this.time,this.time*this.duration,true);
      const local=this.propLocalPose(item,pose);object.position.set(...local.at);object.rotation.set(...local.rotation,'YXZ');object.scale.setScalar(local.scale);
    }
  }
  propLocalPose(item,pose){
    const {pr,joint,role}=item,m=this.models.get(role),size=pr.bodyScale&&joint&&m?m.userData.height/1.76:1;
    const out={at:pose.at.map(v=>v*size),rotation:[...pose.rotation],scale:pose.scale*size};
    if(!joint&&(this.doc.category!=='group'||pr.role)&&m){
      const r=this.roles.find(r=>r.id===role),yaw=r.yaw*DEG,cos=Math.cos(yaw),sin=Math.sin(yaw),[x,y,z]=out.at;
      const lift=pr.space==='ground'?0:sampleFrames(this.frames[role],this.time,this.interpolation).root.lift*m.userData.height;
      out.at=[r.at[0]+x*cos+z*sin,r.at[1]+y+lift,r.at[2]-x*sin+z*cos];out.rotation[1]+=yaw;
    }return out;
  }
  propToWorld(item,pose,parent=item.object.parent){
    const local=this.propLocalPose(item,pose),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...local.at),new THREE.Quaternion().setFromEuler(new THREE.Euler(...local.rotation,'YXZ')),new THREE.Vector3().setScalar(local.scale));
    return new THREE.Matrix4().multiplyMatrices(parent.matrixWorld,matrix);
  }
  readProp(){
    const item=this.props.find(p=>p.pr.id===this.propId);if(!item)return this.currentPropPose();
    const current=this.currentPropPose(),local=this.propLocalPose(item,current),object=item.object;
    const pose={at:object.position.toArray(),rotation:[object.rotation.x,object.rotation.y,object.rotation.z],scale:object.scale.x};
    const size=local.scale/current.scale;
    if(!item.joint&&(this.doc.category!=='group'||item.pr.role)){
      const r=this.roles.find(r=>r.id===item.role),yaw=r.yaw*DEG,cos=Math.cos(yaw),sin=Math.sin(yaw);
      const x=pose.at[0]-r.at[0],z=pose.at[2]-r.at[2];pose.at=[x*cos-z*sin,pose.at[1]-(local.at[1]-current.at[1]*size),x*sin+z*cos];pose.rotation[1]-=yaw;
    }
    pose.at=pose.at.map(v=>v/size);pose.scale=Math.max(.01,Math.min(100,pose.scale/size));
    pose.rotation=pose.rotation.map((v,i)=>v+Math.round((current.rotation[i]-v)/(Math.PI*2))*Math.PI*2);
    return pose;
  }
  attach(){if(this.dragging)return;
    for(const mode of ['move','rotate','scale'])this.q(mode).classList.toggle('is-active',this.mode===mode);
    this.gizmo.showX=true;this.gizmo.showY=true;this.gizmo.showZ=true;
    if(this.target==='prop'){
      const item=this.props.find(p=>p.pr.id===this.propId);if(!item){this.gizmo.detach();return;}
      this.gizmo.setMode(this.mode==='move'?'translate':this.mode);this.gizmo.setSpace(this.mode==='move'?'world':'local');this.gizmo.attach(item.object);return;
    }
    const m=this.models.get(this.role);if(!m)return;const joint=m.userData.pivots[this.selected];this.gizmo.setMode(this.mode==='move'?'translate':'rotate');
    if(this.mode==='rotate'){this.gizmo.setSpace('local');this.gizmo.attach(joint);}else{joint.getWorldPosition(this.proxy.position);this.proxy.rotation.set(0,0,0);this.gizmo.setSpace('world');this.gizmo.showZ=this.selected!=='hips';this.gizmo.attach(this.proxy);}
    this.q('rotate').classList.toggle('is-active',this.mode==='rotate');this.q('move').classList.toggle('is-active',this.mode==='move');}
  solveDrag(){const m=this.models.get(this.role),p=m.userData.pivots,target=this.proxy.position.clone();
    if(this.selected==='hips'){const local=m.worldToLocal(target);const pose=this.currentPose(),rest=p.hips.position.clone().applyAxisAngle(new THREE.Vector3(0,0,1),pose.root.tiltZ||0);pose.root.lift=(local.y-rest.y)/m.userData.height;pose.root.shift=(local.x-rest.x)/m.userData.height;applyPose(m,pose);return;}
    const chain=END_CHAINS[this.selected]||[jointParent(this.selected)].filter(Boolean);const endpoint=p[this.selected];
    const distance=()=>{m.updateMatrixWorld(true);return endpoint.getWorldPosition(new THREE.Vector3()).distanceToSquared(target);};
    // Coordinate descent works for both voxel pivots and the imported bones.
    // It only changes joint rotations; no bone length or rest position is edited.
    for(const step of [.18,.07,.025])for(let pass=0;pass<5;pass++)for(const j of chain)for(const axis of ['x','y','z']){
      const r=p[j].rotation,old=r[axis];let best=distance(),angle=old;
      for(const sign of [-1,1]){let value=old+step*sign;const lower=/Fore$/.test(j)&&axis==='z'?0:-2.8,upper=/Shin$/.test(j)&&axis==='z'?.2:2.8;value=Math.max(lower,Math.min(upper,value));r[axis]=value;const d=distance();if(d<best){best=d;angle=value;}}
      r[axis]=angle;
    }m.updateMatrixWorld(true);
  }
  updateMarkers(){this.markerGroup.visible=this.target==='actor';const m=this.models.get(this.role);if(!m)return;m.updateMatrixWorld(true);for(const dot of this.markers){m.userData.pivots[dot.userData.joint].getWorldPosition(dot.position);dot.material.color.setHex(dot.userData.joint===this.selected?0xf2a844:0x008f7d);}}
  updateAngles(){
    if(this.target==='prop'){
      const pose=this.dragging?this.readProp():this.currentPropPose();for(const [i,a] of ['x','y','z'].entries()){this.q('angle-'+a).value=(pose.rotation[i]/DEG).toFixed(1);this.q('pos-'+a).value=pose.at[i].toFixed(3);}this.q('prop-scale').value=pose.scale.toFixed(3);return;
    }
    const m=this.models.get(this.role);if(!m)return;const r=m.userData.pivots[this.selected].rotation;for(const a of ['x','y','z'])this.q('angle-'+a).value=(r[a]/DEG).toFixed(1);
  }
  record(pose){upsertFrame(this.frames[this.role],this.time,pose,this.loop);this.changed();}
  changed(){this.dirty=true;this.seek(this.time);this.refreshFields();}
  snapshot(){return copy({doc:this.doc,roles:this.roles,charByRole:this.charByRole,role:this.role,target:this.target,propId:this.propId,selected:this.selected,mode:this.mode,parts:this.parts,frames:this.frames,propFrames:this.propFrames,editedProps:this.editedProps,duration:this.duration,loop:this.loop,interpolation:this.interpolation,time:this.time});}
  checkpoint(){this.history.push(this.snapshot());if(this.history.length>40)this.history.shift();this.future=[];}
  async undo(redo){const from=redo?this.future:this.history,to=redo?this.history:this.future;if(!from.length)return;this.playing=false;to.push(this.snapshot());Object.assign(this,from.pop());this.dirty=true;this.refreshFields();await this.buildModels();}
  refreshFields(){if(!this.doc)return;
    this.q('id').value=this.doc.id;for(const lang of ['en','pt','ja'])this.q('name-'+lang).value=this.doc.name[lang]||'';this.q('duration').value=this.duration;this.q('loop').checked=this.loop;this.q('base').value=this.parts[this.role].pose||'stand';
    this.q('role').replaceChildren(...this.roles.map(r=>new Option(localised(r.name,r.id),r.id)));this.q('role').value=this.role;
    this.q('character').value=this.charByRole[this.role];this.q('joint').value=this.selected;this.q('interpolation').value=this.interpolation;this.q('time').max=this.duration;this.q('undo').disabled=!this.history.length;this.q('redo').disabled=!this.future.length;
    const prop=this.target==='prop',r=this.roles.find(r=>r.id===this.role),pr=this.selectedProp();
    this.q('actor-fields').hidden=prop;this.q('prop-fields').hidden=!prop;this.q('scale').hidden=!prop;this.q('reset').hidden=prop;this.q('formation').hidden=this.doc.category!=='group';
    this.q('hint').textContent=t(prop?'aePropHint':'aeHint');
    for(const [i,a] of ['x','y','z'].entries()){this.q('role-'+a).value=r.at[i];this.q('angle-'+a).min=prop?-180000:-180;this.q('angle-'+a).max=prop?180000:180;}this.q('role-yaw').value=r.yaw;
    this.q('participants-count').textContent=`${this.roles.length} / ${LIMITS.roles}`;
    this.q('add-role').disabled=this.roles.length>=LIMITS.roles;this.q('remove-role').disabled=prop||this.roles.length<=1;
    this.q('add-prop').disabled=this.doc.props.length>=24;
    this.q('paste').disabled=this.clipboard?.type!==this.target;
    const label=prop?this.propLabel(pr):`${localised(r.name,r.id)} · ${localised(this.registry.character(this.charByRole[r.id])?.name,this.charByRole[r.id])}`;
    this.q('selection').textContent=label;this.q('inspector-title').textContent=prop?t('aeObjects'):t('aeRole');
    const button=(text,selected,callback)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=selected?'is-active':'';b.setAttribute('aria-pressed',String(selected));b.onclick=callback;return b;};
    this.q('participants').replaceChildren(...this.roles.map((role,i)=>button(`${i+1}. ${localised(role.name,role.id)} · ${localised(this.registry.character(this.charByRole[role.id])?.name,this.charByRole[role.id])}`,!prop&&role.id===this.role,()=>this.selectActor(role.id))));
    this.q('objects').replaceChildren(...this.doc.props.map(p=>button(this.propLabel(p),prop&&p.id===this.propId,()=>this.selectProp(p.id))));
    if(!this.doc.props.length)this.q('objects').textContent=t('aeNoObjects');
    if(prop){
      const options=[new Option(t('aeWorld'),'world')];
      for(const role of this.roles){
        options.push(new Option(`${localised(role.name,role.id)} · ${t('aeOwnerBody')}`,`${role.id}:$body`),new Option(`${localised(role.name,role.id)} · ${t('aeOwnerGround')}`,`${role.id}:$ground`));
        for(const joint of JOINT_NAMES)options.push(new Option(`${localised(role.name,role.id)} · ${t(JOINT_LABELS[joint])}`,`${role.id}:${joint}`));
      }
      this.q('attachment').replaceChildren(...options);const joint=pr.joint||(pr.hand==='left'?'lHand':pr.hand==='right'?'rHand':null);
      this.q('attachment').value=joint?`${pr.role||this.roles[0].id}:${joint}`:pr.role?`${pr.role}:${pr.space==='ground'?'$ground':'$body'}`:'world';this.q('body-scale').checked=!!pr.bodyScale;this.q('body-scale').disabled=!joint;
    }
  }
  drawKeys(){const host=this.q('keys');host.replaceChildren();const frames=this.activeFrames();if(!frames)return;this.q('delete').disabled=!frames.some((f,i)=>i>0&&i<frames.length-1&&Math.abs(f.t-this.time)<.0001);this.q('count').textContent=t('aeCount',{n:String(frames.length)});
    for(const [i,f] of frames.entries()){const b=document.createElement('button');b.type='button';b.className='ss-ae-key'+(Math.abs(f.t-this.time)<.0001?' is-active':'');b.style.left=`${f.t*100}%`;b.textContent='◆';b.title=`${(f.t*this.duration).toFixed(2)} s`;b.setAttribute('aria-label',t('aePoseAt',{time:(f.t*this.duration).toFixed(2)}));
      b.onclick=()=>{if(!this.movedKey){this.playing=false;this.seek(f.t);}this.movedKey=false;};
      b.onpointerdown=e=>{if(i===0||i===frames.length-1)return;this.playing=false;this.checkpoint();b.setPointerCapture(e.pointerId);const start=e.clientX;let next=f.t;
        b.onpointermove=ev=>{if(Math.abs(ev.clientX-start)>3)this.movedKey=true;const rect=host.getBoundingClientRect();next=Math.max(frames[i-1].t+.0001,Math.min(frames[i+1].t-.0001,(ev.clientX-rect.left)/rect.width));b.style.left=`${next*100}%`;};
        b.onpointerup=()=>{b.onpointermove=null;b.onpointerup=null;b.onpointercancel=null;if(this.movedKey){if(this.target==='prop')this.preparePropEdit();f.t=next;this.time=next;this.changed();}};b.onpointercancel=()=>{b.onpointermove=null;b.onpointerup=null;b.onpointercancel=null;this.movedKey=false;this.drawKeys();};};host.appendChild(b);}
  }
  document(){const doc=copy(this.doc);doc.duration=this.duration;if(this.loop){doc.reps=true;doc.period=this.duration;doc.defaultReps||=4;}else{delete doc.reps;delete doc.period;delete doc.rate;}
    doc.previewCast=copy(this.charByRole);
    if(doc.category==='group'){doc.roles=copy(this.roles);doc.parts={};}
    for(const pr of doc.props)if(this.editedProps[pr.id])pr.transform={keys:copy(this.propFrames[pr.id]),interpolation:this.interpolation,loop:this.loop};
    for(const r of this.roles){const motion=encodeFrames(this.frames[r.id],this.parts[r.id].pose||'stand',this.loop,this.interpolation);if(doc.category==='group')doc.parts[r.id]=motion;else Object.assign(doc,motion);}
    // Keyframes use a cycle clock, not walking speed. Moves retain their path
    // and speed fields but play the authored cycle at the chosen period.
    delete doc.rate;delete doc.poseByFace;delete doc.gesture;if(doc.type==='move')doc.period=this.duration;
    return doc;}
  validated(){const v=validate(this.document(),{actions:this.registry.actionMap()});this.q('message').textContent=v.ok?'':v.errors.map(e=>`${e.path}: ${e.message}`).join('\n');return v.ok?v.doc:null;}
  async save(){const doc=this.validated();if(doc)await this.onSave(doc);}
  start(){if(this.active)return;this.active=true;let last=performance.now();const tick=now=>{if(!this.active)return;const dt=Math.min(.1,(now-last)/1000);last=now;if(this.playing&&this.doc){let time=this.time+dt/this.duration;if(time>=1){if(this.loop)time%=1;else{time=1;this.playing=false;}}this.seek(time);}this.orbit.update();this.stage.render();this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);}
  stop(){this.active=false;this.playing=false;cancelAnimationFrame(this.raf);this.gizmo.detach();}
  resize(w,h){this.stage.resize(w,h);this.stage.render();}
}
