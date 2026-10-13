import type { ItemCategory } from '../../core/alpha2-types';
export type ItemVector = readonly [number, number, number];
export type ItemLOD = 0 | 1 | 2;
export interface ItemPieceBinding {
  readonly node: string;
  readonly bone: string;
  readonly position: ItemVector;
  readonly rotation: ItemVector;
  readonly scale: ItemVector;
}
export interface ItemVisualSpec {
  readonly assetId: string;
  readonly status: 'ready' | 'planned';
  readonly family: ItemCategory;
  readonly silhouetteTag: string;
  readonly source: { readonly kind: 'glb'; readonly uri: string; readonly license: string; readonly sha256: string };
  readonly ground: { readonly scale: number; readonly rotation: ItemVector; readonly anchor: ItemVector };
  readonly preview: { readonly cameraPreset: string; readonly framing: number; readonly background: 'transparent' };
  readonly grip: ItemVector;
  readonly hand?: { readonly socket: string; readonly gripPreset: string };
  readonly worn?: { readonly slot: string; readonly meshGroup: string; readonly maskRegions: readonly string[]; readonly bindings?: readonly ItemPieceBinding[] };
  readonly muzzle?: ItemVector;
  readonly contact?: ItemVector;
  readonly supportGrip?: ItemVector;
  readonly lod?: readonly { readonly level: ItemLOD; readonly uri: string; readonly sha256: string; readonly triangles: number; readonly drawCalls: number; readonly bytes: number }[];
}
