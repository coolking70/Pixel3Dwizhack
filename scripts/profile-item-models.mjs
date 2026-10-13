// Usage: npm run dev -- --port 5174; node scripts/profile-item-models.mjs <external-output-directory>
// Actual Chromium art fixtures, not phone performance or live-game interaction acceptance.
import { chromium } from '@playwright/test';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,join } from 'node:path';
if(!process.argv[2])throw Error('Pass an external output directory');
const output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1240,height:960}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/m16-items-inspection',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#242d32"></body>'}));
 await page.goto('http://127.0.0.1:5174/m16-items-inspection');
 const atlas=[];
 for(const level of [0,1,2])for(const size of (level===1?[64]:[48,64,96])) {
  atlas.push(await page.evaluate(async({level,size})=>{
   const {ItemThumbnailCache,renderItemAtlas}=await import('/src/visual/items/thumbnail-cache.ts');
   const cache=new ItemThumbnailCache();const canvas=await renderItemAtlas(cache,[size],level);document.body.replaceChildren(canvas);const result={level,size,width:canvas.width,height:canvas.height,entries:cache.size};cache.dispose();return result;
  },{level,size}));
  await page.screenshot({path:join(output,`items-atlas-lod${level}-${size}.png`),fullPage:true});
 }
 const scenes=[],conditions=[];
 for(const size of [48,64,96]){
  conditions.push(await page.evaluate(async size=>{const {ItemThumbnailCache,renderFoodConditionAtlas}=await import('/src/visual/items/thumbnail-cache.ts');const cache=new ItemThumbnailCache(),canvas=await renderFoodConditionAtlas(cache,size);document.body.replaceChildren(canvas);const ctx=canvas.getContext('2d'),differences=[];for(const row of [0,2])for(let food=0;food<4;food++){const x=food*168+(168-size)/2,a=ctx.getImageData(x,row*130+4,size,size).data,b=ctx.getImageData(x,(row+1)*130+4,size,size).data;let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;if(!changed)throw Error('Fresh/stale rendered identically');differences.push({level:row===0?0:2,food,changed});}const result={size,entries:cache.size,differences};cache.dispose();return result;},size));
  await page.screenshot({path:join(output,`items-freshness-${size}.png`)});
 }
 for(const level of [0,2])for(const mode of ['ground','equipment','reading'])for(const batch of (mode==='equipment'?[0,1,2]:[0])){
  scenes.push(await page.evaluate(async({mode,level,batch})=>{
   const {inspectItemScene}=await import('/src/visual/items/inspection.ts');
   const scene=await inspectItemScene(mode,level,batch);document.body.replaceChildren(scene.canvas);window.itemScene=scene;return{mode,level,batch,calls:scene.calls,triangles:scene.triangles,equipped:scene.equipped};
  },{mode,level,batch}));
  await page.screenshot({path:join(output,`items-${mode}-lod${level}-${batch}.png`)});
  await page.evaluate(()=>{window.itemScene.dispose();delete window.itemScene;});
 }
 const manifestSha256=createHash('sha256').update(await readFile('public/assets/items/manifest.json')).digest('hex');
 const report={build:'Vite dev / isolated original art fixtures',manifestSha256,browser:await browser.version(),date:new Date().toISOString(),atlas,conditions,scenes,errors,limitations:'Desktop Chromium software/hardware renderer as available, DPR 1, no antialias. No physical phone or performance acceptance. Equipment scene uses valid six-slot public item fixtures with real ItemEquipment, not natural gameplay.'};
 await writeFile(join(output,'item-inspection.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(errors.length)throw Error('Browser errors; see report');
} finally { await browser.close(); }
