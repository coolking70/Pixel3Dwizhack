import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page): Promise<void> { await expect(page.locator('canvas')).toHaveAttribute('data-busy', 'false'); }
async function position(page: Page): Promise<number> { return Number((await page.getByTestId('room-position').textContent())!.split('·')[1]); }
async function press(page: Page, key: string): Promise<void> { await page.locator('canvas').focus(); await page.keyboard.press(key); await ready(page); }
async function go(page: Page, x: number): Promise<void> {
  let budget = 25;
  while (await position(page) !== x && budget-- > 0) await press(page, await position(page) < x ? 'd' : 'a');
  expect(await position(page)).toBe(x);
}

test('plays the full 3D room, equips loot, climbs, saves and replays without changing the live outcome', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/room.html'); await expect(page.locator('[data-state=ready]')).toBeVisible();
  const initial = await page.getByTestId('room-tick').textContent(); await page.waitForTimeout(200); await expect(page.getByTestId('room-tick')).toHaveText(initial!);
  await go(page, 6); await press(page, 'f'); await page.getByLabel('胸甲', { exact: true }).selectOption('ironCuirass'); await ready(page);
  await expect(page.getByLabel('胸甲', { exact: true })).toHaveValue('ironCuirass');
  await press(page, 'f'); await page.getByLabel('护腿', { exact: true }).selectOption('ironGreaves'); await ready(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const savedTick = await page.getByTestId('room-tick').textContent();
  await go(page, 8); await press(page, 'w'); await expect(page.getByTestId('room-position')).toHaveText('上层 · 8');
  await press(page, 's'); await expect(page.getByTestId('room-position')).toHaveText('下层 · 8');
  await press(page, 'w'); await expect(page.getByTestId('room-position')).toHaveText('上层 · 8');
  await press(page, 'f'); await page.getByLabel('头部', { exact: true }).selectOption('ironHelm'); await ready(page);
  await go(page, 11); await expect(page.getByRole('status')).toHaveText('已通过哨站');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const final = await page.evaluate(() => localStorage.getItem('dungeon-descent.m02b'));
  await page.getByRole('button', { name: '查看回放', exact: true }).click();
  await page.locator('.replay input').fill('0'); await expect(page.getByTestId('room-tick')).toHaveText('0');
  await expect(page.getByRole('button', { name: '攻击', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '返回当前进度', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('已通过哨站');
  await page.getByRole('button', { name: '重新开始', exact: true }).click(); await expect(page.getByTestId('room-tick')).toHaveText('0');
  await page.getByRole('button', { name: '读档', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('已通过哨站');
  expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m02b'))).toBe(final);
  expect(Number(savedTick)).toBeGreaterThan(0); expect(errors).toEqual([]);
});

test('release, pause, focus loss, texture and language do not schedule later mechanical actions', async ({ page }) => {
  await page.goto('/room.html'); await expect(page.locator('[data-state=ready]')).toBeVisible();
  await page.locator('canvas').focus(); await page.keyboard.down('d'); await page.waitForTimeout(40); await page.keyboard.up('d');
  const tick = await page.getByTestId('room-tick').textContent(); await page.waitForTimeout(450); await expect(page.getByTestId('room-tick')).toHaveText(tick!);
  await page.getByRole('button', { name: '暂停', exact: true }).click(); await expect(page.getByRole('button', { name: '攻击', exact: true })).toBeDisabled();
  await page.getByLabel('像素材质', { exact: true }).uncheck(); await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByTestId('room-tick')).toHaveText(tick!); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('canvas').focus(); await page.keyboard.down('d'); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('d');
  const lost = await page.getByTestId('room-tick').textContent(); await page.waitForTimeout(400); await expect(page.getByTestId('room-tick')).toHaveText(lost!);
  await expect(page.getByRole('status')).toHaveText('Paused');
});

test('bad assets block commands and narrow controls use the touch input path', async ({ page, isMobile }) => {
  await page.route('**/assets/character-study/motions.json', r => r.fulfill({ status: 404, body: '' }));
  await page.goto('/room.html'); await expect(page.locator('[data-state=error]')).toBeVisible(); await expect(page.getByRole('button', { name: '攻击', exact: true })).toBeDisabled();
  await page.unroute('**/assets/character-study/motions.json'); await page.reload(); await expect(page.locator('[data-state=ready]')).toBeVisible();
  const right = page.getByRole('button', { name: '向右', exact: true }); await right.scrollIntoViewIfNeeded();
  if (isMobile) await right.tap(); else await right.click();
  await expect(page.getByTestId('room-position')).toHaveText('下层 · 2'); await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
