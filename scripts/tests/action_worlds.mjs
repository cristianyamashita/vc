/** Real-input integration checks for Station Survival, City Monster and Pirate Island.
 * ACTION_GAME_URL=http://127.0.0.1:8781 node scripts/tests/action_worlds.mjs
 * ?test=1 enables deterministic positioning and simulation advance, without UI cheats.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);let chromium;
({chromium}=require('playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.ACTION_GAME_URL||'http://127.0.0.1:8781';
const results=[];
try{
 for(const slug of ['station-survival','city-monster','pirate-island']){
  const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/page/game/${slug}/?test=1`);await page.waitForFunction(()=>window.__game?.ready,{timeout:60000});
  const state=()=>page.evaluate(()=>__game.snapshot());
  const advance=seconds=>page.evaluate(s=>__game.test.advance(s),seconds);
  const hold=async(key,seconds)=>{await page.keyboard.down(key);const result=await advance(seconds);await page.keyboard.up(key);return result};
  const tap=async key=>{await page.keyboard.down(key);await advance(.02);await page.keyboard.up(key)};
  const teleport=(x,z,yaw=0)=>page.evaluate(p=>__game.test.teleport(...p),[x,z,yaw]);
  const targets=()=>page.evaluate(()=>__game.test.targets());
  await page.click('#play');assert.equal((await state()).mode,'playing');
  const mechanics=[];
  if(slug==='station-survival'){
   await teleport(-20,4.7,0);await hold('KeyW',1);assert.ok((await state()).player.z>=4.39,'solid wall blocks player');mechanics.push('wall collision');
   await teleport(-20,-12,-Math.PI/2);await hold('Space',1.1);assert.ok((await state()).kills>=1,'aimed energy fire destroys drone');mechanics.push('hitscan combat');
   await tap('KeyR');await advance(1.6);assert.equal((await state()).ammo,12,'reload replenishes magazine');mechanics.push('weapon reload');
   const map=await targets();for(let i=0;i<3;i++){const cell=map.cells[i];await teleport(...cell);await advance(.02);assert.ok((await state()).carried>=1,'cell is collected');await teleport(...map.relays[i]);await tap('KeyE');assert.equal((await state()).restored,i+1,'relay consumes cell');}
   await teleport(...map.pod);await tap('KeyE');assert.equal((await state()).mode,'won','escape requires restored systems');mechanics.push('three relays and extraction victory');
   await page.evaluate(()=>{__game.restart();__game.start();__game.test.oxygen(.01)});await advance(.05);assert.equal((await state()).mode,'lost','oxygen depletion loses mission');mechanics.push('oxygen loss');
  }else if(slug==='city-monster'){
   await teleport(6,6);await advance(.7);const opacity=await page.evaluate(()=>__game.test.occlusion());assert.ok(opacity.some(values=>values.every(value=>value<.5)),'occluding building and its batched windows fade together');mechanics.push('camera occlusion fade');
   let map=await targets();await teleport(map[0][0],map[0][1]+5);await hold('KeyF',2);assert.ok((await state()).destroyed>=1,'smash collapses building');mechanics.push('smash and collapse');
   map=await targets();await teleport(map[0][0]+5,map[0][1]);await tap('Space');assert.ok((await state()).stompCD>5,'stomp starts cooldown');const damaged=await targets();assert.ok(damaged.some(b=>b[2]<100),'stomp damages buildings');mechanics.push('area stomp cooldown');
   await tap('KeyE');assert.ok((await state()).roarCD>9,'roar starts cooldown');mechanics.push('roar cooldown');
   for(let i=0;i<30&&(await state()).mode==='playing';i++){map=await targets();if(!map.length)break;await teleport(map[0][0],map[0][1]+5);await page.evaluate(()=>__game.test.health(200));await hold('KeyF',2.4)}
   assert.equal((await state()).destroyed,24,'all buildings destroyable');assert.equal((await state()).stage,3,'three district progression');assert.equal((await state()).mode,'won','24 buildings completes mission');mechanics.push('all districts and victory');
   await page.evaluate(()=>{__game.restart();__game.start();__game.test.health(1)});await teleport(-30,-25);await advance(14);assert.equal((await state()).mode,'lost','enemy shells can defeat monster');mechanics.push('tank damage and loss');
  }else{
   await advance(17);const map=await targets();assert.ok(map.raiders.length>0,'boats land raiders');mechanics.push('boat landing');
   await teleport(map.raiders[0][0],map.raiders[0][1]+1.8);await hold('KeyF',1.4);assert.ok((await state()).score>=100,'sword defeats raider');mechanics.push('sword combat');
   const before=(await state()).ammo;await hold('Space',.5);assert.ok((await state()).ammo<before,'pistol spends ammo');await tap('KeyR');await advance(1.6);assert.equal((await state()).ammo,6);mechanics.push('auto-aim pistol and reload');
   await page.evaluate(()=>{__game.restart();__game.start()});await teleport(12,8);await tap('KeyE');assert.equal((await state()).mounted,1,'E mounts nearby cannon');
   for(let i=0;i<12&&(await state()).mode!=='won';i++){await hold('Space',65);const snapshot=await state();if(snapshot.mode==='upgrade'){assert.ok(await page.locator('#choices button').count()===3,'three meaningful upgrades');await page.locator('#choices button').nth(2).click()}else if(snapshot.mode!=='won')throw Error('Cannon defense failed: '+JSON.stringify(snapshot))}
   assert.equal((await state()).mode,'won','cannon can defend five landings');assert.equal((await state()).wave,5);mechanics.push('mounted cannon, upgrades, five-wave victory');
   await page.evaluate(()=>{__game.restart();__game.start();__game.test.fort(1)});await advance(50);assert.equal((await state()).mode,'lost','unprotected fort can fall');mechanics.push('fort defeat');
  }
  await page.evaluate(()=>__game.restart());assert.equal((await state()).mode,'ready','restart returns to clean ready state');await page.click('#play');await page.click('#pause');const before=await state();await page.waitForTimeout(120);assert.equal((await state()).elapsed,before.elapsed,'pause freezes simulation');await page.click('#help-button');assert.equal(await page.locator('#help').evaluate(d=>d.open),true);await page.click('#close-help');assert.equal((await state()).mode,'paused','help does not silently resume');
  await page.selectOption('#lang-switcher','pt');assert.equal(await page.getAttribute('html','lang'),'pt');await page.selectOption('#lang-switcher','ja');assert.equal(await page.getAttribute('html','lang'),'ja');assert.equal(await page.evaluate(()=>document.body.scrollHeight>innerHeight),false);assert.deepEqual(errors,[],slug+' has no uncaught browser errors');results.push({slug,mechanics});await context.close();
 }
 console.log(JSON.stringify({passed:true,results},null,2));
}finally{await browser.close()}
