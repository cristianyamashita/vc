import assert from 'node:assert/strict';
import {createRetargeter,buildCaptureProgram} from '../../page/utils/robot-lab/retarget.js';
import {validateProgram,estimatePeakSpeed} from '../../page/utils/robot-lab/motion.js';
const joints=[];
const add=(id,axis,min,max)=>joints.push({id,axis,min,max,home:0,speed:1440});
for(const id of ['torso','neck']){add(id+'_yaw','y',-85,85);add(id+'_pitch','x',-40,40);add(id+'_roll','z',-35,35);}
for(const side of ['left','right']){
 add(side+'_shoulder_pitch','x',-170,90);add(side+'_shoulder_roll','z',side==='left'?-30:-165,side==='left'?165:30);add(side+'_shoulder_yaw','y',-110,110);add(side+'_elbow_pitch','x',-145,0);add(side+'_forearm_yaw','y',-100,100);add(side+'_wrist_pitch','x',-75,75);add(side+'_wrist_roll','z',-35,35);
 for(const digit of ['index','middle','ring','little','thumb'])for(let i=1;i<=3;i++)add(`${side}_${digit}_${i}`,'x',-95,10);
 add(side+'_thumb_opposition','y',-60,60);add(side+'_hip_yaw','y',-65,65);add(side+'_hip_roll','z',-40,40);add(side+'_hip_pitch','x',-110,45);add(side+'_knee_pitch','x',0,140);add(side+'_ankle_pitch','x',-45,45);add(side+'_ankle_roll','z',-30,30);
}
const pt=(x,y,z=0)=>({x,y:-y,z:-z,visibility:1,presence:1});
function pose(){const p=Array.from({length:33},()=>pt(0,0));p[23]=pt(.15,0);p[24]=pt(-.15,0);p[11]=pt(.25,.5);p[12]=pt(-.25,.5);p[13]=pt(.25,.2);p[14]=pt(-.25,.2);p[15]=pt(.25,-.1);p[16]=pt(-.25,-.1);p[25]=pt(.15,-.4);p[26]=pt(-.15,-.4);p[27]=pt(.15,-.8);p[28]=pt(-.15,-.8);p[29]=pt(.15,-.85,0);p[30]=pt(-.15,-.85,0);p[31]=pt(.15,-.85,.2);p[32]=pt(-.15,-.85,.2);p[7]=pt(.07,.7,0);p[8]=pt(-.07,.7,0);p[0]=pt(0,.7,.12);return {worldLandmarks:[p],landmarks:[p.map(q=>({...q,x:q.x*.5+.5,y:q.y*.5+.45}))]};}
// Rotate the chest about its pelvis, matching the rig's Ry Rx Rz hierarchy.
function turnChest(input,{yaw=0,pitch=0,roll=0}={}){const result=structuredClone(input),angles=[roll,pitch,yaw].map(v=>v*Math.PI/180);for(let i=0;i<23;i++){const p=result.worldLandmarks[0][i];let [x,y,z]=[p.x,-p.y,-p.z];let [c,s]=[Math.cos(angles[0]),Math.sin(angles[0])];[x,y]=[x*c-y*s,x*s+y*c];[c,s]=[Math.cos(angles[1]),Math.sin(angles[1])];[y,z]=[y*c-z*s,y*s+z*c];[c,s]=[Math.cos(angles[2]),Math.sin(angles[2])];[x,z]=[x*c+z*s,-x*s+z*c];result.worldLandmarks[0][i]=pt(x,y,z);}return result;}
function cropHips(input,kind='outside'){const result=structuredClone(input);for(const i of [23,24]){if(kind==='missing'){delete result.worldLandmarks[0][i];delete result.landmarks[0][i];}else if(kind==='weak')result.worldLandmarks[0][i].visibility=.1;else if(kind==='image-weak')result.landmarks[0][i].presence=.1;else result.landmarks[0][i].y=1.15;}return result;}
function hand(side='Left',curl=0){const p=Array.from({length:21},()=>pt(0,0));p[0]=pt(0,0);for(const [base,x]of [[5,.03],[9,.01],[13,-.01],[17,-.03]]){p[base]=pt(x,-.06);p[base+1]=pt(x,-.09);p[base+2]=pt(x,-.09-.025*Math.cos(curl),.025*Math.sin(curl));p[base+3]=pt(x,-.09-.04*Math.cos(curl),.04*Math.sin(curl));}p[1]=pt(.05,-.02);p[2]=pt(.07,-.04);p[3]=pt(.08,-.06);p[4]=pt(.09,-.08);return {worldLandmarks:[p],landmarks:[p.map(q=>({...q,x:q.x+.5,y:q.y+.5}))],handednesses:[[{categoryName:side,score:.99}]]};}
function rotate(v,axis,degrees){const c=Math.cos(degrees*Math.PI/180),s=Math.sin(degrees*Math.PI/180),[x,y,z]=v;return axis==='x'?[x,y*c-z*s,y*s+z*c]:axis==='y'?[x*c+z*s,y,-x*s+z*c]:[x*c-y*s,x*s+y*c,z];}
const rotations=(v,axes)=>axes.reduce((v,[axis,degrees])=>rotate(v,axis,degrees),v);
const orientationAxes=a=>[['z',a.roll||0],['x',a.pitch||0],['y',a.yaw||0]];
function handScene(side='left',a={}){
 let body=pose();const sign=side==='left'?1:-1,ids=side==='left'?[11,13,15]:[12,14,16],arm=[['y',a.shoulderYaw||0],['z',a.shoulderRoll||0],['x',a.shoulderPitch||0]],elbow=[['x',a.elbow||0]],chest=[['z',a.chestRoll||0],['y',a.chestYaw||0]],palm=orientationAxes(a),source=hand(side==='left'?'Left':'Right',a.curl||0);
 const shoulder=[sign*.25,.5,0],upper=rotations([0,-.3,0],arm),e=shoulder.map((v,i)=>v+upper[i]),lower=rotations([0,-.3,0],[...elbow,...arm]),w=e.map((v,i)=>v+lower[i]);body.worldLandmarks[0][ids[1]]=pt(...e);body.worldLandmarks[0][ids[2]]=pt(...w);
 body=turnChest(body,{yaw:a.chestYaw||0,roll:a.chestRoll||0});body.landmarks=[body.worldLandmarks[0].map(p=>({...p,x:p.x*.5+.5,y:p.y*.5+.45}))];
 source.worldLandmarks[0]=source.worldLandmarks[0].map(p=>pt(...rotations([-sign*p.x,-p.y,-p.z],[...palm,...elbow,...arm,...chest])));source.landmarks[0][0]={...body.landmarks[0][ids[2]]};
 return {pose:a.cropped?cropHips(body):body,hand:source};
}
function nearHeadPose(side='left',target=[0,.03,.14]){
 const p=pose(),points=p.worldLandmarks[0],sign=side==='left'?1:-1,s=side==='left'?11:12,e=s+2,w=s+4,head=[0,.75,0],scale=.198/.16;
 points[11]=pt(.18,.45);points[12]=pt(-.18,.45);points[7]=pt(.08,.75);points[8]=pt(-.08,.75);points[0]=pt(0,.75,.12);
 const shoulder=[sign*.18,.45,0],wrist=target.map((v,i)=>v/(i===2?.11/.12:scale)+head[i]),delta=wrist.map((v,i)=>v-shoulder[i]),distance=Math.hypot(...delta),direction=delta.map(v=>v/distance),pole=[sign,0,0].map((v,i)=>v-direction[i]*sign*direction[0]),poleLength=Math.hypot(...pole),along=(.34**2+distance**2-.26**2)/(2*distance),height=Math.sqrt(.34**2-along**2),elbow=shoulder.map((v,i)=>v+direction[i]*along+pole[i]/poleLength*height);
 points[s]=pt(...shoulder);points[e]=pt(...elbow);points[w]=pt(...wrist);p.landmarks=[points.map(q=>({...q,x:q.x*.5+.5,y:q.y*.5+.6}))];return p;
}
const robotGeometry=side=>({upperArm:.29,forearm:.27,shoulder:[side==='left'?.255:-.255,.35,0],head:[0,.57,0],neck:[0,.455,0],headWidth:.198,headDepth:.11,headTop:.11,palmOffset:[0,-.064,0],palmSurface:[0,-.065,-.0275],palmLength:.112});
const geometryJoints=joints.map(j=>({...j,...(j.id.endsWith('_forearm_yaw')?{min:-380,max:380}:j.id.endsWith('_shoulder_yaw')?{min:-200,max:200}:{}),...(j.id.endsWith('_shoulder_pitch')?{retarget:robotGeometry(j.id.startsWith('left')?'left':'right')}:{})}));
function rigWrist(values,side){const a=id=>values[side+'_'+id],arm=[['y',a('shoulder_yaw')],['z',a('shoulder_roll')],['x',a('shoulder_pitch')]],upper=rotations([0,-.29,0],arm),lower=rotations([0,-.27,0],[['x',a('elbow_pitch')],...arm]);return robotGeometry(side).shoulder.map((v,i)=>v+upper[i]+lower[i]);}
function rigPad(values,side){const a=id=>values[side+'_'+id],offset=rotations(robotGeometry(side).palmSurface,[['z',a('wrist_roll')],['x',a('wrist_pitch')],['y',a('forearm_yaw')],['x',a('elbow_pitch')],['y',a('shoulder_yaw')],['z',a('shoulder_roll')],['x',a('shoulder_pitch')]]);return rigWrist(values,side).map((v,i)=>v+offset[i]);}
function contactInput(kind='prayer',{gap=0,depthGap=0,missing=[]}={}){
 const body=pose(),p=body.worldLandmarks[0],hands={worldLandmarks:[],landmarks:[],handednesses:[]},project=point=>({x:.5+point[0]*.65,y:.6-point[1]*.6,z:-point[2]*.65,visibility:1,presence:1});
 for(const [side,s,e,w,h]of [['left',11,13,15,23],['right',12,14,16,24]]){
  const sign=side==='left'?1:-1,turn=kind==='crown'?[['x',-90]]:[['z',180],['y',sign*90]],handPoints=Array.from({length:21},()=>[0,0,0]);for(const [id,x,len]of [[5,-sign*.035,.09],[9,-sign*.012,.10],[13,sign*.012,.09],[17,sign*.035,.075]])for(let i=0;i<4;i++)handPoints[id+i]=rotations([x,-.12-i*len/3,0],turn);for(let i=1;i<5;i++)handPoints[i]=rotations([-sign*(.045+i*.008),-.025-i*.022,0],turn);
  const surface=kind==='crown'?[sign*.034,.48+gap,0]:[sign*gap/2,.05,.25+sign*depthGap/2],pad=rotations([0,-.07,-.01],turn),wrist=surface.map((v,i)=>v-pad[i]),shoulder=[sign*.18,0,0],d=wrist.map((v,i)=>v-shoulder[i]),distance=Math.hypot(...d),axis=d.map(v=>v/distance),pole0=kind==='crown'?[sign*.06,.28,.05]:[sign*.006,-.213,.197],dot=pole0.reduce((sum,v,i)=>sum+v*axis[i],0),pole=pole0.map((v,i)=>v-axis[i]*dot),poleSize=Math.hypot(...pole),along=(.34**2-.26**2+distance**2)/(2*distance),height=Math.sqrt(.34**2-along**2),elbow=shoulder.map((v,i)=>v+axis[i]*along+pole[i]*height/poleSize);
  p[s]=pt(...shoulder);p[e]=pt(...elbow);p[w]=pt(...wrist);p[h]=pt(sign*.12,-.5);
  if(!missing.includes(side)){hands.worldLandmarks.push(handPoints.map(v=>pt(...v)));hands.landmarks.push(handPoints.map(point=>project(point.map((v,i)=>v+wrist[i]))));hands.handednesses.push([{categoryName:side==='left'?'Left':'Right',score:.99}]);}
 }
 p[7]=pt(.08,.36);p[8]=pt(-.08,.36);p[0]=pt(0,.36,.12);body.landmarks=[p.map(q=>project([q.x,-q.y,-q.z]))];return {pose:body,hand:hands};
}
const settle=(tracker,result,start=0)=>{let out;for(let i=0;i<30;i++)out=tracker.update(result,start+i/30);return out;};
const near=(value,wanted,tolerance=1e-6)=>assert(Math.abs(value-wanted)<tolerance,`${value} != ${wanted}`);
let tracker=createRetargeter(joints,{smoothing:0}),out=settle(tracker,{pose:pose()});
assert(out.body);assert(out.tracked>=20);for(const id of ['left_elbow_pitch','left_knee_pitch','left_shoulder_pitch','left_shoulder_roll','neck_yaw','neck_pitch','torso_pitch'])near(out.positions[id],0);
const raise=pose();raise.worldLandmarks[0][13]=pt(.55,.5);raise.worldLandmarks[0][15]=pt(.85,.5);out=settle(tracker,{pose:raise},1);near(out.positions.left_shoulder_roll,90);near(out.positions.right_shoulder_roll,0);
const forward=pose();forward.worldLandmarks[0][13]=pt(.25,.5,.3);forward.worldLandmarks[0][15]=pt(.25,.5,.6);out=settle(tracker,{pose:forward},2);near(out.positions.left_shoulder_pitch,-90);near(out.positions.left_shoulder_roll,0);
const bent=pose();bent.worldLandmarks[0][15]=pt(.25,.2,.3);out=settle(tracker,{pose:bent},3);near(out.positions.left_elbow_pitch,-90);
const wave=pose();wave.worldLandmarks[0][13]=pt(.55,.5);wave.worldLandmarks[0][15]=pt(.55,.8);out=settle(tracker,{pose:wave},4);near(out.positions.left_shoulder_roll,90);near(out.positions.left_shoulder_yaw,90);near(out.positions.left_elbow_pitch,-90);
const hidden=pose();hidden.worldLandmarks[0][15].visibility=.1;out=tracker.update({pose:hidden},5);near(out.positions.left_elbow_pitch,-90);assert(out.tracked>0);
out=tracker.update({},5.1);assert.equal(out.tracked,0);assert(!out.body);near(out.positions.left_elbow_pitch,-90);
const damaged=pose();damaged.worldLandmarks[0][11].x=NaN;out=tracker.update({pose:damaged},5.2);assert(!out.body);assert(Object.values(out.positions).every(Number.isFinite));
tracker=createRetargeter(joints,{smoothing:0,mode:'hands'});out=settle(tracker,{hand:hand('Left',Math.PI/2)});near(out.positions.left_index_2,-90);near(out.positions.right_index_2,0);assert(out.leftHand&&!out.rightHand&&!out.body);
// Real MediaPipe 0.10.14 hands include zero-valued visibility placeholders.
const placeholderHand=hand('Left',Math.PI/2);placeholderHand.worldLandmarks[0].forEach(p=>{p.visibility=0;p.presence=0;});out=settle(tracker,{hand:placeholderHand},1);assert(out.leftHand&&out.tracked>=15);near(out.positions.left_index_2,-90);
// Valid normalized pose wrists override a contradictory classifier label.
const attached=hand('Right',Math.PI/2),body=pose();attached.landmarks[0][0]={...body.landmarks[0][15]};out=settle(tracker,{pose:body,hand:attached},1);assert(out.leftHand&&!out.rightHand);
// A tracked person's body prevents a distant bystander's hand from falling
// back to its classifier label. Missing wrists hold rather than swap identity.
const bystander=hand('Left',Math.PI/2),trackedBody=pose();bystander.landmarks[0][0]={x:.98,y:.02,z:0};
const isolated=createRetargeter(joints,{smoothing:0,mode:'hands'});
let association=settle(isolated,{pose:trackedBody,hand:bystander});assert(!association.leftHand&&!association.rightHand&&association.tracked===0,'far bystander hand is rejected while a body is present');
const oneWrist=pose();oneWrist.landmarks[0][16].visibility=.1;
const nearLeft=hand('Right',Math.PI/3);nearLeft.landmarks[0][0]={...oneWrist.landmarks[0][15],x:oneWrist.landmarks[0][15].x+.025};
association=settle(isolated,{pose:oneWrist,hand:nearLeft},1);assert(association.leftHand&&!association.rightHand,'one visible wrist can identify its hand despite a conflicting label');near(association.positions.left_index_2,-60);
const invisibleWrists=pose();invisibleWrists.landmarks[0][15].visibility=.1;invisibleWrists.landmarks[0][16].visibility=.1;
association=isolated.update({pose:invisibleWrists,hand:nearLeft},2);assert(!association.leftHand&&!association.rightHand&&association.tracked===0,'pose with no visible wrists must not accept unassociated hands');near(association.positions.left_index_2,-60);
// Crossed screen positions and contradictory handedness labels still map
// uniquely by the tracked left/right wrist, not by the image's left/right side.
const crossed=pose();crossed.landmarks[0][15]={...crossed.landmarks[0][15],x:.3,y:.45};crossed.landmarks[0][16]={...crossed.landmarks[0][16],x:.7,y:.45};
const crossedLeft=hand('Right',Math.PI/6),crossedRight=hand('Left',Math.PI/2);crossedLeft.landmarks[0][0]={...crossed.landmarks[0][15],x:.31};crossedRight.landmarks[0][0]={...crossed.landmarks[0][16],x:.69};
const crossedHands={worldLandmarks:[crossedRight.worldLandmarks[0],crossedLeft.worldLandmarks[0]],landmarks:[crossedRight.landmarks[0],crossedLeft.landmarks[0]],handednesses:[crossedRight.handednesses[0],crossedLeft.handednesses[0]]};
association=settle(isolated,{pose:crossed,hand:crossedHands},3);assert(association.leftHand&&association.rightHand);near(association.positions.left_index_2,-30);near(association.positions.right_index_2,-90);
// A small on-screen forearm must not inherit the former fixed 24%-image gate.
const distantBody=pose();distantBody.landmarks[0][15]={...distantBody.landmarks[0][15],x:.5,y:.5};distantBody.landmarks[0][13]={...distantBody.landmarks[0][13],x:.5,y:.46};distantBody.landmarks[0][16].visibility=.1;
const outsideScaledGate=hand('Left',Math.PI/2);outsideScaledGate.landmarks[0][0]={x:.58,y:.5,z:0};association=isolated.update({pose:distantBody,hand:outsideScaledGate},4);assert.equal(association.tracked,0,'association gate scales down for a distant person');
association=settle(isolated,{hand:hand('Right',Math.PI/4)},5);assert(association.rightHand&&!association.leftHand,'without any pose, handedness-only tracking remains supported');near(association.positions.right_index_2,-45);
const lowHand=hand('Left',0);lowHand.handednesses[0][0].score=.1;out=tracker.update({hand:lowHand},1.99);assert.equal(out.tracked,0);near(out.positions.left_index_2,-90);
const duplicate=hand('Right',Math.PI/2);duplicate.worldLandmarks.push(duplicate.worldLandmarks[0]);duplicate.landmarks.push(duplicate.landmarks[0]);duplicate.handednesses.push([{categoryName:'Right',score:.8}]);out=tracker.update({hand:duplicate},2);assert(!out.leftHand&&out.rightHand,'duplicate labels cannot fabricate a left hand');
tracker.configure({swapSides:true});out=settle(tracker,{hand:hand('Left',Math.PI/2)},2);near(out.positions.right_index_2,-90);assert(out.rightHand&&!out.leftHand);
tracker.configure({mode:'body',swapSides:false});out=settle(tracker,{pose:raise,hand:hand('Left',Math.PI/2)},3);assert(out.body&&!out.leftHand&&!out.rightHand);near(out.positions.left_shoulder_roll,90);
assert(tracker.calibrate());out=settle(tracker,{pose:raise},4);near(out.positions.left_shoulder_roll,0);
tracker.reset();assert(!tracker.calibrate());out=tracker.update({},5);near(out.positions.left_shoulder_roll,0);
// Pelvis-fixed legs must not follow torso pitch twice.
const lean=pose();lean.worldLandmarks[0][11]=pt(.25,.5,.2);lean.worldLandmarks[0][12]=pt(-.25,.5,.2);out=settle(tracker,{pose:lean},6);near(out.positions.left_hip_pitch,0);assert(out.positions.torso_pitch>10);
// A seated, tightly cropped person still drives both arms, head, and observed
// torso axes. The legs and unobservable chest pitch retain their commands.
const held={torso_pitch:12,left_hip_pitch:-35,left_hip_roll:9,left_knee_pitch:70,left_ankle_pitch:-15,right_hip_pitch:-25,right_knee_pitch:55};
const seatedWave=structuredClone(wave);seatedWave.worldLandmarks[0][0]=pt(.06,.7,Math.sqrt(.12**2-.06**2));
for(const reason of ['missing','weak','image-weak','outside']){
 const seated=createRetargeter(joints,{smoothing:0});seated.reset(held);
 const result=settle(seated,{pose:cropHips(seatedWave,reason)});
 assert(result.body&&result.coverage.framing==='upper',`${reason} hips retain upper body tracking`);
 near(result.positions.left_shoulder_roll,90);near(result.positions.left_shoulder_yaw,90);near(result.positions.left_elbow_pitch,-90);near(result.positions.neck_yaw,30);
 for(const [id,value]of Object.entries(held))near(result.positions[id],value);
 assert(result.coverage.body>=11);
}
// Whole-chest yaw and lateral lean belong to the torso, not a second rotation
// at each shoulder or at the neck. Check the fallback and the full-body path.
const chestTurn=turnChest(pose(),{yaw:30,roll:20});
for(const [input,yaw,roll] of [[turnChest(pose(),{yaw:30}),30,0],[turnChest(pose(),{roll:20}),0,20],[cropHips(chestTurn),30,20]]){
 const result=settle(createRetargeter(joints,{smoothing:0}),{pose:input});
 near(result.positions.torso_yaw,yaw);near(result.positions.torso_roll,roll);
 for(const id of ['left_shoulder_pitch','left_shoulder_roll','right_shoulder_pitch','right_shoulder_roll','neck_yaw','neck_pitch','neck_roll','left_hip_pitch'])near(result.positions[id],0);
}
// Camera yaw is not a chest twist when the pelvis is visible; switching
// framing preserves that reference and continues to follow later movement.
const cameraTurn=turnChest(pose(),{yaw:30});for(let i=23;i<33;i++){const p=cameraTurn.worldLandmarks[0][i],c=Math.cos(Math.PI/6),s=Math.sin(Math.PI/6);cameraTurn.worldLandmarks[0][i]=pt(p.x*c-p.z*s,-p.y,-p.x*s-p.z*c);}
const transitions=createRetargeter(joints,{smoothing:0});let transition=settle(transitions,{pose:cameraTurn});near(transition.positions.torso_yaw,0);assert.equal(transition.coverage.framing,'full');
transition=settle(transitions,{pose:cropHips(cameraTurn)},1);near(transition.positions.torso_yaw,0);assert.equal(transition.coverage.framing,'upper');
const cameraTurnMore=turnChest(pose(),{yaw:40});transition=settle(transitions,{pose:cropHips(cameraTurnMore)},2);near(transition.positions.torso_yaw,10);
transition=settle(transitions,{pose:cameraTurnMore},3);near(transition.positions.torso_yaw,10);assert.equal(transition.coverage.framing,'full');
assert(transitions.calibrate());transition=settle(transitions,{pose:cameraTurnMore},4);near(transition.positions.torso_yaw,0);
transition=settle(transitions,{pose:cropHips(cameraTurnMore)},5);near(transition.positions.torso_yaw,0);
transition=settle(transitions,{pose:cropHips(turnChest(pose(),{yaw:45}))},6);near(transition.positions.torso_yaw,5);
transition=transitions.update({},7);assert.equal(transition.coverage.framing,'none');near(transition.positions.torso_yaw,5);
transition=settle(transitions,{pose:turnChest(pose(),{yaw:45})},8);near(transition.positions.torso_yaw,5);
transitions.reset();transition=settle(transitions,{pose:cropHips(chestTurn)},9);near(transition.positions.torso_yaw,30);near(transition.positions.torso_roll,20);
assert(transitions.calibrate());transitions.configure({mode:'body'});transition=settle(transitions,{pose:cropHips(chestTurn)},10);near(transition.positions.torso_yaw,30);
transitions.configure({swapSides:true});transition=settle(transitions,{pose:cropHips(chestTurn)},11);near(transition.positions.torso_yaw,-30);near(transition.positions.torso_roll,-20);
// Cropping a forward-leaning body holds its last observed pitch frame, so
// upper arms and neck do not jump when pelvis confidence changes.
const leaningChest=turnChest(pose(),{pitch:20});const leaningTracker=createRetargeter(joints,{smoothing:0});
transition=settle(leaningTracker,{pose:leaningChest});near(transition.positions.torso_pitch,20);
for(const reason of ['outside','weak']){transition=settle(leaningTracker,{pose:cropHips(leaningChest,reason)},reason==='outside'?1:2);near(transition.positions.torso_pitch,20);for(const id of ['left_shoulder_pitch','right_shoulder_pitch','neck_pitch'])near(transition.positions[id],0);}
transition=settle(leaningTracker,{pose:leaningChest},3);near(transition.positions.torso_pitch,20);
leaningTracker.reset();transition=settle(leaningTracker,{pose:cropHips(pose())},4);near(transition.positions.left_shoulder_pitch,0);near(transition.positions.torso_pitch,0);
// Five observable head/chest axes are enough to calibrate while seated.
const headOnly=cropHips(turnChest(pose(),{yaw:25,roll:10}));for(const i of [13,14,15,16])headOnly.worldLandmarks[0][i].visibility=.1;
const headTracker=createRetargeter(joints,{smoothing:0});out=settle(headTracker,{pose:headOnly});assert.equal(out.coverage.body,5);assert(headTracker.calibrate());out=settle(headTracker,{pose:headOnly},1);near(out.positions.torso_yaw,0);near(out.positions.torso_roll,0);
const lostShoulder=structuredClone(headOnly);lostShoulder.landmarks[0][11].x=-.1;out=headTracker.update({pose:lostShoulder},2);assert(!out.body&&out.coverage.framing==='none');assert(!headTracker.calibrate());
// Finger association and negative finger flexion remain active in a combined
// upper-body recording, including classifier labels contradicted by wrists.
const seatedHands=cropHips(seatedWave),seatedHand=hand('Right',Math.PI/2);seatedHand.landmarks[0][0]={...seatedHands.landmarks[0][15]};
out=settle(createRetargeter(joints,{smoothing:0}),{pose:seatedHands,hand:seatedHand});assert(out.body&&out.leftHand&&!out.rightHand);near(out.positions.left_index_2,-90);near(out.positions.left_shoulder_roll,90);
// Bounds guard is optional for pure world-coordinate callers.
const worldOnly=pose();delete worldOnly.landmarks;out=settle(createRetargeter(joints,{smoothing:0}),{pose:worldOnly});assert(out.body&&out.coverage.framing==='full'&&out.coverage.body>=20);
const partialLegs=pose();for(const i of [25,27,29,31])partialLegs.landmarks[0][i].y=1.1;const legTracker=createRetargeter(joints,{smoothing:0});legTracker.reset(held);out=settle(legTracker,{pose:partialLegs});assert.equal(out.coverage.framing,'full');near(out.positions.left_hip_pitch,held.left_hip_pitch);near(out.positions.left_knee_pitch,held.left_knee_pitch);near(out.positions.left_ankle_pitch,held.left_ankle_pitch);near(out.positions.right_knee_pitch,0);
// A palm's normal supplies the axial rotation that wrist→finger direction
// cannot observe. Remove the complete arm chain before resolving the wrist.
for(const side of ['left','right'])for(const a of [
 {yaw:60},{yaw:-80,pitch:30,roll:-20},
 {yaw:45,pitch:-25,roll:18,elbow:-70,shoulderPitch:-50,shoulderRoll:side==='left'?35:-35,shoulderYaw:25},
 {yaw:-60,pitch:20,roll:-15,elbow:-110,shoulderPitch:-60,shoulderRoll:side==='left'?45:-45,shoulderYaw:-25,chestYaw:30,chestRoll:10,cropped:true}
]){
 const input=handScene(side,a),t=createRetargeter(joints,{smoothing:0}),result=settle(t,input);
 assert(result[side==='left'?'leftHand':'rightHand']);
 near(result.positions[side+'_forearm_yaw'],a.yaw);near(result.positions[side+'_wrist_pitch'],a.pitch||0);near(result.positions[side+'_wrist_roll'],a.roll||0);
 const curled=handScene(side,{...a,curl:Math.PI/2}),afterCurl=settle(t,curled,1);
 for(const id of ['forearm_yaw','wrist_pitch','wrist_roll'])near(afterCurl.positions[side+'_'+id],result.positions[side+'_'+id]);
 near(afterCurl.positions[side+'_index_2'],-90);
}
const flippedScene=handScene('left',{yaw:50,pitch:-25,roll:20,cropped:true});out=settle(createRetargeter(joints,{smoothing:0,swapSides:true}),flippedScene);near(out.positions.right_forearm_yaw,-50);near(out.positions.right_wrist_pitch,-25);near(out.positions.right_wrist_roll,-20);
// Finger tracking may continue while an elbow is hidden, but absolute wrist
// orientation holds until its parent frame is observed again.
const wristTracker=createRetargeter(joints,{smoothing:0}),beforeLoss=settle(wristTracker,handScene('left',{yaw:40,pitch:15,roll:10}));
const elbowLost=handScene('left',{yaw:75,pitch:30,roll:20});elbowLost.pose.worldLandmarks[0][13].visibility=.1;out=settle(wristTracker,elbowLost,1);assert(out.leftHand);for(const id of ['forearm_yaw','wrist_pitch','wrist_roll'])near(out.positions['left_'+id],beforeLoss.positions['left_'+id]);
out=settle(wristTracker,{hand:elbowLost.hand},2);near(out.positions.left_forearm_yaw,40);
const lowPalm=handScene('left',{yaw:80});lowPalm.hand.handednesses[0][0].score=.1;out=settle(wristTracker,lowPalm,3);assert(!out.leftHand);near(out.positions.left_forearm_yaw,40);
const flatPalm=handScene('left',{yaw:80});flatPalm.hand.worldLandmarks[0][17]={...flatPalm.hand.worldLandmarks[0][5]};out=settle(wristTracker,flatPalm,4);near(out.positions.left_forearm_yaw,40);
const palmReturned=handScene('left',{yaw:65,pitch:-10,roll:-12});out=settle(wristTracker,palmReturned,5);near(out.positions.left_forearm_yaw,65);near(out.positions.left_wrist_pitch,-10);near(out.positions.left_wrist_roll,-12);
// Unwrap before clamping: rotating beyond the +100° mechanical stop must
// not snap toward −100° when the measured angle crosses 180°.
const wrapTracker=createRetargeter(joints,{smoothing:0});for(const [i,yaw]of [80,120,170,190,210].entries()){out=settle(wrapTracker,handScene('left',{yaw}),i);near(out.positions.left_forearm_yaw,Math.min(100,yaw));near(out.positions.left_wrist_roll,0);}
// At the wrist Euler singularity, axial/deviation commands hold. Resume the
// same branch on the other side instead of rotating the palm by 180°.
const verticalTracker=createRetargeter(joints,{smoothing:0});out=settle(verticalTracker,handScene('right',{yaw:35,pitch:80,roll:15}));out=settle(verticalTracker,handScene('right',{yaw:35,pitch:90,roll:15}),1);near(out.positions.right_forearm_yaw,35);near(out.positions.right_wrist_roll,15);out=settle(verticalTracker,handScene('right',{yaw:35,pitch:100,roll:15}),2);near(out.positions.right_forearm_yaw,35);near(out.positions.right_wrist_pitch,75);near(out.positions.right_wrist_roll,15);
// Hands-only capture has no absolute arm reference. Preserve the initial
// robot pose and apply subsequent palm-local orientation deltas to it.
const relative=createRetargeter(joints,{smoothing:0,mode:'hands'}),initialHand={left_forearm_yaw:20,left_wrist_pitch:15,left_wrist_roll:-10};relative.reset(initialHand);
out=settle(relative,{hand:handScene('left').hand});for(const [id,v]of Object.entries(initialHand))near(out.positions[id],v);
out=settle(relative,{hand:handScene('left',{yaw:40}).hand},1);
for(const axis of [[1,0,0],[0,1,0],[0,0,1]]){
 const expected=rotations(rotate(axis,'y',40),orientationAxes({yaw:20,pitch:15,roll:-10})),actual=rotations(axis,orientationAxes({yaw:out.positions.left_forearm_yaw,pitch:out.positions.left_wrist_pitch,roll:out.positions.left_wrist_roll}));expected.forEach((v,i)=>near(actual[i],v));
}
const remembered=out.positions.left_forearm_yaw;out=relative.update({},2);near(out.positions.left_forearm_yaw,remembered);out=settle(relative,{hand:handScene('left',{yaw:40}).hand},3);near(out.positions.left_forearm_yaw,remembered);
relative.reset(initialHand);out=settle(relative,{hand:handScene('left',{yaw:70,pitch:-30,roll:10}).hand},4);for(const [id,v]of Object.entries(initialHand))near(out.positions[id],v);
const smoothedPalm=createRetargeter(joints,{smoothing:.5});out=smoothedPalm.update(handScene('left',{yaw:60}),0);near(out.positions.left_forearm_yaw,30);out=smoothedPalm.update(handScene('left',{yaw:60}),1/30);near(out.positions.left_forearm_yaw,45);
const slowPalm=createRetargeter(joints.map(j=>({...j,speed:30})),{smoothing:0});out=slowPalm.update(handScene('right',{yaw:-60,pitch:30,roll:20}),0);near(out.positions.right_forearm_yaw,-1);near(out.positions.right_wrist_pitch,1);near(out.positions.right_wrist_roll,1);assert(out.limited>=3);
// Different human head/shoulder heights and limb lengths must preserve where
// the wrist is relative to the head, including the sign of its depth.
for(const side of ['left','right'])for(const z of [.14,-.14]){
 const target=[side==='left'?.035:-.035,.03,z],input=nearHeadPose(side,target),t=createRetargeter(geometryJoints,{smoothing:0});out=settle(t,{pose:cropHips(input)});
 assert(out.coverage.headAdjusted.includes(side));const actual=rigWrist(out.positions,side),expected=target.map((v,i)=>v+robotGeometry(side).head[i]);actual.forEach((v,i)=>near(v,expected[i]));
 const baseline=settle(createRetargeter(joints,{smoothing:0}),{pose:input}),old=rigWrist(baseline.positions,side);assert(Math.hypot(...old.map((v,i)=>v-expected[i]))>.03,'angle-only transfer loses contact across different proportions');
}
// Arm offsets from seated calibration must not be subtracted a second time
// from the IK solution. The head-space endpoint remains the calibrated target.
const calibratedIK=createRetargeter(geometryJoints,{smoothing:0});settle(calibratedIK,{pose:cropHips(handScene('left',{shoulderRoll:8,elbow:-20}).pose)});assert(calibratedIK.calibrate());out=settle(calibratedIK,{pose:cropHips(nearHeadPose('left',[0,.03,-.14]))},1);rigWrist(out.positions,'left').forEach((v,i)=>near(v,[0,.60,-.14][i]));
// Presence can support a briefly occluded wrist only after a visible, plausible
// arm was measured. The path works at 5fps and expires after 1.2 seconds.
const inferred=createRetargeter(geometryJoints,{smoothing:0});inferred.update({pose:nearHeadPose()},0);
for(let i=1;i<=5;i++){const input=nearHeadPose('left',[0,.03,.14-i*.056]);input.worldLandmarks[0][15].visibility=.05;input.landmarks[0][15].visibility=.05;out=inferred.update({pose:input},i*.2);assert.deepEqual(out.coverage.inferredArms,['left']);}
rigWrist(out.positions,'left').forEach((v,i)=>near(v,[0,.60,-.14][i],.015));
const expired=nearHeadPose('left',[0,.03,-.14]);expired.worldLandmarks[0][15].visibility=.05;expired.landmarks[0][15].visibility=.05;out=inferred.update({pose:expired},1.21);assert.deepEqual(out.coverage.inferredArms,[]);
for(const reason of ['cold','presence','offscreen','length','gap','elbow','reset','mode']){
 const t=createRetargeter(geometryJoints,{smoothing:0});if(reason!=='cold')t.update({pose:nearHeadPose()},0);const input=nearHeadPose();input.worldLandmarks[0][15].visibility=.05;input.landmarks[0][15].visibility=.05;
 if(reason==='presence')input.landmarks[0][15].presence=.2;if(reason==='offscreen')input.landmarks[0][15].y=1.1;if(reason==='length')input.worldLandmarks[0][15]={...input.worldLandmarks[0][13],visibility:.05};if(reason==='elbow')input.worldLandmarks[0][13].visibility=.2;if(reason==='reset')t.reset();if(reason==='mode')t.configure({mode:'body'});
 out=t.update({pose:input},reason==='gap'?.5:.2);assert.deepEqual(out.coverage.inferredArms,[],reason+' must hold the unobserved wrist');
}
const mirroredInference=createRetargeter(geometryJoints,{smoothing:0,swapSides:true});mirroredInference.update({pose:nearHeadPose()},0);out=mirroredInference.update({pose:expired},.2);assert.deepEqual(out.coverage.inferredArms,['right']);
const restrictedElbow=geometryJoints.map(j=>({...j,...(j.id==='left_elbow_pitch'?{min:-60}:{})}));out=settle(createRetargeter(restrictedElbow,{smoothing:0}),{pose:nearHeadPose('left',[0,.03,.11])});assert(out.limited>0);assert(out.positions.left_elbow_pitch>=-60-1e-6);const reachable=Math.sqrt(.29**2+.27**2+2*.29*.27*Math.cos(Math.PI/3));near(Math.hypot(...rigWrist(out.positions,'left').map((v,i)=>v-robotGeometry('left').shoulder[i])),reachable,1e-5);
// Extended virtual forearm travel preserves a full flip from either initial
// 180° representation, with a continuous finite trajectory and no rebasing.
for(const direction of [-1,1]){const t=createRetargeter(geometryJoints,{smoothing:0});for(const [i,yaw]of [180,210,270,330,370,330,270,210,180].map(v=>v*direction).entries()){out=settle(t,handScene('left',{yaw}),i);near(out.positions.left_forearm_yaw,yaw);}}
// Shared contact targets preserve palm surfaces across different shoulder,
// arm and hand dimensions. Image overlap alone must never create a contact.
const joined=createRetargeter(geometryJoints,{smoothing:0});out=settle(joined,contactInput());assert(out.coverage.contacts.hands);let leftPad=rigPad(out.positions,'left'),rightPad=rigPad(out.positions,'right');assert(Math.hypot(...leftPad.map((v,i)=>v-rightPad[i]))<.01);
out=joined.update(contactInput('prayer',{missing:['right']}),1.1);assert(out.coverage.contacts.hands&&!out.rightHand,'brief dropout preserves contact without inventing a hand detection');
out=joined.update(contactInput('prayer',{missing:['right']}),1.2);leftPad=rigPad(out.positions,'left');rightPad=rigPad(out.positions,'right');assert(Math.hypot(...leftPad.map((v,i)=>v-rightPad[i]))<.015);
out=joined.update(contactInput('prayer',{missing:['right']}),1.5);assert(!out.coverage.contacts.hands,'cached contact expires');
for(const scenario of [{gap:.18},{depthGap:.24},{missing:['right']}]){out=settle(createRetargeter(geometryJoints,{smoothing:0}),contactInput('prayer',scenario));assert(!out.coverage.contacts.hands,'separation, depth mismatch or cold missing hand must not couple arms');}
const release=createRetargeter(geometryJoints,{smoothing:0});settle(release,contactInput());out=release.update(contactInput('prayer',{gap:.18,missing:['right']}),1.1);assert(!out.coverage.contacts.hands,'visible wrist separation immediately releases a cached contact');
const crownTracker=createRetargeter(geometryJoints,{smoothing:0});out=settle(crownTracker,contactInput('crown'));assert.deepEqual(out.coverage.contacts.head,['left','right']);assert(!out.coverage.contacts.hands,'two crown contacts take priority over incidental finger proximity');for(const side of ['left','right']){const pad=rigPad(out.positions,side);assert(pad[1]>=.677&&pad[1]<.69);assert(Math.abs(pad[0])<.08&&Math.abs(pad[2])<.06);}
const contactReset=createRetargeter(geometryJoints,{smoothing:0});settle(contactReset,contactInput());contactReset.reset();out=contactReset.update(contactInput('prayer',{missing:['right']}),2);assert(!out.coverage.contacts.hands);
// Slew rate and configured limits apply even with smoothing disabled.
const slow=joints.map(j=>({...j,speed:30,...(j.id==='left_shoulder_roll'?{max:40}:{})}));tracker=createRetargeter(slow,{smoothing:0});out=tracker.update({pose:raise},0);assert(out.positions.left_shoulder_roll<=1.000001);out=settle(tracker,{pose:raise},.1);assert(out.positions.left_shoulder_roll<=40);assert(out.limited>0);
tracker.configure({joints:slow.map(j=>({...j,...(j.id==='left_shoulder_roll'?{max:5}:{})}))});out=tracker.update({},2);assert(out.positions.left_shoulder_roll<=5);
assert.throws(()=>tracker.update({},NaN),e=>e.code==='TIME');
const allZero=Object.fromEntries(joints.map(j=>[j.id,0]));
const samples=Array.from({length:1201},(_,i)=>({time:10+i/60,positions:{...allZero,left_shoulder_roll:45*Math.sin(i/60)}}));
const captureJoints=joints.map(j=>({...j,speed:15}));const capture=buildCaptureProgram(samples,captureJoints,{maxPoints:50});assert(capture.program.points.length<=50);assert.equal(capture.program.points[0].time,0);assert.equal(capture.stats.sourceDuration,20);assert(capture.stats.timeScale>1);assert(Object.values(estimatePeakSpeed(validateProgram(capture.program,captureJoints))).every(v=>v<=15+1e-6));
const constant=buildCaptureProgram([{time:3,positions:allZero},{time:5,positions:allZero}],joints);assert.equal(constant.stats.outputFrames,2);assert.equal(constant.stats.duration,2);
assert.throws(()=>buildCaptureProgram([{time:0,positions:allZero}],joints),e=>e.code==='CAPTURE_SHORT');
assert.throws(()=>buildCaptureProgram([{time:2,positions:allZero},{time:1,positions:allZero}],joints),e=>e.code==='CAPTURE_TIME');
assert.throws(()=>buildCaptureProgram([{time:0,positions:allZero},{time:1,positions:{...allZero,neck_yaw:NaN}}],joints),e=>e.code==='CAPTURE_VALUE');
assert.throws(()=>buildCaptureProgram([{time:0,positions:allZero},{time:1,positions:{...allZero,neck_yaw:80}}],joints.map(j=>({...j,speed:.1}))),e=>e.code==='CAPTURE_LONG');
assert.equal(samples[0].time,10,'input samples are not modified');
console.log('PASS retarget full/seated body, palm/forearm orientation, hand association, occlusion holds, framing/calibration, limits and capture timing');

// Initialization copies the detected pose before speed-limited tracking begins.
{
 const slow=joints.map(j=>({...j,speed:5}));
 const tracker=createRetargeter(slow,{smoothing:.9});
 tracker.reset({left_shoulder_pitch:80,left_knee_pitch:110});
 const scene=handScene('left',{shoulderPitch:-70,elbow:-60,cropped:true});
 const aligned=tracker.update(scene,0,{synchronize:true});
 assert(Math.abs(aligned.positions.left_shoulder_pitch+70)<.001);
 assert(Math.abs(aligned.positions.left_elbow_pitch+60)<.001);
 const next=tracker.update(handScene('left',{shoulderPitch:-30,elbow:-60,cropped:true}),1/30);
 assert(Math.abs(next.positions.left_shoulder_pitch-aligned.positions.left_shoulder_pitch)<=5/30+1e-8);
 assert.equal(aligned.positions.left_knee_pitch,110,'synchronization only changes observable joints');
}
