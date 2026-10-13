import {FACILITY_EFFECTS6} from '../content/alpha6-catalog';
import {condition2,addCondition2,log2,monster2,line2} from './alpha2-shared';
import {damage2,heal2,type ResolvedTarget2} from './alpha2-effects';
import type {World,Enemy} from './types';
import type {Item2} from './alpha2-types';
export function ecologyEffect6(w:World,id:string,t:ResolvedTarget2,source:Item2):boolean|undefined{
 if(t.facility&&FACILITY_EFFECTS6[t.facility.kind]){const f=t.facility;if(f.used||!FACILITY_EFFECTS6[f.kind]!.includes(id))return false;f.used=true;log2(w,{key:'ecoCleared',target:`facility:${f.kind}`});
  if(source.blessing==='cursed'&&id==='purify6')addCondition2(w,'blind',0,40,1,`item:${source.id}`);
 }else if(id==='cool6'&&t.kind==='self'){w.alpha2!.conditions=w.alpha2!.conditions.filter(c=>c.actor!==0||c.kind!=='burn');}
 else if(id==='purify6'&&t.kind==='self'){w.alpha2!.conditions=w.alpha2!.conditions.filter(c=>c.actor!==0||!['blind','confused'].includes(c.kind));}
 else return undefined;
 if(id==='cool6'&&source.blessing==='cursed')addCondition2(w,'slow',0,40,1,`item:${source.id}`);
 if(id==='purify6'&&source.blessing==='blessed')heal2(w,0,4);
 return true;
}
export function ecologyEnemyTurn6(w:World,e:Enemy){if(monster2(w,e).id!=='cinderMourner'||condition2(w,'sleep',e.id)||condition2(w,'wet',e.id)||condition2(w,'slow',e.id)||w.player.floor!==e.floor||!line2(w,e,w.player))return;
 if(w.alpha2!.facilities.some(f=>f.kind==='emberVent'&&!f.used&&f.floor===e.floor&&Math.abs(f.x-e.x)<=2))heal2(w,e.id,3);
}
export function hazard6(w:World,kind:string){if(kind==='emberVent'){damage2(w,0,4,'fire','facility:emberVent');if(w.player.hp>0)addCondition2(w,'burn',0,40,1,'facility:emberVent');}if(kind==='boneChime')addCondition2(w,'slow',0,40,1,'facility:boneChime');}
