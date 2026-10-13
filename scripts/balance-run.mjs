import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { loadBalance } from './balance-load.mjs';

const args = process.argv.slice(2), options = {};
const supported = new Set(['preset', 'seeds', 'seed-start', 'max-actions', 'max-ticks', 'stuck-limit', 'concurrency', 'out', 'baseline']);
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, '');
  if (!supported.has(key) || !args[i + 1]) throw new Error(`Expected --option value; unknown/incomplete ${args[i]}`);
  options[key] = args[i + 1];
}
const presets = { smoke: 10, nightly: 100, milestone: 1000 }, preset = options.preset ?? 'smoke';
if (!(preset in presets)) throw new Error(`Unknown preset ${preset}`);
function integer(key, fallback, maximum) { const n = Number(options[key] ?? fallback); if (!Number.isSafeInteger(n) || n < 1 || n > maximum) throw new Error(`Invalid --${key}`); return n; }
const count = integer('seeds', presets[preset], 1000), startSeed = integer('seed-start', 1, 0xffffffff), concurrency = integer('concurrency', 1, 8);
if (startSeed + count - 1 > 0xffffffff) throw new Error('Seed range overflows');
const shared = { maxActions: integer('max-actions', 1800, 4096), maxTicks: integer('max-ticks', 30000, 10000000), stuckLimit: integer('stuck-limit', 96, 4096) };
const out = path.resolve(options.out ?? path.join(os.tmpdir(), 'fallen-star-m16-balance', `${preset}-${new Date().toISOString().replaceAll(':', '-')}`));
const jobs = [];
for (let seed = startSeed; seed < startSeed + count; seed++) for (const loadout of ['vanguard', 'breaker', 'channeler']) for (const strategy of ['novice', 'survivor', 'fighter']) jobs.push({ seed, loadout, strategy, ...shared });
await mkdir(path.join(out, 'failures'), { recursive: true });
// Freeze a reproducibility identity of actual simulation/strategy inputs before running.
const hash = createHash('sha256');
async function hashTree(directory) { for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
  const file = path.join(directory, entry.name); if (entry.isDirectory()) await hashTree(file); else if (file.endsWith('.ts')) { hash.update(file.replaceAll('\\', '/')); hash.update(await readFile(file)); }
} }
for (const directory of ['src/core', 'src/content', 'src/session', 'src/balance']) await hashTree(directory);
const sourceSha256 = hash.digest('hex'), balance = await loadBalance(), results = new Array(jobs.length), timings = [], memory = [], started = performance.now();
let completed = 0;
function accept(index, result, durationMs, heapUsed) {
  results[index] = result; timings.push(durationMs); memory.push(heapUsed); completed++;
  if (completed % 9 === 0 || completed === jobs.length) console.log(`${completed}/${jobs.length} games; last=${result.config.seed}/${result.config.loadout}/${result.config.strategy}:${result.outcome}`);
}
try {
  if (concurrency === 1) {
    for (let index = 0; index < jobs.length; index++) { const begin = performance.now(); const result = balance.runGame(jobs[index]); accept(index, result, performance.now() - begin, process.memoryUsage().heapUsed); }
  } else {
    let next = 0;
    const workers = [];
    try {
      await Promise.all(Array.from({ length: concurrency }, () => new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./balance-worker.mjs', import.meta.url)); workers.push(worker);
        const dispatch = () => { if (next >= jobs.length) worker.postMessage(null); else { const index = next++; worker.postMessage({ index, config: jobs[index] }); } };
        worker.on('error', reject); worker.on('exit', code => code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`)));
        worker.on('message', message => {
          if (message.fatal) { reject(new Error(message.fatal)); return; }
          if (!message.ready) accept(message.index, message.result, message.durationMs, message.heapUsed);
          dispatch();
        });
      })));
    } finally { await Promise.all(workers.map(w => w.terminate())); }
  }
  const baseline = options.baseline ? JSON.parse(await readFile(options.baseline, 'utf8')).runs : undefined;
  const summary = balance.summarize(results, baseline);
  const metadata = { preset, sourceSha256, node: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model, concurrency, games: results.length, durationMs: performance.now() - started, perGameMs: balance.distribution(timings), workerHeapBytes: balance.distribution(memory), notes: 'Node headless throughput; heap sampled after each game, not peak process RSS/GPU memory; includes deterministic trace/digest costs.' };
  const failures = results.filter(r => r.outcome !== 'won');
  await writeFile(path.join(out, 'runs.json'), JSON.stringify({ metadata, runs: results }));
  await writeFile(path.join(out, 'runs.csv'), balance.reportCsv(results));
  await writeFile(path.join(out, 'summary.json'), JSON.stringify({ metadata, ...summary }, null, 2));
  await writeFile(path.join(out, 'summary.md'), balance.reportMarkdown(summary) + `\nNode timing/memory (not browser performance):\n\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n`);
  const failureIndex = [];
  for (const result of failures) {
    const filename = `${result.config.seed}-${result.config.loadout}-${result.config.strategy}.json`;
    await writeFile(path.join(out, 'failures', filename), JSON.stringify(result));
    failureIndex.push({ seed: result.config.seed, loadout: result.config.loadout, strategy: result.config.strategy, outcome: result.outcome, replay: `node scripts/balance-replay.mjs "${path.join(out, 'failures', filename)}"` });
  }
  await writeFile(path.join(out, 'failures.json'), JSON.stringify(failureIndex, null, 2));
  console.log(JSON.stringify({ out, games: results.length, outcomes: summary.total.outcomes, sourceSha256, durationMs: metadata.durationMs }));
  if (results.some(r => r.outcome === 'error')) process.exitCode = 1;
} finally { await balance.close(); }
