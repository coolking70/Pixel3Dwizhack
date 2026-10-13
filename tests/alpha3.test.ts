import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/content/alpha2';
import { createAlpha3, acceptAlpha3, inspectAlpha3, isAlpha3Command } from '../src/core/alpha3';
import { addItem2, spawnMonster2 } from '../src/core/alpha2-map';
import { canonical } from '../src/core/digest';
import { createWorld, accept, isCommand } from '../src/core/simulation';
import { GameSession, ALPHA2_IDENTITY, ALPHA3_IDENTITY } from '../src/session/session';
import type { Command, World } from '../src/core/types';
import { queryActionOffers3, queryThrowTargets3 } from '../src/core/alpha3-query';
import { interactionReceipt, motionStage } from '../src/visual/motions/receipt';

// Controlled fixtures, never represented as naturally acquired gameplay.
function arena() {
  const w = createAlpha3(42); w.player.x = 6; w.enemies = []; w.alpha2!.monsters = [];
  w.alpha2!.doors = []; w.alpha2!.facilities = []; w.alpha2!.equipped = { head:null,chest:null,legs:null,mainHand:null,offHand:null,charm:null };
  w.explored[0] = Array.from({length:30},(_,i)=>i); return w;
}
function step(w:World,c:Command) { const r=acceptAlpha3(w,c); expect(r.accepted,c).toBe(true);if(!r.accepted)throw new Error(r.reason);return r.world; }
describe('Alpha 3 deterministic ground throw',()=>{
  it('queries only public cells with no mutation and animates the actual impact in four phases',()=>{
    const w=arena(),i=addItem2(w,'cinder','bag',w.player);
    spawnMonster2(w,'crawler',{floor:0,x:8});w.enemies[0]!.nextAt=100;
    const before=canonical(w), offers=queryThrowTargets3(w,i.id);
    expect(queryActionOffers3(w,i.id).find(a=>a.actionId==='throw')?.status).toBe('enabled');
    for(const offer of offers){expect(offer.command).toBeDefined();expect(acceptAlpha3(w,offer.command!).accepted).toBe(true);}
    expect(canonical(w)).toBe(before);
    const command=`a3:throw:${i.id}:0:11` as const,n=step(w,command),r=interactionReceipt(inspectAlpha3(w),inspectAlpha3(n),command)!;
    expect(r.target).toEqual({floor:0,x:8});expect(r.item?.definition).toBeUndefined();
    expect([0,.35,.6,.9].map(p=>motionStage(r.motion,p))).toEqual(['prepare','contact','effect','recover']);
    expect(canonical(w)).toBe(before);
  });
  it('all 45 definitions have one owner after empty-ground throws without effects or charge use',()=>{
    for(const d of ITEMS) {
      const w=arena(), i=addItem2(w,d.id,'bag',w.player), old=canonical(w), charges=i.charges;
      const n=step(w,`a3:throw:${i.id}:0:9`), next=n.alpha2!.items.find(a=>a.id===i.id)!;
      expect(canonical(w)).toBe(old);expect(next.owner).toBe(d.category==='potion'?'spent':'ground');
      expect(next.position).toEqual({floor:0,x:9});expect(next.charges).toBe(charges);
      expect(n.alpha2!.items.filter(a=>a.id===i.id)).toHaveLength(1);
      expect(n.tick).toBe(14);expect(n.revision).toBe(1);expect(n.rng).toBe(w.rng);
      expect(n.alpha2!.knowledge.identified).toEqual(w.alpha2!.knowledge.identified);
      expect(n.alpha3!.lastThrow).toMatchObject({itemId:i.id,landing:{floor:0,x:9},collision:{kind:'ground'}});
      expect(canonical(JSON.parse(JSON.stringify(n)))).toBe(canonical(n));
    }
  });
  it('rejects stale ownership, invalid syntax, equipped, sleep, fog, walls and range atomically',()=>{
    const w=arena(), i=addItem2(w,'cinder','bag',w.player);
    for(const command of [`a3:throw:${i.id}:0:6`,`a3:throw:${i.id}:1:9`,`a3:throw:${i.id}:0:12`,`a3:throw:${i.id}:0:0`,`a3:throw:99999:0:9`,`a3:throw:${i.id}:0:9:extra`]) {
      const before=canonical(w);expect(acceptAlpha3(w,command as Command).accepted).toBe(false);expect(canonical(w)).toBe(before);
    }
    for(const mutate of [(v:World)=>{v.alpha2!.equipped.mainHand=i.id;},(v:World)=>{v.explored[0]=[];},(v:World)=>{v.alpha2!.conditions.push({kind:'sleep',actor:0,until:45,nextAt:20,source:'fixture',power:0});},(v:World)=>{v.alpha2!.items.find(a=>a.id===i.id)!.owner='spent';}]) {
      const v=structuredClone(w);mutate(v);const before=canonical(v);expect(acceptAlpha3(v,`a3:throw:${i.id}:0:9`).accepted).toBe(false);expect(canonical(v)).toBe(before);
    }
  });
  it('stops at the first enemy with a physical wand impact without magic, charges or identification',()=>{
    const w=arena(),i=addItem2(w,'cinder','bag',w.player);i.charges=0;
    spawnMonster2(w,'crawler',{floor:0,x:8});spawnMonster2(w,'crawler',{floor:0,x:10});
    w.enemies.forEach(e=>{e.nextAt=100;e.hp=30;});const n=step(w,`a3:throw:${i.id}:0:11`);
    expect(n.enemies[0]!.hp).toBe(23);expect(n.enemies[1]!.hp).toBe(30);
    expect(n.alpha2!.conditions.filter(c=>c.kind==='burn')).toHaveLength(0);
    expect(n.alpha2!.items.find(a=>a.id===i.id)).toMatchObject({owner:'ground',position:{floor:0,x:8},charges:0});
    expect(n.alpha2!.knowledge.identified).not.toContain('cinder');
    expect(n.alpha3!.lastThrow!.collision).toEqual({kind:'enemy',id:w.enemies[0]!.id});
  });
  it('closed doors stop at the previous cell and conceal cells behind them',()=>{
    const w=arena(),i=addItem2(w,'sword','bag',w.player);
    w.alpha2!.doors.push({id:77,floor:0,x:8,open:false,locked:false});
    expect(acceptAlpha3(w,`a3:throw:${i.id}:0:9`).accepted).toBe(false);
    const n=step(w,`a3:throw:${i.id}:0:8`);expect(n.alpha3!.lastThrow).toMatchObject({landing:{floor:0,x:7},collision:{kind:'door',id:77}});
  });
  it('potions break on an inapplicable facility while unknown traps stay outside collisions',()=>{
    const w=arena(),i=addItem2(w,'renewal','bag',w.player);
    w.alpha2!.facilities.push({id:77,kind:'hazard',floor:0,x:9,used:false,revealed:true,gold:0,stock:[]});
    const n=step(w,`a3:throw:${i.id}:0:9`);expect(n.alpha2!.items.find(a=>a.id===i.id)!.owner).toBe('spent');
    expect(n.alpha2!.knowledge.identified).toEqual(w.alpha2!.knowledge.identified);expect(n.alpha3!.lastThrow!.collision).toEqual({kind:'facility',id:77});
    w.alpha2!.facilities[0]!.revealed=false;
    expect(step(w,`a3:throw:${i.id}:0:9`).alpha3!.lastThrow!.collision).toEqual({kind:'ground'});
  });
  it('slow costs exactly twice, receipts clear on the next successful command and public copies are isolated',()=>{
    const w=arena(),i=addItem2(w,'sword','bag',w.player);
    w.alpha2!.conditions.push({kind:'slow',actor:0,until:100,nextAt:20,source:'fixture',power:0});
    const n=step(w,`a3:throw:${i.id}:0:9`);expect(n.tick).toBe(28);
    const v=inspectAlpha3(n);v.alpha3!.lastThrow!.landing.x=28;expect(n.alpha3!.lastThrow!.landing.x).toBe(9);
    expect(step(n,'wait').alpha3!.lastThrow).toBeNull();
  });
  it('immune and ineffective potion impacts spend time and the bottle without revealing its identity',()=>{
    for(const [definition,monster] of [['venom','venomfang'],['acid','acidmaw'],['antidote','crawler'],['renewal','crawler']] as const){
      const w=arena(),i=addItem2(w,definition,'bag',w.player);w.alpha2!.knowledge.identified=w.alpha2!.knowledge.identified.filter(d=>d!==definition);
      spawnMonster2(w,monster,{floor:0,x:8});w.enemies[0]!.nextAt=100;
      const n=step(w,`a3:throw:${i.id}:0:8`);expect(n.alpha2!.knowledge.identified).not.toContain(definition);expect(n.alpha2!.items.find(a=>a.id===i.id)!.owner).toBe('spent');expect(n.tick).toBe(14);
    }
    const w=arena(),i=addItem2(w,'venom','bag',w.player);spawnMonster2(w,'crawler',{floor:0,x:8});w.enemies[0]!.nextAt=100;
    expect(step(w,`a3:throw:${i.id}:0:8`).alpha2!.knowledge.identified).toContain('venom');
  });
  it('new identity roundtrips a natural command route, each replay boundary, seek and continued save',()=>{
    const session=new GameSession(24681,'alpha3');expect(session.submit('choose:vanguard').accepted).toBe(true);
    const states=[session.view()];
    const source=session.view().alpha2!.bag.find(i=>!i.equipped)!;
    expect(source).toBeDefined();expect(session.submit(`a3:throw:${source.id}:0:3`).accepted).toBe(true);states.push(session.view());
    for(const command of ['wait','a2:search','wait'] as const){expect(session.submit(command).accepted).toBe(true);states.push(session.view());}
    const raw=session.capture(),loaded=GameSession.fromArchive(raw);expect(loaded.fingerprint()).toBe(session.fingerprint());
    for(let at=1;at<=states.length;at++)expect(loaded.replay(at)).toEqual(states[at-1]);
    expect(loaded.replay(2)).toEqual(states[1]);expect(loaded.replay(1)).toEqual(states[0]);
    expect(loaded.submit('wait')).toEqual(session.submit('wait'));expect(loaded.capture()).toBe(session.capture());
    expect(JSON.parse(raw).identity).toEqual(ALPHA3_IDENTITY);expect(ALPHA3_IDENTITY).not.toEqual(ALPHA2_IDENTITY);
    const old=new GameSession(24681,'alpha2'),fingerprint=old.fingerprint();expect(()=>old.restore(raw)).toThrow('incompatible');expect(old.fingerprint()).toBe(fingerprint);
    for(const scenario of ['mine','room','dungeon','expedition','alpha','alpha2'] as const){expect(isCommand('a3:throw:1:0:3',scenario)).toBe(false);expect(accept(createWorld(42,scenario),'a3:throw:1:0:3').accepted).toBe(false);}
    expect(isAlpha3Command('a3:throw:01:0:3')).toBe(false);
  });
});
