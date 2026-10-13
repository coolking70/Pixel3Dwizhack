import { test, expect, type Page } from '@playwright/test';
import { runExpedition } from '../expedition-route';
import { GameSession } from '../../src/session/session';
import type { Command } from '../../src/core/types';
async function ready(page: Page): Promise<void> { await expect(page.locator('canvas')).toHaveAttribute('data-busy', 'false'); }
async function start(page: Page, seed = 42): Promise<void> {
  await page.goto('/adventure.html'); await expect(page.locator('[data-state=ready]')).toBeAttached();
  await page.getByTestId('seed').fill(String(seed)); await page.getByRole('button', { name: '进入地牢', exact: true }).click(); await ready(page);
}
async function closeBag(page: Page): Promise<void> { if (await page.locator('dialog[open]').count()) await page.getByRole('button', { name: '返回冒险', exact: true }).click(); }
async function command(page: Page, c: Command): Promise<void> {
  if (/^(wear|drop|use|identify|unequip):/.test(c)) {
    if (!await page.locator('dialog[open]').count()) await page.getByRole('button', { name: /^背包 / }).click();
    const [op, id] = c.split(':'); const name = { wear: '装备 · 8', drop: '丢下 · 4', use: '饮用 · 10', identify: '鉴定 · 10' }[op!];
    if (name) await page.locator(`[data-item="${id}"]`).getByRole('button', { name, exact: true }).click();
    else throw new Error(`unsupported test command ${c}`);
  } else {
    await closeBag(page);
    if (c.startsWith('take:')) await page.locator(`[data-take="${c.slice(5)}"]`).click();
    else if (c === 'shrine') await page.getByRole('button', { name: '圣坛 · 12', exact: true }).click();
    else { await page.locator('canvas').focus(); await page.keyboard.press(({left:'a',right:'d',up:'w',down:'s',attack:'Space',wait:'.',potion:'q',interact:'f'} as Record<string,string>)[c]!); }
  }
  await ready(page);
}
async function importRaw(page: Page, raw: string): Promise<void> {
  await page.getByTestId('import-file').setInputFiles({ name:'expedition.json',mimeType:'application/json',buffer:Buffer.from(raw) });
  await expect(page.locator('.play > .notice')).toContainText('验证并恢复'); await ready(page);
}

test('six-floor natural branch expedition, items, guardian, return, export and replay', async ({ page }, info) => {
  test.setTimeout(360000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const route = runExpedition(42, true); await start(page);
  for (let index = 0; index < route.commands.length; index++) {
    await command(page, route.commands[index]!);
    await expect(page.getByTestId('tick')).toHaveText(String(route.states[index + 1]!.tick));
    if (index % 40 === 0) await expect(page.getByTestId('hp')).toHaveText(`${route.states[index+1]!.player.hp} / 64`);
  }
  await closeBag(page); await expect(page.getByTestId('result')).toContainText('远征成功');
  await page.getByRole('button', {name:'保存',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m06'))).toBe(route.session.capture());
  const download = page.waitForEvent('download'); await page.getByRole('button',{name:'导出存档',exact:true}).click(); const exported = await download;
  expect(exported.suggestedFilename()).toContain('fallen-star-42-');
  await page.getByRole('button',{name:'查看回放',exact:true}).click(); await page.locator('.replay input').fill('0');
  await expect(page.getByTestId('tick')).toHaveText('0'); await expect(page.locator('[data-command=attack]')).toBeDisabled();
  await page.getByRole('button',{name:/^背包 /}).click(); await expect(page.locator('[data-item="1"]').getByRole('button')).toBeDisabled(); await closeBag(page);
  await page.getByRole('button',{name:'EN',exact:true}).click(); await expect(page.locator('h1')).toHaveText('Fallen Star Expedition');
  await page.getByRole('button',{name:'Return to live run',exact:true}).click(); await expect(page.getByTestId('result')).toContainText('Expedition complete');
  await page.screenshot({ path: info.outputPath('completed.png'), fullPage:true });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('modal, input, settings, file validation and cross-language save keep stable boundaries', async ({ page, isMobile }, info) => {
  await start(page); const tick = await page.getByTestId('tick').textContent();
  await page.getByRole('button',{name:/^背包 /}).click(); await page.keyboard.press('d'); await page.waitForTimeout(200); await expect(page.getByTestId('tick')).toHaveText(tick!);
  await expect(page.locator('dialog')).toContainText('装备也占容量'); await page.screenshot({path:info.outputPath('inventory.png'),fullPage:true}); await closeBag(page);
  const right = page.locator('[data-command=right]'); if(isMobile)await right.tap();else await right.click();await ready(page);await expect(page.getByTestId('position')).toHaveText('第 1 层 · 3');
  await page.locator('canvas').focus();await page.keyboard.down('d');await page.keyboard.press('Escape');await page.keyboard.up('d');
  const paused = await page.getByTestId('tick').textContent();await page.waitForTimeout(350);await expect(page.getByTestId('tick')).toHaveText(paused!);
  await page.getByRole('button',{name:'继续',exact:true}).click();await page.locator('canvas').focus();await page.keyboard.down('d');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('d');
  const blurred=await page.getByTestId('tick').textContent();await page.waitForTimeout(350);await expect(page.getByTestId('tick')).toHaveText(blurred!);await page.getByRole('button',{name:'继续',exact:true}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('合成音效',{exact:true}).check();await page.getByLabel('音量',{exact:true}).fill('0');await page.getByLabel('低画质', {exact:false}).check();await page.getByLabel('像素材质',{exact:true}).uncheck();await closeBag(page);
  await page.getByRole('button',{name:'保存',exact:true}).click();const raw=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m06'));
  await command(page,'wait');await page.getByRole('button',{name:'读档',exact:true}).click();await expect(page.getByTestId('tick')).toHaveText(blurred!);
  await page.getByTestId('import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(page.locator('.play > .notice')).toContainText('无效');await expect(page.getByTestId('tick')).toHaveText(blurred!);
  await page.getByTestId('import-file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(new GameSession(42,'dungeon').capture())});await expect(page.locator('.play > .notice')).toContainText('无效');
  await importRaw(page,raw!);expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m02c'))).toBeNull();
  await page.screenshot({path:info.outputPath('game.png'),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'EN',exact:true}).click();
  expect((await page.locator('aside .card').first().boundingBox())!.width).toBeGreaterThan(200);
});

test('death, poison and guardian checkpoints survive verified file restore and replay', async ({ page }) => {
  test.setTimeout(90000);await start(page);
  const route=runExpedition(42,true), poisonIndex=route.states.findIndex(v=>v.expedition!.effects.some(e=>e.kind==='poison'));
  expect(poisonIndex).toBeGreaterThan(0);const poisoned=new GameSession(42,'expedition');route.commands.slice(0,poisonIndex).forEach(c=>poisoned.submit(c));
  await importRaw(page,poisoned.capture());await expect(page.locator('.effects')).toContainText('中毒');const tick=await page.getByTestId('tick').textContent();await page.waitForTimeout(250);await expect(page.getByTestId('tick')).toHaveText(tick!);
  const guardianIndex=route.states.findIndex(v=>v.enemies.some(e=>e.elite&&e.intent));expect(guardianIndex).toBeGreaterThan(0);
  const guardian=new GameSession(42,'expedition');route.commands.slice(0,guardianIndex).forEach(c=>guardian.submit(c));await importRaw(page,guardian.capture());await expect(page.locator('.danger')).toContainText('守卫蓄力');await expect(page.locator('.enemies')).toContainText('遗物守护者');
  const dying=new GameSession(42,'expedition');while(dying.view().player.x<6)dying.submit('right');let previous=dying.capture();
  for(let i=0;i<200&&dying.view().status==='playing';i++){previous=dying.capture();dying.submit('wait');}expect(dying.view().status).toBe('dead');
  await importRaw(page,previous);await command(page,'wait');await expect(page.getByTestId('result')).toContainText('远征结束');await expect(page.locator('[data-command=attack]')).toBeDisabled();
  await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByRole('button',{name:'读档',exact:true}).click();await expect(page.getByTestId('hp')).toHaveText('0 / 64');
  await page.getByRole('button',{name:'查看回放',exact:true}).click();await page.locator('.replay input').fill('0');await expect(page.getByTestId('hp')).toHaveText('64 / 64');
});

test('audio remains opt-in and read-only operations do not schedule sounds; loading failures preserve saves', async ({ page }) => {
  await page.addInitScript(() => {
    const original = OscillatorNode.prototype.start;
    (window as unknown as { sounds: number }).sounds = 0;
    OscillatorNode.prototype.start = function(time?: number) { (window as unknown as { sounds: number }).sounds++; original.call(this, time); };
  });
  await start(page); await command(page, 'attack');
  expect(await page.evaluate(() => (window as unknown as { sounds: number }).sounds)).toBe(0);
  await page.getByRole('button',{name:'设置',exact:true}).click(); await page.getByLabel('合成音效',{exact:true}).check(); await closeBag(page);
  await command(page, 'attack'); expect(await page.evaluate(() => (window as unknown as { sounds: number }).sounds)).toBe(1);
  await page.getByRole('button',{name:'保存',exact:true}).click(); await page.getByRole('button',{name:'读档',exact:true}).click();
  await page.getByRole('button',{name:'查看回放',exact:true}).click(); await page.locator('.replay input').fill('0'); await page.getByRole('button',{name:'返回当前进度',exact:true}).click();
  expect(await page.evaluate(() => (window as unknown as { sounds: number }).sounds)).toBe(1);
  await page.getByRole('button',{name:'设置',exact:true}).click(); await page.getByLabel('合成音效',{exact:true}).uncheck(); await closeBag(page); await command(page, 'attack');
  expect(await page.evaluate(() => (window as unknown as { sounds: number }).sounds)).toBe(1);
  await page.route('**/motions.json', route => route.abort()); await page.reload();
  await expect(page.locator('dialog')).toContainText('3D 加载失败'); await expect(page.getByRole('button',{name:'进入地牢',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m06'))).not.toBeNull();
});

test('restoring another seed replaces retained enemy models when an id changes archetype', async ({ page }) => {
  await start(page);
  const a=runExpedition(1),b=runExpedition(42);
  const first=a.states.findIndex(v=>v.enemies.some(e=>e.kind==='guard'));
  const enemy=a.states[first]!.enemies.find(e=>e.kind==='guard')!;
  const second=b.states.findIndex(v=>v.enemies.some(e=>e.id===enemy.id&&e.kind==='crawler'));
  expect(first).toBeGreaterThan(0);expect(second).toBeGreaterThan(0);
  const s1=new GameSession(1,'expedition');a.commands.slice(0,first).forEach(c=>s1.submit(c));await importRaw(page,s1.capture());
  await expect(page.locator('canvas')).toHaveAttribute('data-actor-types',new RegExp(`${enemy.id}:guard:false`));
  const s2=new GameSession(42,'expedition');b.commands.slice(0,second).forEach(c=>s2.submit(c));await importRaw(page,s2.capture());
  await expect(page.locator('canvas')).toHaveAttribute('data-actor-types',new RegExp(`${enemy.id}:crawler:false`));
});
