// Upgrade economy, actual combat effects and the between-wave UI.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_3D_URL||'http://localhost:8000').replace(/\/$/,'');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
const state=()=>page.evaluate(()=>game.state);
const advance=seconds=>page.evaluate(s=>game.test.advance(s),seconds);
const clear=()=>page.evaluate(()=>{game.test.clear();game.test.advance(.03)});
const launch=()=>page.locator('#next-wave').click();
const buy=id=>page.locator(`#upgrade-${id} button`).click();
const impact=i=>page.evaluate(i=>{const x=[-29,-18,-7,7,18,29][i],p=game.test.spawn(game.camera.position.clone().set(x,1.55,0),'normal');p.target=i;p.end.set(x,1.5,0);game.test.advance(.03)},i);
try{
 await page.goto(`${base}/game/missile-command.html?test`);await page.waitForFunction(()=>window.game);await page.locator('#play').click();
 await page.evaluate(()=>{game.test.spawn(game.camera.position.clone().set(0,25,0),'normal');game.test.burst(0,24);game.test.advance(.3)});assert.equal((await state()).credits,10,'interception grants credits');
 await page.locator('#restart').click();await clear();let s=await state();assert.equal(s.mode,'upgrades');assert.equal(s.credits,200);assert.equal(s.score,600);const frozen=s.simTime;await advance(100);assert.equal((await state()).credits,200,'wave reward is paid only once');assert.equal((await state()).simTime,frozen,'no combat during shopping');
 assert(await page.locator('#upgrade-armor button').isDisabled());assert.equal(await page.evaluate(()=>game.test.buy('armor')),false,'cannot overspend');assert.equal((await state()).credits,200);
 await buy('industry');assert.equal((await state()).credits,0);assert.equal((await state()).upgrades.industry,1);
 await launch();assert.equal(await page.evaluate(()=>game.test.buy('ammo')),false,'cannot buy during combat');await clear();assert.equal((await state()).credits,260,'industry increases next-wave income');
 await buy('ammo');await buy('cadence');assert.equal((await state()).credits,0);await launch();assert.deepEqual((await state()).ammo,[30,30,30]);
 await page.evaluate(()=>{game.test.aim(0,45);game.test.fire();game.test.advance(.17);game.test.fire()});assert.equal((await state()).shots,2,'rapid fire really reduces shot cooldown');
 await clear();await buy('armor');assert.deepEqual((await state()).cities,[3,3,3,3,3,3]);await launch();await impact(0);assert.equal((await state()).cities[0],2);for(let i=0;i<3;i++)await impact(1);assert.equal((await state()).cities[1],0);await clear();
 assert.equal((await state()).credits,270,'destroyed district produces no income');await buy('repair');assert.equal((await state()).cities[1],3,'rebuild restores destroyed district first');assert.equal((await state()).credits,90);await buy('repair');assert.equal((await state()).cities[0],3,'repair restores damaged district');assert.equal((await state()).credits,0);assert(await page.locator('#upgrade-repair button').isDisabled());assert.equal(await page.evaluate(()=>game.test.buy('repair')),false,'healthy city cannot consume credits');
 // Earn the budget through cleared waves rather than granting currency through a test shortcut.
 for(let i=0;i<28;i++){await launch();await clear()}
 for(const id of ['blast','speed','shield','ammo','cadence','armor','industry']){while((await state()).upgrades[id]<3)await buy(id);assert(await page.locator(`#upgrade-${id} button`).isDisabled());const balance=(await state()).credits;assert.equal(await page.evaluate(id=>game.test.buy(id),id),false);assert.equal((await state()).credits,balance,'capped upgrade never charges')}
 s=await state();assert.equal(s.maxHP,5);assert.equal(s.ammoCapacity,42);assert.equal(s.blastRadius,11.5);assert.equal(s.shieldCapacity,2);assert.equal(s.interceptorSpeed,99.75);
 await page.locator('#help').click();await page.keyboard.press('Escape');assert.equal((await state()).mode,'upgrades','help does not resume combat');
 for(const lang of ['en','pt','ja']){await page.locator('#lang-switcher').selectOption(lang);assert.equal(await page.locator('html').getAttribute('lang'),lang);assert.equal(await page.locator('.upgrade-card h4').count(),8);assert(!(await page.locator('#upgrade-panel').innerText()).includes('undefined'))}
 for(const size of [{width:960,height:640},{width:390,height:844},{width:667,height:375}]){await page.setViewportSize(size);const fit=await page.locator('#upgrade-panel').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=44&&r.bottom<=innerHeight});assert(fit,'shop fits the desktop or phone');assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight),false);assert(await page.locator('#next-wave').isVisible());await page.locator('#upgrade-repair').scrollIntoViewIfNeeded();assert(await page.locator('#upgrade-repair').isVisible())}
 await page.setViewportSize({width:960,height:640});await launch();assert.deepEqual((await state()).ammo,[42,42,42]);
 await page.evaluate(()=>{const p=game.test.spawn(game.camera.position.clone().set(9,25,0),'normal');p.speed=0;game.test.burst(0,25);game.test.advance(.85)});assert((await state()).kills>=1,'upgraded blast reaches a threat outside the base radius');
 await page.locator('#shield').click();assert.equal((await state()).shieldCharge,1);await advance(3.2);assert((await state()).shieldTime>2,'shield lasts longer than the base three seconds');const hp=(await state()).cities[0];await impact(0);assert.equal((await state()).cities[0],hp,'upgraded shield blocks damage');assert(await page.locator('#shield').isDisabled(),'cannot waste a charge while shield is active');await advance(3.1);await page.locator('#shield').click();assert.equal((await state()).shieldCharge,0,'second charge can be activated');
 await page.locator('#restart').click();s=await state();assert.equal(s.credits,0);assert(Object.values(s.upgrades).every(n=>n===0));assert.deepEqual(s.cities,[2,2,2,2,2,2]);assert.deepEqual(s.ammo,[24,24,24]);assert(s.best>0,'new run preserves the best score');
 assert.deepEqual(errors,[]);console.log('PASS: credits, prices, limits, all seven upgrades, repair/rebuild, combat effects, wave transitions, reset, translations and responsive shop.');
}finally{await browser.close()}
