// Real contact and input regressions for the two lateral rescue flippers.
// Serve page/ over HTTP, then run with Playwright available in NODE_PATH.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_3D_URL||'http://localhost:8000').replace(/\/$/,'');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const advance=n=>page.evaluate(n=>lab.advance(n),n);
const state=()=>page.evaluate(()=>lab.state);
const rest=[-.43,.43,.5,-.5],left=[.65,.43,-1,-.5],right=[-.43,-.65,.5,1];
function angles(actual,expected){assert.equal(actual.length,4);actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-8,`flipper ${i}: ${v} vs ${expected[i]}`))}
try{
 await page.goto(`${base}/game/pinball-3d.html`);await page.waitForFunction(()=>window.lab,{timeout:45000});await page.evaluate(()=>lab.pause(true));await page.locator('#canvas').focus();
 angles((await state()).flippers,rest);
 for(const [key,expected] of [['a',left],['d',right],['ArrowLeft',left],['ArrowRight',right]]){
  await page.keyboard.down(key);await advance(30);angles((await state()).flippers,expected);
  await page.keyboard.up(key);await advance(30);angles((await state()).flippers,rest);
 }
 await page.keyboard.down('a');await page.keyboard.down('d');await advance(30);angles((await state()).flippers,[.65,-.65,-1,1]);
 await page.keyboard.up('a');await page.keyboard.up('d');await advance(30);
 // The launcher still exits its separate channel with four flippers installed.
 const launch=await page.evaluate(()=>{lab.pause(true);lab.app.reset();lab.app.launch(.7);lab.advance(240);return lab.state});
 assert(!launch.waiting);assert(launch.score>0||launch.ball[0]<2.75);
 for(const [x,expected] of [[180,left],[780,right]]){
  await page.evaluate(()=>{lab.pause(true);lab.app.reset();lab.app.launch(.5)});
  await page.mouse.move(x,330);await page.mouse.down();await advance(30);angles((await state()).flippers,expected);
  await page.mouse.up();await advance(30);angles((await state()).flippers,rest);
 }
 // Identical incoming balls are compared with and without a timed stroke.
 // Start clear of the flipper; any reversal must result from solver contact.
 const rescues=await page.evaluate(()=>{
  const rows=[];document.querySelector('#canvas').focus();
  for(const [side,x] of [[-1,-3.18],[-1,-2.85],[1,2.48],[1,2.15]])for(const speed of [1,3,6])for(const active of [false,true]){
   lab.pause(true);lab.app.reset();lab.advance(30);lab.app.launch(.5);
   const ball=lab.app.ball;ball.position.set(x,.195,2.9);ball.velocity.set(0,0,speed);ball.angularVelocity.setZero();ball.aabbNeedsUpdate=true;
   const code=side<0?'KeyA':'KeyD';if(active)window.dispatchEvent(new KeyboardEvent('keydown',{code}));
   let contact=false,maxHeight=0;for(let i=0;i<30;i++){
    lab.advance(1);maxHeight=Math.max(maxHeight,ball.position.y);
    contact ||= lab.app.world.contacts.some(c=>(c.bi===ball&&c.bj.type===4)||(c.bj===ball&&c.bi.type===4));
   }
   window.dispatchEvent(new KeyboardEvent('keyup',{code}));
   rows.push({side,x,speed,active,contact,maxHeight,velocity:ball.velocity.toArray(),...lab.state});
  }lab.pause(true);return rows;
 });
 for(let i=0;i<rescues.length;i+=2){
  const passive=rescues[i],active=rescues[i+1],label=`side ${active.side}, x ${active.x}, speed ${active.speed}`;
  assert(active.contact,`${label}: physical flipper contact`);
  assert(active.velocity[2]<-5,`${label}: sends descending ball back upfield`);
  assert(active.ball[2]<passive.ball[2]-1,`${label}: stroke adds useful return distance`);
  assert(active.ball[0]>-3.41&&active.ball[0]<2.73,`${label}: stays inside playable field`);
  assert(active.maxHeight<.5,`${label}: no spurious vertical launch`);
  assert.equal(active.balls,3);assert(!active.waiting);
 }
 const tilted=await page.evaluate(()=>{
  lab.pause(true);lab.app.reset();lab.advance(30);lab.app.launch(.5);for(let i=0;i<4;i++)lab.app.nudge();
  for(const code of ['KeyA','KeyD'])window.dispatchEvent(new KeyboardEvent('keydown',{code}));lab.advance(30);
  const s=lab.state;lab.pause(true);return s;
 });
 assert(tilted.tilt>0);angles(tilted.flippers,rest);
 // A central miss must still drain; the side pair should not close the game.
 const drained=await page.evaluate(()=>{lab.app.reset();lab.app.launch(.5);lab.app.ball.position.set(0,.195,6.5);lab.app.ball.velocity.set(0,0,4);lab.advance(60);return lab.state});
 assert.equal(drained.balls,2);assert(drained.waiting);
 for(const lang of ['en','pt','ja']){
  await page.locator('#lang-switcher').selectOption(lang);await page.locator('#help').click();
  assert.equal(await page.locator('#help-dialog [data-i18n=instructions]').innerText(),await page.evaluate(l=>lab.messages[l].instructions,lang));
  await page.locator('#close-help').click();
 }
 await page.locator('#lang-switcher').selectOption('pt');await page.evaluate(()=>{lab.pause(true);lab.app.reset();lab.advance(30);document.activeElement.blur()});
 assert(await page.locator('#sidebar').evaluate(e=>e.hidden));
 for(const viewport of [{width:960,height:640},{width:390,height:844}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight),false)}
 if(process.env.VC_PINBALL_SCREENSHOT){await page.setViewportSize({width:960,height:640});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:process.env.VC_PINBALL_SCREENSHOT})}
 assert.deepEqual(errors,[]);console.log('PASS: four flippers, keyboard/mouse, 12 lateral rescues, launcher, tilt, central drain, EN/PT/JA and compact layout.');
}finally{await browser.close()}
