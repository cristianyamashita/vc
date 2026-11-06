/** Runtime integration checks for the three arena combat games.
 * Run with ACTION_GAME_URL=http://127.0.0.1:8781 node scripts/tests/action_combat.mjs.
 * Uses an isolated Chrome context. ?test=1 exposes only the test-session internals.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
let chromium;({chromium}=require('playwright'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.ACTION_GAME_URL||'http://127.0.0.1:8781';
const results=[];
try{
 for(const slug of ['robot-arena','neon-tanks','ruins-knight']){
  const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/page/game/${slug}/?test=1`);
  await page.waitForFunction(()=>window.__combatTest&&window.__game.getState().state==='ready',{timeout:60000});
  assert.equal(await page.evaluate(()=>document.body.scrollHeight>innerHeight),false,`${slug}: no body overflow`);
  await page.locator('#overlay-action').click();
  assert.equal((await page.evaluate(()=>__game.getState())).state,'playing');
  const before=await page.evaluate(()=>__game.getState().player);
  await page.keyboard.down('w');await page.waitForTimeout(220);await page.keyboard.up('w');
  const after=await page.evaluate(()=>__game.getState().player);assert.notEqual(after.z,before.z,`${slug}: keyboard moves`);
  await page.locator('#pause').click();const paused=await page.evaluate(()=>__game.getState().elapsed);await page.waitForTimeout(150);assert.equal((await page.evaluate(()=>__game.getState())).elapsed,paused,`${slug}: time freezes`);
  await page.selectOption('#lang-switcher','pt');assert.equal(await page.getAttribute('html','lang'),'pt');await page.selectOption('#lang-switcher','ja');assert.equal(await page.getAttribute('html','lang'),'ja');await page.selectOption('#lang-switcher','en');
  const details=await page.evaluate((slug)=>{
   const {app:a,game:g}=__combatTest;const assert=(x,m)=>{if(!x)throw Error(m)};a.start();a.state='paused';let mechanics=[];
   if(slug==='robot-arena'){
    const p=g.player;p.x=0;p.z=3;a.move(p,0,-8,.65);assert(p.z>=2.4,'cover blocks movement');mechanics.push('cover collision');
    p.x=0;p.z=10;p.angle=0;p.inv=0;p.hp=120;p.energy=100;g.guard=true;g.hurt(20,{x:0,z:14});assert(p.hp===120&&p.energy<100,'front shield absorbs damage');p.inv=0;g.hurt(20,{x:0,z:5});assert(p.hp<120,'rear bypasses shield');mechanics.push('directional shield');
    a.keys={};a.pressed={Space:true};g.guard=false;p.energy=100;p.inv=0;g.update(.016);assert(p.dash>0&&p.inv>0&&p.energy<100,'dash costs energy and protects');mechanics.push('dash');
    a.start();a.state='paused';g.remaining=0;g.spawn();const e=a.enemies[0];e.x=5;e.z=10;e.hp=1;g.player.x=5;g.player.z=14;g.player.angle=Math.PI;g.shoot(g.player,Math.PI,true,25,39);for(let i=0;i<15;i++)g.bullets(.016);assert(e.dead,'plasma projectile destroys target');mechanics.push('projectile damage');
    a.start();for(let round=1;round<=5;round++){while(g.remaining>0)g.spawn();for(const enemy of [...a.enemies])g.kill(enemy);a.enemies=[];g.transition=1.3;g.update(.016);if(round<5){assert(a.state==='upgrade','wave offers upgrade');document.querySelector('#choices button').click();assert(g.wave===round+1,'wave advances')}else assert(a.state==='won','fifth wave wins')}
   }else if(slug==='neon-tanks'){
    const p=g.player;assert(g.height(-17,11)>g.height(-17,5),'ramp height rises');mechanics.push('ramp elevation');
    p.x=20;p.z=0;p.angle=Math.PI/2;p.inv=0;const hp=p.hp;a.enemies=[];g.fire(p,true);const shot=g.shots[0];for(let i=0;i<40;i++)g.bullets(.016);assert(shot.bounces>=1&&shot.vx<0,'shell reflects at wall');assert(p.hp<hp,'own bank shot can damage tank');mechanics.push('live ricochet and self collision');
    a.start();a.state='paused';g.player.x=0;g.player.z=15;g.layMine();const mine=g.mines[0];assert(mine&&g.player.mines===2,'mine uses inventory');const e=a.enemies[0];e.x=mine.x;e.z=mine.z;e.hp=1;mine.arm=0;a.keys={};a.pressed={};g.update(.016);assert(e.dead,'armed mine damages nearby enemy');mechanics.push('proximity mine');
    a.start();for(let sector=1;sector<=4;sector++){for(const enemy of [...a.enemies])g.hitEnemy(enemy,10000);a.enemies=[];g.transition=1.6;g.update(.016);if(sector<4){assert(a.state==='upgrade','sector offers upgrade');document.querySelector('#choices button').click();assert(g.sector===sector+1,'sector advances')}else assert(a.state==='won','fourth sector wins')}
   }else{
    const p=g.player;p.x=0;p.z=10;p.angle=0;p.inv=0;p.hp=120;p.stamina=100;g.guard=true;p.parry=.2;const melee={x:0,z:14,type:'sentinel',wind:.2,charging:0};g.hurt(20,melee);assert(p.hp===120&&melee.stun>0,'timed front shield parries');p.inv=0;g.hurt(20,{x:0,z:5,type:'sentinel'});assert(p.hp<120,'shield cannot block behind');mechanics.push('directional guard and parry');
    a.enemies=[];g.spawn(0,12,'sentinel');g.spawn(0,8,'sentinel');const front=a.enemies[0],back=a.enemies[1],frontHP=front.hp,backHP=back.hp;g.guard=false;p.cool=0;p.dodge=0;p.stamina=100;p.angle=0;g.strike();assert(front.hp<frontHP&&back.hp===backHP,'sword is a forward arc');mechanics.push('sword arc');
    a.keys={};a.pressed={Space:true};p.stamina=100;p.dodge=0;g.update(.016);assert(p.dodge>0&&p.inv>0&&p.stamina<100,'dodge uses stamina and protects');mechanics.push('stamina dodge');
    a.start();a.state='paused';const trap=g.traps[0];g.clock=3.5-trap.offset;g.player.x=trap.x;g.player.z=trap.z;g.player.inv=0;a.keys={};a.pressed={};const hp=g.player.hp;g.update(.016);assert(g.player.hp<hp,'active spikes damage player');mechanics.push('timed spike traps');
    a.start();for(let room=1;room<=3;room++){for(const enemy of [...a.enemies])g.kill(enemy);a.enemies=[];a.keys={};a.pressed={};g.update(.016);if(room<3){assert(g.gateOpen,'cleared chamber opens gate');g.player.x=0;g.player.z=-16;g.update(.016);assert(a.state==='upgrade','gate offers upgrade');document.querySelector('#choices button').click();assert(g.room===room+1,'chamber advances')}else assert(a.state==='won','guardian defeated wins')}
   }
   assert(a.prefs.best>0,'victory stores record');const record=a.prefs.best;a.start();g.player.hp=1;g.player.inv=0;g.guard=false;g.hurt(999,{x:g.player.x+5,z:g.player.z},false);assert(a.state==='lost','fatal damage loses');a.start();assert(a.state==='playing'&&g.player.hp===g.player.maxHp&&g.score===0,'restart resets run');assert(a.prefs.best===record,'restart preserves record');a.pause();return{mechanics,record,state:__game.getState()};
  },slug);
  await page.setViewportSize({width:390,height:700});
  await page.locator('#help-button').click();await page.locator('#touch-setting').check();await page.locator('#help-close').click();
  await page.evaluate(()=>__game.restart());
  const cdp=await context.newCDPSession(page);
  const touchHold=async selector=>{const box=await page.locator(selector).boundingBox();assert(box,`${slug}: touch control visible`);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await page.waitForTimeout(220);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};
  const touchBefore=await page.evaluate(()=>__game.getState().player.z);await touchHold('[data-key="KeyW"]');assert.notEqual(await page.evaluate(()=>__game.getState().player.z),touchBefore,`${slug}: real touch dpad moves`);
  await touchHold('[data-key="fire"]');assert(await page.evaluate(()=>__combatTest.game.player.cool>0),`${slug}: real touch attack fires`);
  const resourceBefore=await page.evaluate(()=>__combatTest.game.player.energy??__combatTest.game.player.stamina);await touchHold('[data-key="Space"]');if(slug!=='neon-tanks')assert((await page.evaluate(()=>__combatTest.game.player.energy??__combatTest.game.player.stamina))<resourceBefore,`${slug}: real touch dash consumes resource`);
  if(slug==='neon-tanks'){
   const mineBefore=await page.evaluate(()=>__combatTest.game.player.mines);await touchHold('[data-key="ShiftLeft"]');assert.equal(await page.evaluate(()=>__combatTest.game.player.mines),mineBefore-1,'tank touch mine deploys');
   const forward=await page.locator('[data-key="KeyW"]').boundingBox(),boost=await page.locator('[data-key="Space"]').boundingBox();
   const energyBefore=await page.evaluate(()=>__combatTest.game.player.energy);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:forward.x+forward.width/2,y:forward.y+forward.height/2,id:1},{x:boost.x+boost.width/2,y:boost.y+boost.height/2,id:2}]});await page.waitForTimeout(220);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert((await page.evaluate(()=>__combatTest.game.player.energy))<energyBefore,'tank multitouch drive and boost works');
  }
  assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight),false,`${slug}: mobile has no body scrolling`);
  details.mechanics.push('real touch movement, attack and action controls');
  assert.deepEqual(errors,[],`${slug}: no runtime errors`);results.push({slug,...details});await context.close();
 }
 console.log(JSON.stringify({passed:true,results},null,2));
}finally{await browser.close()}
