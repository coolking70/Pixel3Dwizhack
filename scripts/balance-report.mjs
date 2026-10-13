import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadBalance } from './balance-load.mjs';
const file = process.argv[2], baselineFile = process.argv[3];
if (!file) throw new Error('Usage: node scripts/balance-report.mjs <runs.json> [baseline-runs.json]');
const { runs, metadata } = JSON.parse(await readFile(file, 'utf8'));
const baseline = baselineFile ? JSON.parse(await readFile(baselineFile, 'utf8')).runs : undefined;
const balance = await loadBalance();
try {
  const summary = balance.summarize(runs, baseline), out = path.dirname(path.resolve(file));
  await writeFile(path.join(out, 'summary.json'), JSON.stringify({ metadata, ...summary }, null, 2));
  await writeFile(path.join(out, 'summary.md'), balance.reportMarkdown(summary));
  await writeFile(path.join(out, 'runs.csv'), balance.reportCsv(runs));
  console.log(`Regenerated ${out}`);
} finally { await balance.close(); }
