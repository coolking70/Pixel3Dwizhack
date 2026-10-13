import { ALPHA3 as C } from '../content/alpha3';
import { acceptAlpha2, createAlpha2, inspectAlpha2, isAlpha2Command } from './alpha2';
import { advance2 } from './alpha2-clock';
import { damage2, effect2 } from './alpha2-effects';
import { S2, beat2, condition2, def2, item2, know2, log2, near2, pos2, reveal2, visible2 } from './alpha2-shared';
import type { Command, Outcome, Position, PublicView, World } from './types';
import type { ThrowReceipt3 } from './alpha3-types';

export function isAlpha3Command(value: unknown): value is Command {
  return isAlpha2Command(value) || typeof value === 'string' && /^a3:throw:[1-9]\d{0,4}:[0-5]:(?:[1-9]|1\d|2[0-8])$/.test(value);
}
export function createAlpha3(seed: number): World {
  const w = createAlpha2(seed); w.scenario = 'alpha3'; w.alpha3 = { lastThrow: null }; return w;
}
export function inspectAlpha3(w: World): PublicView {
  return { ...inspectAlpha2(w), alpha3: structuredClone(w.alpha3!) };
}
export function validThrowCell3(w: World, p: Position): boolean {
  const distance = Math.abs(p.x - w.player.x);
  return Number.isInteger(p.x) && Number.isInteger(p.floor) && p.floor === w.player.floor && p.x >= 1 && p.x < 29
    && distance > 0 && distance <= C.range && !!w.explored[p.floor]?.includes(p.x) && visible2(w, p);
}
export function acceptAlpha3(current: World, command: Command): Outcome {
  if (!isAlpha3Command(command)) return { accepted: false, reason: 'invalid' };
  if (!command.startsWith('a3:throw:')) {
    const result = acceptAlpha2(current, command);
    if (result.accepted) result.world.alpha3 = { lastThrow: null };
    return result;
  }
  if (current.status !== 'playing') return { accepted: false, reason: 'ended' };
  const [, , rawId, rawFloor, rawX] = command.split(':');
  const id = Number(rawId), requested = { floor: Number(rawFloor), x: Number(rawX) };
  const source = item2(current, id);
  if (!source || source.owner !== 'bag' || Object.values(S2(current).equipped).includes(id)
      || condition2(current, 'sleep') || !validThrowCell3(current, requested)) return { accepted: false, reason: 'invalid' };
  const w = structuredClone(current), s = S2(w), item = item2(w, id)!, definition = def2(item);
  w.beats = []; s.chosen = true;
  const step = Math.sign(requested.x - w.player.x);
  let landing = pos2(w.player);
  let collision: ThrowReceipt3['collision'] = { kind: 'ground' };
  for (let x = w.player.x + step; ; x += step) {
    const cell = { floor: requested.floor, x };
    const door = s.doors.find(d => !d.open && d.floor === cell.floor && d.x === x);
    if (door) { collision = { kind: 'door', id: door.id }; break; }
    landing = cell;
    const enemy = w.enemies.filter(e => e.hp > 0 && e.floor === cell.floor && e.x === x).sort((a, b) => a.id - b.id)[0];
    if (enemy) { collision = { kind: 'enemy', id: enemy.id }; break; }
    if (x === requested.x) {
      const facility = s.facilities.filter(f => f.revealed && f.floor === cell.floor && f.x === x).sort((a, b) => a.id - b.id)[0];
      if (facility) collision = { kind: 'facility', id: facility.id };
      break;
    }
  }
  if (definition.category === 'potion') {
    const fx = definition.actions.throw;
    const enemy = collision.kind === 'enemy' ? w.enemies.find(e => e.id === collision.id) : undefined;
    const facility = collision.kind === 'facility' ? s.facilities.find(f => f.id === collision.id) : undefined;
    // A successful effect dispatch can still be a no-op (immunity, full HP,
    // or curing an absent condition). Only an observable change identifies it.
    const observed = () => enemy ? JSON.stringify([enemy.hp, s.conditions.filter(c => c.actor === enemy.id).map(c => [c.kind,c.power,c.until,c.nextAt])]) : JSON.stringify(facility?.used);
    const beforeEffect = observed();
    if (fx && (enemy || facility) && effect2(w, fx, enemy ? { kind: 'enemy', actor: enemy.id, enemy } : { kind: 'facility', facility: facility! }, item) && observed() !== beforeEffect) know2(w, item);
    item.owner = 'spent';
  } else {
    if (collision.kind === 'enemy') damage2(w, collision.id, C.impact, 'physical', `item:${id}`);
    item.owner = 'ground';
  }
  item.position = pos2(landing); item.holder = null;
  w.player.face = step as -1 | 1;
  beat2(w, { kind: 'attack', actor: 0, target: collision.kind === 'enemy' ? collision.id : undefined, position: pos2(w.player), targetPosition: pos2(landing), mode: 'spell' });
  log2(w, { key: 'used', name: `item:${id}` });
  w.alpha3 = { lastThrow: { revision: w.revision + 1, itemId: id, requested, landing, collision, consumed: item.owner === 'spent' } };
  advance2(w, C.throwCost * (condition2(w, 'slow') ? 2 : 1));
  if (w.status === 'playing' && w.player.relic && w.player.floor === 0 && w.player.x === 1) { w.status = 'won'; log2(w, { key: 'won' }); }
  reveal2(w); w.revision++;
  const newly = w.enemies.some(e => e.hp > 0 && visible2(w, e) && !current.enemies.some(old => old.id === e.id && old.hp > 0 && visible2(current, old)));
  return { accepted: true, world: w, interrupt: newly || w.player.hp < current.player.hp || w.status !== 'playing' || w.enemies.some(e => e.hp > 0 && near2(w, e)) };
}
