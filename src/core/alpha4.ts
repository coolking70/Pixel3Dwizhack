import { ALPHA4 } from '../content/alpha4';
import { acceptAlpha3, createAlpha3, inspectAlpha3, isAlpha3Command } from './alpha3';
import { acceptAlpha4Base } from './alpha4-commands';
import { generateLoot4, releaseEnemyLoot4 } from './alpha4-map';
import { bagSlots4 } from './alpha4-shared';
import type { Command, Outcome, PublicView, World } from './types';

export const isAlpha4Command = isAlpha3Command;
export function createAlpha4(seed:number):World {
  const w=createAlpha3(seed);w.scenario='alpha4';
  w.alpha4={lootRng:(seed^ALPHA4.lootSeedSalt)>>>0||1,enemyDrops:[]};
  generateLoot4(w);return w;
}
export function inspectAlpha4(w:World):PublicView {
  const v=inspectAlpha3(w);v.alpha2!.capacityUsed=bagSlots4(w);v.alpha2!.capacityIncludesEquipment=false;return v;
}
export function acceptAlpha4(w:World,command:Command):Outcome {
  const result=command.startsWith('a3:throw:')?acceptAlpha3(w,command):acceptAlpha4Base(w,command);
  if(result.accepted){
    if(!command.startsWith('a3:throw:'))result.world.alpha3={lastThrow:null};
    releaseEnemyLoot4(result.world);
  }
  return result;
}
