import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createRobot} from './robot.js';
import {createCollisionGuard} from './collision.js';
import {validateProgram,sampleProgram,toROSTrajectory,makeDemo,estimatePeakSpeed} from './motion.js';
import {strings} from './i18n.js';
import {captureStrings} from './capture-i18n.js';
import {createCapturePanel,validateCaptureState} from './capture.js';
for(const code of Object.keys(strings))Object.assign(strings[code],captureStrings[code]);

const $=id=>document.getElementById(id), KEY='vc.robotLab.v1';
const DEFAULT_SCENE={lighting:1,background:'theme',color:'#72858c'};
let sceneSettings={...DEFAULT_SCENE};
let stored=null,restored=false;try{stored=JSON.parse(localStorage.getItem(KEY));}catch{}
let lang=strings[stored?.lang]?stored.lang:(strings[navigator.language.slice(0,2)]?navigator.language.slice(0,2):'en');
let theme=stored?.theme==='light'?'light':'dark';
const t=k=>strings[lang][k]||strings.en[k]||k;
const rig=createRobot(), joints=rig.joints, byId=Object.fromEntries(joints.map(j=>[j.id,j])),neutralDefaults=joints.find(j=>j.collision)?.collision.neutral||{};
let limits={}, colors={shell:'#e4e9e8',accent:'#00c4a4',dark:'#252e35'}, poses=[], values=Object.fromEntries(joints.map(j=>[j.id,neutralDefaults[j.id]??j.home]));
let program=makeDemo(joints,'wave'),compiled=validateProgram(program,joints),draft='',dirty=false;
let selected='neck_yaw',frameIndex=0,time=0,playing=false,saveTimer,toastTimer,tab='joint';
let speed=1,loop=false,preview=null,liveCapture=false,storageOK=true;
let captureData={version:1,settings:{},clips:[]},capturePanel=null;
function defs(){return joints.map(j=>({...j,...limits[j.id]}));}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function project(){return {format:'robot-lab',version:1,lang,theme,scene:{...sceneSettings},colors,limits,poses,values:preview?{...preview.editor.values}:values,program,draft,tab,capture:capturePanel?.getData()||captureData};}
function saveNow(){clearTimeout(saveTimer);try{localStorage.setItem(KEY,JSON.stringify(project()));storageOK=true;$('save-status').textContent=t('saved');return true;}catch{storageOK=false;$('save-status').textContent=t('storageError');toast(t('storageError'));return false;}}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,250);}
function validColors(c){return c&&['shell','accent','dark'].every(k=>/^#[0-9a-f]{6}$/i.test(c[k]));}
function validateSceneSettings(value){
 if(value===undefined)return {...DEFAULT_SCENE};
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isFinite(value.lighting)||value.lighting<.4||value.lighting>2||!['theme','custom'].includes(value.background)||typeof value.color!=='string'||!/^#[0-9a-f]{6}$/i.test(value.color))throw Error('scene');
 return {lighting:value.lighting,background:value.background,color:value.color};
}
function validatePose(v,definitions=joints){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(id=>!Object.hasOwn(byId,id)))throw Error('pose');for(const j of definitions)if(typeof v[j.id]!=='number'||!Number.isFinite(v[j.id])||v[j.id]<j.min||v[j.id]>j.max)throw Error('pose');return Object.fromEntries(definitions.map(j=>[j.id,v[j.id]]));}
function validateProject(p){
 if(!p||p.format!=='robot-lab'||p.version!==1||!validColors(p.colors)||!p.limits||typeof p.limits!=='object'||Array.isArray(p.limits))throw Error('project');
 const cleanLimits={};for(const [id,c]of Object.entries(p.limits)){const j=byId[id];if(!Object.hasOwn(byId,id)||!c||![c.min,c.max,c.speed].every(Number.isFinite)||c.min<j.min||c.max>j.max||c.min>0||c.max<0||c.min>=c.max||c.speed<1||c.speed>1440)throw Error('limits');cleanLimits[id]={min:c.min,max:c.max,speed:c.speed};}
 const definitions=joints.map(j=>({...j,...cleanLimits[j.id]}));validateProgram(p.program,joints);
 if(!Array.isArray(p.poses)||p.poses.length>100)throw Error('poses');const cleanPoses=p.poses.map(pose=>{if(!pose||typeof pose.name!=='string'||!pose.name.trim()||pose.name.length>60)throw Error('name');return {name:pose.name,values:validatePose(pose.values)};});
 if(typeof p.draft!=='string'||p.draft.length>1500000)throw Error('draft');
 return {...p,scene:validateSceneSettings(p.scene),limits:cleanLimits,values:validatePose(p.values,definitions),poses:cleanPoses,capture:validateCaptureState(p.capture,joints)};
}
function restore(p){sceneSettings={...p.scene};limits=p.limits;colors=p.colors;poses=p.poses;values=p.values;program=p.program;compiled=validateProgram(program,joints);draft=p.draft;dirty=draft!==JSON.stringify(program,null,2);lang=strings[p.lang]?p.lang:lang;theme=p.theme==='light'?'light':'dark';tab=['joint','motion','style','capture'].includes(p.tab)?p.tab:'joint';captureData=p.capture||validateCaptureState(null,joints);}
if(stored){try{restore(validateProject(stored));restored=true;}catch{setTimeout(()=>toast(t('importError')),500);}}
if(!restored){draft=JSON.stringify(program,null,2);dirty=false;captureData=validateCaptureState(null,joints);}

const displayGuard=createCollisionGuard(defs()),captureGuard=createCollisionGuard(defs());
let collisionState={adjusted:false,blocked:false,collisions:[],maxPenetration:0},captureCollision=null;
function configureGuards(){const definitions=defs();displayGuard.configure(definitions);captureGuard.configure(definitions);}

// Render the articulated model, studio lights and a meter grid.
const viewport=$('viewport'),scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
viewport.append(renderer.domElement);$('loading').hidden=true;
const camera=new THREE.PerspectiveCamera(36,1,.01,100);camera.position.set(2.3,1.7,3.5);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.92,0);orbit.enableDamping=true;orbit.minDistance=.38;orbit.maxDistance=10;orbit.maxPolarAngle=Math.PI*.88;
scene.add(rig.root);rig.setColors(colors);
const hemisphere=new THREE.HemisphereLight(0xe6f5ff,0x617478,2.5);scene.add(hemisphere);
const key=new THREE.DirectionalLight(0xfff2df,3.8);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2.5;key.shadow.camera.bottom=-2;key.shadow.normalBias=.025;scene.add(key);
const rim=new THREE.DirectionalLight(0x78b8ff,3);rim.position.set(-3,2,-2);scene.add(rim);
const fill=new THREE.DirectionalLight(0xe9f2ff,2);fill.position.set(-4,3,5);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x172329,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.013;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(12,60,0x4b696c,0x2b4148);grid.position.y=-.008;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
const pad=new THREE.Mesh(new THREE.CylinderGeometry(.71,.74,.026,96),new THREE.MeshStandardMaterial({color:0x273a3f,metalness:.4,roughness:.5}));pad.position.y=-.017;pad.receiveShadow=true;scene.add(pad);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.67,.002,6,96),new THREE.MeshBasicMaterial({color:0x62d9ba}));ring.rotation.x=Math.PI/2;ring.position.y=-.002;scene.add(ring);
const resize=()=>{const w=viewport.clientWidth,h=viewport.clientHeight;viewport.style.setProperty('--viewport-height',h+'px');renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(viewport);resize();
function applyScene(){
 const custom=sceneSettings.background==='custom';
 scene.background=new THREE.Color(custom?sceneSettings.color:theme==='dark'?0x44525b:0xdce5e3);
 scene.fog=new THREE.Fog(scene.background,8,20);
 if(custom){floor.material.color.copy(scene.background).multiplyScalar(.8);pad.material.color.copy(scene.background).lerp(new THREE.Color(0xffffff),.16);}
 else{floor.material.color.set(theme==='dark'?0x39474e:0xd6e0dc);pad.material.color.set(theme==='dark'?0x54676e:0xb9cbc5);}
 hemisphere.intensity=2.5*sceneSettings.lighting;key.intensity=3.8*sceneSettings.lighting;rim.intensity=3*sceneSettings.lighting;fill.intensity=2*sceneSettings.lighting;
 $('scene-light').value=Math.round(sceneSettings.lighting*100);$('scene-light-value').textContent=Math.round(sceneSettings.lighting*100)+'%';
 $('scene-background').value=sceneSettings.background;$('scene-color').value=sceneSettings.color;$('scene-color').disabled=!custom;
}
function applyTheme(){document.documentElement.dataset.theme=theme;applyScene();}
function name(j){return j.label[lang]||j.label.en;}
function showTab(next){if(next==='motion')exitPreview();tab=next;document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});['joint','motion','style','capture'].forEach(id=>$('tab-'+id).hidden=id!==tab);capturePanel?.setActive(tab==='capture');save();}
// A selector keeps every joint accessible when the hierarchy is hidden on mobile.
const picker=document.createElement('select');picker.id='joint-picker';picker.style.cssText='width:100%;margin-bottom:12px';$('tab-joint').prepend(picker);picker.onchange=()=>selectJoint(picker.value);
function renderTree(){
 const tree=$('joint-tree'),open=new Set([...tree.querySelectorAll('details[open]')].map(d=>d.dataset.group)),query=$('joint-search').value.toLocaleLowerCase();const initial=!tree.children.length;tree.replaceChildren();picker.replaceChildren();
 for(const group of [...new Set(joints.map(j=>j.group))]){const list=joints.filter(j=>j.group===group);const optgroup=document.createElement('optgroup');optgroup.label=t('group_'+group);for(const j of list){const option=new Option(name(j),j.id);optgroup.append(option);}picker.append(optgroup);
 const filtered=list.filter(j=>(name(j)+' '+j.id).toLocaleLowerCase().includes(query));if(!filtered.length)continue;const details=document.createElement('details');details.className='joint-group';details.dataset.group=group;details.open=!!query||initial&&(group==='head'||group==='torso'||group==='right_arm')||open.has(group);const summary=document.createElement('summary');summary.textContent=t('group_'+group);details.append(summary);
 for(const j of filtered){const b=document.createElement('button');b.className='joint-item';b.dataset.joint=j.id;const label=document.createElement('span');label.className='joint-title';label.textContent=name(j);const out=document.createElement('output');out.textContent=values[j.id].toFixed(0)+'°';b.append(label,out);b.onclick=()=>selectJoint(j.id);details.append(b);}tree.append(details);}
 if(!tree.children.length){const p=document.createElement('p');p.className='empty';p.textContent=t('noMatches');tree.append(p);}picker.value=selected;updateTree();
}
function updateTree(){document.querySelectorAll('[data-joint]').forEach(b=>{b.classList.toggle('active',b.dataset.joint===selected);b.querySelector('output').textContent=values[b.dataset.joint].toFixed(0)+'°';});}
function selectJoint(id){if(!byId[id])return;selected=id;rig.setSelected(id);picker.value=id;updateInspector();updateTree();}
function updateInspector(){const j=byId[selected],c=limits[selected]||j;$('joint-name').textContent=name(j);$('joint-id').textContent=j.id;$('selected-label').textContent=name(j);$('axis-label').textContent=t('axis')+' '+j.axis.toUpperCase();$('limit-low').textContent=c.min+'°';$('limit-high').textContent=c.max+'°';for(const id of ['angle','angle-slider']){$(id).min=c.min;$(id).max=c.max;$(id).value=Number(values[selected].toFixed(1));}$('joint-min').value=c.min;$('joint-max').value=c.max;$('joint-speed').value=c.speed||180;}
function showCollision(result){
 collisionState=result;const badge=$('collision-status');badge.hidden=!result.adjusted&&!result.blocked;badge.textContent=t(result.blocked?'collisionBlocked':'collisionAdjusted');
}
function setPose(p,persist=true,refresh=true,continuous=false){
 const safe=displayGuard.solve(p,{continuous});if(!safe.positions){showCollision(safe);return {...values};}for(const j of joints){values[j.id]=safe.positions[j.id]??j.home;rig.setJoint(j.id,values[j.id]);}showCollision(safe);
 if(refresh){updateInspector();updateTree();}if(persist)save();return {...values};
}
function neutralPose(){const configured=defs(),rest=configured.find(j=>j.collision)?.collision.neutral||{};return Object.fromEntries(configured.map(j=>[j.id,Math.min(j.max,Math.max(j.min,rest[j.id]??j.home??0))]));}
function resetRobotPose(){
 capturePanel?.pauseForReset();exitPreview();stop();const neutral=neutralPose();
 displayGuard.reset(neutral);captureGuard.reset(neutral);captureCollision=null;setPose(neutral);capturePanel?.resetTracking();updateTransport();toast(t('poseReset'));
}
function activeCompiled(){return preview?.compiled||compiled;}
function activeTime(){return preview?preview.time:time;}
function getPlayback(){return preview?{id:preview.id,name:preview.name,playing,time:preview.time,duration:preview.compiled.duration}:null;}
function updateTransport(){
 $('play').textContent=t(playing?'pause':'play');
 for(const id of ['play','stop','scrub','speed','loop'])$(id).disabled=liveCapture;
 $('capture').disabled=liveCapture||!!preview;document.querySelectorAll('#keyframes button').forEach(button=>button.disabled=liveCapture);
 if($('playback-name')){$('playback-name').textContent=liveCapture?t('capLiveRobot'):preview?`${t('capPlayback')}: ${preview.name}`:'';$('playback-name').title=$('playback-name').textContent;}
 if($('exit-preview')){$('exit-preview').hidden=!preview;$('exit-preview').textContent=t('capBackEditor');}
 capturePanel?.syncPlayback?.();
}
function stop(){playing=false;updateTransport();}
function exitPreview(){
 if(!preview)return;const editor=preview.editor;preview=null;playing=false;time=editor.time;frameIndex=editor.frameIndex;speed=editor.speed;loop=editor.loop;
 $('speed').value=String(speed);$('loop').checked=loop;setPose(editor.values,false);renderFrames();updateTransport();
}
function setLiveCapture(value){const next=!!value;if(next===liveCapture)return;if(next){exitPreview();stop();}liveCapture=next;updateTransport();}
function replayClip(clip,{autoplay=true}={}){
 if(autoplay&&preview?.id===clip.id){preview.name=clip.name;play();return true;}
 try{
  const replayProgram=JSON.parse(JSON.stringify(clip.program)),replayCompiled=validateCurrent(replayProgram,1);
  const editor=preview?.editor||{time,frameIndex,values:{...values},speed,loop};
  stop();liveCapture=false;preview={id:clip.id,name:clip.name,program:replayProgram,compiled:replayCompiled,time:0,frameIndex:0,editor};
  speed=1;loop=false;$('speed').value='1';$('loop').checked=false;setPose(sampleProgram(replayCompiled,0),false);playing=autoplay;renderFrames();updateTransport();return true;
 }catch(error){stop();toast(errorText(error));return false;}
}

function editAngle(n){exitPreview();stop();if(!Number.isFinite(n))return;const j=defs().find(j=>j.id===selected);setPose({...values,[selected]:Math.min(j.max,Math.max(j.min,n))});}
function errorText(e){if(e.code==='LOOP')return t('loopMismatch');if(e.code==='SPEED')return `${t('speedError')}: ${e.detail.joint} (${e.detail.value.toFixed(1)} > ${e.detail.max} °/s)`;const d=e.detail||{};let detail=Object.entries(d).map(([k,v])=>`${k}=${typeof v==='number'?Math.round(v*100)/100:String(v)}`).join(', ');return `${t('invalid')} · ${e.code||'JSON'}${detail?' · '+detail:''}`;}
function checkSpeed(c,multiplier=1,conf=limits){for(const [id,peak]of Object.entries(estimatePeakSpeed(c))){const max=conf[id]?.speed||180;if(peak*multiplier>max+1e-7){const e=Error('speed');e.code='SPEED';e.detail={joint:id,value:peak*multiplier,max};throw e;}}}
function checkLoop(c){const first=c.points[0].positions,last=c.points.at(-1).positions;if(Object.keys(first).some(id=>Math.abs(first[id]-last[id])>1e-6)){const e=Error('loop');e.code='LOOP';throw e;}}
function validateCurrent(raw,multiplier=1){const c=validateProgram(raw,defs());checkSpeed(c,multiplier);return c;}
function setStatus(message,error=false){$('script-status').textContent=message;$('script-status').classList.toggle('error',error);}
function readyStatus(){try{const current=validateCurrent(program),peaks=Object.values(estimatePeakSpeed(current));setStatus(`${t('ready')} · ${current.points.length} · ${current.duration.toFixed(1)} s · ${t('peak')} ${Math.max(...peaks).toFixed(1)} °/s`);}catch(e){setStatus(errorText(e),true);}}
function syncScript(){draft=JSON.stringify(program,null,2);$('script').value=draft;dirty=false;$('interpolation').value=program.interpolation||'smooth';readyStatus();}
function renderFrames(){
 const current=activeCompiled(),index=preview?preview.frameIndex:frameIndex,frames=$('keyframes');frames.replaceChildren();
 current.points.forEach((point,i)=>{const b=document.createElement('button');b.className='keyframe'+(i===index?' active':'');b.textContent=point.time.toFixed(1)+'s';b.disabled=liveCapture;b.setAttribute('aria-label',`${t('frame')} ${i+1}: ${point.time}s`);b.onclick=()=>{stop();if(preview)preview.frameIndex=i;else frameIndex=i;seek(point.time);renderFrames();};frames.append(b);});
 // The inspector always edits the editor, even while saved motion is previewed.
 $('frame-number').textContent=String(frameIndex+1).padStart(2,'0');$('frame-time').value=compiled.points[frameIndex].time;$('scrub').max=current.duration;updateClock();updateTransport();
}
function updateClock(){$('clock').textContent=`${activeTime().toFixed(2)} / ${activeCompiled().duration.toFixed(2)} s`;$('scrub').value=activeTime();}
function seek(n){
 if(liveCapture)return false;
 try{const current=validateProgram(preview?.program||program,defs()),nextTime=Math.max(0,Math.min(current.duration,n)),pose=sampleProgram(current,nextTime);if(preview){preview.compiled=current;preview.time=nextTime;}else{compiled=current;time=nextTime;}setPose(pose,false);updateClock();capturePanel?.syncPlayback?.();if(!preview)save();return true;}catch(e){if(!preview)setStatus(errorText(e),true);toast(errorText(e));updateClock();return false;}
}
function commitProgram(raw,index=0,poseAtFrame=true){const c=validateCurrent(raw);exitPreview();stop();program=raw;compiled=c;frameIndex=Math.max(0,Math.min(c.points.length-1,index));syncScript();renderFrames();if(poseAtFrame)seek(c.points[frameIndex].time);save();}
function ensureApplied(){if(dirty){toast(t('dirtyFirst'));return false;}return true;}
function timelineEdit(fn){exitPreview();if(!ensureApplied())return;const raw={version:1,units:'deg',interpolation:compiled.interpolation,points:compiled.points.map(p=>({time:p.time,positions:{...p.positions}}))};try{const index=fn(raw);commitProgram(raw,index??frameIndex);}catch(e){setStatus(errorText(e),true);toast(errorText(e));}}
function renderPoses(){const list=$('poses');list.replaceChildren();$('pose-count').textContent=poses.length;if(!poses.length){const p=document.createElement('p');p.className='empty';p.textContent=t('emptyPoses');list.append(p);}poses.forEach((p,i)=>{const row=document.createElement('div');row.className='pose-row';const b=document.createElement('button');b.textContent=p.name;b.onclick=()=>{try{validatePose(p.values,defs());exitPreview();stop();setPose(p.values);}catch{toast(t('poseError'));}};const del=document.createElement('button');del.textContent='×';del.title=t('delete');del.setAttribute('aria-label',t('delete')+' '+p.name);del.onclick=async()=>{if(await confirmAction('deleteConfirm')){poses.splice(i,1);renderPoses();save();}};row.append(b,del);list.append(row);});}
function applyLanguage(){document.documentElement.lang=lang;document.title=t('title');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.placeholder);el.setAttribute('aria-label',el.placeholder);});document.querySelectorAll('[data-title]').forEach(el=>{el.title=t(el.dataset.title);el.setAttribute('aria-label',el.title);});document.querySelectorAll('[data-palette]').forEach(el=>{el.title=t('palette_'+el.dataset.palette);el.setAttribute('aria-label',el.title);});$('help-body').innerHTML=t('helpHTML')+t('collisionHelp')+t('sceneHelp')+t('capHelp');capturePanel?.refreshLanguage();$('lang-switcher').value=lang;picker.setAttribute('aria-label',t('jointPicker'));$('joint-count').textContent=joints.length;$('dof').textContent=joints.length+' DOF';$('play').textContent=t(playing?'pause':'play');renderTree();updateInspector();renderPoses();renderFrames();if(dirty)setStatus(t('draft'));else readyStatus();$('save-status').textContent=t(storageOK?'saved':'storageError');if(typeof collisionState!=='undefined')showCollision(collisionState);updateTransport();}
function confirmAction(key){return new Promise(resolve=>{$('confirm-text').textContent=t(key);const dialog=$('confirm');dialog.returnValue='cancel';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'),{once:true});dialog.showModal();});}
function download(data,filename){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

$('joint-search').oninput=renderTree;$('angle-slider').oninput=e=>editAngle(Number(e.target.value));$('angle').onchange=e=>{if(e.target.value!=='')editAngle(Number(e.target.value));else updateInspector();};
$('joint-zero').onclick=()=>editAngle(0);$('neutral').onclick=$('reset-pose').onclick=resetRobotPose;
$('apply-limits').onclick=()=>{const j=byId[selected],min=Number($('joint-min').value),max=Number($('joint-max').value),v=Number($('joint-speed').value);if(![$('joint-min'),$('joint-max'),$('joint-speed')].every(el=>el.value!=='')||![min,max,v].every(Number.isFinite)||min<j.min||max>j.max||min>0||max<0||min>=max||v<1||v>1440){toast(t('limitError'));return;}exitPreview();stop();limits[selected]={min,max,speed:v};configureGuards();editAngle(values[selected]);try{compiled=validateCurrent(program);if(dirty)setStatus(t('draft'));else readyStatus();toast(t('limitApplied'));}catch(e){setStatus(errorText(e),true);toast(errorText(e));}save();};
$('save-pose').onclick=()=>{const name=$('pose-name').value.trim();if(!name)return toast(t('poseNeeded'));if(poses.length>=100)return toast(t('poseLimit'));poses.push({name,values:{...values}});$('pose-name').value='';renderPoses();save();toast(t('poseSaved'));};
$('capture').onclick=()=>timelineEdit(raw=>{raw.points.push({time:raw.points.at(-1).time+2,positions:{...values}});return raw.points.length-1;});
$('retime').onclick=()=>{if($('frame-time').value==='')return;if(frameIndex===0&&Number($('frame-time').value)!==0)return toast(t('firstTime'));timelineEdit(raw=>{raw.points[frameIndex].time=Number($('frame-time').value);});};
$('replace-frame').onclick=()=>timelineEdit(raw=>{raw.points[frameIndex].positions={...values};});
$('delete-frame').onclick=()=>{if(compiled.points.length<=2)return toast(t('twoFrames'));timelineEdit(raw=>{raw.points.splice(frameIndex,1);if(frameIndex===0){const start=raw.points[0].time;raw.points.forEach(p=>p.time-=start);}return Math.min(frameIndex,raw.points.length-1);});};
$('script').value=draft;$('script').oninput=()=>{exitPreview();draft=$('script').value;dirty=draft!==JSON.stringify(program,null,2);stop();setStatus(t(dirty?'draft':'ready'));save();};
$('apply-script').onclick=()=>{try{commitProgram(JSON.parse($('script').value));}catch(e){stop();setStatus(errorText(e),true);}};
$('copy-script').onclick=()=>download($('script').value,'robot-trajectory.json');
$('interpolation').onchange=()=>{if(!ensureApplied()){$('interpolation').value=program.interpolation;return;}try{commitProgram({...program,interpolation:$('interpolation').value},frameIndex,false);}catch(e){$('interpolation').value=program.interpolation;setStatus(errorText(e),true);}};
$('load-demo').onclick=async()=>{if(await confirmAction('replaceConfirm')){try{commitProgram(makeDemo(joints,$('demo').value));}catch(e){setStatus(errorText(e),true);}}};
function play(){
 if(liveCapture)return;if(playing){stop();if(!preview)save();return;}if(!preview&&!ensureApplied())return;
 try{const current=validateCurrent(preview?.program||program,speed);if(loop)checkLoop(current);if(preview){preview.compiled=current;if(preview.time>=current.duration)preview.time=0;}else{compiled=current;if(time>=current.duration)time=0;}playing=true;updateTransport();}catch(e){stop();if(!preview)setStatus(errorText(e),true);toast(errorText(e));}
}
$('play').onclick=play;$('stop').onclick=()=>{stop();seek(0);};$('scrub').oninput=e=>{stop();seek(Number(e.target.value));};$('loop').onchange=e=>{if(!e.target.checked){loop=false;return;}try{checkLoop(activeCompiled());loop=true;}catch(error){loop=false;e.target.checked=false;toast(errorText(error));}};
$('speed').onchange=e=>{speed=Number(e.target.value);if(playing){try{validateCurrent(preview?.program||program,speed);}catch(error){stop();toast(errorText(error));}}};
if($('exit-preview'))$('exit-preview').onclick=exitPreview;
$('lang-switcher').onchange=e=>{lang=e.target.value;applyLanguage();save();};$('theme-switcher').onclick=()=>{theme=theme==='dark'?'light':'dark';applyTheme();save();};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('show-axes').onchange=e=>rig.setHelpers(e.target.checked);
$('scene-light').oninput=e=>{const n=Number(e.target.value);if(!Number.isFinite(n))return;sceneSettings.lighting=Math.max(.4,Math.min(2,n/100));applyScene();save();};
$('scene-background').onchange=e=>{if(!['theme','custom'].includes(e.target.value))return;sceneSettings.background=e.target.value;applyScene();save();};
$('scene-color').oninput=e=>{if(!/^#[0-9a-f]{6}$/i.test(e.target.value))return;sceneSettings.color=e.target.value;sceneSettings.background='custom';applyScene();save();};
$('scene-reset').onclick=()=>{sceneSettings={...DEFAULT_SCENE};applyScene();save();};
$('scene-menu').addEventListener('keydown',e=>{if(e.key==='Escape'){$('scene-menu').open=false;$('scene-menu').querySelector('summary').focus();e.preventDefault();e.stopPropagation();}});

for(const part of ['shell','accent','dark']){$('color-'+part).value=colors[part];$('color-'+part).oninput=e=>{colors[part]=e.target.value;rig.setColors(colors);save();};}
const palettes={pearl:{shell:'#e4e9e8',accent:'#00c4a4',dark:'#252e35'},stealth:{shell:'#3b454b',accent:'#75baff',dark:'#171b20'},copper:{shell:'#bc7951',accent:'#ffdf93',dark:'#302b2b'},blue:{shell:'#5085b4',accent:'#a0f0ff',dark:'#1e2b3e'}};
document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{colors={...palettes[b.dataset.palette]};rig.setColors(colors);for(const part of ['shell','accent','dark'])$('color-'+part).value=colors[part];save();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const view=b.dataset.view;orbit.target.set(0,.92,0);const distance=camera.aspect<.8?5.8:3.7;if(view==='front')camera.position.set(0,1.05,distance);else if(view==='side')camera.position.set(distance,1.05,0);else camera.position.set(distance*.6,2.05,distance*.85);orbit.update();});
$('help-btn').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button,summary,a,[contenteditable]')||document.querySelector('dialog[open]'))return;if(e.key==='?')$('help').showModal();if(e.code==='Space'){e.preventDefault();if(preview||tab!=='capture')play();else capturePanel?.togglePlayback();}});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown;
renderer.domElement.addEventListener('pointerdown',e=>pointerDown={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);for(const hit of raycaster.intersectObject(rig.root,true)){let obj=hit.object;while(obj&&!obj.userData.jointId)obj=obj.parent;if(obj?.userData.jointId){selectJoint(obj.userData.jointId);showTab('joint');break;}}});
$('export-project').onclick=()=>{document.querySelector('.file-menu').open=false;download(project(),'robot-lab-project.json');};
$('export-ros').onclick=()=>{document.querySelector('.file-menu').open=false;if(!ensureApplied())return;try{const c=validateCurrent(program);download(toROSTrajectory(c,defs()),'robot-ros-trajectory.json');}catch(e){toast(errorText(e));}};
$('import-project').onclick=()=>{document.querySelector('.file-menu').open=false;$('file-input').click();};
$('file-input').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;let p;try{if(file.size>6000000)throw Error('size');p=validateProject(JSON.parse(await file.text()));}catch{return toast(t('importError'));}if(!await confirmAction('importConfirm'))return;exitPreview();stop();restore(p);configureGuards();displayGuard.reset();captureGuard.reset();capturePanel?.restore(captureData);frameIndex=0;time=0;rig.setColors(colors);$('script').value=draft;for(const part of ['shell','accent','dark'])$('color-'+part).value=colors[part];applyLanguage();applyTheme();setPose(values);showTab(tab);const persisted=saveNow();capturePanel?.markPersistence?.(persisted);if(persisted)toast(t('imported'));};
document.addEventListener('click',e=>{if(!e.target.closest('.file-menu'))document.querySelector('.file-menu').open=false;if(!e.target.closest('#scene-menu'))$('scene-menu').open=false;});
window.addEventListener('pagehide',event=>{stop();if(event.persisted)capturePanel?.setActive(false);else capturePanel?.dispose();saveNow();});window.addEventListener('pageshow',event=>{if(event.persisted)capturePanel?.setActive(tab==='capture');});document.addEventListener('visibilitychange',()=>{if(document.hidden){capturePanel?.setActive(false);stop();saveNow();}else capturePanel?.setActive(tab==='capture');});
applyTheme();applyLanguage();setPose(values,false);selectJoint(selected);showTab(tab);$('interpolation').value=program.interpolation||'smooth';
capturePanel=createCapturePanel({data:captureData,t,getJoints:defs,getPose:()=>({...values}),onPose:(pose,{synchronize=false}={})=>{if(!liveCapture)return;stop();if(synchronize)displayGuard.reset();setPose(pose,false,true,!synchronize);if(captureCollision?.adjusted)showCollision(captureCollision);},onFilterPose:(pose,{synchronize=false}={})=>{if(synchronize)captureGuard.reset();captureCollision=captureGuard.solve(pose,{continuous:!synchronize});return captureCollision;},onResetTracking:pose=>{captureGuard.reset(pose);captureCollision=null;},onApply:async raw=>{if(dirty&&!await confirmAction('replaceConfirm'))return false;try{commitProgram(raw);showTab('motion');return true;}catch(error){toast(errorText(error));return false;}},onReplay:replayClip,onReplayStop:()=>{stop();if(preview)seek(0);},onExitReplay:exitPreview,getPlayback,onLive:setLiveCapture,onPersist:saveNow,onChange:save,toast,confirmAction,download});
capturePanel.setActive(tab==='capture');
let previous=performance.now(),uiTime=0;
function animate(now){
 requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.1);previous=now;
 if(playing){
  const current=activeCompiled();let next=activeTime()+dt*speed;let ended=false;if(next>=current.duration){if(loop)next%=current.duration;else{next=current.duration;ended=true;}}
  if(preview)preview.time=next;else time=next;const p=sampleProgram(current,next);setPose(p,false,false,true);
  if(now-uiTime>60||ended){updateInspector();updateTree();updateClock();capturePanel?.syncPlayback?.();uiTime=now;}
  if(ended){stop();if(!preview)save();}
 }
 orbit.update();renderer.render(scene,camera);
}
requestAnimationFrame(animate);
// Read-only diagnostics used by the repository's browser smoke checks.
window.robotLab={get neutralPose(){return neutralPose();},get collision(){return {adjusted:!!collisionState.adjusted,blocked:!!collisionState.blocked,collisions:collisionState.collisions,maxPenetration:collisionState.maxPenetration};},get scene(){return {...sceneSettings,resolvedBackground:'#'+scene.background.getHexString(),exposure:renderer.toneMappingExposure,lights:{hemisphere:hemisphere.intensity,key:key.intensity,rim:rim.intensity,fill:fill.intensity}};},get capture(){return capturePanel?.state;},get joints(){return joints.map(({node,...j})=>j);},get values(){return {...values};},get state(){return {playing,time:activeTime(),frameIndex:preview?.frameIndex??frameIndex,editorTime:time,editorFrameIndex:frameIndex,playback:getPlayback(),dirty,program:JSON.parse(JSON.stringify(program))};},inspect:()=>{rig.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(rig.root);return {joints:joints.length,min:box.min.toArray(),max:box.max.toArray(),finite:joints.every(j=>j.node.matrixWorld.elements.every(Number.isFinite))};}};
