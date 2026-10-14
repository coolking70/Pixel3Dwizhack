import {expect,type Page} from '@playwright/test';
import * as T from 'three';
import {GameSession} from '../../src/session/session';
import {SceneHitTest} from '../../src/room/scene-hit-test';
import {floorY} from '../../src/room/presentation';
import type {PublicView} from '../../src/core/types';
export const canvas=(p:Page)=>p.locator('canvas[data-ui=native]');
export async function regions(p:Page){return JSON.parse(await canvas(p).getAttribute('data-regions')??'[]') as {id:string;x:number;y:number;width:number;height:number;label:string}[];}
export async function click(p:Page,id:string){const r=(await regions(p)).find(r=>r.id===id);expect(r,id).toBeTruthy();await canvas(p).click({position:{x:r!.x+r!.width/2,y:r!.y+r!.height/2}});}
export async function start(p:Page){await p.goto('alpha6.html');await expect(p.locator('[data-state=ready]')).toBeAttached();await click(p,'start');await expect(canvas(p)).toHaveAttribute('data-panel','world');const s=new GameSession(24681,'alpha6');expect(s.submit('choose:vanguard').accepted).toBe(true);return s;}
export async function world(p:Page){for(let n=0;n<8&&await canvas(p).getAttribute('data-panel')!=='world';n++)await p.keyboard.press('Escape');await expect(canvas(p)).toHaveAttribute('data-panel','world');}
export async function saved(p:Page){await world(p);await click(p,'aux');await click(p,'open:game');await click(p,'open:storage');await click(p,'save');return p.evaluate(()=>localStorage.getItem('dungeon-descent.m35'));}
export async function load(p:Page,raw:string){await p.getByTestId('import-file').setInputFiles({name:'natural-alpha6.json',mimeType:'application/json',buffer:Buffer.from(raw)});await expect(canvas(p)).toHaveAttribute('data-revision',String(JSON.parse(raw).world.revision));await expect(canvas(p)).toHaveAttribute('data-panel','world');await expect(canvas(p)).toHaveAttribute('data-busy','false');}
export async function projection(p:Page,v:PublicView){const r=(await canvas(p).boundingBox())!,aspect=r.width/r.height,span=aspect>1.35?9.8:6.8,cx=T.MathUtils.clamp(v.player.x+v.player.face*.8,span/2-.5,v.map.width-span/2-.5),cy=floorY(v.player.floor)+1.15,c=new T.OrthographicCamera(-span/2,span/2,span/aspect/2,-span/aspect/2,.1,70);c.position.set(cx+.65,cy+1.05,15);c.lookAt(cx,cy,0);c.updateProjectionMatrix();c.updateMatrixWorld(true);const hit=new SceneHitTest(c,()=>({left:r.x,top:r.y,width:r.width,height:r.height}),()=>v);return{hit,point:(x:number,height:number)=>{const q=new T.Vector3(x,floorY(v.player.floor)+height,.2).project(c);return{x:r.x+(q.x+1)*r.width/2,y:r.y+(1-q.y)*r.height/2};}};}
export async function item(p:Page,s:GameSession,id:number){await click(p,'bag');await click(p,'inventory:bag');const i=s.view().alpha2!.bag.filter(i=>!i.equipped).findIndex(i=>i.id===id);expect(i).toBeGreaterThanOrEqual(0);await click(p,'item:'+i);await expect(canvas(p)).toHaveAttribute('data-ui-assets-pending','0');}
