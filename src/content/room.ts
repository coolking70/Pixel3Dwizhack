export const GEAR = Object.freeze({
  leatherCap: { slot: 'head', armor: 0, damage: 0 }, ironHelm: { slot: 'head', armor: 1, damage: 0 },
  leatherVest: { slot: 'chest', armor: 1, damage: 0 }, ironCuirass: { slot: 'chest', armor: 2, damage: 0 },
  leatherLegs: { slot: 'legs', armor: 0, damage: 0 }, ironGreaves: { slot: 'legs', armor: 1, damage: 0 },
  sword: { slot: 'mainHand', armor: 0, damage: 5 }, shield: { slot: 'offHand', armor: 1, damage: 0 },
} as const);
export const ROOM = Object.freeze({
  width: 13, floors: 2, sight: 6, ladders: [8],
  costs: { move: 10, climb: 16, attack: 12, interact: 8, potion: 12, wait: 10, equip: 8 },
  playerHp: 36, playerDamage: 2, damageVariance: 3, healing: 18,
  enemyHp: 22, enemyDamage: 6, enemyPeriods: [24], enemies: [{ x: 6, floor: 1 }],
  start: { x: 1, floor: 1 }, exit: { x: 11, floor: 0 },
  drops: [{ gear: 'ironCuirass', x: 6, floor: 1 }, { gear: 'ironGreaves', x: 7, floor: 1 }, { gear: 'ironHelm', x: 9, floor: 0 }],
} as const);
