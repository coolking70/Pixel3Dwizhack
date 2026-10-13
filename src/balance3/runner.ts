import { ALPHA3_IDENTITY, GameSession } from '../session/session';
import type { Command, Rejection } from '../core/types';
import { createAgent } from '../balance/agents';
import { freezeObservation, validateConfig } from '../balance/runner';
import { AGENT_VERSION, type Agent, type Observation, type RunConfig, type StopReason } from '../balance/types';

export const AGENT3_VERSION = 'm25-alpha3-public-1';
export const PROBE3_VERSION = 'm25-alpha3-one-throw-1';
export interface RunConfig3 extends RunConfig { probe?: true }
export const agentVersion3 = (config: RunConfig3) => config.probe ? PROBE3_VERSION : AGENT3_VERSION;
/** Explicit exploratory policy, separate from the inherited three-policy baseline. */
export function createThrowProbeAgent(config: RunConfig): Agent {
  const parent = createAgent(config); let attempted = false;
  return { next(view, rejected) {
    if (view.revision > 0 && !attempted && !view.alpha2?.conditions.some(condition => condition.kind === 'sleep')) {
      const item = view.alpha2?.bag.find(item => item.category === 'food' && !item.equipped);
      const enemy = view.enemies.find(enemy => enemy.hp > 0 && enemy.floor === view.player.floor && Math.abs(enemy.x-view.player.x)>0 && Math.abs(enemy.x-view.player.x)<=5 && view.explored[enemy.floor]?.includes(enemy.x));
      if (item && enemy) { attempted = true; return `a2:use:${item.id}:throw:e${enemy.id}`; }
    }
    return parent.next(view,rejected);
  } };
}
export interface Trace3 {
  proposed: Command; command: Command; accepted: boolean; reason?: Rejection; tick: number; digest: string;
}
export interface Run3 {
  schema: 1; agentVersion: string; parentAgentVersion: string; identity: typeof ALPHA3_IDENTITY;
  config: RunConfig3; outcome: StopReason; error?: string; actions: number; attempts: number; rejected: number;
  adaptedThrows: number; ticks: number; finalDigest: string; finalHp: number; minHp: number; minFood: number;
  maxDepth: number; kills: number; trace: Trace3[];
}

/** Resolve only public positions. Missing targets never fall back to an old throw. */
export function adaptCommand3(proposed: Command, view: Observation): Command | null {
  const match = /^a2:use:([1-9]\d*):throw:(.+)$/.exec(proposed);
  if (!match) return proposed;
  const id = Number(match[1]), target = match[2]!;
  if (!view.alpha2?.bag.some(item => item.id === id)) return null;
  const targetId = Number(target.slice(1));
  const position = target === 'self' || target[0] === 'i' && view.alpha2.bag.some(item => item.id === targetId) ? view.player
    : target[0] === 'e' ? view.enemies.find(enemy => enemy.id === targetId && enemy.hp > 0)
    : target[0] === 'f' ? view.alpha2.facilities.find(facility => facility.id === targetId)
    : target[0] === 'd' ? view.alpha?.doors.find(door => door.id === targetId) : undefined;
  return position ? `a3:throw:${id}:${position.floor}:${position.x}` : null;
}

/** Every mechanical change is a formal submission; factory injection is test-only. */
export function runGame3(config: RunConfig3, factory: (config: RunConfig) => Agent = config.probe ? createThrowProbeAgent : createAgent): Run3 {
  validateConfig(config);
  if (config.probe !== undefined && config.probe !== true) throw new Error('Invalid probe policy');
  const session = new GameSession(config.seed, 'alpha3'), agent = factory(config), trace: Trace3[] = [];
  let view = session.view(), outcome: StopReason = 'agent-stuck', error: string | undefined;
  let minHp = view.player.hp, minFood = view.alpha2!.food, maxDepth = view.player.floor;
  let rejected: Command[] = [], progress = '', unchangedProgress = 0;
  const visits = new Map<string, number>();
  try {
    while (trace.length < config.maxActions * 3) {
      if (view.status !== 'playing') { outcome = view.status; break; }
      if (session.length >= config.maxActions) { outcome = 'action-limit'; break; }
      if (view.tick >= config.maxTicks) { outcome = 'tick-limit'; break; }
      if (unchangedProgress >= config.stuckLimit || rejected.length >= 16) { outcome = 'agent-stuck'; break; }
      const proposed = agent.next(freezeObservation(view), Object.freeze([...rejected]));
      if (!proposed) { outcome = 'agent-unsolved'; break; }
      const command = adaptCommand3(proposed, view);
      if (!command) { outcome = 'agent-unsolved'; error = 'Throw target/source unavailable in public observation'; break; }
      const beforeDigest = session.fingerprint(), result = session.submit(command), next = session.view(), digest = session.fingerprint();
      trace.push({ proposed, command, accepted: result.accepted, tick: next.tick, digest, ...(!result.accepted ? { reason: result.reason } : {}) });
      if (!result.accepted) {
        if (next.tick !== view.tick || digest !== beforeDigest) throw new Error('Rejected command changed mechanics');
        if (result.reason === 'limit') { outcome = 'session-limit'; break; }
        if (rejected.includes(proposed)) { outcome = 'agent-stuck'; break; }
        rejected.push(proposed); continue;
      }
      rejected = [];
      minHp = Math.min(minHp, next.player.hp); minFood = Math.min(minFood, next.alpha2!.food); maxDepth = Math.max(maxDepth, next.player.floor);
      const nextProgress = JSON.stringify([next.explored, next.expedition!.kills, next.expedition!.collected, next.alpha2!.equipped, next.player.relic, next.enemies.map(enemy => [enemy.id, enemy.hp])]);
      if (nextProgress !== progress) visits.clear();
      const position = `${next.player.floor}:${next.player.x}`;
      unchangedProgress = (visits.get(position) ?? 0) + 1; visits.set(position, unchangedProgress);
      progress = nextProgress; view = next;
    }
  } catch (cause) { outcome = 'error'; error = cause instanceof Error ? cause.message : String(cause); }
  view = session.view();
  if (view.status !== 'playing') outcome = view.status;
  else if (session.length >= config.maxActions && outcome !== 'error') outcome = 'action-limit';
  return {
    schema: 1, agentVersion: agentVersion3(config), parentAgentVersion: AGENT_VERSION, identity: { ...ALPHA3_IDENTITY }, config: { ...config }, outcome,
    ...(error ? { error } : {}), actions: session.length, attempts: trace.length, rejected: trace.filter(entry => !entry.accepted).length,
    adaptedThrows: trace.filter(entry => entry.proposed !== entry.command).length, ticks: view.tick, finalDigest: session.fingerprint(),
    finalHp: view.player.hp, minHp, minFood, maxDepth, kills: view.expedition!.kills, trace,
  };
}

function replaySession3(run: Run3): GameSession {
  validateConfig(run.config);
  if (run.config.probe !== undefined && run.config.probe !== true) throw new Error('Invalid probe policy');
  if (JSON.stringify(run.identity) !== JSON.stringify(ALPHA3_IDENTITY) || run.agentVersion !== agentVersion3(run.config) || run.parentAgentVersion !== AGENT_VERSION) throw new Error('Alpha 3 trace identity mismatch');
  if (run.trace.length > run.config.maxActions * 3) throw new Error('Trace attempt budget exceeded');
  const session = new GameSession(run.config.seed, 'alpha3');
  const initial = session.view();
  let minHp = initial.player.hp, minFood = initial.alpha2!.food, maxDepth = initial.player.floor;
  run.trace.forEach((entry, index) => {
    if (adaptCommand3(entry.proposed, session.view()) !== entry.command) throw new Error(`Public adapter diverged at attempt ${index + 1}`);
    const actual = session.submit(entry.command);
    if (actual.accepted !== entry.accepted || (!actual.accepted && actual.reason !== entry.reason) || session.view().tick !== entry.tick || session.fingerprint() !== entry.digest) throw new Error(`Trace diverged at attempt ${index + 1}`);
    const view = session.view();
    minHp = Math.min(minHp, view.player.hp); minFood = Math.min(minFood, view.alpha2!.food); maxDepth = Math.max(maxDepth, view.player.floor);
  });
  if (session.fingerprint() !== run.finalDigest || session.view().tick !== run.ticks || session.length !== run.actions || run.trace.length !== run.attempts || run.trace.filter(entry => !entry.accepted).length !== run.rejected) throw new Error('Final result mismatch');
  const final = session.view();
  if (final.status === 'playing' ? run.outcome === 'won' || run.outcome === 'dead' : run.outcome !== final.status) throw new Error('Terminal outcome mismatch');
  if (run.outcome === 'action-limit' && run.actions < run.config.maxActions || run.outcome === 'tick-limit' && run.ticks < run.config.maxTicks || run.outcome === 'session-limit' && run.trace.at(-1)?.reason !== 'limit') throw new Error('Budget outcome mismatch');
  if (run.adaptedThrows !== run.trace.filter(entry => entry.proposed !== entry.command).length || run.finalHp !== final.player.hp || run.minHp !== minHp || run.minFood !== minFood || run.maxDepth !== maxDepth || run.kills !== final.expedition!.kills) throw new Error('Public summary mismatch');
  return session;
}

export function replayTrace3(run: Run3): string { return replaySession3(run).fingerprint(); }
/** Full natural archive, rebuilt exclusively from the recorded formal commands. */
export function captureTrace3(run: Run3): string { return replaySession3(run).capture(); }
