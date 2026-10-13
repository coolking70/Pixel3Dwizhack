import { GEAR } from './room';
export const DUNGEON_GEAR = Object.freeze({ ...GEAR,
  mace: { slot: 'mainHand', armor: -1, damage: 8 },
  towerShield: { slot: 'offHand', armor: 3, damage: -2 },
} as const);
export const DUNGEON = Object.freeze({
  width: 24, floors: 3, sight: 6, ladders: [10, 17],
  costs: { move: 10, climb: 16, attack: 12, interact: 8, potion: 12, wait: 10, equip: 8 },
  playerHp: 44, playerDamage: 2, damageVariance: 3, healing: 22,
  enemyHp: 22, enemyDamage: 6,
  start: { x: 2, floor: 0 }, exit: { x: 1, floor: 0 },
  enemies: [
    { kind: 'crawler', x: 8, floor: 0, hp: 22, period: 24, damage: 6 },
    { kind: 'guard', x: 5, floor: 1, hp: 36, period: 30, damage: 13 },
    { kind: 'crawler', x: 18, floor: 1, hp: 24, period: 24, damage: 6 },
    { kind: 'crawler', x: 11, floor: 2, hp: 22, period: 24, damage: 6 },
    { kind: 'guard', x: 6, floor: 2, hp: 42, period: 30, damage: 14 },
  ],
  drops: [
    { kind: 'gear', gear: 'ironCuirass', x: 8, floor: 0, amount: 1 },
    { kind: 'potion', x: 9, floor: 0, amount: 1 },
    { kind: 'gear', gear: 'mace', x: 3, floor: 1, amount: 1 },
    { kind: 'gear', gear: 'towerShield', x: 3, floor: 1, amount: 1 },
    { kind: 'gear', gear: 'ironHelm', x: 4, floor: 1, amount: 1 },
    { kind: 'potion', x: 4, floor: 1, amount: 1 },
    { kind: 'gear', gear: 'ironGreaves', x: 15, floor: 1, amount: 1 },
    { kind: 'potion', x: 17, floor: 2, amount: 1 },
    { kind: 'relic', x: 3, floor: 2, amount: 1 },
  ],
} as const);
