// Regressions for record -> durable save -> replay, with real local MediaPipe.
// Requires repository HTTP server, Playwright/Chrome, and capture MP4 fixtures.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const fixture=fileURLToPath(new URL('../../_local/robot-lab-capture-fixtures/pose.mp4',import.meta.url));

export async function runCaptureFlowChecks(page,base='http://127.0.0.1:8765') {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:960,height:640});
 await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab?.capture);
 await page.locator('#lang-switcher').selectOption('en');await page.locator('[data-tab="capture"]').click();
 await page.locator('#cap-view-record').click();await page.locator('#cap-mode').selectOption('body');
 await page.locator('#cap-file').setInputFiles(fixture);await page.waitForFunction(()=>robotLab.capture.lastResult?.body,null,{timeout:60000});
 assert(await page.locator('#play').isDisabled(),'live tracking cannot fight timeline playback');
 await page.locator('#cap-name').fill('Saved wave');await page.locator('#cap-record').click();
 await page.waitForFunction(()=>robotLab.capture.frames>=6,null,{timeout:20000});await page.locator('#cap-record').click();
 await page.waitForFunction(()=>robotLab.capture.clips===1&&!robotLab.capture.recording);
 assert(await page.locator('#cap-saved-view').isVisible(),'Stop & save opens the saved library');
 assert.equal(await page.locator('#cap-storage-state').innerText(),'Saved in this browser');
 assert(await page.locator('#cap-video').evaluate(v=>v.paused),'source pauses after saving');
 const buttonBox=await page.locator('#cap-use').boundingBox();assert(buttonBox&&buttonBox.y>=44&&buttonBox.y+buttonBox.height<=640,'replay is visible without scrolling');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).capture.clips.length),1,'saved badge follows durable storage');
 assert(await page.evaluate(()=>!!robotLab.state.playback&&!robotLab.state.playing),'saved clip is prepared in robot transport');
 await page.locator('#play').click();await page.waitForFunction(()=>robotLab.state.playback?.playing&&robotLab.state.time>.04);await page.locator('#stop').click();assert.equal(await page.evaluate(()=>robotLab.state.time),0,'global transport controls saved clip');

 // Prepare a dirty editor and a pose distinct from the recording.
 await page.locator('[data-tab="motion"]').click();
 const editor={version:1,units:'deg',interpolation:'smooth',points:[{time:0,positions:{}},{time:2,positions:{neck_yaw:30}},{time:4,positions:{neck_yaw:0}}]};
 await page.locator('#script').fill(JSON.stringify(editor));await page.locator('#apply-script').click();
 await page.locator('#scrub').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#script').fill('{unfinished editor draft');
 const before=await page.evaluate(()=>({pose:robotLab.values,state:robotLab.state,draft:document.querySelector('#script').value}));
 await page.locator('[data-tab="capture"]').click();
 await page.locator('#cap-use').click();await page.waitForFunction(()=>robotLab.state.playback?.playing&&robotLab.state.playback.time>.04);
 assert.deepEqual(await page.evaluate(()=>robotLab.state.program),before.state.program,'replay does not replace editor program');
 assert.equal(await page.locator('#script').inputValue(),before.draft,'replay preserves dirty JSON');
 assert.equal(await page.evaluate(()=>robotLab.state.dirty),true,'dirty state is preserved');
 assert(await page.locator('#playback-name').innerText().then(s=>s.includes('Saved wave')),'transport identifies saved motion');
 assert(await page.locator('#cap-video').evaluate(v=>v.paused),'saved replay never resumes source video');
 await page.locator('#cap-use').click();assert.equal(await page.evaluate(()=>robotLab.state.playing),false,'same action pauses saved replay');
 const paused=await page.evaluate(()=>robotLab.state.time);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>robotLab.state.time),paused);
 const selectedPreview=await page.evaluate(()=>robotLab.state.playback.id);await page.locator('#cap-replay-stop').click();assert.equal(await page.evaluate(()=>robotLab.state.playback?.id),selectedPreview,'Stop keeps the saved clip selected');assert.equal(await page.evaluate(()=>robotLab.state.time),0);assert.equal(await page.evaluate(()=>robotLab.state.playing),false);
 await page.locator('#scrub').evaluate(el=>{el.value=String(Number(el.max)*.5);el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#exit-preview').click();
 assert.equal(await page.evaluate(()=>robotLab.state.playback),null);
 assert.deepEqual(await page.evaluate(()=>robotLab.values),before.pose,'exit restores exact editor pose');
 assert.equal(await page.evaluate(()=>robotLab.state.time),before.state.time,'exit restores editor time');
 assert.equal(await page.evaluate(()=>robotLab.state.frameIndex),before.state.frameIndex,'exit restores editor frame');
 assert.equal(await page.locator('#script').inputValue(),before.draft);

 await page.locator('.capture-take>button').first().click();await page.waitForFunction(()=>!!robotLab.state.playback);
 await page.locator('#cap-edit').click();await page.locator('#confirm button[value="cancel"]').click();
 assert.deepEqual(await page.evaluate(()=>robotLab.state.program),before.state.program,'canceling Edit preserves editor');
 await page.locator('#cap-edit').click();await page.locator('#confirm button[value="ok"]').click();
 await page.waitForFunction(()=>!robotLab.state.dirty&&!robotLab.state.playback&&document.querySelector('#tab-motion').hidden===false);
 assert.notDeepEqual(await page.evaluate(()=>robotLab.state.program),before.state.program,'Edit explicitly replaces editor');
 await page.waitForTimeout(300);await page.reload();await page.waitForFunction(()=>window.robotLab?.capture);
 await page.locator('[data-tab="capture"]').click();
 assert(await page.locator('#cap-saved-view').isVisible(),'saved library opens after reload');
 assert.equal(await page.evaluate(()=>robotLab.capture.source.source),'none','replay does not need original media');
 await page.locator('.capture-take>button').first().click();await page.waitForFunction(()=>robotLab.state.playback?.playing);
 await page.locator('#exit-preview').click();

 // Quota failure retains a useful session clip but never promises durable save.
 await page.locator('#cap-another').click();await page.locator('#cap-file').setInputFiles(fixture);
 await page.waitForFunction(()=>robotLab.capture.lastResult?.body,null,{timeout:60000});
 await page.locator('#cap-name').fill('Session only capture');
 await page.evaluate(()=>{window.realStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='vc.robotLab.v1')throw new DOMException('Quota test','QuotaExceededError');return window.realStorageSet.call(this,k,v);};});
 await page.locator('#cap-record').click();await page.waitForFunction(()=>robotLab.capture.frames>=6,null,{timeout:20000});await page.locator('#cap-record').click();
 await page.waitForFunction(()=>robotLab.capture.clips===2);
 assert.equal(await page.locator('#cap-storage-state').innerText(),'In this session · export to keep');
 assert(await page.locator('#cap-retry-save').isVisible());
 await page.locator('#lang-switcher').selectOption('pt');assert.match(await page.locator('#save-status').innerText(),/indisponível/,'language switch keeps failed storage state');await page.locator('#lang-switcher').selectOption('en');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).capture.clips.length),1,'failed clip was not silently persisted');
 await page.locator('#cap-use').click();await page.waitForFunction(()=>robotLab.state.playback?.playing);
 const latest=page.locator('.capture-take').first();await latest.locator('summary').click();
 const downloadPromise=page.waitForEvent('download');await latest.getByRole('button',{name:'Export motion JSON'}).click();const exported=await downloadPromise;
 const exportedProgram=JSON.parse(await readFile(await exported.path(),'utf8'));assert.equal(exportedProgram.version,1);assert(exportedProgram.points.length>=2);
 await page.locator('.file-menu summary').click();const projectDownloadPromise=page.waitForEvent('download');await page.locator('#export-project').click();const importedProject=await readFile(await (await projectDownloadPromise).path(),'utf8');
 await page.locator('#file-input').setInputFiles({name:'session-project.json',mimeType:'application/json',buffer:Buffer.from(importedProject)});await page.locator('#confirm button[value="ok"]').click();await page.waitForFunction(()=>robotLab.capture.source.source==='none');
 assert.equal(await page.locator('#cap-storage-state').innerText(),'In this session · export to keep','import does not claim a save when quota fails');assert.match(await page.locator('#save-status').innerText(),/Storage unavailable/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).capture.clips.length),1);
 await page.evaluate(()=>{Storage.prototype.setItem=window.realStorageSet;delete window.realStorageSet;});
 await page.locator('#cap-retry-save').click();assert.equal(await page.locator('#cap-storage-state').innerText(),'Saved in this browser');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).capture.clips.length),2,'retry persists all session clips');
 if(await page.locator('#exit-preview').isVisible())await page.locator('#exit-preview').click();
 for(const lang of ['pt','ja','en']){await page.locator('#lang-switcher').selectOption(lang);assert(await page.locator('#cap-use').innerText());}
 for(const size of [{width:960,height:640},{width:390,height:844}]){await page.setViewportSize(size);assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth&&document.body.scrollHeight<=innerHeight));}
 assert.deepEqual(errors,[]);
 return 'PASS capture save/replay flow, editor isolation, source pause, exact restoration, reload, quota fallback/export/retry, compact translated layout';
}

if(process.argv[1]?.endsWith('robot_lab_capture_flow.mjs')){
 const {chromium}=createRequire(import.meta.url)('playwright');const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{const context=await browser.newContext();console.log(await runCaptureFlowChecks(await context.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
