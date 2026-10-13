import { EXPEDITION } from '../content/expedition';
import type { Enemy, GearId, Slot, World } from './types';
import type { Effect, ExpeditionState, ItemInstance } from './expedition-types';
export function roll(source: { rng: number }): number {
  let x = source.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; source.rng = x >>> 0; return source.rng;
}
export function generateExpedition(world: World): ExpeditionState {
  const ladders = Array.from({ length: EXPEDITION.floors - 1 }, (_, i) => (i % 2 ? 15 : 7) + roll(world) % 4);
  const templates = Array.from({ length: EXPEDITION.floors }, (_, i) => i === 0 ? 'supply' as const : EXPEDITION.templates[roll(world) % 3]!);
  const relicX = ladders.at(-1)! < 13 ? 22 : 3;
  const map: ExpeditionState['map'] = { width: EXPEDITION.width, floors: EXPEDITION.floors, sight: EXPEDITION.sight, ladders,
    themes: [...EXPEDITION.themes], templates, shrines: [1, 3].map(floor => ({ floor, x: floor === 1 ? 3 : 22, used: false })), relic: { floor: 5, x: relicX } };
  const items: ItemInstance[] = [], equipped = { head: null, chest: null, legs: null, mainHand: null, offHand: null } as Record<Slot, number | null>;
  const add = (kind: ItemInstance['kind'], x: number, floor: number, extra: Partial<ItemInstance> = {}): ItemInstance => {
    const item: ItemInstance = { id: items.length + 1, kind, quality: 0, owner: 'ground', position: { x, floor }, ...extra }; items.push(item); return item;
  };
  const initial: [Slot, GearId][] = [['head', 'leatherCap'], ['chest', 'leatherVest'], ['legs', 'leatherLegs'], ['mainHand', 'sword'], ['offHand', 'shield']];
  for (const [slot, gear] of initial) equipped[slot] = add('gear', 2, 0, { gear, owner: 'bag' }).id;
  add('flask', 2, 0, { effect: 'healing', owner: 'bag' }); add('flask', 2, 0, { effect: 'healing', owner: 'bag' }); add('scroll', 2, 0, { owner: 'bag' });
  world.enemies = [];
  const enemy = (x: number, floor: number, kind: 'crawler' | 'guard', elite = false): void => {
    const hp = elite ? 64 : kind === 'guard' ? 30 + floor * 3 : 18 + floor * 2;
    const period = kind === 'guard' ? 32 : 26;
    const e: Enemy = { id: world.enemies.length + 1, x, floor, kind, hp, maxHp: hp, period, nextAt: period, damage: elite ? 15 : kind === 'guard' ? 10 + floor : 5 + Math.floor(floor / 2), elite, venom: kind === 'crawler' && floor >= 2 };
    world.enemies.push(e);
  };
  // Each floor is a continuous corridor. Alternating ladders create the main
  // route; endpoint caches and shrines form optional spurs without jump gaps.
  for (let floor = 0; floor < map.floors; floor++) {
    const entry = floor ? ladders[floor - 1]! : 2;
    const exit = floor === 5 ? relicX : ladders[floor]!;
    let middle = Math.round((entry + exit) / 2);
    if (floor === 0) middle = Math.max(7, exit + 1); // Safe first steps and no blocked starting tile.
    enemy(middle, floor, floor === 5 || templates[floor] === 'watch' ? 'guard' : 'crawler', floor === 5);
    if (floor > 0 && floor < 5 && templates[floor] === 'nest') enemy(Math.min(23, Math.max(entry, exit) + 3), floor, 'crawler');
    add('flask', entry, floor, { effect: 'healing' });
    add('flask', floor % 2 ? 22 : 3, floor, { effect: EXPEDITION.effects[1 + roll(world) % 3] });
    if (floor % 2 === 1) add('scroll', floor % 4 === 1 ? 22 : 3, floor);
    const gear: GearId = ['ironCuirass', 'mace', 'ironGreaves', 'towerShield', 'ironHelm', 'sword'][floor] as GearId;
    add('gear', floor === 0 ? Math.min(12, exit + 2) : floor % 2 ? 22 : 3, floor, { gear, quality: floor >= 3 ? 1 : 0 });
  }
  add('relic', relicX, 5);
  const colors = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = roll(world) % (i + 1); [colors[i], colors[j]] = [colors[j]!, colors[i]!]; }
  const appearances = Object.fromEntries(EXPEDITION.effects.map((e, i) => [e, colors[i]!])) as Record<Effect, number>;
  return { map, items, equipped, identified: ['healing'], appearances, effects: [], kills: 0, collected: 0 };
}
