import { itemDefinition } from '../content/catalog-access';
import { FACILITY_EFFECTS5 } from '../content/alpha5-catalog';
import { addCondition2,condition2,enemyAt2,line2,log2,monster2,near2,pos2,walk2,beat2 } from './alpha2-shared';
import { damage2,heal2,type ResolvedTarget2 } from './alpha2-effects';
import type { World,Enemy } from './types';
import type { Item2 } from './alpha2-types';

/** Undefined delegates to the historical effect. Called only for Alpha5 worlds. */
export function ecologyEffect5(w:World,id:string,t:ResolvedTarget2,source:Item2):boolean|undefined {
 if(t.facility&&FACILITY_EFFECTS5[t.facility.kind]){
  const f=t.facility;if(f.used||!FACILITY_EFFECTS5[f.kind]!.includes(id))return false;
  f.used=true;log2(w,{key:'ecoCleared',target:`facility:${f.kind}`});
  if(id==='fire'&&near2(w,f))damage2(w,0,4,'fire',`facility:${f.kind}`);
  if(source.blessing==='cursed'&&id==='purge5')addCondition2(w,'poison',0,40,2,`item:${source.id}`);
  if(source.blessing==='cursed'&&id==='tune5')damage2(w,0,4,'shock',`item:${source.id}`);
  if(source.blessing==='blessed'&&id==='purge5')heal2(w,0,6);
  return true;
 }
 if(id==='tune5'){
  if(!t.item||!itemDefinition(t.item.definition).slot||t.item.durability>=6)return false;
  // Equipment validation is identical in projection and mutation.
  t.item.durability=Math.min(6,t.item.durability+(source.blessing==='blessed'?4:source.blessing==='cursed'?1:3));return true;
 }
 return undefined;
}
/** Runs on the unified enemy deadline; never creates an independent clock. */
export function ecologyEnemyTurn5(w:World,e:Enemy):boolean {
 if(condition2(w,'sleep',e.id)||w.player.floor!==e.floor||!line2(w,e,w.player))return false;
 const id=monster2(w,e).id,bed=w.alpha2!.facilities.find(f=>!f.used&&f.floor===e.floor&&f.kind===(id==='sporeTender'?'sporeBed':'relay')&&Math.abs(f.x-e.x)<=3);
 if(id==='sporeTender'&&bed&&Math.abs(bed.x-e.x)<=2)heal2(w,e.id,2);
 if(id==='repairSpider'&&bed&&e.hp<e.maxHp&&Math.abs(e.x-w.player.x)>1){
  if(Math.abs(bed.x-e.x)<=1){heal2(w,e.id,4);log2(w,{key:'ecoRepair',name:`enemy:${id}`});return true;}
  const p={floor:e.floor,x:e.x+Math.sign(bed.x-e.x)};
  if(walk2(w,p)&&!enemyAt2(w,p)&&p.x!==w.player.x){const before=pos2(e);e.x=p.x;beat2(w,{kind:'move',actor:e.id,position:before,targetPosition:p});return true;}
 }
 return false;
}
