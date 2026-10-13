import type {Command,Position,PublicView} from '../core/types';
import type {PublicActionOffer,TargetRef,WorldIntent} from '../core/action-types';
import type {LadderEdge} from './ux-types';

export interface IntentOptions {
 feedback?:(reason:string)=>void;
 view:()=>PublicView;
 submit:(command:Command)=>{accepted:boolean;interrupt?:boolean};
 busy:()=>boolean;
 context:(target:TargetRef)=>void;
 offers:(target:TargetRef)=>readonly PublicActionOffer[];
}
const same=(a:Position,b:Position)=>a.floor===b.floor&&a.x===b.x;
const known=(v:PublicView,p:Position)=>Number.isInteger(p.x)&&Number.isInteger(p.floor)&&p.x>0&&p.x<v.map.width-1&&!!v.explored[p.floor]?.includes(p.x);
export function targetPosition(v:PublicView,ref:TargetRef):Position|undefined{
 if(ref.type==='self')return v.player;
 if(ref.type==='world-cell')return known(v,ref)?ref:undefined;
 if(ref.type!=='world-entity')return;
 if(ref.kind==='enemy')return v.enemies.find(e=>e.id===ref.id&&e.hp>0);
 if(ref.kind==='ground-item')return v.alpha2?.ground.find(i=>i.id===ref.id);
 if(ref.kind==='relic')return v.loot.find(i=>i.id===ref.id&&i.kind==='relic'&&!i.taken);
 if(ref.kind==='door')return v.alpha?.doors.find(d=>d.id===ref.id);
 if(ref.kind==='facility')return v.alpha2?.facilities.find(f=>f.id===ref.id);
 if(ref.kind==='ladder'){const l=v.map.ladders.find(l=>ladderId(v,l)===ref.id);return l?{x:l.x,floor:v.player.floor===l.floor+1?l.floor+1:l.floor}:undefined;}
}
/** Stable within one public map; never depends on filtered array indices. */
export const ladderId=(v:PublicView,p:Position)=>p.floor*v.map.width+p.x;
/** Explicit edges from the current public entrance; the destination need not be explored. */
export function publicLadderEdges(v:PublicView):LadderEdge[]{return v.map.ladders.flatMap(l=>{
 const from=v.player.floor,to=from===l.floor?from+1:from===l.floor+1?from-1:-1;
 return to>=0&&to<v.map.floors&&known(v,{floor:from,x:l.x})?[{linkId:ladderId(v,l),fromFloor:from,toFloor:to,x:l.x}]:[];
});}
/** Breadth-first search is bounded by the finite public explored grid. */
export function nextStep(v:PublicView,target:Position):Position|undefined{
 if(!known(v,target)||same(v.player,target))return;
 const key=(p:Position)=>`${p.floor}/${p.x}`,seen=new Set([key(v.player)]),queue:{p:Position;first?:Position}[]=[{p:v.player}];
 for(let i=0;i<queue.length;i++){
  const {p,first}=queue[i]!,neighbors=[{floor:p.floor,x:p.x-1},{floor:p.floor,x:p.x+1}];
  for(const l of v.map.ladders)if(l.x===p.x){if(l.floor===p.floor)neighbors.push({floor:p.floor+1,x:p.x});if(l.floor+1===p.floor)neighbors.push({floor:p.floor-1,x:p.x});}
  for(const n of neighbors){if(!known(v,n)||seen.has(key(n)))continue;const start=first??n;if(same(n,target))return start;seen.add(key(n));queue.push({p:n,first:start});}
 }
}
function conditions(v:PublicView){return JSON.stringify(v.alpha2?.conditions.map(c=>[c.kind,c.until])??v.expedition?.effects??[]);}
function danger(v:PublicView,p:Position,allowedEnemy?:number):string|undefined{if(v.enemies.some(e=>e.id!==allowedEnemy&&e.hp>0&&e.floor===p.floor&&Math.abs(e.x-p.x)<=1))return 'intent.enemy';const f=v.alpha2?.facilities.find(f=>f.floor===p.floor&&f.x===p.x&&!f.used);return f&&['trap','hazard','sporeBed','relay','emberVent','boneChime'].includes(f.kind)?'intent.hazard':f?.kind==='barricade'?'intent.obstacle':undefined;}

/** One transient authorization. No command queue, timers, RNG or persistent state. */
export class IntentExecutor {
 private intention:WorldIntent|null=null;
 private held:{source:string;direction:'left'|'right'|'up'|'down'}|undefined;
 private climb:LadderEdge|undefined;
 private expected:{seed:number;revision:number}|undefined;
 private submitting=false;
 constructor(private options:IntentOptions){}
 get active():WorldIntent|null{return this.intention;}
 private stop(reason:string){this.cancel();this.options.feedback?.(reason);}
 cancel(){this.intention=null;this.held=undefined;this.climb=undefined;this.expected=undefined;}
 startClimb(edge:LadderEdge){
  this.cancel();if(this.options.busy()||!this.validEdge(this.options.view(),edge))return;
  this.climb={...edge};this.intention={type:'move-to',target:{floor:edge.fromFloor,x:edge.x}};this.remember();this.completed();
 }
 private validEdge(v:PublicView,edge:LadderEdge){return publicLadderEdges(v).some(e=>e.linkId===edge.linkId&&e.fromFloor===edge.fromFloor&&e.toFloor===edge.toFloor&&e.x===edge.x);}
 start(intent:WorldIntent){this.cancel();if(intent.type==='cancel'||this.options.busy())return;this.intention=structuredClone(intent);this.remember();this.completed();}
 direction(source:string,direction:'left'|'right'|'up'|'down'){
  this.cancel();if(this.options.busy())return;this.held={source,direction};const p=this.options.view().player;this.intention={type:'move-to',target:{floor:p.floor+(direction==='down'?1:direction==='up'?-1:0),x:p.x+(direction==='right'?1:direction==='left'?-1:0)}};this.remember();this.completed();
 }
 release(source:string){if(this.held?.source===source)this.cancel();}
 private remember(){const v=this.options.view();this.expected={seed:v.seed,revision:v.revision};}
 private context(ref:TargetRef){this.cancel();this.options.context(ref);}
 private commit(command:Command,terminal=false){
  const before=this.options.view();this.submitting=true;let result:{accepted:boolean;interrupt?:boolean};
  try{result=this.options.submit(command);}catch{this.cancel();return;}finally{this.submitting=false;}
  const after=this.options.view();
  if(!result.accepted){this.stop('intent.obstacle');return;}
  if(result.interrupt||terminal||after.status!=='playing'||after.player.floor!==before.player.floor||after.player.hp<before.player.hp||conditions(after)!==conditions(before)||after.enemies.some(e=>!before.enemies.some(old=>old.id===e.id))||after.enemies.some(e=>e.intent&&!before.enemies.some(old=>old.id===e.id&&JSON.stringify(old.intent)===JSON.stringify(e.intent)))){this.cancel();return;}
  this.remember();
 }
 completed(){
  if(this.submitting||!this.intention||this.options.busy())return;
  const v=this.options.view();if(v.status!=='playing'||v.seed!==this.expected?.seed||v.revision!==this.expected.revision){this.stop('intent.stale');return;}
  if(this.climb){
   const edge=this.climb;if(!this.validEdge(v,edge)){this.cancel();return;}
   if(v.player.floor===edge.fromFloor&&v.player.x===edge.x){
    const command=edge.toFloor<edge.fromFloor?'up':'down',target={floor:edge.toFloor,x:edge.x};
    const reason=danger(v,target);if(reason){this.stop(reason);return;}
    const offer=this.options.offers({type:'world-entity',kind:'ladder',id:edge.linkId}).find(o=>o.revision===v.revision&&o.status!=='disabled'&&o.command===command);
    if(offer)this.commit(command,true);else this.cancel();return;
   }
  }
  let target:Position|undefined,allowedEnemy:number|undefined;
  if(this.held){const d=this.held.direction;target={floor:v.player.floor+(d==='down'?1:d==='up'?-1:0),x:v.player.x+(d==='right'?1:d==='left'?-1:0)};this.intention={type:'move-to',target};}
  else if(this.intention.type==='move-to')target=this.intention.target;
  else if(this.intention.type==='activate'){
   const ref=this.intention.target;target=targetPosition(v,ref);if(!target){this.stop('intent.stale');return;}
   if(ref.type==='world-entity'&&ref.kind==='enemy')allowedEnemy=ref.id;
   if(v.alpha5&&ref.type==='world-entity'&&ref.kind==='facility'&&target.floor===v.player.floor&&Math.abs(target.x-v.player.x)<=1){this.context(ref);return;}
   if(ref.type==='world-entity'&&ref.kind==='door'&&v.alpha?.doors.some(d=>d.id===ref.id&&d.locked)&&target.floor===v.player.floor&&Math.abs(target.x-v.player.x)<=1){this.context(ref);return;}
   const offers=this.options.offers(ref).filter(o=>o.revision===v.revision&&o.status!=='disabled');
   const enabled=offers.filter(o=>o.status==='enabled'&&!o.requiresConfirmation&&o.command&&(allowedEnemy===undefined||o.command==='attack'));
   if(enabled.length===1&&(offers.length===1||allowedEnemy!==undefined)){const command=enabled[0]!.command!;
    if(command==='attack'&&allowedEnemy!==undefined){const selected=[...v.enemies].filter(e=>e.hp>0&&e.floor===v.player.floor&&Math.abs(e.x-v.player.x)<=(v.alpha2?.attackRange??v.alpha?.range??1)).sort((a,b)=>Math.abs(a.x-v.player.x)-Math.abs(b.x-v.player.x)||a.id-b.id)[0];if(selected?.id!==allowedEnemy){this.context(ref);return;}}
    this.commit(command,true);return;
   }
   if(target.floor===v.player.floor&&Math.abs(target.x-v.player.x)<=(ref.type==='world-entity'&&ref.kind==='ladder'?0:1)){this.context(ref);return;}
  }
  if(!target||same(v.player,target)){this.cancel();return;}
  // A physical climb is an explicit one-step exploration authorization, unlike a planned route.
  if(this.held&&(this.held.direction==='up'||this.held.direction==='down')){
   const connected=target.floor>=0&&target.floor<v.map.floors&&v.map.ladders.some(l=>l.x===v.player.x&&l.floor===Math.min(target!.floor,v.player.floor));
   if(connected)this.commit(this.held.direction,true);else this.cancel();return;
  }
  const step=nextStep(v,target);if(!step){this.stop('intent.unreachable');return;}const reason=danger(v,step,allowedEnemy);if(reason){this.stop(reason);return;}
  const door=v.alpha?.doors.find(d=>!d.open&&d.floor===step.floor&&d.x===step.x);
  if(door){const ref:TargetRef={type:'world-entity',kind:'door',id:door.id};if(door.locked){this.context(ref);return;}const offer=this.options.offers(ref).find(o=>o.revision===v.revision&&o.status==='enabled'&&!o.requiresConfirmation&&o.command===`door:${door.id}`);if(!offer){this.context(ref);return;}this.commit(offer.command!);return;}
  const command:Command=step.floor<v.player.floor?'up':step.floor>v.player.floor?'down':step.x<v.player.x?'left':'right';
  this.commit(command);
 }
}

