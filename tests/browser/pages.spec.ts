import { expect, test } from '@playwright/test';
import { canvas, click, regions, saved, world } from './m35-helpers';
import { GameSession } from '../../src/session/session';

test('Pages subpath opens current game, loads real models, and saves one accepted action', async ({ page }, info) => {
  const failures: string[] = [], models: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    if (response.url().endsWith('.glb') && response.ok()) models.push(response.url());
  });
  await page.goto('./');
  await expect(page).toHaveURL(/\/Pixel3Dwizhack\/alpha6\.html$/);
  await expect(page.locator('[data-state=ready]')).toBeAttached();
  await click(page, 'start');
  await expect(canvas(page)).toHaveAttribute('data-panel', 'world');
  const session = new GameSession(24681, 'alpha6');
  expect(session.submit('choose:vanguard').accepted).toBe(true);
  await click(page, 'bag');
  await click(page, 'inventory:character');
  await click(page, 'slot:mainHand');
  await expect(canvas(page)).toHaveAttribute('data-ui-assets-pending', '0');
  await expect.poll(() => models.length).toBeGreaterThan(0);
  expect(models.every(url => new URL(url).pathname.startsWith('/Pixel3Dwizhack/assets/items/'))).toBe(true);
  await click(page, 'offer:unequip');
  expect(session.submit('unequip:mainHand').accepted).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-busy', 'false');
  await expect(canvas(page)).toHaveAttribute('data-panel', 'world');
  expect(await saved(page)).toBe(session.capture());
  await world(page);
  expect((await regions(page)).map(r => r.id).sort()).toEqual(['aux', 'bag', 'hud:journal']);
  await canvas(page).screenshot({ path: info.outputPath('pages-preview.png') });
  expect(failures).toEqual([]);
});
