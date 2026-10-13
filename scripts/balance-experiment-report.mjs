import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
const input=process.argv[2];if(!input)throw new Error('Usage: balance-experiment-report.mjs <experiment-runs.json>');
const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false,hmr:false,watch:null},appType:'custom',logLevel:'error'});
try{
 const {experimentSummary,observeResult}=await server.ssrLoadModule('/src/balance/experiments.ts');
 const {analyzeEvidence}=await server.ssrLoadModule('/src/balance/analysis.ts');
 const raw=JSON.parse(await readFile(input,'utf8')),runs=raw.runs.map(observeResult),metadata=raw.metadata,out=path.dirname(path.resolve(input)),summary=experimentSummary(runs);
 await writeFile(path.join(out,'observed-runs.json'),JSON.stringify({metadata,observationVersion:'m17-observation-1',runs}));
 const reportingSources=Object.fromEntries(await Promise.all(['src/balance/experiments.ts','src/balance/experiment-agent.ts','src/balance/experiment-observation.ts','src/balance/analysis.ts'].map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
 await writeFile(path.join(out,'summary.json'),JSON.stringify({metadata,reportingSources,...summary},null,2));
 await writeFile(path.join(out,'analysis.json'),JSON.stringify(Object.fromEntries(Object.keys(summary.arms).map(arm=>[arm,analyzeEvidence(runs.filter(r=>r.experiment.intervention===arm))])),null,2));
 const quote=x=>`"${String(x??'').replaceAll('"','""')}"`;
 const fields=['seed','loadout','strategy','agentVersion','intervention','outcome','actions','ticks','minHp','minFood','itemUses','unknownUses','unknownHarmfulOutcomes','publicAlternativeWeapons','acceptedWeaponChanges','finalDigest'];
 const csv=[fields.join(','),...runs.map(r=>{const row={...r,...r.config,...r.resources,...r.experiment};return fields.map(f=>quote(row[f])).join(',');})].join('\n')+'\n';
 await writeFile(path.join(out,'runs.csv'),csv);
 const lines=['# M17 public policy experiments','',`Version: ${summary.version}; ${runs.length} configurations; raw traces in runs.json. This is a limited policy sample, not human difficulty.`,'','| Arm | Games | Wins | Outcomes | Unknown trials | Alternative weapon exposure | Accepted weapon changes |','| --- | ---: | ---: | --- | ---: | ---: | ---: |'];
 for(const [arm,s]of Object.entries(summary.arms))lines.push(`| ${arm} | ${s.total.games} | ${s.total.wins} | ${JSON.stringify(s.total.outcomes)} | ${s.exposure.unknownTrials} | ${s.exposure.alternativeWeapon} | ${runs.filter(r=>r.experiment.intervention===arm).reduce((n,r)=>n+r.experiment.acceptedWeaponChanges,0)} |`);
 lines.push('','## Paired differences','','```json',JSON.stringify(summary.paired,null,2),'```','',summary.interpretation,'','`no-item-use` disables potion and every a2:use action, including food and scrolls; it is a policy/resource restriction, not removal of a hidden rule effect. `keep-starting-weapon` blocks changing main-hand weapons while retaining armor changes.','');
 await writeFile(path.join(out,'summary.md'),lines.join('\n'));
 console.log(`Reports regenerated from ${runs.length} actual results; no games rerun.`);
}finally{await server.close();}
