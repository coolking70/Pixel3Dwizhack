import type { RunResult } from './types';
import { distribution, wilson } from './report';

export function analyzeEvidence(runs: RunResult[]) {
  const groups: Record<string, unknown> = {};
  for (const key of ['all', ...new Set(runs.map(r => `${r.config.loadout}/${r.config.strategy}`))]) {
    const selected = key === 'all' ? runs : runs.filter(r => `${r.config.loadout}/${r.config.strategy}` === key);
    if (!selected.length) continue;
    const resources = selected.map(r => r.resources), equipmentKeys = new Set(resources.flatMap(r => Object.keys(r.equipmentSelections)));
    const equipmentRates = Object.fromEntries([...equipmentKeys].sort().map(item => {
      const users = resources.filter(r => (r.equipmentSelections[item] ?? 0) > 0).length;
      return [item, { runsSelecting: users, denominator: selected.length, rate: users / selected.length, ci95: wilson(users, selected.length) }];
    }));
    const damageSources: Record<string, number> = {};
    for (const r of resources) for (const [source, amount] of Object.entries(r.damageSources)) damageSources[source] = (damageSources[source] ?? 0) + amount;
    const damageTotal = Object.values(damageSources).reduce((a,b) => a+b, 0);
    const unknownTrials = resources.reduce((n,r) => n+r.unknownUses, 0), itemUses = resources.reduce((n,r) => n+r.itemUses, 0);
    groups[key] = {
      games: selected.length,
      healingPerPositiveHealingAction: distribution(resources.flatMap(r => r.healingActions ? [r.healing/r.healingActions] : [])),
      healingActionCoverage: resources.filter(r => r.healingActions > 0).length,
      foodPressureActionFraction: distribution(selected.map(r => r.actions ? r.resources.foodPressureActions/r.actions : 0)),
      foodUsed: distribution(resources.map(r => r.foodUsed)), minFood: distribution(selected.map(r => r.minFood)),
      equipmentRates,
      damageShares: Object.fromEntries(Object.entries(damageSources).map(([source, damage]) => [source, { damage, share: damageTotal ? damage/damageTotal : 0 }])),
      unknownUse: { trials: unknownTrials, allItemUses: itemUses, fraction: itemUses ? unknownTrials/itemUses : null, coincidentHarm: resources.reduce((n,r) => n+r.unknownHarmfulOutcomes, 0) },
      failures: Object.fromEntries([...new Set(selected.filter(r => r.outcome !== 'won').map(r => r.outcome))].map(outcome => [outcome, selected.filter(r => r.outcome === outcome).map(r => ({ seed:r.config.seed, loadout:r.config.loadout, strategy:r.config.strategy, digest:r.finalDigest, depth:r.finalDepth, cause:r.deathCause }))])),
      depthRisk: Array.from({length:6},(_,depth)=>{ const entered=selected.filter(r=>r.reachedDepths.includes(depth)),deaths=entered.filter(r=>r.outcome==='dead'&&r.finalDepth===depth).length,censored=entered.filter(r=>!['won','dead'].includes(r.outcome)).length;return {depth,entered:entered.length,deaths,censoredRuns:censored,risk:entered.length?deaths/entered.length:null,ci95:entered.length?wilson(deaths,entered.length):null}; }),
    };
  }
  return { schema: 1, groups, limitations: ['Healing efficiency is observed HP restored per positive healing action, including fountains; not hidden theoretical potion potency.', 'Food pressure counts observations <=25% public maximum food before a command.', 'Equipment rate is fraction of runs selecting an item at least once; starting loadout selections included.', 'Unknown coincident harm is not causal attribution.', 'Depth risk denominator is runs entering that depth, with unfinished runs explicitly censored; not a human survival estimate.', 'Failure lists are diagnostics, not proof of a rule defect. Use raw trace replay before root-cause claims.'] };
}
