import { createResourceAgent4 } from '../balance4/agents';
import type { Agent,RunConfig } from '../balance/types';
import type { Command } from '../core/types';
/** Only frozen public views; no world, catalogue, session or privileged mutation. */
export function createEcologyAgent5(config:RunConfig):Agent {
 const parent=createResourceAgent4(config);
 return { next(v,rejected){
  const proposed=parent.next(v,rejected);if(!proposed||!v.alpha5||!v.revision||v.alpha2!.conditions.some(c=>c.kind==='sleep'))return proposed;
  const allowed=(c:Command)=>!rejected.includes(c);
  if(proposed==='potion'||proposed==='attack'||proposed==='cast'||proposed.includes(':eat:'))return proposed;
  // Discover counters by their public, known definition. Unknown tools are never guessed.
  if(v.alpha2!.conditions.some(c=>c.kind==='poison'||c.kind==='burn')){const bell=v.alpha2!.bag.find(i=>i.definition==='sporeBell'&&i.charges!==0);if(bell){const c:Command=`a2:use:${bell.id}:apply:self`;if(allowed(c))return c;}}
  const feature=v.alpha2!.facilities.find(f=>f.near&&!f.used&&['sporeBed','relay'].includes(f.kind));
  if(feature&&config.strategy!=='novice'){
   const tool=v.alpha2!.bag.find(i=>i.definition===(feature.kind==='sporeBed'?'sporeBell':'coilKey')&&i.charges!==0&&i.blessing!=='cursed');
   const c:Command=tool?`a2:use:${tool.id}:apply:f${feature.id}`:`a5:feature:${feature.id}:${feature.kind==='sporeBed'?'seal':'isolate'}`;
   if(allowed(c))return c;
  }
  if(!v.enemies.some(e=>e.floor===v.player.floor&&Math.abs(e.x-v.player.x)<=2)&&v.alpha2!.capacityUsed!<v.alpha2!.capacity){
   const tool=v.alpha2!.nearby.find(i=>['sporeBell','coilKey'].includes(i.definition??'')&&!v.alpha2!.bag.some(b=>b.definition===i.definition));
   if(tool&&allowed(`take:${tool.id}`))return `take:${tool.id}`;
  }
  if(proposed==='left'||proposed==='right'){
   const dx=proposed==='left'?-1:1,f=v.alpha2!.facilities.find(f=>f.floor===v.player.floor&&f.x===v.player.x+dx&&!f.used&&['trap','sporeBed','relay','barricade'].includes(f.kind));
   if(f){const jump=v.alpha5.jumpTargets.find(t=>t.position.x===v.player.x+dx*2&&t.status==='enabled');if(jump&&allowed(jump.command))return jump.command;
    if(f.kind==='barricade'){const c:Command=`a5:feature:${f.id}:clear`;if(allowed(c))return c;}}
  }
  return proposed;
 }};
}
