import { readFile } from 'node:fs/promises';
import { loadBalance } from './balance-load.mjs';
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/balance-replay.mjs <failure.json>');
const trace = JSON.parse(await readFile(file, 'utf8')), balance = await loadBalance();
try { console.log(JSON.stringify({ verified: true, attempts: trace.trace.length, digest: balance.replayTrace(trace), outcome: trace.outcome })); }
finally { await balance.close(); }
