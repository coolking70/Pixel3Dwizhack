import type { Command, PublicView } from '../core/types';
import type { CharacterOptions, Motion } from '../character-lab/types';
export const FLOOR_HEIGHT = 3.4;
export const floorY = (floor: number): number => (1 - floor) * FLOOR_HEIGHT;
export function appearance(view: PublicView): CharacterOptions {
  const gear = view.player.equipment!;
  return { model: view.alpha ? 'vanguard' : 'classic', outfit: gear.chest === 'brigandine' ? 'brigandine' : gear.chest === 'ironCuirass' ? 'plate' : gear.chest === 'leatherVest' ? 'leather' : 'cloth',
    legsStyle: gear.legs === 'ironGreaves' ? 'plate' : gear.legs ? 'leather' : 'cloth',
    headStyle: gear.head === 'ironHelm' ? 'plate' : gear.head ? 'leather' : 'cloth',
    helmet: !!gear.head, sword: !!gear.mainHand, shield: !!gear.offHand,
    ...(view.alpha2&&['knife','spear','bow','fireblade','silverblade'].includes(view.alpha2.bag.find(i=>i.equipped==='mainHand')?.definition??'')?{weaponVariant:view.alpha2.bag.find(i=>i.equipped==='mainHand')!.definition as CharacterOptions['weaponVariant']}:{}),
    weaponStyle: gear.mainHand === 'wand' ? 'wand' : gear.mainHand === 'mace' ? 'mace' : 'sword', shieldStyle: gear.offHand === 'towerShield' ? 'tower' : 'small' };
}
export function actionMotion(before: PublicView, after: PublicView, command: Command): { motion: Motion | 'jump'; duration: number } {
  if (command.startsWith('a5:jump:') && after.alpha5?.lastJump?.revision===after.revision) return { motion: 'jump', duration: 900 };
  if (before.player.floor !== after.player.floor) return { motion: 'climb', duration: 3000 };
  if (before.player.x !== after.player.x) return { motion: 'walk', duration: 260 };
  if (after.alpha2&&command.startsWith('a2:use:')&&after.beats?.some(b=>b.actor===0&&b.kind==='attack'))return{motion:'attack',duration:650};
  if (command === 'attack' || command === 'cast' || command === 'left' || command === 'right') return { motion: 'attack', duration: 650 };
  return { motion: 'idle', duration: 180 };
}
