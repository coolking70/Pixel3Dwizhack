import {expect,test,type Page} from '@playwright/test';
import {runAlpha,GameSession} from '../alpha-route';
import type {Command} from '../../src/core/types';
import type {Loadout} from '../../src/core/alpha-types';
const ready=async(page:Page)=>{await expect(page.locator('canvas')).toHaveAttribute('data-busy','false');};
const start=async(page:Page,loadout:Loadout='channeler')=>{await page.goto('/alpha.html');await expect(page.locator('[data-state=ready]')).toBeAttached();await page.getByTestId('seed').fill('42');await page.getByLabel('起始配装',{exact:true}).selectOption(loadout);await page.getByRole('button',{name:'进入地牢',exact:true}).click();await ready(page);};
async function command(page:Page,c:Command){
 if(/^(wear|drop|use|identify|unequip):/.test(c)){
  if(!await page.locator('dialog[open]').count())await page.getByRole('button',{name:/^背包 /}).click();
  const [op,id]=c.split(':'),name={wear:'装备 · 8',drop:'丢下 · 4',use:'饮用 · 10',identify:'鉴定 · 10'}[op!];
  if(!name)throw new Error(c);await page.locator(`[data-item="${id}"]`).getByRole('button',{name,exact:true}).click();
 }else{
  if(await page.locator('dialog[open]').count())await page.getByRole('button',{name:'返回冒险',exact:true}).click();
  const [op,id,choice]=c.split(':');
  if(op==='take'||op==='door'||op==='lever')await page.locator(`[data-${op}="${id}"]`).click();
  else if(op==='cache')await page.locator(`[data-cache="${id}"] [data-choice="${choice}"]`).click();
  else if(c==='shrine')await page.getByRole('button',{name:'圣坛 · 12',exact:true}).click();
  else{await page.locator('canvas').focus();await page.keyboard.press(({left:'a',right:'d',up:'w',down:'s',attack:'Space',cast:'r',wait:'.',potion:'q',interact:'f'} as Record<string,string>)[c]!);}
 }
 await ready(page);
}
const rawAt=(commands:Command[],cut:number)=>{const s=new GameSession(42,'alpha');commands.slice(0,cut).forEach(c=>s.submit(c));return s.capture();};
async function load(page:Page,raw:string){await page.getByTestId('import-file').setInputFiles({name:'alpha.json',mimeType:'application/json',buffer:Buffer.from(raw)});await expect(page.locator('.play>.notice')).toContainText('验证并恢复');await ready(page);}
test('natural channeler branch route exercises spells, doors, cache choices, equipment and verified return',async({page})=>{
 test.setTimeout(360000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const route=runAlpha(42,'channeler',true);await start(page);
 for(let i=1;i<route.commands.length;i++){await command(page,route.commands[i]!);await expect(page.getByTestId('tick')).toHaveText(String(route.states[i+1]!.tick));}
 await expect(page.getByTestId('result')).toContainText('远征成功');await page.getByRole('button',{name:'保存',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m10'))).toBe(route.session.capture());
 await page.getByRole('button',{name:'查看回放',exact:true}).click();await page.locator('.replay input').fill('1');await expect(page.getByTestId('tick')).toHaveText('0');await expect(page.locator('[data-command=cast]')).toBeDisabled();
 await page.getByRole('button',{name:'EN',exact:true}).click();await expect(page.getByRole('heading',{name:'Fallen Star · Alpha',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('each loadout has its own costs, modal input is frozen, saves are isolated and forged imports are atomic',async({page})=>{
 for(const build of ['vanguard','breaker','channeler'] as Loadout[]){await start(page,build);await expect(page.locator('[data-command=attack]')).toContainText(build==='vanguard'?'10':build==='breaker'?'20':'12');}
 await page.getByRole('button',{name:'保存',exact:true}).click();const before=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m10'));
 await page.getByRole('button',{name:'冒险指南',exact:true}).click();await page.keyboard.press('r');await expect(page.getByTestId('tick')).toHaveText('0');await page.getByRole('button',{name:'返回冒险',exact:true}).click();
 await page.getByTestId('import-file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(new GameSession(42,'expedition').capture())});await expect(page.locator('.play>.notice')).not.toContainText('验证并恢复');
 const forged=JSON.parse(before!);forged.world.alpha.mana=999;await page.getByTestId('import-file').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});await expect(page.getByTestId('tick')).toHaveText('0');
 expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m10'))).toBe(before);
 await page.getByRole('button',{name:'暂停',exact:true}).click();await page.waitForTimeout(100);await page.locator('canvas').focus();await page.keyboard.press('d');await expect(page.getByTestId('tick')).toHaveText('0');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('natural ranged strike displays an in-flight projectile and a locked enemy target, with replay silent',async({page})=>{
 const route=runAlpha(42,'channeler',true);await start(page);const first=route.commands.indexOf('cast');await load(page,rawAt(route.commands,first));
 await page.locator('canvas').focus();await page.keyboard.press('r');await expect(page.locator('canvas')).toHaveAttribute('data-projectile','true');await ready(page);await expect(page.locator('canvas')).toHaveAttribute('data-projectile','false');
 const aimed=route.states.findIndex(v=>v.enemies.some(e=>e.kind==='hexer'&&e.intent));expect(aimed).toBeGreaterThan(0);await load(page,rawAt(route.commands,aimed));await expect(page.locator('.danger')).toContainText('咒术师瞄准');
 await page.getByRole('button',{name:'查看回放',exact:true}).click();await page.locator('.replay input').fill('0');await expect(page.locator('canvas')).toHaveAttribute('data-projectile','false');
});
