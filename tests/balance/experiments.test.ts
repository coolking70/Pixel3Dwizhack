import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runExperiment,experimentSummary,EXPERIMENT_VERSION} from '../../src/balance/experiments';
import {replayTrace} from '../../src/balance/runner';
import {analyzeEvidence} from '../../src/balance/analysis';
import {compareMatrices} from '../../src/balance/compare';
import {harmfulChange} from '../../src/balance/experiment-observation';

const base={seed:42,strategy:'survivor' as const,loadout:'channeler' as const,maxActions:1800,maxTicks:30000,stuckLimit:96};
describe('M17 independent public experiments',()=>{
 it('preserves frozen M16 policy and runner bytes',()=>{
  expect(createHash('sha256').update(readFileSync('src/balance/agents.ts')).digest('hex')).toBe('8c698fbd62616c57eb2498026c23f010bb3e6bcade71874ef9e0589525067744');
  expect(createHash('sha256').update(readFileSync('src/balance/runner.ts')).digest('hex')).toBe('3410678033c4ae9614761601ea257b513e3e30764f9200dbe5b33665552ea5a1');
 });
 it('naturally tries unknown items, repeats every command/digest and replays',()=>{
  const a=runExperiment({base,intervention:'explore'}),b=runExperiment({base,intervention:'explore'});
  expect(a).toEqual(b);expect(a.agentVersion).toBe(EXPERIMENT_VERSION);expect(a.outcome).not.toBe('error');
  expect(a.experiment.publicUnknownItems).toBeGreaterThan(0);expect(a.resources.unknownUses).toBeGreaterThan(0);
  expect(replayTrace(a)).toBe(a.finalDigest);
 },120000);
 it('restrictions are formal command policy changes without resource injection',()=>{
  const noItems=runExperiment({base,intervention:'no-item-use'}),keep=runExperiment({base,intervention:'keep-starting-weapon'});
  expect(noItems.trace.some(t=>t.accepted&&(t.command==='potion'||t.command.startsWith('a2:use:')))).toBe(false);
  expect(keep.experiment.acceptedWeaponChanges).toBe(0);
  for(const r of [noItems,keep]){expect(r.outcome).not.toBe('error');expect(replayTrace(r)).toBe(r.finalDigest);}
  const summary=experimentSummary([noItems,keep]);expect(summary.arms['no-item-use']!.total.games).toBe(1);
  expect(summary.arms['keep-starting-weapon']!.limitations.some(s=>s.startsWith('Current strategies do not experiment'))).toBe(false);
 },120000);
 it('analysis keeps absent treatment exposure and censored failure denominators explicit',()=>{
  const result=runExperiment({base:{...base,maxActions:2},intervention:'explore'});
  const analysis=analyzeEvidence([result]);
  expect(JSON.stringify(analysis)).toContain('censoredRuns');expect(JSON.stringify(analysis)).toContain('action-limit');
  expect(analysis.limitations.some(s=>s.includes('not causal'))).toBe(true);
 });
 it('full matrix comparison refuses missing/duplicate pairs and detects changed trace despite equal aggregate outcome',()=>{
  const result=runExperiment({base:{...base,maxActions:2},intervention:'explore'});
  const a={...result,traceSha256:createHash('sha256').update(JSON.stringify(result.trace)).digest('hex')};
  expect(compareMatrices([a],[a]).exactTraceAndDigestMatches).toBe(1);
  expect(compareMatrices([a],[{...a,traceSha256:'0'.repeat(64)}]).divergent).toHaveLength(1);
  expect(()=>compareMatrices([a],[])).toThrow('Different configuration');
  expect(()=>compareMatrices([a],[a,a])).toThrow('Duplicate');
  expect(()=>compareMatrices([a],[{...a,agentVersion:'other'}])).toThrow('agent versions');
 });
 it('unknown item observation does not mislabel beneficial status as harm',()=>{
  expect(harmfulChange(80,80,[],[{kind:'ward'}])).toBe(false);
  expect(harmfulChange(80,80,[],[{kind:'light'}])).toBe(false);
  expect(harmfulChange(80,80,[],[{kind:'poison'}])).toBe(true);
  expect(harmfulChange(80,79,[],[{kind:'ward'}])).toBe(true);
 });
 it('repeating loadouts within one seed does not inflate independent matrix samples',()=>{
  const result=runExperiment({base:{...base,maxActions:2},intervention:'explore'});
  const a={...result,traceSha256:'a'.repeat(64)};
  const left=[1,2,3,4].map(seed=>({...a,config:{...a.config,seed}}));
  const right=left.map((r,i)=>({...r,ticks:r.ticks+[0,10,-10,30][i]!}));
  const original=compareMatrices(left,right);
  const repeat=(rows:typeof left)=>rows.flatMap(r=>(['vanguard','breaker','channeler'] as const).map(loadout=>({...r,config:{...r.config,loadout}})));
  const repeated=compareMatrices(repeat(left),repeat(right));
  expect(repeated.pairs).toBe(12);expect(repeated.seedBlocks).toBe(4);
  expect(repeated.pairedTickDifference.meanDifference).toEqual(original.pairedTickDifference.meanDifference);
  expect(repeated.pairedTickDifference.ci95).toEqual(original.pairedTickDifference.ci95);
 });
});
