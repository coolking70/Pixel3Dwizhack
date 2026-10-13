import type {Position} from './types';
export type Loadout = 'vanguard' | 'breaker' | 'channeler';
export interface Door extends Position { id: number; open: boolean; locked: boolean }
export interface Lever extends Position { id: number; door: number; used: boolean }
export interface CacheEvent extends Position { id: number; used: boolean; rewards: number[] }
export interface AlphaState { loadout: Loadout; chosen: boolean; mana: number; manaAt: number; links: Position[]; doors: Door[]; levers: Lever[]; caches: CacheEvent[] }
export interface AlphaView { loadout: Loadout; chosen: boolean; mana: number; maxMana: number; nextMana: number; attackCost: number; range: number; spellCost: number; spellTime: number; doors: Door[]; levers: Lever[]; caches: Omit<CacheEvent,'rewards'>[] }
