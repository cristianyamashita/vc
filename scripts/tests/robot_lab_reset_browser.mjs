// Controlled tracking tests recovery state, not MediaPipe model accuracy.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export async function runResetChecks(page,base='http://127.0.0.1:8765') {
 const worker=`
 const pt=(x,y,z=0)=>({x,y:-y,z:-z,visibility:1,presence:1});
 self.onmessage=({data})=>{
  const {id,type,image}=data;if(type==='load'){self.postMessage({id,type:'ready'});return;}
  const p=Array.from({length:33},()=>pt(0,0));
  p[23]=pt(.15,0);p[24]=pt(-.15,0);p[11]=pt(.25,.5);p[12]=pt(-.25,.5);
  p[13]=pt(.35,.24,.12);p[15]=pt(.45,.04,.26);p[14]=pt(-.25,.2);p[16]=pt(-.25,-.1);
  p[7]=pt(.07,.7);p[8]=pt(-.07,.7);p[0]=pt(0,.7,.12);
  p[25]=pt(.15,-.4);p[26]=pt(-.15,-.4);p[27]=pt(.15,-.8);p[28]=pt(-.15,-.8);
  const normalized=p.map(q=>({...q,x:q.x*.5+.5,y:q.y*.5+.45}));
  image?.close();setTimeout(()=>self.postMessage({id,type:'result',results:{pose:{worldLandmarks:[p],landmarks:[normalized]},hand:null}}),50);
 };`;
 await page.route('**/robot-lab/capture-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:worker}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:960,height:640});
 await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab?.capture);
 const original=await page.evaluate(()=>robotLab.state.program);
 await page.locator('#angle').fill('30');await page.locator('#angle').dispatchEvent('change');
 assert(Math.abs(await page.evaluate(()=>robotLab.values.neck_yaw))>10);
 await page.locator('#reset-pose').click();
 const neutral=async()=>assert(await page.evaluate(()=>Object.entries(robotLab.neutralPose).every(([id,v])=>Math.abs(robotLab.values[id]-v)<1e-7)),'all joints return to the collision-free neutral pose');
 await neutral();
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');let n=0;
  const draw=()=>{ctx.fillStyle=n++%2?'#ddd':'#ccc';ctx.fillRect(0,0,640,480);window.resetRaf=requestAnimationFrame(draw);};draw();
  window.resetStream=canvas.captureStream(15);navigator.mediaDevices.getUserMedia=async()=>window.resetStream;
 });
 try{
  await page.locator('[data-tab="capture"]').click();await page.locator('#cap-camera').click();
  await page.waitForFunction(()=>robotLab.capture.lastResult?.body&&Math.abs(robotLab.values.left_shoulder_pitch)>10);
  await page.locator('#cap-calibrate').click();
  await page.locator('#reset-pose').click();await neutral();
  assert(await page.evaluate(()=>robotLab.capture.resetPaused&&document.querySelector('#cap-video').paused));
  await page.waitForTimeout(500);await neutral();
  assert.equal(await page.evaluate(()=>robotLab.capture.lastResult),null,'old in-flight frames cannot restore stale pose');
  assert(await page.evaluate(()=>resetStream.getTracks().every(t=>t.readyState==='live')),'camera is kept for explicit resume');
  await page.locator('#cap-resume').click();
  await page.waitForFunction(()=>!robotLab.capture.resetPaused&&robotLab.capture.lastResult?.body&&Math.abs(robotLab.values.left_shoulder_pitch)>10);
  // Reset ends the current take durably, but keeps the source available.
  await page.locator('#cap-name').fill('Before reset');await page.locator('#cap-record').click();
  await page.waitForFunction(()=>robotLab.capture.frames>=8);
  await page.locator('#reset-pose').click();await neutral();
  assert(await page.evaluate(()=>robotLab.capture.clips===1&&!robotLab.capture.recording&&robotLab.capture.resetPaused));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).capture.clips.length),1);
  assert(await page.evaluate(()=>resetStream.getTracks().every(t=>t.readyState==='live')));
  await page.locator('#cap-resume').click();await page.waitForFunction(()=>robotLab.capture.lastResult?.body);
  // Video uses the same reset path and resumes at its paused source time.
  await page.locator('#cap-file').setInputFiles(process.env.ROBOT_RESET_VIDEO||'/Users/cristian/Downloads/kunfu.mp4');
  await page.waitForFunction(()=>robotLab.capture.source.ready&&robotLab.capture.source.source==='video');
  await page.locator('#cap-name').fill('Video before reset');await page.locator('#cap-record').click();
  await page.waitForFunction(()=>robotLab.capture.frames>=8);await page.locator('#reset-pose').click();await neutral();
  assert(await page.evaluate(()=>robotLab.capture.clips===2&&robotLab.capture.resetPaused&&!robotLab.capture.recording));
  const pausedTime=await page.evaluate(()=>document.querySelector('#cap-video').currentTime);
  await page.waitForTimeout(300);await neutral();
  assert.equal(await page.evaluate(()=>document.querySelector('#cap-video').currentTime),pausedTime);
  await page.locator('#cap-resume').click();
  await page.waitForFunction(t=>document.querySelector('#cap-video').currentTime>t+.15,pausedTime);
  await page.locator('#cap-view-saved').click();await page.locator('#cap-use').click();
  await page.waitForFunction(()=>robotLab.state.playing);await page.locator('#reset-pose').click();await neutral();
  assert.equal(await page.evaluate(()=>robotLab.state.playing),false);
  assert.deepEqual(await page.evaluate(()=>robotLab.state.program),original,'reset preserves editor trajectory');
  assert.equal(await page.evaluate(()=>robotLab.capture.clips),2);
  for(const [lang,label]of [['en','↺ Neutral'],['pt','↺ Neutra'],['ja','↺ 初期姿勢']]){
   await page.locator('#lang-switcher').selectOption(lang);assert.equal(await page.locator('#reset-pose').innerText(),label);
   for(const size of [{width:960,height:640},{width:390,height:700}]){
    await page.setViewportSize(size);
    assert(await page.evaluate(()=>document.body.scrollHeight<=innerHeight&&document.body.scrollWidth<=innerWidth),'compact body');
    assert(await page.locator('#reset-pose').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<50;}),'reset always visible');
   }
  }
  assert.deepEqual(errors,[]);
  return 'PASS neutral reset, tracking-reference recovery, stale-frame rejection, camera/video pause/resume, durable save, replay stop, EN/PT/JA and compact layout';
 }finally{await page.evaluate(()=>{cancelAnimationFrame(window.resetRaf);window.resetStream?.getTracks().forEach(track=>track.stop());});}
}
if(process.argv[1]?.endsWith('robot_lab_reset_browser.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log(await runResetChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
