import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {experimentInputs,verifyExperimentInputs,manifestSha} from './balance-inputs.mjs';
import path from 'node:path';
const out=process.argv[2]&&path.resolve(process.argv[2]),seeds=Number(process.argv[3]??10);
if(!out||!Number.isSafeInteger(seeds)||seeds<1||seeds>100)throw new Error('Usage: balance-experiment.mjs <out> [seeds=10, max100]');
await mkdir(path.join(out,'failures'),{recursive:true});
const inputFiles=await experimentInputs();
const inputManifest={schema:1,createdAt:new Date().toISOString(),files:inputFiles};
await writeFile(path.join(out,'frozen-inputs.json'),JSON.stringify(inputManifest,null,2));
const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false,hmr:false,watch:null},appType:'custom',logLevel:'error'});
try{
 const {runExperiment,experimentSummary,INTERVENTIONS,EXPERIMENT_VERSION}=await server.ssrLoadModule('/src/balance/experiments.ts');
 const {analyzeEvidence}=await server.ssrLoadModule('/src/balance/analysis.ts');
 const {replayTrace}=await server.ssrLoadModule('/src/balance/runner.ts');
 const runs=[],started=Date.now();
 for(let seed=1;seed<=seeds;seed++)for(const loadout of ['vanguard','breaker','channeler'])for(const intervention of INTERVENTIONS){
  const result=runExperiment({base:{seed,strategy:'survivor',loadout,maxActions:1800,maxTicks:30000,stuckLimit:96},intervention});runs.push(result);
  if(result.outcome!=='won'){replayTrace(result);await writeFile(path.join(out,'failures',`${seed}-${loadout}-${intervention}.json`),JSON.stringify(result));}
 }
 const summary=experimentSummary(runs);
 await verifyExperimentInputs(inputFiles);
 const metadata={version:EXPERIMENT_VERSION,games:runs.length,seeds,durationMs:Date.now()-started,inputManifest:'frozen-inputs.json',sourceSha256:inputFiles,manifestSha256:manifestSha(inputFiles),inputsVerifiedUnchanged:true};
 await writeFile(path.join(out,'runs.json'),JSON.stringify({metadata,runs}));
 await writeFile(path.join(out,'summary.json'),JSON.stringify({metadata,...summary},null,2));
 await writeFile(path.join(out,'analysis.json'),JSON.stringify(Object.fromEntries(INTERVENTIONS.map(arm=>[arm,analyzeEvidence(runs.filter(r=>r.experiment.intervention===arm))])),null,2));
 console.log(JSON.stringify({out,...metadata,arms:Object.fromEntries(Object.entries(summary.arms).map(([arm,s])=>[arm,{outcomes:s.total.outcomes,unknownTrials:s.exposure.unknownTrials}]))}));
 if(runs.some(r=>r.outcome==='error'))process.exitCode=1;
}finally{await server.close();}
