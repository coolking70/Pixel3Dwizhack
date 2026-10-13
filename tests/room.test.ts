import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameSession } from '../src/session/session';
import { accept, createWorld } from '../src/core/simulation';
import type { Command } from '../src/core/types';
import { BlockCharacter } from '../src/character-lab/character';
import { poseOnLadder } from '../src/character-lab/ladder';
import { parseRig } from '../src/character-lab/assets';
import { appearance } from '../src/room/presentation';

function clearRoom(seed: number) {
  const session = new GameSession(seed, 'room'), commands: Command[] = [], states = [session.view()];
  function act(command: Command) { expect(session.submit(command).accepted).toBe(true); commands.push(command); states.push(session.view()); }
  function go(x: number) { let budget = 50; while (session.view().player.x !== x && budget-- > 0) act(session.view().player.x < x ? 'right' : 'left'); expect(session.view().player.x).toBe(x); }
  go(6); act('interact'); act('equip:ironCuirass'); act('interact'); act('equip:ironGreaves');
  const looted = session.capture(); expect(session.submit('interact').accepted).toBe(false); expect(session.capture()).toBe(looted);
  go(8); act('up'); act('interact'); act('equip:ironHelm'); go(11);
  return { session, commands, states };
}
describe('M02B room and retained M01', () => {
  it('loads a real pre-change M01 archive with every historical digest unchanged', () => {
    const old = readFileSync(new URL('./fixtures/mine-v1.json', import.meta.url), 'utf8');
    expect(GameSession.fromArchive(old).capture()).toBe(old);
    const mine = new GameSession(); const before = mine.capture(); expect(mine.submit('equip:sword').accepted).toBe(false); expect(mine.capture()).toBe(before);
  });
  it('completes combat, loot, three armor slots, climbing and exit through public commands', () => {
    for (const seed of [1, 42, 24681, 0xffffffff]) {
      const { session } = clearRoom(seed);
      expect(session.view()).toMatchObject({ status: 'won', player: { floor: 0, x: 11, equipment: { chest: 'ironCuirass', legs: 'ironGreaves', head: 'ironHelm' } } });
      expect(session.view().player.hp).toBeGreaterThan(0);
    }
  });
  it('replays each equipment boundary and resumes from multiple saves with identical state', () => {
    const { session, commands, states } = clearRoom(42);
    for (let i = 0; i < states.length; i++) expect(session.replay(i)).toEqual(states[i]);
    for (const cut of [0, 4, 10, 14]) {
      const part = new GameSession(42, 'room'); commands.slice(0, cut).forEach(c => part.submit(c));
      const loaded = GameSession.fromArchive(part.capture()); commands.slice(cut).forEach(c => loaded.submit(c)); expect(loaded.capture()).toBe(session.capture());
    }
    const live = new GameSession(7, 'room'), before = live.capture();
    expect(() => live.restore(new GameSession().capture())).toThrow(); expect(live.capture()).toBe(before);
    const forged = JSON.parse(before); forged.world.player.equipment.chest = 'ironCuirass';
    expect(() => live.restore(JSON.stringify(forged))).toThrow(); expect(live.capture()).toBe(before);
  });
  it('rejects unowned gear, repeated changes and empty slots atomically; costs valid changes', () => {
    const session = new GameSession(9, 'room'), initial = session.capture();
    for (const command of ['equip:ironCuirass', 'equip:sword', 'equip:unknown', 'unequip:unknown']) expect(session.submit(command as Command).accepted).toBe(false);
    expect(session.capture()).toBe(initial);
    expect(session.submit('unequip:mainHand').accepted).toBe(true); expect(session.view().tick).toBe(8); expect(session.view().gear!.damage).toBe(2);
    const empty = session.capture(); expect(session.submit('unequip:mainHand').accepted).toBe(false); expect(session.capture()).toBe(empty);
    session.submit('equip:sword'); expect(session.view().gear!.damage).toBe(7);
    const view = session.view(); view.player.inventory!.push('ironHelm'); view.gear!.catalog[0]!.armor = 999; expect(session.view().player.inventory).not.toContain('ironHelm');
  });
  it('armor changes actual incoming damage, and dead actors cannot change equipment (controlled fixture)', () => {
    const world = createWorld(7, 'room'); world.enemies[0]!.x = 2; world.enemies[0]!.nextAt = 1;
    const defended = accept(world, 'wait'); world.player.equipment!.chest = null; world.player.equipment!.offHand = null;
    const bare = accept(world, 'wait');
    if (!defended.accepted || !bare.accepted) throw new Error('expected accepted');
    expect(defended.world.player.hp - bare.world.player.hp).toBe(2);
    world.status = 'dead'; expect(accept(world, 'unequip:head').accepted).toBe(false);
  });
  it('equipment presentation and ladder IK never modify the session; foot and hand contacts are reachable', () => {
    const data = parseRig(JSON.parse(readFileSync(new URL('../public/assets/character-study/motions.json', import.meta.url), 'utf8')));
    const session = new GameSession(7, 'room'), before = session.capture(); const actor = new BlockCharacter(data); actor.setEquipment(appearance(session.view()));
    let max = 0;
    for (let i = 0; i <= 100; i++) {
      const y = i / 100 * 3.4; actor.root.position.set(8, y, .14); actor.root.rotation.y = Math.PI; actor.sample('climb', i / 100);
      max = Math.max(max, poseOnLadder(actor, 8, y));
    }
    expect(max).toBeLessThan(.015); expect(session.capture()).toBe(before); actor.dispose();
  });
  it('mixes head/chest/leg styles independently and masks covered torso faces', () => {
    const data = parseRig(JSON.parse(readFileSync(new URL('../public/assets/character-study/motions.json', import.meta.url), 'utf8')));
    const actor = new BlockCharacter(data);
    actor.setEquipment({ outfit: 'plate', legsStyle: 'leather', headStyle: 'cloth', helmet: false, sword: true, shield: false });
    const styles: Record<string, Set<string>> = { head: new Set(), chest: new Set(), legs: new Set() };
    actor.root.traverse(o => { if (o.userData.slot && o.visible) styles[o.userData.slot]!.add(o.userData.style); });
    expect([...styles.head!]).toEqual([]); expect([...styles.chest!]).toEqual(['plate']); expect([...styles.legs!]).toEqual(['leather']);
    expect(actor.shield.root.visible).toBe(false); expect(actor.sword.root.visible).toBe(true);
    const torso = actor.root.getObjectByName('SkinnedUndertunic') as import('three').SkinnedMesh;
    expect(Array.isArray(torso.material) && torso.material[4]!.visible).toBe(false);
    actor.setEquipment({ outfit: 'cloth', helmet: false, sword: false, shield: false });
    expect(Array.isArray(torso.material) && torso.material[4]!.visible).toBe(true); actor.dispose();
  });
  it('faces a nearby attack target in the room without changing M01 behavior (controlled fixture)', () => {
    const room = createWorld(7, 'room'); room.player.face = -1; room.enemies[0]!.x = 2;
    const result = accept(room, 'attack'); if (!result.accepted) throw new Error('attack'); expect(result.world.player.face).toBe(1);
    const mine = createWorld(7); mine.player.face = -1; mine.enemies[0]!.x = 3;
    const old = accept(mine, 'attack'); if (!old.accepted) throw new Error('attack'); expect(old.world.player.face).toBe(-1);
  });
});
