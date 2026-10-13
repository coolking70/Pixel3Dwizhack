import { mkdir, readFile, writeFile, appendFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

const options = {}, supported = new Set(['seeds','seed-start','max-actions','max-ticks','stuck-limit','out','double-run','replay','probe','scenario','maps']);
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
  const files = (await Promise.all(['src/core','src/content','src/session','src/balance','src/balance4','src/balance5'].map(walk))).flat();
  files.push('scripts/balance-alpha4.mjs','package.json','package-lock.json');
  return Object.fromEntries(await Promise.all(files.sort().map(async file => [file, sha(await readFile(file))])));
}
function distribution(values) {
  const sorted = [...values].sort((a,b) => a-b), n = sorted.length;
  return n ? { samples:n, median: sorted[Math.floor(n/2)], p95: sorted[Math.ceil(n*.95)-1], max: sorted[n-1] } : null;
}
const count = integer('seeds',10,1000), start = integer('seed-start',1,0xffffffff), doubleRun = integer('double-run',0,1,0) === 1;
if (start + count - 1 > 0xffffffff) throw new Error('Seed range overflows');
const config = { maxActions:integer('max-actions',1800,4096), maxTicks:integer('max-ticks',30000,10000000), stuckLimit:integer('stuck-limit',96,4096),...(integer('probe',0,1,0)===1?{probe:true}:{}) };
const scenario = options.scenario ?? 'both'; if(!['alpha3','alpha4','alpha5','both'].includes(scenario))throw new Error('Invalid --scenario');
const maps = integer('maps',1000,10000,0);
const scenarios = scenario === 'both' ? ['alpha3','alpha4'] : [scenario];
const inputs = await manifest(), sourceSha256 = sha(JSON.stringify(inputs));
const server = await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom',logLevel:'error'});
try {
  const balance = await server.ssrLoadModule('/src/balance4/runner.ts');
  if (options.replay) {
    const bytes = await readFile(options.replay);
    if (bytes.length > 32_000_000) throw new Error('Replay file budget exceeded');
    const saved = JSON.parse(bytes.toString('utf8'));
    if (saved.sourceSha256 !== sourceSha256) throw new Error('Replay source manifest differs; refusing candidate identity');
    if (saved.traceSha256 !== sha(JSON.stringify(saved.run.trace))) throw new Error('Replay trace SHA-256 mismatch');
    const digest = balance.replayTrace4(saved.run);
    if (JSON.stringify(await manifest()) !== JSON.stringify(inputs)) throw new Error('Inputs changed while replaying');
    console.log(JSON.stringify({replay:options.replay,digest,attempts:saved.run.attempts,sourceSha256}));
  } else {
    const out = path.resolve(options.out ?? path.join(os.tmpdir(),'fallen-star-alpha4',new Date().toISOString().replaceAll(':','-')));
    await mkdir(path.dirname(out),{recursive:true}); await mkdir(out); await mkdir(path.join(out,'runs'));
    await writeFile(path.join(out,'inputs.json'),JSON.stringify({sourceSha256,inputs},null,2));
    const metadata = {schema:1,agentVersion:balance.agentVersion4(config),sourceSha256,node:process.version,platform:`${os.platform()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]?.model,concurrency:1,seedStart:start,seeds:count,games:count*9*scenarios.length,config,scenarios,doubleRun,startedAt:new Date().toISOString(),notes:'Node headless; each duration includes run and exact replay, plus optional second run. Heap/RSS sampled after each game, not peak memory. Sequential jobs, no browser-performance claim. Paired Alpha3/Alpha4 resource outcomes; no cross-identity digest comparison. Outcomes descriptive; nine configurations per seed are not independent seed samples.'};
    await writeFile(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
    if(maps){const audit=await server.ssrLoadModule('/src/balance4/distribution.ts');const {rows,...light}=audit.distribution4(maps,start);await writeFile(path.join(out,'maps.json'),JSON.stringify({sourceSha256,...light},null,2));await writeFile(path.join(out,'map-rows.json'),JSON.stringify(rows));}
    const pairs=[];
    const durations=[],heaps=[],rss=[],outcomes={},groups={}; let completed=0,adaptedThrows=0,actions=0,rejected=0,invalid=null,golden=null;
    const started=performance.now();
    try {
      for(let seed=start;seed<start+count;seed++)for(const loadout of ['vanguard','breaker','channeler'])for(const strategy of ['novice','survivor','fighter']) for(const scenario of scenarios) {
        const begin=performance.now(),run=balance.runGame4({seed,loadout,strategy,...config,scenario});
        const replayDigest=balance.replayTrace4(run);
        if(doubleRun && JSON.stringify(balance.runGame4(run.config))!==JSON.stringify(run))throw new Error(`Double run differed: ${seed}/${loadout}/${strategy}`);
        const durationMs=performance.now()-begin,traceSha256=sha(JSON.stringify(run.trace)),file=`runs/${scenario}-${seed}-${loadout}-${strategy}.json`;
        await writeFile(path.join(out,file),JSON.stringify({sourceSha256,traceSha256,durationMs,replayDigest,run}));
        const {trace,...light}=run; void trace;
        await appendFile(path.join(out,'index.jsonl'),JSON.stringify({...light,file,traceSha256,durationMs,replayDigest})+'\n');
        if(!golden&&['alpha4','alpha5'].includes(scenario)&&run.outcome==='won'&&run.trace.some(entry=>entry.accepted&&entry.command.startsWith(scenario==='alpha5'?'a5:jump:':'a3:throw:'))){
          await writeFile(path.join(out,`natural-${scenario}-won.json`),balance.captureTrace4(run));
          golden={file:`natural-${scenario}-won.json`,sourceRun:file,traceSha256,finalDigest:run.finalDigest,seed,loadout,strategy};
        }
        completed++;durations.push(durationMs);const memory=process.memoryUsage();heaps.push(memory.heapUsed);rss.push(memory.rss);
        outcomes[run.outcome]=(outcomes[run.outcome]??0)+1;const key=`${scenario}/${strategy}/${loadout}`,group=groups[key]??={games:0,outcomes:{},actions:0,rejected:0,adaptedThrows:0,resources:{},minHp:0,minFood:0};
        group.games++;group.outcomes[run.outcome]=(group.outcomes[run.outcome]??0)+1;group.actions+=run.actions;group.rejected+=run.rejected;group.adaptedThrows+=run.adaptedThrows;
        for(const [k,v]of Object.entries(run.resources))group.resources[k]=(group.resources[k]??0)+v;group.minHp+=run.minHp;group.minFood+=run.minFood;
        pairs.push({seed,loadout,strategy,scenario,won:Number(run.outcome==='won'),minHp:run.minHp,minFood:run.minFood,...run.resources});
        actions+=run.actions;rejected+=run.rejected;adaptedThrows+=run.adaptedThrows;
        if(run.outcome==='error')throw new Error(`Runner error ${file}: ${run.error}`);
        if(completed%90===0||completed===count*9*scenarios.length)console.log(`${completed}/${count*9*scenarios.length} games and exact replays completed`);
      }
    } catch(error) {invalid=error instanceof Error?error.message:String(error);}
    const paired=pairedSummary(pairs);await writeFile(path.join(out,'paired.json'),JSON.stringify(paired,null,2));
    const inputsUnchanged=JSON.stringify(await manifest())===JSON.stringify(inputs);
    if(!inputsUnchanged)invalid='Inputs changed during execution; results are not a frozen-candidate baseline';
    const summary={metadata:{...metadata,finishedAt:new Date().toISOString(),durationMs:performance.now()-started,inputsUnchanged,completed,valid:invalid===null,...(invalid?{error:invalid}:{})},outcomes,groups,paired,actions,rejected,adaptedThrows,golden,perGameMs:distribution(durations),sampledHeapBytes:distribution(heaps),sampledRssBytes:distribution(rss)};
    await writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
    await writeFile(path.join(out,'summary.md'),`# Frozen natural balance baseline\n\n${completed}/${count*9*scenarios.length} games; valid=${!invalid}; source ${sourceSha256}.\n\n\`\`\`json\n${JSON.stringify(summary,null,2)}\n\`\`\`\n`);
    console.log(JSON.stringify({out,completed,outcomes,adaptedThrows,valid:!invalid,durationMs:summary.metadata.durationMs,sourceSha256}));
    if(invalid)throw new Error(invalid);
  }
} finally {await server.close();}

function pairedSummary(rows){
 const seeds=[...new Set(rows.map(r=>r.seed))],metrics=['won','minHp','minFood','picked','healingAcquired','foodAcquired','healingDrinks','foodEaten','healingNet','foodNet','fullBoundaries','containersOpened','peakOrdinary','peakWeight'];
 const blocks=[];for(const seed of seeds){const a=rows.filter(r=>r.seed===seed&&r.scenario==='alpha3'),b=rows.filter(r=>r.seed===seed&&r.scenario==='alpha4');if(a.length!==9||b.length!==9)continue;blocks.push(Object.fromEntries(metrics.map(k=>[k,b.reduce((s,r)=>s+r[k],0)/9-a.reduce((s,r)=>s+r[k],0)/9])));}
 let rng=0x26ab51;const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return rng>>>0;};
 return {method:'alpha4 minus alpha3; nine paired configurations averaged inside each independent seed, then 2000 deterministic seed-block bootstrap replicates',independentSeeds:blocks.length,pairedConfigurations:blocks.length*9,metrics:Object.fromEntries(metrics.map(k=>{const n=blocks.length;if(!n)return[k,null];const samples=Array.from({length:2000},()=>Array.from({length:n},()=>blocks[random()%n][k]).reduce((a,b)=>a+b,0)/n).sort((a,b)=>a-b);return[k,{mean:blocks.reduce((s,b)=>s+b[k],0)/n,interval95:[samples[49],samples[1949]]}];}))};
}
