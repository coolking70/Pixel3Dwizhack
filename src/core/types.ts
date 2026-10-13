import type { Alpha5Command, Alpha5State, Alpha5View } from './alpha5-types';
import type { Alpha4State } from './alpha4-types';
import type { Alpha3Command, Alpha3State } from './alpha3-types';
import type {Alpha2State,Alpha2View,Alpha2Command} from './alpha2-types';
import type { CombatBeat, ExpeditionState, ExpeditionView } from './expedition-types';
import type { AlphaState, AlphaView, Loadout } from './alpha-types';
export const COMMANDS = ['left', 'right', 'up', 'down', 'attack', 'interact', 'potion', 'wait'] as const;
export type Scenario = 'mine' | 'room' | 'dungeon' | 'expedition' | 'alpha' | 'alpha2' | 'alpha3' | 'alpha4' | 'alpha5' | 'alpha6';
export type GearId = 'leatherCap' | 'ironHelm' | 'leatherVest' | 'ironCuirass' | 'leatherLegs' | 'ironGreaves' | 'sword' | 'shield' | 'mace' | 'towerShield' | 'brigandine' | 'wand';
export const SLOTS = ['head', 'chest', 'legs', 'mainHand', 'offHand'] as const;
export type Slot = typeof SLOTS[number];
export type Equipment = Record<Slot, GearId | null>;
export type Command = `a6:feature:${number}:${'cover'|'silence'}` | Alpha5Command | Alpha3Command | Alpha2Command | 'unequip:charm' | typeof COMMANDS[number] | `equip:${GearId}` | `unequip:${Slot}` | `take:${number}` | `wear:${number}` | `drop:${number}` | `use:${number}` | `identify:${number}` | 'shrine' | 'cast' | `choose:${Loadout}` | `door:${number}` | `lever:${number}` | `cache:${number}:pay` | `cache:${number}:force`;
export type Status = 'playing' | 'dead' | 'won';
export interface Position { x: number; floor: number }
export interface Player extends Position { hp: number; maxHp: number; face: -1 | 1; potions: number; gold: number; relic: boolean; inventory?: GearId[]; equipment?: Equipment }
export interface Enemy extends Position { id: number; hp: number; maxHp: number; period: number; nextAt: number; kind?: 'crawler' | 'guard' | 'hexer' | 'skirmisher'; damage?: number; intent?: Position; elite?: boolean; venom?: boolean; armor?: number }
export interface Loot extends Position { id: number; kind: 'coins' | 'potion' | 'relic' | 'gear'; gear?: GearId; amount: number; taken: boolean }
export type EventKind = 'start' | 'move' | 'climb' | 'hit' | 'miss' | 'hurt' | 'defeat' | 'pickup' | 'heal' | 'wait' | 'dead' | 'won' | 'danger';
export interface Fact { kind: EventKind | 'equip' | 'windup' | 'evade'; amount?: number; item?: Loot['kind']; gear?: GearId; note?: 'identify' | 'poison' | 'might' | 'ward' | 'cure' | 'shrine' | 'drop' | 'collect'; effect?: string }
export interface World {
  alpha6?: {generation:1};
  alpha5?: Alpha5State;
  alpha4?: Alpha4State;
  alpha3?: Alpha3State;
  alpha2?: Alpha2State;
  scenario?: 'room' | 'dungeon' | 'expedition' | 'alpha' | 'alpha2' | 'alpha3' | 'alpha4' | 'alpha5' | 'alpha6';
  alpha?: AlphaState;
  expedition?: ExpeditionState;
  beats?: CombatBeat[];
  seed: number; rng: number; tick: number; revision: number; status: Status;
  player: Player; enemies: Enemy[]; loot: Loot[]; explored: number[][];
  events: Fact[];
}
export type Rejection = 'ended' | 'wall' | 'ladder' | 'blocked' | 'empty' | 'noPotion' | 'fullHp' | 'invalid' | 'limit' | 'bagFull';
export type Outcome = { accepted: true; world: World; interrupt: boolean } | { accepted: false; reason: Rejection };
export interface PublicView {
  alpha6?: {generation:1};
  alpha5?: Alpha5View;
  alpha3?: Alpha3State;
  alpha2?: Alpha2View;
  alpha?: AlphaView;
  expedition?: ExpeditionView;
  beats?: CombatBeat[];
  map: { width: number; floors: number; sight: number; ladders: Position[]; exit?: Position; rooms?: ('gate' | 'armory' | 'crypt')[] };
  gear?: { catalog: { id: GearId; slot: Slot; armor: number; damage: number }[]; armor: number; damage: number };
  seed: number; tick: number; revision: number; status: Status; player: Player;
  enemies: Enemy[]; loot: Loot[]; explored: number[][]; events: Fact[];
}
