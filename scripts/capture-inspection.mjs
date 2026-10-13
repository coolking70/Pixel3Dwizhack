import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
if(!process.argv[2])throw new Error('Pass an external output directory');
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1400,height:1050}}),errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/combat-lab.html');await page.locator('[data-state=ready]').waitFor();
 for(const enemy of ['guard','crawler'])for(const weapon of ['sword','mace']){
  await page.getByLabel('对手',{exact:true}).selectOption(enemy);await page.getByLabel('武器',{exact:true}).selectOption(weapon);await page.getByRole('button',{name:'定位命中'}).click();
  await page.screenshot({path:join(out,`${weapon}-${enemy}.png`),fullPage:true});samples.push(await page.locator('canvas').evaluate(c=>({...c.dataset})));
 }
 await page.getByLabel('面对方向').selectOption('-1');await page.getByLabel('检查动作').selectOption('incoming');await page.screenshot({path:join(out,'incoming-left.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'EN',exact:true}).click();await page.screenshot({path:join(out,'mobile.png'),fullPage:true});
 await writeFile(join(out,'inspection.json'),JSON.stringify({errors,samples,mobileFits:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)},null,2));
}finally{await browser.close();}
