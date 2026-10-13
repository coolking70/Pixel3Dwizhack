import type { Command, Position } from './types';
import type { ItemAction, ItemSlot, Words } from './alpha2-types';

/** Public, read-only interaction protocol v1. Never persisted in mechanical state. */
export type TargetRef =
  | { type: 'self' }
  | { type: 'inventory-item'; itemId: number }
  | { type: 'equipment-slot'; slot: ItemSlot }
  | { type: 'world-entity'; kind: 'enemy' | 'ground-item' | 'door' | 'facility' | 'ladder' | 'relic'; id: number }
  | { type: 'world-cell'; floor: number; x: number };
export type ActionId = ItemAction | 'unequip' | 'drop';
export type OfferStatus = 'enabled' | 'disabled' | 'uncertain';
export type TargetMode = 'self' | 'bag-item' | 'world-entity' | 'world-cell';
export interface PublicActionOffer {
  actionId: string;
  cost?: {ticks:number;gold?:number;hp?:number};
  revision: number;
  status: OfferStatus;
  /** Translation key, never a hidden effect or secret condition name. */
  publicReason?: string;
  targetModes: TargetMode[];
  requiresConfirmation: boolean;
  command?: Command;
}
export interface PublicTargetOffer {
  ref: TargetRef;
  key: string;
  name: Words;
  revision: number;
  status: OfferStatus;
  publicReason?: string;
  command?: Command;
  position?: Position;
}
export type WorldIntent =
  | { type: 'move-to'; target: Position }
  | { type: 'activate'; target: TargetRef }
  | { type: 'cancel' };
export interface WorldHit { ref: TargetRef; position: Position }
