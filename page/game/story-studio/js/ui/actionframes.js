import { basePose, performAction } from '../anim/perform.js';
import { blendPose } from '../anim/blend.js';
import { JOINT_NAMES } from '../cast/rig.js';

export const copy = value => JSON.parse(JSON.stringify(value));
export function sampleFrames(frames, time, interpolation = 'smooth') {
  if (time <= frames[0].t) return copy(frames[0].pose);
  for (let i=1;i<frames.length;i++) {
    if (time > frames[i].t) continue;
    const a=frames[i-1], b=frames[i]; let k=(time-a.t)/Math.max(1e-8,b.t-a.t);
    if(interpolation==='step')k=time===b.t?1:0; else if(interpolation==='smooth')k=k*k*(3-2*k);
    return blendPose(a.pose,b.pose,k);
  }
  return copy(frames[frames.length-1].pose);
}
export function bakeMotion(action, part = action) {
  const duration=action.reps ? action.period : (action.duration || 4);
  const channels=[...(part.joints||[]),...(part.root||[])];
  const times=new Set([0,1]);
  for(const ch of channels)for(const key of ch.keys||[])times.add(key.t);
  if(channels.some(ch=>!ch.keys?.length && (ch.amp??1)!==0)){
    const count=Math.min(120,Math.max(16,Math.ceil(duration*12)));
    for(let i=0;i<=count;i++)times.add(i/count);
  }
  // Sampling includes the last endpoint even on a looping channel.
  const body=copy(part);body.breathe=0;
  for(const ch of [...(body.joints||[]),...(body.root||[])])ch.loop=false;
  return [...times].sort((a,b)=>a-b).map(t=>({t,pose:performAction({...action,breathe:0},{duration,period:duration},t*duration,body)}));
}
export function encodeFrames(frames, base, loop, interpolation='smooth') {
  const rest=basePose(base),out={pose:base,breathe:0,joints:[],root:[]};
  for(const joint of JOINT_NAMES)for(const [i,axis] of ['x','y','z'].entries()){
    const keys=frames.map(f=>({t:+f.t.toFixed(6),value:+((f.pose.joints[joint]?.[i]||0)-(rest.joints[joint]?.[i]||0)).toFixed(6)}));
    if(keys.some(k=>Math.abs(k.value)>1e-7))out.joints.push({joint,axis,keys,loop,interpolation});
  }
  for(const field of ['lift','shift','tiltZ']){
    const keys=frames.map(f=>({t:+f.t.toFixed(6),value:+((f.pose.root[field]||0)-(rest.root[field]||0)).toFixed(6)}));
    if(keys.some(k=>Math.abs(k.value)>1e-7))out.root.push({field,keys,loop,interpolation});
  }
  if(!out.joints.length&&!out.root.length)out.root.push({field:'lift',keys:frames.map(f=>({t:f.t,value:0})),loop,interpolation});
  return out;
}
export function upsertFrame(frames,time,pose,loop=false){
  const t=Math.max(0,Math.min(1,+time.toFixed(6))),idx=frames.findIndex(f=>Math.abs(f.t-t)<1e-5);
  if(idx>=0)frames[idx]={t,pose:copy(pose)};else frames.push({t,pose:copy(pose)});
  if(loop&&(t===0||t===1))for(const f of frames)if(f.t===0||f.t===1)f.pose=copy(pose);
  frames.sort((a,b)=>a.t-b.t);return frames;
}
