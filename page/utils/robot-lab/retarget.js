/** Monocular landmark retargeting, independent of rendering and MediaPipe runtime.
 * World landmarks use camera coordinates; +Y up / +Z forward in the robot.
 * Unobservable axial twists retain their last commanded value. Missing or weak
 * landmarks hold per joint; a held joint is never counted as tracked.
 */
import {validateProgram,estimatePeakSpeed} from './motion.js';
const DEG=180/Math.PI, RAD=1/DEG, EPS=1e-8;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const unit=a=>{const n=length(a);return n>EPS?a.map(v=>v/n):null;};
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const vector=p=>[p.x,-p.y,-p.z];
const good=(p,confidence)=>finite(p)&&(p.visibility==null||Number.isFinite(p.visibility)&&p.visibility>=confidence)&&(p.presence==null||Number.isFinite(p.presence)&&p.presence>=confidence);
const angle=(a,b)=>{const u=unit(a),v=unit(b);return u&&v?Math.acos(clamp(dot(u,v),-1,1))*DEG:null;};
const frameVector=(v,basis)=>[dot(v,basis.x),dot(v,basis.y),dot(v,basis.z)];
const unrotateX=(v,degrees)=>{const c=Math.cos(degrees*RAD),s=Math.sin(degrees*RAD);return [v[0],c*v[1]+s*v[2],-s*v[1]+c*v[2]];};
const unrotateY=(v,degrees)=>{const c=Math.cos(degrees*RAD),s=Math.sin(degrees*RAD);return [c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]];};
const unrotateZ=(v,degrees)=>{const c=Math.cos(degrees*RAD),s=Math.sin(degrees*RAD);return [c*v[0]+s*v[1],-s*v[0]+c*v[1],v[2]];};
function fail(code,detail={}){const e=new Error(code);e.code=code;e.detail=detail;throw e;}
function definitions(input){
 if(!Array.isArray(input)||!input.length)fail('JOINTS');
 const map=new Map();for(const j of input){if(!j||typeof j.id!=='string'||map.has(j.id)||['__proto__','constructor','prototype'].includes(j.id)||![j.min,j.max,j.home??0].every(Number.isFinite)||j.min>j.max||(j.speed!=null&&(!Number.isFinite(j.speed)||j.speed<=0)))fail('JOINTS');map.set(j.id,{...j,home:clamp(j.home??0,j.min,j.max),speed:j.speed??180});}return map;
}
// World coordinates may include confident extrapolated legs outside the image.
// Only visible image points may drive a joint when image coordinates exist.
function poseVisible(result,index,confidence){
 const world=result?.worldLandmarks?.[0]?.[index],image=result?.landmarks?.[0];
 if(!good(world,confidence))return false;
 if(!image?.length)return true;
 const p=image[index];return good(p,confidence)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
}
function getBasis(result,confidence,heldTilt){
 const points=result?.worldLandmarks?.[0],has=(...ids)=>ids.every(i=>poseVisible(result,i,confidence));
 if(!has(11,12))return null;
 const leftShoulder=vector(points[11]),rightShoulder=vector(points[12]),shoulder=midpoint(leftShoulder,rightShoulder),x=unit(sub(leftShoulder,rightShoulder));
 if(!x)return null;
 const flatZ=unit(cross(x,[0,1,0])),flatY=flatZ&&unit(cross(flatZ,x));
 if(has(23,24)){
  const left=vector(points[23]),right=vector(points[24]),hip=midpoint(left,right),pelvisX=unit(sub(left,right)),up=unit(sub(shoulder,hip));
  const z=up&&unit(cross(x,up));
  if(pelvisX&&z){const y=unit(cross(z,x)),tilt=flatY?Math.atan2(dot(y,flatZ),dot(y,flatY)):heldTilt;return {x,y,z,hip,shoulder,pelvisX,tilt,framing:'full'};}
 }
 // Seated / cropped webcam framing: shoulders supply yaw and roll. Pitch
 // around this line is unobservable without the hips. Retain the last visible
 // chest tilt for the limb/head frame, preventing a jump when a leaning torso
 // is cropped; a session starting cropped uses gravity as its reference.
 if(!flatZ)return null;
 const c=Math.cos(heldTilt),s=Math.sin(heldTilt),y=flatY.map((v,i)=>v*c+flatZ[i]*s),z=flatZ.map((v,i)=>v*c-flatY[i]*s);
 return {x,y,z,shoulder,tilt:heldTilt,framing:'upper'};
}
// Exact inverse of Rx(pitch) Rz(roll) acting on a downward upper arm.
// The second solution keeps lateral raises beyond 90° on the lateral joint.
function shoulderAngles(v,side){
 const d=unit(v);if(!d)return null;const r=Math.asin(clamp(d[0],-1,1))*DEG;
 const choices=[r,side==='left'?180-r:-180-r].map(roll=>{const c=Math.cos(roll*RAD);return {roll,pitch:Math.hypot(d[1],d[2])<1e-6?0:Math.atan2(-d[2]/(c||EPS),-d[1]/(c||EPS))*DEG};});
 const candidates=choices.filter(a=>a.pitch>=-170-1e-7&&a.pitch<=90+1e-7&&(side==='left'?a.roll>=-30-1e-7&&a.roll<=165+1e-7:a.roll>=-165-1e-7&&a.roll<=30+1e-7));
 return (candidates.length?candidates:choices).sort((a,b)=>Math.abs(a.pitch)-Math.abs(b.pitch))[0];
}
function armAngles(upper,lower,side){
 const arm=shoulderAngles(upper,side);if(!arm)return null;
 if(lower){const bend=angle(upper,lower);if(bend!=null){arm.elbow=-bend;if(bend>12&&bend<168){const local=unrotateZ(unrotateX(lower,arm.pitch),arm.roll);if(Math.hypot(local[0],local[2])>EPS)arm.yaw=Math.atan2(local[0],local[2])*DEG;}}}
 return arm;
}
function usableWrist(result,side,s,e,w,basis,head,confidence,history,time){
 const p=result.worldLandmarks[0],world=p[w],image=result.landmarks?.[0]?.[w],shoulder=vector(p[s]),elbow=vector(p[e]);
 const upper=length(sub(elbow,shoulder)),candidate=finite(world)?vector(world):null,forearm=candidate&&length(sub(candidate,elbow));
 const local=candidate&&frameVector(sub(candidate,shoulder),basis),previous=history[side],visible=poseVisible(result,w,confidence);
 if(visible){
  if(upper>.04&&forearm>.04){history[side]={upper:previous?previous.upper*.8+upper*.2:upper,forearm:previous?previous.forearm*.8+forearm*.2:forearm,last:local,time,reliableTime:time};}
  return {usable:true,inferred:false};
 }
 // Visibility may fall when a wrist passes behind the head. Accept only the
 // model's present, in-frame estimate with a recently measured arm, consistent
 // bones and bounded motion. This path expires even if presence stays high.
 if(!previous||!head||!candidate||!finite(image)||image.x<0||image.x>1||image.y<0||image.y>1)return {usable:false};
 const present=[world.presence,image.presence].filter(v=>v!=null),elapsed=time-previous.time;
 if(!present.length||present.some(v=>!Number.isFinite(v)||v<Math.max(confidence,.65))||time-previous.reliableTime>1.2||elapsed<0||elapsed>.35)return {usable:false};
 if(upper<previous.upper*.7||upper>previous.upper*1.4||forearm<previous.forearm*.65||forearm>previous.forearm*1.45)return {usable:false};
 if(length(sub(candidate,head.center))>head.width*2.2||length(sub(local,previous.last))>previous.forearm*(.18+6*elapsed))return {usable:false};
 history[side]={...previous,last:local,time};return {usable:true,inferred:true};
}
function rigGeometry(map,side){
 const g=map.get(side+'_shoulder_pitch')?.retarget,vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 return g&&[g.upperArm,g.forearm,g.headWidth].every(v=>Number.isFinite(v)&&v>.01)&&['shoulder','head','neck','palmOffset'].every(id=>vec(g[id]))?g:null;
}
function armForward(arm,g){
 const rotate=v=>unrotateX(unrotateZ(unrotateY(v,-(arm.yaw||0)),-arm.roll),-arm.pitch);
 const upper=rotate([0,-g.upperArm,0]),lower=rotate(unrotateX([0,-g.forearm,0],-arm.elbow));
 return {upper,lower,wrist:g.shoulder.map((v,i)=>v+upper[i]+lower[i])};
}
const fromFrame=(v,b)=>b.x.map((_,i)=>b.x[i]*v[0]+b.y[i]*v[1]+b.z[i]*v[2]);
const smooth01=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
function robotHandPoints(candidate,side,g,context){
 const values=handAngles(candidate,side,{arms:{}},{previous:{yaw:0,pitch:0,roll:0}},false),points={};
 const bounded=id=>{const j=context.map.get(id),v=values[id]||0;return j?clamp(v,j.min,j.max):v;};
 for(const [name,digit]of Object.entries(g.handDigits||{})){
  const ids=digit.landmarks||digit.ids;if(!ids||!digit.base||!digit.lengths)continue;
  let point=[...digit.base],bend=0;points[ids[0]]=point;
  for(let i=0;i<3;i++){const id=side+'_'+name+'_'+(i+1);bend+=bounded(id)*(context.map.get(id)?.axisSign??digit.axisSign??-1);let segment=unrotateX([0,-digit.lengths[i],0],-bend);if(digit.opposition)segment=unrotateY(segment,-bounded(side+'_thumb_opposition')*(digit.oppositionAxisSign??-1));if(digit.mountRoll)segment=unrotateZ(segment,-digit.mountRoll);point=point.map((v,k)=>v+segment[k]);points[ids[i+1]]=i===2?point.map((v,k)=>v-segment[k]*(digit.tipInset||0)/digit.lengths[i]):point;}
 }
 return points;
}
function contactObservations(result,context,confidence){
 const output={};
 for(const [side,s,e,w]of [['left',11,13,15],['right',12,14,16]]){
  const g=rigGeometry(context.map,side);if(!g||![s,e,w].every(i=>poseVisible(result,i,confidence)))continue;
  const wrist=vector(result.worldLandmarks[0][w]),imageWrist=result.landmarks?.[0]?.[w];if(!finite(imageWrist))continue;
  let candidate=context.hands[side],cached=false;
  if(candidate)context.contactHistory[side]={candidate,time:context.time};
  else{const previous=context.contactHistory[side],active=context.contactMemory.hands||context.contactMemory.head?.includes(side);if(!active||!previous||context.time-previous.time>.45)continue;candidate=previous.candidate;cached=true;}
  const palm=palmBasis(candidate.world,side),p=candidate.world,img=candidate.landmarks;if(!palm||![0,5,17].every(i=>finite(img[i])))continue;
  const width=length(sub(vector(p[17]),vector(p[5]))),mid=midpoint(vector(p[5]),vector(p[17])),span=length(sub(mid,vector(p[0])));if(width<.025||width>.18||span<.035||span>.2)continue;
  const ratio=length(g.palmOffset)/(g.palmLength||.112),center=sub(mid,vector(p[0])).map(v=>v*ratio),thickness=width*.14;
  const offsetImage=point=>({x:point.x+(cached?imageWrist.x-img[0].x:0),y:point.y+(cached?imageWrist.y-img[0].y:0)}),centerImage=offsetImage({x:img[0].x+((img[5].x+img[17].x)/2-img[0].x)*ratio,y:img[0].y+((img[5].y+img[17].y)/2-img[0].y)*ratio});
  const features={},add=(key,delta,image,robot)=>{if(!robot||!image||![image.x,image.y].every(Number.isFinite)||image.x<0||image.x>1||image.y<0||image.y>1)return;features[key]={world:wrist.map((v,i)=>v+delta[i]),image,robot};};
  add('pad',center.map((v,i)=>v-palm.z[i]*thickness),centerImage,g.palmSurface||[0,-.065,-.0275]);
  add('back',center.map((v,i)=>v+palm.z[i]*thickness),centerImage,g.palmBack||[0,-.062,.034]);
  for(const [index,key]of [[-1,'edgeLeft'],[1,'edgeRight']])add(key,center.map((v,i)=>v+palm.x[i]*width*.5*index),centerImage,g.palmSides?.[index===-1?0:1]||[index*.046,-.064,0]);
  const local=robotHandPoints(candidate,side,g,context);for(const id of [4,8,12,16,20])if(finite(p[id])&&finite(img[id]))add('tip'+id,sub(vector(p[id]),vector(p[0])),offsetImage(img[id]),local[id]);
  output[side]={candidate,cached,palm,width,span,wrist,features,imageWidth:Math.hypot(img[5].x-img[17].x,img[5].y-img[17].y),imageSpan:Math.hypot((img[5].x+img[17].x)/2-img[0].x,(img[5].y+img[17].y)/2-img[0].y)};
 }
 return output;
}
function crownContact(observation,head){
 const pad=observation?.features.pad;if(!pad||!head.image)return 0;
 const local=frameVector(sub(pad.world,head.center),head.basis),normal=observation.palm.z.map(v=>-v),gap=local[1]-head.crown;
 if(dot(normal,head.basis.y)>-.75||Math.abs(local[0])>head.width*.55||Math.abs(local[2])>head.depth*.8||Math.abs(gap)>head.width*.35)return 0;
 const expectedY=head.image.y-head.image.width*head.crown/head.width,imageError=Math.hypot(pad.image.x-head.image.x,pad.image.y-expectedY);if(imageError>head.image.width*.65+.008)return 0;
 return smooth01((head.width*.35-Math.abs(gap))/(head.width*.2));
}
function pairedHands(records,head,basis,context){
 const left=context.observations.left,right=context.observations.right;if(!left||!right||!records.left||!records.right||records.left.inferred||records.right.inferred)return null;
 // Two established crown contacts outrank a nearby tip/edge pair. Human and
 // robot finger lengths differ; coupling those incidental neighbors could
 // drag one palm off the head after both surface constraints were satisfied.
 if(records.left.plan?.crown>.5&&records.right.plan?.crown>.5)return null;
 const span=(left.span+right.span)/2,width=(left.width+right.width)/2,limit=span*.7;let closest;
 for(const [leftKey,a]of Object.entries(left.features))for(const [rightKey,b]of Object.entries(right.features)){
  const gap=length(sub(b.world,a.world)),imageGap=Math.hypot(a.image.x-b.image.x,a.image.y-b.image.y),imageLimit=Math.max(.012,(left.imageWidth+right.imageWidth)*.5*.65,(left.imageSpan+right.imageSpan)*.2);
  if(gap>limit||imageGap>imageLimit)continue;
  if(!closest||gap<closest.gap)closest={a,b,leftKey,rightKey,gap,imageGap,imageLimit};
 }
 if(!closest)return null;
 const weight=smooth01((limit-closest.gap)/(limit-span*.15));if(weight<EPS)return null;
 const observations={left,right},features={left:closest.a,right:closest.b},gs={},orientations={},base={};
 for(const side of ['left','right']){const record=records[side],g=rigGeometry(context.map,side);if(!g||!Number.isFinite(record.source.elbow))return null;gs[side]=g;orientations[side]=record.plan?.mappedPalm||Object.fromEntries(Object.entries(observations[side].palm).map(([id,v])=>[id,frameVector(v,basis)]));
  const corrected={};for(const [key,joint]of [['pitch','shoulder_pitch'],['roll','shoulder_roll'],['yaw','shoulder_yaw'],['elbow','elbow_pitch']]){const id=side+'_'+joint,j=context.map.get(id);corrected[key]=clamp((record.source[key]||0)-(context.offsets[id]||0),j?.min??-380,j?.max??380);}base[side]=record.plan?.target||armForward(corrected,g).wrist;
 }
 const anchor=['left','right'].find(side=>records[side].plan?.crown>.5),headPair=anchor||(['left','right'].every(side=>records[side].plan?.weight>.5)&&head),midpointSource=midpoint(closest.a.world,closest.b.world),midpointRobot=midpoint(gs.left.shoulder,gs.right.shoulder),handScale=((gs.left.palmLength||.112)+(gs.right.palmLength||.112))/(2*span);
 let delta=frameVector(sub(closest.b.world,closest.a.world),basis).map(v=>v*handScale),center;
 if(closest.gap<width*.18&&closest.imageGap<closest.imageLimit*.35)delta=[0,0,0];
 if(headPair){const neck=records[anchor||'left'].plan.neck;if(head){delta=rotateHand(frameVector(sub(closest.b.world,closest.a.world),head.basis).map(v=>v*handScale),neck);if(closest.gap<width*.18&&closest.imageGap<closest.imageLimit*.35)delta=[0,0,0];}
  const locations=Object.fromEntries(['left','right'].map(side=>[side,base[side].map((v,i)=>v+fromFrame(features[side].robot,orientations[side])[i])]));center=anchor?locations[anchor].map((v,i)=>v+(anchor==='left'?1:-1)*delta[i]/2):midpoint(locations.left,locations.right);
 }else{const scale=length(sub(gs.left.shoulder,gs.right.shoulder))/context.shoulderWidth;center=frameVector(sub(midpointSource,basis.shoulder),basis).map((v,i)=>v*scale+midpointRobot[i]);}
 const offsets=Object.fromEntries(['left','right'].map(side=>[side,fromFrame(features[side].robot,orientations[side])]));
 // Project one common midpoint into both arm reaches. Independent endpoint
 // clamping would reopen the very contact that this constraint preserves.
 if(!anchor)for(let pass=0;pass<12;pass++)for(const side of ['left','right']){const g=gs[side],sign=side==='left'?-1:1,wrist=center.map((v,i)=>v+sign*delta[i]/2-offsets[side][i]),toward=sub(wrist,g.shoulder),distance=length(toward),j=context.map.get(side+'_elbow_pitch'),maxReach=Math.sqrt(g.upperArm*g.upperArm+g.forearm*g.forearm+2*g.upperArm*g.forearm*Math.cos(clamp(-(j?.max??0),0,180)*RAD))-.001;if(distance>maxReach)center=center.map((v,i)=>v+toward[i]*(maxReach/distance-1));}
 const attempt=point=>{const output={};for(const side of ['left','right']){const sign=side==='left'?-1:1,target=point.map((v,i)=>(v+sign*delta[i]/2-offsets[side][i])*weight+base[side][i]*(1-weight)),record=records[side],solved=solveArmIK(side,record.source,record.upper,target,orientations[side],1,context);if(!solved||solved.limited)return null;output[side]=solved;}return output;};
 let solved=attempt(center);
 if(!solved&&!anchor)for(const scale of [.95,.9,.8,.7,.6,.5]){solved=attempt(center.map((v,i)=>midpointRobot[i]+(v-midpointRobot[i])*scale));if(solved)break;}
 return solved?{solved,weight,features:[closest.leftKey,closest.rightKey]}:null;
}
function headArmIK(side,arm,upper,wrist,head,basis,raw,context,palms){
 const g=rigGeometry(context.map,side);if(!g||!Number.isFinite(arm.elbow))return null;
 const observation=context.observations[side],hand=observation?.candidate||context.hands[side],palm=hand&&palmBasis(hand.world,side),p=hand?.world;
 const palmRatio=length(g.palmOffset)/(g.palmLength||.112),palmDelta=palm?sub(midpoint(vector(p[5]),vector(p[17])),vector(p[0])).map(v=>v*palmRatio):[0,0,0],contact=wrist.map((v,i)=>v+palmDelta[i]);
 const distance=length(sub(contact,head.center))/head.width,t=clamp((2.4-distance)/1,0,1),weight=t*t*(3-2*t);if(weight<EPS)return null;
 const neck=Object.fromEntries(['yaw','pitch','roll'].map(axis=>{const id='neck_'+axis,j=context.map.get(id);return [axis,clamp((raw[id]||0)-(context.offsets[id]||0),j?.min??-180,j?.max??180)];}));
 const scale=g.headWidth/head.width,depthScale=Number.isFinite(g.headDepth)&&g.headDepth>.02&&head.depth>.025?clamp(g.headDepth/head.depth,.35,3):scale;
 const center=rotateHand(sub(g.head,g.neck),neck).map((v,i)=>v+g.neck[i]),relative=frameVector(sub(contact,head.center),head.basis).map((v,i)=>v*(i===2?depthScale:scale));
 let target=rotateHand(relative,neck).map((v,i)=>v+center[i]),mappedPalm,crown=0,crownSurface;
 if(palm){
  const mapped=Object.fromEntries(Object.entries(palm).map(([id,v])=>[id,rotateHand(frameVector(v,head.basis),neck)]));
  const palmOffset=g.palmOffset.map((_,i)=>mapped.x[i]*g.palmOffset[0]+mapped.y[i]*g.palmOffset[1]+mapped.z[i]*g.palmOffset[2]);target=target.map((v,i)=>v-palmOffset[i]);
  // Keep the palm's head-relative orientation while changing the arm's length
  // and pose. A calibrated neck is included in this same coordinate mapping.
  const mix=id=>mapped[id].map((v,i)=>frameVector(palm[id],basis)[i]*(1-weight)+v*weight),x=unit(mix('x')),yy=mix('y'),y=x&&unit(yy.map((v,i)=>v-x[i]*dot(yy,x)));
  if(x&&y)mappedPalm={x,y,z:cross(x,y)};
  crown=crownContact(observation,head);
  if(crown&&Number.isFinite(g.headTop)){
   const surface=frameVector(sub(observation.features.pad.world,head.center),head.basis),gap=Math.max(0,surface[1]-head.crown),headPoint=[surface[0]*scale,g.headTop+gap*g.headTop/head.crown,surface[2]*depthScale],pad=g.palmSurface||[0,-.065,-.0275];
   crownSurface=rotateHand(headPoint,neck).map((v,i)=>v+center[i]);const crownTarget=crownSurface.map((v,i)=>v-fromFrame(pad,mapped)[i]);target=target.map((v,i)=>v*(1-crown)+crownTarget[i]*crown);
  }
 }
 let solved=solveArmIK(side,arm,upper,target,mappedPalm,weight,context);
 // Contact and the palm normal take priority when an exact finger heading
 // cannot fit the configured joints. Turn only within the crown's tangent
 // plane, testing the smallest heading change first; never lift the palm.
 if(!solved&&crown>.5&&crownSurface&&mappedPalm){const original=mappedPalm,pad=g.palmSurface||[0,-.065,-.0275];for(let angle=10;angle<=100&&!solved;angle+=10)for(const sign of [1,-1]){const c=Math.cos(angle*sign*RAD),s=Math.sin(angle*sign*RAD),candidate={x:original.x.map((v,i)=>v*c+original.y[i]*s),y:original.y.map((v,i)=>v*c-original.x[i]*s),z:original.z},nextTarget=crownSurface.map((v,i)=>v-fromFrame(pad,candidate)[i]);solved=solveArmIK(side,arm,upper,nextTarget,candidate,1,context);if(solved){mappedPalm=candidate;break;}}}
 if(solved&&mappedPalm)palms[side]=mappedPalm;return solved?{...solved,crown,neck}:null;
}
function solveArmIK(side,arm,upper,target,mappedPalm,weight,context){
 const g=rigGeometry(context.map,side);if(!g)return null;
 const corrected={};for(const [key,joint]of [['pitch','shoulder_pitch'],['roll','shoulder_roll'],['yaw','shoulder_yaw'],['elbow','elbow_pitch']]){const id=side+'_'+joint,j=context.map.get(id),v=(arm[key]||0)-(context.offsets[id]||0);corrected[key]=j?clamp(v,j.min,j.max):v;}
 const baseline=armForward(corrected,g);target=target.map((v,i)=>baseline.wrist[i]*(1-weight)+v*weight);
 const toward=sub(target,g.shoulder),direction=unit(toward);if(!direction)return null;
 const elbowLimit=context.map.get(side+'_elbow_pitch'),maxBend=clamp(-(elbowLimit?.min??-145),0,180),minBend=clamp(-(elbowLimit?.max??0),0,maxBend),reachAt=bend=>Math.sqrt(Math.max(EPS,g.upperArm*g.upperArm+g.forearm*g.forearm+2*g.upperArm*g.forearm*Math.cos(bend*RAD)));
 const requestedReach=length(toward),reach=clamp(requestedReach,reachAt(maxBend)+1e-7,Math.max(reachAt(maxBend)+1e-7,reachAt(minBend)-1e-7)),projection=dot(upper,direction);
 let pole=unit(upper.map((v,i)=>v-direction[i]*projection));if(!pole){const fallback=side==='left'?[1,0,0]:[-1,0,0];pole=unit(fallback.map((v,i)=>v-direction[i]*dot(fallback,direction)));}if(!pole)return null;
 const along=(g.upperArm*g.upperArm+reach*reach-g.forearm*g.forearm)/(2*reach),height=Math.sqrt(Math.max(0,g.upperArm*g.upperArm-along*along)),around=cross(direction,pole);
 // The observed elbow is the preferred pole, but human proportions may put
 // that pole beyond a robot shoulder limit. Search the same IK elbow circle
 // for the nearest feasible bend plane, preserving the wrist target exactly.
 let best;
 const candidate=degrees=>{const c=Math.cos(degrees*RAD),s=Math.sin(degrees*RAD),newUpper=direction.map((v,i)=>v*along+(pole[i]*c+around[i]*s)*height),newLower=direction.map((v,i)=>v*reach-newUpper[i]),solved=armAngles(newUpper,newLower,side);if(!solved)return;
  let penalty=0,motion=0;for(const [key,joint]of [['pitch','shoulder_pitch'],['roll','shoulder_roll'],['yaw','shoulder_yaw'],['elbow','elbow_pitch']]){const j=context.map.get(side+'_'+joint),v=solved[key]||0;if(j)penalty+=(v-clamp(v,j.min,j.max))**2;motion+=(v-(corrected[key]||0))**2;}
  if(mappedPalm){const local=Object.fromEntries(Object.entries(mappedPalm).map(([id,v])=>[id,unrotateX(unrotateY(unrotateZ(unrotateX(v,solved.pitch),solved.roll),solved.yaw||0),solved.elbow)])),previous=context.handStates?.[side]?.previous||{yaw:0,pitch:0,roll:0},a=palmAngles(local,{previous:{...previous}});for(const [axis,joint]of [['yaw','forearm_yaw'],['pitch','wrist_pitch'],['roll','wrist_roll']]){const j=context.map.get(side+'_'+joint),v=a[axis]??previous[axis];if(j)penalty+=(v-clamp(v,j.min,j.max))**2;}}
  const feasible=penalty<=1e-6,cost=penalty*1e6+degrees*degrees+motion*.002;if(!best||feasible&&!best.feasible||feasible===best.feasible&&cost<best.cost)best={arm:solved,cost,degrees,penalty,feasible};
 };
 candidate(0);if(best?.penalty>1e-6){for(let degrees=2;degrees<=180;degrees+=2){candidate(degrees);candidate(-degrees);}const center=best.degrees;for(let degrees=center-2;degrees<=center+2;degrees+=.25)candidate(degrees);}
 if(!best?.feasible)return null;
 return {arm:best.arm,weight,target,mappedPalm,limited:Math.abs(requestedReach-reach)>.0001};
}
function bodyAngles(result,confidence,heldTilt,context){
 const p=result?.worldLandmarks?.[0],basis=getBasis(result,confidence,heldTilt),raw={};if(!basis)return {raw,basis:null,arms:{}};
 const has=(...ids)=>ids.every(i=>poseVisible(result,i,confidence));const point=i=>vector(p[i]);
 const dir=(a,b)=>frameVector(sub(point(b),point(a)),basis);
 // Shoulder/pelvis torsion and torso lean; translation/root motion stays fixed.
 const hips=basis.pelvisX&&unit([basis.pelvisX[0],0,basis.pelvisX[2]]),shoulderAxis=basis.x;
 if(hips&&shoulderAxis){const forward=cross(hips,[0,1,0]);const s=frameVector(shoulderAxis,{x:hips,y:[0,1,0],z:forward});raw.torso_yaw=-Math.atan2(s[2],s[0])*DEG;const up=frameVector(sub(basis.shoulder,basis.hip),{x:hips,y:[0,1,0],z:forward});raw.torso_pitch=Math.atan2(up[2],up[1])*DEG;raw.torso_roll=-Math.atan2(up[0],Math.hypot(up[1],up[2]))*DEG;}
 if(basis.framing==='upper'){raw.torso_yaw=-Math.atan2(shoulderAxis[2],shoulderAxis[0])*DEG;raw.torso_roll=Math.atan2(shoulderAxis[1],Math.hypot(shoulderAxis[0],shoulderAxis[2]))*DEG;}
 const pelvisBasis=hips?{x:hips,y:[0,1,0],z:cross(hips,[0,1,0])}:basis;
 const legdir=(a,b)=>frameVector(sub(point(b),point(a)),pelvisBasis);
 const arms={},inferredArms=[],headAdjusted=[],palms={},records={},contacts={hands:false,head:[]};let head,ikLimited=0;
 if(has(7,8,0)){const ears=midpoint(point(7),point(8)),face=frameVector(sub(point(0),ears),basis),earLine=dir(8,7);if(length(face)>EPS){raw.neck_yaw=Math.atan2(face[0],face[2])*DEG;raw.neck_pitch=-Math.atan2(face[1],Math.hypot(face[0],face[2]))*DEG;}raw.neck_roll=Math.atan2(earLine[1],earLine[0])*DEG;
  const width=length(sub(point(7),point(8))),x=unit(sub(point(7),point(8))),front=sub(point(0),ears),z=x&&unit(front.map((v,i)=>v-x[i]*dot(front,x)));if(x&&z&&width>.04){head={center:ears,width,depth:dot(front,z),basis:{x,y:cross(z,x),z},crown:width*.75};
   if(has(2,5,9,10)){const eyes=midpoint(point(2),point(5)),mouth=midpoint(point(9),point(10)),eyeY=dot(sub(eyes,ears),head.basis.y),faceHeight=dot(sub(eyes,mouth),head.basis.y);if(eyeY>0&&eyeY<width*.5&&faceHeight>width*.15&&faceHeight<width*.7)head.crown=clamp(eyeY+Math.max(width*.5,faceHeight*1.5),width*.6,width*.9);}
   const image=result.landmarks?.[0];if(finite(image?.[7])&&finite(image?.[8]))head.image={x:(image[7].x+image[8].x)/2,y:(image[7].y+image[8].y)/2,width:Math.hypot(image[7].x-image[8].x,image[7].y-image[8].y)};
  }
 }
 context.observations=contactObservations(result,context,confidence);context.shoulderWidth=length(sub(point(11),point(12)));
 for(const [side,s,e,w,h,k,a,heel,toe]of [['left',11,13,15,23,25,27,29,31],['right',12,14,16,24,26,28,30,32]]){
  if(has(s,e)){
   const visible=usableWrist(result,side,s,e,w,basis,head,confidence,context.history,context.time),upper=dir(s,e);let arm=armAngles(upper,visible.usable?dir(e,w):null,side),adjusted=false;
   if(visible.inferred)inferredArms.push(side);
   if(arm)records[side]={source:{...arm},upper,inferred:visible.inferred,usable:visible.usable};
   if(arm&&head&&visible.usable){const solved=headArmIK(side,arm,upper,point(w),head,basis,raw,context,palms);if(solved){records[side].plan=solved;arm=solved.arm;adjusted=true;headAdjusted.push(side);if(solved.limited)ikLimited++;if(solved.crown>.5)contacts.head.push(side);}}
   if(arm){arms[side]=arm;for(const [key,joint]of [['pitch','shoulder_pitch'],['roll','shoulder_roll'],['yaw','shoulder_yaw'],['elbow','elbow_pitch']])if(Number.isFinite(arm[key]))raw[side+'_'+joint]=arm[key]+(adjusted?(context.offsets[side+'_'+joint]||0):0);}
  }
  if(basis.framing==='full'&&has(h,k)){const v=legdir(h,k),d=unit(v);if(d){raw[side+'_hip_pitch']=Math.atan2(-d[2],-d[1])*DEG;raw[side+'_hip_roll']=Math.atan2(d[0],Math.hypot(d[1],d[2]))*DEG;}}
  if(basis.framing==='full'&&has(h,k,a)){const bend=angle(sub(point(k),point(h)),sub(point(a),point(k)));if(bend!=null)raw[side+'_knee_pitch']=bend;}
  if(basis.framing==='full'&&has(k,a,heel,toe)){const foot=legdir(heel,toe),shin=legdir(k,a);if(length(foot)>EPS&&length(shin)>EPS){const shinPitch=Math.atan2(-shin[2],-shin[1])*DEG;raw[side+'_ankle_pitch']=-Math.atan2(foot[1],foot[2])*DEG-shinPitch;}}
 }
 const pair=pairedHands(records,head,basis,context);if(pair){contacts.hands=true;for(const side of ['left','right']){const solved=pair.solved[side];arms[side]=solved.arm;palms[side]=solved.mappedPalm;for(const [key,joint]of [['pitch','shoulder_pitch'],['roll','shoulder_roll'],['yaw','shoulder_yaw'],['elbow','elbow_pitch']])if(Number.isFinite(solved.arm[key]))raw[side+'_'+joint]=solved.arm[key]+(context.offsets[side+'_'+joint]||0);}}
 context.contactMemory.hands=contacts.hands;context.contactMemory.head=contacts.head;
 const cachedPalms=Object.fromEntries(Object.entries(context.observations).filter(([side,o])=>o.cached&&(contacts.hands||contacts.head.includes(side))&&palms[side]).map(([side])=>[side,palms[side]]));
 return {raw,basis,arms,inferredArms,headAdjusted,palms,cachedPalms,contacts,ikLimited};
}
function handAssignments(hand,pose,confidence){
 const candidates=[];for(let i=0;i<Math.min(2,hand?.landmarks?.length||0);i++){const landmarks=hand.landmarks[i],world=hand.worldLandmarks?.[i],category=(hand.handednesses||hand.handedness)?.[i]?.[0];if(!world||world.length<21||!landmarks?.[0]||!finite(landmarks[0]))continue;if(category?.score!=null&&(!Number.isFinite(category.score)||category.score<confidence))continue;candidates.push({landmarks,world,category});}
 const p=pose?.landmarks?.[0],hasPose=!!(p?.length||pose?.worldLandmarks?.[0]?.length);
 if(hasPose){
  // Body and hand tasks detect independently. Once a person is tracked, an
  // unmatched hand may belong to a bystander: never fall back to its label.
  // A single visible wrist is sufficient; an occluded wrist holds its pose.
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),wrists=[];
  const shoulderWidth=good(p?.[11],confidence)&&good(p?.[12],confidence)?dist(p[11],p[12]):0;
  for(const [side,wrist,elbow]of [['left',15,13],['right',16,14]])if(good(p?.[wrist],confidence)){
   const forearm=good(p?.[elbow],confidence)?dist(p[wrist],p[elbow]):shoulderWidth*.75||.12;
   wrists.push({side,point:p[wrist],radius:clamp(forearm*.55,.035,.14)});
  }
  // At most two candidates and two wrists. Maximize valid matches, then
  // minimize normalized distance, without ever assigning one hand twice.
  let best={count:-1,cost:Infinity,assignments:[]};
  const match=(index,used,assignments,cost)=>{
   if(index===candidates.length){if(assignments.length>best.count||(assignments.length===best.count&&cost<best.cost))best={count:assignments.length,cost,assignments:[...assignments]};return;}
   match(index+1,used,assignments,cost);
   for(let w=0;w<wrists.length;w++)if(!(used&(1<<w))){const wrist=wrists[w],distance=dist(candidates[index].landmarks[0],wrist.point);if(distance<=wrist.radius)match(index+1,used|(1<<w),[...assignments,[index,wrist.side]],cost+(distance/wrist.radius)**2);}
  };
  match(0,0,[],0);
  return Object.fromEntries(best.assignments.map(([index,side])=>[side,candidates[index]]));
 }
 // Hands-only input has no body identity to associate with, so use the task's
 // anatomical handedness. Keep the best candidate if labels are duplicated.
 const output={};for(const c of candidates){const label=c.category?.categoryName||c.category?.displayName,side=label==='Left'?'left':label==='Right'?'right':null;if(side&&(!output[side]||(c.category?.score||0)>(output[side].category?.score||0)))output[side]=c;}return output;
}
function palmBasis(points,side){
 if(![0,5,17].every(i=>finite(points[i])))return null;
 const wrist=vector(points[0]),index=vector(points[5]),little=vector(points[17]);
 // The prone rig has its index toward the center of the body. MCP bases
 // belong to the rigid palm; bent fingers must not tilt or twist the wrist.
 const x=unit(sub(little,index).map(v=>v*(side==='left'?1:-1))),down=unit(sub(midpoint(index,little),wrist));
 if(!x||!down||length(cross(x,down))<.15)return null;
 const y=unit(down.map((v,i)=>-v+x[i]*dot(down,x))),z=unit(cross(x,y));
 return {x,y,z};
}
const nearAngle=(value,previous)=>Math.abs(value-previous)<=180+1e-7?value:value+360*Math.round((previous-value)/360);
const rotateHand=(v,a)=>unrotateY(unrotateX(unrotateZ(v,-a.roll),-a.pitch),-a.yaw);
function palmAngles(basis,state){
 // Exact inverse of the rig's Ry(forearm) Rx(wrist pitch) Rz(wrist roll).
 const pitch=-Math.asin(clamp(basis.z[1],-1,1))*DEG;
 if(Math.hypot(basis.z[0],basis.z[2])<.08){state.previous.pitch=nearAngle(pitch,state.previous.pitch);return {pitch:state.previous.pitch};}
 const yaw=Math.atan2(basis.z[0],basis.z[2])*DEG,roll=Math.atan2(basis.x[1],basis.y[1])*DEG;
 // Keep the continuous Euler branch before enforcing the robot's limits.
 // Crossing ±180° or a vertical palm must not flip to the opposite stop.
 const choices=[{yaw,pitch,roll},{yaw:yaw+180,pitch:pitch>=0?180-pitch:-180-pitch,roll:roll+180}].map(a=>Object.fromEntries(Object.entries(a).map(([id,v])=>[id,nearAngle(v,state.previous[id])])));
 const cost=a=>Object.keys(a).reduce((sum,id)=>sum+(a[id]-state.previous[id])**2,0);
 const angles=choices.sort((a,b)=>cost(a)-cost(b))[0];state.previous={...angles};return angles;
}
function handAngles(candidate,side,body,state,handsOnly){
 // HandLandmarker 0.10.14 emits visibility:0 placeholders, not per-joint
 // confidence. Its handedness/detection score is checked at assignment; only
 // finite coordinates can be required here. Pose visibility remains enforced.
 const p=candidate.world,raw={};const has=(...ids)=>ids.every(i=>finite(p[i]));const point=i=>vector(p[i]);
 if(!has(0,5,9,17))return raw;
 const palmNormal=unit(cross(sub(point(5),point(0)),sub(point(17),point(0))));if(!palmNormal)return raw;
 for(const [digit,ids]of [['index',[0,5,6,7,8]],['middle',[0,9,10,11,12]],['ring',[0,13,14,15,16]],['little',[0,17,18,19,20]]]){
  for(let i=1;i<=3;i++){const [a,b,c]=ids.slice(i-1,i+2);if(!has(a,b,c))continue;let incoming=sub(point(b),point(a)),outgoing=sub(point(c),point(b));if(i===1){const along=unit(incoming);if(!along)continue;outgoing=along.map((v,k)=>v*dot(outgoing,along)+palmNormal[k]*dot(outgoing,palmNormal));}const bend=angle(incoming,outgoing);if(bend!=null)raw[side+'_'+digit+'_'+i]=-bend;}
 }
 for(let i=1;i<=3;i++){if(!has(i-1,i,i+1))continue;const bend=angle(sub(point(i),point(i-1)),sub(point(i+1),point(i)));if(bend!=null)raw[side+'_thumb_'+i]=-Math.max(0,bend-(i===1?25:0));}
 // Resolve thumb opposition in the hand's own anatomical frame. A palm-normal
 // dot product alone confuses flexion with opposition and reverses one hand.
 // The rig's thumb mount is tilted 0.75rad toward the body's center, with
 // negative physical Y for positive commanded opposition (axisSign = -1).
 if(has(1,2)){
  const down=unit(sub(point(9),point(0))),across=sub(point(17),point(5)).map(v=>v*(side==='left'?1:-1));
  const x=down&&unit(across.map((v,i)=>v-down[i]*dot(across,down)));
  if(x&&down){const y=down.map(v=>-v),z=unit(cross(x,y));
   if(z){const local=unrotateZ(frameVector(sub(point(2),point(1)),{x,y,z}),side==='left'?-.75*DEG:.75*DEG),d=unit(local);
    // Near a straight thumb its axial angle is unobservable: keep the last one.
    if(d&&d[2]<-.05&&Math.hypot(d[0],d[2])>.12)raw[side+'_thumb_opposition']=Math.atan2(d[0],-d[2])*DEG;
   }
  }
 }
 const palm=palmBasis(p,side),arm=body.arms[side];let local;
 if(palm&&handsOnly){
  // An unseen arm cannot define absolute pronation. Hands-only capture uses
  // its first palm as neutral while preserving the current robot orientation.
  state.reference??=palm;local=Object.fromEntries(Object.entries(palm).map(([id,v])=>[id,rotateHand(frameVector(v,state.reference),state.initial)]));
 }else if(palm&&body.basis&&arm&&Number.isFinite(arm.elbow)&&!body.inferredArms?.includes(side)){
  local=Object.fromEntries(Object.entries(palm).map(([id,v])=>{let d=body.palms?.[side]?.[id]||frameVector(v,body.basis);d=unrotateX(d,arm.pitch);d=unrotateZ(d,arm.roll);d=unrotateY(d,arm.yaw||0);return [id,unrotateX(d,arm.elbow)];}));
 }
 // Missing elbow/shoulder landmarks hold the previous orientation in body
 // mode; they must not silently start a new hands-only neutral reference.
 if(local){const a=palmAngles(local,state);for(const [axis,joint]of [['yaw','forearm_yaw'],['pitch','wrist_pitch'],['roll','wrist_roll']])if(Number.isFinite(a[axis]))raw[side+'_'+joint]=a[axis];
 }
 return raw;
}
/** Assign left/right using pose wrists first, or task handedness on unmirrored input. */
export function createRetargeter(joints,options={}){
 let map=definitions(joints),config={smoothing:.65,confidence:.55,mode:'body-hands',swapSides:false,...options};let positions={},offsets={},lastTime=null,lastBody={},lastBodyGood=false,shoulderYaw={},lastFraming=null,frameOffsets={full:{},upper:{}},lastTorso={},chestTilt=0,handStates={},armHistory={},contactHistory={},contactMemory={hands:false,head:[]};
 const normalizeConfig=()=>{config.smoothing=clamp(Number.isFinite(config.smoothing)?config.smoothing:.65,0,.98);config.confidence=clamp(Number.isFinite(config.confidence)?config.confidence:.55,0,1);if(!['body','hands','body-hands'].includes(config.mode))config.mode='body-hands';config.swapSides=!!config.swapSides;};normalizeConfig();
 const reset=(initial={})=>{positions=Object.fromEntries([...map].map(([id,j])=>[id,clamp(Number.isFinite(initial[id])?initial[id]:j.home,j.min,j.max)]));offsets={};lastTime=null;lastBody={};lastBodyGood=false;shoulderYaw={};lastFraming=null;frameOffsets={full:{},upper:{}};lastTorso={};chestTilt=0;handStates={};armHistory={};contactHistory={};contactMemory={hands:false,head:[]};};reset();
 const configure=next=>{if(next?.joints){map=definitions(next.joints);for(const[id,j]of map)positions[id]=clamp(Number.isFinite(positions[id])?positions[id]:j.home,j.min,j.max);}const changed=next&&['mode','swapSides'].some(k=>Object.hasOwn(next,k)&&next[k]!==config[k]);config={...config,...next};normalizeConfig();if(changed){offsets={};lastBody={};lastBodyGood=false;lastTime=null;shoulderYaw={};lastFraming=null;frameOffsets={full:{},upper:{}};lastTorso={};chestTilt=0;handStates={};armHistory={};contactHistory={};contactMemory={hands:false,head:[]};}};
 const update=(results={},time=0)=>{
  if(!Number.isFinite(time))fail('TIME');const dt=lastTime==null?1/30:clamp(time-lastTime,0,.2);if(lastTime!=null&&time<lastTime){lastTime=time;armHistory={};contactHistory={};contactMemory={hands:false,head:[]};return {positions:{...positions},tracked:0,body:false,leftHand:false,rightHand:false,limited:0,coverage:{body:0,hands:0,framing:'none',inferredArms:[],headAdjusted:[],contacts:{hands:false,head:[]}}};}lastTime=time;
  const hands=config.mode==='body'?{}:handAssignments(results.hand,results.pose,config.confidence),body=bodyAngles(results.pose,config.confidence,chestTilt,{map,offsets,hands,history:armHistory,time,handStates,contactHistory,contactMemory}),framing=body.basis?.framing;
  if(framing==='full')chestTilt=body.basis.tilt;
  if(framing){
   // Both methods observe yaw/roll, but their absolute reference differs when
   // the pelvis is hidden. Align the incoming reference at a framing switch;
   // later visible movement remains responsive and calibration stays valid.
   for(const id of ['torso_yaw','torso_roll'])if(Number.isFinite(body.raw[id])){
    if(lastFraming&&lastFraming!==framing&&Number.isFinite(lastTorso[id]))frameOffsets[framing][id]=lastTorso[id]-body.raw[id];
    body.raw[id]+=frameOffsets[framing][id]||0;lastTorso[id]=body.raw[id];
   }
   lastFraming=framing;
  }
  for(const side of ['left','right'])if(body.arms[side]){const arm=body.arms[side];if(Number.isFinite(arm.yaw)){const yaw=Number.isFinite(shoulderYaw[side])?nearAngle(arm.yaw,shoulderYaw[side]):arm.yaw;body.raw[side+'_shoulder_yaw']+=yaw-arm.yaw;arm.yaw=yaw;shoulderYaw[side]=yaw;}else arm.yaw=shoulderYaw[side]||0;}
  lastBody=body.raw;lastBodyGood=config.mode!=='hands'&&!!body.basis;
  const raw=config.mode==='hands'?{}:{...body.raw};let leftHand=false,rightHand=false,handCount=0;
  for(const side of ['left','right'])if(hands[side]){
   if(!handStates[side]){const target=config.swapSides?(side==='left'?'right':'left'):side,initial=Object.fromEntries([['yaw','forearm_yaw'],['pitch','wrist_pitch'],['roll','wrist_roll']].map(([axis,joint])=>[axis,(positions[target+'_'+joint]||0)*(config.swapSides&&axis!=='pitch'?-1:1)]));handStates[side]={initial,previous:{...initial}};}
   const h=handAngles(hands[side],side,body,handStates[side],config.mode==='hands');Object.assign(raw,h);const tracked=Object.keys(h).length;if(side==='left')leftHand=tracked>0;else rightHand=tracked>0;handCount+=tracked;
  }
  // A brief missing hand result may retain an established contact frame, but
  // never invent fresh finger motion or report the missing hand as detected.
  if(config.mode==='body-hands')for(const [side,palm]of Object.entries(body.cachedPalms||{}))if(!hands[side]&&handStates[side]){const arm=body.arms[side],local=Object.fromEntries(Object.entries(palm).map(([id,v])=>[id,unrotateX(unrotateY(unrotateZ(unrotateX(v,arm.pitch),arm.roll),arm.yaw||0),arm.elbow)])),a=palmAngles(local,handStates[side]);for(const [axis,joint]of [['yaw','forearm_yaw'],['pitch','wrist_pitch'],['roll','wrist_roll']])if(Number.isFinite(a[axis]))raw[side+'_'+joint]=a[axis];}
  // Mirror anatomically, not by flipping video pixels. Axes around Y and Z
  // reverse across the sagittal plane; X flexion retains its sign.
  const mapped={};for(const[id,value]of Object.entries(raw)){const target=config.swapSides?id.replace(/^left_/,'RIGHT_').replace(/^right_/,'left_').replace(/^RIGHT_/,'right_'):id;const j=map.get(target);if(!j||!Number.isFinite(value))continue;const offset=Object.hasOwn(body.raw,id)?offsets[id]||0:0;const flip=config.swapSides&&j.axis!=='x'?-1:1;mapped[target]=(value-offset)*flip;}
  let limited=config.mode==='hands'?0:body.ikLimited||0;const alpha=config.smoothing===0?1:1-Math.pow(config.smoothing,dt*30);for(const[id,target]of Object.entries(mapped)){const j=map.get(id),bounded=clamp(target,j.min,j.max);let wasLimited=Math.abs(target-bounded)>.001;const smoothed=positions[id]+(bounded-positions[id])*alpha,delta=j.speed*dt;const next=clamp(smoothed,positions[id]-delta,positions[id]+delta);if(Math.abs(smoothed-next)>.001)wasLimited=true;if(wasLimited)limited++;positions[id]=clamp(next,j.min,j.max);}
  if(config.swapSides)[leftHand,rightHand]=[rightHand,leftHand];const sides=values=>config.mode==='hands'?[]:(values||[]).map(side=>config.swapSides?(side==='left'?'right':'left'):side);return {positions:{...positions},tracked:Object.keys(mapped).length,body:config.mode!=='hands'&&!!body.basis,leftHand,rightHand,limited,coverage:{body:config.mode==='hands'?0:Object.keys(body.raw).length,hands:handCount,framing:config.mode==='hands'?'none':body.basis?.framing||'none',inferredArms:sides(body.inferredArms),headAdjusted:sides(body.headAdjusted),contacts:{hands:config.mode!=='hands'&&!!body.contacts?.hands,head:sides(body.contacts?.head)}}};
 };
 const calibrate=()=>{if(!lastBodyGood)return false;offsets={...lastBody};return true;};
 return {update,configure,calibrate,reset};
}
/** Convert timestamped capture poses to a bounded, editable quintic trajectory.
 * A global timing scale keeps the peak speed of every quintic segment within
 * configured limits. Reduction is error-driven in joint space, retaining ends.
 */
export function buildCaptureProgram(samples,joints,{maxPoints=450,maxDuration=600}={}){
 const map=definitions(joints);maxPoints=clamp(Math.floor(maxPoints)||450,2,500);maxDuration=clamp(Number.isFinite(maxDuration)?maxDuration:600,.001,600);
 if(!Array.isArray(samples)||samples.length<2)fail('CAPTURE_SHORT');if(samples.length>18000)fail('CAPTURE_LARGE');
 let last=-Infinity,clamped=0;const clean=samples.map((s,index)=>{if(!s||!Number.isFinite(s.time)||s.time<0||s.time<=last||!s.positions||typeof s.positions!=='object')fail('CAPTURE_TIME',{index});last=s.time;const positions={};for(const[id,j]of map){const v=s.positions[id];if(!Number.isFinite(v))fail('CAPTURE_VALUE',{index,joint:id});positions[id]=clamp(v,j.min,j.max);if(positions[id]!==v)clamped++;}return {time:s.time-samples[0].time,positions};});
 const sourceDuration=clean.at(-1).time;if(sourceDuration<.1)fail('CAPTURE_SHORT');if(sourceDuration>maxDuration)fail('CAPTURE_LONG');
 // Iterative Ramer–Douglas–Peucker variant. Keep points with the largest joint
 // angle error against the actual quintic curve; at least endpoints, at most maxPoints. 0.75° avoids retaining
 // every tiny tracking tremor. Endpoint timing remains exact before scaling.
 const selected=new Set([0,clean.length-1]);const segment=(a,b)=>{let error=.75,index=-1;const start=clean[a],end=clean[b],duration=end.time-start.time;for(let k=a+1;k<b;k++){const u=(clean[k].time-start.time)/duration,blend=u*u*u*(10+u*(-15+6*u));for(const[id]of map){const expected=start.positions[id]+(end.positions[id]-start.positions[id])*blend,e=Math.abs(clean[k].positions[id]-expected);if(e>error){error=e;index=k;}}}return {a,b,error,index};};
 const segments=[segment(0,clean.length-1)];while(selected.size<maxPoints&&segments.length){segments.sort((a,b)=>b.error-a.error);const best=segments.shift();if(best.index<0)break;selected.add(best.index);for(const s of [segment(best.a,best.index),segment(best.index,best.b)])if(s.index>=0)segments.push(s);}
 const points=[...selected].sort((a,b)=>a-b).map(i=>clean[i]);let timeScale=1;for(let i=1;i<points.length;i++){const dt=points[i].time-points[i-1].time;for(const[id,j]of map)timeScale=Math.max(timeScale,1.875*Math.abs(points[i].positions[id]-points[i-1].positions[id])/(dt*j.speed));}
 // Tiny cushion prevents floating-point boundary rejection in the editor.
 if(timeScale>1)timeScale*=1+1e-9;const duration=sourceDuration*timeScale;if(duration>maxDuration)fail('CAPTURE_LONG',{duration,sourceDuration,timeScale});
 const program={version:1,units:'deg',interpolation:'smooth',points:points.map(p=>({time:p.time*timeScale,positions:{...p.positions}}))};const compiled=validateProgram(program,[...map.values()]);const peaks=estimatePeakSpeed(compiled);if(Object.entries(peaks).some(([id,v])=>v>map.get(id).speed+1e-6))fail('CAPTURE_SPEED');
 return {program,stats:{inputFrames:samples.length,outputFrames:points.length,sourceDuration,duration,timeScale,clamped}};
}
