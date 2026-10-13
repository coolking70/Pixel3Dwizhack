import type { RunResult } from './types';
import { pairedDifference } from './report';
export interface ComparableRun extends RunResult { traceSha256: string }
const key = (r: RunResult) => JSON.stringify([r.config.seed,r.config.loadout,r.config.strategy,r.config.maxActions,r.config.maxTicks,r.config.stuckLimit,r.config.choiceSeed??null]);
function index(runs: ComparableRun[]) {
  const result = new Map<string,ComparableRun>();
  for(const r of runs){
    if(!/^[a-f0-9]{64}$/.test(r.traceSha256))throw new Error('Missing complete trace SHA-256');
    const k=key(r);if(result.has(k))throw new Error(`Duplicate configuration: ${k}`);result.set(k,r);
  }
  return result;
}
/** Full matrix comparison rejects missing/duplicate configuration, changed
 * strategy version and changed rule identity instead of silently pairing less. */
export function compareMatrices(baseline: ComparableRun[], candidate: ComparableRun[]) {
  if(!baseline.length)throw new Error('Empty baseline');
  const left=index(baseline),right=index(candidate);
  if(left.size!==right.size||[...left.keys()].some(k=>!right.has(k)))throw new Error('Different configuration matrices');
  const pairs=[...left].map(([k,a])=>{const b=right.get(k)!;
    if(a.agentVersion!==b.agentVersion)throw new Error('Different agent versions');
    if(a.identity.rules!==b.identity.rules||a.identity.commands!==b.identity.commands||a.identity.content!==b.identity.content)throw new Error('Different rule identities');
    return [a,b] as const;
  });
  const divergent=pairs.filter(([a,b])=>a.traceSha256!==b.traceSha256||a.finalDigest!==b.finalDigest||a.outcome!==b.outcome).map(([a,b])=>({config:a.config,before:{trace:a.traceSha256,digest:a.finalDigest,outcome:a.outcome},after:{trace:b.traceSha256,digest:b.finalDigest,outcome:b.outcome}}));
  const seeds=[...new Set(pairs.map(([a])=>a.config.seed))].sort((a,b)=>a-b);
  const clustered=(metric:(r:RunResult)=>number)=>{
    const deltas=seeds.map(seed=>{const block=pairs.filter(([a])=>a.config.seed===seed);return block.reduce((sum,[a,b])=>sum+metric(b)-metric(a),0)/block.length;});
    return {...pairedDifference(deltas.map(()=>0),deltas),pairedConfigurations:pairs.length,seedBlocks:seeds.length,unit:'mean paired difference across configurations within each seed'};
  };
  return {schema:1,pairs:pairs.length,seedBlocks:seeds.length,exactTraceAndDigestMatches:pairs.length-divergent.length,divergent,
    pairedWinDifference:clustered(r=>Number(r.outcome==='won')),
    pairedTickDifference:clustered(r=>r.ticks),
    note:'A trace SHA covers the ordered command/acceptance/rejection/tick/digest entries. Matrix equality is required, not inferred from equal aggregate win rates.'};
}
