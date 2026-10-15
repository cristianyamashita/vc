// Run with a local page/ server: VC_3D_URL=http://localhost:8000 node scripts/tests/missile_command_3d.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_3D_URL||'http://localhost:8000').replace(/\/$/,'');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
const state=()=>page.evaluate(()=>game.state);
const advance=seconds=>page.evaluate(s=>game.test.advance(s),seconds);
const project=async(x,y)=>page.evaluate(([x,y])=>{const p=game.camera.position.clone().set(x,y,0).project(game.camera),r=document.querySelector('#canvas').getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}},[x,y]);
const spawnImpact=async(i)=>page.evaluate(i=>{const x=[-29,-18,-7,7,18,29][i],p=game.test.spawn(game.camera.position.clone().set(x,1.55,0),'normal');p.target=i;p.end.set(x,1.5,0);game.test.advance(.03)},i);
try{
 await page.goto(`${base}/game/missile-command.html?test`);await page.waitForFunction(()=>window.game,{timeout:45000});
 assert.equal((await state()).mode,'ready');
 assert.equal(await page.locator('#canvas').evaluate(e=>e.clientWidth),960);
 await page.locator('#lang-switcher').selectOption('pt');assert.equal(await page.locator('#play').innerText(),'Iniciar defesa');
 await page.locator('#play').click();assert.equal((await state()).mode,'playing');
 const point=await project(0,24);await page.mouse.click(point.x,point.y);assert.equal((await state()).ammo[1],23,'click fires selected battery');
 await page.keyboard.press('1');await advance(.3);await page.keyboard.press('Space');assert.equal((await state()).ammo[0],23,'keyboard selects and fires west battery');
 await page.keyboard.press('p');let before=await state();await advance(3);assert.equal((await state()).simTime,before.simTime,'pause freezes simulation');
 await page.locator('#help').click();assert(await page.locator('#help-dialog').isVisible());await page.keyboard.press('Escape');assert.equal((await state()).mode,'paused','closing help keeps game paused');await page.locator('#play').click();
 await page.locator('#shield').click();assert.equal((await state()).shieldCharge,0);before=await state();await spawnImpact(0);assert.equal((await state()).cities[0],before.cities[0],'shield blocks impact');
 await advance(3.1);await spawnImpact(0);assert.equal((await state()).cities[0],1,'unshielded impact damages district');await spawnImpact(0);assert.equal((await state()).cities[0],0,'second hit destroys district');
 await page.locator('#restart').click();await page.evaluate(()=>{game.test.spawn(game.camera.position.clone().set(0,25,0),'normal');game.test.burst(0,24);game.test.advance(.3)});assert((await state()).kills>=1,'blast intercepts missile');assert((await state()).score>=25,'interception scores');
 await page.locator('#restart').click();await page.evaluate(()=>{game.test.clear();game.test.advance(4)});assert.equal((await state()).mode,'upgrades','clearing a wave opens upgrades');assert.equal((await state()).wave,1,'wave waits for the player');await page.locator('#next-wave').click();assert.equal((await state()).wave,2,'launch advances wave');assert.deepEqual((await state()).ammo,[24,24,24],'next wave reloads all batteries');assert.equal((await state()).shieldCharge,1);assert.equal((await state()).score,600,'surviving districts grant bonus');
 await page.evaluate(()=>{game.test.clear();game.test.spawn(game.camera.position.clone().set(0,24,0),'split');game.test.advance(.02)});assert.equal((await state()).enemies,2,'split missile becomes two threats');
 await page.locator('#restart').click();await page.evaluate(()=>{for(let i=0;i<25;i++){game.test.fire();game.test.advance(.21)}});assert.equal((await state()).ammo[1],0);assert((await state()).selected!==1,'empty battery switches automatically');
 await page.locator('#restart').click();for(let i=0;i<6;i++){await spawnImpact(i);await spawnImpact(i)}assert.equal((await state()).mode,'over');assert(await page.locator('#screen-panel').isVisible());await page.locator('#play').click();assert.deepEqual((await state()).cities,[2,2,2,2,2,2]);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).mode,'paused','losing window focus pauses');
 await page.locator('#theme-switcher').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.locator('#help').click();await page.locator('#quality').selectOption('low');await page.locator('#close-help').click();
 for(const lang of ['en','ja','pt']){await page.locator('#lang-switcher').selectOption(lang);assert.equal(await page.locator('html').getAttribute('lang'),lang);assert(await page.locator('#shield').innerText())}
 await page.reload();await page.waitForFunction(()=>window.game);assert.equal(await page.locator('html').getAttribute('data-theme'),'light');assert.equal(await page.locator('#quality').inputValue(),'low');assert((await state()).best>=600,'record survives reload');
 for(const size of [{width:1440,height:900},{width:960,height:640},{width:390,height:844},{width:667,height:375}]){await page.setViewportSize(size);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight),false,'no body overflow');const buttons=await page.locator('.dock button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}));assert(buttons.every(Boolean),'battery controls fit viewport')}
 assert.deepEqual(errors,[]);console.log('PASS: firing, batteries, interception, shield, damage, waves, splitting, game over, pause, persistence, EN/PT/JA and responsive layout.');
 const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const touch=await touchContext.newPage();await touch.goto(`${base}/game/missile-command.html`);await touch.waitForFunction(()=>window.game);await touch.locator('#play').tap();await touch.locator('#canvas').tap({position:{x:195,y:300}});assert.equal(await touch.evaluate(()=>game.state.shots),1,'touch fires');await touchContext.close();
 const blockedContext=await browser.newContext();const blocked=await blockedContext.newPage();await blocked.route('https://cdn.jsdelivr.net/**',r=>r.abort());await blocked.goto(`${base}/game/missile-command.html`);await blocked.waitForFunction(()=>window.bootFailure);assert(await blocked.locator('#retry').isVisible(),'failed dependency offers recovery');await blockedContext.close();
 console.log('PASS: touch input and CDN failure recovery.');
}finally{await browser.close()}
