// Touch input, unavailable storage/CDN, and complete backup replacement.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_ACTION_URL||'http://127.0.0.1:8781/page').replace(/\/$/,'');
const slugs=['robot-arena','rooftop-ninja','neon-tanks','station-survival','ruins-knight','drone-hunter','city-monster','pirate-island','grapple-arena','armored-convoy'];
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const getState=()=>{const s=__game.snapshot?__game.snapshot():__game.getState();return{...s,mode:s.mode==='running'?'playing':s.mode||s.state};};
try{
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),p=await mobile.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 for(const slug of process.env.VC_ACTION_SKIP_TOUCH?[]:slugs){
  await p.goto(`${base}/game/${slug}/`);await p.waitForFunction(()=>window.__game);await p.evaluate(()=>__game.start());await p.waitForTimeout(100);
  const before=await p.evaluate(getState);const selector=slug==='armored-convoy'?'[data-key="a"]':'[data-key="KeyW"]';const button=p.locator(selector).first();assert(await button.isVisible(),slug+' touch pad visible');
  const r=await button.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(350);await p.mouse.up();const after=await p.evaluate(getState);
  const position=s=>s.position||s.player;assert.notDeepEqual(position(after),position(before),slug+' on-screen movement changes position');
  const possible=p.locator('#touch-actions button,#actions button,.action-pad button,#touch-fire').filter({visible:true});assert(await possible.count()>0,slug+' touch actions visible');
  const action=possible.last(),ar=await action.boundingBox();await p.mouse.move(ar.x+ar.width/2,ar.y+ar.height/2);await p.mouse.down();await p.waitForTimeout(120);await p.mouse.up();
  await p.locator('#help-button').click();assert(await p.locator('dialog').evaluate(d=>d.open));assert.notEqual((await p.evaluate(getState)).mode,'playing',slug+' mobile help pauses');await p.locator('dialog #close-help,dialog #help-close').click();
  if(await p.locator('#panel-restart').count()){await p.waitForFunction(()=>__game.snapshot().mode==='running');await p.locator('#pause').click();await p.locator('#panel-restart').click();const restarted=await p.evaluate(getState);assert.equal(restarted.mode,'playing',slug+' mobile pause menu restarts');assert.equal(restarted.score,0);}
  console.log('PASS touch',slug);
 }
 assert.deepEqual(errors,[]);await mobile.close();
 const unavailable=await browser.newContext(),offline=await unavailable.newPage();
 await unavailable.addInitScript(()=>{localStorage.setItem('app_lang','pt');});
 await unavailable.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\/.*three/,r=>r.abort());
 for(const slug of slugs){
  await offline.goto(`${base}/game/${slug}/`);await offline.waitForFunction(()=>/Não foi possível|não foi possível/.test(document.body.innerText),{timeout:20000});
  assert(await offline.locator('#overlay-action,#play,#retry-load,#reload').filter({hasText:/Recarregar|Tentar novamente/}).isVisible(),slug+' localized retry after CDN failure');
  console.log('PASS load failure',slug);
 }
 await unavailable.close();
 const noStorage=await browser.newContext(),q=await noStorage.newPage(),storageErrors=[];q.on('pageerror',e=>storageErrors.push(e.message));
 await noStorage.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage denied','SecurityError');}});});
 for(const slug of slugs){await q.goto(`${base}/game/${slug}/`);await q.waitForFunction(()=>window.__game);await q.locator('#theme-switcher').click();await q.selectOption('#lang-switcher','ja');await q.evaluate(()=>__game.start());assert.equal((await q.evaluate(getState)).mode,'playing',slug+' plays without storage');console.log('PASS restricted storage',slug);}
 assert.deepEqual(storageErrors,[]);await noStorage.close();
 const ctx=await browser.newContext(),b=await ctx.newPage();await b.goto(base+'/utils/backup.html');
 await b.evaluate(slugs=>{for(let i=0;i<slugs.length;i++)localStorage.setItem('vc-'+slugs[i]+'-v1',JSON.stringify({best:1000+i,lang:'pt',theme:'dark',sound:false}));},slugs);
 const dp=b.waitForEvent('download');await b.locator('#btn-export').click();const doc=JSON.parse(await readFile(await(await dp).path(),'utf8'));await b.evaluate(()=>{localStorage.clear();localStorage.setItem('temporary-test-key','remove me');});
 await b.locator('#file-input').setInputFiles({name:'action-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 b.once('dialog',dialog=>dialog.accept());await b.locator('#btn-import-replace').click();await b.waitForFunction(()=>!document.querySelector('#btn-import-replace').disabled);
 assert.equal(await b.evaluate(()=>localStorage.getItem('temporary-test-key')),null);for(const slug of slugs)assert.equal(await b.evaluate(k=>localStorage.getItem(k),'vc-'+slug+'-v1'),doc.localStorage['vc-'+slug+'-v1']);
 console.log('PASS all 10 saves survive full backup replacement');await ctx.close();
}finally{await browser.close();}
