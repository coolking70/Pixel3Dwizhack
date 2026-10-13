import { expect, test, type Page } from '@playwright/test';
import { runAlpha2, GameSession } from '../alpha2-route';
import type { Command } from '../../src/core/types';
import type { Loadout } from '../../src/core/alpha-types';
const ready = async (page: Page) => { await expect(page.locator('canvas')).toHaveAttribute('data-busy', 'false'); };
async function start(page: Page, loadout: Loadout = 'channeler') { await page.goto('/alpha2.html?ui=legacy'); await expect(page.locator('[data-state=ready]')).toBeAttached(); await page.getByTestId('seed').fill('42'); await page.getByLabel('起始配装', { exact: true }).selectOption(loadout); await page.getByRole('button', { name: '进入地牢', exact: true }).click(); await ready(page); }
const close = async (page: Page) => { if (await page.locator('dialog[open]').count())
    await page.getByRole('button', { name: '返回冒险', exact: true }).click(); };
async function command(page: Page, c: Command) {
    if (c.startsWith('a2:use:')) {
        if (!await page.locator('dialog[open]').count())
            await page.getByRole('button', { name: /^背包 / }).click();
        const [, , id, action, target] = c.split(':');
        await page.locator(`[data-item="${id}"] [data-action="${action}"]`).click();
        await page.getByLabel('作用目标', { exact: true }).selectOption(target!);
        await page.getByRole('button', { name: '执行动作', exact: true }).click();
    }
    else if (c.startsWith('drop:')) {
        if (!await page.locator('dialog[open]').count())
            await page.getByRole('button', { name: /^背包 / }).click();
        await page.locator(`[data-item="${c.split(':')[1]}"]`).getByRole('button', { name: '丢下 · 4', exact: true }).click();
    }
    else {
        await close(page);
        const [op, id] = c.split(':');
        if (op === 'take' || op === 'door' || op === 'lever')
            await page.locator(`[data-${op}="${id}"]`).click();
        else if (c.startsWith('a2:feature:')) {
            const action = c.split(':')[3], names: Record<string, string> = { drink: '饮泉 · 12 tick', disarm: '拆除 · 12 tick', harvest: '采集 · 12 tick', force: '损失 7 生命', pay: '支付 10 金币' };
            await page.getByRole('button', { name: names[action!]!, exact: true }).click();
        }
        else {
            await page.locator('canvas').focus();
            await page.keyboard.press(({ left: 'a', right: 'd', up: 'w', down: 's', attack: 'Space', cast: 'r', wait: '.', potion: 'q', interact: 'f', 'a2:search': 'x' } as Record<string, string>)[c]!);
        }
    }
    await ready(page);
}
function archive(commands: Command[], cut: number) { const s = new GameSession(42, 'alpha2'); for (const c of commands.slice(0, cut))
    s.submit(c); return s.capture(); }
async function load(page: Page, raw: string) { await page.getByTestId('import-file').setInputFiles({ name: 'alpha2.json', mimeType: 'application/json', buffer: Buffer.from(raw) }); await expect(page.locator('.play>.notice')).toContainText(/验证并恢复|verified and restored/); await ready(page); }
test('Alpha 2 natural full item route is playable through real UI and exports exact validated history', async ({ page }) => {
    test.setTimeout(720000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const route = runAlpha2(42, 'channeler', 'items');
    await start(page);
    for (let n = 1; n < route.commands.length; n++) {
        await command(page, route.commands[n]!);
        await expect(page.getByTestId('tick')).toHaveText(String(route.states[n + 1]!.tick));
    }
    await expect(page.getByTestId('result')).toContainText('远征成功');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m15'))).toBe(route.session.capture());
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出存档', exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toContain('alpha2');
    await page.getByRole('button', { name: '查看回放', exact: true }).click();
    await page.locator('.replay input').fill('0');
    await expect(page.getByTestId('tick')).toHaveText('0');
    await expect(page.locator('[data-command=cast]')).toBeDisabled();
    expect(errors).toEqual([]);
});
test('unknown item notes are literal, knowledge follows history and searchable codex never reveals future discoveries', async ({ page }) => {
    const route = runAlpha2(42, 'channeler', 'items'), identify = route.commands.findIndex(c => c.includes(':read:i'));
    expect(identify).toBeGreaterThan(0);
    await start(page);
    await load(page, archive(route.commands, identify));
    const id = Number(route.commands[identify]!.split(':').at(-1)!.slice(1));
    await page.getByRole('button', { name: /^背包 / }).click();
    const row = page.locator(`[data-item="${id}"]`);
    await expect(row).toContainText('未知');
    const note = row.getByRole('textbox');
    await note.fill('<b>my guess: fire</b>');
    await note.press('Tab');
    await expect(note).toHaveValue('<b>my guess: fire</b>');
    expect(await row.locator('b').count()).toBe(1);
    const chineseNote = '猜'.repeat(120);
    await note.fill(chineseNote);
    await note.press('Tab');
    await expect(note).toHaveValue(chineseNote);
    await close(page);
    await page.getByRole('button', { name: '已发现图鉴', exact: true }).click();
    await page.getByLabel('搜索已发现名称', { exact: true }).fill('苦胆毒液');
    await expect(page.locator('.codex-entry')).toHaveCount(0);
    await close(page);
    await command(page, route.commands[identify]!);
    await expect(page.locator(`[data-item="${id}"]`)).not.toContainText('未知药瓶');
    await close(page);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const raw = await page.evaluate(() => localStorage.getItem('dungeon-descent.m15'));
    const restored = GameSession.fromArchive(raw!);
    expect(restored.view().alpha2!.bag.find(i => i.id === id)!.note).toBe(chineseNote);
    await page.getByRole('button', { name: '查看回放', exact: true }).click();
    await page.locator('.replay input').fill(String(identify));
    await page.getByRole('button', { name: /^背包 / }).click();
    await expect(page.locator(`[data-item="${id}"] input`)).toHaveValue('');
    await expect(page.locator(`[data-item="${id}"] [data-action]`).first()).toBeDisabled();
});
test('three loadouts, paid trading, modal freeze and corrupt/cross-scenario save rejection', async ({ page }) => {
    for (const build of ['vanguard', 'breaker', 'channeler'] as Loadout[]) {
        await start(page, build);
        await expect(page.locator('[data-command=attack]')).toContainText(build === 'vanguard' ? '10' : build === 'breaker' ? '20' : '12');
    }
    const shop = page.locator('[data-feature=merchant]');
    await expect(shop).toBeVisible();
    const offer = shop.locator('[data-buy]:enabled').first(), id = Number(await offer.getAttribute('data-buy'));
    expect(id).toBeGreaterThan(0);
    await offer.click();
    await ready(page);
    await expect(shop.locator(`[data-buy="${id}"]`)).toHaveCount(0);
    await expect(page.getByTestId('tick')).toHaveText('12');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const before = await page.evaluate(() => localStorage.getItem('dungeon-descent.m15'));
    await page.getByRole('button', { name: '冒险指南', exact: true }).click();
    const tick = await page.getByTestId('tick').textContent();
    await page.keyboard.press('r');
    await expect(page.getByTestId('tick')).toHaveText(tick!);
    await close(page);
    for (const raw of [new GameSession(42, 'alpha').capture(), (() => { const o = JSON.parse(before!); o.world.alpha2.mana = 999; return JSON.stringify(o); })()]) {
        await page.getByTestId('import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
        await expect(page.locator('.play>.notice')).not.toContainText('验证并恢复');
        await expect(page.getByTestId('tick')).toHaveText(tick!);
    }
    expect(await page.evaluate(() => localStorage.getItem('dungeon-descent.m15'))).toBe(before);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.locator('canvas').focus();
    await page.keyboard.press('d');
    await expect(page.getByTestId('tick')).toHaveText(tick!);
});
test('discovered facilities, condition sources, English portrait and landscape fit without horizontal overflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const route = runAlpha2(42, 'channeler', 'items');
    await start(page);
    const deep = route.states.findIndex(v => v.player.floor === 4);
    await load(page, archive(route.commands, deep));
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Fallen Star · Alpha 2', exact: true })).toBeVisible();
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(size);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole('button', { name: /^Inventory / }).click();
        expect(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.getByRole('button', { name: 'Return to adventure', exact: true }).click();
    }
    const status = route.states.findIndex(v => v.alpha2!.conditions.length > 0);
    if (status >= 0) {
        await load(page, archive(route.commands, status));
        await expect(page.locator('.conditions span')).not.toHaveCount(0);
    }
    expect(errors).toEqual([]);
});

