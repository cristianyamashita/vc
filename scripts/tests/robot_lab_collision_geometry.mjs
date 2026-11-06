// Collision metadata versus the actual rendered hierarchy. This independently
// checks frame composition, articulation, shape extents and the tapered chest.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

export async function runRobotCollisionGeometryChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{createRobot}=await import('./robot.js');
  const rig=createRobot(),joints=Object.fromEntries(rig.joints.map(j=>[j.id,j])),model=joints.torso_yaw.collision;
  const failures=[];let checks=0;const check=(name,ok,detail={})=>{checks++;if(!ok)failures.push({name,...detail});};
  const meshes=new Map();rig.root.traverse(node=>{if(node.userData.collisionId)meshes.set(node.userData.collisionId,node);});
  const colliders=[...model.obstacles,...model.parts],one=new THREE.Vector3(1,1,1),matrix=(position,quaternion)=>new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion(...quaternion),one);
  const matrixError=(a,b)=>Math.max(...a.elements.map((value,i)=>Math.abs(value-b.elements[i])));
  const poses=[{},Object.fromEntries(rig.joints.map((j,i)=>[j.id,j.min+(j.max-j.min)*(.25+(i%5)*.12)]))];
  let maxFrameError=0,maxColliderError=0;
  for(const [poseIndex,pose]of poses.entries()){
   rig.joints.forEach(j=>rig.setJoint(j.id,pose[j.id]??0));rig.root.updateMatrixWorld(true);
   const frames=new Map();
   for(const frame of model.frames){
    const world=frame.parent?frames.get(frame.parent).clone():new THREE.Matrix4();
    world.multiply(matrix(frame.position,frame.quaternion));
    const axis=new THREE.Vector3();axis[frame.axis]=1;
    world.multiply(new THREE.Matrix4().makeRotationAxis(axis,THREE.MathUtils.degToRad((pose[frame.id]??0)*frame.axisSign)));frames.set(frame.id,world);
    const error=matrixError(world,joints[frame.id].node.matrixWorld);maxFrameError=Math.max(maxFrameError,error);
    check('collision frame follows rendered joint',error<1e-7,{poseIndex,id:frame.id,error});
   }
   for(const collider of colliders){
    const expected=(collider.frame?frames.get(collider.frame).clone():new THREE.Matrix4()).multiply(matrix(collider.center,collider.quaternion)),actual=meshes.get(collider.id);
    check('collision shape has an actual mesh',!!actual,{id:collider.id});if(!actual)continue;
    const error=matrixError(expected,actual.matrixWorld);maxColliderError=Math.max(maxColliderError,error);
    check('collision shape follows actual articulated mesh',error<1e-7,{poseIndex,id:collider.id,error});
   }
  }
  for(const collider of colliders){
   const mesh=meshes.get(collider.id),shape=collider.shape;mesh.geometry.computeBoundingBox();
   const bounds=mesh.geometry.boundingBox,half=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
   if(shape.type==='roundedBox')check('box dimensions come from actual mesh',half.distanceTo(new THREE.Vector3(...shape.halfSize))<1e-7,{id:collider.id,actual:half.toArray(),declared:shape.halfSize});
   else if(shape.type==='sphere')check('sphere radius comes from actual mesh',Math.abs(half.y-shape.radius)<1e-7,{id:collider.id});
   else if(shape.type==='cylinder')check('cylinder dimensions come from actual mesh',half.distanceTo(new THREE.Vector3(shape.radius,shape.halfLength,shape.radius))<1e-7&&shape.axis==='y',{id:collider.id});
   else if(shape.type==='convex'){
    check('convex volume includes each rendered vertex',shape.vertices.every(vertex=>shape.planes.every(plane=>plane.normal.reduce((sum,n,i)=>sum+n*vertex[i],plane.constant)<=1e-6)),{id:collider.id});
    const inside=point=>shape.planes.every(plane=>plane.normal.reduce((sum,n,i)=>sum+n*point[i],plane.constant)<=1e-7);
    check('tapered chest retains empty space beside waist',inside([0,0,0])&&!inside([.19,-.09,0])&&!inside([-.19,-.09,0]),{id:collider.id});
   }else check('collision primitive is supported',false,{id:collider.id,type:shape.type});
  }
  check('natural rest is separate from scripted joint homes',model.neutral.left_shoulder_roll===8&&model.neutral.right_shoulder_roll===-8&&rig.joints.every(j=>j.home===0));
  for(const side of ['left','right'])for(const suffix of ['hip_pitch','knee_pitch','ankle_roll'])check('leg obstacles cover armor along the entire leg',model.obstacles.some(c=>c.role==='leg'&&c.frame===side+'_'+suffix),{side,suffix});
  check('fixed pelvis does not inherit torso motion',model.obstacles.some(c=>c.role==='pelvis')&&model.obstacles.filter(c=>c.role==='pelvis').every(c=>c.frame===null));
  check('head colliders inherit actual neck articulation',model.obstacles.filter(c=>c.role==='head').every(c=>c.frame==='neck_roll'));
  check('mounted shoulder sockets are excluded',model.parts.every(c=>!c.frame.endsWith('_shoulder_pitch')&&!c.frame.endsWith('_shoulder_roll')));
  check('upper-arm attachment exclusion applies only to torso',model.parts.filter(c=>c.role==='upperArm').every(c=>c.clip?.axis==='y'&&c.clip.max===-.11&&c.clip.space==='frame'&&c.clip.obstacleRoles?.length===1&&c.clip.obstacleRoles[0]==='torso'));
  for(const side of ['left','right']){
   for(const role of ['upperArm','elbow','forearm','wrist','palm','finger'])check('arm and hand collision coverage',model.parts.some(c=>c.side===side&&c.role===role),{side,role});
   for(const name of ['index','middle','ring','little','thumb'])for(let i=1;i<=3;i++)check('every finger segment has a collision primitive',model.parts.some(c=>c.frame===`${side}_${name}_${i}`),{side,name,segment:i});
  }
  const serialized=JSON.stringify(model);check('collision metadata is serializable without Three nodes',JSON.parse(serialized).frames.length===rig.joints.length);
  const materials=new Set();rig.root.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());
  return {checks,failures,frames:model.frames.length,obstacles:model.obstacles.length,parts:model.parts.length,bytes:serialized.length,maxFrameError,maxColliderError};
 });
 if(process.env.ROBOT_COLLISION_GEOMETRY_REPORT)await writeFile(process.env.ROBOT_COLLISION_GEOMETRY_REPORT,JSON.stringify(result,null,2));
 assert.deepEqual(result.failures,[],JSON.stringify(result.failures.slice(0,8),null,2));
 return result;
}
if(process.argv[1]?.endsWith('robot_lab_collision_geometry.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log('PASS collision geometry metadata',await runRobotCollisionGeometryChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
