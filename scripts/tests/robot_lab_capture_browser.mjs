// Serve repository root (VC_URL defaults to http://127.0.0.1:8765).
// Requires Playwright + Chrome; --fixtures generates small MP4 files with ffmpeg.
// The MP4 fixtures are animated/still real photographs: they exercise decoding,
// landmark inference and lifecycle, not the accuracy of articulated human motion.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const fixtureDirectory=ROOT+'_local/robot-lab-capture-fixtures/';

export async function createCaptureFixtures() {
 await mkdir(fixtureDirectory,{recursive:true});
 for(const [name,input] of [['pose','pose.jpg'],['hands','right_hands.jpg']]) {
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-loop','1','-i',ROOT+'scripts/tests/fixtures/vision-photo-lab/'+input,'-vf','scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:color=white','-t','6','-r','15','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',fixtureDirectory+name+'.mp4']);
 }
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=white:s=640x480:r=15','-t','4','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',fixtureDirectory+'blank.mp4']);
}

export async function runCaptureSourceChecks(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 const result=await page.evaluate(async () => {
  const {createCaptureSource}=await import('./capture-source.js');
  const {createRetargeter}=await import('./retarget.js');
  const retarget=createRetargeter(window.robotLab.joints,{mode:'body'});
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.style.cssText='position:fixed;width:240px;bottom:0;right:0;z-index:99';document.body.append(video);
  const frames=[],states=[],errors=[];let ended=0;
  const capture=createCaptureSource({video,onResults:(result,meta)=>frames.push({pose:result.pose?.landmarks?.length||0,hand:result.hand?.landmarks?.length||0,handPoint:result.hand?.worldLandmarks?.[0]?.[0],mapped:retarget.update(result,meta.mediaTime),meta}),onState:s=>states.push({...s}),onError:e=>errors.push(e.code||e.message),onEnded:()=>ended++});
  const until=async(test,timeout=45000)=>{const deadline=performance.now()+timeout;while(!test()){if(performance.now()>deadline)throw Error('Capture wait timed out: '+JSON.stringify({state:capture.state,errors,frames:frames.length}));await new Promise(r=>setTimeout(r,50));}};
  const file=async(name)=>new File([await (await fetch('/_local/robot-lab-capture-fixtures/'+name+'.mp4')).blob()],name+'.mp4',{type:'video/mp4'});
  const output={};
  const originalGetUserMedia=navigator.mediaDevices?.getUserMedia;
  let fakeStream,canvas,raf;
  try {
   capture.setMode('body');
   await capture.loadVideo(await file('pose'));
   await until(()=>frames.some(f=>f.pose===1));
   output.initialPose=frames.at(-1);output.loadedState={...capture.state};output.pausedOnLoad=video.paused;
   await capture.play();await until(()=>frames.some(f=>f.meta.mediaTime>.8));
   capture.pause();const pauseTime=video.currentTime;await new Promise(r=>setTimeout(r,200));output.pauseDrift=Math.abs(video.currentTime-pauseTime);
   const count=frames.length;await capture.seek(.25);await until(()=>frames.length>count);output.backwardSeek={...frames.at(-1)};
   await capture.seek(video.duration-.4);await capture.play();await until(()=>ended>0,10000);output.ended=ended;
   capture.stop();output.stoppedState={...capture.state};output.releasedSource=video.srcObject===null&&!video.getAttribute('src');
   frames.length=0;retarget.configure({mode:'hands'});capture.setMode('hands');await capture.loadVideo(await file('hands'));await until(()=>frames.some(f=>f.hand>=1));output.hands=frames.at(-1).hand;output.handPoint=frames.at(-1).handPoint;output.handMapping=frames.at(-1).mapped;
   frames.length=0;await capture.loadVideo(await file('blank'));await until(()=>frames.length>0);output.blank=frames.at(-1);
   capture.stop();
   // Real MediaPipe inference with a fake camera source, never a physical camera.
   const image=new Image();image.src='/scripts/tests/fixtures/vision-photo-lab/pose.jpg';await image.decode();
   canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');
   const draw=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,640,480);const scale=Math.min(640/image.width,480/image.height);ctx.drawImage(image,(640-image.width*scale)/2,(480-image.height*scale)/2,image.width*scale,image.height*scale);raf=requestAnimationFrame(draw);};draw();
   fakeStream=canvas.captureStream(15);let constraints;
   navigator.mediaDevices.getUserMedia=async c=>{constraints=c;return fakeStream;};
   frames.length=0;capture.setMode('body');await capture.startCamera();await until(()=>frames.some(f=>f.pose===1));
   output.camera={constraints,state:{...capture.state},frames:frames.length};capture.stop();output.trackStopped=fakeStream.getVideoTracks().every(t=>t.readyState==='ended');
   navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('test denial','NotAllowedError');};
   try{await capture.startCamera();}catch{}
   output.permissionError=errors.at(-1);
   let grant;const lateStream=canvas.captureStream(15);
   navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{grant=resolve;});
   const lateStart=capture.startCamera();await until(()=>!!grant);capture.stop();grant(lateStream);await lateStart.catch(()=>{});
   output.lateCameraReleased=lateStream.getTracks().every(track=>track.readyState==='ended');
   output.afterLateGrant={...capture.state};
  }finally{capture.dispose();video.remove();cancelAnimationFrame(raf);fakeStream?.getTracks().forEach(t=>t.stop());if(originalGetUserMedia)navigator.mediaDevices.getUserMedia=originalGetUserMedia;}
  output.errors=errors;return output;
 });
 assert.equal(result.initialPose.pose,1,'real pose model detects MP4 frame');
 assert.equal(result.initialPose.hand,0,'body-only mode omits hand inference');assert(result.initialPose.mapped.tracked>0,'real body landmarks map onto robot joints');
 assert(result.pausedOnLoad,'upload does not autoplay');assert(result.pauseDrift<.05,'pause stops source time');
 assert(result.backwardSeek.meta.mediaTime<.4,'backward seeking processes the requested frame');
 assert.equal(result.ended,1,'end notification occurs once');assert(result.releasedSource,'stop releases video source');
 assert(result.hands>=1,'real hand model detects hands MP4');assert(result.handMapping.tracked>0,'real hand world landmarks map onto finger joints: '+JSON.stringify({point:result.handPoint,mapping:result.handMapping}));assert.equal(result.blank.pose+result.blank.hand,0,'empty frame has no stale landmarks');
 assert.equal(result.camera.constraints.audio,false,'camera never requests microphone');assert(result.trackStopped,'stop releases camera tracks');
 assert.match(result.permissionError,/CAMERA_PERMISSION/,'denied camera has actionable error');
 assert(result.lateCameraReleased,'camera granted after Stop is immediately released');
 assert.equal(result.afterLateGrant.source,'none','late permission never resurrects camera');
 assert(result.errors.every(code=>code==='CAMERA_PERMISSION'),'no model/inference errors');
 delete result.initialPose.mapped.positions;delete result.backwardSeek.mapped.positions;delete result.blank.mapped.positions;delete result.handMapping.positions;
 return result;
}

export async function runCaptureUIChecks(page,base='http://127.0.0.1:8765') {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:960,height:640});await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab?.capture);
 await page.locator('#lang-switcher').selectOption('en');await page.locator('[data-tab="capture"]').click();
 await page.locator('#cap-mode').selectOption('body');
 await page.locator('#cap-file').setInputFiles(fixtureDirectory+'pose.mp4');
 await page.waitForFunction(()=>window.robotLab.capture.lastResult?.body,null,{timeout:60000});
 await page.locator('#cap-name').fill('Video pose capture');
 await page.locator('#cap-record').click();
 await page.waitForFunction(()=>window.robotLab.capture.frames>=4,null,{timeout:20000});
 await page.locator('#cap-record').click();
 await page.waitForFunction(()=>!window.robotLab.capture.recording);
 assert(await page.locator('#cap-use').isEnabled(),'detected take is usable');
 const before=await page.evaluate(()=>robotLab.state.program);
 await page.locator('#cap-edit').click();
 if(await page.locator('#confirm[open]').count())await page.locator('#confirm button[value="ok"]').click();
 await page.waitForFunction(previous=>JSON.stringify(robotLab.state.program)!==previous,JSON.stringify(before));
 assert.notDeepEqual(await page.evaluate(()=>robotLab.state.program),before,'capture becomes editable robot trajectory');
 assert(await page.locator('.capture-take').count()>0,'take is saved');
 await page.locator('[data-tab="capture"]').click();
 await page.locator('#cap-view-record').click();
 await page.locator('#cap-file').setInputFiles(fixtureDirectory+'blank.mp4');
 await page.waitForFunction(()=>window.robotLab.capture.source.source==='video'&&window.robotLab.capture.source.ready);
 const priorClips=await page.locator('.capture-take').count();
 await page.locator('#cap-record').click();await page.waitForTimeout(1200);await page.locator('#cap-record').click();
 assert.equal(await page.locator('.capture-take').count(),priorClips,'empty detection never creates a stale take');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')));
 assert(!JSON.stringify(saved).includes('blob:'),'project persists no video URL or bytes');
 await page.locator('#cap-source-stop').click();
 await page.locator('#cap-view-record').click();
 await page.locator('#cap-mirror').uncheck();
 await page.locator('.file-menu summary').click();
 const downloadPending=page.waitForEvent('download');await page.locator('#export-project').click();
 const projectDownload=await downloadPending;const exported=JSON.parse(await readFile(await projectDownload.path(),'utf8'));
 assert.equal(exported.capture.clips.length,priorClips,'project export includes recorded clips');
 assert.equal(exported.capture.settings.mirror,false,'project export includes capture settings');
 await page.locator('#file-input').setInputFiles({name:'capture-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#confirm button[value="ok"]').click();
 await page.waitForFunction(()=>document.querySelector('#toast').textContent==='Project imported.');
 assert.equal(await page.evaluate(()=>robotLab.capture.clips),priorClips,'project import restores recorded clips');
 await page.waitForTimeout(300);await page.reload();await page.waitForFunction(()=>window.robotLab?.capture);
 await page.locator('[data-tab="capture"]').click();
 assert.equal(await page.locator('.capture-take').count(),priorClips,'recorded motions survive project reload');
 assert.equal(await page.evaluate(()=>robotLab.capture.source.source),'none','video/camera sources are never persisted');
 for(const lang of ['en','pt','ja']){await page.locator('#lang-switcher').selectOption(lang);assert.equal(await page.locator('html').getAttribute('lang'),lang);}
 for(const size of [{width:960,height:640},{width:390,height:844}]){await page.setViewportSize(size);assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth&&document.body.scrollHeight<=innerHeight),'capture layout fits');}
 assert.deepEqual(errors,[]);
 return 'PASS capture UI, local video tracking/recording, editable trajectory, empty-take rejection, clip persistence and responsive translations';
}

export async function runEmbeddedCaptureCheck(page,base='http://127.0.0.1:8765') {
 await page.goto(base+'/page/index.html');
 await page.evaluate(url=>{const iframe=document.createElement('iframe');iframe.id='capture-embedded-qa';iframe.src=url;iframe.allow='camera; autoplay';iframe.style.cssText='width:960px;height:640px;position:fixed;inset:0;z-index:1000';document.body.append(iframe);},base+'/page/utils/robot-lab/index.html');
 const frame=await (await page.locator('#capture-embedded-qa').elementHandle()).contentFrame();
 await frame.waitForFunction(()=>window.robotLab);
 await frame.evaluate(async()=>{
  const {createCaptureSource}=await import('./capture-source.js');
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d');
  const draw=()=>{ctx.fillStyle='#eee';ctx.fillRect(0,0,320,240);window.qaEmbeddedRAF=requestAnimationFrame(draw);};draw();
  window.qaEmbeddedStream=canvas.captureStream(15);navigator.mediaDevices.getUserMedia=async()=>window.qaEmbeddedStream;
  const video=document.createElement('video');video.muted=true;document.body.append(video);window.qaEmbeddedSource=createCaptureSource({video});
  await window.qaEmbeddedSource.startCamera();
 });
 assert.equal(await frame.evaluate(()=>qaEmbeddedSource.state.source),'camera');
 await page.locator('#capture-embedded-qa').evaluate(el=>el.style.display='none');
 await frame.waitForFunction(()=>qaEmbeddedSource.state.source==='none');
 assert(await frame.evaluate(()=>qaEmbeddedStream.getTracks().every(t=>t.readyState==='ended')),'minimized iframe releases camera');
 await frame.evaluate(()=>{qaEmbeddedSource.dispose();cancelAnimationFrame(qaEmbeddedRAF);});
 await page.locator('#capture-embedded-qa').evaluate(el=>el.remove());
 return 'PASS hidden desktop-style iframe releases camera tracks';
}

if(process.argv[1]?.endsWith('robot_lab_capture_browser.mjs')) {
 if(process.argv.includes('--fixtures'))await createCaptureFixtures();
 const {chromium}=createRequire(import.meta.url)('playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{const context=await browser.newContext();const page=await context.newPage();const base=process.env.VC_URL||'http://127.0.0.1:8765';console.log('Source checks',await runCaptureSourceChecks(page,base));console.log(await runCaptureUIChecks(page,base));console.log(await runEmbeddedCaptureCheck(page,base));}finally{await browser.close();}
}
