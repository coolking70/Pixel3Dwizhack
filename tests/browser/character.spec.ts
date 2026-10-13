import { expect, test } from '@playwright/test';

test('character lab imports animation, changes outfit, seeks, pauses and fits the viewport', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/character-lab.html'); await expect(page.locator('[role=status]')).toHaveAttribute('data-state', 'ready');
  const canvas = page.locator('canvas');
  await page.getByLabel('皮甲 / 铁甲对照').uncheck(); await page.getByLabel('单人装备', { exact: true }).selectOption('cloth');
  await page.getByLabel('头盔').uncheck(); await page.getByLabel('左手盾').uncheck();
  await page.getByLabel('动作', { exact: true }).selectOption('attack'); await page.getByLabel('动作相位').fill('0.45');
  await expect(canvas).toHaveAttribute('data-phase', '0.45'); expect(Number(await canvas.getAttribute('data-grip-error'))).toBeLessThan(1e-6);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(canvas).not.toHaveAttribute('data-phase', '0.45');
  await page.getByRole('button', { name: '暂停', exact: true }).click(); const paused = await canvas.getAttribute('data-phase');
  await page.waitForTimeout(100); await expect(canvas).toHaveAttribute('data-phase', paused!);
  await page.getByLabel('动作', { exact: true }).selectOption('climb'); await expect(page.getByText(/自制攀爬占位/)).toBeVisible();
  await page.getByLabel('皮甲 / 铁甲对照').check(); await page.getByLabel('头盔').check(); await page.getByLabel('左手盾').check();
  await page.getByLabel('单色检查').check(); await page.getByLabel('显示尺寸', { exact: true }).selectOption('96');
  // WebGL initializes culled geometry lazily: compare the SAME warmed pose and
  // view before/after rebuilding gear, not initial idle against a new pose.
  const geometries = Number(await canvas.getAttribute('data-geometries'));
  for (let i = 0; i < 5; i++) { await page.getByLabel('头盔').uncheck(); await page.getByLabel('头盔').check(); }
  expect(Number(await canvas.getAttribute('data-geometries'))).toBe(geometries);
  await page.getByRole('button', { name: 'EN', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Character workshop', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('missing motion data gives an explicit error and disables playback', async ({ page }) => {
  await page.route('**/assets/character-study/motions.json', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/character-lab.html'); await expect(page.locator('[role=status]')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeDisabled();
});

test('graphics context loss stops playback and reports failure', async ({ page }) => {
  await page.goto('/character-lab.html'); await expect(page.locator('[role=status]')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.locator('[role=status]')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeDisabled();
});
