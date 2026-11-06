// Serve repository root; requires Playwright + Chrome and bundled MediaPipe models.
// The default photograph exercises upper-body inference and camera/recording flow.
// Rotating it tests tracking responsiveness, not articulated-motion accuracy.
// Optionally set ROBOT_UPPER_BODY_VIDEO_URL to a locally served upper-body MP4
// for an additional real-motion test. No physical camera or microphone is used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

async function installCamera(page,videoURL=null) {
 await page.evaluate(async videoURL=>{
  const original=navigator.mediaDevices.getUserMedia;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d');let media;
  if(videoURL){media=document.createElement('video');media.muted=true;media.loop=true;media.playsInline=true;media.src=videoURL;await media.play();}
  else{media=new Image();media.src='/scripts/tests/fixtures/vision-photo-lab/pose.jpg';await media.decode();}
  const qa={angle:0,canvas,media,constraints:null};
  const draw=()=>{
   ctx.save();ctx.fillStyle='#ddd';ctx.fillRect(0,0,640,360);
   ctx.translate(320,180);ctx.rotate(qa.angle);ctx.translate(-320,-180);
   // Shoulders/head/arms remain in frame; hips are below the crop's bottom.
   if(videoURL)ctx.drawImage(media,0,0,640,360);
   else ctx.drawImage(media,220,130,560,300,0,0,640,360);
   ctx.restore();qa.raf=requestAnimationFrame(draw);
  };draw();qa.stream=canvas.captureStream(15);
  navigator.mediaDevices.getUserMedia=async constraints=>{qa.constraints=constraints;return qa.stream;};
  qa.dispose=()=>{cancelAnimationFrame(qa.raf);qa.stream.getTracks().forEach(t=>t.stop());if(videoURL){media.pause();media.removeAttribute('src');media.load();}navigator.mediaDevices.getUserMedia=original;};
  window.upperBodyQA=qa;
 },videoURL);
}

export async function runUpperBodySourceCheck(page,base='http://127.0.0.1:8765',videoURL=null) {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 await installCamera(page,videoURL);
 const result=await page.evaluate(async useVideo=>{
  const {createCaptureSource}=await import('./capture-source.js');
  const {createRetargeter}=await import('./retarget.js');
  const retarget=createRetargeter(robotLab.joints,{smoothing:0});
  const video=document.createElement('video');video.muted=true;video.playsInline=true;document.body.append(video);
  const frames=[],errors=[];let firstFrameTime;
  const source=createCaptureSource({video,onResults:(results,meta)=>{
   const mapped=retarget.update(results,meta.timestamp/1000),image=results.pose?.landmarks?.[0];
   firstFrameTime??=performance.now();
   frames.push({angle:upperBodyQA.angle,...mapped,hips:[23,24].map(i=>image?.[i]),shoulders:[11,12].map(i=>image?.[i])});
  },onError:e=>errors.push(e.code||e.message)});
  const until=async check=>{const end=performance.now()+45000;while(!check()){if(performance.now()>end)throw Error('Upper-body detection timed out: '+JSON.stringify({errors,frames:frames.length,last:frames.at(-1)}));await new Promise(r=>setTimeout(r,50));}};
  let trackStopped;
  try{
   await source.startCamera();
   if(useVideo)await until(()=>frames.length>=45&&performance.now()-firstFrameTime>=6000);
   else{
    await until(()=>frames.filter(f=>f.body).length>=12);
    upperBodyQA.angle=.18;
    await until(()=>frames.filter(f=>f.body&&f.angle===.18).length>=12);
   }
   source.stop();trackStopped=upperBodyQA.stream.getTracks().every(t=>t.readyState==='ended');
  }finally{source.dispose();video.remove();upperBodyQA.dispose();}
  return {frames,errors,trackStopped,constraints:upperBodyQA.constraints,joints:robotLab.joints};
 },!!videoURL);
 assert.deepEqual(result.errors,[],'real models process upper-body frames without errors');
 assert.equal(result.constraints.audio,false,'simulated webcam requests no microphone');
 assert(result.trackStopped,'stopping capture releases camera tracks');
 const upper=result.frames.filter(f=>f.body&&f.coverage.framing==='upper');
 assert(upper.length>=12,'upper-body-only frames drive the robot');
 assert(upper.some(f=>f.hips.some(p=>p&&(p.y>1||p.visibility<.55))),'the fixture excludes reliable hip landmarks');
 const lower=result.joints.filter(j=>/_(hip|knee|ankle)_/.test(j.id));
 for(let i=0;i<result.frames.length;i++)if(result.frames[i].coverage.framing==='upper')for(const j of lower){
  assert.equal(result.frames[i].positions[j.id],i?result.frames[i-1].positions[j.id]:j.home,'unseen legs hold their previous position');
 }
 const range=id=>Math.max(...upper.map(f=>f.positions[id]))-Math.min(...upper.map(f=>f.positions[id]));
 assert(upper.some(f=>Math.abs(f.positions.left_shoulder_roll)>15||Math.abs(f.positions.right_shoulder_roll)>15),'visible arms move away from home');
 assert(upper.some(f=>Math.abs(f.positions.neck_yaw)>5||Math.abs(f.positions.neck_pitch)>5),'visible head maps onto neck joints');
 if(videoURL){
  assert(range('neck_yaw')>10,'actual cropped-video head motion is tracked');
  assert(Math.max(range('left_elbow_pitch'),range('right_elbow_pitch'))>15,'actual cropped-video arm motion is tracked');
 }else{
  const first=upper.filter(f=>f.angle===0).at(-1),last=upper.filter(f=>f.angle===.18).at(-1);
  assert(first&&last,'both upper-body orientations are tracked');
  assert(Math.abs(last.positions.torso_roll-first.positions.torso_roll)>4,'shoulder tilt still drives torso roll without hips');
 }
 return {frames:result.frames.length,body:result.frames.filter(f=>f.body).length,upper:upper.length,neckYawRange:range('neck_yaw'),elbowRange:Math.max(range('left_elbow_pitch'),range('right_elbow_pitch')),torsoRollRange:range('torso_roll'),hips:upper.at(-1).hips};
}

export async function runUpperBodyUICheck(page,base='http://127.0.0.1:8765',{screenshotPath}={}) {
 const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
 await page.setViewportSize({width:960,height:640});
 await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab?.capture);
 await page.locator('#lang-switcher').selectOption('en');await page.locator('[data-tab="capture"]').click();
 await page.locator('#cap-mode').selectOption('body-hands');
 await installCamera(page);
 try{
  await page.locator('#cap-camera').click();
  await page.waitForFunction(()=>robotLab.capture.lastResult?.body&&robotLab.capture.lastResult.framing==='upper',null,{timeout:60000});
  for(const [language,label]of [['en','Upper body'],['pt','Parte superior'],['ja','上半身']]){
   await page.locator('#lang-switcher').selectOption(language);
   assert((await page.locator('#cap-quality').innerText()).includes(label),'partial-body badge is translated: '+language);
  }
  await page.locator('#lang-switcher').selectOption('en');
  const initial=await page.evaluate(()=>robotLab.values);
  await page.locator('#cap-name').fill('Seated upper-body regression');
  await page.locator('#cap-record').click();
  await page.waitForFunction(()=>robotLab.capture.frames>=4);
  for(const [language,label]of [['en','Recording motion…'],['pt','Gravando movimento…'],['ja','動作を記録中…']]){
   await page.locator('#lang-switcher').selectOption(language);
   await page.waitForFunction(expected=>document.querySelector('#cap-status').textContent===expected,label);
  }
  await page.locator('#lang-switcher').selectOption('pt');
  await page.evaluate(()=>upperBodyQA.angle=.18);
  await page.waitForFunction(previous=>Math.abs(robotLab.values.torso_roll-previous)>4,initial.torso_roll,{timeout:20000});
  await page.waitForFunction(()=>robotLab.capture.frames>=12);
  if(screenshotPath)await page.screenshot({path:screenshotPath});
  await page.locator('#cap-record').click();
  await page.waitForFunction(()=>!robotLab.capture.recording&&robotLab.capture.clips>0);
  assert(await page.locator('#cap-use').isEnabled(),'upper-body take can be replayed');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')));
  const clip=saved.capture.clips.find(c=>c.name==='Seated upper-body regression');
  assert(clip,'upper-body recording is saved in the project');
  assert(!JSON.stringify(saved).includes('blob:'),'camera media is never persisted');
  await page.locator('#cap-use').click();
  await page.waitForFunction(()=>robotLab.state.playing);
  assert.equal(await page.evaluate(()=>robotLab.capture.source.source),'none','replay releases camera');
  assert(await page.evaluate(()=>upperBodyQA.stream.getTracks().every(t=>t.readyState==='ended')),'replay stops camera tracks');
  await page.locator('#cap-replay-stop').click();
  assert.deepEqual(errors,[],'upper-body recording and replay cause no page errors');
  return 'PASS real upper-body camera inference, EN/PT/JA badge, live robot movement, recording, local save and replay';
 }finally{await page.evaluate(()=>upperBodyQA?.dispose());page.off('pageerror',onError);}
}

if(process.argv[1]?.endsWith('robot_lab_upper_body_browser.mjs')){
 const {chromium}=createRequire(import.meta.url)('playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage(),base=process.env.VC_URL||'http://127.0.0.1:8765';
  console.log('Upper-body camera:',await runUpperBodySourceCheck(page,base));
  if(process.env.ROBOT_UPPER_BODY_VIDEO_URL)console.log('Cropped motion video:',await runUpperBodySourceCheck(page,base,process.env.ROBOT_UPPER_BODY_VIDEO_URL));
  console.log(await runUpperBodyUICheck(page,base));
 }finally{await browser.close();}
}
