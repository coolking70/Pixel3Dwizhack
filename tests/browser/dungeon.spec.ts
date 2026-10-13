import { test, expect, type Page } from '@playwright/test';
async function ready(page: Page): Promise<void> { await expect(page.locator('canvas')).toHaveAttribute('data-busy', 'false'); }
async function press(page: Page, key: string): Promise<void> { await page.locator('canvas').focus(); await page.keyboard.press(key); await ready(page); }
async function x(page: Page): Promise<number> { return Number((await page.getByTestId('room-position').textContent())!.split('·')[1]); }
async function go(page: Page, target: number): Promise<void> {
  let budget = 70;
  while (await x(page) !== target && budget-- > 0) {
    if (Number((await page.getByTestId('room-hp').textContent())!.split('/')[0]) <= 22) await press(page, 'q');
    await press(page, await x(page) < target ? 'd' : 'a');
  }
  expect(await x(page)).toBe(target);
}

test('natural three-room expedition with branch, equipment comparisons, cross-room save and replay', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/dungeon.html'); await expect(page.locator('[data-state=ready]')).toBeVisible();
  await go(page, 8); await press(page, 'f'); await press(page, 'f');
  await page.getByLabel('胸甲', { exact: true }).selectOption('ironCuirass'); await ready(page);
  await go(page, 10); await press(page, 's'); await expect(page.getByTestId('room-position')).toHaveText('旧军械库 · 10');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('dungeon-descent.m02c'));
  await press(page, 'a'); await page.getByRole('button', { name: '读档', exact: true }).click();
  await expect(page.getByTestId('room-position')).toHaveText('旧军械库 · 10');
  let warningBudget = 15;
  while (!await page.getByRole('alert').count() && warningBudget-- > 0) await press(page, 'a');
  await expect(page.getByRole('alert')).toContainText('守卫蓄力');
  const warning = await page.getByRole('alert').textContent(), hp = await page.getByTestId('room-hp').textContent();
  await page.getByRole('button', { name: '保存', exact: true }).click(); await page.waitForTimeout(300);
  await expect(page.getByRole('alert')).toHaveText(warning!); await page.getByRole('button', { name: '读档', exact: true }).click(); await expect(page.getByRole('alert')).toHaveText(warning!);
  await press(page, 'd'); await press(page, 'd');
  while (await page.getByRole('alert').count()) await press(page, '.');
  await expect(page.getByTestId('room-hp')).toHaveText(hp!); await expect(page.locator('.journal')).toContainText('重击落空');
  await go(page, 3); for (let i = 0; i < 4; i++) await press(page, 'f');
  await expect(page.getByLabel('主手', { exact: true }).locator('option[value=mace]')).toContainText('(+3)');
  for (const [slot, id] of [['主手', 'mace'], ['副手', 'towerShield'], ['头部', 'ironHelm']]) { await page.getByLabel(slot!, { exact: true }).selectOption(id!); await ready(page); }
  await go(page, 15); await press(page, 'f'); await page.getByLabel('护腿', { exact: true }).selectOption('ironGreaves'); await ready(page);
  await go(page, 17); await press(page, 's'); await expect(page.getByTestId('room-position')).toHaveText('封印墓室 · 17'); await press(page, 'f');
  await go(page, 3); await press(page, 'f'); await expect(page.locator('.route-map')).toContainText('已收集');
  await go(page, 17); await press(page, 'w'); await go(page, 10); await press(page, 'w'); await go(page, 1);
  await expect(page.getByRole('status')).toHaveText('遗物归来 · 探险成功');
  await page.getByRole('button', { name: '保存', exact: true }).click(); const final = await page.evaluate(() => localStorage.getItem('dungeon-descent.m02c'));
  expect(final).not.toBe(saved);
  await page.getByRole('button', { name: '查看回放', exact: true }).click(); await page.locator('.replay input').fill('0');
  await expect(page.getByTestId('room-tick')).toHaveText('0'); await expect(page.getByRole('button', { name: '攻击', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'EN', exact: true }).click(); await expect(page.locator('h1')).toHaveText('Limestone Dungeon');
  await page.getByRole('button', { name: 'Return to live run', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Expedition complete');
  await page.getByRole('button', { name: 'Restart', exact: true }).click(); await page.getByRole('button', { name: 'Load', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Expedition complete');
  expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m02c'))).toBe(final);
  expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m02b'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('held input continues across frames then stops at danger, on release, and on pause', async ({ page, isMobile }) => {
  await page.goto('/dungeon.html'); await expect(page.locator('[data-state=ready]')).toBeVisible();
  await page.locator('canvas').focus(); await page.keyboard.down('d');
  await expect(page.getByTestId('room-position')).toHaveText('门厅 · 6'); await ready(page);
  const tick = await page.getByTestId('room-tick').textContent(); await page.waitForTimeout(600); await expect(page.getByTestId('room-tick')).toHaveText(tick!); await page.keyboard.up('d');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  const right = page.getByRole('button', { name: '向右', exact: true }); await right.scrollIntoViewIfNeeded();
  if (isMobile) await right.tap(); else await right.click(); await ready(page); await expect(page.getByTestId('room-position')).toHaveText('门厅 · 3');
  await page.waitForTimeout(400); await expect(page.getByTestId('room-position')).toHaveText('门厅 · 3');
  await page.locator('canvas').focus(); await page.keyboard.down('d'); await page.keyboard.press('Escape'); await page.keyboard.up('d');
  const pausedTick = await page.getByTestId('room-tick').textContent(); await page.waitForTimeout(400); await expect(page.getByTestId('room-tick')).toHaveText(pausedTick!);
  await expect(page.getByRole('status')).toHaveText('已暂停');
});

test('death can be saved and restored without accepting future commands; bad cross-scenario save preserves live run', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/dungeon.html'); await expect(page.locator('[data-state=ready]')).toBeVisible();
  await go(page, 6);
  let budget = 80;
  while ((await page.getByRole('status').textContent()) !== '冒险结束' && budget-- > 0) await press(page, '.');
  await expect(page.getByRole('status')).toHaveText('冒险结束'); await expect(page.getByRole('button', { name: '喝药', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const dead = await page.evaluate(() => localStorage.getItem('dungeon-descent.m02c'));
  await page.getByRole('button', { name: '重新开始', exact: true }).click(); await page.getByRole('button', { name: '读档', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('冒险结束');
  await page.evaluate(raw => { const v = JSON.parse(raw!); v.identity.rules = 'room-1'; localStorage.setItem('dungeon-descent.m02c', JSON.stringify(v)); }, dead);
  const tick = await page.getByTestId('room-tick').textContent(); await page.getByRole('button', { name: '读档', exact: true }).click();
  await expect(page.getByTestId('room-tick')).toHaveText(tick!); await expect(page.getByRole('status')).toHaveText('冒险结束'); await expect(page.locator('.notice')).toContainText('无效');
});
