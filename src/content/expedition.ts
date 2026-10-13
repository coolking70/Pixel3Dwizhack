import { DUNGEON_GEAR } from './dungeon';
export const EXPEDITION_GEAR = DUNGEON_GEAR;
export const EXPEDITION = Object.freeze({
  generation: 1, width: 26, floors: 6, sight: 6, capacity: 16,
  hp: 64, baseDamage: 3, healing: 28, poisonDamage: 2, poisonPeriod: 20, poisonDuration: 80,
  buffDuration: 100, might: 4, ward: 3,
  costs: { move: 10, climb: 16, attack: 12, take: 6, wear: 8, use: 10, identify: 10, drop: 4, shrine: 12, wait: 10 },
  themes: ['gate', 'gate', 'armory', 'armory', 'crypt', 'crypt'],
  templates: ['supply', 'nest', 'watch'],
  effects: ['healing', 'antidote', 'might', 'ward'],
} as const);
