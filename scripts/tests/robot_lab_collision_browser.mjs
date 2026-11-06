// Independent collision regression: sample the rendered convex meshes, not
// collision.js proxies. Normal shoulder socket/armor attachment is excluded.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';

export async function runRobotCollisionChecks(page,base='http://127.0.0.1:8765'){
 await page.goto(base+'/page/utils/robot-lab/index.html');if(!process.env.ROBOT_COLLISION_PROBE)await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async probe=>{
  const THREE=await import('three'),{createRobot}=await import('./robot.js');
  const module=probe?null:await import('./collision.js'),rig=createRobot(),joints=Object.fromEntries(rig.joints.map(j=>[j.id,j]));
  const definitions=rig.joints.map(({node,...j})=>j),zero=Object.fromEntries(definitions.map(j=>[j.id,j.home||0]));
  const neutralSeed=definitions.find(j=>j.id==='torso_yaw')?.collision?.neutral,home={...zero,...neutralSeed};
  const complete=p=>({...home,...p}),set=p=>{for(const j of rig.joints)rig.setJoint(j.id,p[j.id]??j.home??0);rig.root.updateMatrixWorld(true);};
  const rows=[],failures=[],timings={clear:[],collision:[],continuous:[]};let checks=0;
  const check=(name,ok,detail={})=>{checks++;if(!ok)failures.push({name,...detail});};
  const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  function geometry(mesh){
   const g=mesh.geometry,p=g.attributes.position,index=g.index,read=i=>v().fromBufferAttribute(p,index?index.getX(i):i);
   g.computeBoundingBox();const center=g.boundingBox.getCenter(v()),planes=[],keys=new Set(),samples=new Map(),size=index?index.count:p.count;
   const add=p=>samples.set(p.toArray().map(n=>Math.round(n*1e6)).join(','),p);
   for(let i=0;i<size;i+=3){
    const a=read(i),b=read(i+1),c=read(i+2),normal=b.clone().sub(a).cross(c.clone().sub(a)),area2=normal.lengthSq();if(area2<1e-15)continue;
    normal.normalize();let constant=-normal.dot(a);if(normal.dot(center)+constant>1e-6){normal.negate();constant=-constant;}
    const key=[...normal.toArray(),constant].map(n=>Math.round(n*1e5)).join(',');if(!keys.has(key)){planes.push({normal,constant});keys.add(key);}
    add(a);add(b);add(c);if(area2>1.6e-9)add(a.clone().add(b).add(c).multiplyScalar(1/3));
   }
   return {mesh,planes,points:[center,...samples.values()],box:g.boundingBox.clone()};
  }
  const obstacles=[],parts=[],bodyIds=new Set(['torso_yaw','torso_pitch','torso_roll','neck_yaw','neck_pitch','neck_roll']);
  rig.root.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;const id=mesh.userData.jointId||'';
   if(bodyIds.has(id)||/^(left|right)_(hip|knee|ankle)_/.test(id))obstacles.push({...geometry(mesh),id});
   else if(/^(left|right)_(elbow_pitch|forearm_yaw|wrist_roll|(thumb|index|middle|ring|little)_\d|thumb_opposition)$/.test(id)||/^(left|right)_shoulder_yaw$/.test(id)&&mesh.position.y<-.08)parts.push({...geometry(mesh),id});
  });
  function measure(pose){
   set(pose);let maximum=0,witness=null;const byType={},bySide={left:0,right:0},byRegion={head:0,trunk:0,legs:0};
   const bodies=obstacles.map(o=>({...o,inverse:o.mesh.matrixWorld.clone().invert(),worldBox:o.box.clone().applyMatrix4(o.mesh.matrixWorld)}));
   for(const part of parts){
    const worldBox=part.box.clone().applyMatrix4(part.mesh.matrixWorld),side=part.id.split('_')[0],type=part.id.includes('shoulder')?'upper':part.id.includes('elbow')||part.id.includes('forearm')?'forearm':part.id.includes('wrist')?'palm':'fingers';
    for(const body of bodies){
     if(!worldBox.intersectsBox(body.worldBox))continue;const transform=new THREE.Matrix4().multiplyMatrices(body.inverse,part.mesh.matrixWorld);
     for(const sample of part.points){
      // The decorative upper shell deliberately overlaps its shoulder socket.
      // Exempt only its proximal 11cm against torso, never the distal arm/head.
      if(type==='upper'&&body.id.startsWith('torso_')&&sample.clone().applyMatrix4(part.mesh.matrix).y>-.11)continue;
      const point=sample.clone().applyMatrix4(transform);if(!body.box.containsPoint(point))continue;
      let distance=-Infinity;for(const plane of body.planes){distance=Math.max(distance,plane.normal.dot(point)+plane.constant);if(distance>=0)break;}
      const depth=Math.max(0,-distance),region=body.id.startsWith('neck_')?'head':/^(left|right)_(hip|knee|ankle)_/.test(body.id)?'legs':'trunk';byType[type]=Math.max(byType[type]||0,depth);bySide[side]=Math.max(bySide[side],depth);byRegion[region]=Math.max(byRegion[region],depth);
      if(depth>maximum){maximum=depth;witness={part:part.id,mesh:part.mesh.name||part.mesh.type,body:body.id,point:sample.clone().applyMatrix4(part.mesh.matrixWorld).toArray()};}
     }
    }
   }
   return {maximum,byType,bySide,byRegion,witness};
  }
  const arm=(side,pitch,roll,yaw,elbow,extra={})=>({...Object.fromEntries(definitions.filter(j=>j.group===side+'_arm'||j.group===side+'_hand').map(j=>[j.id,zero[j.id]])),...Object.fromEntries(Object.entries({shoulder_pitch:pitch,shoulder_roll:roll,shoulder_yaw:yaw,elbow_pitch:elbow,...extra}).map(([key,value])=>[side+'_'+key,value]))});
  const fixtures=[];
  for(const side of ['left','right']){const sign=side==='left'?1:-1;
   fixtures.push({name:side+' arm and palm through chest',pose:complete(arm(side,0,-sign*20,-sign*90,-110))});
   fixtures.push({name:side+' forearm and palm through head',pose:complete(arm(side,-170,0,-sign*90,-110))});
   fixtures.push({name:side+' fingers through head',pose:complete(arm(side,-120,sign*20,-sign*60,-90,{forearm_yaw:-sign*180,wrist_pitch:75,wrist_roll:-sign*30}))});
  }
  const prayer=complete({...arm('left',-53.63175199,-9.20409546,-42.18618988,-87.11727535,{forearm_yaw:80.19453647,wrist_pitch:-42.07487672,wrist_roll:-31.91499151,thumb_1:-3.45052384}),...arm('right',-53.63175199,9.20409546,42.18618988,-87.11727535,{forearm_yaw:-80.19453647,wrist_pitch:-42.07487672,wrist_roll:31.91499151,thumb_1:-3.45052384})});
  const crown=complete(arm('left',-169.84977197,11.87972016,-73.75697424,-87.22842817,{forearm_yaw:173.24795484,wrist_pitch:16.8659693,wrist_roll:24.02271233,thumb_1:-3.45052384}));
  const sweep=pitch=>complete({...arm('left',pitch,20,-90,-100),...arm('right',pitch,-20,90,-100)});
  const baseline={zero:measure(zero),home:measure(home),prayer:measure(prayer),crown:measure(crown),sweepStart:measure(sweep(-40)),sweepMiddle:measure(sweep(0)),sweepEnd:measure(sweep(40)),fixtures:fixtures.map(f=>({name:f.name,...measure(f.pose)}))};
  if(probe)return {checks,failures,baseline};
  const guard=()=>module.createCollisionGuard(definitions),finiteAndBounded=(pose,defs=definitions)=>defs.every(j=>Number.isFinite(pose[j.id])&&pose[j.id]>=j.min-1e-7&&pose[j.id]<=j.max+1e-7);
  const clear=(name,positions,detail={})=>{const actual=measure(positions);check(name,actual.maximum<=.002,{...detail,actual});return actual;};
  check('natural rest is declared separately from zero angles',!!neutralSeed&&Object.keys(neutralSeed).length>0&&definitions.every(j=>j.home===0));
  check('zero-angle fixture actually reaches the thighs',baseline.zero.byRegion.legs>.01,baseline.zero);
  const zeroResult=guard().solve(zero);clear('literal zero-angle script is corrected away from the legs',zeroResult.positions);check('zero-angle correction is finite and bounded',finiteAndBounded(zeroResult.positions));
  check('rest is geometrically clear',baseline.home.maximum<.002,baseline.home);
  for(const [i,fixture]of fixtures.entries()){
   check('fixture contains actual penetration',baseline.fixtures[i].maximum>.005,baseline.fixtures[i]);
   if(fixture.name.includes('fingers')){const type=baseline.fixtures[i].byType;check('finger-only fixture leaves palm and arm clear',Math.max(type.palm||0,type.forearm||0,type.upper||0)<.002&&type.fingers>.005,type);}
   const g=guard(),started=performance.now(),out=g.solve(fixture.pose);timings.collision.push(performance.now()-started);const actual=clear(fixture.name+' is corrected',out.positions,{diagnostics:out});
   check('correction returns finite angles within limits',finiteAndBounded(out.positions));
   check('actual penetration is reduced',actual.maximum<baseline.fixtures[i].maximum*.2,{before:baseline.fixtures[i].maximum,after:actual.maximum});
   rows.push({name:fixture.name,before:baseline.fixtures[i].maximum,after:actual.maximum,adjusted:out.adjusted,blocked:out.blocked,iterations:out.iterations});
   g.reset(fixture.pose);const recovered=g.solve(fixture.pose);clear('colliding initial pose is not accepted as safe',recovered.positions);
   const released=g.solve(home);clear('moving away recovers safely',released.positions);check('rest target can be recovered',Math.max(...definitions.map(j=>Math.abs(released.positions[j.id]-home[j.id])))<1);
  }
  const point=(id,offset)=>joints[id].node.localToWorld(v(...offset));
  const prayerResult=guard().solve(prayer);clear('prayer is collision free',prayerResult.positions);set(prayerResult.positions);
  const prayerGap=point('left_wrist_roll',[0,-.065,-.0275]).distanceTo(point('right_wrist_roll',[0,-.065,-.0275]));check('palms remain together',prayerGap<.01,{prayerGap});
  const crownResult=guard().solve(crown);clear('crown contact is collision free',crownResult.positions);set(crownResult.positions);
  const crownPoint=point('left_wrist_roll',[0,-.065,-.0275]),headPoint=point('neck_roll',[0,.225,0]),crownGap=crownPoint.y-headPoint.y;
  const crownNormal=v(0,0,-1).applyQuaternion(joints.left_wrist_roll.node.getWorldQuaternion(new THREE.Quaternion()));
  // Sliding along the flat crown is a valid collision correction. Measure the
  // physical surface gap, not distance from one arbitrarily chosen head point.
  check('palm remains on crown',crownGap>=-.002&&crownGap<.01&&Math.abs(crownPoint.x-headPoint.x)<.06&&Math.abs(crownPoint.z-headPoint.z)<.05&&crownNormal.y<-.95,{crownGap,crownPoint:crownPoint.toArray(),normal:crownNormal.toArray()});
  const g=guard(),start=sweep(-40),end=sweep(40);g.reset(start);let rawMaximum=0,correctedMaximum=0,largestWristStep=0,largestJump=null,lastWrist=null,last,lastPositions;
  for(let i=0;i<=60;i++){
   const desired=Object.fromEntries(definitions.map(j=>[j.id,start[j.id]+(end[j.id]-start[j.id])*i/60]));rawMaximum=Math.max(rawMaximum,measure(desired).maximum);
   const started=performance.now();last=g.solve(desired,{continuous:true});timings.continuous.push(performance.now()-started);const actual=measure(last.positions);correctedMaximum=Math.max(correctedMaximum,actual.maximum);
   const wrist=point('left_wrist_roll',[0,0,0]);if(lastWrist&&wrist.distanceTo(lastWrist)>largestWristStep){largestWristStep=wrist.distanceTo(lastWrist);largestJump={sample:i,desiredPitch:desired.left_shoulder_pitch,from:lastPositions,to:last.positions};}lastWrist=wrist;lastPositions=last.positions;
   check('each interpolation sample is finite and bounded',finiteAndBounded(last.positions),{sample:i});
  }
  check('interpolation fixture crosses the body',rawMaximum>.015,{rawMaximum});check('interpolated motion is corrected throughout',correctedMaximum<=.002,{correctedMaximum});
  for(let i=0;i<30;i++){const started=performance.now();last=g.solve(end,{continuous:true});timings.continuous.push(performance.now()-started);set(last.positions);const wrist=point('left_wrist_roll',[0,0,0]);largestWristStep=Math.max(largestWristStep,wrist.distanceTo(lastWrist));lastWrist=wrist;}
  check('correction stays spatially continuous',largestWristStep<.1,{largestWristStep});clear('interpolation recovers a clear endpoint',last.positions);
  check('clear endpoint recovers instead of staying frozen',Math.max(...definitions.map(j=>Math.abs(last.positions[j.id]-end[j.id])))<1);
  rows.push({name:'interpolation',rawMaximum,correctedMaximum,largestWristStep,largestJump});
  const limitedDefs=definitions.map(j=>j.id.endsWith('elbow_pitch')?{...j,min:-45}:j),custom=guard();custom.configure(limitedDefs);const limited=custom.solve(fixtures[0].pose);
  check('custom joint limits are enforced',finiteAndBounded(limited.positions,limitedDefs));clear('custom limit correction is collision free',limited.positions);
  const clearGuard=guard();for(let i=0;i<25;i++){const started=performance.now();clearGuard.solve(home);timings.clear.push(performance.now()-started);}
  const timing=Object.fromEntries(Object.entries(timings).map(([key,values])=>{const sorted=[...values].sort((a,b)=>a-b);return[key,{samples:values.length,averageMs:values.reduce((a,b)=>a+b,0)/values.length,medianMs:sorted[Math.floor(sorted.length/2)],maximumMs:Math.max(...values)}];}));
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks,failures,baseline,rows,contacts:{prayerGap,crownGap,crownPoint:crownPoint.toArray(),crownNormal:crownNormal.toArray()},timing,snapshots:{chest:fixtures[0].pose,head:fixtures[1].pose}};
 },process.env.ROBOT_COLLISION_PROBE||null);
 if(process.env.ROBOT_COLLISION_REPORT)await writeFile(process.env.ROBOT_COLLISION_REPORT,JSON.stringify(result,null,2));
 if(process.env.ROBOT_COLLISION_SCREENSHOTS&&!result.failures.length&&!process.env.ROBOT_COLLISION_PROBE){
  await mkdir(process.env.ROBOT_COLLISION_SCREENSHOTS,{recursive:true});await page.setViewportSize({width:1200,height:800});await page.locator('#lang-switcher').selectOption('pt');
  if(await page.locator('html').getAttribute('data-theme')!=='light')await page.locator('#theme-switcher').click();
  for(const [name,positions]of Object.entries(result.snapshots)){
   await page.locator('#reset-pose').click();await page.locator('[data-tab="motion"]').click();await page.locator('#script').fill(JSON.stringify({version:1,units:'deg',interpolation:'smooth',points:[{time:0,positions},{time:1,positions}]}));await page.locator('#apply-script').click();await page.locator('[data-view="perspective"]').click();await page.waitForTimeout(200);await page.screenshot({path:process.env.ROBOT_COLLISION_SCREENSHOTS+'/'+name+'.png'});
  }
 }
 assert.equal(result.failures.length,0,JSON.stringify(result.failures.map(({name,actual,diagnostics,...rest})=>({name,penetration:actual?.maximum,witness:actual?.witness,reportedPenetration:diagnostics?.maxPenetration,blocked:diagnostics?.blocked,...rest})),null,2));
 return result;
}
if(process.argv[1]?.endsWith('robot_lab_collision_browser.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS actual-rig collision checks',JSON.stringify(await runRobotCollisionChecks(await browser.newPage({viewport:{width:960,height:640}}),process.env.VC_URL||'http://127.0.0.1:8765'),null,2));}finally{await browser.close();}
}
