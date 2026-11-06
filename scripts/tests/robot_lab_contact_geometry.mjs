// Contact metadata must describe visible surfaces, not joint or palm midplanes.
// These fixed reachable poses use the actual Three.js rig and existing limits;
// human-to-robot contact tracking is tested separately in contact_browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

export async function runRobotContactGeometryChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{createRobot}=await import('./robot.js');
  const rig=createRobot(),joints=Object.fromEntries(rig.joints.map(j=>[j.id,j]));
  const vector=a=>new THREE.Vector3(...a),point=(id,p)=>joints[id].node.localToWorld(vector(p));
  const set=values=>{for(const joint of rig.joints)rig.setJoint(joint.id,values[joint.id]??0);rig.root.updateMatrixWorld(true);};
  const failures=[],measurements=[];let checks=0;
  const check=(name,ok,detail={})=>{checks++;if(!ok)failures.push({name,...detail});};
  const head=joints.neck_roll.node.children.find(node=>node.isMesh);
  head.geometry.computeBoundingBox();const headBounds=head.geometry.boundingBox;
  const leftPoses={
   prayer:{shoulder_pitch:-42.71076306400299,shoulder_roll:1.2792130464595746,shoulder_yaw:-60.753732131897294,elbow_pitch:-98.20297903531892,forearm_yaw:78.16354447534982,wrist_pitch:-60.06256766400272,wrist_roll:-32.97745637501175},
   crown:{shoulder_pitch:-169.8222296929686,shoulder_roll:12.609974093985366,shoulder_yaw:-76.45579173959587,elbow_pitch:-87.47236681610032,forearm_yaw:172.7027826710372,wrist_pitch:17.001795672865523,wrist_roll:11.167539735673373},
  };
  const poseFor=(side,kind)=>Object.fromEntries(Object.entries(leftPoses[kind]).map(([suffix,value])=>{const id=side+'_'+suffix;return [id,value*(side==='right'&&joints[id].axis!=='x'?-1:1)];}));
  for(const side of ['left','right']){
   const g=joints[side+'_shoulder_pitch'].retarget,pad=rig.root.getObjectByName(side+'_hand_palm');
   pad.geometry.computeBoundingBox();const padBounds=pad.geometry.boundingBox.clone().translate(pad.position),halfSize=padBounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
   check('crown metadata matches rendered shell',Math.abs(g.headTop-headBounds.max.y)<1e-7,{side});
   check('palm surface matches rubber contact face',vector(g.palmSurface).distanceTo(new THREE.Vector3(pad.position.x,pad.position.y,padBounds.min.z))<1e-7,{side});
   check('palm extent metadata matches rubber mesh',vector(g.palmHalfSize).distanceTo(halfSize)<1e-7,{side});
   check('contact point remains distinct from palm midplane',vector(g.palmSurface).distanceTo(vector(g.palmOffset))>.027,{side});
   const back=rig.root.getObjectByName(side+'_hand_back');back.geometry.computeBoundingBox();
   check('back contact matches dorsal armor surface',vector(g.palmBack).distanceTo(new THREE.Vector3(back.position.x,back.position.y,back.position.z+back.geometry.boundingBox.max.z))<1e-7,{side});
   // Reconstruct landmark centers using only the contact metadata, then compare
   // against the rendered hierarchy through flexion and thumb opposition.
   for(const closed of [false,true]){
    const pose={torso_yaw:25,torso_roll:8,[side+'_shoulder_pitch']:-70,[side+'_shoulder_yaw']:35,[side+'_elbow_pitch']:-60,[side+'_forearm_yaw']:135};
    for(const digit of Object.keys(g.handDigits))for(let i=1;i<=3;i++)pose[`${side}_${digit}_${i}`]=closed?[-25,-55,-35][i-1]:0;
    pose[side+'_thumb_opposition']=closed?(side==='left'?40:-40):0;set(pose);
    for(const [name,digit]of Object.entries(g.handDigits)){
     const transform=joints[side+'_wrist_roll'].node.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(...digit.base));
     if(digit.mountRoll)transform.multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(digit.mountRoll)));
     if(digit.opposition)transform.multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(pose[side+'_thumb_opposition']*digit.oppositionAxisSign)));
     const expectedFirst={thumb:1,index:5,middle:9,ring:13,little:17}[name];
     check('finger metadata uses matching detector landmarks',digit.landmarks.every((id,i)=>id===expectedFirst+i),{side,name});
     for(let i=0;i<3;i++){
      const id=`${side}_${name}_${i+1}`,actual=joints[id].node.getWorldPosition(new THREE.Vector3()),expected=vector([0,0,0]).applyMatrix4(transform);
      check('finger metadata reproduces actual articulated base',actual.distanceTo(expected)<1e-7,{side,name,closed,index:i,error:actual.distanceTo(expected)});
      check('finger metadata preserves public angle sign',digit.axisSign===joints[id].axisSign,{side,name,index:i});
      transform.multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(pose[id]*digit.axisSign))).multiply(new THREE.Matrix4().makeTranslation(0,-digit.lengths[i],0));
     }
     const id=`${side}_${name}_3`,tip=point(id,[0,-digit.lengths[2],0]),expected=vector([0,0,0]).applyMatrix4(transform);
     check('finger metadata reproduces actual fingertip landmark',tip.distanceTo(expected)<1e-7,{side,name,closed,error:tip.distanceTo(expected)});
     const end=joints[id].node.children.find(node=>node.isMesh&&node.geometry.type==='ExtrudeGeometry');end.geometry.computeBoundingBox();
     const surface=point(id,[0,end.position.y+end.geometry.boundingBox.min.y,0]),expectedSurface=vector([0,digit.tipInset,0]).applyMatrix4(transform);
     check('finger metadata reproduces visible tip surface',surface.distanceTo(expectedSurface)<1e-7,{side,name,closed,error:surface.distanceTo(expectedSurface)});
    }
   }
   for(const kind of ['prayer','crown'])for(const torso of [{},{torso_yaw:32,torso_pitch:12,torso_roll:-8}]){
    const pose=poseFor(side,kind);
    check('contact pose stays within current working range',Object.entries(pose).every(([id,value])=>value>=joints[id].min&&value<=joints[id].max),{side,kind});
    set({...pose,...torso});
    const actual=point(side+'_wrist_roll',g.palmSurface),target=kind==='crown'?point('neck_roll',[0,.115+g.headTop,0]):point('torso_roll',[0,.315,.27]);
    const palmNormal=vector([0,0,-1]).transformDirection(joints[side+'_wrist_roll'].node.matrixWorld),targetNormal=vector(kind==='crown'?[0,-1,0]:[side==='left'?-1:1,0,0]).transformDirection(joints.torso_roll.node.matrixWorld);
    const detail={side,kind,torso,target:target.toArray(),actual:actual.toArray(),error:actual.distanceTo(target),normalError:palmNormal.distanceTo(targetNormal)};measurements.push(detail);
    check('reachable palm surface touches intended target',detail.error<1e-7,detail);
    check('contacting palm faces target surface',detail.normalError<1e-7,detail);
    if(kind==='crown'){
     // In head-local coordinates the palm contact face equals the top shell
     // plane, so a bounding box rotated with the torso cannot hide a gap.
     const local=joints.neck_roll.node.worldToLocal(actual.clone());
     check('crown contact has no vertical gap',Math.abs(local.y-(head.position.y+headBounds.max.y))<1e-7,detail);
    }
   }
  }
  set({...poseFor('left','prayer'),...poseFor('right','prayer')});
  const left=point('left_wrist_roll',joints.left_shoulder_pitch.retarget.palmSurface),right=point('right_wrist_roll',joints.right_shoulder_pitch.retarget.palmSurface);
  check('both palms can meet simultaneously',left.distanceTo(right)<1e-7,{gap:left.distanceTo(right)});
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks,failures,measurements};
 });
 if(process.env.ROBOT_CONTACT_GEOMETRY_REPORT)await writeFile(process.env.ROBOT_CONTACT_GEOMETRY_REPORT,JSON.stringify(result,null,2));
 assert.deepEqual(result.failures,[],JSON.stringify(result.failures.slice(0,8),null,2));
 return {checks:result.checks,cases:result.measurements.length,maxError:Math.max(...result.measurements.map(row=>row.error))};
}
if(process.argv[1]?.endsWith('robot_lab_contact_geometry.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS actual-rig contact geometry',await runRobotContactGeometryChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
