import { GameSession } from '../src/session/session';
export { GameSession } from '../src/session/session';
import type { Command } from '../src/core/types';

// Player policy uses only public information. No teleport, hidden item lookup
// or snapshot edit. The caller can retain the complete deterministic trace.
export function runExpedition(seed: number, branch = false) {
  const session = new GameSession(seed, 'expedition'), commands: Command[] = [], states = [session.view()];
  const visitedItems = new Set<number>();
  function act(c: Command): void {
    const r = session.submit(c); if (!r.accepted) throw new Error(`${c}: ${r.reason} ${JSON.stringify(session.view().player)}`);
    commands.push(c); states.push(session.view());
  }
  function care(): void {
    const v = session.view();
    const antidote = v.expedition!.bag.find(i => i.effect === 'antidote');
    if (antidote && v.expedition!.effects.some(e => e.kind === 'poison')) act(`use:${antidote.id}`);
    if (session.view().player.hp <= 30 && session.view().player.potions) act('potion');
  }
  function collect(): void {
    const candidates = session.view().expedition!.nearby.filter(i => !visitedItems.has(i.id));
    for (const item of candidates) {
      if (item.kind === 'relic' && !session.view().expedition!.bossDefeated) continue;
      if (item.kind !== 'relic' && session.view().expedition!.bag.length >= 16) {
        const junk = session.view().expedition!.bag.find(i => i.kind === 'gear' && !i.equipped);
        if (!junk) continue; act(`drop:${junk.id}`); visitedItems.add(junk.id);
      }
      care(); act(`take:${item.id}`); visitedItems.add(item.id);
      if (item.gear) {
        const v = session.view(), slot = v.gear!.catalog.find(g => g.id === item.gear)!.slot;
        const current = v.expedition!.bag.find(i => i.equipped === slot);
        if (!current || item.damage! + item.armor! * 1.5 > current.damage! + current.armor! * 1.5) act(`wear:${item.id}`);
      }
      const v = session.view();
      if (item.kind === 'flask' && !item.effect && v.expedition!.bag.some(i => i.kind === 'scroll')) act(`identify:${item.id}`);
      const identified = session.view().expedition!.bag.find(i => i.id === item.id);
      if (identified?.effect === 'might' || identified?.effect === 'ward') act(`use:${item.id}`);
    }
  }
  function go(x: number): void {
    let budget = 180;
    while (session.view().player.x !== x && budget-- > 0) { care(); collect(); act(session.view().player.x < x ? 'right' : 'left'); }
    if (session.view().player.x !== x) throw new Error('route budget');
    if (session.view().status === 'playing') collect();
  }
  for (let floor = 0; floor < 6; floor++) {
    collect();
    if (branch) { go(3); go(22); }
    if (floor === 5) { go(session.view().player.x < 13 ? 22 : 3); if (!session.view().player.relic) go(22); break; }
    let ladder = session.view().map.ladders.find(l => l.floor === floor);
    for (let x = session.view().player.x; !ladder && x <= 24; x++) { go(x); ladder = session.view().map.ladders.find(l => l.floor === floor); }
    if (!ladder) { go(3); ladder = session.view().map.ladders.find(l => l.floor === floor); }
    if (!ladder) throw new Error('unreachable ladder');
    if (floor === 0) go(Math.min(12, ladder.x + 2)); // Visible first armor cache.
    go(ladder.x); care(); act('down');
  }
  if (!session.view().player.relic) throw new Error(`relic missing seed=${seed} branch=${branch} ${JSON.stringify(session.view().expedition)}`);
  for (let floor = 5; floor > 0; floor--) { const ladder = session.view().map.ladders.find(l => l.floor === floor-1)!; go(ladder.x); care(); act('up'); }
  go(1);
  return { session, commands, states };
}
