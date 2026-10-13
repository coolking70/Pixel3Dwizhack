import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createAgent, choiceRandom } from '../../src/balance/agents';
import { freezeObservation, replayTrace, runGame } from '../../src/balance/runner';
import { pairedDifference, reportCsv, reportMarkdown, summarize, wilson } from '../../src/balance/report';
import { AGENT_VERSION, STRATEGIES, type RunConfig } from '../../src/balance/types';
import { GameSession } from '../../src/session/session';

const config = (strategy: RunConfig['strategy'] = 'survivor'): RunConfig => ({ seed: 42, strategy, loadout: 'channeler', maxActions: 1800, maxTicks: 30000, stuckLimit: 96 });
describe('M16A natural public-observation balance adapter', () => {
  for (const strategy of STRATEGIES) it(`${strategy}: complete commands, rejections, resources and every digest repeat`, () => {
    const a = runGame(config(strategy)), b = runGame(config(strategy));
    expect(a).toEqual(b);
    expect(a.agentVersion).toBe(AGENT_VERSION);
    expect(a.outcome).not.toBe('error');
    expect(a.actions).toBeGreaterThan(30);
    expect(a.resources.itemUses).toBe(a.trace.filter(t => t.accepted && (t.command === 'potion' || t.command.startsWith('a2:use:'))).length);
    expect(replayTrace(a)).toBe(a.finalDigest);
  }, 120000);
  it('policy only has erased type imports; observations are deeply frozen and have no hidden item definition', () => {
    const source = ts.createSourceFile('agents.ts', readFileSync('src/balance/agents.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) if (ts.isImportDeclaration(statement)) expect(statement.importClause?.isTypeOnly).toBe(true);
    const s = new GameSession(42, 'alpha2'), view = freezeObservation(s.view());
    expect(Object.isFrozen(view.alpha2!.bag[0])).toBe(true);
    expect(() => { (view.player as { hp: number }).hp = 1; }).toThrow();
    expect(JSON.stringify(view)).not.toContain('assignment');
    expect('rng' in view).toBe(false);
    const original = s.fingerprint(), agent = createAgent(config());
    agent.next(view, []);
    expect(s.fingerprint()).toBe(original);
    // Natural exploration reaches unknown items; no controlled world injection.
    let unknown = 0;
    const observed = runGame({ ...config(), maxActions: 120 }, c => {
      const policy = createAgent(c);
      return { next(v, rejected) {
        expect(Object.isFrozen(v)).toBe(true);
        for (const item of [...v.alpha2!.bag, ...v.alpha2!.ground, ...v.alpha2!.facilities.flatMap(f => f.stock)]) if (!item.definition) {
          unknown++;
          expect(item.description).toBeUndefined(); expect(item.charges).toBeUndefined(); expect(item.damage).toBeUndefined();
        }
        return policy.next(v, rejected);
      } };
    });
    expect(observed.outcome).not.toBe('error'); expect(unknown).toBeGreaterThan(0);
  }, 120000);
  it('rejected attempts are atomic and a repeated invalid policy is classified as stuck, not killed', () => {
    const result = runGame(config(), () => ({ next: () => 'wear:99999' }));
    expect(result.outcome).toBe('agent-stuck'); expect(result.ticks).toBe(0); expect(result.actions).toBe(0);
    expect(result.deathCause).toBeNull(); expect(result.trace[0]!.digest).toBe(result.trace[1]!.digest);
    expect(replayTrace(result)).toBe(result.finalDigest);
  });
  it('bounded action/tick limits, no-decision and failed trace replay are explicit', () => {
    const limited = runGame({ ...config(), maxActions: 2 });
    expect(limited.outcome).toBe('action-limit'); expect(limited.actions).toBe(2);
    expect(replayTrace(limited)).toBe(limited.finalDigest);
    const tickLimited = runGame({ ...config(), maxTicks: 1 });
    expect(tickLimited.outcome).toBe('tick-limit'); expect(tickLimited.actions).toBe(2);
    expect(runGame(config(), () => ({ next: () => null })).outcome).toBe('agent-unsolved');
    const modified = structuredClone(limited); modified.trace[1]!.digest = '00000000';
    expect(() => replayTrace(modified)).toThrow('attempt 2');
    expect(() => runGame({ ...config(), maxActions: Infinity })).toThrow('maxActions');
  });
  it('exhausting the attempt budget on distinct rejected commands is an agent failure, not accepted-action exhaustion', () => {
    let id = 9000;
    const result = runGame({ ...config(), maxActions: 2 }, () => ({ next: () => `wear:${id++}` }));
    expect(result.outcome).toBe('agent-stuck'); expect(result.actions).toBe(0); expect(result.attempts).toBe(6); expect(result.ticks).toBe(0);
    expect(replayTrace(result)).toBe(result.finalDigest);
  });
  it('ended natural game rejects commands without ticking', () => {
    const result = runGame(config('fighter'));
    expect(['won', 'dead']).toContain(result.outcome);
    const session = new GameSession(result.config.seed, 'alpha2');
    for (const entry of result.trace) session.submit(entry.command);
    const before = session.capture();
    expect(session.submit('wait')).toEqual({ accepted: false, reason: 'ended' }); expect(session.capture()).toBe(before);
  }, 120000);
  it('statistics retain censored outcomes, Wilson bounds and paired seeds without inventing wins', () => {
    const a = runGame({ ...config(), maxActions: 2 });
    const b = runGame({ ...config('fighter'), maxActions: 2 });
    const summary = summarize([a, b], [a, b]);
    expect(summary.total.outcomes).toEqual({ 'action-limit': 2 }); expect(summary.total.wins).toBe(0);
    expect(wilson(0, 10)[0]).toBe(0); expect(wilson(10, 10)[1]).toBe(1);
    expect(summary.paired['channeler:fighter minus survivor']!.pairs).toBe(1);
    expect(pairedDifference([0, 1, 0], [1, 1, 0])).toEqual(pairedDifference([0, 1, 0], [1, 1, 0]));
    expect(reportCsv([a])).toContain('action-limit'); expect(reportMarkdown(summary)).toContain('Wilson');
    expect(() => summarize([a], [{ ...a, agentVersion: 'other' }])).toThrow('Agent version');
    const x = choiceRandom(42), y = choiceRandom(42); expect(Array.from({ length: 8 }, () => x())).toEqual(Array.from({ length: 8 }, () => y()));
  });
});
