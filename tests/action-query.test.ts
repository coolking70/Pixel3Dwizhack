import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { queryActionOffers, queryTargets, queryContextOffers } from '../src/core/action-query';
import { ITEMS, ALPHA2 as C } from '../src/content/alpha2';
import { createAlpha2, acceptAlpha2 } from '../src/core/alpha2';
import { addItem2, spawnMonster2 } from '../src/core/alpha2-map';
import { canonical } from '../src/core/digest';
import { GameSession } from '../src/session/session';
import type { World, Command } from '../src/core/types';
import type { FacilityKind, Item2 } from '../src/core/alpha2-types';
import type { PublicActionOffer, PublicTargetOffer } from '../src/core/action-types';

// Deliberate controlled states, not natural game traces or save fixtures.
function arena(): World {
  const w = createAlpha2(42), s = w.alpha2!;
  w.player.x = 10; w.player.hp = 60; w.player.gold = 1000;
  w.enemies = []; s.monsters = []; s.facilities = []; s.doors = []; s.items = []; s.conditions = [];
  s.equipped = { head:null, chest:null, legs:null, mainHand:null, offHand:null, charm:null };
  s.knowledge = { identified:[], buc:[], enchantment:[], charges:[], notes:{}, monsters:[], facilities:[] };
  w.explored = Array.from({length:C.floors}, () => Array.from({length:C.width},(_,x)=>x));
  return w;
}
function add(w: World, definition: string, known = true): Item2 { return addItem2(w, definition, 'bag', w.player, null, known); }
function facility(w:World, kind:FacilityKind, used=false) {
  const f={id:w.alpha2!.facilities.length+1,kind,used,revealed:true,stock:[] as number[],gold:1000,floor:0,x:11};
  w.alpha2!.facilities.push(f);return f;
}
function accepted(w:World, offer:PublicActionOffer|PublicTargetOffer, label:string) {
  if (offer.status === 'enabled' && offer.command) expect(acceptAlpha2(w,offer.command).accepted,`${label}: ${offer.command}`).toBe(true);
}
function freeze<T>(x:T):T { if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x; }

describe('M21 pure public capability query',()=>{
  it('checks all 45 definitions, every declared action and all public target families against the real command acceptor',()=>{
    let definitions=0, actionCount=0, enabled=0, disabled=0;
    for(const def of ITEMS){
      const w=arena(),source=add(w,def.id);source.blessing='blessed';
      const metal=add(w,'sword');metal.durability=2;
      add(w,'cap');add(w,'fruit');add(w,'emberRing');
      const protectedItem=add(w,'plate');protectedItem.proof=true;
      const broken=add(w,'maul');broken.durability=0;
      spawnMonster2(w,'crawler',{floor:0,x:12});spawnMonster2(w,'emberling',{floor:0,x:13});w.enemies.forEach(e=>e.nextAt=100000);
      for(const kind of ['merchant','altar','fountain','chest','trap','garden','campfire','hazard'] as const)facility(w,kind);
      w.alpha2!.doors.push({id:1,floor:0,x:9,open:false,locked:true});
      definitions++;
      for(const action of Object.keys(def.actions)){
        actionCount++;
        const offer=queryActionOffers(w,source.id).find(o=>o.actionId===action)!;
        expect(offer,`${def.id}/${action}`).toBeDefined();accepted(w,offer,def.id);
        const targets=queryTargets(w,source.id,action);
        if(action!=='equip'){
          expect(targets.some(t=>t.ref.type==='self')).toBe(true);
          expect(targets.some(t=>t.ref.type==='inventory-item')).toBe(true);
          expect(targets.some(t=>t.ref.type==='world-entity'&&t.ref.kind==='enemy')).toBe(true);
          expect(targets.some(t=>t.ref.type==='world-entity'&&t.ref.kind==='facility')).toBe(true);
          expect(targets.some(t=>t.ref.type==='world-entity'&&t.ref.kind==='door')).toBe(true);
          expect(targets.some(t=>t.status!=='disabled'),`${def.id}/${action} has usable public target`).toBe(true);
        }
        for(const t of targets){if(t.status==='enabled')enabled++;if(t.status==='disabled')disabled++;accepted(w,t,`${def.id}/${action}/${t.key}`);}
      }
      for(const o of queryActionOffers(w,source.id))accepted(w,o,def.id);
    }
    expect(definitions).toBe(45);expect(actionCount).toBeGreaterThan(45);expect(enabled).toBeGreaterThan(100);expect(disabled).toBeGreaterThan(200);
    console.log(JSON.stringify({definitions,declaredActions:actionCount,enabledTargets:enabled,disabledTargets:disabled}));
  });
  it('enforces range, visible-only targets, same-item exclusion and closed-door occlusion',()=>{
    const w=arena(),source=add(w,'mending');spawnMonster2(w,'crawler',{floor:0,x:12});spawnMonster2(w,'crawler',{floor:0,x:16});spawnMonster2(w,'crawler',{floor:1,x:10});
    let offers=queryTargets(w,source.id,'zap');expect(offers.find(o=>o.key==='e1')?.status).toBe('enabled');expect(offers.find(o=>o.key==='e2')?.status).toBe('disabled');expect(offers.find(o=>o.key==='e3')).toBeUndefined();
    w.alpha2!.doors.push({id:1,floor:0,x:11,locked:false,open:false});offers=queryTargets(w,source.id,'zap');expect(offers.some(o=>o.key==='e1')).toBe(false);
    const scroll=add(w,'insight');expect(queryTargets(w,scroll.id,'read').find(o=>o.key===`i${scroll.id}`)?.publicReason).toBe('interaction.sameItem');
  });
  it('known effect prerequisites distinguish target material, durability, proof and hazard state',()=>{
    const w=arena(),kit=add(w,'kit'),salve=add(w,'salve'),acid=add(w,'acid'),pot=add(w,'pot'),sword=add(w,'sword'),wood=add(w,'spear'),food=add(w,'fruit');
    const target=(source:Item2,id:number)=>queryTargets(w,source.id,'apply').find(o=>o.key===`i${id}`)!;
    expect(target(kit,sword.id).publicReason).toBe('interaction.fullDurability');sword.durability=2;expect(target(kit,sword.id).status).toBe('enabled');
    expect(target(salve,wood.id).status).toBe('disabled');expect(target(salve,sword.id).status).toBe('enabled');sword.proof=true;expect(target(salve,sword.id).publicReason).toBe('interaction.protected');expect(target(acid,sword.id).status).toBe('disabled');
    expect(target(pot,food.id).status).toBe('enabled');expect(target(pot,sword.id).status).toBe('disabled');
    const hazard=facility(w,'hazard'),fire=add(w,'cinder'),cold=add(w,'rime');
    const ray=(source:Item2)=>queryTargets(w,source.id,'zap').find(o=>o.key===`f${hazard.id}`)!;
    expect(ray(fire).status).toBe('disabled');expect(ray(cold).status).toBe('enabled');hazard.used=true;expect(ray(fire).status).toBe('enabled');expect(ray(cold).status).toBe('disabled');
  });
  it('withholds misleading water/damage door targets while leaving historical submit behavior intact',()=>{
    const w=arena(),water=add(w,'water'),fire=add(w,'cinder');w.alpha2!.doors.push({id:1,floor:0,x:11,open:false,locked:true});
    for(const [source,action]of [[water,'throw'],[fire,'zap']] as const){
      const hint=queryTargets(w,source.id,action).find(o=>o.key==='d1')!;
      expect(hint.status).toBe('disabled');expect(hint.publicReason).toBe('interaction.wrongTarget');
      const historical=acceptAlpha2(w,hint.command!);expect(historical.accepted).toBe(true);
      if(historical.accepted){expect(historical.world.alpha2!.doors[0]).toEqual(w.alpha2!.doors[0]);if(action==='zap')expect(historical.world.player.hp).toBeLessThan(w.player.hp);}
    }
  });
  it('unknown definitions expose category-union actions/targets rather than hidden applicability',()=>{
    for(const category of ['potion','scroll','wand','accessory'] as const){
      let reference:unknown;
      for(const d of ITEMS.filter(d=>d.category===category)){
        const w=arena(),source=add(w,d.id,false);source.enchantment=0;source.blessing='uncursed';w.alpha2!.assignment[d.id]=0;
        add(w,'sword');add(w,'fruit');spawnMonster2(w,'crawler',{floor:0,x:12});facility(w,'hazard');facility(w,'chest');
        const offers=queryActionOffers(w,source.id), result={offers,targets:offers.map(o=>queryTargets(w,source.id,o.actionId))};
        if(reference)expect(result,category+'/'+d.id).toEqual(reference);else reference=result;
        if(category==='potion')expect(offers.some(o=>o.actionId==='apply')).toBe(true);
      }
    }
  });
  it('unknown BUC and charges never disclose their actual blocking value',()=>{
    const w=arena(),water=add(w,'water'),sword=add(w,'sword'),wand=add(w,'mending');
    w.alpha2!.knowledge.buc=w.alpha2!.knowledge.buc.filter(id=>id!==water.id);w.alpha2!.knowledge.charges=w.alpha2!.knowledge.charges.filter(id=>id!==wand.id);
    const a=queryTargets(w,water.id,'apply');water.blessing='cursed';expect(queryTargets(w,water.id,'apply')).toEqual(a);expect(a.find(t=>t.key===`i${sword.id}`)?.status).toBe('uncertain');
    const b=queryTargets(w,wand.id,'zap');wand.charges=0;expect(queryTargets(w,wand.id,'zap')).toEqual(b);expect(b.find(t=>t.key==='self')?.status).toBe('uncertain');
    w.alpha2!.knowledge.charges.push(wand.id);expect(queryTargets(w,wand.id,'zap').find(t=>t.key==='self')?.publicReason).toBe('interaction.noCharges');
    w.alpha2!.equipped.mainHand=sword.id;w.alpha2!.knowledge.buc=w.alpha2!.knowledge.buc.filter(id=>id!==sword.id);
    const c=queryActionOffers(w,sword.id);sword.blessing='cursed';expect(queryActionOffers(w,sword.id)).toEqual(c);expect(c.find(o=>o.actionId==='unequip')?.status).toBe('uncertain');
    w.alpha2!.knowledge.buc.push(sword.id);expect(queryActionOffers(w,sword.id).find(o=>o.actionId==='unequip')?.publicReason).toBe('interaction.cursed');
  });
  it('checks equipped source, cursed replacement, terminal states and the exact sleep exception',()=>{
    const w=arena(),sword=add(w,'sword'),replacement=add(w,'maul'),potion=add(w,'renewal');w.alpha2!.equipped.mainHand=sword.id;
    expect(queryActionOffers(w,sword.id).find(o=>o.actionId==='drop')?.status).toBe('disabled');expect(queryTargets(w,sword.id,'throw').every(o=>o.status==='disabled')).toBe(true);
    sword.blessing='cursed';expect(queryActionOffers(w,replacement.id).find(o=>o.actionId==='equip')?.publicReason).toBe('interaction.cursed');
    w.alpha2!.conditions.push({kind:'sleep',actor:0,until:100,nextAt:20,power:0,source:'system:sleep'});
    expect(queryActionOffers(w,replacement.id).find(o=>o.actionId==='drop')?.publicReason).toBe('interaction.asleep');const drink=queryTargets(w,potion.id,'drink').find(o=>o.key==='self')!;expect(drink.status).toBe('enabled');accepted(w,drink,'sleep permits explicit a2 use');
    w.status='dead';expect(queryActionOffers(w,potion.id).every(o=>o.status==='disabled')).toBe(true);
  });
  it('queries all facility actions and public payments/trades without false enabled commands',()=>{
    let checked=0;
    for(const kind of ['merchant','altar','fountain','chest','trap','garden','campfire','hazard'] as const)for(const used of [false,true]){
      const w=arena(),f=facility(w,kind,used);add(w,'sword');add(w,'fruit');const wand=add(w,'mending');wand.charges=2;
      if(kind==='merchant'){const shop=addItem2(w,'ration','shop',f,f.id,true);f.stock.push(shop.id);}
      for(const o of queryContextOffers(w,{type:'world-entity',kind:'facility',id:f.id})){accepted(w,o,kind);checked++;}
      w.player.gold=0;w.player.hp=7;f.gold=0;
      const poor=queryContextOffers(w,{type:'world-entity',kind:'facility',id:f.id});for(const o of poor)accepted(w,o,'poor/'+kind);
      if(kind==='chest'&&!used)expect(poor.map(o=>o.publicReason)).toEqual(['interaction.noGold','interaction.noHealth']);
    }
    expect(checked).toBeGreaterThan(20);
  });
  it('checks full bags, occupied doors, direct pickup, correct enemy and uncertain off-floor ladder occupancy',()=>{
    const w=arena();w.alpha2!.doors.push({id:1,floor:0,x:11,open:false,locked:false});
    let offers=queryContextOffers(w,{type:'world-entity',kind:'door',id:1});expect(offers.find(o=>o.actionId==='open')?.status).toBe('enabled');offers.forEach(o=>accepted(w,o,'door'));
    w.player.x=11;expect(queryContextOffers(w,{type:'world-entity',kind:'door',id:1}).every(o=>o.status==='disabled')).toBe(true);w.player.x=10;w.alpha2!.doors=[];
    const loot=addItem2(w,'fruit','ground',{floor:0,x:11},null,true);const pickup=()=>queryContextOffers(w,{type:'world-entity',kind:'ground-item',id:loot.id})[0]!;
    expect(pickup().status).toBe('enabled');accepted(w,pickup(),'take');for(let n=0;n<16;n++)add(w,'ration');expect(pickup().publicReason).toBe('interaction.bagFull');
    spawnMonster2(w,'crawler',{floor:0,x:11});spawnMonster2(w,'crawler',{floor:0,x:9});expect(queryContextOffers(w,{type:'world-entity',kind:'enemy',id:2}).find(o=>o.actionId==='attack')?.status).toBe('disabled');
    w.alpha2!.links=[{floor:0,x:10}];const ladder=queryContextOffers(w,{type:'world-entity',kind:'ladder',id:10});expect(ladder[0]?.status).toBe('uncertain');
    spawnMonster2(w,'crawler',{floor:1,x:10});expect(queryContextOffers(w,{type:'world-entity',kind:'ladder',id:10})).toEqual(ladder);
  });
  it('offers relic pickup only for the visible public id without inspecting hidden guards',()=>{
    const w=arena();w.alpha2!.relic={floor:0,x:11};
    const query=()=>queryContextOffers(w,{type:'world-entity',kind:'relic',id:9999});
    const before=query();expect(before[0]?.status).toBe('uncertain');
    spawnMonster2(w,'warden',{floor:5,x:10});expect(query()).toEqual(before);
    w.enemies[0]!.floor=0;w.enemies[0]!.x=12;expect(query()[0]?.publicReason).toBe('interaction.guarded');
    w.enemies[0]!.hp=0;expect(query()[0]?.status).toBe('enabled');accepted(w,query()[0]!,'relic');
    w.player.x=2;expect(query()).toEqual([]);expect(queryContextOffers(w,{type:'world-entity',kind:'relic',id:1234})).toEqual([]);
  });
  it('uses public trade prices, full-bag and recharge knowledge thresholds',()=>{
    const w=arena(),f=facility(w,'merchant'),wand=add(w,'mending');
    const shop=addItem2(w,'ration','shop',f,f.id,true);f.stock.push(shop.id);
    const query=()=>queryContextOffers(w,{type:'world-entity',kind:'facility',id:f.id});
    expect(query().find(o=>o.actionId===`recharge:${wand.id}`)?.publicReason).toBe('interaction.fullCharges');
    w.alpha2!.knowledge.charges=[];const unknown=query().find(o=>o.actionId===`recharge:${wand.id}`);expect(unknown?.status).toBe('uncertain');wand.charges=0;expect(query().find(o=>o.actionId===`recharge:${wand.id}`)).toEqual(unknown);
    w.alpha2!.knowledge.charges.push(wand.id);expect(query().find(o=>o.actionId===`recharge:${wand.id}`)?.status).toBe('enabled');
    for(let n=0;n<15;n++)add(w,'ration');expect(query().find(o=>o.actionId===`buy:${shop.id}`)?.publicReason).toBe('interaction.bagFull');
    w.player.gold=7;expect(query().find(o=>o.actionId===`recharge:${wand.id}`)?.publicReason).toBe('interaction.noGold');
    query().forEach(o=>accepted(w,o,'full trade bag'));
  });
  it('does not inspect hidden blink/summon blockers, mutate frozen world, consume RNG, or share world references',()=>{
    const w=arena(),blink=add(w,'shift'),summon=add(w,'calling');
    const before=canonical(w), rng=w.rng;
    freeze(w);
    for(let n=0;n<5;n++){
      const b=queryTargets(w,blink.id,'read'),s=queryTargets(w,summon.id,'read');expect(b.find(t=>t.key==='self')?.status).toBe('uncertain');expect(s.find(t=>t.key==='self')?.status).toBe('uncertain');
      expect(Object.isFrozen(b)).toBe(true);expect(Object.isFrozen(b[0]?.ref)).toBe(true);
      queryActionOffers(w,blink.id);queryContextOffers(w,{type:'inventory-item',itemId:blink.id});
    }
    expect(canonical(w)).toBe(before);expect(w.rng).toBe(rng);
    const other=structuredClone(w);for(let n=0;n<42;n++)spawnMonster2(other,'crawler',{floor:5,x:10});
    expect(queryTargets(other,summon.id,'read')).toEqual(queryTargets(w,summon.id,'read'));
  });
  it('compares public enabled candidates with formal GameSession submits at natural golden boundaries',()=>{
    const golden=JSON.parse(readFileSync('tests/fixtures/alpha2-v1.json','utf8')) as {seed:number;history:{command:Command;digest:string}[]};
    const session=new GameSession(golden.seed,'alpha2');let checks=0;
    for(const [n,entry]of golden.history.entries()){
      if(n%40===0){
        const raw=session.capture(),world=JSON.parse(raw).world as World;
        const choices:(PublicActionOffer|PublicTargetOffer)[]=[];
        for(const item of session.view().alpha2!.bag){
          for(const offer of queryActionOffers(world,item.id)){
            const enabled=offer.command?[offer]:queryTargets(world,item.id,offer.actionId);
            choices.push(...enabled.filter(o=>o.status==='enabled'&&o.command).slice(0,1));
          }
        }
        // Three spread candidates per boundary keep archive replay cost
        // bounded; the controlled full matrix above checks every target.
        for(const index of [...new Set([0,Math.floor(choices.length/2),choices.length-1])]){
          const candidate=choices[index];if(!candidate)continue;
          const fork=GameSession.fromArchive(raw);expect(fork.submit(candidate.command!).accepted,candidate.command).toBe(true);checks++;
        }
        expect(session.capture()).toBe(raw);
      }
      expect(session.submit(entry.command).accepted).toBe(true);expect(session.fingerprint()).toBe(entry.digest);
    }
    expect(checks).toBeGreaterThan(20);console.log(JSON.stringify({naturalEnabledSubmits:checks,goldenCommands:golden.history.length}));
  },120000);
  it('returns no capabilities for absent sources, unsupported actions, hidden entities or old scenarios',()=>{
    const w=arena();expect(queryActionOffers(w,9999)).toEqual([]);expect(queryTargets(w,1,'fake')).toEqual([]);expect(queryContextOffers(w,{type:'world-entity',kind:'enemy',id:999})).toEqual([]);
    const old=JSON.parse(new GameSession(42,'mine').capture()).world;expect(queryActionOffers(old,1)).toEqual([]);
  });
});
