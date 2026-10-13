import type { GearId, Position, Slot } from './types';
export type Effect = 'healing' | 'antidote' | 'might' | 'ward';
export type ItemKind = 'gear' | 'flask' | 'scroll' | 'relic';
export interface ItemInstance { id: number; kind: ItemKind; gear?: GearId; effect?: Effect; quality: number; owner: 'bag' | 'ground' | 'spent'; position: Position }
export interface StatusEffect { kind: 'poison' | 'might' | 'ward'; until: number; nextAt: number }
export interface ExpeditionMap { width: number; floors: number; sight: number; ladders: number[]; themes: ('gate' | 'armory' | 'crypt')[]; templates: ('supply' | 'nest' | 'watch')[]; shrines: (Position & { used: boolean })[]; relic: Position }
export interface ExpeditionState { map: ExpeditionMap; items: ItemInstance[]; equipped: Record<Slot, number | null>; identified: Effect[]; appearances: Record<Effect, number>; effects: StatusEffect[]; kills: number; collected: number }
export interface ItemView { id: number; kind: ItemKind; gear?: GearId; effect?: Effect; appearance?: number; quality: number; equipped?: Slot; damage?: number; armor?: number }
export interface CombatBeat { kind: 'move' | 'windup' | 'attack' | 'miss' | 'hurt' | 'death' | 'heal' | 'pickup'; actor: number; target?: number; position: Position; targetPosition?: Position; amount?: number; tick: number; mode?: 'spell' }
export interface ExpeditionView { bag: ItemView[]; nearby: ItemView[]; ground: (ItemView & Position)[]; capacity: number; effects: StatusEffect[]; shrines: (Position & { used: boolean })[]; kills: number; collected: number; bossDefeated: boolean; templates: ('supply' | 'nest' | 'watch' | null)[] }
