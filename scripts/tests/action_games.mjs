// Run against scripts/dev_server.py. Requires Playwright in NODE_PATH.
// VC_ACTION_URL can point at another local server; VC_ACTION_ONLY filters slugs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_ACTION_URL||'http://127.0.0.1:8781/page').replace(/\/$/,'');
const slugs=['robot-arena','rooftop-ninja','neon-tanks','station-survival','ruins-knight','drone-hunter','city-monster','pirate-island','grapple-arena','armored-convoy'];
const selected=process.env.VC_ACTION_ONLY?process.env.VC_ACTION_ONLY.split(','):slugs;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage();
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))failed.push(r.url()+' '+r.status())});
const snapshot=()=>page.evaluate(()=>window.__game.snapshot?__game.snapshot():__game.getState());
const stateOf=s=>s.mode==='running'?'playing':(s.mode||s.state);
const finiteTree=x=>typeof x==='number'?Number.isFinite(x):x&&typeof x==='object'?Object.values(x).every(finiteTree):true;
const closeHelp=async()=>{const d=page.locator('dialog[open]');await d.locator('#close-help,#help-close').click();};
try{
 for(const slug of selected){
  const errStart=errors.length;await page.goto(`${base}/game/${slug}/`);await page.waitForFunction(()=>window.__game,{timeout:45000});
  const ready=await snapshot();assert(finiteTree(ready),slug+' initial finite state');assert.equal(stateOf(ready),'ready',slug+' has a ready screen');
  const layout=await page.evaluate(()=>({overflow:document.body.scrollHeight>innerHeight||document.body.scrollWidth>innerWidth,top:document.querySelector('.topbar').getBoundingClientRect().height,icon:document.querySelector('link[rel=icon]').href,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  assert.equal(layout.overflow,false,slug+' fits 960×640');assert(layout.top<=44.1,slug+' compact toolbar');assert.deepEqual(layout.images,[],slug+' icons loaded');assert.equal((await page.request.get(layout.icon)).status(),200);
  for(const lang of ['pt','ja','en']){await page.locator('#lang-switcher').selectOption(lang);assert.equal(await page.locator('html').getAttribute('lang'),lang);await page.locator('#help-button').click();assert(await page.locator('dialog').evaluate(d=>d.open));assert((await page.locator('dialog').innerText()).length>150,slug+' translated help');await closeHelp();}
  await page.locator('#theme-switcher').click();const theme=await page.evaluate(slug=>JSON.parse(localStorage.getItem('vc-'+slug+'-v1')).theme,slug);assert(['light','dark'].includes(theme));await page.reload();await page.waitForFunction(()=>window.__game);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme||(document.body.classList.contains('light')?'light':'dark')),theme,slug+' theme persists');
  await page.evaluate(()=>__game.start());await page.waitForTimeout(500);assert.equal(stateOf(await snapshot()),'playing',slug+' starts');
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');await page.keyboard.press('Space');await page.waitForTimeout(300);assert(finiteTree(await snapshot()),slug+' finite after controls');
  await page.locator('#pause').click();assert.equal(stateOf(await snapshot()),'paused',slug+' pause');const paused=await snapshot();await page.waitForTimeout(200);const still=await snapshot();if('elapsed'in paused)assert.equal(still.elapsed,paused.elapsed,slug+' pause freezes simulation');
  await page.locator('#pause').click();assert.equal(stateOf(await snapshot()),'playing',slug+' resume');
  await page.keyboard.press('?');assert(await page.locator('dialog').evaluate(d=>d.open));assert.notEqual(stateOf(await snapshot()),'playing',slug+' help pauses');await closeHelp();
  await page.evaluate(()=>{if(__game.resume)__game.resume();else __game.pause(false);});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(stateOf(await snapshot()),'paused',slug+' blur pauses');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);const small=await page.evaluate(()=>({body:document.body.scrollWidth<=innerWidth&&document.body.scrollHeight<=innerHeight,top:document.querySelector('.topbar').getBoundingClientRect().height,controls:['help-button','lang-switcher','theme-switcher'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.height>0;})}));assert(small.body,slug+' mobile body fits');assert(small.top<=44.1,slug+' mobile toolbar');assert(small.controls.every(Boolean),slug+' mobile controls accessible');
  await page.setViewportSize({width:960,height:640});await page.evaluate(()=>__game.restart());if(stateOf(await snapshot())==='ready')await page.evaluate(()=>__game.start());await page.waitForTimeout(200);assert.equal(stateOf(await snapshot()),'playing');
  if(process.env.VC_ACTION_SCREENSHOTS){await mkdir(process.env.VC_ACTION_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.VC_ACTION_SCREENSHOTS}/${slug}.png`});}
  assert.deepEqual(errors.slice(errStart),[],slug+' no runtime errors');assert(await page.evaluate(key=>!!localStorage.getItem(key),'vc-'+slug+'-v1'),slug+' saves preferences');
  console.log('PASS',slug,JSON.stringify(await snapshot()));
 }
 if(selected.length===slugs.length){
  await page.goto(base+'/index.html');await page.waitForFunction(()=>document.querySelectorAll('.card-sequence').length>0||document.querySelectorAll('.card .name').length>100).catch(()=>{});
  const catalog=await page.evaluate(()=>({hrefs:[...document.querySelectorAll('article.card:not([data-pinned-clone])')].map(c=>c.querySelector('a[href]')?.getAttribute('href')).filter(Boolean),sequence:cardSequenceByHref}));
  for(const slug of slugs)assert(catalog.hrefs.includes('game/'+slug+'/index.html'),slug+' catalog card');
  const seq=Object.values(catalog.sequence).map(v=>Number(v.slice(1))).sort((a,b)=>a-b);assert.deepEqual(seq,Array.from({length:seq.length},(_,i)=>i+1));assert.equal(new Set(catalog.hrefs).size,seq.length);assert.equal(seq.at(-1),136);
  await page.goto(base+'/utils/backup.html');const downloadPromise=page.waitForEvent('download');await page.locator('#btn-export').click();const backup=JSON.parse(await readFile(await(await downloadPromise).path(),'utf8'));
  for(const slug of slugs)assert(backup.localStorage['vc-'+slug+'-v1'],slug+' included in backup');
  await page.evaluate(slugs=>slugs.forEach(s=>localStorage.removeItem('vc-'+s+'-v1')),slugs);
  await page.locator('#file-input').setInputFiles({name:'action-games-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#btn-import-merge').click();await page.waitForFunction(()=>!document.querySelector('#btn-import-merge').disabled);
  for(const slug of slugs)assert.equal(await page.evaluate(key=>localStorage.getItem(key),'vc-'+slug+'-v1'),backup.localStorage['vc-'+slug+'-v1'],slug+' backup merge roundtrip');
  console.log('PASS catalog: 136 contiguous cards; 10 game saves exported and restored');
 }
 assert.deepEqual(failed,[],'no missing local assets');console.log('PASS common UI, layout, translations, pause, persistence and controls');
}finally{await browser.close();}
