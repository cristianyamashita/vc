// Verify the real desktop embedding path with an isolated browser profile.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=(process.env.VC_ACTION_URL||'http://127.0.0.1:8781/page').replace(/\/$/,'');
const slugs=['robot-arena','rooftop-ninja','neon-tanks','station-survival','ruins-knight','drone-hunter','city-monster','pirate-island','grapple-arena','armored-convoy'];
try{
 await page.goto(base+'/os/');await page.waitForFunction(()=>window.OS?.state);
 await page.evaluate(async slugs=>{OS.state.onboarded=true;for(const slug of slugs){const id='game-'+slug;if(!OS.state.installed.includes(id))OS.state.installed.push(id);localStorage.setItem('vc-'+slug+'-v1',JSON.stringify({lang:'en',theme:'dark'}));}await OS.persistNow();},slugs);
 await page.reload();await page.waitForFunction(()=>window.OS?.state&&!document.documentElement.dataset.setup);
 await page.evaluate(()=>{OS.setLang('pt');OS.setTheme('light');});
 for(const slug of slugs){
  const id='game-'+slug;await page.evaluate(id=>OSWindows.open(id),id);
  const frameElement=await page.locator(`.os-window[data-app-id="${id}"] iframe`).elementHandle();const frame=await frameElement.contentFrame();await frame.waitForFunction(()=>window.__game,{timeout:45000});
  const result=await frame.evaluate(()=>({lang:document.documentElement.lang,theme:document.documentElement.dataset.theme||(document.body.classList.contains('light')?'light':'dark'),overflow:document.body.scrollWidth>innerWidth||document.body.scrollHeight>innerHeight,hidden:['lang-switcher','theme-switcher'].every(id=>getComputedStyle(document.getElementById(id)).display==='none'),toolbar:document.querySelector('.topbar').getBoundingClientRect().height,help:document.getElementById('help-button').getBoundingClientRect().width}));
  assert.equal(result.lang,'pt',slug+' inherits desktop language despite saved standalone preference');assert.equal(result.theme,'light',slug+' inherits desktop theme');assert(result.hidden,slug+' desktop hides redundant controls');assert(!result.overflow,slug+' iframe fits');assert(result.toolbar<=44.1&&result.help>0,slug+' keeps compact toolbar and help');
  await frame.evaluate(()=>__game.start());await frame.waitForTimeout(100);await frame.locator('#help-button').click();assert(await frame.locator('dialog').evaluate(d=>d.open),slug+' embedded help opens');
  await page.evaluate(id=>OSWindows.close(id),id);console.log('PASS desktop',slug);
 }
 assert.deepEqual(errors,[],'no embedding errors');
}finally{await browser.close();}
