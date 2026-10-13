import type { Object3D } from 'three';
import type { Item2View } from '../../core/alpha2-types';
import { resolveItemVisual } from './appearance-resolver';

type PublicCondition = Pick<Item2View, 'category' | 'freshness'>;
export function itemConditionKey(item: PublicCondition): 'fresh' | 'stale' { return item.category === 'food' && item.freshness === 'stale' ? 'stale' : 'fresh'; }
/** The public condition is separate from seed-assigned secret visual identity. */
export function itemAppearanceKey(item: Item2View): string { return `${resolveItemVisual(item).assetId}:${itemConditionKey(item)}`; }
/** Only clone transforms/visibility change; shared template materials remain immutable. */
export function applyItemAppearance(root: Object3D, item: PublicCondition): void {
  const overlay = root.getObjectByName('FreshnessOverlay');
  if (overlay) { overlay.visible = itemConditionKey(item) === 'stale'; overlay.scale.setScalar(overlay.visible ? 1 : 0); }
}
