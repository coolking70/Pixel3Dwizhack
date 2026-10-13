import {createEcologyAgent5} from './agents';
import type {Agent,RunConfig} from '../balance/types';
import type {Command} from '../core/types';
/** Alpha6 policy uses the same public projection and formal command capability. */
export function createEcologyAgent6(config:RunConfig):Agent{
 const parent=createEcologyAgent5(config);return{next(v,rejected){const proposed=parent.next(v,rejected);if(!proposed||!v.alpha6||!v.revision||v.alpha2!.conditions.some(c=>c.kind==='sleep'))return proposed;
 const fireImmune=v.alpha2!.monsters.some(m=>m.resists.includes('fire')&&v.enemies.some(e=>e.id===m.enemy&&Math.abs(e.x-v.player.x)<=1)),weapon=v.alpha2!.bag.find(i=>i.equipped==='mainHand');
 if(fireImmune){if(weapon?.definition==='fireblade'){if(weapon.blessing==='cursed'){const release=v.alpha2!.bag.find(i=>i.definition==='release');const c=release?`a2:use:${release.id}:read:i${weapon.id}` as Command:null;if(c&&!rejected.includes(c))return c;}const replacement=v.alpha2!.bag.find(i=>i.equippableSlot==='mainHand'&&i.definition!=='fireblade'&&i.definition!==undefined&&!rejected.includes(`wear:${i.id}`));if(replacement)return `wear:${replacement.id}`;}else if(proposed.startsWith('wear:')&&v.alpha2!.bag.find(i=>i.id===Number(proposed.split(':')[1]))?.definition==='fireblade'&&!rejected.includes('attack'))return 'attack';}
 if(['attack','cast','potion'].includes(proposed)||proposed.includes(':eat:'))return proposed;
 const f=v.alpha2!.facilities.find(f=>f.near&&!f.used&&['emberVent','boneChime'].includes(f.kind));if(f&&config.strategy!=='novice'){const c=`a6:feature:${f.id}:${f.kind==='emberVent'?'cover':'silence'}` as Command;if(!rejected.includes(c))return c;}
 if(!v.enemies.some(e=>Math.abs(e.x-v.player.x)<=2)&&v.alpha2!.capacityUsed!<v.alpha2!.capacity){const i=v.alpha2!.nearby.find(i=>['rimeUrn','silverCenser','vigilMirror'].includes(i.definition??'')&&!v.alpha2!.bag.some(b=>b.definition===i.definition));if(i&&!rejected.includes(`take:${i.id}`))return `take:${i.id}`;}
 return proposed;
 }};
}
