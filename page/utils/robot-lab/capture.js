import {createCaptureSource} from './capture-source.js';
import {createRetargeter,buildCaptureProgram} from './retarget.js';
import {validateProgram} from './motion.js';

const $=id=>document.getElementById(id);
const DEFAULTS={mode:'body-hands',mirror:true,preview:true,swapSides:false,smoothing:.65,confidence:.55};
const MAX_CLIPS=6, MAX_BYTES=2000000, MAX_SECONDS=120, MAX_SAMPLES=1800;
const BODY_EDGES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
const HAND_EDGES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const clone=v=>JSON.parse(JSON.stringify(v));
export function validateCaptureState(data,joints){
 if(data==null)return {version:1,settings:{...DEFAULTS},clips:[]};
 if(data.version!==1||!data.settings||!Array.isArray(data.clips)||data.clips.length>MAX_CLIPS)throw Error('capture');
 const s=data.settings;if(!['body-hands','body','hands'].includes(s.mode)||!['mirror','preview','swapSides'].every(k=>typeof s[k]==='boolean')||!Number.isFinite(s.smoothing)||s.smoothing<0||s.smoothing>.95||!Number.isFinite(s.confidence)||s.confidence<.35||s.confidence>.9)throw Error('capture-settings');
 const clips=data.clips.map(c=>{if(!c||typeof c.id!=='string'||c.id.length>80||typeof c.name!=='string'||!c.name.trim()||c.name.length>60||!['camera','video'].includes(c.source))throw Error('capture-clip');const compiled=validateProgram(c.program,joints);if(compiled.points.length>240)throw Error('capture-points');const st=c.stats;if(!st||!['inputFrames','outputFrames','sourceDuration','duration','timeScale','held'].every(k=>Number.isFinite(st[k])&&st[k]>=0)||st.sourceDuration>121||st.duration>600||st.inputFrames>1800||st.outputFrames!==compiled.points.length||Math.abs(st.duration-compiled.duration)>.01)throw Error('capture-stats');return {id:c.id,name:c.name,source:c.source,program:clone(c.program),stats:{inputFrames:st.inputFrames,outputFrames:st.outputFrames,sourceDuration:st.sourceDuration,duration:st.duration,timeScale:st.timeScale,held:st.held}};});
 if(new Set(clips.map(c=>c.id)).size!==clips.length||JSON.stringify(clips).length>MAX_BYTES)throw Error('capture-size');
 return {version:1,settings:{...DEFAULTS,...Object.fromEntries(Object.keys(DEFAULTS).map(k=>[k,s[k]]))},clips};
}

export function createCapturePanel({data,t,getJoints,getPose,onPose,onFilterPose,onResetTracking,onApply,onReplay,onReplayStop,onExitReplay,getPlayback,onLive,onPersist,onChange,toast,confirmAction,download}){
 let settings={...DEFAULTS,...data.settings},clips=clone(data.clips),selectedId=clips.at(-1)?.id||null;
 let view=clips.length?'saved':'record',sessionOnly=new Set(),active=false,recording=null,lastResult=null,lastMeta=null,sourceState={source:'none',status:'idle',ready:false},statusKey='capIdle',statusError=false,destroyed=false,resetPaused=false;
 let retarget=createRetargeter(getJoints(),settings),lastQuality='',requestEpoch=0,alignPending=true;
 const video=$('cap-video'),overlay=$('cap-overlay'),ctx=overlay.getContext('2d');
 const source=createCaptureSource({video,onResults:results,onState:sourceChanged,onError:sourceError,onEnded:()=>finish()});
 function message(key,error=false){statusKey=key;statusError=error;$('cap-status').textContent=t(key);$('cap-status').classList.toggle('error',error);}
 function errorMessage(error){const code=error?.code||'';return ['CAPTURE_LONG','CAPTURE_SPEED','CAPTURE_LARGE'].includes(code)?'cap_DURATION':['CAPTURE_SHORT','CAPTURE_TIME'].includes(code)?'capShortTake':t('cap_'+code)!=='cap_'+code?'cap_'+code:'capErrorFallback';}
 function sourceError(error){finish();message(errorMessage(error),true);updateControls();}
 function sourceChanged(state){
  const oldSource=sourceState.source;sourceState=state;
  if(state.reason==='play'&&!resetPaused)resetTracking();
  if(['seek','hidden','camera-ended','source-change','error','dispose','ended'].includes(state.reason))finish();
  if(state.source==='none'){resetPaused=false;lastResult=null;lastMeta=null;clearOverlay();renderQuality();}
  if(state.status==='loading')message('capLoading');
  else if(state.reason==='hidden')message('capHidden');
  else if(state.reason==='ended')message('capEnded');
  else if(state.status==='paused')message(recording?'capRecordingPaused':'capPaused');
  else if(state.status==='playing'&&state.reason!=='frame'&&state.reason!=='time')message('capPlaying');
  else if(state.status==='ready'&&state.reason!=='frame')message('capReady');
  else if(state.source==='none'&&state.status!=='error')message('capIdle');
  if(resetPaused&&state.ready)message('capNeutralPaused');
  if(oldSource!==state.source)lastQuality='';
  $('cap-media-time').textContent=`${clock(state.currentTime||0)} / ${clock(state.duration||0)}`;
  $('cap-seek').max=Math.max(.01,state.duration||1);$('cap-seek').value=state.currentTime||0;
  updateControls();
 }
 function clock(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
 function clearOverlay(){ctx.clearRect(0,0,overlay.width,overlay.height);}
 function draw(results){
  const w=$('cap-video').clientWidth,h=$('cap-video').clientHeight;if(!w||!h)return;
  const scale=window.devicePixelRatio||1;if(overlay.width!==Math.round(w*scale)||overlay.height!==Math.round(h*scale)){overlay.width=Math.round(w*scale);overlay.height=Math.round(h*scale);}ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,w,h);
  if(!video.videoWidth)return;const ratio=Math.min(w/video.videoWidth,h/video.videoHeight),dw=video.videoWidth*ratio,dh=video.videoHeight*ratio,ox=(w-dw)/2,oy=(h-dh)/2;
  const good=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility==null||p.visibility>=settings.confidence)&&(p.presence==null||p.presence>=settings.confidence);
  const skeleton=(points,edges,color,hand=false)=>{ctx.lineWidth=1.5;ctx.strokeStyle=color;ctx.fillStyle=color;const visible=p=>hand?p&&Number.isFinite(p.x)&&Number.isFinite(p.y):good(p);for(const [a,b]of edges)if(visible(points[a])&&visible(points[b])){ctx.beginPath();ctx.moveTo(ox+points[a].x*dw,oy+points[a].y*dh);ctx.lineTo(ox+points[b].x*dw,oy+points[b].y*dh);ctx.stroke();}for(const p of points)if(visible(p)){ctx.beginPath();ctx.arc(ox+p.x*dw,oy+p.y*dh,2,0,Math.PI*2);ctx.fill();}};
  for(const p of results.pose?.landmarks||[])skeleton(p,BODY_EDGES,'#76f2c4');for(const p of results.hand?.landmarks||[])skeleton(p,HAND_EDGES,'#ffd083',true);
 }
 function renderQuality(){
  const r=lastResult||{},inferred=r.coverage?.inferredArms||[],signature=[r.body,r.leftHand,r.rightHand,r.tracked,r.limited,r.coverage?.framing,inferred.join(','),r.collisionAdjusted,r.collisionBlocked,t('capBody')].join('|');
  if(signature===lastQuality)return;lastQuality=signature;const box=$('cap-quality');box.replaceChildren();
  for(const [key,good]of [[r.coverage?.framing==='upper'?'capUpperBody':'capBody',r.body],['capLeft',r.leftHand],['capRight',r.rightHand]]){const span=document.createElement('span');span.textContent=t(key);span.className=good?'good':'';box.append(span);}
  if(inferred.length){const span=document.createElement('span');span.textContent=t(inferred.length>1?'capInferredArms':'capInferredArm');span.className='estimated';box.append(span);}
  if(r.collisionAdjusted){const span=document.createElement('span');span.textContent=t(r.collisionBlocked?'collisionBlocked':'collisionAdjusted');span.className='estimated';box.append(span);}
  const count=document.createElement('span');count.textContent=`${r.tracked||0} ${t('capTracked')}`;box.append(count);if(r.limited){const limited=document.createElement('span');limited.textContent=`${r.limited} ${t('capLimited')}`;box.append(limited);}
 }
 function results(raw,meta){
  if(destroyed||resetPaused)return;
  try{
   retarget.configure({joints:getJoints()});lastResult=retarget.update(raw,meta.timestamp/1000,{synchronize:alignPending});
   if(alignPending&&!(settings.mode==='hands'?lastResult.leftHand||lastResult.rightHand:lastResult.body)){draw(raw);renderQuality();message('capAligning');return;}
   const synchronizing=alignPending;
   const corrected=onFilterPose?.(lastResult.positions,{synchronize:synchronizing});if(corrected&&!corrected.positions){lastResult.collisionAdjusted=true;lastResult.collisionBlocked=true;renderQuality();message('capCollisionHeld');return;}if(corrected){lastResult.positions=corrected.positions;lastResult.collisionAdjusted=!!corrected.adjusted;lastResult.collisionBlocked=!!corrected.blocked;}
   alignPending=false;lastMeta=meta;draw(raw);renderQuality();
   if(active&&view==='record'&&settings.preview)onPose(lastResult.positions,{synchronize:synchronizing});
   if(!lastResult.tracked)message('capNoTracking');else message(video.paused&&meta.source==='video'?(recording?'capRecordingPaused':'capPaused'):(recording?'capRecordingActive':'capPlaying'));
   if(recording){
    const stamp=meta.sourceTime;
    if(recording.source!==meta.source||!Number.isFinite(stamp))return;
    if(recording.lastTime!==null&&stamp<recording.lastTime-.02){finish();return;}
    if(recording.lastTime!==null&&stamp<=recording.lastTime)return;
    if(!recording.samples.length&&!lastResult.tracked){message('capWaiting');return;}
    if(!recording.samples.length)recording.startTime=stamp;
    const elapsed=stamp-recording.startTime;
    if(elapsed>MAX_SECONDS||recording.samples.length>=MAX_SAMPLES){finish();toast(t('capLimitReached'));return;}
    recording.samples.push({time:elapsed,positions:{...lastResult.positions}});recording.lastTime=stamp;
    if(lastResult.tracked)recording.trackedFrames++;else recording.held++;
    $('cap-counter').textContent=`${elapsed.toFixed(1)} ${t('capSeconds')} · ${recording.samples.length}`;
   }
  }catch(error){finish();message(errorMessage(error),true);}
 }
 function updateControls(){
  const ready=sourceState.ready&&!sourceState.busy&&sourceState.source!=='none';
  $('cap-record').disabled=!recording&&(!ready||clips.length>=MAX_CLIPS);
  $('cap-record').classList.toggle('recording',!!recording);$('cap-record').textContent=t(recording?'capStopRecord':'capRecord');
  $('cap-record-light').hidden=!recording;$('cap-record-light').textContent='● '+t('capRecording');$('cap-use').disabled=!selectedId||!!recording;
  $('cap-calibrate').disabled=!ready||settings.mode==='hands';$('cap-source-stop').disabled=sourceState.source==='none'&&!sourceState.busy;
  $('cap-empty').hidden=sourceState.source!=='none';$('cap-media-controls').hidden=sourceState.source!=='video';
  $('cap-media-play').disabled=!ready;$('cap-media-play').textContent=video.paused?'▶':'Ⅱ';$('cap-seek').disabled=!ready;
  $('cap-name').disabled=!!recording;$('cap-resume').hidden=!resetPaused||!ready;
  $('cap-record-state').textContent=t(recording?'capRecording':ready?'capReadyToRecord':'capChooseSource');
  $('cap-view-record').classList.toggle('active',view==='record');$('cap-view-saved').classList.toggle('active',view==='saved');
  $('cap-view-record').setAttribute('aria-pressed',view==='record');$('cap-view-saved').setAttribute('aria-pressed',view==='saved');
  $('cap-record-view').hidden=view!=='record';$('cap-saved-view').hidden=view!=='saved';
  onLive(active&&view==='record'&&ready&&!resetPaused&&(settings.preview||!!recording));syncPlayback();
 }
 function applySettings(){
  $('cap-mode').value=settings.mode;$('cap-mirror').checked=settings.mirror;$('cap-preview').checked=settings.preview;$('cap-swap').checked=settings.swapSides;$('cap-smoothing').value=settings.smoothing;$('cap-confidence').value=settings.confidence;
  document.querySelector('.capture-preview').classList.toggle('mirrored',settings.mirror);retarget.configure({...settings,joints:getJoints()});
 }
 function resetTracking(){retarget=createRetargeter(getJoints(),settings);const joints=getJoints(),rest=joints.find(j=>j.collision)?.collision.neutral||{},initial=Object.fromEntries(joints.map(j=>[j.id,Math.max(j.min,Math.min(j.max,rest[j.id]??j.home??0))]));retarget.reset(initial);onResetTracking?.(initial);alignPending=true;lastResult=null;lastMeta=null;lastQuality='';clearOverlay();renderQuality();}
 function persist(){onChange();}
 function setView(next){
  if(next==='saved'&&recording){finish();return;}
  view=next;
  if(next==='saved'){if(source.state.source==='camera')source.stop();else if(source.state.source==='video')source.pause();}
  else onExitReplay();
  updateControls();
  if(next==='saved'&&!getPlayback()){const selected=clips.find(c=>c.id===selectedId);if(selected)onReplay(clone(selected),{autoplay:false});}
 }
 function syncPlayback(){
  const playback=getPlayback(),selected=clips.find(c=>c.id===selectedId),current=playback?.id===selectedId;
  $('cap-use').textContent=t(current&&playback.playing?'capPauseReplay':'capReplay');
  $('cap-use').disabled=!selected||!!recording;$('cap-edit').disabled=!selected||!!recording;
  $('cap-replay-stop').disabled=!playback;
  document.querySelectorAll('.capture-take').forEach(row=>{const isPlaying=playback?.id===row.dataset.clip&&playback.playing;row.classList.toggle('playing',isPlaying);row.querySelector('.take-symbol').textContent=isPlaying?'Ⅱ':'▶';});
 }
 async function replay(clip){
  selectedId=clip.id;view='saved';if(source.state.source==='camera')source.stop();else source.pause();updateControls();renderClips();renderSummary();
  await onReplay(clone(clip));syncPlayback();
 }
 async function edit(clip){selectedId=clip.id;setView('saved');await onApply(clone(clip.program));syncPlayback();}
 function saveDurably(){const saved=onPersist();if(saved){sessionOnly.clear();renderClips();}renderSummary();return saved;}
 async function rename(clip){
  const dialog=$('cap-rename-dialog'),input=$('cap-rename-name');input.value=clip.name;dialog.returnValue='cancel';
  const result=new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));dialog.showModal();input.focus();input.select();
  if(await result!=='save'||!input.value.trim())return;clip.name=input.value.trim();sessionOnly.add(clip.id);renderClips();saveDurably();
 }
 function renderClips(){
  $('cap-take-count').textContent=`${clips.length} / ${MAX_CLIPS}`;$('cap-saved-count').textContent=clips.length;const box=$('cap-takes');box.replaceChildren();
  if(!clips.length){const p=document.createElement('p');p.className='empty';p.textContent=t('capNoTakes');box.append(p);}
  for(const clip of [...clips].reverse()){
   const row=document.createElement('div');row.className='capture-take'+(clip.id===selectedId?' selected':'');row.dataset.clip=clip.id;
   const use=document.createElement('button'),title=document.createElement('strong'),detail=document.createElement('small'),name=document.createElement('span'),symbol=document.createElement('span');name.className='take-name';symbol.className='take-symbol';symbol.textContent='▶';title.textContent=clip.name;name.append(symbol,title);detail.textContent=`${clip.stats.duration.toFixed(1)} ${t('capSeconds')} · ${t(sessionOnly.has(clip.id)?'capSessionOnly':'capSavedLocal')}`;use.append(name,detail);use.setAttribute('aria-label',`${t('capReplay')}: ${clip.name}`);use.onclick=()=>replay(clip);
   const menu=document.createElement('details'),summary=document.createElement('summary'),items=document.createElement('div');summary.textContent='⋯';summary.setAttribute('aria-label',`${t('capActions')}: ${clip.name}`);items.className='take-menu';
   for(const [label,action]of [['capEdit',()=>edit(clip)],['capRename',()=>rename(clip)],['capExport',()=>download(clip.program,'robot-capture.json')],['capRemove',async()=>{if(await confirmAction('capDeleteConfirm')){if(getPlayback()?.id===clip.id)onExitReplay();clips=clips.filter(c=>c.id!==clip.id);sessionOnly.delete(clip.id);if(selectedId===clip.id)selectedId=clips.at(-1)?.id||null;renderClips();saveDurably();updateControls();}}]]){const button=document.createElement('button');button.textContent=t(label);button.onclick=()=>{menu.open=false;action();};items.append(button);}menu.append(summary,items);row.append(use,menu);box.append(row);
  }syncPlayback();
 }
 function renderSummary(){
  const clip=clips.find(c=>c.id===selectedId);$('cap-selected').hidden=!clip;
  $('cap-selected-name').textContent=clip?.name||'';const session=clip&&sessionOnly.has(clip.id);
  $('cap-storage-state').textContent=t(session?'capSessionOnly':'capSavedLocal');$('cap-storage-state').parentElement.classList.toggle('session-only',!!session);$('cap-retry-save').hidden=!session;
  $('cap-summary').textContent=clip?(clip.stats.timeScale>1.001?`${t('capSourceDuration')} ${clip.stats.sourceDuration.toFixed(1)} s → ${t('capRobotDuration')} ${clip.stats.duration.toFixed(1)} s · ${t('capRetimed')}`:`${clip.stats.duration.toFixed(1)} s · ${clip.stats.outputFrames} ${t('capFrames')}`):'';
 }
 function finish({keepSource=false}={}){
  if(!recording)return null;const take=recording;recording=null;source.pause();updateControls();
  if(take.trackedFrames<2||take.samples.length<2){message('capEmptyTake',true);toast(t('capEmptyTake'));return null;}
  try{
   if(take.samples.at(-1).time<.2)throw Object.assign(Error(),{code:'CAPTURE_SHORT'});
   const built=buildCaptureProgram(take.samples,getJoints(),{maxPoints:240,maxDuration:600});
   const stats={inputFrames:built.stats.inputFrames,outputFrames:built.stats.outputFrames,sourceDuration:built.stats.sourceDuration,duration:built.stats.duration,timeScale:built.stats.timeScale,held:take.held};
   const clip={id:globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2),name:take.name,source:take.source,program:built.program,stats};
   if(clips.length>=MAX_CLIPS){message('capFull',true);return null;}
   if(JSON.stringify([...clips,clip]).length>MAX_BYTES){message('capTooLarge',true);return null;}
   clips.push(clip);selectedId=clip.id;sessionOnly.add(clip.id);view='saved';
   if(source.state.source==='camera'&&!keepSource)source.stop();else source.pause();
   const saved=saveDurably();renderClips();renderSummary();updateControls();message(saved?'capRecorded':'capSessionOnly',!saved);toast(t(saved?'capRecorded':'capSessionOnly'));onReplay(clone(clip),{autoplay:false});return clip;
  }catch(error){message(errorMessage(error),true);toast(t(errorMessage(error)));return null;}
 }
 async function startRecord(){
  if(recording){finish();return;}
  if(clips.length>=MAX_CLIPS){toast(t('capFull'));return;}
  if(!sourceState.ready){toast(t('cap_SOURCE'));return;}
  if(resetPaused&&!await resumeTracking())return;
  const epoch=requestEpoch;
  if(sourceState.source==='video'&&video.currentTime>=video.duration-.05){source.seek(0);await new Promise(resolve=>{const timer=setTimeout(resolve,1500);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});});}
  if(epoch!==requestEpoch||!active||!sourceState.ready)return;
  recording={source:sourceState.source,name:$('cap-name').value.trim()||`${t('capDefaultName')} ${String(clips.length+1).padStart(2,'0')}`,samples:[],trackedFrames:0,held:0,startTime:null,lastTime:null,wallStart:performance.now(),sourceStart:video.currentTime};
  $('cap-counter').textContent='0.0 s · 0';updateControls();message('capWaiting');
  if(video.paused){if(!await source.play()){finish();return;}}
 }
 async function switchSource(kind,file){
  const epoch=++requestEpoch;resetPaused=false;finish();setView('record');resetTracking();
  await source.setMode(settings.mode);if(epoch!==requestEpoch||!active)return;
  if(kind==='camera')await source.startCamera();else await source.loadVideo(file);
 }
 $('cap-camera').onclick=()=>switchSource('camera');$('cap-upload').onclick=()=>$('cap-file').click();
 $('cap-file').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)switchSource('video',file);};
 $('cap-source-stop').onclick=()=>{requestEpoch++;finish();source.stop();resetTracking();};
 $('cap-media-play').onclick=()=>{if(resetPaused)resumeTracking();else if(video.paused)source.play();else source.pause();};$('cap-seek').oninput=e=>{finish();source.seek(Number(e.target.value));resetTracking();};
 $('cap-record').onclick=startRecord;$('cap-resume').onclick=resumeTracking;
 $('cap-use').onclick=()=>{const clip=clips.find(c=>c.id===selectedId);if(clip)replay(clip);};
 $('cap-edit').onclick=()=>{const clip=clips.find(c=>c.id===selectedId);if(clip)edit(clip);};
 $('cap-replay-stop').onclick=()=>{onReplayStop();syncPlayback();};
 $('cap-retry-save').onclick=()=>{if(saveDurably()){renderClips();toast(t('capRecorded'));}};
 $('cap-view-record').onclick=$('cap-another').onclick=()=>setView('record');$('cap-view-saved').onclick=()=>setView('saved');
 $('cap-calibrate').onclick=()=>{finish();if(retarget.calibrate()){message('capCalibrated');toast(t('capCalibrated'));}else toast(t('capCalibrationNeed'));};
 $('cap-reset-calibration').onclick=()=>{finish();resetTracking();message('capCalibrationReset');};
 $('cap-mode').onchange=async e=>{finish();settings.mode=e.target.value;resetTracking();await source.setMode(settings.mode);persist();};
 $('cap-mirror').onchange=e=>{settings.mirror=e.target.checked;applySettings();persist();};
 $('cap-preview').onchange=e=>{settings.preview=e.target.checked;updateControls();persist();};
 $('cap-swap').onchange=e=>{finish();settings.swapSides=e.target.checked;resetTracking();applySettings();persist();};
 for(const [id,key]of [['cap-smoothing','smoothing'],['cap-confidence','confidence']])$(id).oninput=e=>{finish();settings[key]=Number(e.target.value);retarget.configure(settings);persist();};
 const timer=setInterval(()=>{if(!recording)return;const elapsed=recording.source==='video'?video.currentTime-recording.sourceStart:(performance.now()-recording.wallStart)/1000;if(elapsed>MAX_SECONDS){finish();toast(t('capLimitReached'));}},500);
 function setActive(next){active=next;if(!next){requestEpoch++;finish();if(source.state.source==='camera')source.stop();else if(source.state.source==='video')source.pause();}updateControls();if(next&&view==='saved'&&!getPlayback()){const clip=clips.find(c=>c.id===selectedId);if(clip)onReplay(clone(clip),{autoplay:false});}}
 function restore(next){requestEpoch++;resetPaused=false;recording=null;sessionOnly.clear();source.stop();settings={...DEFAULTS,...next.settings};clips=clone(next.clips);selectedId=clips.at(-1)?.id||null;view=clips.length?'saved':'record';resetTracking();applySettings();source.setMode(settings.mode);renderClips();renderSummary();updateControls();}
 function refreshLanguage(){message(statusKey,statusError);lastQuality='';renderQuality();renderClips();renderSummary();updateControls();}
 function pauseForReset(){
  requestEpoch++;const hadSource=sourceState.source!=='none';finish({keepSource:true});
  if(sourceState.busy||!sourceState.ready)source.stop('neutral-reset');else source.pause('neutral-reset');resetPaused=hadSource&&sourceState.ready;
  if(hadSource)view='record';updateControls();if(resetPaused)message('capNeutralPaused');
 }
 async function resumeTracking(){
  if(!sourceState.ready)return false;const epoch=requestEpoch;resetTracking();resetPaused=false;updateControls();
  const resumed=await source.play();if(epoch!==requestEpoch)return false;
  if(!resumed){resetPaused=true;updateControls();message('capNeutralPaused');return false;}
  message('capPlaying');updateControls();return true;
 }
 function dispose(){if(destroyed)return;finish();source.dispose();clearInterval(timer);destroyed=true;}
 applySettings();source.setMode(settings.mode);renderClips();renderSummary();renderQuality();updateControls();
 return {setActive,restore,refreshLanguage,dispose,syncPlayback,pauseForReset,resetTracking,markPersistence:saved=>{if(saved)sessionOnly.clear();else clips.forEach(clip=>sessionOnly.add(clip.id));renderClips();renderSummary();},togglePlayback:()=>{if(resetPaused){resumeTracking();return;}if(view==='record'&&sourceState.source==='video'){if(video.paused)source.play();else source.pause();}},getData:()=>({version:1,settings:{...settings},clips:clone(clips)}),get state(){return {view,resetPaused,alignPending,source:{...sourceState},recording:!!recording,frames:recording?.samples.length||0,clips:clips.length,lastResult:lastResult?{tracked:lastResult.tracked,body:lastResult.body,leftHand:lastResult.leftHand,rightHand:lastResult.rightHand,limited:lastResult.limited,collisionAdjusted:!!lastResult.collisionAdjusted,collisionBlocked:!!lastResult.collisionBlocked,framing:lastResult.coverage?.framing||'none',inferredArms:[...(lastResult.coverage?.inferredArms||[])],contacts:{hands:!!lastResult.coverage?.contacts?.hands,head:[...(lastResult.coverage?.contacts?.head||[])]}}:null};}};
}
