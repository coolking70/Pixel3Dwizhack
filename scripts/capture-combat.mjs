// Freeze presentation callbacks at an observed contact, without editing rules.
// Usage: node scripts/capture-combat.mjs <external-output-directory>
import { chromium } from '@playwright/test';
import { build } from 'vite';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
if(!process.argv[2])throw new Error('Pass an external output directory');
const output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const built=await build({configFile:false,logLevel:'silent',build:{ssr:'tests/expedition-route.ts',write:false}});
const {runExpedition,GameSession}=await import(`data:text/javascript;base64,${Buffer.from(built.output.find(o=>o.type==='chunk').code).toString('base64')}`);
const route=runExpedition(42,true),browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1400,height:1100}});await page.goto('http://127.0.0.1:4173/adventure.html');await page.locator('[data-state=ready]').waitFor({state:'attached'});
  const records=[];
  for(const kind of ['player','guard','crawler']) {
    const index=route.commands.findIndex((c,i)=>['left','right','attack','wait','potion'].includes(c)&&route.states[i+1].beats.some(b=>b.kind==='attack'&&(kind==='player'?b.actor===0&&route.states[i].enemies.some(e=>e.id===b.target&&e.kind==='guard'):b.actor>0&&route.states[i].enemies.some(e=>e.id===b.actor&&e.kind===kind))));
    if(index<0)throw new Error(`No natural ${kind} contact`);
    const before=new GameSession(42,'expedition');route.commands.slice(0,index).forEach(c=>before.submit(c));
    await page.getByTestId('import-file').setInputFiles({name:'natural.json',mimeType:'application/json',buffer:Buffer.from(before.capture())});
    await page.waitForFunction(t=>document.querySelector('[data-testid=tick]').textContent===String(t),before.view().tick);
    await page.locator('dialog').waitFor({state:'hidden'});
    const beat=route.states[index+1].beats.find(b=>b.kind==='attack'&&(kind==='player'?b.actor===0:before.view().enemies.some(e=>e.id===b.actor&&e.kind===kind)));
    await page.evaluate(actor=>{
      window.realRAF=requestAnimationFrame;window.frozenContact=null;
      window.requestAnimationFrame=callback=>window.realRAF(time=>{
        const canvas=document.querySelector('canvas');
        if(canvas.dataset.impact==='true'&&Number(canvas.dataset.strikeActor)===actor){window.frozenContact={actor:canvas.dataset.strikeActor,target:canvas.dataset.strikeTarget,phase:canvas.dataset.phase};return;}
        callback(time);
      });
    },beat.actor);
    await page.locator('canvas').focus();await page.keyboard.press({left:'a',right:'d',attack:'Space',wait:'.',potion:'q'}[route.commands[index]]);
    await page.waitForFunction(()=>window.frozenContact!==null);
    const contact=await page.evaluate(()=>window.frozenContact);await page.locator('canvas').screenshot({path:join(output,`combat-${kind}.png`)});
    records.push({kind,commandIndex:index,command:route.commands[index],contact});
    await page.evaluate(()=>{window.requestAnimationFrame=window.realRAF;});await page.getByRole('button',{name:'保存',exact:true}).click();
  }
  await writeFile(join(output,'combat-frames.json'),JSON.stringify({method:'Natural seed42 checkpoints; observed impact then frozen requestAnimationFrame callback; rules and committed outcomes unchanged.',records},null,2));console.log(JSON.stringify(records));
} finally {await browser.close();}
