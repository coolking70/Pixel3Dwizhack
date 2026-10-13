import { ALPHA2_IDENTITY, GameSession, MAX_COMMANDS } from '../session/session';
import type { Command, PublicView } from '../core/types';
import { createAgent } from './agents';
import { AGENT_VERSION, LOADOUTS, STRATEGIES, type Agent, type DeepReadonly, type Resources, type RunConfig, type RunResult, type StopReason } from './types';

export function freezeObservation<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeObservation(child); Object.freeze(value); }
  return value as DeepReadonly<T>;
}
export function validateConfig(config: RunConfig): void {
  for (const [name, value, max] of [['seed', config.seed, 0xffffffff], ['maxActions', config.maxActions, MAX_COMMANDS], ['maxTicks', config.maxTicks, 10_000_000], ['stuckLimit', config.stuckLimit, MAX_COMMANDS]] as const)
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}: ${value}`);
  if (!STRATEGIES.includes(config.strategy) || !LOADOUTS.includes(config.loadout)) throw new Error('Unknown strategy/loadout');
  if (config.choiceSeed !== undefined && (!Number.isInteger(config.choiceSeed) || config.choiceSeed < 1 || config.choiceSeed > 0xffffffff)) throw new Error('Invalid choiceSeed');
}
function resources(): Resources {
  return { healing: 0, healingActions: 0, foodUsed: 0, foodPressureActions: 0, itemUses: 0, unknownUses: 0, unknownHarmfulOutcomes: 0, damage: 0, goldSpent: 0, goldEarned: 0, equipmentChanges: 0, conditionsAcquired: 0, conditionsCleared: 0, damageSources: {}, equipmentSelections: {} };
}
function accumulate(out: Resources, before: PublicView, after: PublicView, command: Command) {
  const a = before.alpha2!, b = after.alpha2!, beats = after.beats ?? [];
  const healing = beats.filter(x => x.kind === 'heal' && x.actor === 0).reduce((s, x) => s + (x.amount ?? 0), 0);
  out.healing += healing; if (healing > 0) out.healingActions++;
  out.damage += beats.filter(x => x.kind === 'hurt' && x.target === 0).reduce((s, x) => s + (x.amount ?? 0), 0);
  const attacks = beats.filter(x => x.kind === 'attack' && x.target === 0 && x.actor > 0);
  let assigned = 0;
  for (const attack of attacks) {
    const source = [...a.monsters, ...b.monsters].find(m => m.enemy === attack.actor)?.id ?? 'unobserved-enemy';
    out.damageSources[source] = (out.damageSources[source] ?? 0) + (attack.amount ?? 0); assigned += attack.amount ?? 0;
  }
  const other = beats.filter(x => x.kind === 'hurt' && x.target === 0).reduce((s, x) => s + (x.amount ?? 0), 0) - assigned;
  if (other) out.damageSources['environment-or-periodic'] = (out.damageSources['environment-or-periodic'] ?? 0) + other;
  if (a.food <= a.maxFood * 0.25) out.foodPressureActions++;
  if (command === 'potion') out.itemUses++;
  if (/^a2:use:/.test(command)) {
    out.itemUses++;
    const item = a.bag.find(i => i.id === Number(command.split(':')[2]));
    if (command.split(':')[3] === 'eat') out.foodUsed++;
    if (item && !item.definition) {
      out.unknownUses++;
      if (after.player.hp < before.player.hp || b.conditions.some(c => !a.conditions.some(old => old.kind === c.kind))) out.unknownHarmfulOutcomes++;
    }
  }
  out.goldSpent += Math.max(0, before.player.gold - after.player.gold);
  out.goldEarned += Math.max(0, after.player.gold - before.player.gold);
  out.conditionsAcquired += b.conditions.filter(c => !a.conditions.some(old => old.kind === c.kind)).length;
  out.conditionsCleared += a.conditions.filter(c => !b.conditions.some(next => next.kind === c.kind)).length;
  if (JSON.stringify(a.equipped) !== JSON.stringify(b.equipped) || command.startsWith('choose:')) {
    if (!command.startsWith('choose:')) out.equipmentChanges++;
    for (const item of b.bag.filter(i => i.equipped)) if (command.startsWith('choose:') || !a.bag.some(old => old.id === item.id && old.equipped === item.equipped)) {
      const publicKey = item.definition ?? `${item.category}:${item.appearance}`;
      out.equipmentSelections[publicKey] = (out.equipmentSelections[publicKey] ?? 0) + 1;
    }
  }
}
/** Agent factory injection is for controlled adapter tests, not extra information. */
export function runGame(config: RunConfig, factory: (config: RunConfig) => Agent = createAgent): RunResult {
  validateConfig(config);
  const session = new GameSession(config.seed, 'alpha2'), agent = factory(config), trace: RunResult['trace'] = [], stats = resources();
  let view = session.view(), minHp = view.player.hp, minFood = view.alpha2!.food, outcome: StopReason = 'action-limit', error: string | undefined;
  let maxDepth = 0, unchangedProgress = 0, rejected: Command[] = [];
  const reached = new Set([0]), visitsSinceProgress = new Map<string, number>();
  // Progress means new exploration, kills, collection, equipment, relic or a new depth.
  // Pure pacing/waiting is not confused with a death or an accepted combat outcome.
  let progress = '';
  try {
    while (trace.length < config.maxActions * 3) {
      if (view.status !== 'playing') { outcome = view.status; break; }
      if (session.length >= config.maxActions) { outcome = 'action-limit'; break; }
      if (view.tick >= config.maxTicks) { outcome = 'tick-limit'; break; }
      if (unchangedProgress >= config.stuckLimit || rejected.length >= 16) { outcome = 'agent-stuck'; break; }
      const command = agent.next(freezeObservation(view), Object.freeze([...rejected]));
      if (!command) { outcome = 'agent-unsolved'; break; }
      const tick = view.tick, fingerprint = session.fingerprint(), result = session.submit(command);
      const next = session.view(), digest = session.fingerprint();
      trace.push({ command, accepted: result.accepted, tick: next.tick, digest, ...(!result.accepted ? { reason: result.reason } : {}) });
      if (!result.accepted) {
        if (next.tick !== tick || digest !== fingerprint) throw new Error('Rejected command changed mechanics');
        if (result.reason === 'limit') { outcome = 'session-limit'; break; }
        if (rejected.includes(command)) { outcome = 'agent-stuck'; break; }
        rejected.push(command); continue;
      }
      rejected = [];
      accumulate(stats, view, next, command);
      minHp = Math.min(minHp, next.player.hp); minFood = Math.min(minFood, next.alpha2!.food);
      maxDepth = Math.max(maxDepth, next.player.floor); reached.add(next.player.floor);
      const nextProgress = JSON.stringify([next.explored, next.expedition!.kills, next.expedition!.collected, next.alpha2!.equipped, next.player.relic, next.enemies.map(e => [e.id, e.hp])]);
      if (nextProgress !== progress) visitsSinceProgress.clear();
      const position = `${next.player.floor}:${next.player.x}`;
      unchangedProgress = (visitsSinceProgress.get(position) ?? 0) + 1;
      visitsSinceProgress.set(position, unchangedProgress);
      progress = nextProgress; view = next;
    }
  } catch (cause) { outcome = 'error'; error = cause instanceof Error ? cause.message : String(cause); }
  view = session.view();
  if (view.status === 'playing' && trace.length >= config.maxActions * 3 && session.length < config.maxActions) outcome = 'agent-stuck';
  if (view.status !== 'playing') outcome = view.status;
  const deathCause = outcome === 'dead' ? [...view.alpha2!.journal].reverse().find(j => j.key === 'hurt')?.target?.en ?? 'unobserved' : null;
  return {
    schema: 1, agentVersion: AGENT_VERSION, identity: { rules: ALPHA2_IDENTITY.rules, commands: ALPHA2_IDENTITY.commands, content: ALPHA2_IDENTITY.content }, config: { ...config },
    outcome, ...(error ? { error } : {}), deathCause, actions: session.length, attempts: trace.length, rejected: trace.filter(t => !t.accepted).length,
    ticks: view.tick, finalDigest: session.fingerprint(), minHp, minFood, finalHp: view.player.hp, maxDepth, finalDepth: view.player.floor,
    reachedDepths: [...reached].sort((a, b) => a - b), kills: view.expedition!.kills, collected: view.expedition!.collected, knownItems: view.alpha2!.knownCount, resources: stats, trace,
  };
}

export function replayTrace(result: RunResult): string {
  if (result.identity.rules !== ALPHA2_IDENTITY.rules || result.identity.commands !== ALPHA2_IDENTITY.commands || result.identity.content !== ALPHA2_IDENTITY.content) throw new Error('Trace rule identity mismatch');
  const session = new GameSession(result.config.seed, 'alpha2');
  result.trace.forEach((entry, index) => {
    const actual = session.submit(entry.command);
    if (actual.accepted !== entry.accepted || (!actual.accepted && actual.reason !== entry.reason) || session.view().tick !== entry.tick || session.fingerprint() !== entry.digest) throw new Error(`Trace diverged at attempt ${index + 1}`);
  });
  if (session.fingerprint() !== result.finalDigest) throw new Error('Final digest mismatch');
  return session.fingerprint();
}
