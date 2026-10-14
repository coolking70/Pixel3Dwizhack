import { writeFile } from 'node:fs/promises';
import { expect,test,type Page } from '@playwright/test';
import * as T from 'three';
import { GameSession } from '../../src/session/session';
import { floorY } from '../../src/room/presentation';
import { SceneHitTest } from '../../src/room/scene-hit-test';
import type { PublicView } from '../../src/core/types';
const canvas=(p:Page)=>p.locator('canvas[data-ui=native]');
async function click(p:Page,id:string){const rs=JSON.parse(await canvas(p).getAttribute('data-regions')??'[]'),r=rs.find((r:{id:string})=>r.id===id);expect(r,id).toBeTruthy();await canvas(p).click({position:{x:r.x+r.width/2,y:r.y+r.height/2}});}
async function start(p:Page){await p.goto('/alpha5.html');await expect(p.locator('[data-state=ready]')).toBeAttached();await click(p,'start');await expect(canvas(p)).toHaveAttribute('data-panel','world');const s=new GameSession(24681,'alpha5');expect(s.submit('choose:vanguard').accepted).toBe(true);return s;}
async function world(p:Page){for(let n=0;n<4&&await canvas(p).getAttribute('data-panel')!=='world';n++)await p.keyboard.press('Escape');await expect(canvas(p)).toHaveAttribute('data-panel','world');}
async function saved(p:Page){await click(p,'aux');await click(p,'open:game');await click(p,'open:storage');await click(p,'save');return p.evaluate(()=>localStorage.getItem('dungeon-descent.m31'));}
async function air(p:Page,v:PublicView,x:number){
 const rect=(await canvas(p).boundingBox())!,aspect=rect.width/rect.height,span=aspect>1.35?9.8:6.8;
 const cx=T.MathUtils.clamp(v.player.x+v.player.face*.8,span/2-.5,v.map.width-span/2-.5),cy=floorY(v.player.floor)+1.15,c=new T.OrthographicCamera(-span/2,span/2,span/aspect/2,-span/aspect/2,.1,70);
 c.position.set(cx+.65,cy+1.05,15);c.lookAt(cx,cy,0);c.updateProjectionMatrix();c.updateMatrixWorld(true);
 const hit=new SceneHitTest(c,()=>({left:rect.x,top:rect.y,width:rect.width,height:rect.height}),()=>v);
 for(const y of [1.65,1.4,1.9]){const n=new T.Vector3(x,floorY(v.player.floor)+y,.2).project(c),point={x:Math.round(rect.x+(n.x+1)*rect.width/2),y:Math.round(rect.y+(1-n.y)*rect.height/2)};if(hit.hitCandidates(point.x,point.y).jump?.x===x)return point;}
 throw Error('No exposed air target');
}
test('natural new run jumps over the visible trap, lands, collects and continues with exact archive and three poses',async({page},info)=>{
 const s=await start(page),c=canvas(page);for(let i=0;i<4;i++){await page.keyboard.press('d');expect(s.submit('right').accepted).toBe(true);await expect(c).toHaveAttribute('data-busy','false');}
 expect(s.view().player.x).toBe(6);expect(s.view().alpha2!.facilities.find(f=>f.kind==='trap'&&f.x===7)?.used).toBe(false);
 const point=await air(page,s.view(),8);await page.mouse.move(point.x,point.y);await expect(c).toHaveAttribute('data-jump-target',/a5:jump:8/);
 await page.evaluate(()=>{const c=document.querySelector('canvas[data-ui=native]') as HTMLCanvasElement;(window as any).jumpSamples=[];(window as any).jumpFrames={};(window as any).jumpCaptures=[];new MutationObserver(()=>{if(c.dataset.motion==='jump'){const phase=Number(c.dataset.phase),height=Number(c.dataset.jumpHeight);(window as any).jumpSamples.push({phase,height,tick:c.dataset.tick,revision:c.dataset.revision});const name=phase<.18?'prepare':height>.8?'air':phase>.85?'land':null;if(name&&!(window as any).jumpFrames[name]){(window as any).jumpFrames[name]='pending';(window as any).jumpCaptures.push(new Promise<void>(resolve=>c.toBlob(blob=>{const reader=new FileReader();reader.onload=()=>{(window as any).jumpFrames[name]=reader.result;resolve();};reader.readAsDataURL(blob!);},'image/png')));}}}).observe(c,{attributes:true,attributeFilter:['data-phase']});});
 await page.mouse.click(point.x,point.y);expect(s.submit('a5:jump:8').accepted).toBe(true);
 await expect(c).toHaveAttribute('data-busy','false');
 const frames=await page.evaluate(async()=>{await Promise.all((window as any).jumpCaptures);return (window as any).jumpFrames as Record<string,string>;});for(const name of ['prepare','air','land']){expect(frames[name],name).toBeTruthy();await writeFile(info.outputPath(`jump-${name}.png`),Buffer.from(frames[name]!.split(',')[1]!, 'base64'));}
 const samples=await page.evaluate(()=>(window as any).jumpSamples as {phase:number;height:number;tick:string;revision:string}[]);
 expect(samples.some(p=>p.phase<.18&&p.height<.1)).toBe(true);expect(Math.max(...samples.map(p=>p.height))).toBeGreaterThan(1);expect(samples.some(p=>p.phase>.85&&p.height<.1)).toBe(true);
 expect(new Set(samples.map(p=>p.tick)).size).toBe(1);expect(new Set(samples.map(p=>p.revision)).size).toBe(1);
 const item=s.view().alpha2!.ground.find(i=>i.x===8)!;expect(item).toBeTruthy();expect(s.view().alpha2!.facilities.find(f=>f.kind==='trap'&&f.x===7)?.used).toBe(false);
 await page.keyboard.press('f');expect(s.submit('interact').accepted).toBe(true);await expect(c).toHaveAttribute('data-busy','false');expect(s.view().alpha2!.bag.some(i=>i.id===item.id)).toBe(true);
 await page.keyboard.press('d');expect(s.submit('right').accepted).toBe(true);await expect(c).toHaveAttribute('data-busy','false');expect(await saved(page)).toBe(s.capture());
});
test('jump aim cancels on blur, fresh keyboard and gamepad A respect world/menu context',async({page})=>{
 const s=await start(page),c=canvas(page);await page.keyboard.press('j');await expect(c).toHaveAttribute('data-jump-target',/a5:jump/);
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});await expect(c).toHaveAttribute('data-jump-target','');
 await click(page,'aux');await expect(c).toHaveAttribute('data-panel','world');expect(await saved(page)).toBe(s.capture());await world(page);
 await page.keyboard.press('j');const target=JSON.parse(await c.getAttribute('data-jump-target')??'null');await page.keyboard.press('Enter');expect(s.submit(target.command).accepted).toBe(true);await expect(c).toHaveAttribute('data-busy','false');expect(await saved(page)).toBe(s.capture());
 await world(page);
 await page.evaluate(()=>{(window as any).pad={connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[(window as any).pad]});});
 await page.waitForTimeout(60);await page.evaluate(()=>(window as any).pad.buttons[0].pressed=true);await expect(c).toHaveAttribute('data-jump-target',/a5:jump/);
 await page.evaluate(()=>(window as any).pad.buttons[0].pressed=false);await page.waitForTimeout(60);await page.keyboard.press('Escape');expect(await saved(page)).toBe(s.capture());
});
