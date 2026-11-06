// Synthetic human landmarks with deliberately different body proportions.
// Verify endpoints on the real Three.js rig, rather than duplicating retarget math.
// This checks geometry/occlusion policy, not monocular model accuracy.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

export async function runRobotDepthChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {createRobot}=await import('./robot.js');
  const {createRetargeter,buildCaptureProgram}=await import('./retarget.js');
  const {validateProgram,sampleProgram}=await import('./motion.js');
  const rig=createRobot(),byId=Object.fromEntries(rig.joints.map(j=>[j.id,j]));
  const definitions=rig.joints.map(({node,...j})=>({...j,speed:1440}));
  const simple=definitions.map(({retarget,...j})=>j);
  const position=(id,offset=[0,0,0])=>byId[id].node.localToWorld(new THREE.Vector3(...offset));
  const set=values=>{rig.joints.forEach(j=>rig.setJoint(j.id,values[j.id]||0));rig.root.updateMatrixWorld(true);};
  const settle=(tracker,input,start=0)=>{let out;for(let i=0;i<30;i++)out=tracker.update(input,start+i/30);return out;};
  const v=a=>new THREE.Vector3(...a);
  const world=p=>({x:p.x,y:-p.y,z:-p.z,visibility:1,presence:1});
  const screen=p=>({x:.5+p.x*.6,y:.55-p.y*.5,z:-p.z*.6,visibility:1,presence:1});
  const check=(name,ok,detail={})=>{checks++;if(!ok)failures.push({name,...detail});};
  const measurements=[],failures=[];let checks=0;
  // Source humanoid has narrow shoulders and longer upper arms than the rig.
  // Solving only the source elbow fixes its segment lengths and gives a
  // physically valid source pose; the retargeter remains independent.
  function human(side,offset,{upper=.34,lower=.26,shoulder=.18,headY=.36,headWidth=.16,headDepth=.12,cropped=false,rest=false,palmQuaternion=null,palmReach=.09,poleVector=null}={}) {
   const sign=side==='left'?1:-1,head=v([0,headY,0]),s=v([sign*shoulder,0,0]);
   const scaled=v([offset[0]*headWidth/.198,offset[1]*headWidth/.198,offset[2]*headDepth/.11]);
   let wrist=head.clone().add(scaled),elbow;
   if(palmQuaternion)wrist.sub(v([0,-palmReach,0]).applyQuaternion(palmQuaternion));
   if(rest){const axis=v([sign*Math.sin(8*Math.PI/180),-Math.cos(8*Math.PI/180),0]);elbow=s.clone().addScaledVector(axis,upper);wrist=elbow.clone().addScaledVector(axis,lower);}
   else{
    const delta=wrist.clone().sub(s),d=delta.length(),axis=delta.clone().normalize();
    if(d>=upper+lower||d<=Math.abs(upper-lower))throw Error('unreachable source fixture');
    const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(upper*upper-along*along);
    const pole=poleVector?poleVector.clone():v([sign,0,0]);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    elbow=s.clone().addScaledVector(axis,along).addScaledVector(pole,height);
   }
   const p=Array.from({length:33},()=>v([0,-.4,0]));
   for(const [prefix,a,b,c,h,k,f]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
    const direction=prefix==='left'?1:-1;p[a]=v([direction*shoulder,0,0]);p[b]=p[a].clone().add(v([0,-upper,0]));p[c]=p[b].clone().add(v([0,-lower,0]));p[h]=v([direction*.12,-.5,0]);p[k]=v([direction*.12,-.9,0]);p[f]=v([direction*.12,-1.3,0]);
   }
   const ids=side==='left'?[11,13,15]:[12,14,16];p[ids[0]]=s;p[ids[1]]=elbow;p[ids[2]]=wrist;
   p[7]=head.clone().add(v([headWidth/2,0,0]));p[8]=head.clone().add(v([-headWidth/2,0,0]));p[0]=head.clone().add(v([0,0,headDepth]));
   const pose={worldLandmarks:[p.map(world)],landmarks:[p.map(screen)]};
   if(cropped)for(let i=23;i<33;i++)pose.landmarks[0][i].y=1.2;
   if(!palmQuaternion)return {pose};
   const h=Array.from({length:21},()=>v([0,0,0]));
   for(const [start,x]of [[5,-sign*.04],[9,-sign*.012],[13,sign*.012],[17,sign*.04]])for(let i=0;i<4;i++)h[start+i]=v([x,-palmReach*2-i*.035,0]);
   for(let i=1;i<=4;i++)h[i]=v([-sign*(.045+i*.008),-.025-i*.022,0]);
   const oriented=h.map(point=>point.applyQuaternion(palmQuaternion));
   const hand={worldLandmarks:[oriented.map(point=>({...world(point),visibility:0,presence:0}))],landmarks:[oriented.map(point=>screen(point.clone().add(wrist)))],handednesses:[[{categoryName:side==='left'?'Left':'Right',score:.99}]]};
   return {pose,hand};
  }
  function measure(out,side,offset){
   set(out.positions);const head=position('neck_roll',[0,.115,0]),wrist=position(side+'_wrist_pitch'),target=head.clone().add(v(offset));
   return {error:wrist.distanceTo(target),depth:wrist.z-head.z,wrist:wrist.toArray(),target:target.toArray(),head:head.toArray()};
  }
  const shapes=[{name:'long upper arm',upper:.34,lower:.26,shoulder:.18,headY:.36,headWidth:.16,headDepth:.12},{name:'short broad body',upper:.28,lower:.31,shoulder:.23,headY:.28,headWidth:.18,headDepth:.10}];
  for(const side of ['left','right'])for(const shape of shapes)for(const cropped of [false,true])for(const depth of [.14,-.14]){
   const offset=[(side==='left'?1:-1)*.035,-.025,depth],input=human(side,offset,{...shape,cropped});
   const baseline=measure(settle(createRetargeter(simple,{smoothing:0}),input),side,offset);
   const tracker=createRetargeter(definitions,{smoothing:0}),out=settle(tracker,input),actual=measure(out,side,offset);
   const row={side,shape:shape.name,framing:cropped?'upper':'full',wantedDepth:depth,baselineError:baseline.error,...actual,angles:Object.fromEntries(['shoulder_pitch','shoulder_roll','shoulder_yaw','elbow_pitch'].map(k=>[k,out.positions[side+'_'+k]])),limited:out.limited};measurements.push(row);
   check('near-head position follows different source proportions',actual.error<.025,row);
   check('front and back remain on their observed side',Math.sign(actual.depth)===Math.sign(depth)&&Math.abs(actual.depth)>.08,row);
   check('position correction improves on angle-only mapping',actual.error<baseline.error*.5||baseline.error<.025,row);
   check('framing remains correct',out.coverage.framing===(cropped?'upper':'full'),row);
  }
  // Full hand landmarks use a longer human palm. Validate contact against
  // the actual rendered head box and rubber palm, rather than only wrist math.
  const palmMeasurements=[];
  for(const side of ['left','right']){
   const sign=side==='left'?1:-1;
   set({[side+'_shoulder_pitch']:-135,[side+'_shoulder_yaw']:-75*sign,[side+'_elbow_pitch']:-80,[side+'_forearm_yaw']:180});
   const palmQuaternion=byId[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion());
   const poleVector=position(side+'_elbow_pitch').sub(position(side+'_shoulder_pitch')).normalize();
   const offset=[0,.03,.14],input=human(side,offset,{...shapes[0],cropped:true,palmQuaternion,poleVector});
   const measurePalm=out=>{
    set(out.positions);const head=position('neck_roll',[0,.115,0]),center=position(side+'_wrist_roll',[0,-.064,0]);
    const pad=rig.root.getObjectByName(side+'_hand_palm').getWorldPosition(new THREE.Vector3());
    const headBox=new THREE.Box3().setFromObject(byId.neck_roll.node),target=head.clone().add(v(offset));
    return {error:center.distanceTo(target),surfaceGap:headBox.distanceToPoint(pad),palm:center.toArray(),pad:pad.toArray(),target:target.toArray(),limited:out.limited};
   };
   const baseline=measurePalm(settle(createRetargeter(simple,{smoothing:0}),input)),actual=measurePalm(settle(createRetargeter(definitions,{smoothing:0}),input));
   palmMeasurements.push({side,baseline,...actual});
   check('long human palm reaches the visible robot forehead',actual.error<.025&&actual.surfaceGap<.01,{side,baseline,...actual});
   check('palm correction reduces visible contact gap',actual.surfaceGap<baseline.surfaceGap*.6||baseline.surfaceGap<.025,{side,baseline,...actual});
  }
  // Calibration of a relaxed, slightly abducted arm must not offset a later
  // head-contact target away from the robot after IK has solved it.
  for(const side of ['left','right']){
   const tracker=createRetargeter(definitions,{smoothing:0}),shape=shapes[0];
   settle(tracker,human(side,[0,0,0],{...shape,rest:true,cropped:true}));
   check('upper-body calibration accepts rest pose',tracker.calibrate(),{side});
   const offset=[(side==='left'?1:-1)*.035,-.025,.14],out=settle(tracker,human(side,offset,{...shape,cropped:true}),1),actual=measure(out,side,offset);
   check('calibration preserves corrected endpoint',actual.error<.03,{side,...actual});
  }
  // An in-frame wrist with low visibility is an estimated point, not a lost
  // elbow. Use a small valid trajectory with a stable source forearm length.
  for(const side of ['left','right']){
   const shape=shapes[0],sign=side==='left'?1:-1,tracker=createRetargeter(definitions,{smoothing:0}),w=side==='left'?15:16;
   let out=settle(tracker,human(side,[sign*.035,-.025,.14],shape));
   const samples=[{time:0,positions:{...out.positions}}];
   for(let i=1;i<=16;i++){
    const depth=.14-i*.0175,input=human(side,[sign*.035,-.025,depth],shape);
    if(i>=5){input.pose.worldLandmarks[0][w].visibility=.15;input.pose.landmarks[0][w].visibility=.15;}
    out=tracker.update(input,1+i*.08);samples.push({time:i*.08,positions:{...out.positions}});
   }
   const actual=measure(out,side,[sign*.035,-.025,-.14]);
   check('continuous occluded wrist reaches behind head',actual.depth<-.08&&actual.error<.04,{side,...actual,coverage:out.coverage,angles:Object.fromEntries(['shoulder_pitch','shoulder_roll','shoulder_yaw','elbow_pitch'].map(k=>[k,out.positions[side+'_'+k]])),limited:out.limited});
   const held=out.positions;
   for(const [failureIndex,failure] of ['offscreen','missing-presence','bad-length','missing-elbow'].entries()){
    const input=human(side,[sign*.035,-.025,-.14],shape);input.pose.worldLandmarks[0][w].visibility=.1;input.pose.landmarks[0][w].visibility=.1;
    if(failure==='offscreen')input.pose.landmarks[0][w].x=1.3;
    if(failure==='missing-presence'){input.pose.worldLandmarks[0][w].presence=.1;input.pose.landmarks[0][w].presence=.1;}
    if(failure==='bad-length')input.pose.worldLandmarks[0][w].z=4;
    if(failure==='missing-elbow'){const e=side==='left'?13:14;input.pose.worldLandmarks[0][e].visibility=.1;input.pose.landmarks[0][e].visibility=.1;}
    const rejected=tracker.update(input,2.4+failureIndex*.08);
    for(const axis of ['shoulder_yaw','elbow_pitch'])check('invalid inference holds '+axis,Math.abs(rejected.positions[side+'_'+axis]-held[side+'_'+axis])<1e-6,{side,failure,axis});
   }
   const built=buildCaptureProgram(samples,definitions),program=validateProgram(JSON.parse(JSON.stringify(built.program)),definitions),replayed={positions:sampleProgram(program,program.duration)},last=measure(replayed,side,[sign*.035,-.025,-.14]);
   check('saved estimated depth replays in actual rig',Math.abs(last.depth-actual.depth)<1e-8,{side,last,actual});
  }
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks,failures,measurements,palmMeasurements,meanBefore:measurements.reduce((s,r)=>s+r.baselineError,0)/measurements.length,meanAfter:measurements.reduce((s,r)=>s+r.error,0)/measurements.length};
 });
 if(process.env.ROBOT_DEPTH_REPORT)await writeFile(process.env.ROBOT_DEPTH_REPORT,JSON.stringify(result,null,2));
 assert.deepEqual(result.failures,[],JSON.stringify(result.failures.slice(0,8),null,2));
 return {checks:result.checks,cases:result.measurements.length,meanBefore:result.meanBefore,meanAfter:result.meanAfter};
}
if(process.argv[1]?.endsWith('robot_lab_depth_browser.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS actual-rig depth retargeting',await runRobotDepthChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
