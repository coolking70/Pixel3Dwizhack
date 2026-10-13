import { expect, test, type Page } from '@playwright/test';
import * as T from 'three';
import alpha4Golden from '../fixtures/alpha4-v1.json' with { type: 'json' };
import { GameSession } from '../../src/session/session';
import { SceneHitTest } from '../../src/room/scene-hit-test';
import { floorY } from '../../src/room/presentation';
import { groundPiles, pileMarkerPosition } from '../../src/room/ground-pile';
import { directItemCases, directWorldCases } from '../m25-trace';
import type { Command } from '../../src/core/types';
import type { LadderEdge } from '../../src/interaction/ux-types';

const canvas = (page: Page) => page.locator('canvas[data-ui=native]');
type Region = { id: string; label: string; x: number; y: number; width: number; height: number };
async function regions(page: Page): Promise<Region[]> { return JSON.parse(await canvas(page).getAttribute('data-regions') ?? '[]'); }
async function tap(page: Page, x: number, y: number) { if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }
async function click(page: Page, id: string, pager?: string) {
  for (let n = 0; n < 20; n++) {
    const list = await regions(page), region = list.find(r => r.id === id) ?? list.find(r => r.id === pager);
    expect(region, `visible region ${id}`).toBeTruthy();
    const box = (await canvas(page).boundingBox())!;
    await tap(page, box.x + region!.x + region!.width / 2, box.y + region!.y + region!.height / 2);
    if (region!.id === id) return;
  }
  throw new Error(`Unreachable ${id}`);
}
async function ready(page: Page, scenario = 'alpha3') { await page.goto(`/${scenario}.html`); await expect(page.locator('[data-state=ready]')).toBeAttached(); }
async function load(page: Page, raw: string) {
  await page.getByTestId('import-file').setInputFiles({ name: 'natural.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(canvas(page)).toHaveAttribute('data-revision', String(JSON.parse(raw).world.revision));
  await expect(canvas(page)).toHaveAttribute('data-busy', 'false');
}
async function world(page: Page) { for (let n = 0; n < 5 && await canvas(page).getAttribute('data-panel') !== 'world'; n++) await page.keyboard.press('Escape'); await expect(canvas(page)).toHaveAttribute('data-panel', 'world'); }
async function saved(page: Page, key = 'dungeon-descent.m25') { await world(page); await click(page, 'aux'); await click(page, 'open:storage'); await click(page, 'save'); return page.evaluate(key => localStorage.getItem(key), key); }
async function item(page: Page, raw: string, id: number) {
  const bag = GameSession.fromArchive(raw).view().alpha2!.bag, source = bag.find(i => i.id === id)!;
  await click(page, 'bag');
  await click(page, source.equipped ? 'inventory:character' : 'inventory:bag');
  await click(page, source.equipped ? `slot:${source.equipped}` : `item:${bag.filter(i => !i.equipped).findIndex(i => i.id === id)}`);
  await expect(canvas(page)).toHaveAttribute('data-panel', 'itemDetail');
}
async function projection(page: Page, raw: string, low = false) {
  const view = GameSession.fromArchive(raw).view(), rect = (await canvas(page).boundingBox())!, camera = new T.OrthographicCamera();
  const aspect = rect.width / rect.height, span = aspect > 1.35 ? 9.8 : 6.8, vertical = span / aspect;
  const x = T.MathUtils.clamp(view.player.x + view.player.face * .8, span / 2 - .5, view.map.width - span / 2 - .5), y = floorY(view.player.floor) + 1.15;
  camera.near = .1; camera.far = 70; camera.position.set(x + .65, y + 1.05, 15); camera.lookAt(x, y, 0);
  camera.left = -span / 2; camera.right = span / 2; camera.top = vertical / 2; camera.bottom = -vertical / 2; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  return { view, rect, hit: new SceneHitTest(camera, () => ({ left: rect.x, top: rect.y, width: rect.width, height: rect.height }), () => view, () => low), point: (p: T.Vector3) => { const n = p.clone().project(camera); return { x: rect.x + (n.x + 1) * rect.width / 2, y: rect.y + (1 - n.y) * rect.height / 2 }; } };
}

test('M26 direct HUD and focus lifecycle preserve archives and accept one fresh input without Resume', async ({ page }) => {
  test.setTimeout(90000); await ready(page, 'alpha4');
  const s = new GameSession(1, 'alpha4'); expect(s.submit('choose:vanguard').accepted).toBe(true); const raw = s.capture();
  for (const reason of ['blur', 'pointercancel', 'disconnect', 'menu']) {
    await load(page, raw); const list = await regions(page);
    expect(list.filter(r => r.id === 'bag')).toHaveLength(1); expect(list.some(r => ['pause', 'character'].includes(r.id))).toBe(false);
    if (reason === 'blur') {
      await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
      await click(page, 'bag'); await expect(canvas(page)).toHaveAttribute('data-panel', 'world');
    } else if (reason === 'pointercancel') await canvas(page).dispatchEvent('pointercancel', { pointerId: 99, isPrimary: true });
    else if (reason === 'disconnect') await page.evaluate(() => window.dispatchEvent(new Event('gamepaddisconnected')));
    else { await page.keyboard.press('Escape'); await expect(canvas(page)).toHaveAttribute('data-panel', 'menu'); await page.keyboard.press('Escape'); }
    expect(await saved(page, 'dungeon-descent.m26'), reason).toBe(raw);
    await world(page); await page.keyboard.press('ArrowRight');
    await expect(canvas(page)).toHaveAttribute('data-busy', 'false');
    const expected = GameSession.fromArchive(raw); expect(expected.submit('right').accepted).toBe(true);
    expect(await saved(page, 'dungeon-descent.m26'), `${reason}: exactly one fresh action`).toBe(expected.capture());
  }
});

test('M26 natural item actions preserve exact rules and return to the correct detail, bag or equipment page', async ({ page }) => {
  test.setTimeout(300000); await ready(page);
  for (const c of directItemCases()) {
    await load(page, c.before); await item(page, c.before, c.sourceId);
    await click(page, `offer:${c.motion}`, 'interaction:next');
    if (!['equip', 'unequip'].includes(c.motion)) {
      const s = GameSession.fromArchive(c.before), target = s.queryTargets(c.sourceId, c.motion).find(t => t.command === c.command)!;
      expect(target, c.name).toBeTruthy();
      if (target.ref.type === 'self') await click(page, 'target:self');
      else if (target.ref.type === 'inventory-item') {
        const id = target.ref.itemId, bag = s.view().alpha2!.bag, selected = bag.find(i => i.id === id)!;
        await click(page, selected.equipped ? `slot:${selected.equipped}` : `item:${bag.filter(i => !i.equipped).findIndex(i => i.id === id)}`);
      } else {
        if ((await regions(page)).some(r => r.id === 'target:world')) await click(page, 'target:world');
        const targets = s.queryTargets(c.sourceId, c.motion).filter(t => t.status !== 'disabled'), index = targets.findIndex(t => t.command === c.command);
        for (let n = 0; n <= index; n++) await click(page, 'target:next');
      }
      await click(page, 'interaction:confirm');
    }
    const after = GameSession.fromArchive(c.after).view(), retained = after.alpha2!.bag.some(i => i.id === c.sourceId);
    await expect(canvas(page), c.name).toHaveAttribute('data-revision', String(after.revision)); await expect(canvas(page)).toHaveAttribute('data-busy', 'false', { timeout: 15000 });
    await expect(canvas(page), `${c.name} navigation`).toHaveAttribute('data-panel', ['equip', 'unequip'].includes(c.motion) || !retained ? 'bag' : 'itemDetail');
    expect(await saved(page), c.name).toBe(c.after);
  }
});

test('M26 visible ladder segments click down into an unexplored layer then back up exactly once', async ({ page }) => {
  test.setTimeout(90000); await ready(page);
  const c = directWorldCases().find(c => c.name === 'ladder')!, initial = GameSession.fromArchive(c.before);
  expect(initial.view().explored[initial.view().player.floor + 1]).toEqual([]);
  for (const direction of ['down', 'up'] as const) {
    const raw = direction === 'down' ? c.before : c.after, s = GameSession.fromArchive(raw), v = s.view(), toFloor = v.player.floor + (direction === 'down' ? 1 : -1);
    const edge: LadderEdge = { linkId: Math.min(v.player.floor, toFloor) * v.map.width + v.player.x, fromFloor: v.player.floor, toFloor, x: v.player.x };
    await load(page, raw); const { hit } = await projection(page, raw), point = hit.ladderScreenPoint(edge); expect(point).toBeTruthy();
    expect(hit.hitCandidates(point!.x, point!.y).ladderEdges).toContainEqual(edge);
    expect(s.submit(direction).accepted).toBe(true); await tap(page, point!.x, point!.y);
    if (await canvas(page).getAttribute('data-panel') === 'ladderChoices') await click(page, `ladder:${edge.linkId}:${edge.fromFloor}:${edge.toFloor}`);
    await expect(canvas(page)).toHaveAttribute('data-climb-destination', new RegExp(`\"floor\":${toFloor}`));
    expect(JSON.parse((await canvas(page).getAttribute('data-climb-destination'))!).y).toBeCloseTo(floorY(toFloor)+.8, 8);
    await expect(canvas(page)).toHaveAttribute('data-revision', String(s.view().revision)); await expect(canvas(page)).toHaveAttribute('data-busy', 'false', { timeout: 15000 });
    expect(await saved(page), direction).toBe(s.capture());
  }
});

function pile(count: number) {
  const s = new GameSession(1, 'alpha4'); expect(s.submit('choose:vanguard').accepted).toBe(true);
  const items = s.view().alpha2!.bag.slice(0, count);
  for (const item of items) { if (item.equipped) expect(s.submit(`unequip:${item.equipped}`).accepted).toBe(true); expect(s.submit(`drop:${item.id}`).accepted).toBe(true); }
  const ids = items.map(i => i.id); expect(s.view().alpha2!.ground.filter(i => ids.includes(i.id))).toHaveLength(count); return { s, ids };
}
test('M26 natural 1/2/4/8 piles expose exact stable IDs and overflow selection never picks an arbitrary member', async ({ page }) => {
  test.setTimeout(180000); await ready(page, 'alpha4');
  for (const quality of ['normal', 'low']) for (const count of [1, 2, 4, 8]) {
    const { s, ids } = pile(count), raw = s.capture(); await load(page, raw);
    if (quality === 'low' && count === 1) { await click(page, 'aux'); await click(page, 'open:settings'); await click(page, 'setting:low'); await click(page, 'close'); }
    const projected = await projection(page, raw, quality === 'low'), p = groundPiles(projected.view, quality === 'low').find(p => p.itemIds.includes(ids[0]!))!;
    expect(p.members).toHaveLength(Math.min(4, count)); expect(p.itemIds).toEqual(ids);
    const id = count === 8 ? ids[6]! : ids[count - 1]!;
    if (count === 8) {
      const point = projected.point(pileMarkerPosition(p)); await tap(page, point.x, point.y);
      await expect(canvas(page)).toHaveAttribute('data-panel', 'groundPile');
      expect(await canvas(page).getAttribute('data-revision')).toBe(String(s.view().revision)); await click(page, `ground:${id}`, 'ground:next');
    } else {
      const point = projected.hit.worldScreenPoint({ type: 'world-entity', kind: 'ground-item', id })!; expect(point).toBeTruthy();
      // Browser input backends may quantize CSS coordinates. Choose an exposed integer pixel
      // with a subpixel safety margin; never turn ambiguity into a successful arbitrary pickup.
      const exact = (x:number,y:number) => { const hits = projected.hit.hitCandidates(x,y).hits.filter(h => h.ref.type === 'world-entity' && h.ref.kind === 'ground-item'); return hits.length === 1 && hits[0]!.ref.type === 'world-entity' && hits[0]!.ref.id === id; };
      const exposed = [0,-2,2,-4,4,-6,6,-8,8,-10,10,-12,12,-14,14].flatMap(dx => [0,-1,1,-2,2,-3,3,-4,4].map(dy => ({x:Math.round(point.x)+dx,y:Math.round(point.y)+dy}))).find(q => [-.6,0,.6].every(dx => [-.6,0,.6].every(dy => exact(q.x+dx,q.y+dy))));
      expect(exposed, `exposed exact ID ${id}, pile ${count}`).toBeTruthy(); await tap(page, exposed!.x, exposed!.y);
    }
    expect(s.submit(`take:${id}`).accepted).toBe(true);
    await expect(canvas(page)).toHaveAttribute('data-revision', String(s.view().revision)); await expect(canvas(page)).toHaveAttribute('data-busy', 'false', { timeout: 15000 });
    expect(await saved(page, 'dungeon-descent.m26'), `pile ${count} exact member ${id}`).toBe(s.capture());
  }
});

test('M26 world long press is read-only and pickup-all consumes one fresh command per remaining member', async ({ page }, testInfo) => {
  test.setTimeout(90000); await ready(page, 'alpha4'); const { s, ids } = pile(4), raw = s.capture(); await load(page, raw);
  const projected = await projection(page, raw), point = projected.hit.worldScreenPoint({ type: 'world-entity', kind: 'ground-item', id: ids[0]! })!;
  // Real browser capture with an emulated touch pointer type; this is not a physical touchscreen claim.
  await page.evaluate(() => document.querySelector('canvas[data-ui=native]')!.addEventListener('pointerdown', e => Object.defineProperty(e, 'pointerType', {value:'touch'}), {capture:true,once:true}));
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await expect(canvas(page)).toHaveAttribute('data-panel', 'groundPile');
  await page.mouse.up();
  const choices = await regions(page), first = choices.find(r => r.id === `ground:${ids[0]}`)!, cancel = choices.find(r => r.id === 'ground:cancel')!;
  const panelRect = { x:first.x-12, y:first.y-46, right:first.x+first.width+12, bottom:cancel.y+cancel.height+12 };
  for (const id of ids) { const screen = projected.hit.worldScreenPoint({type:'world-entity',kind:'ground-item',id})!; expect(screen.x >= panelRect.x && screen.x <= panelRect.right && screen.y >= panelRect.y && screen.y <= panelRect.bottom, `actual model ${id} is visible beside chooser`).toBe(false); }
  await canvas(page).screenshot({path:testInfo.outputPath('ground-selector.png')});
  expect(await canvas(page).getAttribute('data-revision')).toBe(String(s.view().revision));
  await click(page, 'ground:cancel'); expect(await saved(page, 'dungeon-descent.m26')).toBe(raw);
  const all = pile(8), allRaw = all.s.capture(); await load(page, allRaw);
  const allProjection = await projection(page, allRaw), group = groundPiles(allProjection.view).find(p => p.itemIds.includes(all.ids[0]!))!;
  const marker = allProjection.point(pileMarkerPosition(group)); await tap(page, marker.x, marker.y);
  await expect(canvas(page)).toHaveAttribute('data-panel', 'groundPile');
  await click(page, 'ground:all'); for (const id of all.ids) expect(all.s.submit(`take:${id}`).accepted).toBe(true);
  await expect(canvas(page)).toHaveAttribute('data-revision', String(all.s.view().revision), { timeout: 15000 }); await expect(canvas(page)).toHaveAttribute('data-busy', 'false');
  expect(await saved(page, 'dungeon-descent.m26')).toBe(all.s.capture());
});


test('M26 focus cancels an uncommitted target while retaining the selected item detail', async ({ page }) => {
  test.setTimeout(60000); await ready(page); const c = directItemCases().find(c => c.name === 'throw')!;
  await load(page, c.before); await item(page, c.before, c.sourceId); await click(page, 'offer:throw', 'interaction:next');
  await page.keyboard.press('ArrowRight'); await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
  await expect(canvas(page)).toHaveAttribute('data-panel', 'itemDetail');
  await page.keyboard.press('Shift'); expect(await saved(page)).toBe(c.before);
});

test('M26 natural golden route ladders cover all six floors in both directions', async ({ page }) => {
  test.setTimeout(180000); await ready(page, 'alpha4'); const s = new GameSession(alpha4Golden.seed, 'alpha4'), cases: { raw: string; direction: 'up' | 'down' }[] = [];
  for (const step of alpha4Golden.history) {
    if (step.command === 'down') cases.push({ raw: s.capture(), direction: 'down' });
    expect(s.submit(step.command as Command).accepted).toBe(true);
    if (step.command === 'down') cases.push({ raw: s.capture(), direction: 'up' });
  }
  expect(cases).toHaveLength(10);
  for (const {raw, direction} of cases) {
    const session = GameSession.fromArchive(raw), v = session.view(), toFloor = v.player.floor + (direction === 'down' ? 1 : -1);
    const edge: LadderEdge = {linkId: Math.min(v.player.floor, toFloor) * v.map.width + v.player.x, fromFloor: v.player.floor, toFloor, x: v.player.x};
    await load(page, raw); const {hit} = await projection(page, raw), point = hit.ladderScreenPoint(edge)!; expect(point).toBeTruthy();
    expect(session.submit(direction).accepted).toBe(true); await tap(page, point.x, point.y);
    if (await canvas(page).getAttribute('data-panel') === 'ladderChoices') await click(page, `ladder:${edge.linkId}:${edge.fromFloor}:${edge.toFloor}`);
    await expect(canvas(page)).toHaveAttribute('data-climb-destination', new RegExp(`\"floor\":${toFloor}`));
    expect(JSON.parse((await canvas(page).getAttribute('data-climb-destination'))!).y).toBeCloseTo(floorY(toFloor)+.8, 8);
    await expect(canvas(page)).toHaveAttribute('data-revision', String(session.view().revision)); await expect(canvas(page)).toHaveAttribute('data-busy', 'false', {timeout:15000});
    expect(await saved(page, 'dungeon-descent.m26'), `${v.player.floor} ${direction}`).toBe(session.capture());
  }
});
