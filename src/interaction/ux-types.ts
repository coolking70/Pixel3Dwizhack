import type { Item2View, ItemSlot } from '../core/alpha2-types';
import type { WorldHit } from '../core/action-types';
import type { Position } from '../core/types';

/** Transient presentation contracts. Never serialized into a mechanical archive. */
export interface LadderEdge { linkId: number; fromFloor: number; toFloor: number; x: number }
export interface WorldHitCandidates {
  hits: readonly WorldHit[];
  ladderEdges: readonly LadderEdge[];
  jump?: Position;
  pile?: { cell: Position; itemIds: readonly number[]; ambiguous?: boolean };
}
export interface GroundPileVisual {
  cell: Position;
  itemIds: readonly number[];
  members: Array<{
    itemId: number; assetId: string;
    pose: { x: number; y: number; z: number; angle: number; scale: number };
    selectableBounds: { width: number; height: number; depth: number };
  }>;
}
export interface NavigationState {
  page: 'bag' | 'character' | 'attributes';
  selectedItemId: number | null;
  originIndex: number;
  selectedSlot: ItemSlot | null;
  previousActionId: string | null;
}
export interface ActionResult {
  accepted: boolean;
  revision: number;
  bag: readonly Item2View[];
  publicReason?: string;
  interrupt?: boolean;
}
