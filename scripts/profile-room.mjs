// Local production-browser sample, not a GPU benchmark or phone acceptance.
// Usage: node scripts/profile-room.mjs <external-output-directory>
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
if (!process.argv[2]) throw new Error('Pass an output directory for screenshots and measurements');
const output = resolve(process.argv[2]); await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  await page.goto('http://127.0.0.1:4173/room.html'); await page.locator('[data-state=ready]').waitFor();
  const ready = () => page.waitForFunction(() => document.querySelector('canvas').dataset.busy === 'false');
  const key = async value => { await page.locator('canvas').focus(); await page.keyboard.press(value); await ready(); };
  const x = async () => Number((await page.getByTestId('room-position').textContent()).split('·')[1]);
  const go = async target => { let budget = 30; while (await x() !== target && budget-- > 0) await key(await x() < target ? 'd' : 'a'); if (await x() !== target) throw new Error('route failed'); };
  await go(6); await key('f'); await page.getByLabel('胸甲', { exact: true }).selectOption('ironCuirass'); await ready();
  await key('f'); await page.getByLabel('护腿', { exact: true }).selectOption('ironGreaves'); await ready();
  await go(8); await page.locator('canvas').focus(); await page.keyboard.press('w');
  await page.waitForFunction(() => Number(document.querySelector('canvas').dataset.phase) >= .3);
  await page.screenshot({ path: join(output, 'room-climbing.png') }); await ready();
  await key('f'); await page.getByLabel('头部', { exact: true }).selectOption('ironHelm'); await ready();
  await page.screenshot({ path: join(output, 'room-equipped.png') });
  await key('s');
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas'); window.roomSamples = [];
    window.roomObserver = new MutationObserver(() => {
      if (canvas.dataset.busy === 'true') window.roomSamples.push({ time: performance.now(), renderMs: Number(canvas.dataset.renderMs), calls: Number(canvas.dataset.drawCalls), triangles: Number(canvas.dataset.triangles), geometries: Number(canvas.dataset.geometries), limbError: Number(canvas.dataset.limbError), heap: performance.memory?.usedJSHeapSize ?? null });
    }); window.roomObserver.observe(canvas, { attributes: true, attributeFilter: ['data-render-ms'] });
  });
  await key('w');
  const measured = await page.evaluate(() => {
    window.roomObserver.disconnect();
    const gl = document.querySelector('canvas').getContext('webgl2'), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { samples: window.roomSamples, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', userAgent: navigator.userAgent };
  });
  const summary = values => { const sorted = values.slice().sort((a,b)=>a-b); return { median: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))], peak: sorted.at(-1) }; };
  const samples = measured.samples;
  const report = { date: new Date().toISOString(), build: 'production / room.html', viewport: '1400x1100, DPR 1', scenario: 'one warmed ascent, full iron gear, explored two floors, no live enemy', browser: measured.userAgent, gpu: measured.gpu, count: samples.length,
    cpuRenderMs: summary(samples.map(s=>s.renderMs)), sampleIntervalMs: summary(samples.slice(1).map((s,i)=>s.time-samples[i].time)), drawCalls: summary(samples.map(s=>s.calls)), triangles: summary(samples.map(s=>s.triangles)), geometries: summary(samples.map(s=>s.geometries)), maxLimbError: Math.max(...samples.map(s=>s.limbError)), jsHeapBytes: samples.every(s=>s.heap!==null) ? summary(samples.map(s=>s.heap)) : null,
    limitations: 'Headless desktop Chromium only. renderMs measures CPU renderer submission, not GPU completion. Intervals include scheduler stalls. JS heap is not GPU memory. No device performance guarantee.' };
  await writeFile(join(output, 'room-profile.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  await go(11); await page.screenshot({ path: join(output, 'room-complete.png') });
  await page.getByRole('button', { name: '重新开始', exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'room-mobile.png'), fullPage: true });
} finally { await browser.close(); }
