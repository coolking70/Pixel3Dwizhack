import type { Command, Position, PublicView } from '../../core/types';
import type { Item2View } from '../../core/alpha2-types';

export type ItemMotion = 'drink' | 'read' | 'zap' | 'throw' | 'eat' | 'apply' | 'equip' | 'unequip' | 'drop';
export type InteractionMotion = 'pickupLow' | 'doorPush' | 'doorPull' | 'leverPull' | 'chestOpen' | ItemMotion;
export const isItemMotion = (motion: InteractionMotion): motion is ItemMotion => ['drink','read','zap','throw','eat','apply','equip','unequip','drop'].includes(motion);
export interface MotionProfile {
  readonly version: 1;
  readonly durationMs: number;
  readonly contact: number;
  readonly effect: number;
  readonly recover: number;
}
export const MOTION_PROFILE: Readonly<Record<InteractionMotion, MotionProfile>> = {
  pickupLow: { version: 1, durationMs: 1050, contact: .42, effect: .52, recover: .78 },
  doorPush: { version: 1, durationMs: 1000, contact: .36, effect: .42, recover: .78 },
  doorPull: { version: 1, durationMs: 1000, contact: .36, effect: .42, recover: .78 },
  leverPull: { version: 1, durationMs: 1100, contact: .38, effect: .46, recover: .8 },
  chestOpen: { version: 1, durationMs: 1150, contact: .38, effect: .46, recover: .8 },
  drink: { version: 1, durationMs: 1200, contact: .38, effect: .5, recover: .8 },
  eat: { version: 1, durationMs: 1150, contact: .38, effect: .5, recover: .8 },
  read: { version: 1, durationMs: 1350, contact: .34, effect: .52, recover: .82 },
  zap: { version: 1, durationMs: 1100, contact: .34, effect: .46, recover: .8 },
  throw: { version: 1, durationMs: 1100, contact: .32, effect: .42, recover: .8 },
  apply: { version: 1, durationMs: 1200, contact: .38, effect: .5, recover: .8 },
  equip: { version: 1, durationMs: 1200, contact: .36, effect: .55, recover: .82 },
  drop: {version:1,durationMs:1100,contact:.36,effect:.5,recover:.82},
  unequip: { version: 1, durationMs: 1200, contact: .36, effect: .55, recover: .82 },
};
export interface PresentationActionReceipt {
  readonly version: 1;
  readonly actionId: string;
  readonly command: 'pickup' | 'door' | 'lever' | 'chest' | ItemMotion;
  readonly actorId: 0;
  readonly targetId: number;
  readonly target: Readonly<Position>;
  readonly motion: InteractionMotion;
  readonly logicalTicks: number;
  readonly start: Readonly<Position>;
  readonly end: Readonly<Position>;
  readonly item?: Readonly<Item2View>;
  readonly targetItem?: Readonly<Item2View>;
  readonly slot?: Item2View['equipped'];
  readonly targetKey?: string;
  readonly wasOpen?: boolean;
  readonly open?: boolean;
  readonly cues: readonly { readonly kind: 'reach' | 'contact' | 'release' | 'recover'; readonly phase: number }[];
}
const position = ({ floor, x }: Position): Position => ({ floor, x });
// Called only after a successful atomic submit. The boundary check also makes
// rejected/stale before-after pairs incapable of generating a success motion.
export function interactionReceipt(before: PublicView, after: PublicView, command: Command): PresentationActionReceipt | null {
  if (!before.alpha2 || !after.alpha2 || after.seed !== before.seed || after.revision !== before.revision + 1) return null;
  let motion: InteractionMotion, target: Position, targetId: number, semantic: PresentationActionReceipt['command'];
  let item: Item2View | undefined, wasOpen: boolean | undefined, open: boolean | undefined;
  let slot: Item2View['equipped'], targetKey: string | undefined, targetItem: Item2View | undefined;
  if (command.startsWith('wear:') || command.startsWith('unequip:')) {
    const wearing = command.startsWith('wear:');
    item = before.alpha2.bag.find(i => wearing ? i.id === Number(command.slice(5)) : i.equipped === command.slice(8));
    if (!item) return null;
    const next = after.alpha2.bag.find(i => i.id === item!.id);
    slot = wearing ? next?.equipped : item.equipped;
    if (!slot || (wearing ? item.equipped === slot : next?.equipped === slot)) return null;
    target = before.player; targetId = item.id; motion = semantic = wearing ? 'equip' : 'unequip';
  } else if(before.alpha5&&command.startsWith('drop:')){
    item=before.alpha2.bag.find(i=>i.id===Number(command.split(':')[1]));if(!item||after.alpha2.bag.some(i=>i.id===item!.id))return null;
    target=before.player;targetId=item.id;targetKey='ground';motion=semantic='drop';
  } else if(before.alpha5&&/^a2:(cook|buy|sell|cleanse|recharge):/.test(command)){
    const parts=command.split(':'),f=before.alpha2.facilities.find(f=>f.id===Number(parts[2]));if(!f||after.tick<=before.tick)return null;
    item=[...before.alpha2.bag,...f.stock].find(i=>i.id===Number(parts[3]));if(!item)return null;
    target=f;targetId=f.id;targetKey=`f${f.id}`;motion=semantic='apply';
  } else if (command.startsWith('a3:throw:')) {
    const receipt = after.alpha3?.lastThrow;
    item = before.alpha2.bag.find(i => i.id === Number(command.split(':')[2]));
    if (!item || !receipt || receipt.itemId !== item.id || receipt.revision !== after.revision || after.tick <= before.tick) return null;
    target = receipt.landing; targetId = receipt.collision.kind === 'ground' ? item.id : receipt.collision.id;
    targetKey = `cell:${target.floor}:${target.x}`; motion = semantic = 'throw';
  } else if (command.startsWith('a2:use:') || command === 'potion') {
    const parts = command.split(':');
    item = before.alpha2.bag.find(i => command === 'potion' ? i.definition === 'renewal' : i.id === Number(parts[2]));
    const action = command === 'potion' ? 'drink' : parts[3];
    if (!item || !['drink','read','zap','throw','eat','apply'].includes(action!) || !item.actions.includes(action as never) || after.tick <= before.tick) return null;
    targetKey = command === 'potion' ? 'self' : parts[4];
    if (!before.alpha2.targets.some(t => t.key === targetKey)) return null;
    const id = Number(targetKey!.slice(1));
    if(targetKey!.startsWith('i'))targetItem=before.alpha2.bag.find(i=>i.id===id);
    target = targetKey!.startsWith('e') ? before.enemies.find(e => e.id === id)!
      : targetKey!.startsWith('f') ? before.alpha2.facilities.find(f => f.id === id)!
      : targetKey!.startsWith('d') ? before.alpha?.doors.find(d => d.id === id)! : before.player;
    if (!target) return null;
    targetId = id || item.id; motion = semantic = action as ItemMotion;
  } else if (command === 'interact' || command.startsWith('take:')) {
    const picked = before.alpha2.ground.find(i => after.alpha2!.bag.some(n => n.id === i.id) && !before.alpha2!.bag.some(n => n.id === i.id));
    if (!picked) return null;
    item = picked; target = picked; targetId = picked.id; motion = 'pickupLow'; semantic = 'pickup';
  } else if (command.startsWith('door:') || command.startsWith('lever:')) {
    const id = Number(command.split(':')[1]), a = before.alpha?.doors.find(d => d.id === id), b = after.alpha?.doors.find(d => d.id === id);
    if (!a || !b || a.open === b.open && a.locked === b.locked) return null;
    target = a; targetId = id; wasOpen = a.open; open = b.open;
    semantic = command.startsWith('lever:') ? 'lever' : 'door';
    motion = semantic === 'lever' ? 'leverPull' : (before.player.x < a.x) === b.open ? 'doorPush' : 'doorPull';
  } else if ((command.startsWith('a5:feature:')||command.startsWith('a6:feature:')) && before.alpha5) {
    const id=Number(command.split(':')[2]),a=before.alpha2.facilities.find(f=>f.id===id),b=after.alpha2.facilities.find(f=>f.id===id);
    if(!a||a.used||!b?.used)return null;
    target=a;targetId=id;motion=a.kind==='relay'?'leverPull':'chestOpen';semantic=a.kind==='relay'?'lever':'chest';
  } else if (command.startsWith('a2:feature:')) {
    const id = Number(command.split(':')[2]), a = before.alpha2.facilities.find(f => f.id === id), b = after.alpha2.facilities.find(f => f.id === id);
    if (!a || (!before.alpha5&&a.kind !== 'chest') || a.used || !b?.used) return null;
    target = a; targetId = id; motion = 'chestOpen'; semantic = 'chest';
  } else return null;
  const profile = MOTION_PROFILE[motion];
  return Object.freeze({ version: 1, actionId: `${after.seed}:${after.revision}`, actorId: 0, command: semantic, targetId,
    target: Object.freeze(position(target)), motion, logicalTicks: after.tick - before.tick,
    start: Object.freeze(position(before.player)), end: Object.freeze(position(after.player)),
    ...(item ? { item: Object.freeze(structuredClone(item)) } : {}), ...(open === undefined ? {} : { open, wasOpen }),
    ...(slot ? { slot } : {}), ...(targetKey ? { targetKey } : {}),
    ...(targetItem ? {targetItem:Object.freeze(structuredClone(targetItem))} : {}),
    cues: Object.freeze([{ kind: 'reach' as const, phase: .12 }, { kind: 'contact' as const, phase: profile.contact }, { kind: 'release' as const, phase: profile.recover }, { kind: 'recover' as const, phase: 1 }]),
  });
}

export function motionStage(motion: InteractionMotion, phase: number): 'prepare' | 'contact' | 'effect' | 'recover' {
  const p = MOTION_PROFILE[motion];
  return phase < p.contact ? 'prepare' : phase < p.effect ? 'contact' : phase < p.recover ? 'effect' : 'recover';
}

/** Preserve a visible sample in each stage during slow frames; no rule-time capability. */
export function nextInteractionPhase(previous:number,elapsed:number,motion:InteractionMotion):number{
 const p=MOTION_PROFILE[motion],next=Math.max(previous,Math.min(1,elapsed,previous+.10));
 return [p.contact,p.effect,p.recover].find(boundary=>previous<boundary&&next>boundary)??next;
}
