// Run against a fixed production preview after the integrator reserves an exclusive window.
// node scripts/profile-m25-performance.mjs --out <external-dir> --url http://127.0.0.1:4185/alpha3.html --exclusive [--hardware]
// --smoke checks the full UI/archive path once per quality, and is NOT performance acceptance.
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';

const options={out:'',url:'http://127.0.0.1:4185/alpha3.html',hardware:false,smoke:false,exclusive:false};
const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){const key=args[i];if(['--hardware','--smoke','--exclusive'].includes(key))options[key.slice(2)]=true;else if(['--out','--url'].includes(key)){assert(args[i+1],`Missing ${key}`);options[key.slice(2)]=args[++i];}else throw Error(`Unknown argument ${key}`);}
assert(options.out,'Pass an external evidence directory');assert(options.smoke||options.exclusive,'Full sampling requires --exclusive scheduling');
const out=resolve(options.out),rel=relative(process.cwd(),out);assert(rel.startsWith('..')||out.split(':')[0]!==resolve(process.cwd()).split(':')[0],'Evidence must be outside the repository');await mkdir(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const summary=values=>{const sorted=values.filter(Number.isFinite).toSorted((a,b)=>a-b);return sorted.length?{samples:sorted.length,median:sorted[Math.floor((sorted.length-1)/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],peak:sorted.at(-1),minimum:sorted[0]}:null;};
const sourceFiles=['tests/m25-trace.ts','tests/m18-trace.ts','tests/fixtures/alpha2-v1.json','src/alpha2/Game.vue','src/game-ui/native-ui.ts','src/game-ui/menus.ts','src/room/renderer.ts','src/core/alpha3.ts','src/session/session.ts','public/assets/items/manifest.json','scripts/profile-m25-performance.mjs'];
const hashes=()=>Promise.all(sourceFiles.map(async path=>({path,sha256:hash(await readFile(path))})));
const report={date:new Date().toISOString(),purpose:options.smoke?'functional smoke under potentially competing load; NOT performance acceptance':'exclusive warmed action performance',options,sourceHashes:await hashes(),host:{os:`${os.platform()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},buildAssets:[],scenarios:[],runs:[],summaries:[],errors:[],limitations:['Desktop headless Chromium at 1440×900/DPR1; this does not represent a physical phone.','renderMs is CPU render submission, not GPU completion. Busy-frame intervals include browser scheduling and observation.','geometry/texture totals include world and native UI resources sharing the renderer. JS heap excludes GPU memory.','Natural archives and public query candidates drive formal canvas UI; no mechanical state is injected or mutated outside commands.','All warmup and measured actions are checked against their exact complete archive oracle. No throughput or timing claim comes from Node oracle generation.','--hardware requests a GPU path; the actual WebGL renderer is recorded and software fallback is rejected for that option.']};
let browser,server,failure;
const assetTasks=[];
try{
 server=await createServer({root:process.cwd(),configFile:false,logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
 const {directItemCases}=await server.ssrLoadModule('/tests/m25-trace.ts'),{GameSession}=await server.ssrLoadModule('/src/session/session.ts');
 const names=['throw','zap','readItem'],all=directItemCases();
 const cases=names.map(name=>{const c=all.find(c=>c.name===name);assert(c,`Missing natural ${name} case`);const s=GameSession.fromArchive(c.before),v=s.view(),targets=s.queryTargets(c.sourceId,c.motion).filter(t=>t.status!=='disabled'),targetIndex=targets.findIndex(t=>t.command===c.command);assert(targetIndex>=0,`No public target for ${name}`);return{...c,index:v.alpha2.bag.findIndex(i=>i.id===c.sourceId),targetIndex,beforeRevision:v.revision,afterRevision:GameSession.fromArchive(c.after).view().revision};});
 for(const c of cases){await writeFile(join(out,`${c.name}-before.json`),c.before);await writeFile(join(out,`${c.name}-oracle.json`),c.after);report.scenarios.push({name:c.name,motion:c.motion,sourceId:c.sourceId,command:c.command,beforeSha256:hash(c.before),oracleSha256:hash(c.after),beforeRevision:c.beforeRevision,afterRevision:c.afterRevision});}
 await server.close();server=undefined;
 browser=await chromium.launch({headless:true,args:options.hardware?['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer','--enable-precise-memory-info']:['--enable-precise-memory-info']});report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',response=>{const url=response.url();if(new URL(url).origin!==new URL(options.url).origin)return;const kind=response.request().resourceType();if(!['script','stylesheet'].includes(kind)&&!new URL(url).pathname.match(/\.(glb|json)$/))return;assetTasks.push((async()=>{try{const body=await response.body();report.buildAssets.push({url,status:response.status(),bytes:body.length,sha256:hash(body)});}catch(error){report.buildAssets.push({url,status:response.status(),error:error.message});}})());});
 await page.goto(options.url);const canvas=page.locator('canvas[data-ui=native]');await canvas.waitFor();await page.waitForSelector('[data-state=ready]',{state:'attached'});
 report.device=await canvas.evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,jsHeapAvailable:!!performance.memory};});
 report.device.softwareRenderer=/swiftshader|llvmpipe|software/i.test(report.device.renderer??'');report.device.renderingPath=report.device.softwareRenderer?'software':report.device.renderer?'reported non-software GPU path':'unknown';
 if(options.hardware)assert(!report.device.softwareRenderer,'Hardware was requested but browser reports software rendering');
 const regions=async()=>JSON.parse(await canvas.getAttribute('data-regions'));
 async function click(id,pager){for(let n=0;n<16;n++){const list=await regions(),r=list.find(r=>r.id===id)??(pager?list.find(r=>r.id===pager):undefined);assert(r,`Missing UI region ${id}`);await canvas.click({position:{x:r.x+r.width/2,y:r.y+r.height/2}});if(r.id===id)return;}throw Error(`Unreachable UI region ${id}`);}
 async function load(c){if((await canvas.getAttribute('data-panel'))==='world')await click('aux');await page.getByTestId('import-file').setInputFiles({name:'natural-alpha3.json',mimeType:'application/json',buffer:Buffer.from(c.before)});await page.waitForFunction(revision=>{const c=document.querySelector('canvas[data-ui=native]');return c?.dataset.revision===String(revision)&&c.dataset.busy==='false'&&c.dataset.panel==='world';},c.beforeRevision);}
 async function prepare(c){await load(c);await click('bag');await page.waitForFunction(()=>document.querySelector('canvas[data-ui=native]')?.dataset.uiAssetsPending==='0');await click(`item:${c.index}`);await click(`offer:${c.motion}`,'interaction:next');for(let n=0;n<=c.targetIndex;n++)await page.keyboard.press('ArrowRight');assert.equal(await canvas.getAttribute('data-revision'),String(c.beforeRevision),'Target selection changed revision');}
 async function snapshot(c){if((await canvas.getAttribute('data-panel'))!=='world')await page.keyboard.press('Escape');await click('aux');await click('open:storage');await click('save');const actual=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m25'));if(actual!==c.after){await writeFile(join(out,`${c.name}-mismatch.json`),actual??'null');throw Error(`${c.name}: complete saved archive differs from oracle`);}return hash(actual);}
 async function run(c,quality,repeat,warmup){
  await prepare(c);
  await page.evaluate(()=>{window.m25ActionSamples=[];const c=document.querySelector('canvas[data-ui=native]');window.m25ActionObserver=new MutationObserver(()=>{if(c.dataset.busy==='true')window.m25ActionSamples.push({time:performance.now(),cpuMs:Number(c.dataset.renderMs),drawCalls:Number(c.dataset.drawCalls),triangles:Number(c.dataset.triangles),geometry:Number(c.dataset.geometries),textures:c.dataset.textures===undefined?null:Number(c.dataset.textures),heapBytes:performance.memory?.usedJSHeapSize??null});});window.m25ActionObserver.observe(c,{attributes:true,attributeFilter:['data-render-ms']});});
  await page.keyboard.press('Enter');await page.waitForFunction(revision=>{const c=document.querySelector('canvas[data-ui=native]');return c.dataset.revision===String(revision)&&c.dataset.busy==='false';},c.afterRevision,{timeout:15000});
  const samples=await page.evaluate(()=>{window.m25ActionObserver.disconnect();return window.m25ActionSamples;});assert(samples.length>1,`${c.name}: insufficient actual busy frames`);
  const archiveSha256=await snapshot(c);report.runs.push({scenario:c.name,quality,repeat,warmup,archiveSha256,archiveMatches:true,samples});
 }
 for(const quality of ['normal','low']){
  await load(cases[0]);await click('aux');await click('open:settings');if(quality==='low')await click('setting:low');await click('close');
  for(const c of cases)await run(c,quality,-1,true);
  for(const c of cases){for(let repeat=0;repeat<(options.smoke?1:3);repeat++)await run(c,quality,repeat,false);const runs=report.runs.filter(r=>r.quality===quality&&r.scenario===c.name&&!r.warmup),samples=runs.flatMap(r=>r.samples),intervals=runs.flatMap(r=>r.samples.slice(1).map((s,i)=>s.time-r.samples[i].time));report.summaries.push({quality,scenario:c.name,repeats:runs.length,frames:samples.length,...Object.fromEntries(['cpuMs','drawCalls','triangles','geometry','textures','heapBytes'].map(key=>[key,summary(samples.map(s=>s[key]))])),frameIntervalMs:summary(intervals)});}
  await canvas.screenshot({path:join(out,`saved-${quality}.png`)});
 }
 await Promise.all(assetTasks);report.sourceHashesAfter=await hashes();report.sourceStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);assert(report.sourceStable,'Source changed during sampling; results cannot describe a fixed candidate');assert.deepEqual(report.errors,[],'Browser exceptions');
 console.log(JSON.stringify({purpose:report.purpose,device:report.device,archiveChecks:report.runs.length,summaries:report.summaries}));
}catch(error){failure=error;report.failure={message:error.message,stack:error.stack};}finally{await browser?.close();await server?.close();await Promise.all(assetTasks);await writeFile(join(out,'profile.json'),JSON.stringify(report,null,2));await writeFile(join(out,'profile-m25-performance.mjs'),await readFile('scripts/profile-m25-performance.mjs'));}
if(failure)throw failure;
