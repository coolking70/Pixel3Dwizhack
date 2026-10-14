import { expect, test, type Page } from '@playwright/test';
import * as T from 'three';
import { GameSession } from '../../src/session/session';
import type { TargetRef } from '../../src/core/action-types';
import { SceneHitTest } from '../../src/room/scene-hit-test';
import { floorY } from '../../src/room/presentation';
import { publicLadderEdges } from '../../src/interaction/intent';
import { directItemCases, directWorldCases } from '../m25-trace';

const canvas=(p:Page)=>p.locator('canvas[data-ui=native]');
async function regions(p:Page){return JSON.parse((await canvas(p).getAttribute('data-regions'))??'[]') as {id:string;x:number;y:number;width:number;height:number}[];}
async function pointerClick(p:Page,x:number,y:number){if(await p.evaluate(()=>navigator.maxTouchPoints>0))await p.touchscreen.tap(x,y);else await p.mouse.click(x,y);}
async function click(p:Page,id:string,pager?:string){
 for(let n=0;n<16;n++){
  const list=await regions(p),r=list.find(r=>r.id===id)??(pager?list.find(r=>r.id===pager):undefined);
  expect(r,`region ${id}`).toBeTruthy();const bounds=(await canvas(p).boundingBox())!;await pointerClick(p,bounds.x+r!.x+r!.width/2,bounds.y+r!.y+r!.height/2);
  if(r!.id===id)return;
 }
 throw new Error(`Unreachable ${id}`);
}
async function load(p:Page,raw:string){await p.getByTestId('import-file').setInputFiles({name:'natural-alpha3.json',mimeType:'application/json',buffer:Buffer.from(raw)});await expect(canvas(p)).toHaveAttribute('data-revision',String(JSON.parse(raw).world.revision));await expect(canvas(p)).toHaveAttribute('data-busy','false');}
async function worldPoint(p:Page,raw:string,target:TargetRef,required=true){
 const v=GameSession.fromArchive(raw).view(),r=(await canvas(p).boundingBox())!,camera=new T.OrthographicCamera(),aspect=r.width/r.height,span=aspect>1.35?9.8:6.8,vertical=span/aspect;
 const x=T.MathUtils.clamp(v.player.x+v.player.face*.8,span/2-.5,v.map.width-span/2-.5),y=floorY(v.player.floor)+1.15;
 camera.near=.1;camera.far=70;camera.position.set(x+.65,y+1.05,15);camera.lookAt(x,y,0);camera.left=-span/2;camera.right=span/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.updateProjectionMatrix();
 const hit=new SceneHitTest(camera,()=>({left:r.x,top:r.y,width:r.width,height:r.height}),()=>v),point=target.type==='world-entity'&&target.kind==='ladder'?hit.ladderScreenPoint(publicLadderEdges(v).find(e=>e.linkId===target.id)!):hit.worldScreenPoint(target);
 if(!point&&!required)return null;
 expect(point,JSON.stringify(target)).toBeTruthy();
 if(target.type==='world-entity'&&target.kind==='ladder')return point;
 // A chest can share its floor cell with loot. Click its exposed upper half,
 // checking the same public geometry a player sees, rather than assuming its centre wins.
 const exposed=[0,-.2,-.35,-.45].map(d=>({x:point!.x,y:point!.y+d*r.height/vertical})).find(p=>JSON.stringify(hit.hitTest(p.x,p.y)?.ref)===JSON.stringify(target));
 expect(exposed,`visible hit area ${JSON.stringify(target)}`).toBeTruthy();return exposed!;
}
async function clickWorld(p:Page,raw:string,target:TargetRef){const point=(await worldPoint(p,raw,target))!;await pointerClick(p,point.x,point.y);}
async function saved(p:Page){
 // Lifecycle focus restoration is free; close every navigation level before saving.
 await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.keyboard.press('Shift');
 for(let n=0;n<5&&(await canvas(p).getAttribute('data-panel'))!=='world';n++)await p.keyboard.press('Escape');
 await click(p,'aux');await click(p,'open:storage');await click(p,'save');return p.evaluate(()=>localStorage.getItem('dungeon-descent.m25'));
}
test('M25 natural world click tasks match formal command archives without the old action bar',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();
 const cases=directWorldCases();expect(cases.length).toBeGreaterThanOrEqual(10);
 for(const c of cases){
  await load(page,c.before);expect((await regions(page)).some(r=>r.id.startsWith('command:'))).toBe(false);
  await clickWorld(page,c.before,c.target);
  if(c.context&&(await canvas(page).getAttribute('data-revision'))===String(JSON.parse(c.before).world.revision)){
   await click(page,`context:${c.context}`,'context:next');
   if((await regions(page)).some(r=>r.id==='interaction:confirm'))await click(page,'interaction:confirm');
  }
  await expect(canvas(page),c.name).toHaveAttribute('data-revision',String(JSON.parse(c.after).world.revision));await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
  expect(await saved(page),c.name).toBe(c.after);
 }
 expect(errors).toEqual([]);
});
test('M25 separate item detail and target confirmations execute eight natural item actions',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();
 const cases=directItemCases();expect(new Set(cases.map(c=>c.motion)).size).toBe(8);
 for(const c of cases){
  await load(page,c.before);const v=GameSession.fromArchive(c.before).view(),source=v.alpha2!.bag.find(i=>i.id===c.sourceId)!,index=v.alpha2!.bag.filter(i=>!i.equipped).findIndex(i=>i.id===c.sourceId);
  await click(page,'bag');expect((await regions(page)).some(r=>r.id.startsWith('offer:'))).toBe(false);
  await click(page,source.equipped?'inventory:character':'inventory:bag');await click(page,source.equipped?`slot:${source.equipped}`:`item:${index}`);await expect(canvas(page)).toHaveAttribute('data-panel','itemDetail');
  await click(page,`offer:${c.motion}`,'interaction:next');
  if(!['equip','unequip'].includes(c.motion)){
   const s=GameSession.fromArchive(c.before),target=s.queryTargets(c.sourceId,c.motion).find(t=>t.command===c.command||c.command==='potion'&&t.ref.type==='self');expect(target,c.name).toBeTruthy();
   if(target!.ref.type==='self')await click(page,'target:self');
   else if(target!.ref.type==='inventory-item'){const id=target!.ref.itemId,it=v.alpha2!.bag.find(i=>i.id===id)!;await click(page,it.equipped?`slot:${it.equipped}`:`item:${v.alpha2!.bag.filter(i=>!i.equipped).findIndex(i=>i.id===id)}`);}
   else {
    if((await regions(page)).some(r=>r.id==='target:world'))await click(page,'target:world');
    const point=await worldPoint(page,c.before,target!.ref,false);
    if(point)await pointerClick(page,point.x,point.y);
    else {
     const targets=s.queryTargets(c.sourceId,c.motion).filter(t=>t.status!=='disabled'),at=targets.findIndex(t=>JSON.stringify(t.ref)===JSON.stringify(target!.ref));
     expect(at,c.name).toBeGreaterThanOrEqual(0);
     for(let n=0;n<=at;n++)await click(page,'target:next');
     expect(await canvas(page).getAttribute('data-revision'),'touch target selection is free').toBe(String(v.revision));
    }
   }
   await click(page,'interaction:confirm');
  }
  await expect(canvas(page),c.name).toHaveAttribute('data-revision',String(JSON.parse(c.after).world.revision));await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
  expect(await saved(page),c.name).toBe(c.after);
 }
 expect(errors).toEqual([]);
});

async function keyboardActivate(p:Page,id:string,from=''){
 const list=await regions(p),at=list.findIndex(r=>r.id===from),to=list.findIndex(r=>r.id===id);expect(to,id).toBeGreaterThanOrEqual(0);
 const steps=at<0?to+1:(to-at+list.length)%list.length;
 for(let n=0;n<steps;n++)await p.keyboard.press('Tab');
 await p.keyboard.press('Enter');
}
test('M25 all eight item actions and offscreen ground targeting work with keyboard only',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const c of directItemCases()){
  await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();await load(page,c.before);await canvas(page).focus();
  const s=GameSession.fromArchive(c.before),source=s.view().alpha2!.bag.find(i=>i.id===c.sourceId)!,index=s.view().alpha2!.bag.filter(i=>!i.equipped).findIndex(i=>i.id===c.sourceId);
  await page.keyboard.press('b');const tab=source.equipped?'inventory:character':'inventory:bag';await keyboardActivate(page,tab);const itemId=source.equipped?`slot:${source.equipped}`:`item:${index}`;await keyboardActivate(page,itemId,tab);
  await expect(canvas(page)).toHaveAttribute('data-panel','itemDetail');let focus=itemId;
  for(let n=0;!(await regions(page)).some(r=>r.id===`offer:${c.motion}`)&&n<12;n++){await keyboardActivate(page,'interaction:next',focus);focus='interaction:next';}
  await keyboardActivate(page,`offer:${c.motion}`,focus);
  let expected=c.after;
  if(!['equip','unequip'].includes(c.motion)){
   const targets=s.queryTargets(c.sourceId,c.motion).filter(t=>t.status!=='disabled');
   // Deliberately select the furthest ground cell, including cells outside the camera.
   const target=c.motion==='throw'?targets.filter(t=>t.ref.type==='world-cell').sort((a,b)=>Math.abs(b.position!.x-s.view().player.x)-Math.abs(a.position!.x-s.view().player.x))[0]:targets.find(t=>t.command===c.command);
   expect(target,c.name).toBeTruthy();const at=targets.indexOf(target!);for(let n=0;n<=at;n++)await page.keyboard.press('ArrowRight');
   expect(await canvas(page).getAttribute('data-revision')).toBe(String(s.view().revision));
   await page.keyboard.press('Enter');if(c.motion==='throw'){expect(s.submit(target!.command!).accepted).toBe(true);expected=s.capture();}
  }
  await expect(canvas(page),c.name).toHaveAttribute('data-revision',String(JSON.parse(expected).world.revision));await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
  expect(await saved(page),c.name).toBe(expected);
 }
 expect(errors).toEqual([]);
});

test('M25 pending target cancellation invalidates delayed pointer release without time or RNG cost',async({page})=>{
 test.setTimeout(120000);await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();
 const c=directItemCases().find(c=>c.motion==='throw')!,v=GameSession.fromArchive(c.before).view(),index=v.alpha2!.bag.filter(i=>!i.equipped).findIndex(i=>i.id===c.sourceId);
 for(const reason of ['escape','blur','resize','pointercancel','restore']){
  await load(page,c.before);await click(page,'bag');await click(page,'inventory:bag');await click(page,`item:${index}`);await click(page,'offer:throw','interaction:next');await page.keyboard.press('ArrowRight');
  const r=(await regions(page)).find(r=>r.id==='interaction:confirm')!,box=(await canvas(page).boundingBox())!;
  await page.mouse.move(box.x+r.x+r.width/2,box.y+r.y+r.height/2);await page.mouse.down();
  if(reason==='escape')await page.keyboard.press('Escape');
  if(reason==='blur')await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
  if(reason==='resize'){
   const size=page.viewportSize()!;
   // A rapid shrink/restore can be coalesced without any browser resize event.
   // Observe each real event before proceeding to the delayed pointer release.
   for(const viewport of [{width:size.width-1,height:size.height},size]){
    await page.evaluate(()=>{delete document.documentElement.dataset.testResized;window.addEventListener('resize',()=>{document.documentElement.dataset.testResized='true';},{once:true});});
    await page.setViewportSize(viewport);await expect(page.locator('html')).toHaveAttribute('data-test-resized','true');
   }
  }
  if(reason==='pointercancel')await canvas(page).dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});
  if(reason==='restore')await load(page,c.before);
  await page.mouse.up();await expect(canvas(page),reason).toHaveAttribute('data-revision',String(v.revision));
  // Close every pure presentation level before saving; no command is submitted.
  for(let n=0;n<3&&(await canvas(page).getAttribute('data-panel'))!=='world';n++)await page.keyboard.press('Escape');
  expect(await saved(page),reason).toBe(c.before);
 }
});

test('M25 one ground click opens an ordinary door then walks, while release and blur stop at the door',async({page})=>{
 test.setTimeout(120000);await page.clock.install();await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();
 const c=directWorldCases().find(c=>c.name==='paidChest')!,s=GameSession.fromArchive(c.before);
 // Revisit an explored door after this floor's enemies were defeated naturally.
 while(s.view().player.x>10)expect(s.submit('left').accepted).toBe(true);
 expect(s.submit('door:1').accepted).toBe(true);
 const before=s.capture(),v=s.view(),opened=GameSession.fromArchive(before);expect(opened.submit('door:1').accepted).toBe(true);
 for(const reason of ['release','blur']){
  await load(page,before);await canvas(page).focus();
  // Keep real keyboard events on either side of the first command, before its
  // animation completes. Slow CI protocol round trips must not become a hold.
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));await page.keyboard.down('ArrowRight');
  await expect(canvas(page)).toHaveAttribute('data-revision',String(v.revision+1));
  await expect(canvas(page)).toHaveAttribute('data-busy','true');
  if(reason==='blur')await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
  await page.keyboard.up('ArrowRight');await page.clock.resume();await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
  expect(await saved(page),reason).toBe(opened.capture());
 }
 await load(page,before);const expected=GameSession.fromArchive(opened.capture());expect(expected.submit('right').accepted).toBe(true);expect(expected.submit('right').accepted).toBe(true);
 await clickWorld(page,before,{type:'world-cell',floor:v.player.floor,x:v.player.x+2});
 await expect(canvas(page)).toHaveAttribute('data-revision',String(expected.view().revision),{timeout:15000});await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
 expect(await saved(page)).toBe(expected.capture());
 // On another natural floor a newly revealed enemy must interrupt the route.
 const danger=directWorldCases().find(c=>c.name==='openDoor')!,d=GameSession.fromArchive(danger.after);
 for(const command of ['right','right','left','left',danger.command] as const)expect(d.submit(command).accepted).toBe(true);
 const dangerousBefore=d.capture(),dp=d.view().player;expect(d.submit(danger.command).accepted).toBe(true);expect(d.submit('right').accepted).toBe(true);
 await load(page,dangerousBefore);await clickWorld(page,dangerousBefore,{type:'world-cell',floor:dp.floor,x:dp.x+2});
 await expect(canvas(page)).toHaveAttribute('data-revision',String(d.view().revision),{timeout:15000});await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
 expect(await saved(page),'new enemy interrupts before the destination').toBe(d.capture());
});

test('M25 gamepad world aim selects a target and held confirm submits once',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{const state={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.assign(window,{testPad:state});Object.defineProperty(navigator,'getGamepads',{value:()=>[state]});});
 const s=new GameSession(1,'alpha3');expect(s.submit('choose:vanguard').accepted).toBe(true);const before=s.capture(),v=s.view(),source=v.alpha2!.bag.find(i=>i.definition==='ration')!,target=s.queryTargets(source.id,'throw').find(t=>t.status!=='disabled')!;
 await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();await load(page,before);await click(page,'bag');await click(page,'inventory:bag');await click(page,`item:${v.alpha2!.bag.filter(i=>!i.equipped).indexOf(source)}`);await click(page,'offer:throw','interaction:next');
 const pad=async(axes:number[],pressed:number[])=>page.evaluate(async({axes,pressed})=>{const state=(window as unknown as {testPad:{axes:number[];buttons:{pressed:boolean}[]}}).testPad;state.axes=axes;state.buttons.forEach((b,i)=>b.pressed=pressed.includes(i));await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));},{axes,pressed});
 await pad([0,0],[]);await pad([1,0],[]);await pad([0,0],[]);await expect(canvas(page)).toHaveAttribute('data-revision',String(v.revision));
 expect(s.submit(target.command!).accepted).toBe(true);await pad([0,0],[0]);await expect(canvas(page)).toHaveAttribute('data-revision',String(s.view().revision));await expect(canvas(page)).toHaveAttribute('data-busy','false',{timeout:15000});
 await pad([0,0],[0]);await pad([0,0],[]);expect(await saved(page)).toBe(s.capture());
});

test('M25 menu language changes and read-only replay discard pending item targets',async({page})=>{
 test.setTimeout(90000);const s=new GameSession(1,'alpha3');expect(s.submit('choose:vanguard').accepted).toBe(true);const raw=s.capture(),v=s.view(),index=v.alpha2!.bag.filter(i=>!i.equipped).findIndex(i=>i.definition==='ration');
 await page.goto('/alpha3.html');await expect(page.locator('[data-state=ready]')).toBeAttached();
 const pending=async()=>{await load(page,raw);await click(page,'bag');await click(page,'inventory:bag');await click(page,`item:${index}`);await click(page,'offer:throw','interaction:next');await page.keyboard.press('ArrowRight');};
 await pending();await click(page,'aux');await click(page,'open:settings');await click(page,'setting:locale');await click(page,'setting:locale');await click(page,'close');
 expect(await saved(page),'language changes discard pending targets').toBe(raw);
 await pending();await click(page,'aux');await click(page,'open:storage');await click(page,'replay');await click(page,'close');
 await click(page,'bag');await click(page,'inventory:bag');await click(page,`item:${index}`);expect((await regions(page)).some(r=>r.id.startsWith('offer:'))).toBe(false);
 for(let n=0;n<3&&(await canvas(page).getAttribute('data-panel'))!=='world';n++)await page.keyboard.press('Escape');
 await expect(canvas(page)).toHaveAttribute('data-panel','world');await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
 await expect(canvas(page)).toHaveAttribute('data-revision',String(v.revision));
 await click(page,'aux');await click(page,'open:storage');await click(page,'replay');await click(page,'live');
 expect(await saved(page),'live archive survives replay and has no delayed target').toBe(raw);
});
