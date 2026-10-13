import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { loadBalance } from './balance-load.mjs';
const balance = await loadBalance();
parentPort.on('message', async job => {
  if (job === null) { await balance.close(); parentPort.close(); return; }
  const start = performance.now();
  try { const result = balance.runGame(job.config); parentPort.postMessage({ index: job.index, result, durationMs: performance.now() - start, heapUsed: process.memoryUsage().heapUsed }); }
  catch (error) { parentPort.postMessage({ index: job.index, fatal: String(error) }); }
});
parentPort.postMessage({ ready: true });
