import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { loadBalance } from './balance-load.mjs';

// Batches are independent formal new games; only compact summaries remain in
// memory between batches. Completed traces survive a later batch failure.
const out = process.argv[2] && path.resolve(process.argv[2]);
const totalSeeds = Number(process.argv[3] ?? 1000), concurrency = Number(process.argv[4] ?? 6), batchSize = Number(process.argv[5] ?? 100);
if (!out || ![totalSeeds, concurrency, batchSize].every(Number.isSafeInteger) || totalSeeds < 1 || totalSeeds > 1000 || concurrency < 1 || concurrency > 8 || batchSize < 1 || batchSize > 100) throw new Error('Usage: balance-milestone.mjs <out> [seeds=1000] [concurrency=6] [batch-seeds=100]');
await mkdir(out, { recursive: true });
const frozen = [];
for (const dir of ['src/core', 'src/content', 'src/session', 'src/balance']) for (const name of (await readdir(dir)).filter(n => n.endsWith('.ts')).sort()) frozen.push(`${dir}/${name}`);
for (const name of ['balance-run.mjs','balance-worker.mjs','balance-load.mjs','balance-milestone.mjs']) frozen.push(`scripts/${name}`);
const sha = text => createHash('sha256').update(text).digest('hex');
const files = Object.fromEntries(await Promise.all(frozen.map(async file => [file, sha(await readFile(file))])));
const manifest = { agentVersion: 'm16-public-1', configuration: { seedStart: 1, totalSeeds, games: totalSeeds * 9, maxActions: 1800, maxTicks: 30000, stuckLimit: 96, concurrency, batchSize }, files };
await writeFile(path.join(out, 'frozen-inputs.json'), JSON.stringify(manifest, null, 2));
async function verifyFrozen() { for (const [file, expected] of Object.entries(files)) if (sha(await readFile(file)) !== expected) throw new Error(`Frozen source changed: ${file}`); }
const compact = [], batches = [], started = Date.now();
for (let seed = 1; seed <= totalSeeds; seed += batchSize) {
  await verifyFrozen();
  const count = Math.min(batchSize, totalSeeds - seed + 1), folder = `seeds-${seed}-${seed + count - 1}`, destination = path.join(out, folder);
  await mkdir(destination, { recursive: true });
  let log = '';
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/balance-run.mjs','--seeds',String(count),'--seed-start',String(seed),'--concurrency',String(concurrency),'--out',destination], { cwd: process.cwd(), windowsHide: true });
    child.stdout.on('data', data => { log += data.toString(); }); child.stderr.on('data', data => { log += data.toString(); });
    child.on('error', reject); child.on('exit', async code => { await writeFile(path.join(destination, 'execution.log'), log); code === 0 ? resolve() : reject(new Error(`Batch ${folder} failed: ${code}; see execution.log`)); });
  });
  await verifyFrozen();
  const { runs, metadata } = JSON.parse(await readFile(path.join(destination, 'runs.json'), 'utf8'));
  if (runs.length !== count * 9) throw new Error(`Incomplete batch ${folder}`);
  for (const run of runs) { const { trace, ...result } = run; compact.push({ ...result, trace: [], traceSha256: sha(JSON.stringify(trace)), rawBatch: `${folder}/runs.json` }); }
  batches.push({ folder, metadata });
  await writeFile(path.join(out, 'progress.json'), JSON.stringify({ complete: false, completed: compact.length, total: totalSeeds * 9, batches }, null, 2));
  console.log(`Completed ${folder}: ${runs.length} formal games; ${compact.length}/${totalSeeds * 9}`);
}
const balance = await loadBalance();
try {
  const summary = balance.summarize(compact);
  const metadata = { agentVersion: 'm16-public-1', manifestSha256: sha(JSON.stringify(manifest)), games: compact.length, durationMs: Date.now() - started, batches, traceStorage: 'Per-batch runs.json contains every formal command. summary-runs.json is aggregate metadata, not a replay archive.' };
  await writeFile(path.join(out, 'summary-runs.json'), JSON.stringify({ metadata, runs: compact }));
  await writeFile(path.join(out, 'summary.json'), JSON.stringify({ metadata, ...summary }, null, 2));
  await writeFile(path.join(out, 'summary.md'), balance.reportMarkdown(summary));
  await writeFile(path.join(out, 'runs.csv'), balance.reportCsv(compact));
  await writeFile(path.join(out, 'progress.json'), JSON.stringify({ complete: true, completed: compact.length, total: totalSeeds * 9, outcomes: summary.total.outcomes }, null, 2));
  console.log(JSON.stringify({ complete: true, out, games: compact.length, outcomes: summary.total.outcomes, durationMs: metadata.durationMs }));
} finally { await balance.close(); }
