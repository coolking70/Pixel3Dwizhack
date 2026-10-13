import { describe, expect, it } from 'vitest';
import { MINE } from '../src/content/mine';
import { canonical } from '../src/core/digest';
import { accept, createWorld, inspect } from '../src/core/simulation';
import type { Command } from '../src/core/types';
import { ArchiveError, GameSession, IDENTITY, MAX_BYTES, MAX_COMMANDS } from '../src/session/session';
import { loadSession, saveSession, SAVE_KEY } from '../src/session/storage';
import { translate } from '../src/ui/i18n';

// Natural trace: no mutation, fixture teleporting, enemy removal or modified saves.
function expedition(seed: number): { session: GameSession; commands: Command[] } {
  const session = new GameSession(seed), commands: Command[] = [];
  function act(command: Command): void {
    expect(session.submit(command).accepted).toBe(true);
    commands.push(command);
  }
  function go(x: number): void {
    let budget = 100;
    while (session.view().player.x !== x && budget-- > 0) {
      if (session.view().player.hp < 18 && session.view().player.potions) act('potion');
      act(session.view().player.x < x ? 'right' : 'left');
    }
    expect(session.view().player.x).toBe(x);
  }
  go(5); act('interact'); go(17); act('down'); go(15); act('interact');
  go(8); act('down'); go(22); act('interact'); go(8); act('up'); go(17); act('up'); go(1);
  return { session, commands };
}

describe('deterministic simulation', () => {
  it('rejects invalid seeds and illegal commands without any mutation', () => {
    for (const seed of [0, -1, 1.5, NaN, 0x100000000]) expect(() => createWorld(seed)).toThrow();
    const world = createWorld(42), initial = canonical(world);
    for (const command of ['up', 'down', 'interact', 'potion', 'unknown']) expect(accept(world, command as Command).accepted).toBe(false);
    expect(canonical(world)).toBe(initial);
    const session = new GameSession(42);
    const save = session.capture();
    session.submit('up'); expect(session.capture()).toBe(save);
    session.submit('left'); const atWall = session.capture();
    expect(session.submit('left')).toEqual({ accepted: false, reason: 'wall' });
    expect(session.capture()).toBe(atWall);
  });
  it('keeps queries detached and hides unexplored entities', () => {
    const world = createWorld(42), initial = canonical(world);
    const view = inspect(world);
    expect(view.enemies).toHaveLength(0);
    expect(view.map.ladders).toHaveLength(0);
    expect(view.loot.map(item => item.kind)).toEqual(['coins']);
    expect(view).not.toHaveProperty('rng');
    view.player.hp = 0; view.explored[0]!.push(25); view.events.push({ kind: 'won' });
    expect(canonical(world)).toBe(initial);
    expect(inspect(world).player.hp).toBe(MINE.playerHp);
  });
  it('uses tick deadlines, stable ties and stops exactly at death (controlled fixtures)', () => {
    const world = createWorld(7);
    world.enemies = [
      { id: 2, x: 3, floor: 0, hp: 12, maxHp: 12, period: 20, nextAt: 5 },
      { id: 1, x: 1, floor: 0, hp: 12, maxHp: 12, period: 20, nextAt: 5 },
    ];
    world.player.hp = 2;
    const result = accept(world, 'wait');
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.world.status).toBe('dead'); expect(result.world.tick).toBe(5);
    expect(result.world.enemies.find(enemy => enemy.id === 1)!.nextAt).toBe(25);
    expect(result.world.enemies.find(enemy => enemy.id === 2)!.nextAt).toBe(5);
    expect(accept(result.world, 'wait').accepted).toBe(false);
  });
  it('processes multiple fast-enemy turns during a costly action (controlled fixture)', () => {
    const world = createWorld(7);
    world.enemies = [{ id: 1, x: 3, floor: 0, hp: 12, maxHp: 12, period: 3, nextAt: 3 }];
    const result = accept(world, 'wait');
    if (!result.accepted) throw new Error('expected accepted');
    expect(result.world.player.hp).toBe(MINE.playerHp - 6);
    expect(result.world.tick).toBe(10); expect(result.world.enemies[0]!.nextAt).toBe(12);
  });
  it('signals visible danger and attacks while moving into an enemy', () => {
    const session = new GameSession(7);
    for (let i = 0; i < 4; i++) expect(session.submit('right')).toMatchObject({ accepted: true, interrupt: false });
    expect(session.submit('right')).toEqual({ accepted: true, interrupt: true });
    for (let i = 0; i < 8 && !session.view().events.some(event => event.kind === 'hit'); i++) session.submit('right');
    expect(session.view().events.some(event => event.kind === 'hit')).toBe(true);
  });
  it('completes a playable expedition for multiple seeds using only public commands', () => {
    for (const seed of [1, 42, 24681, 0xffffffff]) {
      const { session } = expedition(seed);
      expect(session.view()).toMatchObject({ status: 'won', player: { relic: true, floor: 0, x: 1 } });
      expect(session.view().player.hp).toBeGreaterThan(0);
      expect(session.view().events.some(event => event.kind === 'won')).toBe(true);
    }
  });
});

describe('archives and replay', () => {
  it('replays every boundary, seeks backward, and preserves the live run', () => {
    const { session, commands } = expedition(24681);
    const incremental = new GameSession(24681), saved = session.capture();
    expect(session.replay(0)).toEqual(incremental.view());
    commands.forEach((command, index) => {
      incremental.submit(command);
      expect(session.replay(index + 1)).toEqual(incremental.view());
    });
    session.replay(3); session.replay(0);
    expect(session.capture()).toBe(saved);
    expect(() => session.replay(-1)).toThrow(ArchiveError);
  });
  it('restores at multiple cuts and continues with the same RNG, facts and provenance', () => {
    const { session: expected, commands } = expedition(42);
    for (const cut of [0, 5, 15, 28, commands.length - 1]) {
      const session = new GameSession(42);
      commands.slice(0, cut).forEach(command => session.submit(command));
      const restored = GameSession.fromArchive(session.capture());
      commands.slice(cut).forEach(command => restored.submit(command));
      expect(restored.capture()).toBe(expected.capture());
    }
  });
  it('has identical mechanics with varying query and translation frequency', () => {
    const a = new GameSession(42), b = new GameSession(42);
    const commands: Command[] = ['right', 'right', 'interact', 'wait', 'right', 'right', 'attack', 'left'];
    for (const command of commands) {
      a.submit(command);
      for (let frame = 0; frame < 144; frame++) {
        for (const event of b.view().events) translate(frame % 2 ? 'zh' : 'en', `event.${event.kind}`);
      }
      b.submit(command);
    }
    expect(a.capture()).toBe(b.capture());
  });
  it('rejects corrupt, stale, reordered, forged and oversized imports while keeping the live run', () => {
    const session = new GameSession(12);
    session.submit('right'); session.submit('wait'); const original = session.capture();
    const mutations = [
      (archive: any) => { archive.identity.rules = 'old'; },
      (archive: any) => { archive.seed = 0; },
      (archive: any) => { archive.world.player.hp = -1; },
      (archive: any) => { archive.world.enemies[0].nextAt = -200; },
      (archive: any) => { archive.history.reverse(); },
      (archive: any) => { archive.history[0].command = 'teleport'; },
      (archive: any) => { archive.history[0].digest = '00000000'; },
      (archive: any) => { archive.world.rng++; },
      (archive: any) => { archive.history = []; },
      (archive: any) => { archive.extra = true; },
      (archive: any) => { let nested: unknown = 0; for (let i = 0; i < 40; i++) nested = { nested }; archive.world = nested; },
      (archive: any) => { archive.history = Array(MAX_COMMANDS + 1).fill(archive.history[0]); },
    ];
    for (const mutate of mutations) {
      const archive = JSON.parse(original); mutate(archive);
      expect(() => session.restore(JSON.stringify(archive))).toThrow(ArchiveError);
      expect(session.capture()).toBe(original);
    }
    for (const raw of ['{', 'null', JSON.stringify({ version: 1 }), ' '.repeat(MAX_BYTES + 1)]) {
      expect(() => session.restore(raw)).toThrow(ArchiveError);
      expect(session.capture()).toBe(original);
    }
    expect(JSON.parse(original).identity).toEqual(IDENTITY);
  });
  it('preserves a previous save when storage refuses a write and reports missing saves', () => {
    let value: string | null = null, fail = false;
    const storage = {
      getItem(key: string) { expect(key).toBe(SAVE_KEY); return value; },
      setItem(key: string, raw: string) { expect(key).toBe(SAVE_KEY); if (fail) throw new Error('quota'); value = raw; },
    };
    const session = new GameSession(7);
    expect(loadSession(session, storage)).toBe(false);
    saveSession(session, storage); const saved = value;
    fail = true; session.submit('right');
    expect(() => saveSession(session, storage)).toThrow('quota'); expect(value).toBe(saved);
    expect(loadSession(session, storage)).toBe(true); expect(session.length).toBe(0);
  });
});
