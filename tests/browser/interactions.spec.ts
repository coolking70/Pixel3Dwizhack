import { expect, test, type Page } from '@playwright/test';
import { interactionCases } from '../m16-trace';
import { MOTION_PROFILE, type InteractionMotion } from '../../src/visual/motions/receipt';
declare global { interface Window { interactionRAF: typeof requestAnimationFrame; interactionFrozen: {error:number;phase:number;motion:string}|null; restoreInteractionContext:()=>void } }
async function click(page:Page,id:string){
  const canvas=page.locator('canvas[data-ui=native]');
  for(let n=0;n<20;n++){
    const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as {id:string;x:number;y:number;width:number;height:number}[];
    const r=regions.find(r=>r.id===id)??regions.find(r=>r.id==='near:next');expect(r,`region ${id}`).toBeTruthy();
    await canvas.click({position:{x:r!.x+r!.width/2,y:r!.y+r!.height/2}});if(r!.id===id)return;
  }
  throw new Error(`Unreachable region ${id}`);
}
test('natural pickup, gate, latch and chest contact then blur/save settle exactly once',async({page})=>{
  test.setTimeout(120000);
  const cases=interactionCases(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  expect(cases.map(c=>c.name)).toEqual(expect.arrayContaining(['pickupLow','leverPull','doorClose','chestOpen','doorPush']));
  await page.goto('/alpha2.html?ui=buttons');await expect(page.locator('[data-state=ready]')).toBeAttached();
  for(const c of cases){
    await page.getByTestId('import-file').setInputFiles({name:'natural.json',mimeType:'application/json',buffer:Buffer.from(c.before)});
    await expect(page.locator('dialog')).not.toBeVisible();
    await page.waitForTimeout(150);
    const contact=MOTION_PROFILE[c.motion as InteractionMotion].contact;
    await page.evaluate(contact=>{
      window.interactionRAF=requestAnimationFrame;window.interactionFrozen=null;
      window.requestAnimationFrame=callback=>window.interactionRAF(time=>{
        const c=document.querySelector('canvas')!;
        if(c.dataset.interactionStage==='contact'||c.dataset.busy==='true'&&Number(c.dataset.phase)>=contact){window.interactionFrozen={error:Number(c.dataset.contactError),phase:Number(c.dataset.phase),motion:c.dataset.motion!};return;}
        callback(time);
      });
    },contact);
    await click(page,`near:${c.command}`);
    await page.waitForFunction(()=>window.interactionFrozen!==null,undefined,{polling:25});
    const frame=await page.evaluate(()=>window.interactionFrozen!);
    expect(frame.motion).toBe(c.motion);expect(frame.error,`${c.name} actual palm contact`).toBeLessThan(.08);
    await page.evaluate(()=>{window.requestAnimationFrame=window.interactionRAF;window.dispatchEvent(new Event('blur'));});
    await expect(page.locator('canvas')).toHaveAttribute('data-busy','false');
    await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(c.after);
    await page.waitForTimeout(150);expect(await page.locator('canvas').getAttribute('data-tick')).toBe(String(JSON.parse(c.after).world.tick));
  }
  expect(errors).toEqual([]);
});
test('WebGL context loss and restoration cancel held input without submitting a completion action',async({page})=>{
  await page.goto('/alpha2.html?ui=buttons');await expect(page.locator('[data-state=ready]')).toBeAttached();await click(page,'start');
  const canvas=page.locator('canvas[data-ui=native]');
  const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as {id:string;x:number;y:number;width:number;height:number}[];
  const r=regions.find(r=>r.id==='command:right')!,bounds=(await canvas.boundingBox())!;
  await page.mouse.move(bounds.x+r.x+r.width/2,bounds.y+r.y+r.height/2);await page.mouse.down();
  const tick=await canvas.evaluate(c=>{const before=c.dataset.tick!,gl=(c as HTMLCanvasElement).getContext('webgl2')!,ext=gl.getExtension('WEBGL_lose_context')!;window.restoreInteractionContext=()=>ext.restoreContext();ext.loseContext();return before;});
  await expect(page.locator('[data-state=error]')).toBeVisible();await page.mouse.up();await page.waitForTimeout(500);
  await expect(canvas).toHaveAttribute('data-tick',tick);await expect(canvas).toHaveAttribute('data-busy','false');
  await page.evaluate(()=>window.restoreInteractionContext());await expect(page.locator('[data-state=ready]')).toBeAttached();
  await page.waitForTimeout(500);await expect(canvas).toHaveAttribute('data-tick',tick);await expect(canvas).toHaveAttribute('data-busy','false');
  await click(page,'command:wait');await expect.poll(async()=>Number(await canvas.getAttribute('data-tick'))).toBeGreaterThan(Number(tick));
});
test('a queued completion frame observes lost WebGL before the DOM loss event',async({page})=>{
  await page.goto('/alpha2.html?ui=buttons');await expect(page.locator('[data-state=ready]')).toBeAttached();await click(page,'start');
  const canvas=page.locator('canvas[data-ui=native]');
  await page.evaluate(()=>{
    const raf=window.requestAnimationFrame;
    window.requestAnimationFrame=callback=>raf(time=>{
      window.requestAnimationFrame=raf;
      const canvas=document.querySelector('canvas')!;
      canvas.dataset.tickAtLoss=canvas.dataset.tick;
      canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
      // Force the queued presentation callback past completion before the loss
      // DOM event can run. No world or command timestamps are changed.
      callback(time+10000);
    });
  });
  const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as {id:string;x:number;y:number;width:number;height:number}[];
  const r=regions.find(r=>r.id==='command:right')!,bounds=(await canvas.boundingBox())!;
  await page.mouse.move(bounds.x+r.x+r.width/2,bounds.y+r.y+r.height/2);await page.mouse.down();
  await expect(page.locator('[data-state=error]')).toBeVisible();await page.mouse.up();
  const tick=await canvas.getAttribute('data-tick-at-loss');expect(Number(tick)).toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-tick',tick!);await expect(canvas).toHaveAttribute('data-busy','false');
});
