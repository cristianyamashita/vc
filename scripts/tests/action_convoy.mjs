import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const url=(process.env.VC_ACTION_URL||'http://127.0.0.1:8781/page')+'/game/armored-convoy/?test=1';
const state=()=>page.evaluate(()=>__game.snapshot());
const step=(seconds,keys=[])=>page.evaluate(({seconds,keys})=>__game.test.step(seconds,keys),{seconds,keys});
try{
 await page.goto(url);await page.waitForFunction(()=>window.__game?.test);
 await page.evaluate(()=>{__game.start();__game.test.spawnControl(false)});
 let s=await step(1,['d']);assert(s.position[0]>4,'convoy steering');s=await step(2,['a']);assert(s.position[0]>=-5.2&&s.position[0]<-4,'road boundary');
 await page.evaluate(()=>{__game.restart();__game.test.spawnControl(false);__game.test.spawn('jeep',0,-18);__game.test.aimAt(0,1.3,-18)});
 s=await step(1.3,[' ']);assert.equal(s.kills,1,'projectiles damage and destroy armored vehicle');assert(s.hits>=5,'multiple bullet hits');assert(s.score>=200,'kills earn points');
 s=await step(2,[' ']);assert(s.overheated,'sustained fire overheats');const shots=s.shots;s=await step(.5,[' ']);assert.equal(s.shots,shots,'overheat locks firing');s=await step(5);assert(!s.overheated&&s.heat<1,'release cools the weapon');
 await page.evaluate(()=>{__game.restart();__game.test.spawnControl(false);__game.test.aimAt(0,1.3,-18);__game.test.spawn('jeep',0,-18);__game.test.spawn('jeep',1.4,-18);__game.test.spawn('bike',-1.4,-18)});await step(.01);await page.evaluate(()=>__game.test.rocket());s=await step(1);assert(s.kills>=2,'rocket explodes across nearby enemies');assert.equal(s.rockets,3,'rocket consumes inventory');
 const before=s.hp;await page.evaluate(()=>{__game.test.shield();__game.test.damage(20)});assert.equal((await state()).hp,before,'active shield prevents damage');await step(4.2);await page.evaluate(()=>__game.test.damage(20));assert((await state()).hp<before,'shield expires');
 await page.evaluate(()=>{__game.restart();__game.test.spawnControl(false);__game.test.endSector()});s=await step(.1);assert.equal(s.mode,'upgrade','sector gates on threats cleared');await page.evaluate(()=>__game.test.upgrade('Damage'));s=await state();assert.equal(s.sector,2);assert.equal(s.mode,'playing');await page.evaluate(()=>{__game.test.clearThreats();__game.test.endSector()});await step(.1);await page.evaluate(()=>__game.test.upgrade('Cooling'));assert.equal((await state()).sector,3);
 await page.evaluate(()=>{__game.test.clearThreats();__game.test.endSector()});s=await step(.1);assert.equal(s.mode,'won','third sector completes campaign');assert(s.score>0);const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('vc-armored-convoy-v1')).best.normal);assert(record>0,'victory stores record');
 await page.evaluate(()=>{__game.restart();__game.test.damage(1000)});assert.equal((await state()).mode,'lost','depleted armor ends mission');await page.evaluate(()=>__game.restart());s=await state();assert.equal(s.sector,1);assert.equal(s.hp,125);assert.equal(s.score,0);assert.equal(s.rockets,4);assert.equal(s.enemies.length,0);assert.equal(s.shots,0);
 // Play a full campaign with aim/steering/shield inputs, without changing health,
 // distance, enemy positions or damage. This checks that normal combat can win.
 const campaign=await page.evaluate(()=>{
  __game.restart();let frames=0,upgrades=0;
  while(frames++<1800){
   let s=__game.snapshot();if(s.mode==='upgrade'){__game.test.upgrade(upgrades++===0?'Cooling':'Damage');continue;}if(s.mode!=='playing')break;
   const world=__game.test.entities();const target=world.enemies.slice().sort((a,b)=>(b.kind==='boss')-(a.kind==='boss')||b.position[2]-a.position[2])[0];
   const keys=[];if(target){__game.test.aimAt(target.position[0],1.3,target.position[2]);if(s.heat<82&&!s.overheated)keys.push(' ');if(target.kind==='boss'&&s.rockets>0)__game.test.rocket();}
   const closeObstacle=world.obstacles.find(p=>p[2]>-25&&p[2]<7&&Math.abs(p[0]-s.position[0])<2.2);
   if(closeObstacle)keys.push(closeObstacle[0]>=0?'a':'d');
   else{const supply=world.supplies.find(p=>p[2]>-35&&p[2]<4);if(supply&&Math.abs(supply[0]-s.position[0])>.5)keys.push(supply[0]>s.position[0]?'d':'a');}
   if(s.shieldCooldown===0&&world.hostiles.length>1)__game.test.shield();
   __game.test.step(.12,keys);
  }
  return{frames,state:__game.snapshot()};
 });
 assert.equal(campaign.state.mode,'won','an ordinary accurate player can complete the three-sector mission');
 assert.deepEqual(errors,[]);console.log('PASS convoy combat, steering, heat, rockets, shield, upgrades, win/loss, reset, records and full campaign',JSON.stringify(campaign.state));
}finally{await browser.close();}
