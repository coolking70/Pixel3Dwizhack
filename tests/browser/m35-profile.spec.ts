import {expect,test} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {GameSession} from '../../src/session/session';
import {cases6} from '../m35-trace';
import {canvas,click,start,world,saved,load,item} from './m35-helpers';
test('localized warmed silver censer profile in normal and low quality preserves exact archives',async({page},info)=>{
 test.setTimeout(180000);const x=cases6().cases.find(x=>x.name==='tool-silverCenser')!,s=GameSession.fromArchive(x.before),targets=s.queryTargets(x.sourceId!,'zap').filter(t=>t.status!=='disabled'),at=targets.findIndex(t=>t.command===x.command);await start(page);const c=canvas(page),runs:unknown[]=[];
 for(const low of [false,true]){
 if(low){await world(page);await click(page,'aux');await click(page,'open:settings');await click(page,'open:settings');await click(page,'setting:low');await world(page);}
 for(let n=0;n<4;n++){await load(page,x.before);await item(page,s,x.sourceId!);await click(page,'offer:zap');for(let k=0;k<=at;k++)await page.keyboard.press('ArrowRight');await page.evaluate(()=>{const c=document.querySelector('canvas[data-ui=native]') as HTMLCanvasElement;(window as any).samples=[];(window as any).obs=new MutationObserver(()=>{if(c.dataset.busy==='true')(window as any).samples.push({time:performance.now(),cpu:Number(c.dataset.renderMs),stage:c.dataset.interactionStage,tick:c.dataset.tick,revision:c.dataset.revision,draw:Number(c.dataset.drawCalls)});});(window as any).obs.observe(c,{attributes:true,attributeFilter:['data-render-ms']});});await click(page,'interaction:confirm');await expect(c).toHaveAttribute('data-busy','false');const samples=await page.evaluate(()=>{(window as any).obs.disconnect();return(window as any).samples as {tick:string;revision:string}[];});expect(new Set(samples.map(s=>s.tick)).size).toBe(1);expect(new Set(samples.map(s=>s.revision)).size).toBe(1);expect(await saved(page)).toBe(x.after);runs.push({low,warmup:n===0,samples});}
 }
 await writeFile(info.outputPath('warmed-profile.json'),JSON.stringify({runs,viewport:[1280,720],scope:'One natural censer checkpoint; each quality one warmup and three samples; SwiftShader desktop only, no screenshot inside measured action'},null,2));
});
