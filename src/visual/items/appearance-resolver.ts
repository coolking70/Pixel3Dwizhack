import type { Item2View } from '../../core/alpha2-types';
import type { ItemVisualSpec } from './types';
import { ITEM_VISUAL_BY_ID } from './registry';
const secretCounts: Readonly<Record<string, number>> = { potion: 8, scroll: 6, wand: 5, accessory: 2 };
/** Consumes only the public projection. Identification never changes geometry. */
export function resolveItemVisual(item: Item2View): ItemVisualSpec {
  const count = secretCounts[item.category];
  const key = count ? `${item.category}-${Number.isInteger(item.appearance) && item.appearance >= 0 && item.appearance < count ? item.appearance : 'invalid'}` : `fixed-${item.definition ?? 'unavailable'}`;
  const ready = ITEM_VISUAL_BY_ID.get(key);
  if (ready) return ready;
  return Object.freeze<ItemVisualSpec>({ assetId: key, status: 'planned', family: item.category, silhouetteTag: 'awaiting-M18-production', source: { kind: 'glb', uri: '', license: 'MIT', sha256: '' }, ground: { scale: 1, rotation: [0, 0, 0], anchor: [0, 0, 0] }, preview: { cameraPreset: 'three-quarter', framing: 1.18, background: 'transparent' }, grip: [0, 0, 0] });
}
