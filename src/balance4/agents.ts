import type { Command, Position } from '../core/types';
import type { ItemSlot } from '../core/alpha2-types';
import type { Agent, Observation, RunConfig } from '../balance/types';

// This module has NO runtime access to a session, content registry or world.
// The only game input is the frozen public observation passed to next().
export function choiceRandom(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return value >>> 0; };
}
const equipmentSlots: Record<string, ItemSlot> = {
  sword: 'mainHand', knife: 'mainHand', maul: 'mainHand', spear: 'mainHand', bow: 'mainHand', fireblade: 'mainHand', silverblade: 'mainHand', staff: 'mainHand',
  brigandine: 'chest', plate: 'chest', leather: 'chest', cap: 'head', helm: 'head', boots: 'legs', shield: 'offHand', tower: 'offHand',
};
const key = (p: Position) => `${p.floor}:${p.x}`;
function path(view: Observation, target: Position, rejected: readonly Command[], blocked: ReadonlySet<string>): Command | null {
  const queue: { p: Position; first: Command | null }[] = [{ p: view.player, first: null }], seen = new Set([key(view.player)]);
  for (let index = 0; index < queue.length; index++) {
    const { p, first } = queue[index]!;
    if (key(p) === key(target)) return first;
    const moves: [Command, Position][] = [['left', { ...p, x: p.x - 1 }], ['right', { ...p, x: p.x + 1 }]];
    for (const [command, floor] of [['up', p.floor - 1], ['down', p.floor + 1]] as const)
      if (view.map.ladders.some(l => l.floor === Math.min(p.floor, floor) && l.x === p.x)) moves.push([command, { floor, x: p.x }]);
    for (const [command, next] of moves) {
      if (blocked.has(`${key(p)}:${command}`)) continue;
      if (!first && rejected.includes(command)) continue;
      if (next.floor < 0 || next.floor >= view.map.floors || next.x < 1 || next.x >= view.map.width - 1 || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push({ p: next, first: first ?? command });
    }
  }
  return null;
}

export function createResourceAgent4(config: RunConfig): Agent {
  const random = choiceRandom(config.choiceSeed ?? config.seed), attemptedEquipment = new Set<number>(), blocked = new Set<string>();
  let floor = 0, sweep = 0, retreatRevision = -100;
  return {
    next(view, rejected) {
      const state = view.alpha2;
      if (!state || view.status !== 'playing') return null;
      // A refused ladder is observed through the formal command response, not
      // through the unseen destination. Remember it so another ladder is tried.
      for (const command of rejected) if (command === 'up' || command === 'down') blocked.add(`${key(view.player)}:${command}`);
      const allowed = (command: Command) => !rejected.includes(command);
      if (view.revision === 0) return `choose:${config.loadout}`;
      const care = config.strategy === 'survivor', fighter = config.strategy === 'fighter';
      const threshold = care ? 0.65 : fighter ? 0.4 : 0.25;
      if (view.player.hp < view.player.maxHp * threshold && view.player.potions && allowed('potion')) return 'potion';
      const antidote = state.bag.find(i => i.definition === 'antidote');
      if (care && antidote && state.conditions.some(c => c.kind === 'poison')) {
        const command: Command = `a2:use:${antidote.id}:drink:self`;
        if (allowed(command)) return command;
      }
      if (state.food < state.maxFood * (care ? 0.7 : 0.4)) {
        const food = state.bag.find(i => i.category === 'food' && i.freshness !== 'stale' && (i.definition !== 'mushroom' || i.proof) && allowed(`a2:use:${i.id}:eat:self`));
        if (food) return `a2:use:${food.id}:eat:self`;
      }
      if (state.conditions.some(c => c.kind === 'sleep')) return allowed('wait') ? 'wait' : null;
      const threats = view.enemies.filter(e => e.floor === view.player.floor).sort((a, b) => Math.abs(a.x - view.player.x) - Math.abs(b.x - view.player.x) || a.id - b.id);
      const enemy = threats[0], distance = enemy ? Math.abs(enemy.x - view.player.x) : Infinity;
      // Retreat is a bounded response to a visible, imminent locked-cell attack.
      if (care && enemy?.intent && view.revision > retreatRevision + 2 && enemy.nextAt - view.tick <= 12 && Math.abs(enemy.intent.x - view.player.x) <= 1) {
        const command = enemy.x >= view.player.x ? 'left' : 'right', x = view.player.x + (command === 'left' ? -1 : 1);
        if (x >= 1 && x < view.map.width - 1 && !view.alpha?.doors.some(d => d.floor === view.player.floor && d.x === x && !d.open) && allowed(command)) {
          retreatRevision = view.revision; return command;
        }
      }
      if (config.strategy !== 'novice' && state.bag.some(i => i.equipped === 'mainHand' && i.definition === 'staff') && view.alpha && state.mana >= view.alpha.spellCost && distance <= view.alpha.range && allowed('cast')) return 'cast';
      if (enemy && distance <= state.attackRange && allowed('attack')) return 'attack';
      const fountain = state.facilities.find(f => f.near && !f.used && f.kind === 'fountain' && allowed(`a2:feature:${f.id}:drink`));
      if (fountain && view.player.hp < view.player.maxHp * (care ? 0.85 : 0.5)) return `a2:feature:${fountain.id}:drink`;
      const trap = state.facilities.find(f => f.near && !f.used && f.kind === 'trap' && allowed(`a2:feature:${f.id}:disarm`));
      if (care && trap) return `a2:feature:${trap.id}:disarm`;
      if (config.strategy !== 'novice' && !enemy) {
        for (const item of state.bag) {
          const slot = item.definition ? equipmentSlots[item.definition] : undefined;
          if (!slot || item.equipped || item.blessing === 'cursed' || attemptedEquipment.has(item.id) || !allowed(`wear:${item.id}`)) continue;
          const current = state.bag.find(i => i.equipped === slot);
          const score = (i: typeof item | undefined) => slot === 'mainHand' ? ((i?.damage ?? 0) / (i?.time ?? 12)) : (i?.armor ?? 0);
          // Preserve channeler's known spell capability; other upgrades use visible stats.
          if (current?.definition === 'staff' || score(item) <= score(current)) continue;
          attemptedEquipment.add(item.id); return `wear:${item.id}`;
        }
      }
      if (!view.player.relic && view.loot.some(i => i.kind === 'relic' && i.floor === view.player.floor && Math.abs(i.x - view.player.x) <= 1) && allowed('interact')) return 'interact';
      if ((state.capacityUsed ?? state.bag.length) < state.capacity && (!enemy || distance > (care ? 2 : 1))) {
        const items = state.nearby.filter(i => allowed(`take:${i.id}`) && (
          ['renewal', 'antidote', 'ration', 'fruit'].includes(i.definition ?? '') ||
          (care && i.category === 'armor' && i.definition && equipmentSlots[i.definition] && (i.armor ?? 0) > (state.bag.find(b => b.equipped === equipmentSlots[i.definition!])?.armor ?? 0)) ||
          (fighter && i.category === 'weapon' && (i.damage ?? 0) / (i.time ?? 12) > (state.bag.find(b => b.equipped === 'mainHand')?.damage ?? 0) / (state.attackCost || 12))));
        if (items.length) return `take:${items[random() % items.length]!.id}`;
      }
      // M26 explicit public resource policy, identical for both experiment arms.
      if (!enemy && (state.capacityUsed ?? state.bag.length) < state.capacity) {
        const resource = state.facilities.find(f => f.near && !f.used && (f.kind === 'garden' || f.kind === 'chest' && view.player.gold >= 10) && allowed(`a2:feature:${f.id}:${f.kind === 'garden' ? 'harvest' : 'pay'}`));
        if (resource) return `a2:feature:${resource.id}:${resource.kind === 'garden' ? 'harvest' : 'pay'}`;
      }
      if (fighter && enemy && distance <= 5) {
        const command = enemy.x < view.player.x ? 'left' : 'right';
        if (allowed(command) && !view.alpha?.doors.some(d => d.floor === view.player.floor && d.x === view.player.x + (command === 'left' ? -1 : 1) && !d.open)) return command;
      }
      let target: Position;
      if (view.player.relic) target = view.map.exit ?? { floor: 0, x: 1 };
      else {
        if (view.player.floor > floor) { floor = view.player.floor; sweep = 0; }
        if (sweep === 0 && view.player.x === 1) sweep = 1;
        if (sweep === 1 && view.player.x === view.map.width - 2) sweep = 2;
        if (sweep < 2) target = { floor, x: sweep === 0 ? 1 : view.map.width - 2 };
        else if (floor < view.map.floors - 1) {
          const ladders = view.map.ladders.filter(l => l.floor === floor && !blocked.has(`${key(l)}:down`));
          if (!ladders.length) return null;
          target = { floor: floor + 1, x: ladders.reduce((a, b) => Math.abs(a.x - view.player.x) <= Math.abs(b.x - view.player.x) ? a : b).x };
        } else return null;
      }
      const command = path(view, target, rejected, blocked);
      if (command === 'left' || command === 'right') {
        const door = view.alpha?.doors.find(d => d.floor === view.player.floor && d.x === view.player.x + (command === 'left' ? -1 : 1) && !d.open);
        if (door) {
          const open: Command = `${door.locked ? 'lever' : 'door'}:${door.id}`;
          if (allowed(open)) return open;
        }
      }
      return command;
    },
  };
}
