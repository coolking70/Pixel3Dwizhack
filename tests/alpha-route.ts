import {GameSession} from '../src/session/session';
import type {Command,Position} from '../src/core/types';
import type {Loadout} from '../src/core/alpha-types';
export {GameSession};
// All decisions use the detached public view. Paths are replanned when new
// doors, ladders or enemies enter sight; no hidden map or edited save is used.
export function runAlpha(seed:number,loadout:Loadout='vanguard',branch=false){
 const session=new GameSession(seed,'alpha'),commands:Command[]=[],states=[session.view()],handled=new Set<number>();
 const attempt=(c:Command)=>{const r=session.submit(c);if(r.accepted){commands.push(c);states.push(session.view());if(commands.length>1800)throw new Error('route budget');}return r;};
 const act=(c:Command)=>{const r=attempt(c);if(!r.accepted)throw new Error(`${c}/${r.reason} @ ${JSON.stringify(session.view().player)}`);};
 act(`choose:${loadout}`);
 const care=()=>{const v=session.view(),bag=v.expedition!.bag;if(v.expedition!.effects.some(e=>e.kind==='poison')){const cure=bag.find(i=>i.effect==='antidote');if(cure)act(`use:${cure.id}`);}if(session.view().player.hp<32&&session.view().player.potions)act('potion');};
 const collect=()=>{
  for(const item of session.view().expedition!.nearby.filter(i=>!handled.has(i.id))){
   if(item.kind==='relic'&&!session.view().expedition!.bossDefeated)continue;
   if(session.view().expedition!.bag.length>=16&&item.kind!=='relic'){
    const junk=session.view().expedition!.bag.find(i=>i.kind==='gear'&&!i.equipped);if(!junk)continue;act(`drop:${junk.id}`);handled.add(junk.id);
   }
   care();act(`take:${item.id}`);handled.add(item.id);
   const v=session.view();
   if(item.gear){const slot=v.gear!.catalog.find(g=>g.id===item.gear)!.slot,old=v.expedition!.bag.find(i=>i.equipped===slot);
    // Keep each starting weapon, so these are distinct build routes.
    if(slot!=='mainHand'&&(!old||item.armor!>old.armor!))act(`wear:${item.id}`);
   }
   if(item.kind==='flask'&&!item.effect&&v.expedition!.bag.some(i=>i.kind==='scroll'))act(`identify:${item.id}`);
   const known=session.view().expedition!.bag.find(i=>i.id===item.id);if(known?.effect==='might'||known?.effect==='ward')act(`use:${item.id}`);
  }
 };
 const path=(target:Position):Command|undefined=>{
  const v=session.view(),key=(p:Position)=>`${p.floor}:${p.x}`,start=key(v.player),queue=[{p:{x:v.player.x,floor:v.player.floor},first:undefined as Command|undefined}],seen=new Set([start]);
  for(let i=0;i<queue.length;i++){
   const {p,first}=queue[i]!;if(key(p)===key(target))return first;
   const moves:[Command,Position][]=[['left',{...p,x:p.x-1}],['right',{...p,x:p.x+1}]];
   for(const [c,f] of [['up',p.floor-1],['down',p.floor+1]] as const)if(v.map.ladders.some(l=>l.x===p.x&&l.floor===Math.min(p.floor,f)))moves.push([c,{x:p.x,floor:f}]);
   for(const [c,n] of moves){if(n.x<1||n.x>=v.map.width-1||n.floor<0||n.floor>=v.map.floors||seen.has(key(n))||v.alpha!.doors.some(d=>d.floor===n.floor&&d.x===n.x&&!d.open&&d.locked))continue;seen.add(key(n));queue.push({p:n,first:first??c});}
  }
 };
 const go=(target:Position)=>{
  let budget=800;
  while((session.view().player.x!==target.x||session.view().player.floor!==target.floor)&&budget-->0){
   care();const v=session.view();if(v.status!=='playing')throw new Error(`dead seed=${seed} ${loadout} branch=${branch} at=${JSON.stringify(v.player)}`);
   const inRange=v.enemies.filter(e=>Math.abs(e.x-v.player.x)<=v.alpha!.range);
   if(loadout==='channeler'&&v.player.equipment!.mainHand==='wand'&&v.alpha!.mana>=v.alpha!.spellCost&&inRange.length){act('cast');continue;}
   collect();const now=session.view();
   const lever=now.alpha!.levers.find(l=>!l.used&&Math.abs(l.x-now.player.x)<=1);if(lever){act(`lever:${lever.id}`);continue;}
   if(branch){const cache=now.alpha!.caches.find(c=>!c.used&&Math.abs(c.x-now.player.x)<=1);if(cache&&(now.player.gold>=12||now.player.hp>20)){act(`cache:${cache.id}:${now.player.gold>=12?'pay':'force'}`);continue;}}
   const c=path(target);if(!c)throw new Error(`no public route ${JSON.stringify(target)}`);
   if(c==='left'||c==='right'){const x=now.player.x+(c==='left'?-1:1),door=now.alpha!.doors.find(d=>d.floor===now.player.floor&&d.x===x&&!d.open);if(door){act(`door:${door.id}`);continue;}}
   act(c);
  }
  if(budget<=0)throw new Error('path budget');if(session.view().status==='playing')collect();
 };
 // A full first-floor sweep learns both entrances through actual exploration.
 go({floor:0,x:22});
 for(let floor=1;floor<6;floor++){
  const links=session.view().map.ladders.filter(l=>l.floor===floor-1).sort((a,b)=>a.x-b.x);
  const selected=branch&&floor%2?1:0;
  go({floor:floor-1,x:links[selected]!.x});care();
  const descended=attempt('down');if(!descended.accepted){if(descended.reason!=='blocked')throw new Error(descended.reason);go({floor:floor-1,x:links[1-selected]!.x});act('down');}
  if(branch){go({floor,x:3});go({floor,x:22});}
  else if(floor<5){const discovered=session.view().map.ladders.find(l=>l.floor===floor);if(!discovered)go({floor,x:3});}
 }
 go({floor:5,x:23});
 if(!session.view().player.relic){care();collect();}
 if(!session.view().player.relic)throw new Error('no relic');
 go({floor:0,x:1});
 return{session,commands,states};
}
