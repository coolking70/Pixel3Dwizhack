import type { Command } from '../core/types';
import type { Agent, Observation } from './types';
import type { ExperimentConfig } from './experiments';
import { createAgent, choiceRandom } from './agents';
/** Strategy intervention only: never injects items, rewrites worlds or extracts
 * hidden definitions. Original m16-public-1 policy code is intentionally frozen. */
export function experimentAgent(config: ExperimentConfig, exposure: { unknown: Set<number>; weapons: Set<number> }): Agent {
  const base = createAgent(config.base), random = choiceRandom(config.base.choiceSeed ?? config.base.seed), tried = new Set<number>();
  const usedUnknown = new Set<number>();
  const forbidden = (command: Command, view: Observation) => config.intervention === 'no-item-use' && (command === 'potion' || command.startsWith('a2:use:')) ||
    config.intervention === 'keep-starting-weapon' && command.startsWith('wear:') && view.alpha2!.bag.some(i => i.id === Number(command.slice(5)) && i.category === 'weapon');
  return { next(view, rejected) {
    const state = view.alpha2;
    if (!state || view.status !== 'playing') return null;
    for (const item of [...state.bag, ...state.ground]) {
      if (!item.definition) exposure.unknown.add(item.id);
      if (item.category === 'weapon' && !item.equipped) exposure.weapons.add(item.id);
    }
    const suppressed: Command[] = [];
    let ordinary: Command | null = null;
    for (let i = 0; i < 32; i++) {
      ordinary = base.next(view, [...rejected, ...suppressed]);
      if (!ordinary || !forbidden(ordinary, view)) break;
      suppressed.push(ordinary); ordinary = null;
    }
    if (view.revision === 0 || state.conditions.some(c => c.kind === 'sleep') || ordinary === 'potion' || ordinary?.includes(':eat:') || ordinary?.includes(':drink:')) return ordinary;
    const available = (command: Command) => !rejected.includes(command) && !forbidden(command, view);
    const enemy = view.enemies.filter(e => e.floor === view.player.floor && Math.abs(e.x - view.player.x) <= 4).sort((a, b) => a.id - b.id)[0];
    if (config.intervention !== 'no-item-use') {
      if (enemy) {
        const wand = state.bag.find(i => i.category === 'wand' && i.charges !== 0 && i.definition !== 'mending' && available(`a2:use:${i.id}:zap:e${enemy.id}`));
        if (wand) return `a2:use:${wand.id}:zap:e${enemy.id}`;
        const flask = state.bag.find(i => i.category === 'potion' && (!i.definition || ['venom','slumber','acid'].includes(i.definition)) && available(`a2:use:${i.id}:throw:e${enemy.id}`));
        if (flask) return `a2:use:${flask.id}:throw:e${enemy.id}`;
      } else {
        const unknown = state.bag.find(i => !i.definition && !usedUnknown.has(i.id) && ['potion','scroll','wand'].includes(i.category));
        if (unknown) {
          const scroll = state.bag.find(i => i.definition === 'insight');
          // Alternate legitimate identification and blind trial by independent
          // strategy PRNG; never inspect the unknown effect to choose a target.
          if (scroll && random() % 2 === 0) {
            const command: Command = `a2:use:${scroll.id}:read:i${unknown.id}`;
            if (available(command)) return command;
          }
          if (unknown.category === 'potion' || unknown.category === 'scroll') {
            usedUnknown.add(unknown.id);
            const command: Command = `a2:use:${unknown.id}:${unknown.category === 'potion' ? 'drink' : 'read'}:self`;
            if (available(command)) return command;
          }
        }
      }
    }
    if (!enemy && state.bag.length < state.capacity) {
      const candidate = state.nearby.find(i => !tried.has(i.id) && ['potion','scroll','wand','weapon'].includes(i.category) && available(`take:${i.id}`));
      if (candidate) { tried.add(candidate.id); return `take:${candidate.id}`; }
    }
    return ordinary;
  } };
}

