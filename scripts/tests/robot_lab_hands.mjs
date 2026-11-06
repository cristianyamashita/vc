// Geometric regression: inspect the actual Three.js rig, not duplicated rotation math.
// Serve the repository root. Uses the page import map for Three; no vendored copy.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
export async function runRobotHandChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {createRobot}=await import('./robot.js');
  const {createRetargeter}=await import('./retarget.js');
  const rig=createRobot(),joints=Object.fromEntries(rig.joints.map(j=>[j.id,j]));
  const reset=()=>{rig.joints.forEach(j=>rig.setJoint(j.id,0));rig.root.updateMatrixWorld(true);};
  const point=(id,offset=[0,0,0])=>joints[id].node.localToWorld(new THREE.Vector3(...offset));
  const tip=(side,digit)=>point(`${side}_${digit}_3`,[0,-(digit==='thumb'?.025:({index:.034,middle:.038,ring:.035,little:.028}[digit])*.65),0]);
  const checks=[];
  for(const side of ['left','right']){
   reset();rig.setJoint(side+'_shoulder_pitch',-90);rig.root.updateMatrixWorld(true);
   const wrist=point(side+'_wrist_roll'),thumb=point(side+'_thumb_1');
   const back=rig.root.getObjectByName(side+'_hand_back').getWorldPosition(new THREE.Vector3());
   const palm=rig.root.getObjectByName(side+'_hand_palm').getWorldPosition(new THREE.Vector3());
   checks.push({name:side+' dorsal armor is above palm',ok:back.y>palm.y+.03});
   checks.push({name:side+' thumb is on medial side',ok:side==='left'?thumb.x<wrist.x:thumb.x>wrist.x});
   for(const digit of ['index','middle','ring','little','thumb']){
    for(let n=1;n<=3;n++)rig.setJoint(`${side}_${digit}_${n}`,0);
    rig.root.updateMatrixWorld(true);const open=tip(side,digit);
    // Test every independent hinge, so reversing only MCP cannot hide a DIP bug.
    for(let hinge=1;hinge<=3;hinge++){
     for(let n=1;n<=3;n++)rig.setJoint(`${side}_${digit}_${n}`,0);
     const id=`${side}_${digit}_${hinge}`,returned=rig.setJoint(id,-55);
     rig.root.updateMatrixWorld(true);const closed=tip(side,digit);
     checks.push({name:id+' negative command curls down',ok:closed.y<open.y-.008&&returned===-55});
     checks.push({name:id+' saved command range is unchanged',ok:joints[id].min<0&&joints[id].max===10&&joints[id].axisSign===-1});
    }
    for(let n=1;n<=3;n++)rig.setJoint(`${side}_${digit}_${n}`,-50);
    rig.root.updateMatrixWorld(true);const fist=tip(side,digit);
    checks.push({name:side+' '+digit+' closes below its open tip',ok:fist.y<open.y-.015});
    for(let n=1;n<=3;n++)rig.setJoint(`${side}_${digit}_${n}`,0);
   }
  }
  // Both hands with the same flexion command must remain mirror symmetric.
  reset();for(const side of ['left','right']){rig.setJoint(side+'_shoulder_pitch',-90);for(const d of ['index','middle','ring','little','thumb'])for(let n=1;n<=3;n++)rig.setJoint(`${side}_${d}_${n}`,-45);}
  rig.root.updateMatrixWorld(true);
  for(const d of ['index','middle','ring','little','thumb']){const l=tip('left',d),r=tip('right',d);checks.push({name:d+' left/right symmetry',ok:Math.abs(l.x+r.x)<1e-8&&Math.abs(l.y-r.y)<1e-8&&Math.abs(l.z-r.z)<1e-8});}
  // Feed actual hand landmarks back through capture and verify the resulting
  // negative curl still moves the rendered fingertips toward the palm.
  const captured=[];
  for(const side of ['left','right']){
   reset();rig.setJoint(side+'_shoulder_pitch',-90);
   for(const digit of ['index','middle','ring','little']){rig.setJoint(`${side}_${digit}_1`,-25);rig.setJoint(`${side}_${digit}_2`,-70);rig.setJoint(`${side}_${digit}_3`,-30);}
   rig.setJoint(side+'_thumb_1',-45);rig.setJoint(side+'_thumb_opposition',side==='left'?35:-35);rig.root.updateMatrixWorld(true);
   const p=Array(21);p[0]=point(side+'_wrist_roll');
   for(const [digit,start]of [['index',5],['middle',9],['ring',13],['little',17]]){for(let n=1;n<=3;n++)p[start+n-1]=point(`${side}_${digit}_${n}`);p[start+3]=tip(side,digit);}
   for(let n=1;n<=3;n++)p[n]=point(`${side}_thumb_${n}`);p[4]=tip(side,'thumb');
   const world=p.map(v=>({x:v.x,y:-v.y,z:-v.z,visibility:0,presence:0}));
   const hand={worldLandmarks:[world],landmarks:[world],handednesses:[[{categoryName:side==='left'?'Left':'Right',score:.99}]]};
   const tracker=createRetargeter(rig.joints.map(({node,...j})=>({...j,speed:1440})),{mode:'hands',smoothing:0});let out;for(let i=0;i<30;i++)out=tracker.update({hand},i/30);
   const opposition=out.positions[side+'_thumb_opposition'];
   checks.push({name:side+' capture recovers finger flexion',ok:Math.abs(out.positions[side+'_index_2']+70)<1e-6});
   checks.push({name:side+' capture preserves thumb opposition side',ok:side==='left'?opposition>15:opposition<-15});
   reset();rig.setJoint(side+'_shoulder_pitch',-90);rig.root.updateMatrixWorld(true);const open=tip(side,'index');
   for(const [id,value]of Object.entries(out.positions))if(id.startsWith(side+'_')&&joints[id].group.endsWith('hand'))rig.setJoint(id,value);
   rig.root.updateMatrixWorld(true);const closed=tip(side,'index');checks.push({name:side+' captured flexion renders downward',ok:closed.y<open.y-.03});captured.push({side,opposition,curl:out.positions[side+'_index_2']});
  }
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks,captured};
 });
 assert.deepEqual(result.checks.filter(c=>!c.ok),[]);
 return {pass:result.checks.length,captured:result.captured};
}
if(process.argv[1]?.endsWith('robot_lab_hands.mjs')) {
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS robot hand geometry',await runRobotHandChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
