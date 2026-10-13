import { describe, expect, it } from 'vitest';
import { createAlpha4, acceptAlpha4, inspectAlpha4 } from '../src/core/alpha4';
import { createAlpha3, acceptAlpha3 } from '../src/core/alpha3';
import { addItem2 } from '../src/core/alpha2-map';
import { bagSlots4 } from '../src/core/alpha4-shared';
import { queryActionOffers4, queryContextOffers4 } from '../src/core/alpha4-query';
import { queryContextOffers } from '../src/core/action-query';
import { canonical, digest } from '../src/core/digest';
import { GameSession, ALPHA4_IDENTITY, ALPHA3_IDENTITY } from '../src/session/session';
import type { Command, World } from '../src/core/types';

// Explicit controlled fixtures for capacity boundaries. Natural routes are separate.
function full() {
  const w=createAlpha4(42);w.enemies=[];w.alpha2!.monsters=[];w.player.gold=999;
  const charm=addItem2(w,'emberRing','bag',w.player,null,true);w.alpha2!.equipped.charm=charm.id;
  while(bagSlots4(w)<16)addItem2(w,'ration','bag',w.player,null,true);
  return w;
}
function step(w:World,c:Command){const r=acceptAlpha4(w,c);expect(r.accepted,c).toBe(true);if(!r.accepted)throw new Error(r.reason);return r.world;}
describe('Alpha 4 inventory policy',()=>{
  it('allows sixteen ordinary items plus six equipment with all weight accounted',()=>{
    const w=full(),v=inspectAlpha4(w).alpha2!;
    expect(v.bag.length).toBe(22);expect(v.capacity).toBe(16);expect(v.capacityUsed).toBe(16);expect(v.capacityIncludesEquipment).toBe(false);
    expect(v.weight).toBe(v.bag.reduce((sum,i)=>sum+i.weight,0));
    expect(v.bag.filter(i=>i.equipped)).toHaveLength(6);
  });
  it('full take, buy and unequip reject atomically with public bagFull while drop creates room',()=>{
    const w=full(),ground=addItem2(w,'ration','ground',w.player,null,true),merchant=w.alpha2!.facilities.find(f=>f.kind==='merchant')!;
    const commands:Command[]=[`take:${ground.id}`,`a2:buy:${merchant.id}:${merchant.stock[0]}`, 'unequip:head'];
    for(const c of commands){const before=canonical(w);expect(acceptAlpha4(w,c)).toEqual({accepted:false,reason:'bagFull'});expect(canonical(w)).toBe(before);}
    expect(queryActionOffers4(w,w.alpha2!.equipped.head!).find(o=>o.actionId==='unequip')).toMatchObject({status:'disabled',publicReason:'interaction.bagFull'});
    expect(queryContextOffers4(w,{type:'world-entity',kind:'ground-item',id:ground.id})[0]).toMatchObject({status:'disabled',publicReason:'interaction.bagFull'});
    expect(queryContextOffers4(w,{type:'world-entity',kind:'facility',id:merchant.id}).filter(o=>o.actionId.startsWith('buy:')).every(o=>o.status==='disabled'&&o.publicReason==='interaction.bagFull')).toBe(true);
    const free=w.alpha2!.items.find(i=>i.owner==='bag'&&!Object.values(w.alpha2!.equipped).includes(i.id))!;
    const n=step(w,`drop:${free.id}`);expect(bagSlots4(n)).toBe(15);expect(bagSlots4(step(n,'unequip:head'))).toBe(16);expect(bagSlots4(step(n,`take:${ground.id}`))).toBe(16);
    expect(bagSlots4(step(n,`a2:buy:${merchant.id}:${merchant.stock[0]}`))).toBe(16);
  });
  it('same-slot swap at sixteen consumes no extra slot and cursed rejection leaves no half swap',()=>{
    let w=full();const free=w.alpha2!.items.find(i=>i.owner==='bag'&&!Object.values(w.alpha2!.equipped).includes(i.id))!;free.owner='spent';
    const replacement=addItem2(w,'sword','bag',w.player,null,true),old=w.alpha2!.equipped.mainHand!;
    expect(bagSlots4(w)).toBe(16);expect(queryActionOffers4(w,replacement.id).find(o=>o.actionId==='equip')?.status).toBe('enabled');
    const n=step(w,`wear:${replacement.id}`);expect(bagSlots4(n)).toBe(16);expect(n.alpha2!.equipped.mainHand).toBe(replacement.id);expect(n.alpha2!.items.find(i=>i.id===old)?.owner).toBe('bag');
    w.alpha2!.items.find(i=>i.id===old)!.blessing='cursed';const before=canonical(w);expect(acceptAlpha4(w,`wear:${replacement.id}`).accepted).toBe(false);expect(canonical(w)).toBe(before);
  });
  it('public slot survives language or hidden charge/BUC changes but never reveals a hidden individual definition',()=>{
    const w=createAlpha4(42),a=addItem2(w,'cinder','bag',w.player),b=addItem2(w,'latch','bag',w.player);
    const slots=inspectAlpha4(w).alpha2!.bag;
    expect(slots.find(i=>i.id===a.id)?.equippableSlot).toBeUndefined();expect(slots.find(i=>i.id===b.id)?.equippableSlot).toBeUndefined();
    expect(slots.find(i=>i.equipped==='chest')?.equippableSlot).toBe('chest');
    a.blessing='cursed';a.charges=0;expect(inspectAlpha4(w).alpha2!.bag.find(i=>i.id===a.id)?.equippableSlot).toBeUndefined();
  });
  it('old Alpha 3 capacity and queries retain total-carried semantics',()=>{
    const w=createAlpha3(42);w.enemies=[];while(w.alpha2!.items.filter(i=>i.owner==='bag').length<16)addItem2(w,'ration','bag',w.player,null,true);
    const g=addItem2(w,'ration','ground',w.player,null,true),before=canonical(w);
    expect(acceptAlpha3(w,`take:${g.id}`)).toEqual({accepted:false,reason:'bagFull'});
    expect(queryContextOffers(w,{type:'world-entity',kind:'ground-item',id:g.id})[0]?.status).toBe('disabled');expect(canonical(w)).toBe(before);
    expect(acceptAlpha3(w,'unequip:head').accepted).toBe(true);
  });
  it('each enabled capacity offer is accepted with zero query side effects',()=>{
    const w=full(),free=w.alpha2!.items.find(i=>i.owner==='bag'&&!Object.values(w.alpha2!.equipped).includes(i.id))!;
    free.owner='spent';const g=addItem2(w,'ration','ground',w.player,null,true),before=canonical(w);
    const offers=[...queryActionOffers4(w,w.alpha2!.equipped.head!),...queryContextOffers4(w,{type:'world-entity',kind:'ground-item',id:g.id}),...queryContextOffers4(w,{type:'world-entity',kind:'facility',id:w.alpha2!.facilities.find(f=>f.kind==='merchant')!.id})];
    for(const o of offers.filter(o=>o.status==='enabled'&&o.command))expect(acceptAlpha4(w,o.command!).accepted,o.command).toBe(true);
    expect(canonical(w)).toBe(before);
  });
  it('new identity naturally saves, seeks, resumes and rejects identity substitution',()=>{
    const s=new GameSession(42,'alpha4');const states=[s.view()];
    for(const c of ['choose:vanguard','take:1','a3:throw:8:0:3','wait','right'] as Command[]){const r=s.submit(c);if(r.accepted)states.push(s.view());}
    const raw=s.capture(),loaded=GameSession.fromArchive(raw);expect(JSON.parse(raw).identity).toEqual(ALPHA4_IDENTITY);expect(ALPHA4_IDENTITY).not.toEqual(ALPHA3_IDENTITY);
    for(let i=states.length-1;i>=0;i--)expect(loaded.replay(i)).toEqual(states[i]);
    expect(loaded.capture()).toBe(raw);expect(loaded.submit('wait')).toEqual(s.submit('wait'));expect(loaded.capture()).toBe(s.capture());
    const fake=JSON.parse(raw);fake.identity=ALPHA3_IDENTITY;expect(()=>GameSession.fromArchive(JSON.stringify(fake))).toThrow('divergence');
    expect(digest(createAlpha4(42))).toBe(digest(createAlpha4(42)));
  });
});

