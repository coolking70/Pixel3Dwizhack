import type { RunConfig, RunResult } from './types';
import { experimentAgent } from './experiment-agent';
import { runGame } from './runner';
import { pairedDifference, summarize } from './report';
import { observeExperiment } from './experiment-observation';

export const EXPERIMENT_VERSION = 'm17-experiment-1';
export const INTERVENTIONS = ['explore', 'no-item-use', 'keep-starting-weapon'] as const;
export type Intervention = typeof INTERVENTIONS[number];
export interface ExperimentConfig { base: RunConfig; intervention: Intervention }
export interface ExperimentResult extends RunResult {
  experiment: { version: typeof EXPERIMENT_VERSION; intervention: Intervention; publicUnknownItems: number; publicAlternativeWeapons: number; rejectedInterventionCommands: number; acceptedWeaponChanges: number };
  observation?: ReturnType<typeof observeExperiment>;
}
export function observeResult(result:ExperimentResult):ExperimentResult {
  const observation=result.observation??observeExperiment(result);
  return {...result,observation,resources:{...result.resources,unknownHarmfulOutcomes:observation.coincidentHarm}};
}

export function runExperiment(config: ExperimentConfig): ExperimentResult {
  if (!INTERVENTIONS.includes(config.intervention)) throw new Error('Unknown intervention');
  const exposure = { unknown: new Set<number>(), weapons: new Set<number>() };
  const result = runGame(config.base, () => experimentAgent(config, exposure));
  return observeResult({ ...result, agentVersion: EXPERIMENT_VERSION, experiment: { version: EXPERIMENT_VERSION, intervention: config.intervention,
    publicUnknownItems: exposure.unknown.size, publicAlternativeWeapons: exposure.weapons.size,
    rejectedInterventionCommands: result.trace.filter(t => !t.accepted && t.command.startsWith('a2:use:')).length,
    acceptedWeaponChanges: result.trace.filter(t => t.accepted && t.command.startsWith('wear:') && exposure.weapons.has(Number(t.command.slice(5)))).length,
  } });
}

export function experimentSummary(runs: ExperimentResult[]) {
  runs=runs.map(observeResult);
  const groups = Object.fromEntries(INTERVENTIONS.map(arm => [arm, runs.filter(r => r.experiment.intervention === arm)]));
  const paired: Record<string, unknown> = {};
  for (const arm of INTERVENTIONS.slice(1)) {
    const pairs = groups.explore!.flatMap(a => { const b = groups[arm]!.find(r => JSON.stringify(r.config) === JSON.stringify(a.config)); return b ? [[a,b] as const] : []; });
    // All loadouts from the same map seed remain together in a bootstrap
    // block; 30 configurations here are only 10 independent seed draws.
    const clustered = (metric: (run: ExperimentResult) => number) => {
      const seeds=[...new Set(pairs.map(([a])=>a.config.seed))];
      const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
      return {...pairedDifference(seeds.map(seed=>mean(pairs.filter(([a])=>a.config.seed===seed).map(([a])=>metric(a)))),seeds.map(seed=>mean(pairs.filter(([a])=>a.config.seed===seed).map(([,b])=>metric(b))))),pairedConfigurations:pairs.length,seedBlocks:seeds.length,unit:'mean across matched loadouts within each seed'};
    };
    if (pairs.length) paired[`${arm} minus explore`] = {
      winDifference: clustered(r=>Number(r.outcome==='won')),
      hpDifference: clustered(r=>r.finalHp),
      ticksDifference: clustered(r=>r.ticks),
      exposedWeaponPairs: pairs.filter(([a,b]) => a.experiment.publicAlternativeWeapons > 0 && b.experiment.publicAlternativeWeapons > 0).length,
    };
  }
  return { version: EXPERIMENT_VERSION, arms: Object.fromEntries(Object.entries(groups).filter(([,r]) => r.length).map(([arm,r]) => { const summary=summarize(r); return [arm, { ...summary, limitations:summary.limitations.filter(text=>!text.startsWith('Current strategies do not experiment')), exposure: { unknown: r.filter(g => g.experiment.publicUnknownItems > 0).length, alternativeWeapon: r.filter(g => g.experiment.publicAlternativeWeapons > 0).length, unknownTrials: r.reduce((n,g) => n + g.resources.unknownUses, 0) } }]; })), paired,
    interpretation: 'Policy interventions use only owned/nearby public items through formal commands. They measure the whole policy restriction, including different paths, inventory pressure and opportunity exposure; not isolated hidden item effect strength. No unknown outcome is assigned causality. Zero exposure is not evidence of equivalence. Pooled Wilson intervals in arm summaries are descriptive only: configurations sharing one map seed are correlated. Main intervention conclusions use the paired seed-block bootstrap.' };
}
