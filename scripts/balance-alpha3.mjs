import { mkdir, readFile, writeFile, appendFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const options = {}, supported = new Set(['seeds','seed-start','max-actions','max-ticks','stuck-limit','out','double-run','replay','probe']);
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, '');
  if (!supported.has(key) || !process.argv[i + 1] || Object.hasOwn(options, key)) throw new Error(`Unknown, repeated or incomplete option ${process.argv[i]}`);
  options[key] = process.argv[i + 1];
}
function integer(key, fallback, maximum, minimum = 1) {
  const n = Number(options[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < minimum || n > maximum) throw new Error(`Invalid --${key}`);
  return n;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function manifest() {
  async function walk(dir) {
    const files = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) files.push(...await walk(file)); else if (/\.(ts|json)$/.test(file)) files.push(file);
    }
    return files;
  }
  const files = (await Promise.all(['src/core','src/content','src/session','src/balance','src/balance3'].map(walk))).flat();
  files.push('scripts/balance-alpha3.mjs','package.json','package-lock.json');
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha(await readFile(file))])));
}
function distribution(values) {
  const sorted = [...values].sort((a,b) => a-b), n = sorted.length;
  return n ? { samples:n, median: sorted[Math.floor(n/2)], p95: sorted[Math.ceil(n*.95)-1], max: sorted[n-1] } : null;
}
const count = integer('seeds',10,1000), start = integer('seed-start',1,0xffffffff), doubleRun = integer('double-run',0,1,0) === 1;
if (start + count - 1 > 0xffffffff) throw new Error('Seed range overflows');
const config = { maxActions:integer('max-actions',1800,4096), maxTicks:integer('max-ticks',30000,10000000), stuckLimit:integer('stuck-limit',96,4096),...(integer('probe',0,1,0)===1?{probe:true}:{}) };
const inputs = await manifest(), sourceSha256 = sha(JSON.stringify(inputs));
const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
try {
  const balance = await server.ssrLoadModule('/src/balance3/runner.ts');
  if (options.replay) {
    const bytes = await readFile(options.replay);
    if (bytes.length > 32_000_000) throw new Error('Replay file budget exceeded');
    const saved = JSON.parse(bytes.toString('utf8'));
    if (saved.sourceSha256 !== sourceSha256) throw new Error('Replay source manifest differs; refusing candidate identity');
    if (saved.traceSha256 !== sha(JSON.stringify(saved.run.trace))) throw new Error('Replay trace SHA-256 mismatch');
    const digest = balance.replayTrace3(saved.run);
    if (JSON.stringify(await manifest()) !== JSON.stringify(inputs)) throw new Error('Inputs changed while replaying');
    console.log(JSON.stringify({replay:options.replay,digest,attempts:saved.run.attempts,sourceSha256}));
  } else {
    const out = path.resolve(options.out ?? path.join(os.tmpdir(),'fallen-star-alpha3',new Date().toISOString().replaceAll(':','-')));
    await mkdir(path.dirname(out),{recursive:true}); await mkdir(out); await mkdir(path.join(out,'runs'));
    await writeFile(path.join(out,'inputs.json'),JSON.stringify({sourceSha256,inputs},null,2));
    const metadata = {schema:1,agentVersion:balance.agentVersion3(config),sourceSha256,node:process.version,platform:`${os.platform()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]?.model,concurrency:1,seedStart:start,seeds:count,games:count*9,config,doubleRun,startedAt:new Date().toISOString(),notes:'Node headless; each duration includes run and exact replay, plus optional second run. Heap/RSS sampled after each game, not peak memory. Sequential jobs, no browser-performance claim. New-rule baseline; no comparison with Alpha 2 digests. Outcomes descriptive; nine configurations per seed are not independent seed samples.'};
    await writeFile(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
    const durations=[],heaps=[],rss=[],outcomes={},groups={}; let completed=0,adaptedThrows=0,actions=0,rejected=0,invalid=null,golden=null;
    const started=performance.now();
    try {
      for(let seed=start;seed<start+count;seed++)for(const loadout of ['vanguard','breaker','channeler'])for(const strategy of ['novice','survivor','fighter']) {
        const begin=performance.now(),run=balance.runGame3({seed,loadout,strategy,...config});
        const replayDigest=balance.replayTrace3(run);
        if(doubleRun && JSON.stringify(balance.runGame3(run.config))!==JSON.stringify(run))throw new Error(`Double run differed: ${seed}/${loadout}/${strategy}`);
        const durationMs=performance.now()-begin,traceSha256=sha(JSON.stringify(run.trace)),file=`runs/${seed}-${loadout}-${strategy}.json`;
        await writeFile(path.join(out,file),JSON.stringify({sourceSha256,traceSha256,durationMs,replayDigest,run}));
        const {trace,...light}=run; void trace;
        await appendFile(path.join(out,'index.jsonl'),JSON.stringify({...light,file,traceSha256,durationMs,replayDigest})+'\n');
        if(!golden&&run.outcome==='won'&&run.trace.some(entry=>entry.accepted&&entry.command.startsWith('a3:throw:'))){
          await writeFile(path.join(out,'natural-alpha3-won.json'),balance.captureTrace3(run));
          golden={file:'natural-alpha3-won.json',sourceRun:file,traceSha256,finalDigest:run.finalDigest,seed,loadout,strategy};
        }
        completed++;durations.push(durationMs);const memory=process.memoryUsage();heaps.push(memory.heapUsed);rss.push(memory.rss);
        outcomes[run.outcome]=(outcomes[run.outcome]??0)+1;const key=`${strategy}/${loadout}`,group=groups[key]??={games:0,outcomes:{},actions:0,rejected:0,adaptedThrows:0};
        group.games++;group.outcomes[run.outcome]=(group.outcomes[run.outcome]??0)+1;group.actions+=run.actions;group.rejected+=run.rejected;group.adaptedThrows+=run.adaptedThrows;
        actions+=run.actions;rejected+=run.rejected;adaptedThrows+=run.adaptedThrows;
        if(run.outcome==='error')throw new Error(`Runner error ${file}: ${run.error}`);
        if(completed%90===0||completed===count*9)console.log(`${completed}/${count*9} games and exact replays completed`);
      }
    } catch(error) {invalid=error instanceof Error?error.message:String(error);}
    const inputsUnchanged=JSON.stringify(await manifest())===JSON.stringify(inputs);
    if(!inputsUnchanged)invalid='Inputs changed during execution; results are not a frozen-candidate baseline';
    const summary={metadata:{...metadata,finishedAt:new Date().toISOString(),durationMs:performance.now()-started,inputsUnchanged,completed,valid:invalid===null,...(invalid?{error:invalid}:{})},outcomes,groups,actions,rejected,adaptedThrows,golden,perGameMs:distribution(durations),sampledHeapBytes:distribution(heaps),sampledRssBytes:distribution(rss)};
    await writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
    await writeFile(path.join(out,'summary.md'),`# Alpha 3 independent balance baseline\n\n${completed}/${count*9} games; valid=${!invalid}; source ${sourceSha256}.\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`);
    console.log(JSON.stringify({out,completed,outcomes,adaptedThrows,valid:!invalid,durationMs:summary.metadata.durationMs,sourceSha256}));
    if(invalid)throw new Error(invalid);
  }
} finally {await server.close();}
