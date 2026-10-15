// Serve the repository over HTTP, then run with Node and Playwright in NODE_PATH.
// VC_3D_URL points to the collection's page directory; no persistent browser profile is used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_3D_URL||'http://127.0.0.1:8781/page').replace(/\/$/,'');
const apps=[['game','pinball-3d'],['game','bowling-3d'],['game','bridge-builder-3d'],['game','warehouse-robot-3d'],['game','submarine-explorer-3d'],['game','billiards-3d'],['utils','model-inspector-3d'],['utils','terrain-generator-3d'],['utils','mechanism-lab-3d'],['utils','molecule-builder-3d'],['utils','folding-lab-3d']];
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>lab.state);
const advance=n=>page.evaluate(n=>lab.advance(n),n);
const action=id=>page.evaluate(id=>{lab.pause(false);document.getElementById(id).click();lab.pause(true)},id);
const settings=async()=>{if(await page.locator('#sidebar').evaluate(e=>e.hidden))await page.locator('#settings-toggle').click()};
const set=async(id,v)=>{await settings();await page.locator('#'+id).fill(String(v));await page.locator('#'+id).dispatchEvent('input')};
const approx=(x,y,eps=.01)=>assert(Math.abs(x-y)<eps,`${x} approximately ${y}`);
const finiteTree=x=>typeof x==='number'?Number.isFinite(x):x&&typeof x==='object'?Object.values(x).every(finiteTree):true;
let started=!process.env.VC_3D_FROM;
try{
 for(const [folder,slug] of apps){
  if(!started&&slug!==process.env.VC_3D_FROM)continue;started=true;
  await page.goto(`${base}/${folder}/${slug}.html`);await page.waitForFunction(()=>window.lab,{timeout:45000});await page.evaluate(()=>lab.pause(true));
  const structural=await page.evaluate(()=>({overflow:document.body.scrollHeight>innerHeight||document.body.scrollWidth>innerWidth,top:document.querySelector('.topbar').getBoundingClientRect().height,keys:Object.fromEntries(Object.entries(lab.messages).map(([k,v])=>[k,Object.keys(v).sort()])),untranslated:[...document.querySelectorAll('[data-i18n]')].filter(e=>!lab.messages.en[e.dataset.i18n]).map(e=>e.dataset.i18n),favicon:document.querySelector('link[rel=icon]').href}));
  assert.equal(structural.overflow,false,slug+' fits desktop');assert(structural.top<=44);assert.deepEqual(structural.keys.en,structural.keys.pt);assert.deepEqual(structural.keys.en,structural.keys.ja);assert.deepEqual(structural.untranslated,[]);
  assert.equal((await page.request.get(structural.favicon)).status(),200,'favicon exists');
  for(const lang of ['pt','ja','en']){await page.locator('#lang-switcher').selectOption(lang);assert.equal(await page.locator('html').getAttribute('lang'),lang);await page.locator('#help').click();assert(await page.locator('#help-dialog').evaluate(e=>e.open));assert((await page.locator('#help-dialog [data-i18n=physicsHelp]').innerText()).length>40);await page.locator('#close-help').click()}
  await page.locator('#theme-switcher').click();const theme=await page.locator('html').getAttribute('data-theme');await page.evaluate(()=>lab.save());await page.reload();await page.waitForFunction(()=>window.lab);await page.evaluate(()=>lab.pause(true));await settings();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  if(slug==='pinball-3d'){
   await action('launch');assert.equal((await state()).waiting,false);await advance(240);const s=await state();assert(s.score>0||s.ball[0]<2.75,'launch leaves the shooter channel');
   await page.evaluate(()=>{lab.app.reset();lab.app.ball.position.set(-1.15,.25,-2.6);lab.app.ball.velocity.set(0,0,-5);lab.app.launch(.5)});await advance(130);assert((await state()).score>0,'powered bumper scores');
   await page.locator('#canvas').click({position:{x:15,y:15}});await page.keyboard.down('a');await advance(20);assert((await state()).flippers[0]>.3);await page.keyboard.up('a');await advance(25);assert((await state()).flippers[0]<-.3);
  }else if(slug==='bowling-3d'){
   const scores=await page.evaluate(()=>({perfect:lab.app.totalScore(Array(12).fill(10)),spares:lab.app.totalScore([...Array(10).fill([5,5]).flat(),5]),open:lab.app.totalScore(Array(20).fill(3))}));assert.deepEqual(scores,{perfect:300,spares:150,open:60});
   await advance(120);await action('roll');assert((await state()).active);await advance(1600);assert.equal((await state()).rolls.length,1);assert((await state()).standing<10,'rigid-body pin impact');
  }else if(slug==='bridge-builder-3d'){
   await action('test');await advance(1600);let s=await state();assert(s.passed&&!s.failed,'starter truss supports standard vehicle');
   await page.locator('#preset').selectOption('deck');await set('load',2200);await action('test');await advance(1600);s=await state();assert(s.failed,'overloaded unbraced axial deck loses support');
  }else if(slug==='warehouse-robot-3d'){
   await advance(60);await page.locator('#canvas').click({position:{x:15,y:15}});const before=(await state()).robot[0];await page.keyboard.down('d');await advance(110);await page.keyboard.up('d');assert((await state()).robot[0]>before+.7,'motor force moves robot');
   await page.evaluate(()=>{lab.app.robot.position.set(-3,.27,2.1);lab.app.robot.velocity.setZero();lab.app.toggleMagnet()});assert((await state()).connected,'magnetic constraint attached');await advance(120);assert(finiteTree(await state()));await page.evaluate(()=>lab.app.toggleMagnet());assert.equal((await state()).connected,false);
  }else if(slug==='submarine-explorer-3d'){
   await set('current',0);const before=(await state()).position[1];await advance(240);approx((await state()).position[1],before,.025);
   await set('trim',.04);await advance(240);assert((await state()).position[1]>before+.15,'positive buoyancy rises');
   await page.evaluate(()=>{lab.app.sub.position.set(-7,2,2);lab.app.sub.velocity.setZero();lab.app.scan()});assert.equal((await state()).collected,1);
   await page.locator('#canvas').click({position:{x:15,y:15}});await page.keyboard.down('w');await advance(120);await page.keyboard.up('w');assert((await state()).speed>.2,'propeller thrust');
  }else if(slug==='billiards-3d'){
   await advance(90);await set('power',6);await action('shoot');assert((await state()).shot);await advance(330);assert((await state()).firstHit!==null,'cue transfers momentum to rack');await advance(4200);assert.equal((await state()).shot,false,'rolling resistance settles the shot');
  }else if(slug==='model-inspector-3d'){
   await action('drop');assert((await state()).dropping);await advance(1200);assert((await state()).height<.2,'approximate drop reaches ground');
   const positions=new Float32Array([0,0,0,2,0,0,0,2,0,0,0,2]),indices=new Uint16Array([0,2,1,0,1,3,0,3,2,1,2,3]);const bytes=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(indices.buffer)]);
   const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Tetrahedron'}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{uri:'fixture.bin',byteLength:bytes.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength,target:34962},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength,target:34963}],accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[0,0,0],max:[2,2,2]},{bufferView:1,componentType:5123,count:12,type:'SCALAR'}]};
   await page.locator('#model-file').setInputFiles([{name:'fixture.gltf',mimeType:'model/gltf+json',buffer:Buffer.from(JSON.stringify(doc))},{name:'fixture.bin',mimeType:'application/octet-stream',buffer:bytes}]);await page.waitForFunction(()=>lab.state.localFiles===2);assert.deepEqual((await state()).size,[2,2,2]);assert.equal((await state()).meshes,1);
   await page.locator('#keep-model').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Saved'));await page.reload();await page.waitForFunction(()=>window.lab&&lab.state.localFiles===2);await page.evaluate(()=>lab.pause(true));assert.deepEqual((await state()).size,[2,2,2]);
   const exportData=await page.evaluate(async()=>{const req=indexedDB.open('VC3DModelsDB');const db=await new Promise(resolve=>req.onsuccess=()=>resolve(req.result));const read=db.transaction('models').objectStore('models').get('current');const record=await new Promise(resolve=>read.onsuccess=()=>resolve(read.result));db.close();return record.files.map(f=>({name:f.name,bytes:f.data.byteLength}))});assert.deepEqual(exportData.map(f=>f.bytes),[Buffer.byteLength(JSON.stringify(doc)),bytes.length]);
  }else if(slug==='terrain-generator-3d'){
   const before=await state();await page.evaluate(()=>{for(let i=0;i<600;i++)lab.app.droplet();for(let i=0;i<30;i++)lab.app.thermal()});const after=await state();approx(after.sum,before.sum,1e-7);assert(after.max<before.max,'erosion lowers peaks');
   await page.evaluate(()=>lab.save());const sum=(await state()).sum;await page.reload();await page.waitForFunction(()=>window.lab);await page.evaluate(()=>lab.pause(true));await settings();approx((await state()).sum,sum,1e-7);
   const downloadPromise=page.waitForEvent('download');await page.locator('#planner-export').click();const download=await downloadPromise;const terrainDoc=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(terrainDoc.kind,'plannerTerrain');assert.equal(terrainDoc.terrain.resolution,48);assert.equal(terrainDoc.terrain.heights.length,49*49);
  }else if(slug==='mechanism-lab-3d'){
   await advance(2600);let s=await state();assert(s.w[0]>.5);approx(s.w[2]/s.w[0],s.ratio,.015);assert(s.w[1]<0,'meshed idler reverses direction');const before=s.energy;await page.locator('#motor').click();await advance(2400);assert((await state()).energy<before*.2,'output damping removes energy');
   await page.locator('#mechanism').selectOption('crank');await advance(1200);assert(finiteTree(await state()));await page.locator('#mechanism').selectOption('pendulum');await advance(1200);assert(finiteTree(await state()));
  }else if(slug==='molecule-builder-3d'){
   const before=await state();await page.locator('#jiggle').click();await advance(3600);let s=await state();assert(s.energy<.01,'damped bond/angle relaxation');for(const b of s.bonds)approx(b.length,.96,.03);
   for(const name of ['methane','ammonia','carbonDioxide','ethanol']){await page.locator('#preset').selectOption(name);await advance(800);s=await state();assert(finiteTree(s));assert(s.bonds.every(b=>b.length>.3&&b.length<2.2))}
   await page.evaluate(()=>lab.app.restore({atoms:[],bonds:[],temperature:0,damping:.8}));await page.locator('#add-atom').click();assert.equal((await state()).atoms.length,1,'editable molecule');
  }else if(slug==='folding-lab-3d'){
   await page.locator('#fold').click();await advance(1600);let s=await state();approx(s.angles[0],Math.PI/2,.001);assert(s.error<1e-8,'rigid-panel edge lengths preserved');
   await page.locator('#preset').selectOption('accordion');for(let i=0;i<3;i++){await page.locator('#crease').selectOption(String(i));await set('fold-angle',i%2?-90:90);await advance(700)}s=await state();assert(s.panels===4);assert(s.error<1e-7,'multiple hinge folds preserve panel geometry');
   await page.evaluate(()=>lab.save());await page.reload();await page.waitForFunction(()=>window.lab);await page.evaluate(()=>lab.pause(true));await advance(1200);assert((await state()).error<1e-7);
  }
  assert(finiteTree(await state()),slug+' finite simulation');
  await page.locator('#sidebar').evaluate(e=>{if(!e.hidden)document.querySelector('#settings-toggle').click()});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight),false,slug+' fits mobile');assert(await page.locator('#help').isVisible());await page.setViewportSize({width:960,height:640});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert(await page.evaluate(()=>!lab.renderer.getContext().isContextLost()&&lab.renderer.info.render.calls>0),slug+' renders after resizing');
  if(process.env.VC_3D_SCREENSHOTS){await mkdir(process.env.VC_3D_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.VC_3D_SCREENSHOTS+'/'+slug+'.png'})}
  console.log('PASS',slug);
 }
 await page.goto(base+'/index.html');const cards=await page.evaluate(()=>({hrefs:[...document.querySelectorAll('article.card:not([data-pinned-clone])')].map(c=>c.querySelector('a[href]')?.getAttribute('href')).filter(Boolean),seq:cardSequenceByHref}));
 for(const [folder,slug] of apps)assert(cards.hrefs.includes(folder+'/'+slug+'.html'));
 const numbers=Object.values(cards.seq).map(v=>Number(v.slice(1))).sort((a,b)=>a-b);assert.deepEqual(numbers,Array.from({length:numbers.length},(_,i)=>i+1));assert.equal(numbers.at(-1),121);assert.equal(new Set(cards.hrefs).size,numbers.length);
 const backupSource=await readFile(new URL('../../page/utils/backup.html',import.meta.url),'utf8');assert(backupSource.includes("{ name: 'VC3DModelsDB', version: 1, stores: ['models'] }"));assert(backupSource.includes("VC3DModelsDB: { models: 'id' }"));
 // Exercise the actual backup UI with binary model assets and project keys.
 await page.goto(base+'/utils/backup.html');const backupDownload=page.waitForEvent('download');await page.locator('#btn-export').click();const backup=JSON.parse(await readFile(await (await backupDownload).path(),'utf8'));
 assert(backup.localStorage['vc.3d.terrain-generator-3d.v1']);assert(backup.indexedDB.VC3DModelsDB);const expectedFiles=JSON.stringify(backup.indexedDB.VC3DModelsDB);
 await page.evaluate(async()=>{localStorage.removeItem('vc.3d.terrain-generator-3d.v1');await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('VC3DModelsDB');r.onsuccess=resolve;r.onerror=reject})});
 await page.locator('#file-input').setInputFiles({name:'three-d-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#btn-import-merge').click();await page.waitForFunction(()=>!document.querySelector('#btn-import-merge').disabled);assert(await page.evaluate(()=>!!localStorage.getItem('vc.3d.terrain-generator-3d.v1')));
 const secondDownload=page.waitForEvent('download');await page.locator('#btn-export').click();const restored=JSON.parse(await readFile(await (await secondDownload).path(),'utf8'));assert.equal(JSON.stringify(restored.indexedDB.VC3DModelsDB),expectedFiles,'backup round-trips original binary model buffers');
 assert.deepEqual(errors,[]);console.log('PASS catalog, sequence, localization, persistence and layout');
}finally{await browser.close()}
