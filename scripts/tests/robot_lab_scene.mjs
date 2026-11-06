// Scene rendering controls and backward-compatible portable project settings.
// Serve repository root; requires Playwright and Chrome.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

export async function runSceneChecks(page,base='http://127.0.0.1:8765') {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:960,height:640});
 await page.goto(base+'/page/utils/robot-lab/index.html');await page.waitForFunction(()=>window.robotLab?.scene);
 await page.locator('#lang-switcher').selectOption('en');
 await page.locator('[data-tab="capture"]').click();
 const pose=await page.evaluate(()=>robotLab.values),original=await page.evaluate(()=>robotLab.scene);
 await page.locator('#scene-menu > summary').click();
 assert(await page.locator('#scene-color').isDisabled());
 await page.locator('#scene-light').evaluate(input=>{input.value='160';input.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#scene-background').selectOption('custom');
 await page.locator('#scene-color').fill('#8597ad');
 await page.waitForFunction(()=>robotLab.scene.resolvedBackground==='#8597ad'&&robotLab.scene.lighting===1.6);
 const configured=await page.evaluate(()=>robotLab.scene);
 for(const [name,intensity]of Object.entries(original.lights))assert(Math.abs(configured.lights[name]-intensity*1.6)<1e-9,'slider changes rendered '+name);
 assert.deepEqual(await page.evaluate(()=>robotLab.values),pose,'scene controls preserve robot pose');
 assert(await page.locator('#tab-capture').isVisible(),'scene controls are available in Capture');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1'))?.scene?.color==='#8597ad');
 await page.locator('#theme-switcher').click();
 assert.equal(await page.evaluate(()=>robotLab.scene.resolvedBackground),'#8597ad','custom background survives theme changes');
 assert.equal(await page.evaluate(()=>robotLab.scene.lighting),1.6);
 for(const lang of ['en','pt','ja']){
  await page.locator('#lang-switcher').selectOption(lang);
  assert(await page.locator('#scene-menu > summary').innerText().then(t=>!!t&&!/sceneControls/.test(t)));
 }
 await page.locator('#lang-switcher').selectOption('en');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vc.robotLab.v1')).lang==='en');
 await page.reload();await page.waitForFunction(()=>window.robotLab?.scene);
 assert.equal(await page.evaluate(()=>robotLab.scene.resolvedBackground),'#8597ad','reload restores scene color');
 assert.equal(await page.evaluate(()=>robotLab.scene.lighting),1.6,'reload restores lighting');
 await page.locator('.file-menu summary').click();
 const downloading=page.waitForEvent('download');await page.locator('#export-project').click();
 const project=JSON.parse(await readFile(await (await downloading).path(),'utf8'));
 assert.deepEqual(project.scene,{lighting:1.6,background:'custom',color:'#8597ad'},'portable backup includes scene');
 const importProject=async value=>{
  await page.locator('#toast').evaluate(el=>el.hidden=true);
  await page.locator('#file-input').setInputFiles({name:'scene-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await page.locator('#confirm button[value="ok"]').click();
  await page.waitForFunction(()=>!document.querySelector('#toast').hidden&&document.querySelector('#toast').textContent==='Project imported.');
 };
 await page.locator('#scene-menu > summary').click();await page.locator('#scene-reset').click();
 assert.equal(await page.evaluate(()=>robotLab.scene.lighting),1);
 assert.equal(await page.evaluate(()=>robotLab.scene.background),'theme');
 await importProject(project);
 assert.equal(await page.evaluate(()=>robotLab.scene.resolvedBackground),'#8597ad','project import restores custom scene');
 assert.equal(await page.evaluate(()=>robotLab.scene.lighting),1.6);
 const legacy=structuredClone(project);delete legacy.scene;await importProject(legacy);
 assert.equal(await page.evaluate(()=>robotLab.scene.background),'theme','existing version1 projects remain valid');
 assert.equal(await page.evaluate(()=>robotLab.scene.lighting),1);
 const before=await page.evaluate(()=>robotLab.scene);
 for(const scene of [null,{...project.scene,lighting:20},{...project.scene,color:'red'},{...project.scene,background:'invalid'}]){
  await page.locator('#toast').evaluate(el=>el.hidden=true);
  await page.locator('#file-input').setInputFiles({name:'invalid-scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...project,scene}))});
  await page.waitForFunction(()=>document.querySelector('#toast').hidden===false);
  assert.equal(await page.locator('#confirm').evaluate(d=>d.open),false,'invalid scene is rejected before import');
  assert.deepEqual(await page.evaluate(()=>robotLab.scene),before,'invalid scene cannot overwrite settings');
 }
 for(const size of [{width:960,height:640},{width:390,height:844}]){
  await page.setViewportSize(size);
  if(!await page.locator('#scene-menu').evaluate(el=>el.open))await page.locator('#scene-menu > summary').click();
  const rect=await page.locator('.scene-popover').boundingBox();
  assert(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=size.width+.5&&rect.y+rect.height<=size.height+.5,'scene controls fit window');
  assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth&&document.body.scrollHeight<=innerHeight),'no body scrolling');
 }
 await page.setViewportSize({width:960,height:640});
 await page.locator('#lang-switcher').selectOption('pt');
 if(!await page.locator('#scene-menu').evaluate(el=>el.open))await page.locator('#scene-menu > summary').click();
 if(process.env.ROBOT_SCENE_SCREENSHOT)await page.screenshot({path:process.env.ROBOT_SCENE_SCREENSHOT});
 assert.deepEqual(errors,[]);
 return 'PASS scene lighting/background rendering, pose preservation, translations, reload, export/import, legacy projects, invalid settings and compact layout';
}
if(process.argv[1]?.endsWith('robot_lab_scene.mjs')){
 const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{console.log(await runSceneChecks(await browser.newPage(),process.env.VC_URL||'http://127.0.0.1:8765'));}finally{await browser.close();}
}
