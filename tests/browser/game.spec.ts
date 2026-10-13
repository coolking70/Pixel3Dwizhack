import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('freezes when idle, advances on input, stops on keyup and danger, and blocks modal input', async ({ page }) => {
  const tick = page.getByTestId('tick');
  await expect(tick).toHaveText('0'); await page.waitForTimeout(350); await expect(tick).toHaveText('0');
  await page.getByTestId('scene').focus(); await page.keyboard.down('d');
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThanOrEqual(20);
  await page.keyboard.up('d'); const stopped = await tick.textContent();
  await page.waitForTimeout(350); await expect(tick).toHaveText(stopped!);
  await page.keyboard.down('d'); await page.waitForTimeout(1100);
  const danger = await tick.textContent(); await page.waitForTimeout(350); await expect(tick).toHaveText(danger!);
  await page.keyboard.up('d'); await expect(page.getByTestId('notice')).toContainText('停止');
  await page.getByRole('button', { name: '操作指南', exact: true }).click();
  const beforeModal = await tick.textContent(); await page.keyboard.press('d'); await expect(tick).toHaveText(beforeModal!);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.waitForTimeout(350); await expect(tick).toHaveText(beforeModal!);
});

test('cancels held input on lost focus, pointer release and pointer cancel', async ({ page }) => {
  const tick = page.getByTestId('tick');
  await page.getByTestId('scene').focus(); await page.keyboard.down('d');
  await expect.poll(async () => Number(await tick.textContent())).toBeGreaterThanOrEqual(10);
  // Capture the cancellation boundary in the same browser task as blur.
  // An intentionally held key may repeat between separate protocol calls.
  const lost = await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return document.querySelector('[data-testid=tick]')!.textContent; });
  await page.waitForTimeout(350); await expect(tick).toHaveText(lost!); await page.keyboard.up('d');
  const right = page.getByTestId('right'), bounds = await right.boundingBox();
  if (!bounds) throw new Error('button missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.waitForTimeout(200); await page.mouse.up(); const released = await tick.textContent();
  await page.waitForTimeout(300); await expect(tick).toHaveText(released!);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
  await page.dispatchEvent('body', 'pointercancel'); const cancelled = await tick.textContent();
  await page.waitForTimeout(300); await expect(tick).toHaveText(cancelled!);
  await page.mouse.up();
});

test('saves, loads, replays read-only, and changes language without affecting the archive', async ({ page }) => {
  await page.getByTestId('wait').click(); await page.getByTestId('save').click();
  const saved = await page.evaluate(() => localStorage.getItem('dungeon-descent.m01'));
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByTestId('save').click();
  expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m01'))).toBe(saved);
  await page.getByTestId('wait').click(); await expect(page.getByTestId('tick')).toHaveText('20');
  await page.getByTestId('load').click(); await expect(page.getByTestId('tick')).toHaveText('10');
  await page.getByTestId('replay').click(); await expect(page.getByTestId('tick')).toHaveText('0');
  await expect(page.getByTestId('attack')).toBeDisabled();
  await page.getByTestId('replay-slider').fill('1'); await expect(page.getByTestId('tick')).toHaveText('10');
  await page.getByTestId('exit-replay').click(); await expect(page.getByTestId('tick')).toHaveText('10');
  await page.getByTestId('save').click();
  expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m01'))).toBe(saved);
  await page.reload(); await page.getByTestId('load').click(); await expect(page.getByTestId('tick')).toHaveText('10');
});

test('rejects malformed file imports and fits the viewport with a rendered canvas', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByTestId('wait').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') });
  await expect(page.getByTestId('notice')).toContainText('无效'); await expect(page.getByTestId('tick')).toHaveText('10');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByTestId('scene').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((channel, index) => index % 4 !== 3 && channel > 150);
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('keeps narrow-screen panels full width and accepts real touch taps', async ({ page, isMobile }) => {
  if (isMobile) {
    const canvas = await page.getByTestId('scene').boundingBox();
    const inventory = await page.locator('aside .card').nth(2).boundingBox();
    expect(inventory!.width).toBeGreaterThanOrEqual(canvas!.width);
    await page.getByTestId('right').scrollIntoViewIfNeeded();
    const button = await page.getByTestId('right').boundingBox();
    await page.touchscreen.tap(button!.x + button!.width / 2, button!.y + button!.height / 2);
    await expect(page.getByTestId('tick')).toHaveText('10');
    await page.waitForTimeout(350); await expect(page.getByTestId('tick')).toHaveText('10');
  } else {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByRole('button', { name: 'English', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
