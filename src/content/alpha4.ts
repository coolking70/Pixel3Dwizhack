import { ALPHA3_CONTENT } from './alpha3';
/** Alpha 4 alone owns this generation/capacity contract. */
export const ALPHA4 = {
  slotsLimit: 16, capacity: 'unequipped-v1', generation: 'alpha4-loot-v1', lootSeedSalt: 0x4f26a13d,
  lootBudgetByDepth: [12,10,10,11,11,12], encounterLootCap: 2,
  maxVisibleLooseItemsPerScreen: 5, screenCells: 13,
  ownerWeights: { ground: 5, container: 3, enemy: 2 },
  // Per-definition weight. P(category) = eligible definitions in that category
  // times this weight / sum of weights of all eligible definitions.
  categoryWeights: { potion: 4, food: 4, scroll: 2, wand: 1, weapon: 2, armor: 2, accessory: 1, tool: 1 },
} as const;
export const ALPHA4_CONTENT = { base: ALPHA3_CONTENT, inventoryLoot: ALPHA4 };
