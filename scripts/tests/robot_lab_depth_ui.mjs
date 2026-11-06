// Controlled landmark-worker fixture: tests capture UI/inferred-state plumbing,
// not model accuracy. Geometry and real inference have separate regressions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export async function runDepthUIChecks(page,base='http://127.0.0.1:8765') {
 const fixtureWorker=`
 let frame=0;
 const pt=(x,y,z=0)=>({x,y:-y,z:-z,visibility:1,presence:1});
 self.onmessage=({data})=>{
  const {id,type,image}=data;
  if(type==='load'){self.postMessage({id,type:'ready'});return;}
  const p=Array.from({length:33},()=>pt(0,0));
  p[23]=pt(.15,0);p[24]=pt(-.15,0);p[11]=pt(.25,.5);p[12]=pt(-.25,.5);
  p[13]=pt(.35,.5,.2);p[15]=pt(.08,.69,.1+.005*Math.sin(frame/8));
  p[14]=pt(-.25,.2);p[16]=pt(-.25,-.1);
  p[7]=pt(.07,.7);p[8]=pt(-.07,.7);p[0]=pt(0,.7,.12);
  p[25]=pt(.15,-.4);p[26]=pt(-.15,-.4);p[27]=pt(.15,-.8);p[28]=pt(-.15,-.8);
  p[29]=pt(.15,-.85);p[30]=pt(-.15,-.85);p[31]=pt(.15,-.85,.2);p[32]=pt(-.15,-.85,.2);
  const normalized=p.map(q=>({...q,x:q.x*.5+.5,y:q.y*.5+.45}));
  if(frame++%16>=8){p[15].visibility=.1;normalized[15].visibility=.1;}
  image?.close();self.postMessage({id,type:'result',results:{pose:{worldLandmarks:[p],landmarks:[normalized]},hand:null}});
 };`;
 await page.route('**/robot-lab/capture-worker.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:fixtureWorker}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:960,height:640});
 await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab?.capture);
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');let n=0;
  const draw=()=>{ctx.fillStyle=n++%2?'#ddd':'#ccc';ctx.fillRect(0,0,640,480);window.depthRaf=requestAnimationFrame(draw);};draw();
  window.depthStream=canvas.captureStream(15);navigator.mediaDevices.getUserMedia=async()=>window.depthStream;
 });
 try{
  await page.locator('[data-tab="capture"]').click();await page.locator('#cap-camera').click();
  for(const [lang,label]of [['en','Estimated arm'],['pt','Braço estimado'],['ja','腕を推定中']]){
   await page.locator('#lang-switcher').selectOption(lang);
   await page.waitForFunction(()=>robotLab.capture.lastResult?.inferredArms?.includes('left'),null,{timeout:15000});
   assert.equal(await page.locator('#cap-quality .estimated').innerText(),label);
  }
  await page.locator('#cap-name').fill('Occluded wrist fixture');await page.locator('#cap-record').click();
  await page.waitForFunction(()=>robotLab.capture.frames>=18,null,{timeout:20000});
  await page.locator('#cap-record').click();await page.waitForFunction(()=>robotLab.capture.clips===1);
  const clip=await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).capture.clips[0]);
  assert(clip.program.points.length>=2,'inferred arm positions can be recorded');
  assert(clip.program.points.every(p=>Object.values(p.positions).every(Number.isFinite)));
  await page.locator('#cap-use').click();await page.waitForFunction(()=>robotLab.state.playing);
  assert(await page.evaluate(()=>depthStream.getTracks().every(track=>track.readyState==='ended')));
  assert(await page.evaluate(()=>document.body.scrollHeight<=innerHeight&&document.body.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  return 'PASS inferred-arm EN/PT/JA badge, recording, local save, replay and compact layout';
 }finally{await page.evaluate(()=>{cancelAnimationFrame(window.depthRaf);window.depthStream?.getTracks().forEach(track=>track.stop());});}
}
if(process.argv[1]?.endsWith('robot_lab_depth_ui.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log(await runDepthUIChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
