// Production UI route and local software/hardware renderer sampling.
// Usage: node scripts/profile-dungeon.mjs <external-output-directory>
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
if (!process.argv[2]) throw new Error('Pass an external output directory');
const output = resolve(process.argv[2]); await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/dungeon.html'); await page.locator('[data-state=ready]').waitFor();
  const ready = () => page.waitForFunction(() => document.querySelector('canvas').dataset.busy === 'false');
  const key = async value => { await page.locator('canvas').focus(); await page.keyboard.press(value); await ready(); };
  const x = async () => Number((await page.getByTestId('room-position').textContent()).split('·')[1]);
  const go = async target => {
    let budget = 70;
    while (await x() !== target && budget-- > 0) {
      if (Number((await page.getByTestId('room-hp').textContent()).split('/')[0]) <= 22) await key('q');
      await key(await x() < target ? 'd' : 'a');
    }
    if (await x() !== target) throw new Error('route failed');
  };
  const equip = async (slot, id) => { await page.getByLabel(slot, { exact: true }).selectOption(id); await ready(); };
  const screenshot = async name => page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  await screenshot('gatehouse');
  await go(8); await key('f'); await key('f'); await equip('胸甲', 'ironCuirass'); await go(10); await key('s');
  let budget = 15;
  while (!await page.getByRole('alert').count() && budget-- > 0) await key('a');
  if (!await page.getByRole('alert').count()) throw new Error('No natural guard windup');
  await screenshot('guard-windup');
  await go(3); for (let i = 0; i < 4; i++) await key('f');
  await equip('主手', 'mace'); await equip('副手', 'towerShield'); await equip('头部', 'ironHelm'); await screenshot('armory-equipped');
  await go(15); await key('f'); await equip('护腿', 'ironGreaves'); await go(17);
  await page.locator('canvas').focus(); await page.keyboard.press('s');
  await page.waitForFunction(() => Number(document.querySelector('canvas').dataset.phase) > .35); await screenshot('ladder'); await ready();
  await key('f'); await go(3); await key('f'); await screenshot('crypt-relic');
  await go(17); await key('w'); await key('s');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas'); window.dungeonSamples = [];
    window.dungeonObserver = new MutationObserver(() => {
      if (canvas.dataset.busy === 'true') window.dungeonSamples.push({ time: performance.now(), renderMs: Number(canvas.dataset.renderMs), calls: Number(canvas.dataset.drawCalls), triangles: Number(canvas.dataset.triangles), geometries: Number(canvas.dataset.geometries), limbError: Number(canvas.dataset.limbError), heap: performance.memory?.usedJSHeapSize ?? null });
    }); window.dungeonObserver.observe(canvas, { attributes: true, attributeFilter: ['data-render-ms'] });
  });
  await key('w');
  const measured = await page.evaluate(() => {
    window.dungeonObserver.disconnect(); const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { samples: window.dungeonSamples, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', userAgent: navigator.userAgent };
  });
  const summary = values => { const sorted = values.slice().sort((a,b)=>a-b); return { median: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.min(sorted.length-1, Math.floor(sorted.length*.95))], peak: sorted.at(-1) }; };
  const samples = measured.samples;
  const report = { date: new Date().toISOString(), build: 'production / dungeon.html', viewport: '1400x1100, DPR 1', scenario: 'one warmed 3s ascent, all three rooms explored on main/branch route, full iron gear + mace/tower shield, all enemies defeated', browser: measured.userAgent, gpu: measured.gpu, count: samples.length,
    cpuRenderMs: summary(samples.map(s=>s.renderMs)), sampleIntervalMs: summary(samples.slice(1).map((s,i)=>s.time-samples[i].time)), drawCalls: summary(samples.map(s=>s.calls)), triangles: summary(samples.map(s=>s.triangles)), geometries: summary(samples.map(s=>s.geometries)), maxAttachedLimbError: Math.max(...samples.map(s=>s.limbError)), jsHeapBytes: samples.every(s=>s.heap!==null) ? summary(samples.map(s=>s.heap)) : null,
    limitations: 'CPU render submission is not GPU completion; sample intervals include scheduling. JS heap excludes GPU memory. IK error covers attached traversal only, not approach/landing. No actual phone, hardware GPU or sustained memory acceptance.' };
  await go(10); await key('w'); await go(1); await screenshot('expedition-complete');
  if (!(await page.getByRole('status').textContent()).includes('探险成功')) throw new Error('Not won');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  report.acceptedActions = await page.evaluate(() => JSON.parse(localStorage.getItem('dungeon-descent.m02c')).history.length);
  report.errors = errors;
  await page.getByRole('button', { name: '重新开始', exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 }); await screenshot('mobile');
  await page.setViewportSize({ width: 844, height: 390 }); await page.getByRole('button', { name: 'EN', exact: true }).click(); await screenshot('mobile-landscape');
  report.landscapeFits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await writeFile(join(output, 'dungeon-profile.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (errors.length || !report.landscapeFits) throw new Error('Browser validation failed');
} finally { await browser.close(); }
