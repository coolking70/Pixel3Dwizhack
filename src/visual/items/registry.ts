import manifest from './manifest.json' with {type:'json'};
import type { ItemVisualSpec } from './types';
// Runtime registry contains public appearance identities only, no effect mapping.
export const ITEM_VISUALS = Object.freeze(manifest.assets as unknown as readonly ItemVisualSpec[]);
export const ITEM_VISUAL_BY_ID: ReadonlyMap<string, ItemVisualSpec> = new Map(ITEM_VISUALS.map(s => [s.assetId, s]));
