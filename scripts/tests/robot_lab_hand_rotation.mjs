// Actual rig → camera-like landmarks → retarget → replay regression.
// Run with the repository served at VC_URL (default localhost:8765).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

export async function runRobotHandRotationChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {createRobot}=await import('./robot.js');
  const {createRetargeter,buildCaptureProgram}=await import('./retarget.js');
  const {validateProgram,sampleProgram}=await import('./motion.js');
  const rig=createRobot(),byId=Object.fromEntries(rig.joints.map(j=>[j.id,j]));
  const definitions=rig.joints.map(({node,...j})=>({...j,speed:1440}));
  const zero=Object.fromEntries(rig.joints.map(j=>[j.id,0]));
  const point=(id,p=[0,0,0])=>byId[id].node.localToWorld(new THREE.Vector3(...p));
  const set=values=>{for(const j of rig.joints)rig.setJoint(j.id,values[j.id]??0);rig.root.updateMatrixWorld(true);};
  const world=v=>({x:v.x,y:-v.y,z:-v.z,visibility:1,presence:1});
  const image=v=>({x:.5+v.x*.24,y:.91-v.y*.43,z:-v.z*.24,visibility:1,presence:1});
  const tip=(side,digit)=>point(`${side}_${digit}_3`,[0,-(digit==='thumb'?.025:({index:.034,middle:.038,ring:.035,little:.028}[digit])*.65),0]);
  function capture(side,cropped=false){
   const p=Array.from({length:33},()=>new THREE.Vector3(0,1,0));
   for(const [prefix,s,e,w,h,k,a,heel,toe]of [['left',11,13,15,23,25,27,29,31],['right',12,14,16,24,26,28,30,32]]){
    p[s]=point(prefix+'_shoulder_pitch');p[e]=point(prefix+'_elbow_pitch');p[w]=point(prefix+'_wrist_pitch');p[h]=point(prefix+'_hip_yaw');p[k]=point(prefix+'_knee_pitch');p[a]=point(prefix+'_ankle_pitch');p[heel]=point(prefix+'_ankle_pitch',[0,-.08,-.07]);p[toe]=point(prefix+'_ankle_pitch',[0,-.08,.16]);
   }
   p[7]=point('neck_roll',[.099,.115,0]);p[8]=point('neck_roll',[-.099,.115,0]);p[0]=point('neck_roll',[0,.115,.11]);
   const pose={worldLandmarks:[p.map(world)],landmarks:[p.map(image)]};
   if(cropped)for(let i=23;i<33;i++)pose.landmarks[0][i].visibility=0;
   const h=Array(21);h[0]=point(side+'_wrist_roll');
   for(const [digit,index]of [['index',5],['middle',9],['ring',13],['little',17]]){for(let n=1;n<=3;n++)h[index+n-1]=point(`${side}_${digit}_${n}`);h[index+3]=tip(side,digit);}
   for(let n=1;n<=3;n++)h[n]=point(`${side}_thumb_${n}`);h[4]=tip(side,'thumb');
   // Real task hand worlds have their own center; translation must not matter.
   const center=h.reduce((a,v)=>a.add(v),new THREE.Vector3()).multiplyScalar(1/h.length);
   const hand={worldLandmarks:[h.map(v=>({...world(v.clone().sub(center)),visibility:0,presence:0}))],landmarks:[h.map(image)],handednesses:[[{categoryName:side==='left'?'Left':'Right',score:.99}]]};
   return {pose,hand};
  }
  const rows=[],checks=[];let checksCount=0;
  const check=(name,ok,detail)=>{checksCount++;if(!ok)checks.push({name,...detail});};
  const settle=(tracker,result,start=0)=>{let value;for(let i=0;i<30;i++)value=tracker.update(result,start+i/30);return value;};
  const arms=[
   {name:'down',pitch:0,roll:0,yaw:0,elbow:0},
   {name:'forward-bent',pitch:-70,roll:15,yaw:25,elbow:-70},
   {name:'side-bent',pitch:-20,roll:65,yaw:-20,elbow:-110},
  ];
  for(const side of ['left','right'])for(const arm of arms)for(const cropped of [false,true])for(const forearm of [-180,-150,-90,-60,0,60,90,150,180])for(const wrist of [[0,0],[30,20],[-25,-15]]){
   const sign=side==='left'?1:-1;
   const values={torso_yaw:cropped?30:0,torso_roll:cropped?10:0,[side+'_shoulder_pitch']:arm.pitch,[side+'_shoulder_roll']:arm.roll*sign,[side+'_shoulder_yaw']:arm.yaw*sign,[side+'_elbow_pitch']:arm.elbow,[side+'_forearm_yaw']:forearm,[side+'_wrist_pitch']:wrist[0],[side+'_wrist_roll']:wrist[1]};
   for(const digit of ['index','middle','ring','little']){values[`${side}_${digit}_1`]=-20;values[`${side}_${digit}_2`]=-65;values[`${side}_${digit}_3`]=-25;}
   set(values);const landmarks=capture(side,cropped),tracker=createRetargeter(definitions,{mode:'body-hands',smoothing:0}),out=settle(tracker,landmarks);
   const actual=['forearm_yaw','wrist_pitch','wrist_roll'].map(name=>out.positions[side+'_'+name]),expected=[forearm,...wrist],errors=actual.map((v,i)=>i===0?Math.abs(((v-expected[i]+180)%360+360)%360-180):Math.abs(v-expected[i]));
   const row={side,arm:arm.name,framing:cropped?'upper':'full',expected,actual,errors};rows.push(row);
   check('palm orientation roundtrip',Math.max(...errors)<3,row);
   check('finger closure independent of palm turn',Math.abs(out.positions[side+'_index_2']+65)<1e-6,row);
   check('hand remains tracked',side==='left'?out.leftHand:out.rightHand,row);
  }
  // A palm/back flip is a complete half-turn, not the former ±100° stop.
  // Track through the atan2 branch sequentially, including a small overshoot,
  // and ensure returning does not reverse through a 360° discontinuity.
  const flipRows=[];
  for(const side of ['left','right'])for(const direction of [-1,1])for(const mode of ['body-hands','hands']){
   const tracker=createRetargeter(definitions,{mode,smoothing:0});let previous=0;
   const sequence=[0,30,60,90,120,150,179,180,190,181,179,150,90,0];
   for(const [i,magnitude]of sequence.entries()){
    const target=magnitude*direction;set({[side+'_shoulder_pitch']:-65,[side+'_elbow_pitch']:-75,[side+'_forearm_yaw']:target});
    const landmarks=capture(side,true),out=settle(tracker,mode==='hands'?{hand:landmarks.hand}:landmarks,i),actual=out.positions[side+'_forearm_yaw'];
    const detail={side,mode,target,actual,previous};flipRows.push(detail);
    check('complete palm flip follows axial angle',Math.abs(actual-target)<3,detail);
    check('crossing180 preserves rotation continuity',i===0||Math.abs(actual-previous)<=Math.abs(target-sequence[i-1]*direction)+3,detail);previous=actual;
   }
  }
  // Capture may begin with the back of the hand facing the camera. Resolve
  // the equivalent±180° starting pose without sticking at a stop on the return.
  const reverseFlipRows=[];
  for(const side of ['left','right'])for(const direction of [-1,1])for(const mode of ['body-hands','hands'])for(const preserveInitial of mode==='hands'?[false,true]:[false]){
   const start=180*direction,tracker=createRetargeter(definitions,{mode,smoothing:0}),samples=[],angles=[];
   if(preserveInitial)tracker.reset({...zero,[side+'_forearm_yaw']:start});
   for(const [i,magnitude]of [180,150,120,90,60,30,0].entries()){
    const source=magnitude*direction,target=mode==='hands'&&!preserveInitial?source-start:source;
    set({[side+'_shoulder_pitch']:-65,[side+'_elbow_pitch']:-75,[side+'_forearm_yaw']:source});
    const landmarks=capture(side),out=settle(tracker,mode==='hands'?{hand:landmarks.hand}:landmarks,i),actual=out.positions[side+'_forearm_yaw'];
    const error=Math.abs(((actual-target+180)%360+360)%360-180),detail={side,mode,preserveInitial,source,target,actual,error};reverseFlipRows.push(detail);samples.push({time:i,positions:out.positions});angles.push(target);
    check('initial reversed palm completes half-turn',error<3,detail);
   }
   const built=buildCaptureProgram(samples,definitions),compiled=validateProgram(built.program,definitions);
   for(let i=0;i<samples.length-1;i++){
    const actual=sampleProgram(compiled,(i+.5)*built.stats.timeScale)[side+'_forearm_yaw'],target=(angles[i]+angles[i+1])/2,error=Math.abs(((actual-target+180)%360+360)%360-180);
    check('reverse half-turn replay avoids fake full spin',error<=Math.abs(angles[i+1]-angles[i])/2+1,{side,mode,preserveInitial,index:i,actual,target,error});
   }
  }
  // Starting at a reversed palm can continue past180° in either direction.
  // Keep that finite continuous branch in recorded data instead of rebasing.
  const outwardFlipRows=[];
  for(const side of ['left','right'])for(const direction of [-1,1])for(const mode of ['body-hands','hands']){
   const tracker=createRetargeter(definitions,{mode,smoothing:0}),samples=[];
   if(mode==='hands')tracker.reset({...zero,[side+'_forearm_yaw']:180*direction});
   for(const [i,magnitude]of [180,210,240,270,300,330,360,370,359,330,270,180].entries()){
    const target=magnitude*direction;set({[side+'_shoulder_pitch']:-65,[side+'_elbow_pitch']:-75,[side+'_forearm_yaw']:target});
    const landmarks=capture(side),out=settle(tracker,mode==='hands'?{hand:landmarks.hand}:landmarks,i),actual=out.positions[side+'_forearm_yaw'];
    const error=Math.abs(((actual-target+180)%360+360)%360-180),detail={side,mode,target,actual,error};outwardFlipRows.push(detail);samples.push({time:i,positions:out.positions});
    check('initial reversed palm continues through full turn',error<3,detail);
    if(i)check('outward flip has no recorded rebase',Math.abs(actual-samples[i-1].positions[side+'_forearm_yaw'])<=Math.abs(target-outwardFlipRows[outwardFlipRows.length-2].target)+3,detail);
   }
   const built=buildCaptureProgram(samples,definitions),compiled=validateProgram(JSON.parse(JSON.stringify(built.program)),definitions);
   for(let i=0;i<samples.length;i++){
    const actual=sampleProgram(compiled,i*built.stats.timeScale)[side+'_forearm_yaw'];
    check('outward full turn survives recorded replay',Math.abs(actual-samples[i].positions[side+'_forearm_yaw'])<=.75+1e-8,{side,mode,index:i,actual,expected:samples[i].positions[side+'_forearm_yaw']});
   }
  }
  // A raised arm can carry the elbow plane beyond180° behind the head.
  // Shoulder branch continuity must preserve both wrist depth and palm basis.
  const shoulderRows=[];
  for(const side of ['left','right'])for(const direction of [-1,1]){
   const tracker=createRetargeter(definitions,{mode:'body-hands',smoothing:0});
   for(const [i,magnitude]of [100,140,170,179,180,190,181,170].entries()){
    const yaw=magnitude*direction,sign=side==='left'?1:-1;
    set({[side+'_shoulder_pitch']:-20,[side+'_shoulder_roll']:80*sign,[side+'_shoulder_yaw']:yaw,[side+'_elbow_pitch']:-100,[side+'_forearm_yaw']:35,[side+'_wrist_pitch']:20,[side+'_wrist_roll']:-15});
    const expected=point(side+'_wrist_roll').clone(),expectedQ=byId[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion()),landmarks=capture(side),out=settle(tracker,landmarks,i);
    set(out.positions);const actual=point(side+'_wrist_roll'),orientationError=expectedQ.angleTo(byId[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion()));
    const detail={side,yaw,actualYaw:out.positions[side+'_shoulder_yaw'],positionError:actual.distanceTo(expected),orientationError};shoulderRows.push(detail);
    check('shoulder half-turn keeps continuous branch',Math.abs(detail.actualYaw-yaw)<3,detail);
    check('shoulder half-turn keeps wrist depth',detail.positionError<.025,detail);
    check('shoulder half-turn keeps palm orientation',orientationError<.03,detail);
   }
  }
  // Explicitly narrower user limits still take precedence over the model range.
  for(const side of ['left','right']){
   const restricted=definitions.map(j=>j.id===side+'_forearm_yaw'?{...j,min:-100,max:100}:j),tracker=createRetargeter(restricted,{mode:'body-hands',smoothing:0});
   for(const [i,angle]of [0,90,150,180].entries()){set({[side+'_shoulder_pitch']:-65,[side+'_elbow_pitch']:-75,[side+'_forearm_yaw']:angle});const out=settle(tracker,capture(side),i);check('explicit axial working limit preserved',Math.abs(out.positions[side+'_forearm_yaw'])<=100+1e-8,{side,angle,actual:out.positions[side+'_forearm_yaw']});}
  }
  // Preserve real rig hand depth on either side of the head, including the
  // raised-arm elbow plane that requires more than the former110° shoulder yaw.
  const depthRows=[];
  for(const side of ['left','right'])for(const arm of [
   {name:'forehead',pitch:-135,roll:0,yaw:-75,elbow:-80},
   {name:'behind-head',pitch:-170,roll:-30,yaw:-30,elbow:-80},
   {name:'raised-back-plane',pitch:0,roll:125,yaw:145,elbow:-100},
  ]){
   const sign=side==='left'?1:-1;set({[side+'_shoulder_pitch']:arm.pitch,[side+'_shoulder_roll']:arm.roll*sign,[side+'_shoulder_yaw']:arm.yaw*sign,[side+'_elbow_pitch']:arm.elbow});
   const expected=point(side+'_wrist_roll').clone(),landmarks=capture(side),tracker=createRetargeter(definitions,{mode:'body-hands',smoothing:0}),out=settle(tracker,landmarks);set(out.positions);const actual=point(side+'_wrist_roll'),error=actual.distanceTo(expected);
   const detail={side,arm:arm.name,expected:expected.toArray(),actual:actual.toArray(),error,angles:['shoulder_pitch','shoulder_roll','shoulder_yaw','elbow_pitch'].map(suffix=>out.positions[side+'_'+suffix])};depthRows.push(detail);
   check('head-relative wrist depth preserved',error<.025,detail);
   check('hand stays on correct side of head',Math.sign(actual.z)===Math.sign(expected.z)&&Math.abs(actual.z)>.1,detail);
  }
  // Occlusion and invalid palm planes must hold orientation, not snap to zero.
  for(const side of ['left','right']){
   set({[side+'_shoulder_pitch']:-60,[side+'_elbow_pitch']:-70,[side+'_forearm_yaw']:60,[side+'_wrist_pitch']:20,[side+'_wrist_roll']:-15});
   const tracker=createRetargeter(definitions,{mode:'body-hands',smoothing:0}),landmarks=capture(side),out=settle(tracker,landmarks);
   const orientation=()=>['forearm_yaw','wrist_pitch','wrist_roll'].map(name=>out.positions[side+'_'+name]);
   const held=orientation();
   for(const [name,input]of [['no hand',{pose:landmarks.pose}],['no landmarks',{}]]){const missing=tracker.update(input,2);check(name+' holds palm orientation',held.every((v,i)=>Math.abs(v-missing.positions[side+'_'+['forearm_yaw','wrist_pitch','wrist_roll'][i]])<1e-8),{side});}
   const degenerate=structuredClone(landmarks);for(const i of [5,9,17])degenerate.hand.worldLandmarks[0][i]={...degenerate.hand.worldLandmarks[0][0]};
   const bad=tracker.update(degenerate,3);check('degenerate palm holds orientation',held.every((v,i)=>Math.abs(v-bad.positions[side+'_'+['forearm_yaw','wrist_pitch','wrist_roll'][i]])<1e-8),{side});
  }
  // Captured rotation survives trajectory reduction, persistence and playback.
  for(const side of ['left','right']){
   const tracker=createRetargeter(definitions,{mode:'body-hands',smoothing:0}),samples=[];
   for(const [i,angle]of [0,90,180].entries()){
    set({[side+'_shoulder_pitch']:-60,[side+'_elbow_pitch']:-70,[side+'_forearm_yaw']:angle,[side+'_wrist_pitch']:20,[side+'_wrist_roll']:-15});
    const out=settle(tracker,capture(side),i);samples.push({time:i,positions:out.positions});
   }
   const built=buildCaptureProgram(samples,definitions),compiled=validateProgram(JSON.parse(JSON.stringify(built.program)),definitions);
   for(let i=0;i<samples.length;i++){const replay=sampleProgram(compiled,i*built.stats.timeScale);check('recorded rotation replays',Math.abs(replay[side+'_forearm_yaw']-samples[i].positions[side+'_forearm_yaw'])<1e-8,{side,index:i});}
   const first=sampleProgram(compiled,0),last=sampleProgram(compiled,compiled.duration);
   set(first);const q0=byId[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion());set(last);const q1=byId[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion());
   check('replay visibly rotates actual palm',q0.angleTo(q1)>3.0,{side,radians:q0.angleTo(q1)});
  }
  // Hands-only mode establishes a relative reference while preserving the user's
  // commanded forearm/wrist pose. Observed deltas are local to the initial palm.
  for(const side of ['left','right']){
   const initial={...zero,[side+'_forearm_yaw']:20,[side+'_wrist_pitch']:15,[side+'_wrist_roll']:-10};
   const tracker=createRetargeter(definitions,{mode:'hands',smoothing:0});tracker.reset(initial);
   set({[side+'_shoulder_pitch']:-70,[side+'_elbow_pitch']:-60});const baseline=capture(side);const first=settle(tracker,{hand:baseline.hand});
   for(const suffix of ['forearm_yaw','wrist_pitch','wrist_roll'])check('hands-only preserves initial orientation',Math.abs(first.positions[side+'_'+suffix]-initial[side+'_'+suffix])<1e-6,{side,suffix,actual:first.positions[side+'_'+suffix]});
   set({[side+'_shoulder_pitch']:-70,[side+'_elbow_pitch']:-60,[side+'_forearm_yaw']:40});const turned=settle(tracker,{hand:capture(side).hand},1);
   const values=['forearm_yaw','wrist_pitch','wrist_roll'].map(suffix=>turned.positions[side+'_'+suffix]);
   const expected=new THREE.Matrix4().makeRotationY(20*Math.PI/180).multiply(new THREE.Matrix4().makeRotationX(15*Math.PI/180)).multiply(new THREE.Matrix4().makeRotationZ(-10*Math.PI/180)).multiply(new THREE.Matrix4().makeRotationY(40*Math.PI/180));
   set(turned.positions);const actualQ=byId[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion()),expectedQ=new THREE.Quaternion().setFromRotationMatrix(expected);
   check('hands-only relative twist reaches robot',actualQ.angleTo(expectedQ)<.03,{side,actual:values,orientationError:actualQ.angleTo(expectedQ)});
  }
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks:checksCount,failures:checks,roundtripCases:rows.length,maxError:Math.max(...rows.flatMap(r=>r.errors)),rows,flipRows,reverseFlipRows,outwardFlipRows,shoulderRows,depthRows};
 });
 if(process.env.HAND_ROTATION_REPORT)await writeFile(process.env.HAND_ROTATION_REPORT,JSON.stringify(result,null,2));
 assert.deepEqual(result.failures,[],JSON.stringify(result.failures.slice(0,12),null,2));
 return {checks:result.checks,roundtripCases:result.roundtripCases,maxError:result.maxError};
}
if(process.argv[1]?.endsWith('robot_lab_hand_rotation.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS actual-rig hand rotation',await runRobotHandRotationChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
