// Actual production canvas actions from natural, formally validated checkpoints.
import {chromium} from '@playwright/test';
import {build} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
if(!process.argv[2])throw new Error('Pass an external evidence directory');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const built=await build({configFile:false,logLevel:'silent',build:{ssr:'tests/m16-trace.ts',write:false}});
const {interactionCases}=await import(`data:text/javascript;base64,${Buffer.from(built.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const cases=interactionCases();assert(cases.some(c=>c.name==='chestOpen'));
const browser=await chromium.launch({args:process.argv.includes('--hardware')?['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']:[]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4185/alpha2.html');await page.locator('[data-state=ready]').waitFor({state:'attached'});
 const canvas=page.locator('canvas[data-ui=native]');
 const click=async id=>{for(let attempt=0;attempt<20;attempt++){const regions=JSON.parse(await canvas.getAttribute('data-regions')),r=regions.find(r=>r.id===id);if(r){await canvas.click({position:{x:r.x+r.width/2,y:r.y+r.height/2}});return;}const next=regions.find(r=>r.id==='near:next');if(!next)throw new Error(`No region ${id}`);await canvas.click({position:{x:next.x+next.width/2,y:next.y+next.height/2}});}throw new Error(`Region pagination failed: ${id}`);};
 const load=async raw=>{await page.getByTestId('import-file').setInputFiles({name:'natural.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.waitForFunction(t=>document.querySelector('canvas').dataset.tick===String(t)&&!document.querySelector('dialog[open]'),JSON.parse(raw).world.tick);};
 const records=[];
 for(const c of cases){
   for(const stage of ['contact','effect']){
     await load(c.before);await page.waitForTimeout(160);
     await page.evaluate(stage=>{window.m16RAF=requestAnimationFrame;window.m16Frozen=null;window.requestAnimationFrame=callback=>window.m16RAF(time=>{const c=document.querySelector('canvas');if(c.dataset.interactionStage===stage&&(stage!=='effect'||Number(c.dataset.phase)>=.70)){window.m16Frozen={phase:c.dataset.phase,motion:c.dataset.motion,error:c.dataset.contactError};return;}callback(time);});},stage);
     await click(`near:${c.command}`);
     await page.waitForFunction(()=>window.m16Frozen!==null,{},{polling:30});
     const frame=await page.evaluate(()=>window.m16Frozen);await canvas.screenshot({path:join(out,`${c.name}-${stage}.png`),animations:'allow'});
     records.push({name:c.name,command:c.command,stage,...frame});
     assert(Number(frame.error)<.08,`${c.name} ${stage} palm error ${frame.error}`);
     await page.evaluate(()=>{window.requestAnimationFrame=window.m16RAF;});
     // Saving settles visuals; byte-identical archive proves no animation payment.
     await click('save');assert.equal(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15')),c.after);
   }
 }
 await load(cases[0].after);await click('bag');await page.waitForTimeout(300);await canvas.screenshot({path:join(out,'native-bag-desktop.png')});
 for(const [width,height] of [[390,844],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);await canvas.screenshot({path:join(out,`native-bag-${width}.png`)});}
 const device=await canvas.evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent,dpr:devicePixelRatio};});
 await writeFile(join(out,'interactions.json'),JSON.stringify({device,method:'Natural M15 command prefixes/branches, production canvas hotzones, observed RAF stage frozen then save settles; exact complete archive comparisons.',records,errors},null,2));
 console.log(JSON.stringify({records,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
