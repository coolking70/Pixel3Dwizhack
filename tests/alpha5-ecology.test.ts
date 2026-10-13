import { expect,it } from 'vitest';
import { createAlpha5,acceptAlpha5,inspectAlpha5 } from '../src/core/alpha5';
import { queryContextOffers5 } from '../src/core/alpha5-query';
import { queryTargets4 } from '../src/core/alpha4-query';
import { addItem2,spawnMonster2 } from '../src/core/alpha2-map';
import { quote2 } from '../src/core/alpha2-shared';
import { interactionReceipt } from '../src/visual/motions/receipt';
import { resolveItemVisual } from '../src/visual/items/appearance-resolver';
import { canonical } from '../src/core/digest';
import { ITEMS5,MONSTERS5,REGIONS5 } from '../src/content/alpha5-catalog';
import type { Command,World } from '../src/core/types';
import type { FacilityKind } from '../src/core/alpha2-types';
function base(){const w=createAlpha5(42);w.enemies=[];w.alpha2!.monsters=[];w.alpha2!.facilities=[];w.alpha2!.doors=[];w.player.x=10;w.explored[0]=Array.from({length:30},(_,x)=>x);return w;}
function feature(w:World,kind:FacilityKind,x=11){w.alpha2!.facilities.push({id:100,kind,floor:0,x,used:false,revealed:true,stock:[],gold:0});return w.alpha2!.facilities[0]!;}
function step(w:World,c:Command){const r=acceptAlpha5(w,c);expect(r.accepted,c).toBe(true);if(!r.accepted)throw Error(r.reason);return r.world;}
it('two packages have complete localized definitions and appear across four naturally generated seeds within existing loot budget',()=>{
 expect(REGIONS5).toHaveLength(2);expect(ITEMS5).toHaveLength(2);expect(MONSTERS5).toHaveLength(2);
 for(const d of [...ITEMS5,...MONSTERS5]){expect(d.name.zh&&d.name.en&&d.description.zh&&d.description.en).toBeTruthy();expect(d.sourceKey).toBe('original-alpha5');}
 for(const seed of [1,2,42,24681]){const w=createAlpha5(seed),s=w.alpha2!;for(const r of REGIONS5){expect(s.items.some(i=>i.definition===r.item)).toBe(true);expect(s.monsters.some(m=>m.definition===r.monster)).toBe(true);expect(s.facilities.filter(f=>f.kind===r.feature)).toHaveLength(3);}expect(w.alpha4!.enemyDrops.every(d=>d.itemIds.length<=2)).toBe(true);expect(s.facilities.filter(f=>f.kind==='barricade')).toHaveLength(3);}
});
it.each([['sporeBed','seal',24],['relay','isolate',24],['barricade','clear',18]] as const)('%s has a zero-resource manual alternative with exact tick and stale used rejection',(kind,action,cost)=>{
 const w=base(),f=feature(w,kind),offers=queryContextOffers5(w,{type:'world-entity',kind:'facility',id:f.id});expect(offers[0]?.status).toBe('enabled');const n=step(w,`a5:feature:${f.id}:${action}`);expect(n.tick).toBe(cost);expect(n.revision).toBe(1);expect(n.alpha2!.facilities[0]!.used).toBe(true);
 const before=canonical(n);expect(acceptAlpha5(n,`a5:feature:${f.id}:${action}`).accepted).toBe(false);expect(canonical(n)).toBe(before);expect(queryContextOffers5(n,{type:'world-entity',kind:'facility',id:f.id})[0]?.status).toBe('disabled');
});
it('unrevealed, distant, wrong facility or sleeping manual requests are atomic rejections',()=>{
 for(const mode of ['hidden','far','wrong','sleep']){const w=base(),f=feature(w,'sporeBed');if(mode==='hidden')f.revealed=false;if(mode==='far')f.x=20;if(mode==='wrong')f.kind='altar';if(mode==='sleep')w.alpha2!.conditions.push({kind:'sleep',actor:0,until:100,nextAt:20,power:0,source:'test'});const before=canonical(w);expect(acceptAlpha5(w,'a5:feature:100:seal').accepted).toBe(false);expect(canonical(w)).toBe(before);}
});
it('crossbeam blocks walking and landing but permits two-cell leap or dismantling',()=>{
 const w=base();feature(w,'barricade');expect(acceptAlpha5(w,'right').accepted).toBe(false);expect(acceptAlpha5(w,'a5:jump:11').accepted).toBe(false);expect(step(w,'a5:jump:12').player.x).toBe(12);expect(step(step(w,'a5:feature:100:clear'),'right').player.x).toBe(11);
});
it('spore bed poisons and relay shocks only on contact, not when jumped over',()=>{
 const a=base();feature(a,'sporeBed');expect(step(a,'right').alpha2!.conditions.some(c=>c.kind==='poison')).toBe(true);expect(step(a,'a5:jump:12').alpha2!.conditions).toHaveLength(0);
 const b=base();feature(b,'relay');expect(step(b,'right').player.hp).toBe(b.player.hp-6);expect(step(b,'a5:jump:12').player.hp).toBe(b.player.hp);
});
it.each([['sporeBed','sporeBell'],['relay','coilKey']] as const)('%s tool route consumes one charge and is accurately offered without hidden BUC disclosure',(kind,definition)=>{
 const w=base();feature(w,kind);const item=addItem2(w,definition,'bag',w.player);const before=canonical(w),targets=queryTargets4(w,item.id,'apply'),t=targets.find(t=>t.key==='f100')!;
 expect(t.status).not.toBe('disabled');expect(canonical(w)).toBe(before);const n=step(w,t.command!);expect(n.alpha2!.facilities[0]!.used).toBe(true);expect(n.alpha2!.items.find(i=>i.id===item.id)!.charges).toBe(item.charges-1);expect(inspectAlpha5(w).alpha2!.bag.find(i=>i.id===item.id)!.blessing).toBeUndefined();
});
it('bell cures poison on self and cursed bed use retains its documented backlash',()=>{
 const w=base();feature(w,'sporeBed');const item=addItem2(w,'sporeBell','bag',w.player,null,true);item.blessing='cursed';const n=step(w,`a2:use:${item.id}:apply:f100`);expect(n.alpha2!.conditions.some(c=>c.kind==='poison')).toBe(true);expect(step(n,`a2:use:${item.id}:apply:self`).alpha2!.conditions.some(c=>c.kind==='poison')).toBe(false);
});
it('coil tuner repairs real gear, refuses intact gear and non-equipment without paying',()=>{
 const w=base(),tool=addItem2(w,'coilKey','bag',w.player,null,true),gear=w.alpha2!.items.find(i=>i.id===w.alpha2!.equipped.chest)!;gear.durability=2;tool.blessing='blessed';const n=step(w,`a2:use:${tool.id}:apply:i${gear.id}`);expect(n.alpha2!.items.find(i=>i.id===gear.id)!.durability).toBe(6);
 const food=addItem2(w,'ration','bag',w.player,null,true);food.durability=1;const before=canonical(w);expect(acceptAlpha5(w,`a2:use:${tool.id}:apply:i${food.id}`).accepted).toBe(false);expect(canonical(w)).toBe(before);expect(acceptAlpha5(n,`a2:use:${tool.id}:apply:i${gear.id}`).accepted).toBe(false);
});
it('water/fire and unlatching wand are alternate existing-item solutions',()=>{
 for(const [kind,definition,action] of [['sporeBed','water','apply'],['sporeBed','cinder','zap'],['relay','latch','zap']] as const){const w=base();feature(w,kind);const item=addItem2(w,definition,'bag',w.player,null,true);expect(queryTargets4(w,item.id,action).find(t=>t.key==='f100')?.status).not.toBe('disabled');expect(step(w,`a2:use:${item.id}:${action}:f100`).alpha2!.facilities[0]!.used).toBe(true);}
});
it('tender regeneration is tied to the live bed and stops when neutralized',()=>{
 const w=base();feature(w,'sporeBed',14);spawnMonster2(w,'sporeTender',{floor:0,x:13});const e=w.enemies[0]!;e.hp=10;e.nextAt=5;const n=step(w,'wait');expect(n.enemies[0]!.hp).toBe(12);w.alpha2!.facilities[0]!.used=true;expect(step(w,'wait').enemies[0]!.hp).toBe(10);
});
it('hurt loop-mender returns toward power, repairs there, and loses repair when disconnected',()=>{
 const w=base();feature(w,'relay',16);spawnMonster2(w,'repairSpider',{floor:0,x:13});const e=w.enemies[0]!;e.hp=10;e.nextAt=5;const n=step(w,'wait');expect(n.enemies[0]!.x).toBe(14);const n2=step(step(step(step(n,'wait'),'wait'),'wait'),'wait');expect(n2.enemies[0]!.hp).toBe(14);
 w.alpha2!.facilities[0]!.used=true;expect(step(w,'wait').enemies[0]!.x).toBe(12);
});

it.each(['sporeBell','coilKey'])('%s identification, curse release and merchant quote use the existing formal routes',definition=>{
 const w=base(),item=addItem2(w,definition,'bag',w.player);item.blessing='cursed';item.charges=2;
 const a=inspectAlpha5(w).alpha2!.bag.find(i=>i.id===item.id)!;expect(a.blessing).toBeUndefined();expect(a.charges).toBeUndefined();expect(a.definition).toBe(definition);
 const scroll=addItem2(w,'insight','bag',w.player,null,true),n=step(w,`a2:use:${scroll.id}:read:i${item.id}`),b=inspectAlpha5(n).alpha2!.bag.find(i=>i.id===item.id)!;
 expect(b.blessing).toBe('cursed');expect(b.charges).toBe(2);expect(resolveItemVisual(a).assetId).toBe(resolveItemVisual(b).assetId);
 const uncurse=addItem2(n,'release','bag',n.player,null,true),m=step(n,`a2:use:${uncurse.id}:read:i${item.id}`);expect(inspectAlpha5(m).alpha2!.bag.find(i=>i.id===item.id)!.blessing).toBe('uncursed');
 const merchant=feature(m,'merchant',11);merchant.gold=100;m.player.gold=100;const owned=m.alpha2!.items.find(i=>i.id===item.id)!,sell=quote2(m,owned,false),sold=step(m,`a2:sell:${merchant.id}:${item.id}`);expect(sold.player.gold).toBe(100+sell);expect(inspectAlpha5(sold).alpha2!.facilities.find(f=>f.id===merchant.id)!.stock.find(i=>i.id===item.id)!.buy).toBe(quote2(sold,owned,true));
 const bought=step(sold,`a2:buy:${merchant.id}:${item.id}`);expect(bought.alpha2!.items.find(i=>i.id===item.id)!.owner).toBe('bag');
});
it.each([['sporeBed','seal','chestOpen'],['relay','isolate','leverPull'],['barricade','clear','chestOpen']] as const)('%s manual action emits a read-only four-stage presentation receipt',(kind,action,motion)=>{
 const w=base();feature(w,kind);const c=`a5:feature:100:${action}` as Command,n=step(w,c),before=canonical(n),receipt=interactionReceipt(inspectAlpha5(w),inspectAlpha5(n),c);expect(receipt?.motion).toBe(motion);expect(receipt?.cues.map(c=>c.kind)).toEqual(['reach','contact','release','recover']);expect(canonical(n)).toBe(before);
});
