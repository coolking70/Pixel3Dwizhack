// Actual production UI with verified natural histories. Run separately from
// other GPU tests; --hardware selects ANGLE D3D11 and reports the actual renderer.
import {chromium} from '@playwright/test';
import {build} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
if(!process.argv[2])throw new Error('Pass an external output directory');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const compiled=await build({configFile:false,logLevel:'silent',build:{ssr:'tests/alpha2-route.ts',write:false}});
const {runAlpha2,GameSession}=await import(`data:text/javascript;base64,${Buffer.from(compiled.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const route=runAlpha2(42,'channeler','items'),fighter=runAlpha2(42,'vanguard','direct');
const archive=(r,index)=>{const s=new GameSession(42,'alpha2');r.commands.slice(0,index).forEach(c=>s.submit(c));return s.capture();};
const relic=route.states.findIndex(v=>v.player.relic),climb=route.commands.findIndex((c,i)=>c==='up'&&i>relic),aimed=route.states.findIndex(v=>v.enemies.some(e=>e.kind==='hexer'&&e.intent)),gate=route.states.findIndex(v=>v.alpha.doors.some(d=>d.floor===v.player.floor&&!d.open&&Math.abs(d.x-v.player.x)<=1)),guardian=fighter.states.findIndex(v=>v.enemies.some(e=>e.elite&&e.intent));
if([relic,climb,aimed,gate,guardian].some(n=>n<0))throw new Error('Required natural checkpoint absent');
const hardware=process.argv.includes('--hardware'),browser=await chromium.launch(hardware?{args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']}:{});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/alpha2.html');await page.locator('[data-state=ready]').waitFor();
 const ready=()=>page.waitForFunction(()=>document.querySelector('canvas').dataset.busy==='false');
 const load=async raw=>{const tick=JSON.parse(raw).world.tick;await page.getByTestId('import-file').setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.waitForFunction(t=>document.querySelector('[data-testid=tick]').textContent===String(t)&&!document.querySelector('dialog[open]'),tick);await ready();};
 const key=async k=>{await page.locator('canvas').focus();await page.keyboard.press(k);await ready();};
 const shot=async name=>page.screenshot({path:join(out,name+'.png'),fullPage:true});
 await shot('start');await load(archive(route,aimed));await shot('hexer');await load(archive(route,gate));await shot('gate');await load(archive(fighter,guardian));await shot('guardian');
 await page.getByRole('button',{name:/^背包 /}).click();await shot('inventory');await page.getByRole('button',{name:'返回冒险',exact:true}).click();
 await page.getByRole('button',{name:'已发现图鉴',exact:true}).click();await shot('codex');await page.getByRole('button',{name:'返回冒险',exact:true}).click();
 const device=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),userAgent:navigator.userAgent,dpr:devicePixelRatio,viewport:[innerWidth,innerHeight]};});
 const summarize=a=>{const s=a.toSorted((a,b)=>a-b);return{median:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],peak:s.at(-1)};};
 const reports=[];
 for(const low of [false,true]){
  await load(archive(route,climb));await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('低画质',{exact:false}).setChecked(low);await page.getByRole('button',{name:'返回冒险',exact:true}).click();
  await key('w');await key('s');
  await page.evaluate(()=>{window.samples=[];const c=document.querySelector('canvas');window.observer=new MutationObserver(()=>{if(c.dataset.busy==='true')window.samples.push({time:performance.now(),cpu:Number(c.dataset.renderMs),calls:Number(c.dataset.drawCalls),triangles:Number(c.dataset.triangles),geometry:Number(c.dataset.geometries),heap:performance.memory?.usedJSHeapSize??null})});window.observer.observe(c,{attributes:true,attributeFilter:['data-render-ms']});});
  await key('w');const samples=await page.evaluate(()=>{window.observer.disconnect();return window.samples;});
  reports.push({quality:low?'low':'normal',count:samples.length,cpuMs:summarize(samples.map(s=>s.cpu)),frameIntervalMs:summarize(samples.slice(1).map((s,i)=>s.time-samples[i].time)),drawCalls:summarize(samples.map(s=>s.calls)),triangles:summarize(samples.map(s=>s.triangles)),geometry:summarize(samples.map(s=>s.geometry)),heap:summarize(samples.map(s=>s.heap))});await shot(low?'deep-low':'deep-normal');
 }
 await load(route.session.capture());await shot('complete');await page.getByRole('button',{name:'查看回放',exact:true}).click();const slider=page.locator('.replay input'),memory=[];
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');
 for(let cycle=0;cycle<12;cycle++){for(const index of [0,aimed,climb,route.commands.length])await slider.fill(String(index));if(cycle%3===2){await cdp.send('HeapProfiler.collectGarbage');memory.push(await page.locator('canvas').evaluate(c=>({geometry:Number(c.dataset.geometries),actors:Number(c.dataset.actors),heap:performance.memory?.usedJSHeapSize??null})));}}
 const restore=[];for(let i=0;i<6;i++){const start=performance.now();await load(archive(route,aimed));await load(route.session.capture());restore.push(performance.now()-start);}
 await load(archive(route,gate));await page.setViewportSize({width:390,height:844});await shot('mobile');await page.getByRole('button',{name:'EN',exact:true}).click();await page.setViewportSize({width:844,height:390});await shot('landscape');
 const landscapeFits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
 const assets=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/')).map(e=>({url:e.name,bytes:e.transferSize})));
 await writeFile(join(out,'alpha2-profile.json'),JSON.stringify({hardwareRequested:hardware,device,scenario:{seed:42,loadout:'channeler',strategy:'items',commands:route.commands.length},reports,memory,restorePairMs:summarize(restore),landscapeFits,assets,errors},null,2));
}finally{await browser.close();}
