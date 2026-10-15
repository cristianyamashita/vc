// Native pointer/keyboard interaction checks; the settings drawer stays closed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const base=(process.env.VC_3D_URL||'http://localhost:8000').replace(/\/$/,'');
const apps=[['game','pinball-3d'],['game','bowling-3d'],['game','bridge-builder-3d'],['game','warehouse-robot-3d'],['game','submarine-explorer-3d'],['game','billiards-3d'],['utils','model-inspector-3d'],['utils','terrain-generator-3d'],['utils','mechanism-lab-3d'],['utils','molecule-builder-3d'],['utils','folding-lab-3d']];
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const frames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const state=()=>page.evaluate(()=>lab.state);
const advance=n=>page.evaluate(n=>lab.advance(n),n);
const project=point=>page.evaluate(point=>{lab.scene.updateMatrixWorld(true);lab.camera.updateMatrixWorld(true);const v=lab.camera.position.clone().set(...point).project(lab.camera),r=document.querySelector('#canvas').getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}},point);
const drag=async(a,b,hold=0)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});if(hold)await advance(hold);await page.mouse.up();await frames()};
const keyboard=async(key,ticks=90)=>{await page.locator('#canvas').focus();await page.keyboard.down(key);await advance(ticks);await page.keyboard.up(key);await advance(2);await frames()};
const isClosed=()=>page.locator('#sidebar').evaluate(e=>e.hidden);
let started=!process.env.VC_3D_FROM;
try{
for(const [folder,slug] of apps){
 if(!started&&slug!==process.env.VC_3D_FROM)continue;started=true;
 await page.goto(`${base}/${folder}/${slug}.html`);await page.waitForFunction(()=>window.lab,{timeout:45000});await frames();await page.evaluate(()=>lab.pause(true));
 assert(await isClosed(),slug+' settings starts closed');assert.equal(await page.locator('#canvas').evaluate(e=>e.clientWidth),960,'scene uses full window');
 if(slug==='pinball-3d'){
  await page.locator('#canvas').focus();await page.keyboard.down('Space');await advance(40);await page.keyboard.press('Escape');await page.keyboard.up('Space');await advance(10);assert((await state()).waiting,'Escape cancels a charged launch');
  await keyboard('Space',100);assert.equal((await state()).waiting,false,'keyboard charge-release launches');
  await page.mouse.move(180,340);await page.mouse.down();await advance(20);assert((await state()).flippers[0]>.3,'mouse raises left flipper');await page.mouse.up();await advance(20);assert((await state()).flippers[0]<-.3,'releasing lowers flipper');
 }else if(slug==='bowling-3d'){
  await page.locator('#canvas').focus();await page.keyboard.down('Space');await advance(40);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');await advance(10);assert.equal((await state()).active,false,'losing focus cancels charging');
  await keyboard('d',90);assert((await state()).ball[0]>.45,'keyboard repositions the ball');
  const a=await project([0,.23,2]);await drag(a,{x:a.x,y:a.y+100});assert((await state()).active,'drag release rolls ball');assert(Number(await page.locator('#power').inputValue())>8,'drag sets power');
 }else if(slug==='bridge-builder-3d'){
  const before=(await state()).members;const points=await page.evaluate(()=>[lab.app.nodes[9].p.toArray(),lab.app.nodes[15].p.toArray()]);await drag(await project(points[0]),await project(points[1]));assert.equal((await state()).members,before+1,'drag joins structural nodes');
  await page.keyboard.press('Control+z');assert.equal((await state()).members,before,'undo removes the new member');await keyboard('Space',4);assert((await state()).testing,'space starts bridge test');
 }else if(slug==='warehouse-robot-3d'){
  const a=await project([-4,.05,2]);await page.mouse.click(a.x,a.y);await advance(240);let s=await state();assert(s.robot[2]<3,'mouse route moves robot');
  const before=s.robot;await keyboard('d',90);s=await state();assert(Math.hypot(s.robot[0]-before[0],s.robot[2]-before[2])>.7,'WASD drives relative to camera');
 }else if(slug==='submarine-explorer-3d'){
  const before=(await state()).position;const a=await project([0,5,3]);await page.mouse.click(a.x,a.y);await advance(240);let s=await state();assert(s.position[2]<before[2]-.5,'click pilots submarine');const depth=s.position[1];await keyboard('q',120);assert((await state()).position[1]>depth+.3,'Q rises');
 }else if(slug==='billiards-3d'){
  await advance(120);const a=await project([0,.14,-2.3]);await drag(a,{x:a.x+5,y:a.y+120});assert((await state()).shot,'pointer pull-and-release shoots');assert(Number(await page.locator('#power').inputValue())>4,'pull sets cue power');
 }else if(slug==='model-inspector-3d'){
  const a=await project([.65,.85,.5]);await drag(a,{x:a.x+90,y:a.y});assert(Number(await page.locator('#explode').inputValue())>.4,'drag separates model parts');assert((await state()).selected>=0,'part selected on scene');await keyboard('w',1);assert.equal(await page.locator('#wire').getAttribute('aria-pressed'),'true','W toggles wireframe');
  await page.keyboard.press('x');await frames();const cut=await project([.65,.85,.5]);await page.keyboard.down('Shift');await drag(cut,{x:cut.x,y:cut.y-100});await page.keyboard.up('Shift');assert(Number(await page.locator('#clip').inputValue())<90,'Shift drag moves section plane');
  const positions=new Float32Array([0,0,0,2,0,0,0,2,0,0,0,2]),indices=new Uint16Array([0,2,1,0,1,3,0,3,2,1,2,3]),bytes=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(indices.buffer)]);
  const gltf={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],buffers:[{uri:'data:application/octet-stream;base64,'+bytes.toString('base64'),byteLength:bytes.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength}],accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[0,0,0],max:[2,2,2]},{bufferView:1,componentType:5123,count:12,type:'SCALAR'}]};
  await page.evaluate(gltf=>{const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(gltf)],'dropped.gltf',{type:'model/gltf+json'}));document.querySelector('#stage').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}))},gltf);await page.waitForFunction(()=>lab.state.localFiles===1);assert.deepEqual((await state()).size,[2,2,2],'file drop imports model into scene');
 }else if(slug==='terrain-generator-3d'){
  const a=await project([0,4,0]),before=(await state()).sum;await drag(a,{x:a.x+24,y:a.y+10},90);assert((await state()).sum>before+1,'brush changes terrain without settings');await page.keyboard.press('Control+z');assert(Math.abs((await state()).sum-before)<1e-7,'brush undo restores exact heightfield');await keyboard('2',1);assert.equal(await page.locator('#brush').inputValue(),'lower');
 }else if(slug==='mechanism-lab-3d'){
  await page.keyboard.press('3');await frames();const a=await page.evaluate(()=>{const q=lab.state.q[0];return[3*Math.sin(q),4.5-3*Math.cos(q),0]});const q0=(await state()).q[0];await drag(await project(a),await project([-2.4,2.7,0]),160);assert((await state()).q[0]<q0-.5,'dragging bob applies physical torque');await keyboard('1',1);assert.equal((await state()).mode,'gears');
 }else if(slug==='molecule-builder-3d'){
  // A toolbar click must create a visible atom even after panning away from the original molecule.
  assert(await page.locator('#add-atom').isVisible(),'Add atom is available without settings');
  const originalCount=(await state()).atoms.length,originalView=await page.evaluate(()=>({position:lab.camera.position.toArray(),target:lab.orbit.target.toArray()}));
  await page.evaluate(()=>{const offset=lab.camera.position.clone().set(10,0,0);lab.camera.position.add(offset);lab.orbit.target.add(offset);lab.orbit.update()});
  await page.locator('#element-N').click();await page.locator('#add-atom').click();await frames();
  const added=(await state()).atoms.at(-1);assert.equal((await state()).atoms.length,originalCount+1);assert.equal(added.element,'N');
  const addedScreen=await project([added.p[0],added.p[1]+2,added.p[2]]);
  assert(addedScreen.x>100&&addedScreen.x<860&&addedScreen.y>130&&addedScreen.y<530,'new atom is visible in the current view');
  assert(await page.locator('#remove').isEnabled(),'new atom is selected');
  assert.equal(await page.locator('#notice').innerText(),'Atom added');
  await page.keyboard.press('Control+z');assert.equal((await state()).atoms.length,originalCount,'Undo removes button-created atom');
  await page.evaluate(v=>{lab.camera.position.set(...v.position);lab.orbit.target.set(...v.target);lab.orbit.update()},originalView);await page.locator('#element-C').click();
  let s=await state();const before=s.atoms[1].p;const a=await project([before[0],before[1]+2,before[2]]);await drag(a,{x:a.x+85,y:a.y-35},90);s=await state();assert(Math.hypot(...s.atoms[1].p.map((v,i)=>v-before[i]))>.15,'drag pulls an atom');
  const count=s.atoms.length;await page.keyboard.press('2');const empty=await project([-2,2,1]);await page.mouse.dblclick(empty.x,empty.y);assert.equal((await state()).atoms.length,count+1,'double-click creates atom');await page.keyboard.press('Delete');assert.equal((await state()).atoms.length,count,'Delete removes selected atom');
  for(const point of [[-2,2,1],[2,2,1]]){const p=await project(point);await page.mouse.dblclick(p.x,p.y);await frames()}
  s=await state();const pair=s.atoms.slice(-2).map(a=>[a.p[0],a.p[1]+2,a.p[2]]),bonds=s.bonds.length;await page.keyboard.down('Shift');await drag(await project(pair[0]),await project(pair[1]));await page.keyboard.up('Shift');assert.equal((await state()).bonds.length,bonds+1,'Shift drag bonds two atoms');await page.keyboard.press('Control+z');assert.equal((await state()).bonds.length,bonds,'undo restores bonds');
 }else if(slug==='folding-lab-3d'){
  const a=await project([2,2,0]);await drag(a,{x:a.x,y:a.y-90},120);assert((await state()).targets[0]>.5,'paper drag changes target angle');assert((await state()).angles[0]>.3,'hinge responds physically');assert((await state()).error<1e-7,'paper remains rigid');
  await page.keyboard.press('c');await frames();await drag(await project([-2,2,-3]),await project([-2,2,3]));assert.equal((await state()).targets.length,2,'drag draws a noncrossing crease');await page.keyboard.press('Control+z');assert.equal((await state()).targets.length,1,'undo removes drawn crease');
 }
 assert(await isClosed(),slug+' primary interaction never requires settings');
 await page.keyboard.press('Escape');await page.locator('#settings-toggle').click();assert(!(await isClosed()));await page.keyboard.press('Escape');assert(await isClosed());
 const cameraBefore=await page.evaluate(()=>lab.camera.position.toArray());await page.mouse.move(740,260);await page.mouse.down({button:'right'});await page.mouse.move(790,310,{steps:10});await page.mouse.up({button:'right'});await frames();const cameraAfter=await page.evaluate(()=>lab.camera.position.toArray());assert(cameraAfter.some((v,i)=>Math.abs(v-cameraBefore[i])>.01),'right drag orbits camera');
 await page.setViewportSize({width:390,height:844});await frames();assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight),false,'mobile body fits');assert(await page.locator('#scene-tools').isVisible());await page.setViewportSize({width:960,height:640});
 assert.deepEqual(errors,[],slug+' has no runtime errors');console.log('PASS direct interaction:',slug);
}
}finally{await browser.close()}
