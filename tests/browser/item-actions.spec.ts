import {expect,test,type Page} from '@playwright/test';
import {GameSession} from '../../src/session/session';
import {itemActionCases,itemTargetCases} from '../m18-trace';
import {interactionCases,type InteractionCase} from '../m16-trace';
import {MOTION_PROFILE,type InteractionMotion} from '../../src/visual/motions/receipt';

declare global { interface Window { itemRAF:typeof requestAnimationFrame; itemFrozen:boolean; itemFinish:()=>void } }
const canvas=(page:Page)=>page.locator('canvas[data-ui=native]');
async function click(page:Page,id:string){
 for(let n=0;n<20;n++){
  const regions=JSON.parse((await canvas(page).getAttribute('data-regions'))!) as {id:string;x:number;y:number;width:number;height:number}[];
  const region=regions.find(r=>r.id===id)??(id.startsWith('near:')?regions.find(r=>r.id==='near:next'):undefined);
  expect(region,`hotzone ${id}`).toBeTruthy();await canvas(page).click({position:{x:region!.x+region!.width/2,y:region!.y+region!.height/2}});if(region!.id===id)return;
 }
 throw new Error(`No region ${id}`);
}
async function prepare(page:Page,c:InteractionCase){
 await page.getByTestId('import-file').setInputFiles({name:'natural.json',mimeType:'application/json',buffer:Buffer.from(c.before)});
 const view=GameSession.fromArchive(c.before).view();
 await expect(canvas(page)).toHaveAttribute('data-tick',String(view.tick));await expect(canvas(page)).toHaveAttribute('data-panel','world');
 if(c.command==='potion')return 'command:potion';
 if(!/^(wear:|unequip:|a2:use:)/.test(c.command))return `near:${c.command}`;
 const parts=c.command.split(':'),id=c.command.startsWith('wear:')?Number(parts[1]):c.command.startsWith('unequip:')?view.alpha2!.bag.find(i=>i.equipped===parts[1])!.id:Number(parts[2]);
 await click(page,'bag');await click(page,`item:${view.alpha2!.bag.findIndex(i=>i.id===id)}`);
 if(['equip','unequip'].includes(c.motion))return `action:${c.motion}`;
 await click(page,`action:${c.motion}`);
 const targets=view.alpha2!.targets.filter(t=>c.motion==='drink'||c.motion==='eat'?t.kind==='self':c.motion==='throw'?['enemy','facility'].includes(t.kind):c.motion==='read'?['self','item'].includes(t.kind):c.motion==='apply'?t.kind!=='enemy':t.kind!=='item');
 const target=targets.findIndex(t=>t.key===parts[4]);expect(target).toBeGreaterThanOrEqual(0);for(let n=0;n<target;n++)await click(page,'target');
 return 'execute';
}
for(const interrupt of ['pause','save-load','late-frame'] as const)test(`all natural interaction semantics settle through ${interrupt} without extra commands`,async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const items=itemActionCases(),cases=[...interactionCases(),...items,...itemTargetCases(items)];expect(cases).toHaveLength(16);
 await page.goto('/alpha2.html?ui=buttons');await expect(page.locator('[data-state=ready]')).toBeAttached();
 for(const c of cases){
  const id=await prepare(page,c),profile=MOTION_PROFILE[c.motion as InteractionMotion];
  await page.evaluate(contact=>{
   window.itemRAF=requestAnimationFrame;window.itemFrozen=false;
   window.requestAnimationFrame=callback=>window.itemRAF(time=>{
    const c=document.querySelector('canvas')!;
    if(c.dataset.busy==='true'&&Number(c.dataset.phase)>=contact){window.itemFrozen=true;window.itemFinish=()=>callback(time+10000);return;}
    callback(time);
   });
  },profile.contact);
  await click(page,id);await page.waitForFunction(()=>window.itemFrozen,undefined,{polling:20});
  await expect(canvas(page)).toHaveAttribute('data-motion',c.motion);
  if(items.some(item=>item.motion===c.motion))await expect(canvas(page)).not.toHaveAttribute('data-item-action-asset','pending');
  const expected=GameSession.fromArchive(c.after).view();
  await expect(canvas(page)).toHaveAttribute('data-tick',String(expected.tick));
  // Busy movement must not become a deferred command after recovery.
  await page.keyboard.press('d');await expect(canvas(page)).toHaveAttribute('data-revision',String(expected.revision));
  await page.evaluate(()=>{window.requestAnimationFrame=window.itemRAF;});
  if(interrupt==='pause')await click(page,'pause');
  else if(interrupt==='late-frame')await page.evaluate(()=>window.itemFinish());
  else await click(page,'save');
  await expect(canvas(page)).toHaveAttribute('data-busy','false');
  if(await canvas(page).getAttribute('data-panel')==='bag')await click(page,'close');
  await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(c.after);
  if(interrupt==='save-load'){await click(page,'load');await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(c.after);}
  await page.waitForTimeout(60);await expect(canvas(page)).toHaveAttribute('data-revision',String(expected.revision));
 }
 expect(errors).toEqual([]);
});
