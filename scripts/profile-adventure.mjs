// Production rendering, verified natural checkpoints, repeated seek/restore stress.
// Run alone: node scripts/profile-adventure.mjs <external-output-directory>
import { chromium } from '@playwright/test';
import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
if (!process.argv[2]) throw new Error('Pass an external output directory');
const output = resolve(process.argv[2]); await mkdir(output, { recursive: true });
const compiled = await build({configFile:false,logLevel:'silent',build:{ssr:'tests/expedition-route.ts',write:false}});
const { runExpedition, GameSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const route = runExpedition(42,true);
const archive = index => { const s=new GameSession(42,'expedition');route.commands.slice(0,index).forEach(c=>s.submit(c));return s.capture(); };
const guardIndex=route.states.findIndex(v=>v.enemies.some(e=>e.elite&&e.intent));
const relicIndex=route.states.findIndex(v=>v.player.relic);
const climbIndex=route.commands.findIndex((c,i)=>c==='up'&&i>relicIndex);
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1400,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/adventure.html');await page.locator('[data-state=ready]').waitFor({state:'attached'});
  const ready=()=>page.waitForFunction(()=>document.querySelector('canvas').dataset.busy==='false');
  const load=async raw=>{const tick=JSON.parse(raw).world.tick;await page.getByTestId('import-file').setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.waitForFunction(value=>document.querySelector('[data-testid=tick]').textContent===String(value),tick);await page.locator('dialog').waitFor({state:'hidden'});await ready();};
  const key=async k=>{await page.locator('canvas').focus();await page.keyboard.press(k);await ready();};
  const shot=async name=>page.screenshot({path:join(output,`${name}.png`),fullPage:true});
  await shot('start');await load(archive(guardIndex));await shot('guardian-windup');
  await page.locator('canvas').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('canvas').dataset.impact==='true');await ready();await shot('after-strike');
  await page.getByRole('button',{name:/^背包 /}).click();await shot('equipment');await page.getByRole('button',{name:'返回冒险',exact:true}).click();
  const reports=[];
  const summary=values=>{const sorted=values.slice().sort((a,b)=>a-b);return{median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],peak:sorted.at(-1)};};
  for(const low of [false,true]) {
    await load(archive(climbIndex));
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('低画质',{exact:false}).setChecked(low);await page.getByRole('button',{name:'返回冒险',exact:true}).click();
    await key('w');await key('s');
    await page.evaluate(()=>{
      window.samples=[];const canvas=document.querySelector('canvas');window.sampling=new MutationObserver(()=>{if(canvas.dataset.busy==='true')window.samples.push({time:performance.now(),cpu:Number(canvas.dataset.renderMs),calls:Number(canvas.dataset.drawCalls),triangles:Number(canvas.dataset.triangles),geometry:Number(canvas.dataset.geometries),heap:performance.memory?.usedJSHeapSize??null})});window.sampling.observe(canvas,{attributes:true,attributeFilter:['data-render-ms']});
    });
    await key('w');
    const measured=await page.evaluate(()=>{window.sampling.disconnect();return window.samples});
    reports.push({quality:low?'low':'normal',count:measured.length,cpuMs:summary(measured.map(s=>s.cpu)),intervalMs:summary(measured.slice(1).map((s,i)=>s.time-measured[i].time)),drawCalls:summary(measured.map(s=>s.calls)),triangles:summary(measured.map(s=>s.triangles)),geometries:summary(measured.map(s=>s.geometry)),heapBytes:summary(measured.map(s=>s.heap))});await shot(low?'deep-low':'deep-normal');
  }
  await load(route.session.capture());await page.getByRole('button',{name:'查看回放',exact:true}).click();
  const slider=page.locator('.replay input'),resource=[];
  const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.enable');
  for(let cycle=0;cycle<16;cycle++) {
    for(const index of [0,guardIndex,climbIndex,route.commands.length])await slider.fill(String(index));
    if(cycle%4===3) { await cdp.send('HeapProfiler.collectGarbage');resource.push(await page.evaluate(()=>({geometry:Number(document.querySelector('canvas').dataset.geometries),actors:Number(document.querySelector('canvas').dataset.actors),heap:performance.memory?.usedJSHeapSize??null}))); }
  }
  await page.getByRole('button',{name:'返回当前进度',exact:true}).click();await shot('complete');
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),extension=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable',browser:navigator.userAgent}});
  const restore=[];for(let i=0;i<8;i++){const started=performance.now();await load(archive(guardIndex));await load(route.session.capture());restore.push(performance.now()-started);}
  await load(archive(guardIndex));await page.setViewportSize({width:390,height:844});await shot('mobile-guardian');
  await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'EN',exact:true}).click();await shot('landscape');
  const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  const assets=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/\.(js|css)$/.test(n)));
  const report={date:new Date().toISOString(),build:'production / adventure.html',assets,viewport:'1400x1100 DPR1',gpu,routeActions:route.commands.length,scenario:'verified natural seed42 branch checkpoint, six floors explored, warmed ascent from floor6; 64 seeks over 16 cycles with forced GC every four cycles; 8 pairs of verified restores',reports,resources:resource,restorePairMs:summary(restore),errors,landscapeFits:fits,limitations:'Software renderer is not hardware/phone performance. CPU submission is not GPU completion; intervals include scheduling. Heap excludes GPU and uses coarse browser accounting. Forced-GC plateau is a bounded stress sample, not proof of no leaks.'};
  await writeFile(join(output,'adventure-profile.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(errors.length||!fits||resource.at(-1).geometry!==resource[0].geometry)throw new Error('Browser/resource check failed');
} finally { await browser.close(); }
