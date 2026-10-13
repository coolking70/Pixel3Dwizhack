// Natural UI-only lifecycle sampling; run against an already built preview for acceptance.
// node scripts/m25-lifecycle.mjs --out <external-dir> --url http://127.0.0.1:5174/alpha3.html --cycles 3
// 100-cycle acceptance additionally requires --exclusive, after the integrator reserves the machine.
import {chromium,firefox} from '@playwright/test';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),options={cycles:3,url:'http://127.0.0.1:5174/alpha3.html',out:'',exclusive:false,hardware:false};
for(let i=0;i<args.length;i++){const key=args[i];if(key==='--exclusive'||key==='--hardware')options[key.slice(2)]=true;else if(['--cycles','--url','--out'].includes(key)){const value=args[++i];assert(value,`Missing ${key}`);options[key.slice(2)]=key==='--cycles'?Number(value):value;}else throw Error(`Unknown option ${key}`);}
assert(Number.isSafeInteger(options.cycles)&&options.cycles>=3&&options.cycles<=300,'cycles must be 3..300');
assert(options.cycles<=3||options.exclusive,'Long sampling requires explicit --exclusive scheduling');
assert(options.out,'Pass an external evidence directory');
const out=resolve(options.out),rel=relative(process.cwd(),out);assert(rel.startsWith('..')||resolve(out).split(':')[0]!==resolve(process.cwd()).split(':')[0],'Evidence must be outside the repository');
await mkdir(out,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const distribution=values=>{const s=values.filter(Number.isFinite).toSorted((a,b)=>a-b);return s.length?{count:s.length,median:s[Math.floor((s.length-1)*.5)],p95:s[Math.ceil(s.length*.95)-1],peak:s.at(-1),minimum:s[0]}:null;};
function trend(values){const v=values.filter(Number.isFinite);if(v.length<2)return null;let positive=0,negative=0,run=1,longest=1;for(let i=1;i<v.length;i++){if(v[i]>v[i-1])positive++;if(v[i]<v[i-1]){negative++;run=1;}else longest=Math.max(longest,++run);}const mean=v.reduce((a,b)=>a+b,0)/v.length,x=(v.length-1)/2;let numerator=0,denominator=0;v.forEach((y,i)=>{numerator+=(i-x)*(y-mean);denominator+=(i-x)**2;});const windows=[];for(let i=0;i<v.length;i+=10)windows.push({fromCycle:i,toCycle:Math.min(v.length,i+10)-1,...distribution(v.slice(i,i+10))});return{first:v[0],last:v.at(-1),delta:v.at(-1)-v[0],positiveSteps:positive,negativeSteps:negative,longestNondecreasingRun:longest,slopePerCycle:numerator/denominator,strictlyNondecreasing:negative===0&&positive>0,windows};}
const files=['src/alpha2/Game.vue','src/game-ui/native-ui.ts','src/game-ui/menus.ts','src/game-ui/input.ts','src/room/renderer.ts','src/session/session.ts','public/assets/items/manifest.json','scripts/m25-lifecycle.mjs'];
const sourceHashes=await Promise.all(files.map(async path=>({path,sha256:digest(await readFile(path))})));
let firefoxInstalled=false;try{await access(firefox.executablePath());firefoxInstalled=true;}catch{}
const report={date:new Date().toISOString(),purpose:options.cycles===3?'functional smoke under potentially competing load; NOT performance acceptance':'exclusive lifecycle sample',options,device:{os:`${os.platform()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},sourceHashes,firefox:{playwrightExecutable:firefox.executablePath(),installed:firefoxInstalled,launched:false},viewports:[],limitations:['Desktop headless Chromium, DPR 1; viewport emulation is not a physical phone.','Geometry/texture counters are shared renderer totals, grouped by visible UI/world phase; they are not per-scene asset ownership.','WebGL live counters mean create minus explicit delete calls, not allocated bytes or GPU memory; GC/context loss may retire native objects independently.','CPU render submission excludes GPU completion. Automation transition time includes input transport and two-frame settling.','Heap is JavaScript memory, not GPU memory; post-GC checkpoints intentionally run outside transition timing.','Instrumentation and automation add overhead. A short run cannot establish absence of leaks.','Firefox executable probe is not a browser compatibility test.']};
const browser=await chromium.launch({headless:true,args:['--enable-precise-memory-info',...(options.hardware?['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']:[])]});report.browser=browser.version();
let failure;
try{for(const [width,height]of [[1440,900],[844,390],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage(),errors=[],samples=[],checkpoints=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const contexts=new WeakMap(),records=[];
  function record(gl){let r=contexts.get(gl);if(!r){r={id:records.length,canvas:new WeakRef(gl.canvas),textures:0,buffers:0,createdTextures:0,deletedTextures:0,createdBuffers:0,deletedBuffers:0,textureSet:new WeakSet(),bufferSet:new WeakSet()};contexts.set(gl,r);records.push(r);}return r;}
  for(const Constructor of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(Constructor)for(const kind of ['Texture','Buffer']){const p=Constructor.prototype,create=p['create'+kind],remove=p['delete'+kind],key=kind==='Texture'?'textures':'buffers',set=kind==='Texture'?'textureSet':'bufferSet';p['create'+kind]=function(...a){const obj=create.apply(this,a);if(obj){const r=record(this);r[set].add(obj);r[key]++;r['created'+kind+'s']++;}return obj;};p['delete'+kind]=function(obj){const r=record(this);if(obj&&r[set].has(obj)){r[set].delete(obj);r[key]--;r['deleted'+kind+'s']++;}return remove.call(this,obj);};}
  window.__m25WebGL=()=>records.map(r=>({id:r.id,main:r.canvas.deref()?.dataset?.ui==='native',connected:!!r.canvas.deref()?.isConnected,textures:r.textures,buffers:r.buffers,createdTextures:r.createdTextures,deletedTextures:r.deletedTextures,createdBuffers:r.createdBuffers,deletedBuffers:r.deletedBuffers}));
 });
 await page.goto(options.url);const canvas=page.locator('canvas[data-ui=native]');await canvas.waitFor();
 const regions=async()=>JSON.parse(await canvas.getAttribute('data-regions'));
 const click=async id=>{const r=(await regions()).find(r=>r.id===id);assert(r,`Missing region ${id}`);await canvas.click({position:{x:r.x+r.width/2,y:r.y+r.height/2}});};
 const settle=async panel=>{await page.waitForFunction(panel=>{const c=document.querySelector('canvas[data-ui=native]');return c?.dataset.panel===panel&&c.dataset.uiAssetsPending==='0';},panel);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 const startRegions=await regions();await click('start');await settle('world');
 const initial=await canvas.evaluate(c=>({tick:c.dataset.tick,revision:c.dataset.revision}));
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
 const capabilities=await canvas.evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,dpr:devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,jsHeapAvailable:!!performance.memory};});
 if(options.hardware)assert(capabilities.renderer&&!/swiftshader|llvmpipe|software/i.test(capabilities.renderer),'Hardware requested but renderer is unavailable or software');
 const scripts=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.src));const servedAssets=[];for(const url of scripts){const response=await page.request.get(url);servedAssets.push({url,status:response.status(),sha256:digest(await response.body())});}
 const take=async(cycle,phase,transitionMs)=>{const s=await canvas.evaluate(c=>({tick:c.dataset.tick,revision:c.dataset.revision,panel:c.dataset.panel,geometry:Number(c.dataset.geometries),textures:c.dataset.textures===undefined?null:Number(c.dataset.textures),cpuRenderMs:Number(c.dataset.renderMs),drawCalls:Number(c.dataset.drawCalls),triangles:Number(c.dataset.triangles),jsHeapBytes:performance.memory?.usedJSHeapSize??null,webgl:window.__m25WebGL()}));assert.equal(s.tick,initial.tick,`tick changed at ${cycle}/${phase}`);assert.equal(s.revision,initial.revision,`revision changed at ${cycle}/${phase}`);if(cycle>=0)samples.push({cycle,phase,transitionMs,...s});};
 const phase=async(cycle,name,panel,operation)=>{const begin=performance.now();await operation();await settle(panel);await take(cycle,name,performance.now()-begin);};
 for(let cycle=-2;cycle<options.cycles;cycle++){
  await phase(cycle,'bag','bag',()=>click('bag'));
  const food=(await regions()).find(r=>r.id.startsWith('item:')&&/干粮|ration/i.test(r.label));assert(food,'Natural starter ration is required');
  await phase(cycle,'detail','itemDetail',()=>click(food.id));
  const world=cycle%2===0,action=world?'throw':'eat';
  await phase(cycle,world?'world-target':'bag-target',world?'aim':'targets',async()=>{for(let n=0;n<12;n++){if((await regions()).some(r=>r.id===`offer:${action}`)){await click(`offer:${action}`);await page.keyboard.press('ArrowRight');return;}await click('interaction:next');}throw Error(`Missing offer ${action}`);});
  await phase(cycle,'cancel-detail','itemDetail',()=>page.keyboard.press('Escape'));
  await phase(cycle,'cancel-bag','bag',()=>page.keyboard.press('Escape'));
  await phase(cycle,'world','world',()=>click('close'));
  if(cycle>=0){await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters'),resources=await canvas.evaluate(c=>({geometry:Number(c.dataset.geometries),textures:c.dataset.textures===undefined?null:Number(c.dataset.textures),webgl:window.__m25WebGL()}));checkpoints.push({cycle,heapUsedBytes:heap.usedSize,heapTotalBytes:heap.totalSize,documents:dom.documents,nodes:dom.nodes,eventListeners:dom.jsEventListeners,...resources});}
 }
 const metrics=['geometry','textures','cpuRenderMs','drawCalls','triangles','jsHeapBytes','transitionMs'],byPhase={};for(const name of new Set(samples.map(s=>s.phase)))byPhase[name]=Object.fromEntries(metrics.map(key=>[key,distribution(samples.filter(s=>s.phase===name).map(s=>s[key]))]));
 const trends=Object.fromEntries(['geometry','textures','heapUsedBytes','nodes','eventListeners'].map(key=>[key,trend(checkpoints.map(s=>s[key]))]));
 const result={width,height,warmupCycles:2,measuredCycles:options.cycles,initial,startSeedLabel:startRegions.find(r=>r.id==='seed')?.label,capabilities,servedAssets,byPhase,trends,samples,checkpoints,errors};report.viewports.push(result);
 await canvas.screenshot({path:join(out,`world-${width}x${height}.png`)});await writeFile(join(out,'lifecycle.json'),JSON.stringify(report,null,2));assert.deepEqual(errors,[],'Browser exceptions');await context.close();
 console.log(JSON.stringify({width,height,cycles:options.cycles,initial,trends}));
 }
 report.sourceHashesAfter=await Promise.all(files.map(async path=>({path,sha256:digest(await readFile(path))})));
 assert.deepEqual(report.sourceHashesAfter,sourceHashes,'Source changed during lifecycle sampling');
 }catch(error){failure=error;report.failure={message:error.message,stack:error.stack};}finally{await browser.close();await writeFile(join(out,'lifecycle.json'),JSON.stringify(report,null,2));await writeFile(join(out,'m25-lifecycle.mjs'),await readFile('scripts/m25-lifecycle.mjs'));}
if(failure)throw failure;
