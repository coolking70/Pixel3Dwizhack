import * as T from 'three';
import type { Item2View } from '../../core/alpha2-types';
import type { BlockCharacter } from '../../character-lab/character';
import { resolveItemVisual } from './appearance-resolver';
import { bindItemToSocket, createItemModelCache } from './presenter';
import type { ItemLOD, ItemPieceBinding, ItemVisualSpec } from './types';

interface EquippedAsset { spec: ItemVisualSpec; level: ItemLOD; root: T.Group; pieces: { object: T.Object3D; binding: ItemPieceBinding }[] }
/** Six-slot presentation only. World, preview and equipment share asset IDs and
 * geometry; each articulated garment piece follows its existing project bone. */
export class ItemEquipment {
  private items: readonly Item2View[] = [];
  private slots = new Map<string, EquippedAsset>();
  private pending = new Set<string>();
  private dead = false;
  private level: ItemLOD = 0;
  constructor(private actor: BlockCharacter, private redraw: () => void, private cache = createItemModelCache(), private ownsCache = true) {}
  private remove(entry: EquippedAsset): void { entry.root.removeFromParent(); entry.pieces.forEach(p => p.object.removeFromParent()); }
  update(items: readonly Item2View[]): void {
    if (this.dead) return;
    this.items = items;
    const selected = items.filter(i => i.equipped);
    for (const [slot, entry] of this.slots) if (!selected.some(i => i.equipped === slot && resolveItemVisual(i).assetId === entry.spec.assetId) || entry.level !== this.level) { this.remove(entry); this.slots.delete(slot); }
    for (const item of selected) {
      const spec = resolveItemVisual(item), slot = item.equipped!, key = `${spec.assetId}:${this.level}`;
      if (spec.status !== 'ready' || this.slots.has(slot)) continue;
      const root = this.cache.peek(spec, this.level);
      if (root) {
        const bindings = spec.worn?.bindings ?? [], pieces: EquippedAsset['pieces'] = [];
        // Missing pieces preserve the character fallback instead of hiding it.
        if (bindings.some(b => !root.getObjectByName(b.node) || !this.actor.bones.has(b.bone))) continue;
        for (const binding of bindings) {
          const object = root.getObjectByName(binding.node)!;
          object.userData.itemAsset = true; object.userData.assetId = spec.assetId; object.userData.itemLOD = this.level;
          pieces.push({ object, binding });
        }
        this.slots.set(slot, { spec, level: this.level, root, pieces });
      } else if (!this.pending.has(key)) {
        this.pending.add(key);
        void this.cache.preload([spec], this.level).then(() => { if (!this.dead) { this.update(this.items); this.redraw(); } }).catch(() => {}).finally(() => this.pending.delete(key));
      }
    }
    this.sample();
  }
  setLOD(level: ItemLOD): void { if (level !== this.level) { this.level = level; this.update(this.items); } }
  sample(stowed = false): void {
    if (this.dead) return;
    this.actor.setItemSlots([...this.slots.keys()]);
    this.actor.setItemMasks([...new Set([...this.slots.values()].flatMap(e => e.spec.worn?.maskRegions ?? []))]);
    for (const [slot, { spec, root, pieces }] of this.slots) {
      if (slot === 'mainHand') { bindItemToSocket(root, stowed ? this.actor.backSword : this.actor.rightGrip, spec); }
      else if (slot === 'offHand') { const bow = this.items.some(i => i.equipped === 'mainHand' && i.definition === 'bow'); bindItemToSocket(root, stowed || bow ? this.actor.backShield : this.actor.leftGrip, spec); }
      else for (const { object, binding } of pieces) {
        this.actor.bone(binding.bone).add(object);
        object.position.fromArray(binding.position); object.rotation.set(...binding.rotation); object.scale.fromArray(binding.scale);
      }
    }
  }
  /** Public inspection snapshot never includes hidden item definitions. */
  inspect(): readonly { slot: string; assetId: string; level: ItemLOD; pieces: number }[] { return [...this.slots].map(([slot, e]) => ({ slot, assetId: e.spec.assetId, level: e.level, pieces: e.pieces.length })); }
  dispose(): void { if (this.dead) return; this.dead = true; this.slots.forEach(e => this.remove(e)); this.slots.clear(); this.actor.setItemSlots([]); this.actor.setItemMasks([]); if(this.ownsCache)this.cache.dispose(); }
}
