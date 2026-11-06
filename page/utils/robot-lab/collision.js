/** Kinematic self-collision guard. Geometry and fixed frames come from the rig.
 * The guard protects free arm/hand volumes against the head, trunk and legs;
 * mounting sockets are explicitly excluded by the rig's clipped colliders.
 * No browser, renderer or persistent state is required.
 */
const RAD=Math.PI/180,TOLERANCE=.0008;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>Math.hypot(...a);
const identity=[0,0,0,1],origin=[0,0,0],axes={x:0,y:1,z:2};
function multiply(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
function rotate(v,q){const [x,y,z]=v,[qx,qy,qz,qw]=q,tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);return [x+qw*tx+qy*tz-qz*ty,y+qw*ty+qz*tx-qx*tz,z+qw*tz+qx*ty-qy*tx];}
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
function axisRotation(axis,degrees){const a=degrees*RAD/2,q=[0,0,0,Math.cos(a)];q[axes[axis]]=Math.sin(a);return q;}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const size=norm(a);return size>1e-9?a.map(v=>v/size):null;};
function fitAngle(value,joint,reference){let best=null;for(const turn of [-720,-360,0,360,720]){const v=value+turn;if(v<joint.min-1e-7||v>joint.max+1e-7)continue;if(best==null||Math.abs(v-reference)<Math.abs(best-reference))best=v;}return best;}
function signedDistance(p,shape){
 if(shape.type==='sphere')return norm(p)-shape.radius;
 if(shape.type==='roundedBox'){
  const radius=shape.radius||0,q=p.map((v,i)=>Math.abs(v)-shape.halfSize[i]+radius);
  return Math.hypot(...q.map(v=>Math.max(0,v)))+Math.min(0,Math.max(...q))-radius;
 }
 if(shape.type==='cylinder'||shape.type==='capsule'){
  const axis=axes[shape.axis||'y'],along=Math.abs(p[axis])-(shape.halfLength||0),radial=Math.hypot(...p.filter((_,i)=>i!==axis));
  if(shape.type==='capsule')return Math.hypot(radial,Math.max(0,along))-shape.radius;
  const outside=radial-shape.radius;return Math.hypot(Math.max(0,outside),Math.max(0,along))+Math.min(0,Math.max(outside,along));
 }
 if(shape.type==='convex'){
  let distance=-Infinity;for(const plane of shape.planes||[]){const d=dot(p,plane.normal)+plane.constant;if(d>0)return d;distance=Math.max(distance,d);}return distance;
 }
 return Infinity;
}
function distanceFunction(shape){
 if(shape.type==='roundedBox'){const r=shape.radius||0,[hx,hy,hz]=shape.halfSize;return (x,y,z)=>{const a=Math.abs(x)-hx+r,b=Math.abs(y)-hy+r,c=Math.abs(z)-hz+r;return Math.hypot(Math.max(0,a),Math.max(0,b),Math.max(0,c))+Math.min(0,Math.max(a,b,c))-r;};}
 if(shape.type==='sphere')return (x,y,z)=>Math.hypot(x,y,z)-shape.radius;
 if(shape.type==='cylinder'||shape.type==='capsule'){const axis=shape.axis||'y',half=shape.halfLength||0,r=shape.radius,capsule=shape.type==='capsule';return (x,y,z)=>{const along=Math.abs(axis==='x'?x:axis==='z'?z:y)-half,radial=axis==='x'?Math.hypot(y,z):axis==='z'?Math.hypot(x,y):Math.hypot(x,z);if(capsule)return Math.hypot(radial,Math.max(0,along))-r;const side=radial-r;return Math.hypot(Math.max(0,side),Math.max(0,along))+Math.min(0,Math.max(side,along));};}
 if(shape.type==='convex'){const planes=(shape.planes||[]).flatMap(p=>[...p.normal,p.constant]);return (x,y,z)=>{let maximum=-Infinity;for(let i=0;i<planes.length;i+=4){const d=x*planes[i]+y*planes[i+1]+z*planes[i+2]+planes[i+3];if(d>0)return d;if(d>maximum)maximum=d;}return maximum;};}
 return ()=>Infinity;
}
function shapeRadius(shape){
 if(shape.type==='roundedBox')return norm(shape.halfSize);
 if(shape.type==='sphere')return shape.radius;
 if(shape.type==='cylinder')return Math.hypot(shape.radius,shape.halfLength||0);
 if(shape.type==='capsule')return shape.radius+(shape.halfLength||0);
 return Math.max(0,...(shape.vertices||[]).map(norm));
}
function shapeSamples(shape){
 const points=[origin],push=p=>points.push(p);
 if(shape.type==='roundedBox'){
  const h=shape.halfSize,r=shape.radius||0,inner=h.map(v=>Math.max(0,v-r));
  const values=half=>{const n=Math.max(2,Math.min(8,Math.ceil(half*2/.025)));return Array.from({length:n+1},(_,i)=>-half+half*2*i/n);};
  for(let axis=0;axis<3;axis++){const other=[0,1,2].filter(i=>i!==axis);for(const sign of [-1,1])for(const a of values(h[other[0]]))for(const b of values(h[other[1]])){
   const p=[0,0,0];p[axis]=sign*h[axis];p[other[0]]=a;p[other[1]]=b;
   const center=p.map((v,i)=>clamp(v,-inner[i],inner[i])),delta=sub(p,center),size=norm(delta);push(size?center.map((v,i)=>v+delta[i]*r/size):p);
  }}
  // Interior samples catch an obstacle entering through a broad face while
  // its intersection misses all surface-grid vertices.
  const axis=h.indexOf(Math.max(...h));for(let i=0;i<=8;i++){const p=[0,0,0];p[axis]=-h[axis]+h[axis]*i/4;push(p);}
 }else if(shape.type==='sphere'){
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z){const n=Math.hypot(x,y,z);push([x,y,z].map(v=>v*shape.radius/n));}
 }else if(shape.type==='cylinder'||shape.type==='capsule'){
  const axis=axes[shape.axis||'y'],other=[0,1,2].filter(i=>i!==axis),half=shape.halfLength||0;
  for(let row=0;row<=4;row++)for(let i=0;i<12;i++){const p=[0,0,0];p[axis]=-half+half*row/2;p[other[0]]=shape.radius*Math.cos(i*Math.PI/6);p[other[1]]=shape.radius*Math.sin(i*Math.PI/6);push(p);}
  for(const sign of [-1,1]){const p=[0,0,0];p[axis]=sign*(half+(shape.type==='capsule'?shape.radius:0));push(p);}
 }else if(shape.type==='convex')points.push(...(shape.vertices||[]));
 const unique=new Map();for(const p of points)unique.set(p.map(v=>Math.round(v*1e6)).join(','),p);return [...unique.values()];
}
function compileModel(model){
 if(!model?.frames?.length||!model.obstacles?.length||!model.parts?.length)return null;
 const remaining=new Map(model.frames.map(frame=>[frame.id,frame])),frames=[],indices=new Map();
 while(remaining.size){let progress=false;for(const [id,f]of remaining)if(!f.parent||indices.has(f.parent)){indices.set(id,frames.length);frames.push({...f,parentIndex:f.parent?indices.get(f.parent):-1,position:f.position||origin,quaternion:f.quaternion||identity});remaining.delete(id);progress=true;}if(!progress)return null;}
 const collider=c=>({...c,index:c.frame?indices.get(c.frame):-1,center:c.center||origin,quaternion:c.quaternion||identity,radius:shapeRadius(c.shape),distance:distanceFunction(c.shape)});
 const parts=model.parts.map(collider).map(part=>{
  const samples=shapeSamples(part.shape).map(p=>add(part.center,rotate(p,part.quaternion)));let clippedSamples;
  if(part.clip?.space==='frame'){const i=axes[part.clip.axis];clippedSamples=samples.filter(p=>(part.clip.min==null||p[i]>=part.clip.min)&&(part.clip.max==null||p[i]<=part.clip.max));}
  const joints=[];let index=part.index;while(index>=0){const f=frames[index],id=f.joint||f.id;if(f.axis&&id.startsWith(part.side+'_')&&!/(hip|knee|ankle)/.test(id))joints.push(id);index=f.parentIndex;}
  return {...part,samples,clippedSamples,joints};
 }).filter(part=>part.samples.length);
 return {frames,parts,obstacles:model.obstacles.map(collider),indices,neutral:model.neutral||{}};
}
function transforms(model,pose){
 const positions=[],rotations=[];for(const frame of model.frames){const parentQ=frame.parentIndex>=0?rotations[frame.parentIndex]:identity,parentP=frame.parentIndex>=0?positions[frame.parentIndex]:origin;let local=frame.quaternion;
  if(frame.axis){const angle=(pose[frame.joint||frame.id]||0)*(frame.axisSign??1)*RAD/2,q=[0,0,0,Math.cos(angle)];q[axes[frame.axis]]=Math.sin(angle);local=multiply(local,q);}
  rotations.push(multiply(parentQ,local));positions.push(add(parentP,rotate(frame.position,parentQ)));
 }
 return {positions,rotations};
}
function inspectPose(model,pose,tolerance=TOLERANCE){
 const world=transforms(model,pose),collisions=[];let maxPenetration=0,energy=0;
 const obstacles=model.obstacles.map(c=>{const q=c.index>=0?world.rotations[c.index]:identity,p=c.index>=0?world.positions[c.index]:origin,orientation=multiply(q,c.quaternion);return {...c,position:add(p,rotate(c.center,q)),orientation,inverse:inverse(orientation)};});
 for(const part of model.parts){const q=part.index>=0?world.rotations[part.index]:identity,p=part.index>=0?world.positions[part.index]:origin,center=add(p,rotate(part.center,q));
  for(const obstacle of obstacles){const dx=center[0]-obstacle.position[0],dy=center[1]-obstacle.position[1],dz=center[2]-obstacle.position[2],radius=part.radius+obstacle.radius+tolerance;if(dx*dx+dy*dy+dz*dz>radius*radius)continue;
   const points=part.clippedSamples&&(part.clip.obstacleRoles||['torso']).includes(obstacle.role)?part.clippedSamples:part.samples,relative=multiply(obstacle.inverse,q),translation=rotate(sub(p,obstacle.position),obstacle.inverse),[x,y,z,w]=relative;
   const a=1-2*(y*y+z*z),b=2*(x*y-w*z),c=2*(x*z+w*y),d=2*(x*y+w*z),e=1-2*(x*x+z*z),f=2*(y*z-w*x),g=2*(x*z-w*y),h=2*(y*z+w*x),j=1-2*(x*x+y*y);let depth=0,deepX=0,deepY=0,deepZ=0;
   for(const sample of points){const sx=sample[0],sy=sample[1],sz=sample[2],px=a*sx+b*sy+c*sz+translation[0],py=d*sx+e*sy+f*sz+translation[1],pz=g*sx+h*sy+j*sz+translation[2],inside=-obstacle.distance(px,py,pz);if(inside>depth){depth=inside;deepX=px;deepY=py;deepZ=pz;}}
   if(depth>tolerance){const contact={part:part.id,obstacle:obstacle.id,obstacleRole:obstacle.role,side:part.side,role:part.role,depth,joints:part.joints};
    if(depth<.025&&['palm','finger','wrist'].includes(part.role)){const px=deepX,py=deepY,pz=deepZ,epsilon=.0001,gradient=[obstacle.distance(px+epsilon,py,pz)-obstacle.distance(px-epsilon,py,pz),obstacle.distance(px,py+epsilon,pz)-obstacle.distance(px,py-epsilon,pz),obstacle.distance(px,py,pz+epsilon)-obstacle.distance(px,py,pz-epsilon)],normal=unit(gradient);if(normal){contact.normal=rotate(normal,obstacle.orientation);contact.point=add(obstacle.position,rotate([deepX,deepY,deepZ],obstacle.orientation));}}
    collisions.push(contact);const excess=depth-tolerance;energy+=excess*excess;maxPenetration=Math.max(maxPenetration,depth);}
  }
 }
 return {collisions,maxPenetration,energy,world,safe:collisions.length===0};
}
function swivelCandidates(model,pose,side,definitions,goal={}){
 const world=transforms(model,pose),index=id=>model.indices.get(side+'_'+id),s=index('shoulder_pitch'),e=index('elbow_pitch'),w=index('wrist_roll');if([s,e,w].some(i=>i==null))return [];
 const parent=model.frames[s].parentIndex,parentQ=parent>=0?world.rotations[parent]:identity,inv=inverse(parentQ),shoulder=world.positions[s],upper=rotate(sub(world.positions[e],shoulder),inv),toward=rotate(sub(goal.wrist||world.positions[w],shoulder),inv),lower=rotate(sub(world.positions[w],world.positions[e]),inv),length1=norm(upper),length2=norm(lower),distance=norm(toward),direction=unit(toward);if(!direction||distance<1e-5||distance>=length1+length2||distance<=Math.abs(length1-length2))return [];
 const projection=dot(upper,direction),pole=unit(sub(upper,direction.map(v=>v*projection)));if(!pole)return [];
 const around=cross(direction,pole),along=(length1*length1+distance*distance-length2*length2)/(2*distance),height=Math.sqrt(Math.max(0,length1*length1-along*along)),elbow=-Math.acos(clamp((distance*distance-length1*length1-length2*length2)/(2*length1*length2),-1,1))/RAD,hand=multiply(inv,goal.hand||world.rotations[w]),results=[];
 const joint=id=>definitions.get(side+'_'+id),value=id=>pose[side+'_'+id]||0;
 if(!joint('elbow_pitch')||elbow<joint('elbow_pitch').min-1e-7||elbow>joint('elbow_pitch').max+1e-7)return [];
 for(let degrees=0;degrees<=180;degrees+=5)for(const sign of degrees?[-1,1]:[1]){
  const a=degrees*sign*RAD,u=direction.map((v,i)=>v*along+(pole[i]*Math.cos(a)+around[i]*Math.sin(a))*height),l=sub(toward,u),d=unit(u),first=Math.asin(clamp(d[0],-1,1))/RAD;
  for(const roll0 of [first,side==='left'?180-first:-180-first]){
   const c=Math.cos(roll0*RAD),pitch0=Math.hypot(d[1],d[2])<1e-7?value('shoulder_pitch'):Math.atan2(-d[2]/(c||1e-9),-d[1]/(c||1e-9))/RAD,pitch=fitAngle(pitch0,joint('shoulder_pitch'),value('shoulder_pitch')),roll=fitAngle(roll0,joint('shoulder_roll'),value('shoulder_roll'));if(pitch==null||roll==null)continue;
   const local=rotate(rotate(l,axisRotation('x',-pitch)),axisRotation('z',-roll)),yaw0=Math.hypot(local[0],local[2])<1e-8?value('shoulder_yaw'):Math.atan2(local[0],local[2])/RAD,yaw=fitAngle(yaw0,joint('shoulder_yaw'),value('shoulder_yaw'));if(yaw==null)continue;
   const arm=multiply(multiply(multiply(axisRotation('x',pitch),axisRotation('z',roll)),axisRotation('y',yaw)),axisRotation('x',elbow)),relative=multiply(inverse(arm),hand),x=rotate([1,0,0],relative),y=rotate([0,1,0],relative),z=rotate([0,0,1],relative),wp=-Math.asin(clamp(z[1],-1,1))/RAD,fy=Math.atan2(z[0],z[2])/RAD,wr=Math.atan2(x[1],y[1])/RAD;
   for(const [f0,p0,r0]of [[fy,wp,wr],[fy+180,wp>=0?180-wp:-180-wp,wr+180]]){
    const f=fitAngle(f0,joint('forearm_yaw'),value('forearm_yaw')),p=fitAngle(p0,joint('wrist_pitch'),value('wrist_pitch')),r=fitAngle(r0,joint('wrist_roll'),value('wrist_roll'));if(f==null||p==null||r==null)continue;
    const candidate={...pose};for(const [id,v]of [['shoulder_pitch',pitch],['shoulder_roll',roll],['shoulder_yaw',yaw],['elbow_pitch',elbow],['forearm_yaw',f],['wrist_pitch',p],['wrist_roll',r]])candidate[side+'_'+id]=v;results.push(candidate);
   }
  }
 }
 return results;
}
/** Guard all pose entry points, including interpolated/captured poses.
 * continuous=true keeps correction/recovery steps bounded across video frames.
 * A direct safe manual/seek pose can be accepted immediately.
 */
export function createCollisionGuard(joints){
 let definitions=new Map(),model=null,sourceModel=null,lastSafe=null,recovering=false;
 const sanitize=pose=>Object.fromEntries([...definitions].map(([id,j])=>[id,clamp(Number.isFinite(pose?.[id])?pose[id]:j.home??0,j.min,j.max)]));
 const configure=next=>{definitions=new Map(next.map(j=>[j.id,j]));const source=next.find(j=>j.collision)?.collision;if(source!==sourceModel){sourceModel=source;model=compileModel(source);lastSafe=null;recovering=false;}return !!model;};
 const reset=initial=>{recovering=false;lastSafe=null;if(model){const pose=sanitize(initial??model.neutral);if(inspectPose(model,pose).safe)lastSafe=pose;}};
 configure(joints);reset();
 function solve(input,options={}){
  if(options.joints)configure(options.joints);const requested=sanitize(input);
  if(!model)return {positions:null,adjusted:false,adjustedJoints:[],blocked:true,safe:false,collisions:[],maxPenetration:0,iterations:0,reason:'geometry'};
  let evaluations=0;const evaluate=pose=>{evaluations++;return inspectPose(model,pose);},original=evaluate(requested),continuous=!!options.continuous;let reference=lastSafe&&sanitize(lastSafe);if(reference&&Object.keys(reference).some(id=>reference[id]!==lastSafe[id]))reference=null;
  let target=requested;
  const referenceWorld=reference&&transforms(model,reference),wristIndices=['left','right'].map(side=>model.indices.get(side+'_wrist_roll')).filter(i=>i!=null);
  if(continuous&&recovering&&reference){let ratio=1;for(const id of definitions.keys())if(/^(left|right)_/.test(id)&&!/(hip|knee|ankle)/.test(id))ratio=Math.min(ratio,10/Math.max(10,Math.abs(requested[id]-reference[id])));for(const index of wristIndices)ratio=Math.min(ratio,.065/Math.max(.065,norm(sub(original.world.positions[index],referenceWorld.positions[index]))));if(ratio<1)target=Object.fromEntries(Object.entries(requested).map(([id,v])=>[id,/^(left|right)_/.test(id)&&!/(hip|knee|ankle)/.test(id)?reference[id]+(v-reference[id])*ratio:v]));}
  const initial=target===requested?original:evaluate(target);
  const finish=(positions,result,blocked=false)=>{
   if(continuous&&reference&&positions&&(recovering||!original.safe||blocked)){const indices=[...wristIndices,...['left','right'].map(side=>model.indices.get(side+'_elbow_pitch')).filter(i=>i!=null)];let ratio=1;for(const index of indices)ratio=Math.min(ratio,.075/Math.max(.075,norm(sub(result.world.positions[index],referenceWorld.positions[index]))));
    if(ratio<1){let bounded;for(let attempt=0;attempt<7;attempt++){const candidate=Object.fromEntries(Object.entries(positions).map(([id,v])=>[id,reference[id]+(v-reference[id])*ratio])),checked=evaluate(candidate);if(checked.safe){bounded={candidate,checked};break;}ratio*=.5;}if(bounded){positions=bounded.candidate;result=bounded.checked;}else{positions=reference;result=evaluate(reference);blocked=true;}}
   }
   const adjustedJoints=positions?Object.keys(positions).filter(id=>Math.abs(positions[id]-requested[id])>.001):[];if(positions&&result.safe)lastSafe={...positions};recovering=!!positions&&adjustedJoints.length>0;
   return {positions:positions&&{...positions},adjusted:adjustedJoints.length>0,adjustedJoints,blocked,safe:!!positions&&result.safe,collisions:result.collisions,maxPenetration:result.maxPenetration,requestedPenetration:original.maxPenetration,iterations:evaluations};};
  if(continuous&&recovering&&reference&&original.safe){
   const routeCost=pose=>{let energy=0,sides=new Set();for(const t of [.25,.5,.75]){const sample=Object.fromEntries(Object.entries(requested).map(([id,v])=>[id,pose[id]+(v-pose[id])*t])),result=evaluate(sample);energy+=result.energy;for(const collision of result.collisions)sides.add(collision.side);}return {energy,sides};},path=routeCost(reference);
   if(path.energy>0){let route;
    for(const [rollStep,elbowStep,pitchStep]of [[10,10,0],[10,0,0],[0,10,0],[10,10,10],[0,10,10]]){const candidate={...reference};let change=0;for(const side of path.sides)for(const [suffix,delta]of [['shoulder_roll',(side==='left'?1:-1)*rollStep],['elbow_pitch',elbowStep],['shoulder_pitch',-Math.sign(reference[side+'_shoulder_pitch']||0)*pitchStep]]){const id=side+'_'+suffix,j=definitions.get(id);if(!j)continue;candidate[id]=clamp(candidate[id]+delta,j.min,j.max);change+=Math.abs(candidate[id]-reference[id]);}if(change<.01)continue;const checked=evaluate(candidate);if(!checked.safe)continue;const cost=routeCost(candidate).energy;if(!route||cost<route.cost)route={candidate,checked,cost};}
    if(route)return finish(route.candidate,route.checked);
   }
  }
  if(initial.safe)return finish(target,initial);
  const affected=new Set(initial.collisions.map(c=>c.side)),active=new Set();for(const collision of initial.collisions)for(const id of collision.joints)active.add(id);
  // Link rotations clear most collisions without changing a captured grasp.
  const priority=id=>/_shoulder_|_elbow_/.test(id)?0:/_forearm_|_wrist_/.test(id)?1:2,variables=[...active].filter(id=>definitions.has(id)&&definitions.get(id).max>definitions.get(id).min).sort((a,b)=>priority(a)-priority(b)).slice(0,24);
  const deviation=(pose,result)=>{let cost=0;for(const id of variables){const weight=priority(id)===2?.008:.02;cost+=(pose[id]-requested[id])**2*weight;if(continuous&&reference)cost+=(pose[id]-reference[id])**2*.025;}for(const index of wristIndices){const difference=norm(sub(result.world.positions[index],original.world.positions[index]));cost+=difference*difference*1e5;const qa=result.world.rotations[index],qb=original.world.rotations[index],angle=2*Math.acos(clamp(Math.abs(qa.reduce((n,v,i)=>n+v*qb[i],0)),-1,1))/RAD;cost+=angle*angle*.08;if(continuous&&referenceWorld)cost+=norm(sub(result.world.positions[index],referenceWorld.positions[index]))**2*1e4;}return cost;};
  let bestSafe=null,bestSafeResult=null,bestSafeCost=Infinity,best={pose:target,result:initial,cost:initial.energy*1e8+deviation(target,initial)};
  const consider=pose=>{const result=evaluate(pose),distance=deviation(pose,result),cost=result.energy*1e8+distance;if(result.safe&&distance<bestSafeCost){bestSafe=pose;bestSafeResult=result;bestSafeCost=distance;}if(cost<best.cost)best={pose,result,cost};return {pose,result,cost};};
  if(reference){const warm={...target};for(const id of variables)warm[id]=reference[id];consider(warm);}
  // First move the elbow around the shoulder-to-wrist axis. This redundant
  // degree of freedom can clear the torso while keeping both the wrist and
  // palm orientation exactly fixed, preserving hand/head and hand/hand touch.
  let swivelPose=target;
  for(const side of affected){
   const handCollisions=initial.collisions.filter(c=>c.side===side&&['palm','finger','wrist'].includes(c.role)),world=transforms(model,swivelPose),wristIndex=model.indices.get(side+'_wrist_roll'),goals=[];
   if(handCollisions.length){
    const contact=handCollisions.filter(c=>c.obstacleRole==='head'&&c.normal&&c.depth<.02).sort((a,b)=>b.depth-a.depth)[0],geometry=definitions.get(side+'_shoulder_pitch')?.retarget;
    if(contact&&wristIndex!=null&&geometry?.palmSurface){const hand=world.rotations[wristIndex],normal=rotate([0,0,-1],hand);if(dot(normal,contact.normal)<-.65){const anchor=add(world.positions[wristIndex],rotate(geometry.palmSurface,hand)),tangent=unit(cross(contact.normal,[0,0,1]))||[1,0,0];
     for(const [lift,shift,heading]of [[contact.depth+.001,0,0],[.002,.015,0],[.002,-.015,0],[.002,.03,0],[.002,-.03,0],[.002,0,20],[.002,0,-20]]){const orientation=multiply(hand,axisRotation('z',heading)),point=anchor.map((v,i)=>v+contact.normal[i]*lift+tangent[i]*shift);goals.push({hand:orientation,wrist:sub(point,rotate(geometry.palmSurface,orientation))});}
    }}
   }else goals.push({});
   let sideBest=null,cleared=false;
   for(const goal of goals){for(const candidate of swivelCandidates(model,swivelPose,side,definitions,goal)){const result=consider(candidate),sideCollisions=result.result.collisions.filter(c=>c.side===side),score=sideCollisions.reduce((sum,c)=>sum+(c.depth-TOLERANCE)**2,0)*1e8+deviation(candidate,result.result);if(!sideBest||score<sideBest.score)sideBest={pose:candidate,score};if(!sideCollisions.length){sideBest={pose:candidate,score};cleared=true;break;}}if(cleared)break;}
   if(sideBest)swivelPose=sideBest.pose;
  }
  if(bestSafe&&wristIndices.every(index=>norm(sub(bestSafeResult.world.positions[index],original.world.positions[index]))<.002))return finish(bestSafe,bestSafeResult);
  const adjusted=(pose,id,value)=>({...pose,[id]:clamp(value,definitions.get(id).min,definitions.get(id).max)});
  // Outward link poses provide useful escape seeds even for a deeply embedded
  // hand, where local derivatives alone can point through the opposite side.
  for(const angle of [35,65,95]){const seed={...target};for(const side of affected){for(const [suffix,value]of [['shoulder_roll',(side==='left'?1:-1)*angle],['elbow_pitch',-20],['wrist_pitch',0],['wrist_roll',0]]){const id=side+'_'+suffix,j=definitions.get(id);if(j)seed[id]=clamp(value,j.min,j.max);}}consider(seed);}
  const budget=Math.max(24,Math.min(160,options.maxEvaluations||100));
  for(let iteration=0;iteration<7&&evaluations<budget;iteration++){
   const base=best,gradient=[];let size=0;for(const id of variables){if(evaluations>=budget)break;const j=definitions.get(id),step=base.pose[id]+3<=j.max?3:-3,candidate=adjusted(base.pose,id,base.pose[id]+step),actual=candidate[id]-base.pose[id];if(!actual)continue;const next=consider(candidate),g=(next.cost-base.cost)/actual;gradient.push([id,g]);size+=g*g;}
   if(size<1e-12)break;size=Math.sqrt(size);let improved=false;for(const step of [8,20,40]){const candidate={...base.pose};for(const[id,g]of gradient){const j=definitions.get(id);candidate[id]=clamp(candidate[id]-g/size*step,j.min,j.max);}const result=consider(candidate);if(result.cost<base.cost)improved=true;if(evaluations>=budget)break;}
   if(!improved){for(const id of variables.slice(0,8)){for(const sign of [-1,1])consider(adjusted(base.pose,id,base.pose[id]+sign*(iteration<3?12:5)));if(evaluations>=budget)break;}}
   if(bestSafe&&iteration>=2)break;
  }
  if(bestSafe){
   // Approach the requested pose from the verified side of the boundary.
   const safe=bestSafe;let low=0,high=1;for(let i=0;i<8;i++){const t=(low+high)/2,candidate={...target};for(const id of variables)candidate[id]=safe[id]+(target[id]-safe[id])*t;const result=evaluate(candidate);if(result.safe){low=t;if(deviation(candidate,result)<bestSafeCost){bestSafe=candidate;bestSafeResult=result;bestSafeCost=deviation(candidate,result);}}else high=t;}
   return finish(bestSafe,bestSafeResult);
  }
  // Fixed head/torso motion can make an arm-only correction impossible. A
  // fallback is accepted only after checking its complete pose and limits.
  for(const fallback of [reference,sanitize(model.neutral)].filter(Boolean)){const result=evaluate(fallback);if(result.safe)return finish(fallback,result,true);}
  return finish(null,initial,true);
 }
 return {solve,configure,reset,inspect:pose=>{if(!model)return {safe:false,collisions:[],maxPenetration:0};const result=inspectPose(model,sanitize(pose));return {safe:result.safe,collisions:result.collisions,maxPenetration:result.maxPenetration};}};
}
