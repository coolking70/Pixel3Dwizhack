import {expect,test} from '@playwright/test';
test('inspects loaded character gear, both strike contacts and enemy reactions without advancing rules',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/combat-lab.html');
 await expect(page.locator('[role=status]')).toHaveAttribute('data-state','ready');const canvas=page.locator('canvas');
 for(const face of ['-1','1'])for(const weapon of ['sword','mace']){
  await page.getByLabel('面对方向').selectOption(face);await page.getByLabel('武器',{exact:true}).selectOption(weapon);await page.getByRole('button',{name:'定位命中'}).click();
  await expect(canvas).toHaveAttribute('data-impact','true');expect(Number(await canvas.getAttribute('data-grip-error'))).toBeLessThan(1e-8);
 }
 for(const model of ['classic','vanguard'])await page.getByLabel('角色模型').selectOption(model);
 await page.getByLabel('衣甲').selectOption('plate');await page.getByLabel('衣甲').selectOption('brigandine');
 await page.getByLabel('对手').selectOption('crawler');await page.getByLabel('检查动作').selectOption('incoming');
 await page.getByRole('button',{name:'循环播放'}).click();await expect(canvas).not.toHaveAttribute('data-phase','0.45');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const phase=await canvas.getAttribute('data-phase');await page.waitForTimeout(100);await expect(canvas).toHaveAttribute('data-phase',phase!);
 await page.getByRole('button',{name:'上一帧'}).click();await expect(canvas).not.toHaveAttribute('data-phase',phase!);
 await page.getByRole('button',{name:'EN',exact:true}).click();await expect(page.getByRole('heading',{name:'Combat inspection'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
