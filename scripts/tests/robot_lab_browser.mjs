import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function runRobotLabChecks(page, base='http://127.0.0.1:8765') {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:960,height:640});
 await page.goto(base+'/page/utils/robot-lab/index.html');
 await page.waitForFunction(()=>window.robotLab);
 await page.evaluate(()=>{localStorage.removeItem('vc.robotLab.v1');});
 // Use a fresh context in the command-line runner; project import below also verifies roundtrip.
 await page.locator('#lang-switcher').selectOption('en');
 await page.locator('[data-tab="joint"]').click();
 await page.locator('#neutral').click();
 assert.equal(await page.evaluate(()=>robotLab.inspect().joints),64);
 assert(await page.evaluate(()=>robotLab.inspect().finite));
 await page.locator('#joint-picker').selectOption('left_index_2');
 await page.locator('#angle').fill('-45');await page.locator('#angle').press('Tab');
 assert.equal(await page.evaluate(()=>robotLab.values.left_index_2),-45);
 await page.locator('#pose-name').fill('Precision grip');await page.locator('#save-pose').click();
 await page.locator('#neutral').click();await page.getByRole('button',{name:'Precision grip',exact:true}).click();
 assert.equal(await page.evaluate(()=>robotLab.values.left_index_2),-45);
 await page.locator('[data-tab="motion"]').click();
 const simple={version:1,units:'deg',interpolation:'smooth',points:[{time:0,positions:{}},{time:2,positions:{neck_yaw:30}},{time:4,positions:{neck_yaw:0}}]};
 const apply=async p=>{await page.locator('#script').fill(JSON.stringify(p));await page.locator('#apply-script').click();};
 await apply(simple);assert.equal(await page.locator('.keyframe').count(),3);
 await page.locator('#scrub').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>robotLab.values.neck_yaw),15);
 await page.locator('#play').click();await page.waitForFunction(()=>robotLab.state.playing&&robotLab.state.time>1.05);await page.locator('#stop').click();
 assert.equal(await page.evaluate(()=>robotLab.values.neck_yaw),0);
 // Invalid input cannot replace the compiled sequence.
 await page.locator('#script').fill('{broken');await page.locator('#apply-script').click();
 assert(await page.locator('#script-status').evaluate(el=>el.classList.contains('error')));
 assert.equal(await page.evaluate(()=>robotLab.state.program.points.length),3);
 await apply({...simple,points:[{time:0,positions:{}},{time:2,positions:{neck_yaw:1000}}]});
 assert.match(await page.locator('#script-status').innerText(),/LIMIT/);
 await apply(simple);
 // Capture, replace, retime and delete operate on actual pose values.
 await page.locator('[data-tab="joint"]').click();await page.locator('#joint-picker').selectOption('neck_yaw');
 await page.locator('#angle').fill('20');await page.locator('#angle').press('Tab');await page.locator('#capture').click();
 assert.equal(await page.evaluate(()=>robotLab.state.program.points.at(-1).positions.neck_yaw),20);
 await page.locator('[data-tab="motion"]').click();await page.locator('#frame-time').fill('7');await page.locator('#retime').click();
 assert.equal(await page.evaluate(()=>robotLab.state.program.points.at(-1).time),7);
 await page.locator('#loop').click();assert.equal(await page.locator('#loop').isChecked(),false);
 await page.locator('#delete-frame').click();assert.equal(await page.locator('.keyframe').count(),3);
 // Working limits apply to scrubbing and survive reload.
 await page.locator('[data-tab="joint"]').click();await page.locator('.limits').evaluate(el=>el.open=true);
 await page.locator('#joint-max').fill('10');await page.locator('#apply-limits').click();
 const before=await page.evaluate(()=>robotLab.values.neck_yaw);
 await page.locator('#scrub').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>robotLab.values.neck_yaw),before);
 await page.locator('#joint-max').fill('85');await page.locator('#apply-limits').click();
 await page.locator('[data-tab="motion"]').click();await apply(simple);
 await page.locator('[data-tab="style"]').click();await page.locator('[data-palette="copper"]').click();
 await page.locator('#lang-switcher').selectOption('pt');assert.match(await page.title(),/Laboratório/);
 await page.locator('#theme-switcher').click();
 await page.locator('.file-menu summary').click();const downloadPromise=page.waitForEvent('download');await page.locator('#export-project').click();const download=await downloadPromise;
 const file=await download.path();const exported=JSON.parse(await readFile(file,'utf8'));
 assert.equal(exported.colors.shell,'#bc7951');assert(exported.poses.some(p=>p.name==='Precision grip'));
 await page.locator('#file-input').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('#confirm button[value="ok"]').click();
 assert.equal(await page.locator('#color-shell').inputValue(),'#bc7951');
 await page.locator('.file-menu summary').click();const rosPromise=page.waitForEvent('download');await page.locator('#export-ros').click();const rosDownload=await rosPromise;
 const ros=JSON.parse(await readFile(await rosDownload.path(),'utf8'));
 assert.equal(ros.joint_names.length,64);assert(Math.abs(ros.points[1].positions[ros.joint_names.indexOf('neck_yaw')]-Math.PI/6)<1e-9);
 assert.equal(ros.points[1].time_from_start.sec,2);assert(ros.points[1].velocities.every(v=>v===0));
 await page.locator('[data-tab="motion"]').click();await page.locator('#script').fill('');
 await page.waitForTimeout(350);await page.reload();await page.waitForFunction(()=>window.robotLab);
 assert.equal(await page.locator('#script').inputValue(),'');assert.equal(await page.evaluate(()=>robotLab.state.dirty),true);
 await apply(simple);await page.locator('#lang-switcher').selectOption('ja');assert.equal(await page.title(),'ロボットラボ');
 await page.locator('#help-btn').click();assert(await page.locator('#help').isVisible());await page.locator('#close-help').click();
 for(const viewport of [{width:960,height:640},{width:390,height:844},{width:720,height:640}]){await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth&&document.body.scrollHeight<=innerHeight),'body fits '+viewport.width);}
 assert.deepEqual(errors,[]);
 return 'PASS: 64-joint rig, pose library, interpolation, playback, validation, keyframes, limits, loop, colors, project/ROS exports, import, persistence, EN/PT/JA, themes and responsive layouts';
}
if(process.argv[1]?.endsWith('robot_lab_browser.mjs')) {
 const {chromium}=await import('playwright');const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{const context=await browser.newContext();console.log(await runRobotLabChecks(await context.newPage(),process.env.ROBOT_LAB_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
