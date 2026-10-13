import { choiceRandom } from './agents';
import type { RunResult } from './types';

export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * q;
  return sorted[Math.floor(index)]! + (sorted[Math.ceil(index)]! - sorted[Math.floor(index)]!) * (index % 1);
}
export function distribution(values: number[]) { return { median: quantile(values, 0.5), p95: quantile(values, 0.95), peak: values.length ? Math.max(...values) : null }; }
export function wilson(wins: number, total: number): [number, number] {
  if (!total) return [0, 1];
  const z = 1.959963984540054, p = wins / total, denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator, half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return [wins === 0 ? 0 : Math.max(0, center - half), wins === total ? 1 : Math.min(1, center + half)];
}
export function pairedDifference(left: number[], right: number[], samples = 2000) {
  if (!left.length || left.length !== right.length) throw new Error('Paired samples require equal nonempty lists');
  const delta = right.map((value, i) => value - left[i]!), random = choiceRandom(0x16a), means: number[] = [];
  for (let s = 0; s < samples; s++) { let sum = 0; for (let i = 0; i < delta.length; i++) sum += delta[random() % delta.length]!; means.push(sum / delta.length); }
  return { pairs: delta.length, meanDifference: delta.reduce((a, b) => a + b, 0) / delta.length, ci95: [quantile(means, 0.025), quantile(means, 0.975)], method: `paired percentile bootstrap; ${samples} resamples; fixed seed 362` };
}
function count(values: string[]) { const out: Record<string, number> = {}; for (const value of values) out[value] = (out[value] ?? 0) + 1; return out; }
function group(runs: RunResult[]) {
  const wins = runs.filter(r => r.outcome === 'won').length;
  const sums = (field: 'damageSources' | 'equipmentSelections') => { const result: Record<string, number> = {}; for (const r of runs) for (const [key, n] of Object.entries(r.resources[field])) result[key] = (result[key] ?? 0) + n; return result; };
  return {
    games: runs.length, wins, winRate: wins / runs.length, winCI95: wilson(wins, runs.length), outcomes: count(runs.map(r => r.outcome)),
    deathCauses: count(runs.flatMap(r => r.deathCause ? [r.deathCause] : [])),
    actions: distribution(runs.map(r => r.actions)), ticks: distribution(runs.map(r => r.ticks)), minHp: distribution(runs.map(r => r.minHp)),
    minFood: distribution(runs.map(r => r.minFood)), healing: distribution(runs.map(r => r.resources.healing)), foodUsed: distribution(runs.map(r => r.resources.foodUsed)),
    healingPerAction: distribution(runs.flatMap(r => r.resources.healingActions ? [r.resources.healing / r.resources.healingActions] : [])),
    foodPressureActions: distribution(runs.map(r => r.resources.foodPressureActions)), itemUses: distribution(runs.map(r => r.resources.itemUses)),
    unknownUses: runs.reduce((n, r) => n + r.resources.unknownUses, 0), unknownHarmfulOutcomes: runs.reduce((n, r) => n + r.resources.unknownHarmfulOutcomes, 0),
    goldSpent: distribution(runs.map(r => r.resources.goldSpent)), goldEarned: distribution(runs.map(r => r.resources.goldEarned)),
    conditionsAcquired: distribution(runs.map(r => r.resources.conditionsAcquired)), conditionsCleared: distribution(runs.map(r => r.resources.conditionsCleared)),
    kills: distribution(runs.map(r => r.kills)), collected: distribution(runs.map(r => r.collected)), knownItems: distribution(runs.map(r => r.knownItems)),
    damageSources: sums('damageSources'), equipmentSelections: sums('equipmentSelections'),
    depths: Array.from({ length: 6 }, (_, depth) => {
      const entered = runs.filter(r => r.reachedDepths.includes(depth)), deaths = entered.filter(r => r.outcome === 'dead' && r.finalDepth === depth).length;
      return { depth, entered: entered.length, deaths, deathRiskAmongEntered: entered.length ? deaths / entered.length : null, deathCI95: wilson(deaths, entered.length), eventualWins: entered.filter(r => r.outcome === 'won').length };
    }),
  };
}
export function summarize(runs: RunResult[], baseline?: RunResult[]) {
  if (!runs.length) throw new Error('No games');
  const groups: Record<string, ReturnType<typeof group>> = {};
  for (const field of ['loadout', 'strategy'] as const) for (const value of new Set(runs.map(r => r.config[field]))) groups[`${field}:${value}`] = group(runs.filter(r => r.config[field] === value));
  for (const loadout of new Set(runs.map(r => r.config.loadout))) for (const strategy of new Set(runs.map(r => r.config.strategy))) {
    const selected = runs.filter(r => r.config.loadout === loadout && r.config.strategy === strategy);
    if (selected.length) groups[`${loadout}/${strategy}`] = group(selected);
  }
  const paired: Record<string, ReturnType<typeof pairedDifference>> = {};
  const strategies = [...new Set(runs.map(r => r.config.strategy))];
  for (let a = 0; a < strategies.length; a++) for (let b = a + 1; b < strategies.length; b++) for (const loadout of new Set(runs.map(r => r.config.loadout))) {
    const left = runs.filter(r => r.config.strategy === strategies[a] && r.config.loadout === loadout);
    const pairs = left.flatMap(l => { const r = runs.find(r => r.config.seed === l.config.seed && r.config.loadout === loadout && r.config.strategy === strategies[b]); return r ? [[l, r] as const] : []; });
    if (pairs.length) paired[`${loadout}:${strategies[b]} minus ${strategies[a]}`] = pairedDifference(pairs.map(([l]) => Number(l.outcome === 'won')), pairs.map(([, r]) => Number(r.outcome === 'won')));
  }
  let baselineComparison: unknown = null;
  if (baseline) {
    const pairs = runs.flatMap(r => { const old = baseline.find(l => JSON.stringify(l.config) === JSON.stringify(r.config)); return old ? [[old, r] as const] : []; });
    if (!pairs.length) throw new Error('Baseline has no identical configurations');
    if (pairs.some(([l, r]) => l.agentVersion !== r.agentVersion)) throw new Error('Agent version differs; not a difficulty comparison');
    baselineComparison = { matched: pairs.length, unmatched: runs.length - pairs.length,
      winRate: pairedDifference(pairs.map(([l]) => Number(l.outcome === 'won')), pairs.map(([, r]) => Number(r.outcome === 'won'))),
      ticks: pairedDifference(pairs.map(([l]) => l.ticks), pairs.map(([, r]) => r.ticks)),
      changedDigests: pairs.filter(([l, r]) => l.finalDigest !== r.finalDigest).length,
    };
  }
  return { schema: 1, agentVersion: runs[0]!.agentVersion, identity: runs[0]!.identity, seeds: [...new Set(runs.map(r => r.config.seed))], total: group(runs), groups, paired, baselineComparison,
    limitations: ['90-game smoke is a regression sample, not calibrated human difficulty.', 'Death source uses the last public hurt journal entry; other damage attribution groups environmental and periodic damage.', 'Condition counts are changes observed at command boundaries; no hidden intermediate events are inferred.', 'Unknown harmful outcome is correlation during the use command, not causal attribution.', 'Rarity is absent from public projection and is intentionally not inferred.', 'Tick budget stops at the first stable boundary at or beyond the threshold; an accepted command is never interrupted.', 'Current strategies do not experiment with unknown consumables; zero unknown trials is not evidence that those effects are safe.', 'No CPU timing is included in deterministic game results. Device/browser performance is separate.'],
  };
}
export function reportMarkdown(summary: ReturnType<typeof summarize>): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines = ['# M16A balance report', '', `Agent: ${summary.agentVersion}; rules: ${summary.identity.rules}; content: ${summary.identity.content}`, '', `Games: ${summary.total.games}; seeds: ${summary.seeds.join(', ')}`, '', '| Group | Games | Wins | Win rate (Wilson 95%) | Action median / P95 / peak |', '| --- | ---: | ---: | --- | --- |'];
  for (const [name, group] of Object.entries(summary.groups)) lines.push(`| ${name} | ${group.games} | ${group.wins} | ${pct(group.winRate)} (${group.winCI95.map(pct).join('–')}) | ${group.actions.median} / ${group.actions.p95} / ${group.actions.peak} |`);
  lines.push('', 'Outcomes: ' + JSON.stringify(summary.total.outcomes), '', 'Death causes: ' + JSON.stringify(summary.total.deathCauses), '', '## Paired seed comparisons', '', '| Comparison | Pairs | Win-rate difference | Bootstrap 95% |', '| --- | ---: | ---: | --- |');
  for (const [name, pair] of Object.entries(summary.paired)) lines.push(`| ${name} | ${pair.pairs} | ${pct(pair.meanDifference)} | ${pair.ci95.map(n => pct(n!)).join('–')} |`);
  lines.push('', '## Limits', '', ...summary.limitations.map(x => `- ${x}`), '', 'Full resource quantiles and depth entry/death denominators are in summary.json. Every run is in runs.json and runs.csv; non-winning formal command traces are in failures/.', '');
  return lines.join('\n');
}
export function reportCsv(runs: RunResult[]): string {
  const fields = ['seed', 'loadout', 'strategy', 'agentVersion', 'outcome', 'deathCause', 'actions', 'attempts', 'rejected', 'ticks', 'finalDigest', 'minHp', 'minFood', 'maxDepth', 'kills', 'collected', 'healing', 'foodUsed', 'itemUses', 'unknownUses', 'damage', 'goldSpent', 'equipmentChanges'];
  const escape = (x: unknown) => `"${String(x ?? '').replaceAll('"', '""')}"`;
  return [fields.join(','), ...runs.map(r => { const row: Record<string, unknown> = { ...r, ...r.config, ...r.resources }; return fields.map(f => escape(row[f])).join(','); })].join('\n') + '\n';
}
