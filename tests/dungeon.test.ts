import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameSession } from '../src/session/session';
import { accept, createWorld, inspect } from '../src/core/simulation';
import type { Command, World } from '../src/core/types';
import { MotionInput } from '../src/room/held';
import { BlockCharacter } from '../src/character-lab/character';
import { parseRig } from '../src/character-lab/assets';
import * as T from 'three';

function expedition(seed: number, branch: boolean) {
  const session = new GameSession(seed, 'dungeon'), commands: Command[] = [], states = [session.view()];
  const act = (c: Command): void => {
    expect(session.submit(c), `${c} at ${JSON.stringify(session.view().player)}`).toMatchObject({ accepted: true });
    commands.push(c); states.push(session.view());
  };
  const heal = (): void => { const p = session.view().player; if (p.hp <= 22 && p.potions) act('potion'); };
  const go = (x: number): void => {
    let budget = 90;
    while (session.view().player.x !== x && budget-- > 0) { heal(); act(session.view().player.x < x ? 'right' : 'left'); }
    expect(session.view().player.x).toBe(x);
  };
  go(8); act('interact'); act('interact'); act('equip:ironCuirass'); go(10); act('down');
  if (branch) {
    go(3); for (let i = 0; i < 4; i++) act('interact');
    act('equip:mace'); act('equip:towerShield'); act('equip:ironHelm');
  }
  go(15); act('interact'); act('equip:ironGreaves'); go(17); act('down'); act('interact');
  go(3); act('interact'); go(17); act('up'); go(10); act('up'); go(1);
  return { session, commands, states };
}

describe('M02C deterministic expedition', () => {
  it('preserves the captured room-1 archive and excludes new gear from old commands/catalogs', () => {
    const raw = readFileSync(new URL('./fixtures/room-v1.json', import.meta.url), 'utf8').trim();
    const s = GameSession.fromArchive(raw); expect(s.capture()).toBe(raw);
    expect(s.submit('equip:mace').accepted).toBe(false); expect(s.capture()).toBe(raw);
    expect(s.view().gear!.catalog.some(g => g.id === 'mace')).toBe(false);
  });
  it('completes main and optional routes on four seeds with only public commands', () => {
    for (const seed of [1, 42, 24681, 0xffffffff]) for (const branch of [false, true]) {
      const { session, states } = expedition(seed, branch);
      expect(session.view()).toMatchObject({ status: 'won', player: { floor: 0, x: 1, relic: true } });
      expect(new Set(states.map(v => v.player.floor)).size).toBe(3);
      expect(session.view().player.inventory!.includes('mace')).toBe(branch);
      expect(session.view().player.gold).toBe(branch ? 25 : 20);
    }
  });
  it('replays every boundary and resumes across room, equipment and relic transitions', () => {
    const { session, commands, states } = expedition(42, true);
    states.forEach((v, i) => expect(session.replay(i)).toEqual(v));
    for (const cut of [0, ...states.flatMap((v, i) => i && (v.player.floor !== states[i - 1]!.player.floor || v.player.relic !== states[i - 1]!.player.relic) ? [i] : [])]) {
      const part = new GameSession(42, 'dungeon'); commands.slice(0, cut).forEach(c => part.submit(c));
      const loaded = GameSession.fromArchive(part.capture()); commands.slice(cut).forEach(c => loaded.submit(c)); expect(loaded.capture()).toBe(session.capture());
    }
    const live = new GameSession(7, 'dungeon'), before = live.capture();
    expect(() => live.restore(new GameSession(7, 'room').capture())).toThrow();
    const forged = JSON.parse(before); forged.world.enemies[1].intent = { x: 2, floor: 0 };
    expect(() => live.restore(JSON.stringify(forged))).toThrow(); expect(live.capture()).toBe(before);
  });
  it('telegraphs, freezes, strikes the locked area and permits evasion (controlled fixtures)', () => {
    const start = createWorld(7, 'dungeon'); start.player.floor = 1; start.player.x = 6;
    const guard = start.enemies[1]!; guard.nextAt = 1; start.enemies = [guard];
    const step = (w: World, c: Command): World => { const r = accept(w, c); if (!r.accepted) throw new Error(r.reason); return r.world; };
    const ready = step(start, 'wait');
    expect(ready.enemies[0]!.intent).toEqual({ floor: 1, x: 6 }); expect(ready.player.hp).toBe(44);
    const snapshot = JSON.stringify(ready); for (let i = 0; i < 100; i++) inspect(ready); expect(JSON.stringify(ready)).toBe(snapshot);
    const struck = step(step(step(ready, 'wait'), 'wait'), 'wait'); expect(struck.player.hp).toBe(33); expect(struck.enemies[0]!.intent).toBeUndefined();
    const dodged = step(step(step(ready, 'right'), 'right'), 'wait'); expect(dodged.player.hp).toBe(44); expect(dodged.events.some(e => e.kind === 'evade')).toBe(true);
    const between = structuredClone(ready); between.player.floor = 0; expect(step(step(step(between, 'wait'), 'wait'), 'wait').player.hp).toBe(44);
    const lethal = structuredClone(ready); lethal.player.hp = 1; const dead = step(step(step(lethal, 'wait'), 'wait'), 'wait');
    expect(dead.status).toBe('dead'); expect(accept(dead, 'potion').accepted).toBe(false);
  });
  it('does not expose off-floor intents or advance on invalid equipment and full-health potions', () => {
    const s = new GameSession(24681, 'dungeon'), initial = s.capture();
    expect(s.submit('equip:mace').accepted).toBe(false); expect(s.submit('potion').accepted).toBe(false); expect(s.capture()).toBe(initial);
    expect(s.view().enemies.every(e => e.floor === 0)).toBe(true);
    const view = s.view(); view.gear!.catalog[0]!.damage = 999; view.map.rooms![0] = 'crypt'; expect(s.capture()).toBe(initial);
  });
  it('gives mace and tower shield actual opposite stat tradeoffs (controlled inventory)', () => {
    const world = createWorld(7, 'dungeon'); world.player.inventory!.push('mace', 'towerShield');
    const mace = accept(world, 'equip:mace'); if (!mace.accepted) throw new Error('mace');
    expect(inspect(mace.world).gear).toMatchObject({ armor: 1, damage: 10 });
    const shield = accept(mace.world, 'equip:towerShield'); if (!shield.accepted) throw new Error('shield');
    expect(inspect(shield.world).gear).toMatchObject({ armor: 3, damage: 8 });
    const unarmed = accept(shield.world, 'unequip:mainHand'); if (!unarmed.accepted) throw new Error('unarmed');
    expect(inspect(unarmed.world).gear!.damage).toBe(1);
  });
  it('continues only a physically held intention after completion, cancelling on release and danger', () => {
    let busy = false, count = 0, danger = false;
    const input = new MotionInput(() => { count++; busy = true; return { accepted: true, interrupt: danger }; }, () => busy);
    input.start('d', 'right'); input.completed(); expect(count).toBe(1);
    busy = false; input.completed(); expect(count).toBe(2);
    input.release('d'); busy = false; input.completed(); expect(count).toBe(2);
    danger = true; input.start('a', 'left'); busy = false; input.completed(); expect(count).toBe(3);
    danger = false; input.start('d', 'right'); input.start('a', 'left'); input.release('a'); busy = false; input.completed(); expect(count).toBe(4);
  });
  it('keeps new weapon silhouettes and blended poses attached to unchanged grip sockets', () => {
    const data = parseRig(JSON.parse(readFileSync(new URL('../public/assets/character-study/motions.json', import.meta.url), 'utf8')));
    const actor = new BlockCharacter(data); actor.setEquipment({ outfit: 'plate', helmet: true, sword: true, shield: true, weaponStyle: 'mace', shieldStyle: 'tower' });
    actor.sample('idle', 0); const idle = actor.capturePose();
    const upright = new T.Vector3(0, 1, 0).applyQuaternion(actor.shield.root.getObjectByName('TowerShield')!.getWorldQuaternion(new T.Quaternion()));
    expect(upright.y).toBeGreaterThan(.99);
    for (const motion of ['attack', 'climb'] as const) for (const phase of [0, .1, .5, .9, 1]) {
      actor.sample(motion, phase); actor.blendFrom(idle, phase); expect(actor.gripErrors().sword).toBeLessThan(1e-6); expect(actor.gripErrors().shield).toBeLessThan(1e-6);
    }
    expect(actor.sword.root.getObjectByName('MaceParts')!.visible).toBe(true); expect(actor.sword.root.getObjectByName('BladeParts')!.visible).toBe(false);
    actor.dispose();
  });
});
