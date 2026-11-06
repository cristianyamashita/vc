// Human contact fixtures have different limb, palm, and head proportions.
// Assertions measure the actual rendered rubber pads / fingertips / head shell.
// These are geometry and continuity tests, not camera-model accuracy claims.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';

export async function runRobotContactChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async baselineURL=>{
  const THREE=await import('three'),{createRobot}=await import('./robot.js');
  const {createRetargeter,buildCaptureProgram}=await import('./retarget.js');
  const {validateProgram,sampleProgram}=await import('./motion.js');
  const before=baselineURL?(await import(baselineURL)).createRetargeter:null;
  const rig=createRobot(),joints=Object.fromEntries(rig.joints.map(j=>[j.id,j]));
  const definitions=rig.joints.map(({node,...j})=>({...j,speed:1440}));
  const v=a=>new THREE.Vector3(...a),world=p=>({x:p.x,y:-p.y,z:-p.z,visibility:1,presence:1});
  const screen=p=>({x:.5+p.x*.65,y:.6-p.y*.6,z:-p.z*.65,visibility:1,presence:1});
  const set=pose=>{rig.joints.forEach(j=>rig.setJoint(j.id,pose[j.id]||0));rig.root.updateMatrixWorld(true);};
  const position=(id,offset=[0,0,0])=>joints[id].node.localToWorld(v(offset));
  const quaternion=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180,'XYZ'));
  const facePoint=[0,-.07,-.01]; // Human skin face: .01m thick, not robot .0275m.
  const padPoint=[0,-.065,-.0275]; // Measured actual rubber pad's exterior face.
  const rows=[],failures=[],snapshots={};let checks=0;
  const check=(name,ok,detail={})=>{checks++;if(!ok)failures.push({name,...detail});};
  const settle=(tracker,input,start=0,count=60)=>{let out;for(let i=0;i<count;i++)out=tracker.update(input,start+i/30);return out;};
  const upper=.34,lower=.26,shoulder=.18,headY=.36,headWidth=.16,headDepth=.12,headTop=.12;
  const sourcePalm=(side,q)=>{
   const sign=side==='left'?1:-1,p=Array.from({length:21},()=>v([0,0,0]));
   for(const [start,x,len]of [[5,-sign*.035,.09],[9,-sign*.012,.10],[13,sign*.012,.09],[17,sign*.035,.075]])for(let i=0;i<4;i++)p[start+i]=v([x,-.12-i*len/3,0]);
   for(let i=1;i<=4;i++)p[i]=v([-sign*(.045+i*.008),-.025-i*.022,0]);
   return p.map(point=>point.applyQuaternion(q));
  };
  function fixture(kind,{gap=0,depthGap=0,cropped=false,missing=[],sideOnly=null,rest=false}={}){
   const points=Array.from({length:33},()=>v([0,-.4,0])),hands=[];
   for(const [side,s,e,w,h,k,a]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
    const sign=side==='left'?1:-1,s0=v([sign*shoulder,0,0]);points[s]=s0;points[h]=v([sign*.12,-.5,0]);points[k]=v([sign*.12,-.9,0]);points[a]=v([sign*.12,-1.3,0]);
    if(rest||sideOnly&&side!==sideOnly){const direction=v([sign*Math.sin(8*Math.PI/180),-Math.cos(8*Math.PI/180),0]);points[e]=s0.clone().addScaledVector(direction,upper);points[w]=points[e].clone().addScaledVector(direction,lower);continue;}
    let q,contact,pole;
    if(kind==='prayer'){
     q=new THREE.Quaternion().setFromAxisAngle(v([0,1,0]),sign*Math.PI/2).multiply(new THREE.Quaternion().setFromAxisAngle(v([0,0,1]),Math.PI));
     contact=v([sign*gap/2,.05,.25+sign*depthGap/2]);pole=v([sign*.006,-.213,.197]);
    }else if(kind==='tips'){
     q=new THREE.Quaternion().setFromAxisAngle(v([1,0,0]),-Math.PI/2).multiply(new THREE.Quaternion().setFromAxisAngle(v([0,0,1]),-sign*Math.PI/2));
     contact=v([sign*gap/2,.05,.25+sign*depthGap/2]);pole=v([sign*.18,-.15,.18]);
    }else{
     q=quaternion(-90,0,0);contact=v([sideOnly?0:sign*.034,headY+headTop+gap,0]);pole=v([sign*.06,.28,.05]);
    }
    const hand=sourcePalm(side,q),anchor=kind==='tips'?hand[12]:v(facePoint).applyQuaternion(q),wrist=contact.clone().sub(anchor);
    const delta=wrist.clone().sub(s0),distance=delta.length(),axis=delta.clone().normalize();
    if(distance>upper+lower||distance<Math.abs(upper-lower))throw Error('Unreachable human '+kind+' fixture');
    pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
    points[e]=s0.clone().addScaledVector(axis,along).addScaledVector(pole,height);points[w]=wrist;
    if(!missing.includes(side))hands.push({side,world:hand.map(p=>({...world(p),visibility:0,presence:0})),image:hand.map(p=>screen(p.clone().add(wrist)))});
   }
   points[7]=v([headWidth/2,headY,0]);points[8]=v([-headWidth/2,headY,0]);points[0]=v([0,headY,headDepth]);
   const pose={worldLandmarks:[points.map(world)],landmarks:[points.map(screen)]};if(cropped)for(let i=23;i<33;i++)pose.landmarks[0][i].y=1.2;
   return {pose,hand:{worldLandmarks:hands.map(h=>h.world),landmarks:hands.map(h=>h.image),handednesses:hands.map(h=>[{categoryName:h.side==='left'?'Left':'Right',score:.99}])}};
  }
  function pair(out,kind='prayer'){
   set(out.positions);const offset=kind==='tips'?[0,-(.038*.65-.001),0]:padPoint,id=side=>side+(kind==='tips'?'_middle_3':'_wrist_roll');
   const left=position(id('left'),offset),right=position(id('right'),offset),n=v(kind==='tips'?[0,-1,0]:[0,0,-1]).applyQuaternion(joints[id('left')].node.getWorldQuaternion(new THREE.Quaternion()));
   const other=v(kind==='tips'?[0,-1,0]:[0,0,-1]).applyQuaternion(joints[id('right')].node.getWorldQuaternion(new THREE.Quaternion())),delta=right.clone().sub(left);
   return {gap:left.distanceTo(right),signedGap:delta.dot(n),facing:n.dot(other),left:left.toArray(),right:right.toArray(),limited:out.limited,coverage:out.coverage};
  }
  function crown(out,side){
   set(out.positions);const head=position('neck_roll',[0,.115,0]),surface=position(side+'_wrist_roll',padPoint);
   const corners=[];for(const x of [-.031,.031])for(const y of [-.0335,.0335])corners.push(position(side+'_wrist_roll',[x,-.065+y,-.0275]));
   const crownY=head.y+.11,gap=surface.y-crownY,minY=Math.min(...corners.map(p=>p.y)),n=v([0,0,-1]).applyQuaternion(joints[side+'_wrist_roll'].node.getWorldQuaternion(new THREE.Quaternion()));
   return {gap,minCornerGap:minY-crownY,normalY:n.y,withinTop:Math.abs(surface.x-head.x)<.08&&Math.abs(surface.z-head.z)<.06,surface:surface.toArray(),crownY,limited:out.limited,coverage:out.coverage};
  }
  // Opposed palms and fingertips are distinct contacts; neither depends on
  // detecting the head or matching the human limb proportions to the rig.
  for(const kind of ['prayer','tips'])for(const cropped of [false,true]){
   const input=fixture(kind,{cropped}),tracker=createRetargeter(definitions,{smoothing:0}),out=settle(tracker,input),actual=pair(out,kind),baseline=before?pair(settle(before(definitions,{smoothing:0}),input),kind):null;
   rows.push({kind,cropped,baseline,...actual});
   check(kind+' surfaces meet',actual.gap<.01,{kind,cropped,...actual});
   check(kind+' surfaces do not pass through each other',actual.signedGap>=-.003,{kind,cropped,...actual});
   if(kind==='prayer')check('opposed palm faces remain opposed',actual.facing<-.9,{cropped,...actual});
   if(kind==='prayer'&&!cropped)snapshots.prayer=out.positions;
   const separated=settle(tracker,fixture(kind,{gap:.18,cropped}),3),apart=pair(separated,kind);
   check('separating '+kind+' releases contact',apart.gap>.10,{kind,cropped,...apart});
   const depthSeparated=settle(createRetargeter(definitions,{smoothing:0}),fixture(kind,{depthGap:.24,cropped})),depth=pair(depthSeparated,kind);
   check('2D overlap with different depth is not contact',depth.gap>.12,{kind,cropped,...depth});
  }
  for(const side of ['left','right'])for(const cropped of [false,true]){
   const input=fixture('crown',{cropped,sideOnly:side}),out=settle(createRetargeter(definitions,{smoothing:0}),input),actual=crown(out,side),baseline=before?crown(settle(before(definitions,{smoothing:0}),input),side):null;
   rows.push({kind:'crown',side,cropped,baseline,...actual});
   check('palm reaches crown',actual.gap>=-.003&&actual.gap<.01&&actual.withinTop,{side,cropped,...actual});
   check('palm does not penetrate crown',actual.minCornerGap>=-.003,{side,cropped,...actual});
   check('crown palm remains downward facing',actual.normalY<-.95,{side,cropped,...actual});
   if(side==='left'&&!cropped)snapshots.crown=out.positions;
  }
  const both=settle(createRetargeter(definitions,{smoothing:0}),fixture('crown'));
  for(const side of ['left','right']){const actual=crown(both,side);check('both palms can touch crown',actual.gap>=-.003&&actual.gap<.01&&actual.withinTop&&actual.minCornerGap>=-.003,{side,...actual});}
  // Preserve a recently established contact through a brief missing hand
  // result, but release when body wrists separate and never create it cold.
  const continuity=createRetargeter(definitions,{smoothing:0});settle(continuity,fixture('prayer'));
  let out;for(let i=0;i<3;i++)out=continuity.update(fixture('prayer',{missing:['right']}),2.1+i*.08);
  check('brief missing hand preserves recent contact',pair(out).gap<.015,pair(out));
  for(let i=0;i<2;i++)out=continuity.update(fixture('prayer',{gap:.18,missing:['right']}),2.30+i*.04);
  check('separation releases before cached hand expires',pair(out).gap>.08,pair(out));
  out=settle(continuity,fixture('prayer',{gap:.18,missing:['right']}),2.5);
  check('separating wrists release even with a missing hand',pair(out).gap>.10,pair(out));
  const cold=settle(createRetargeter(definitions,{smoothing:0}),fixture('prayer',{missing:['right']}));
  check('missing hand does not fabricate a fresh opposed palm',pair(cold).facing>-.9||pair(cold).gap>.025,pair(cold));
  const calibrated=createRetargeter(definitions,{smoothing:0});settle(calibrated,fixture('prayer',{rest:true,cropped:true}));check('seated rest calibrates',calibrated.calibrate());
  out=settle(calibrated,fixture('prayer',{cropped:true}),3);check('calibration preserves palm contact',pair(out).gap<.01,pair(out));
  const narrow=definitions.map(j=>j.id==='left_elbow_pitch'?{...j,min:-45}:j),limited=settle(createRetargeter(narrow,{smoothing:0}),fixture('prayer'));
  check('custom limits remain enforced',narrow.every(j=>limited.positions[j.id]>=j.min-1e-7&&limited.positions[j.id]<=j.max+1e-7),{limited:limited.limited});
  const smooth=createRetargeter(rig.joints.map(({node,...j})=>j),{smoothing:.65}),smoothed=settle(smooth,fixture('prayer'),0,100);
  check('normal smoothing and speeds settle into contact',pair(smoothed).gap<.01,pair(smoothed));
  const captured=[{time:0,positions:snapshots.prayer},{time:2,positions:snapshots.crown}],built=buildCaptureProgram(captured,definitions),program=validateProgram(JSON.parse(JSON.stringify(built.program)),definitions);
  const replayPair=pair({positions:sampleProgram(program,0)}),replayCrown=crown({positions:sampleProgram(program,program.duration)},'left');
  check('saved prayer contact replays',replayPair.gap<.01,replayPair);check('saved crown contact replays',replayCrown.gap>=-.003&&replayCrown.gap<.01,replayCrown);
  const bench=createRetargeter(definitions,{smoothing:0}),benchInput=fixture('crown',{sideOnly:'left'}),timings=[];settle(bench,benchInput);
  for(let i=0;i<50;i++){const start=performance.now();bench.update(benchInput,3+i/30);timings.push(performance.now()-start);}
  const timing={crownAverageMs:timings.reduce((a,b)=>a+b,0)/timings.length,crownMaximumMs:Math.max(...timings),samples:timings.length};
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks,failures,rows,snapshots,timing};
 },process.env.ROBOT_CONTACT_BASELINE_URL||null);
 if(process.env.ROBOT_CONTACT_REPORT)await writeFile(process.env.ROBOT_CONTACT_REPORT,JSON.stringify(result,null,2));
 if(process.env.ROBOT_CONTACT_SCREENSHOTS){
  await mkdir(process.env.ROBOT_CONTACT_SCREENSHOTS,{recursive:true});
  await page.setViewportSize({width:1200,height:800});
  await page.locator('#lang-switcher').selectOption('pt');
  if(await page.locator('html').getAttribute('data-theme')!=='light')await page.locator('#theme-switcher').click();
  for(const [name,positions]of Object.entries(result.snapshots)){
   await page.locator('[data-tab="motion"]').click();await page.locator('#script').fill(JSON.stringify({version:1,units:'deg',interpolation:'smooth',points:[{time:0,positions},{time:1,positions}]}));await page.locator('#apply-script').click();await page.locator('[data-view="'+(name==='prayer'?'front':'perspective')+'"]').click();await page.waitForTimeout(200);await page.locator('#viewport').screenshot({path:process.env.ROBOT_CONTACT_SCREENSHOTS+'/'+name+'.png'});
  }
 }
 assert.equal(result.failures.length,0,JSON.stringify(result.failures.map(({name,kind,side,cropped,gap,minCornerGap})=>({name,kind,side,cropped,gap,minCornerGap})),null,2));
 return {checks:result.checks,timing:result.timing,rows:result.rows.map(({baseline,coverage,...row})=>({...row,baselineGap:baseline?.gap}))};
}
if(process.argv[1]?.endsWith('robot_lab_contact_browser.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS actual-rig contacts',await runRobotContactChecks(await browser.newPage({viewport:{width:960,height:640}}),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
