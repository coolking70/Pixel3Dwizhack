import {chromium} from '@playwright/test';
import {build} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
if(!process.argv[2])throw new Error('Pass an external evidence directory');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const built=await build({configFile:false,logLevel:'silent',build:{ssr:'tests/m18-trace.ts',write:false}});
const {itemActionCases,itemTargetCases}=await import(`data:text/javascript;base64,${Buffer.from(built.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const builtSession=await build({configFile:false,logLevel:'silent',build:{ssr:'src/session/session.ts',write:false}});
const {GameSession}=await import(`data:text/javascript;base64,${Buffer.from(builtSession.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const cases=itemActionCases();assert.equal(cases.length,8);
cases.push(...itemTargetCases(cases));assert.equal(cases.length,11);
const browser=await chromium.launch({args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
const records=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.argv[3]??'http://127.0.0.1:4185'}/alpha2.html`);await page.locator('[data-state=ready]').waitFor({state:'attached'});
 const canvas=page.locator('canvas[data-ui=native]');
 const click=async id=>{await page.waitForFunction(id=>JSON.parse(document.querySelector('canvas').dataset.regions??'[]').some(r=>r.id===id),id,{timeout:5000});const r=JSON.parse(await canvas.getAttribute('data-regions')).find(r=>r.id===id);assert(r,`Missing hotzone ${id}`);await canvas.click({position:{x:r.x+r.width/2,y:r.y+r.height/2}});};
 for(const c of cases)for(const stage of ['contact','effect']){
  await page.getByTestId('import-file').setInputFiles({name:'natural.json',mimeType:'application/json',buffer:Buffer.from(c.before)});
  await page.waitForFunction(t=>document.querySelector('canvas').dataset.tick===String(t)&&document.querySelector('canvas').dataset.panel==='world',JSON.parse(c.before).world.tick);
  await page.waitForTimeout(180);
  const view=GameSession.fromArchive(c.before).view(),parts=c.command.split(':'),itemId=c.command.startsWith('wear:')?Number(parts[1]):c.command.startsWith('unequip:')?view.alpha2.bag.find(i=>i.equipped===parts[1]).id:Number(parts[2]);
  if(c.command!=='potion'){
   await click('bag');await click(`item:${view.alpha2.bag.findIndex(i=>i.id===itemId)}`);
   if(!['equip','unequip'].includes(c.motion)){
    await click(`action:${c.motion}`);
    const targets=view.alpha2.targets.filter(t=>c.motion==='drink'||c.motion==='eat'?t.kind==='self':c.motion==='throw'?['enemy','facility'].includes(t.kind):c.motion==='read'?['self','item'].includes(t.kind):c.motion==='apply'?t.kind!=='enemy':t.kind!=='item');
    const index=targets.findIndex(t=>t.key===parts[4]);assert(index>=0,`Target ${parts[4]}`);for(let n=0;n<index;n++)await click('target');
   }
  }
  await page.evaluate(stage=>{window.m18RAF=requestAnimationFrame;window.m18Frozen=null;window.requestAnimationFrame=callback=>window.m18RAF(time=>{const c=document.querySelector('canvas');if(c.dataset.interactionStage===stage&&(stage!=='effect'||Number(c.dataset.phase)>=.65)){window.m18Frozen={phase:c.dataset.phase,motion:c.dataset.motion,error:c.dataset.contactError,mouth:c.dataset.mouthError,application:c.dataset.applicationError,asset:c.dataset.itemActionAsset,flight:c.dataset.itemFlight,panel:c.dataset.panel};return;}callback(time);});},stage);
  await click(c.command==='potion'?'command:potion':['equip','unequip'].includes(c.motion)?`action:${c.motion}`:'execute');
  await page.waitForFunction(()=>window.m18Frozen!==null,undefined,{polling:25});
  const frame=await page.evaluate(()=>window.m18Frozen);records.push({name:c.name,stage,...frame});
  await canvas.screenshot({path:join(out,`${c.name}-${stage}.png`),animations:'allow'});
  await writeFile(join(out,'actions-progress.json'),JSON.stringify({records,errors},null,2));
  assert.notEqual(frame.asset,'pending');assert(Number(frame.error)<.08,`${c.name} ${stage} palm ${frame.error}`);
  if(frame.mouth)assert(Number(frame.mouth)<.01,`${c.name} ${stage} mouth ${frame.mouth}`);
  if(frame.application)assert(Number(frame.application)<.01,`${c.name} ${stage} application ${frame.application}`);
  if(c.command!=='potion')assert.equal(frame.panel,'action');
  await page.evaluate(()=>{window.requestAnimationFrame=window.m18RAF;window.dispatchEvent(new Event('blur'));});
  if(await canvas.getAttribute('data-panel')==='bag')await click('close');
  await click('save');assert.equal(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15')),c.after);
 }
 const device=await canvas.evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent};});
 assert.deepEqual(errors,[]);await writeFile(join(out,'actions.json'),JSON.stringify({device,records,errors,method:'Eleven accepted natural branches; actual canvas hotzones, contact/effect frame then real blur/save; complete archives identical.'},null,2));
 console.log(JSON.stringify({records,errors}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),records,errors},null,2));throw error;
}finally{await browser.close();}
