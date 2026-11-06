/** Browser integration tests: node scripts/tests/action_mobility.mjs
 * Serve repository at ACTION_GAMES_URL (defaults to http://127.0.0.1:8781).
 * Optional PLAYWRIGHT_MODULE points to a locally installed Playwright package.
 * Test hooks exist only when the game URL includes ?test=1. Gameplay functions,
 * projectile collisions, integration steps and completion rules remain real.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const playwright=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=require(playwright);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:960,height:640}});
await page.addInitScript(()=>{let seed=18473;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.ACTION_GAMES_URL||'http://127.0.0.1:8781';
async function load(slug){await page.goto(`${base}/page/game/${slug}/?test=1`);await page.waitForFunction(()=>window.__game?.test);await page.evaluate(()=>window.__game.start());}
try{
 await load('rooftop-ninja');
 const ninja=await page.evaluate(()=>{
  const g=window.__game,t=g.test,result={};
  t.step(.48,['KeyW']);t.step(.3,['KeyW','Space']);t.step(.1,['KeyW']);t.step(.65,['KeyW','Space']);result.traversal=t.step(.3,['KeyW']);
  // Land on the next roof using two real jumps, then engage its sentinel.
  for(let i=0;i<4;i++){t.step(.1,['KeyW']);t.step(.44,['KeyF']);t.step(.01,[])}result.melee=g.snapshot();
  g.restart();t.relocate(2,0,2);for(let i=0;i<3;i++){t.step(.4,['KeyE']);t.step(.02,[])}result.ranged=g.snapshot();
  t.relocate(3);t.step(.04);result.checkpoint=g.snapshot();t.fall();result.fall=t.step(.04);
  g.restart();for(const roof of[2,5,8]){t.relocate(roof,0,-1);t.step(.04)}result.seals=g.snapshot();
  t.relocate(11,-1.8,-1.5);for(let i=0;i<10&&g.snapshot().mode==='running';i++){t.step(.43,['KeyF']);t.step(.01,[])}result.captain=t.world().enemies.find(n=>n.boss);
  t.relocate(11,0,-3);result.victory=t.step(.04);g.restart();t.damage(100);result.defeat=g.snapshot();g.restart();result.reset=g.snapshot();return result;
 });
 assert.equal(ninja.traversal.roof,2,'double jump must traverse the first gap');assert.equal(ninja.traversal.grounded,true);assert.ok(ninja.melee.score>=120,'sword must defeat a sentinel');assert.ok(ninja.ranged.ammo<=11,'shuriken ammunition must be spent');assert.ok(ninja.ranged.score>=120,'shuriken projectiles must damage sentinels');assert.equal(ninja.checkpoint.checkpoint,4);assert.equal(ninja.fall.health,ninja.checkpoint.health-25);assert.equal(ninja.fall.roof,4);assert.equal(ninja.seals.seals,3);assert.equal(ninja.captain.dead,true);assert.equal(ninja.victory.mode,'won');assert.equal(ninja.defeat.mode,'lost');assert.equal(ninja.reset.health,100);assert.equal(ninja.reset.seals,0);assert.equal(ninja.reset.enemies,14);console.log('PASS Rooftop Ninja: double jump, sword, shurikens, seals, checkpoint, rescue, captain, win/loss/reset');
 await load('drone-hunter');
 const drone=await page.evaluate(()=>{
  const g=window.__game,t=g.test,result={};t.encounter();for(let i=0;i<8;i++){t.aimAt('foe');t.step(.15,['Space'])}result.combat=g.snapshot();
  t.step(5,['Space']);result.hot=g.snapshot();t.step(3);result.cool=g.snapshot();t.damage(70);result.damage=g.snapshot();t.setDistance(450);result.sector2=t.step(.03);t.setDistance(870);result.sector3=t.step(.03);t.step(.02,['KeyQ']);result.emp=g.snapshot();
  g.restart();t.setDistance(1301);t.step(.03);result.bossStart=g.snapshot();
  // Shoot the core before the nodes to verify that the shield blocks damage.
  t.aimAt('boss');t.step(.15,['Space']);t.step(.8);result.shieldedCore=t.world().boss.health;
  // Re-aim each short burst at the real moving node; shots use swept collisions.
  for(let i=0;i<3;i++)for(let step=0;step<35&&!t.world().nodes[i].dead&&g.snapshot().mode==='running';step++){t.aimAt('node',i);const move=step%24<12?'KeyD':'KeyA';t.step(.12,['Space',move]);}
  result.nodes=t.world().nodes;
  for(let i=0;i<220&&g.snapshot().mode==='running';i++){t.aimAt('boss');t.step(.12,['Space',i%24<12?'KeyA':'KeyD']);if(i%20===0){t.step(.02,['KeyE']);t.step(.02,['KeyQ']);}}
  result.victory=g.snapshot();g.restart();t.damage(200);result.defeat=g.snapshot();g.restart();result.reset=g.snapshot();return result;
 });
 assert.ok(drone.combat.score>=120,'twin cannon projectiles must hit a moving drone');assert.ok(drone.cool.heat<drone.hot.heat,'cannons must cool when released');assert.equal(drone.damage.shield,0);assert.equal(drone.damage.hull,90);assert.equal(drone.sector2.sector,2);assert.equal(drone.sector2.shield,60);assert.equal(drone.sector3.sector,3);assert.ok(drone.emp.empCooldown>11);assert.equal(drone.bossStart.boss.nodes,3);assert.equal(drone.shieldedCore,60,'carrier core must remain shielded');assert.ok(drone.nodes.every(n=>n.dead),'all three shield nodes must be destructible');assert.equal(drone.victory.mode,'won');assert.equal(drone.defeat.mode,'lost');assert.equal(drone.reset.hull,100);assert.equal(drone.reset.boss,null);console.log('PASS Drone Hunter: projectile combat, heat/cooling, damage/shields, sectors, EMP, carrier nodes, win/loss/reset');
 await load('grapple-arena');
 const grapple=await page.evaluate(()=>{
  const g=window.__game,t=g.test,result={};t.step(.01,['KeyE']);result.attached=g.snapshot();t.step(1.3,['Space']);result.reeled=g.snapshot();t.step(.01,['KeyQ']);result.released=g.snapshot();result.landing=t.step(.45);t.step(2,['KeyF']);result.combat=g.snapshot();
  t.relocate(3);t.step(.03);result.checkpoint=g.snapshot();t.fall();result.fall=t.step(.03);
  g.restart();for(let i=1;i<=6;i++){t.relocate(i);t.step(.03)}result.crystals=g.snapshot();
  t.relocate(8);for(let i=0;i<30&&g.snapshot().mode==='running';i++)t.step(.6,i%2?['KeyF']:['KeyF','Space']);result.guardian=t.world().enemies.find(n=>n.boss);t.relocate(8,0,-2);result.victory=t.step(.03);
  g.restart();t.damage(100);result.defeat=g.snapshot();g.restart();result.reset=g.snapshot();
  // Traverse the entire level with real inputs and no relocation/scenario changes.
  const route=[],platforms=t.world().platforms;for(let i=1;i<9&&g.snapshot().mode==='running';i++){t.step(.02,['KeyE']);const target=platforms[i];for(let n=0;n<70;n++){const s=t.step(.03,['Space','KeyF']);if(Math.hypot(s.position[0]-target.x,s.position[2]-target.z)<4.8)break}t.step(.02,['KeyQ','KeyF']);route.push(t.step(.9,['KeyF']))}result.route=route;result.routeVictory=t.step(.3,['KeyW','KeyF']);return result;
 });
 assert.equal(grapple.attached.attached,2,'default hook must select the next platform anchor');assert.ok(grapple.reeled.ropeLength<grapple.attached.ropeLength-10,'reeling must shorten the physical rope');assert.equal(grapple.released.attached,0);assert.ok(Math.hypot(...grapple.released.velocity)>1,'release must preserve momentum');assert.equal(grapple.landing.platform,2,'swing/reel/release must reach the next platform');assert.equal(grapple.landing.grounded,true);assert.equal(grapple.landing.crystals,1);assert.ok(grapple.combat.score>350,'pulse must damage nearby guardians');assert.equal(grapple.checkpoint.checkpoint,4);assert.equal(grapple.fall.health,grapple.checkpoint.health-20);assert.equal(grapple.crystals.crystals,6);assert.equal(grapple.guardian.dead,true);assert.equal(grapple.victory.mode,'won');assert.equal(grapple.defeat.mode,'lost');assert.equal(grapple.reset.crystals,0);assert.equal(grapple.reset.attached,0);assert.equal(grapple.reset.health,100);assert.equal(grapple.route.length,8);assert.ok(grapple.route.every((s,i)=>s.platform===i+2&&s.grounded),'every gap must be physically traversable');assert.equal(grapple.routeVictory.mode,'won','full rope route and combat must be completable without scenario setup');console.log('PASS Grapple Arena: rope constraint, reel, momentum, platform landing, pulse combat, crystals, checkpoint, rescue, guardian, win/loss/reset');
 assert.deepEqual(errors,[],'no uncaught browser exceptions');
}finally{await browser.close()}
