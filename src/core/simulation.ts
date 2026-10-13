import {acceptAlpha6,createAlpha6,inspectAlpha6,isAlpha6Command} from './alpha6';
import { acceptAlpha5, createAlpha5, inspectAlpha5, isAlpha5Command } from './alpha5';
import { acceptAlpha4, createAlpha4, inspectAlpha4, isAlpha4Command } from './alpha4';
import { acceptAlpha3, createAlpha3, inspectAlpha3, isAlpha3Command } from './alpha3';
import {acceptAlpha2,createAlpha2,inspectAlpha2,isAlpha2Command} from './alpha2';
import { MINE } from '../content/mine';
import { GEAR, ROOM } from '../content/room';
import { DUNGEON, DUNGEON_GEAR } from '../content/dungeon';
import { acceptExpedition, createExpedition, inspectExpedition, isExpeditionCommand } from './expedition';
import { acceptAlpha, createAlpha, inspectAlpha, isAlphaCommand } from './alpha';
import { COMMANDS, SLOTS, type GearId, type Slot, type Scenario, type Command, type Enemy, type Fact, type Outcome, type PublicView, type World } from './types';

const content = (world: World) => world.scenario === 'dungeon' ? DUNGEON : world.scenario === 'room' ? ROOM : MINE;
const gearCatalog = (world: World): Partial<Record<GearId, { slot: Slot; armor: number; damage: number }>> => world.scenario === 'dungeon' ? DUNGEON_GEAR : GEAR;
export function isCommand(command: unknown, scenario: Scenario): command is Command {
  if (scenario === 'alpha6') return isAlpha6Command(command);
  if (scenario === 'alpha5') return isAlpha5Command(command);
  if (scenario === 'alpha4') return isAlpha4Command(command);
  if (scenario === 'alpha3') return isAlpha3Command(command);
  if (scenario === 'alpha2') return isAlpha2Command(command);
  if (scenario === 'alpha') return isAlphaCommand(command);
  if (scenario === 'expedition') return isExpeditionCommand(command);
  if (typeof command !== 'string') return false;
  if ((COMMANDS as readonly string[]).includes(command)) return true;
  if (scenario === 'mine') return false;
  return Object.keys(scenario === 'dungeon' ? DUNGEON_GEAR : GEAR).some(id => command === `equip:${id}`) || SLOTS.some(slot => command === `unequip:${slot}`);
}
function stats(world: World): { armor: number; damage: number } {
  const equipped = Object.values(world.player.equipment ?? {}).filter((id): id is GearId => id !== null);
  const gear = gearCatalog(world);
  return { armor: equipped.reduce((n, id) => n + gear[id]!.armor, 0), damage: Math.max(1, content(world).playerDamage + equipped.reduce((n, id) => n + gear[id]!.damage, 0)) };
}

function random(world: World): number {
  let x = world.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  world.rng = x >>> 0;
  return world.rng;
}
function emit(world: World, fact: Fact): void {
  world.events.push(fact);
  if (world.events.length > 24) world.events.shift();
}
function reveal(world: World): void {
  const MINE = content(world);
  const { x, floor } = world.player;
  const known = world.explored[floor]!;
  for (let tile = Math.max(0, x - MINE.sight); tile <= Math.min(MINE.width - 1, x + MINE.sight); tile++) {
    if (!known.includes(tile)) known.push(tile);
  }
  known.sort((a, b) => a - b);
}
export function createWorld(seed: number, scenario: Scenario = 'mine'): World {
  if (scenario === 'alpha6') return createAlpha6(seed);
  if (scenario === 'alpha5') return createAlpha5(seed);
  if (scenario === 'alpha4') return createAlpha4(seed);
  if (scenario === 'alpha3') return createAlpha3(seed);
  if (scenario === 'alpha2') return createAlpha2(seed);
  if (scenario === 'alpha') return createAlpha(seed);
  if (scenario === 'expedition') return createExpedition(seed);
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('seed');
  const world: World = {
    seed, rng: seed, tick: 0, revision: 0, status: 'playing',
    player: { x: 2, floor: 0, hp: MINE.playerHp, maxHp: MINE.playerHp, face: 1, potions: 2, gold: 0, relic: false },
    enemies: MINE.enemies.map((position, index) => ({ ...position, id: index + 1, hp: MINE.enemyHp, maxHp: MINE.enemyHp, period: MINE.enemyPeriods[index]!, nextAt: MINE.enemyPeriods[index]! })),
    loot: [
      { id: 1, kind: 'coins', x: 5, floor: 0, amount: 0, taken: false },
      { id: 2, kind: 'potion', x: 15, floor: 1, amount: 1, taken: false },
      { id: 3, kind: 'relic', ...MINE.treasure, amount: 1, taken: false },
    ],
    explored: Array.from({ length: MINE.floors }, () => []), events: [{ kind: 'start' }],
  };
  world.loot[0]!.amount = 15 + random(world) % 16;
  if (scenario === 'room') {
    world.scenario = 'room';
    world.player = { ...world.player, ...ROOM.start, hp: ROOM.playerHp, maxHp: ROOM.playerHp,
      inventory: ['leatherCap', 'leatherVest', 'leatherLegs', 'sword', 'shield'],
      equipment: { head: 'leatherCap', chest: 'leatherVest', legs: 'leatherLegs', mainHand: 'sword', offHand: 'shield' } };
    world.enemies = ROOM.enemies.map((p, i) => ({ ...p, id: i + 1, hp: ROOM.enemyHp, maxHp: ROOM.enemyHp, period: ROOM.enemyPeriods[i]!, nextAt: ROOM.enemyPeriods[i]! }));
    world.loot = ROOM.drops.map((p, i) => ({ ...p, id: i + 1, kind: 'gear', amount: 1, taken: false }));
    world.explored = Array.from({ length: ROOM.floors }, () => []);
  }
  if (scenario === 'dungeon') {
    world.scenario = 'dungeon';
    world.player = { ...world.player, ...DUNGEON.start, hp: DUNGEON.playerHp, maxHp: DUNGEON.playerHp,
      inventory: ['leatherCap', 'leatherVest', 'leatherLegs', 'sword', 'shield'],
      equipment: { head: 'leatherCap', chest: 'leatherVest', legs: 'leatherLegs', mainHand: 'sword', offHand: 'shield' } };
    world.enemies = DUNGEON.enemies.map((e, i) => ({ ...e, id: i + 1, maxHp: e.hp, nextAt: e.period }));
    world.loot = DUNGEON.drops.map((p, i) => ({ ...p, id: i + 1, taken: false }));
    world.explored = Array.from({ length: DUNGEON.floors }, () => []);
  }
  reveal(world);
  return world;
}
function enemyAt(world: World, floor: number, x: number): Enemy | undefined {
  return world.enemies.find(enemy => enemy.hp > 0 && enemy.floor === floor && enemy.x === x);
}
function visible(world: World, object: { floor: number; x: number }): boolean {
  return object.floor === world.player.floor && Math.abs(object.x - world.player.x) <= content(world).sight;
}
export function inspect(world: World): PublicView {
  if (world.scenario === 'alpha6') return inspectAlpha6(world);
  if (world.scenario === 'alpha5') return inspectAlpha5(world);
  if (world.scenario === 'alpha4') return inspectAlpha4(world);
  if (world.scenario === 'alpha3') return inspectAlpha3(world);
  if (world.scenario === 'alpha2') return inspectAlpha2(world);
  if (world.scenario === 'alpha') return inspectAlpha(world);
  if (world.scenario === 'expedition') return inspectExpedition(world);
  const MINE = content(world);
  return structuredClone({
    ...(world.scenario ? { gear: { catalog: Object.entries(gearCatalog(world)).map(([id, spec]) => ({ id: id as GearId, ...spec })), ...stats(world) } } : {}),
    map: { width: MINE.width, floors: MINE.floors, sight: MINE.sight,
      ...(world.scenario === 'room' ? { exit: ROOM.exit } : world.scenario === 'dungeon' ? { exit: DUNGEON.exit, rooms: ['gate', 'armory', 'crypt'] as const } : {}),
      ladders: MINE.ladders.flatMap((x, floor) => world.explored[floor]!.includes(x) || world.explored[floor + 1]!.includes(x) ? [{ x, floor }] : []) },
    seed: world.seed, tick: world.tick, revision: world.revision, status: world.status,
    player: world.player, enemies: world.enemies.filter(enemy => enemy.hp > 0 && visible(world, enemy)),
    loot: world.loot.filter(loot => !loot.taken && visible(world, loot)), explored: world.explored, events: world.events,
  });
}
function strike(world: World, enemy: Enemy): void {
  const amount = Math.min(enemy.hp, Math.max(1, stats(world).damage + random(world) % content(world).damageVariance));
  enemy.hp -= amount;
  emit(world, { kind: 'hit', amount });
  if (enemy.hp === 0) { world.player.gold += 5; emit(world, { kind: 'defeat', amount: 5 }); }
}
// Only this function owns tick and enemy deadlines. Ordering is (nextAt, id).
function advance(world: World, cost: number): void {
  const target = world.tick + cost;
  while (world.status === 'playing') {
    const next = world.enemies.filter(enemy => enemy.hp > 0 && enemy.nextAt <= target)
      .sort((a, b) => a.nextAt - b.nextAt || a.id - b.id)[0];
    if (!next) { world.tick = target; break; }
    world.tick = next.nextAt;
    next.nextAt += next.period;
    if (next.kind === 'guard' && next.intent) {
      const target = next.intent; delete next.intent;
      if (world.player.floor === target.floor && Math.abs(world.player.x - target.x) <= 1) hurt(world, next.damage!);
      else if (visible(world, next)) emit(world, { kind: 'evade' });
      continue;
    }
    if (!visible(world, next)) continue;
    const distance = Math.abs(next.x - world.player.x);
    if (next.kind === 'guard' && distance > 4) continue;
    if (distance <= 1) {
      if (next.kind === 'guard') { next.intent = { x: world.player.x, floor: world.player.floor }; emit(world, { kind: 'windup' }); }
      else hurt(world, next.damage ?? content(world).enemyDamage);
    } else {
      const x = next.x + Math.sign(world.player.x - next.x);
      if (!enemyAt(world, next.floor, x)) next.x = x;
    }
  }
}
function hurt(world: World, attack: number): void {
  const damage = Math.max(1, attack - stats(world).armor);
  world.player.hp = Math.max(0, world.player.hp - damage);
  emit(world, { kind: 'hurt', amount: damage });
  if (world.player.hp === 0) { world.status = 'dead'; emit(world, { kind: 'dead' }); }
}
export function accept(current: World, command: Command): Outcome {
  if (current.scenario === 'alpha6') return acceptAlpha6(current, command);
  if (current.scenario === 'alpha5') return acceptAlpha5(current, command);
  if (current.scenario === 'alpha4') return acceptAlpha4(current, command);
  if (current.scenario === 'alpha3') return acceptAlpha3(current, command);
  if (current.scenario === 'alpha2') return acceptAlpha2(current, command);
  if (current.scenario === 'alpha') return acceptAlpha(current, command);
  if (current.scenario === 'expedition') return acceptExpedition(current, command);
  if (!isCommand(command, current.scenario ?? 'mine')) return { accepted: false, reason: 'invalid' };
  if (current.status !== 'playing') return { accepted: false, reason: 'ended' };
  const world = structuredClone(current);
  const player = world.player;
  const MINE = content(world);
  let cost: number = 0;
  if (command === 'left' || command === 'right') {
    const direction = command === 'left' ? -1 : 1;
    const x = player.x + direction;
    if (x < 1 || x >= MINE.width - 1) return { accepted: false, reason: 'wall' };
    player.face = direction;
    const enemy = enemyAt(world, player.floor, x);
    if (enemy) { strike(world, enemy); cost = MINE.costs.attack; }
    else { player.x = x; emit(world, { kind: 'move' }); cost = MINE.costs.move; }
  } else if (command === 'up' || command === 'down') {
    const floor = player.floor + (command === 'up' ? -1 : 1);
    if (floor < 0 || floor >= MINE.floors || player.x !== MINE.ladders[Math.min(floor, player.floor)]) return { accepted: false, reason: 'ladder' };
    if (enemyAt(world, floor, player.x)) return { accepted: false, reason: 'blocked' };
    player.floor = floor; cost = MINE.costs.climb; emit(world, { kind: 'climb' });
  } else if (command === 'attack') {
    const enemy = world.enemies.filter(enemy => enemy.hp > 0 && enemy.floor === player.floor && Math.abs(enemy.x - player.x) <= 1)
      .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x) || a.id - b.id)[0];
    if (enemy) {
      if (world.scenario && enemy.x !== player.x) player.face = enemy.x > player.x ? 1 : -1;
      strike(world, enemy);
    } else emit(world, { kind: 'miss' });
    cost = MINE.costs.attack;
  } else if (command === 'interact') {
    const loot = world.loot.find(loot => !loot.taken && loot.floor === player.floor && Math.abs(loot.x - player.x) <= 1);
    if (!loot) return { accepted: false, reason: 'empty' };
    loot.taken = true;
    if (loot.kind === 'coins') player.gold += loot.amount;
    if (loot.kind === 'potion') player.potions += loot.amount;
    if (loot.kind === 'relic') player.relic = true;
    if (loot.kind === 'gear' && loot.gear && player.inventory && !player.inventory.includes(loot.gear)) player.inventory.push(loot.gear);
    emit(world, { kind: 'pickup', item: loot.kind, amount: loot.amount, ...(loot.gear ? { gear: loot.gear } : {}) }); cost = MINE.costs.interact;
  } else if (command === 'potion') {
    if (!player.potions) return { accepted: false, reason: 'noPotion' };
    if (player.hp === player.maxHp) return { accepted: false, reason: 'fullHp' };
    const amount = Math.min(MINE.healing, player.maxHp - player.hp);
    player.potions--; player.hp += amount; cost = MINE.costs.potion; emit(world, { kind: 'heal', amount });
  } else if (command.startsWith('equip:') || command.startsWith('unequip:')) {
    if (!player.inventory || !player.equipment) return { accepted: false, reason: 'invalid' };
    if (command.startsWith('equip:')) {
      const id = command.slice(6) as GearId, slot = gearCatalog(world)[id]!.slot;
      if (!player.inventory.includes(id) || player.equipment[slot] === id) return { accepted: false, reason: 'invalid' };
      player.equipment[slot] = id; emit(world, { kind: 'equip', gear: id });
    } else {
      const slot = command.slice(8) as Slot;
      if (!player.equipment[slot]) return { accepted: false, reason: 'invalid' };
      const gear = player.equipment[slot]; player.equipment[slot] = null; emit(world, { kind: 'equip', gear, amount: 0 });
    }
    cost = world.scenario === 'dungeon' ? DUNGEON.costs.equip : ROOM.costs.equip;
  } else { cost = MINE.costs.wait; emit(world, { kind: 'wait' }); }
  advance(world, cost);
  const won = world.scenario === 'dungeon' ? player.floor === DUNGEON.exit.floor && player.x === DUNGEON.exit.x && player.relic : world.scenario === 'room' ? player.floor === ROOM.exit.floor && player.x === ROOM.exit.x && world.enemies.every(e => e.hp <= 0) && player.inventory!.includes('ironCuirass') : player.floor === 0 && player.x === 1 && player.relic;
  if (world.status === 'playing' && won) {
    world.status = 'won'; emit(world, { kind: 'won' });
  }
  reveal(world);
  world.revision++;
  const newlyVisible = world.enemies.some(enemy => enemy.hp > 0 && visible(world, enemy)
    && !current.enemies.some(old => old.id === enemy.id && old.hp > 0 && visible(current, old)));
  if (newlyVisible) emit(world, { kind: 'danger' });
  const interrupt = newlyVisible || player.hp < current.player.hp || world.status !== 'playing'
    || world.enemies.some(enemy => enemy.hp > 0 && enemy.floor === player.floor && Math.abs(enemy.x - player.x) <= 1);
  return { accepted: true, world, interrupt };
}
