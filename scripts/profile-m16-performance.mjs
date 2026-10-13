// Run on the production preview at 4185, separately from all tests/builds.
import {chromium} from '@playwright/test';
import {build} from 'vite';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,relative} from 'node:path';
import assert from 'node:assert/strict';
if(!process.argv[2])throw new Error('Pass an external evidence directory');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const cyclesArg=process.argv.indexOf('--cycles'),cycles=cyclesArg<0?9:Number(process.argv[cyclesArg+1]);
if(!Number.isSafeInteger(cycles)||cycles<3||cycles>300)throw new Error('cycles must be 3..300');
const built=await build({configFile:false,logLevel:'silent',build:{ssr:'tests/m16-trace.ts',write:false}});
const {interactionCases}=await import(`data:text/javascript;base64,${Buffer.from(built.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const cases=interactionCases().filter(c=>['pickupLow','leverPull','chestOpen'].includes(c.name));
const hardware=process.argv.includes('--hardware'),browser=await chromium.launch({args:hardware?['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']:[]});
const summary=a=>{const s=a.toSorted((a,b)=>a-b);return{median:s[Math.floor(s.length*.5)]??null,p95:s[Math.min(s.length-1,Math.floor(s.length*.95))]??null,peak:s.at(-1)??null};};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4185/alpha2.html');await page.locator('[data-state=ready]').waitFor({state:'attached'});
 const canvas=page.locator('canvas[data-ui=native]');
 const click=async id=>{for(let n=0;n<20;n++){const regions=JSON.parse(await canvas.getAttribute('data-regions')),r=regions.find(r=>r.id===id)??regions.find(r=>r.id==='near:next');if(!r)throw new Error(`No region ${id}`);await canvas.click({position:{x:r.x+r.width/2,y:r.y+r.height/2}});if(r.id===id)return;}throw new Error('region limit');};
 const load=async raw=>{const started=performance.now();await page.getByTestId('import-file').setInputFiles({name:'natural.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.waitForFunction(t=>document.querySelector('canvas').dataset.tick===String(t)&&!document.querySelector('dialog[open]'),JSON.parse(raw).world.tick);const duration=performance.now()-started;await page.waitForTimeout(100);return duration;};
 const ready=()=>page.waitForFunction(()=>document.querySelector('canvas').dataset.busy==='false');
 const reports=[];
 for(const low of [false,true]){
   await load(cases[0].before);await click('aux');await click('open:settings');if(low)await click('setting:low');await click('close');
   // Warm all measured models, shaders and UI text outside measured samples.
   for(const c of cases){await load(c.before);await click(`near:${c.command}`);await ready();}
   for(const c of cases){
     const samples=[],intervals=[];
     for(let repeat=0;repeat<3;repeat++){
       await load(c.before);
       await page.evaluate(()=>{window.m16Samples=[];const canvas=document.querySelector('canvas');window.m16Observer=new MutationObserver(()=>{if(canvas.dataset.busy==='true')window.m16Samples.push({time:performance.now(),cpu:Number(canvas.dataset.renderMs),calls:Number(canvas.dataset.drawCalls),triangles:Number(canvas.dataset.triangles),geometry:Number(canvas.dataset.geometries),heap:performance.memory?.usedJSHeapSize??0});});window.m16Observer.observe(canvas,{attributes:true,attributeFilter:['data-render-ms']});});
       await click(`near:${c.command}`);await ready();
       const current=await page.evaluate(()=>{window.m16Observer.disconnect();return window.m16Samples;});samples.push(...current);intervals.push(...current.slice(1).map((s,i)=>s.time-current[i].time));
       await click('save');assert.equal(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15')),c.after);
     }
     reports.push({quality:low?'low':'normal',scenario:c.name,repeats:3,samples:samples.length,cpuMs:summary(samples.map(s=>s.cpu)),frameIntervalMs:summary(intervals),drawCalls:summary(samples.map(s=>s.calls)),triangles:summary(samples.map(s=>s.triangles)),geometries:summary(samples.map(s=>s.geometry)),heapBytes:summary(samples.map(s=>s.heap))});
   }
 }
 const device=await canvas.evaluate(c=>{const gl=c.getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
 const memory=[],restores=[],bagOpens=[],cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');
 for(let cycle=0;cycle<cycles;cycle++){
   restores.push(await load(cases[cycle%cases.length].before));
   const started=performance.now();await click('bag');await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c.dataset.panel==='bag'&&c.dataset.uiAssetsPending==='0';});bagOpens.push(performance.now()-started);
   await page.waitForTimeout(180);await click('close');if(cycle%3===2){await cdp.send('HeapProfiler.collectGarbage');memory.push(await canvas.evaluate(c=>({geometry:Number(c.dataset.geometries),heap:performance.memory?.usedJSHeapSize??null})));}
 }
 const periodic={samples:cycles,restoreRoundtripMs:summary(restores),bagReadyRoundtripMs:summary(bagOpens),method:'Browser controller roundtrip to validated restore / bag assets ready. Excludes explicit settling waits; includes automation overhead. Three checkpoints cycled; first inventory visit may load uncached thumbnails.'};
 const files={};
 async function hashAssets(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await hashAssets(path);else if(entry.isFile())files[relative('dist/assets',path).replaceAll('\\','/')]=createHash('sha256').update(await readFile(path)).digest('hex');}}
 await hashAssets('dist/assets');
 await writeFile(join(out,'profile.json'),JSON.stringify({device,hardwareRequested:hardware,buildAssets:files,reports,periodic,memory,errors,limitations:['Only desktop Chromium; no physical phone, Safari or Firefox.','CPU submission is not GPU completion; heap excludes GPU memory.','3 natural interaction scenarios, 3 repeats each quality, warmed shaders/models.',`${cycles} inventory/restore cycles and ${memory.length} GC samples are not a long-term leak proof.`]},null,2));
 console.log(JSON.stringify({device,reports,periodic,memory,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
