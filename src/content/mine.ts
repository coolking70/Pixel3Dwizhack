// Mechanical content only. Names and colors belong to presentation.
export const MINE = Object.freeze({
  width: 26, floors: 3, sight: 5,
  ladders: Object.freeze([17, 8]),
  costs: Object.freeze({ move: 10, climb: 16, attack: 12, interact: 8, potion: 12, wait: 10 }),
  playerHp: 48, playerDamage: 7, damageVariance: 4, healing: 18,
  enemyHp: 12, enemyDamage: 2, enemyPeriods: Object.freeze([20, 25, 30]),
  enemies: Object.freeze([Object.freeze({ x: 12, floor: 0 }), Object.freeze({ x: 13, floor: 1 }), Object.freeze({ x: 17, floor: 2 })]),
  treasure: Object.freeze({ x: 22, floor: 2 }),
});
