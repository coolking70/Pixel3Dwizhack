import type { PublicView, Command } from '../core/types';
import type { PublicActionOffer, TargetRef } from '../core/action-types';

interface PickupOptions {
  view: () => PublicView;
  busy: () => boolean;
  offers: (target: TargetRef) => readonly PublicActionOffer[];
  submit: (command: Command) => { accepted: boolean; interrupt?: boolean };
}
/** Explicit, bounded pickup-all authorization. Each item is a fresh formal command. */
export class PickupSequence {
  private ids: number[] = [];
  private revision = -1;
  private floor = -1;
  private x = -1;
  constructor(private options: PickupOptions) {}
  get active() { return this.ids.length > 0; }
  cancel() { this.ids = []; this.revision = -1; }
  start(ids: readonly number[]) {
    this.cancel();
    const view = this.options.view();
    this.ids = [...new Set(ids)].filter(id => Number.isInteger(id) && id > 0).slice(0, 128);
    this.revision = view.revision; this.floor = view.player.floor; this.x = view.player.x;
    this.completed();
  }
  completed() {
    if (!this.active || this.options.busy()) return;
    const before = this.options.view();
    if (before.revision !== this.revision || before.status !== 'playing' || before.player.floor !== this.floor || before.player.x !== this.x
      || before.enemies.some(enemy => enemy.hp > 0 && enemy.floor === this.floor && (Math.abs(enemy.x - this.x) <= 1 || enemy.intent))) { this.cancel(); return; }
    const id = this.ids[0]!;
    const item = before.alpha2?.ground.find(item => item.id === id);
    if (!item || item.floor !== this.floor || Math.abs(item.x - this.x) > 1) { this.cancel(); return; }
    const offer = this.options.offers({ type: 'world-entity', kind: 'ground-item', id }).find(offer => offer.command === `take:${id}` && offer.revision === before.revision && offer.status === 'enabled' && !offer.requiresConfirmation);
    if (!offer?.command) { this.cancel(); return; }
    const result = this.options.submit(offer.command), after = this.options.view();
    if (!result.accepted || result.interrupt || after.player.hp < before.player.hp || after.enemies.some(enemy => !before.enemies.some(old => old.id === enemy.id))
      || JSON.stringify(before.alpha2?.conditions) !== JSON.stringify(after.alpha2?.conditions)) { this.cancel(); return; }
    this.ids.shift(); this.revision = after.revision;
  }
}
