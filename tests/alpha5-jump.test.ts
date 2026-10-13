import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { acceptAlpha5, createAlpha5, inspectAlpha5, isAlpha5Command } from '../src/core/alpha5';
import { addCondition2 } from '../src/core/alpha2-shared';
import { addItem2, spawnMonster2 } from '../src/core/alpha2-map';
import { canonical } from '../src/core/digest';
import { GameSession, ALPHA5_IDENTITY } from '../src/session/session';
import type { Command, World } from '../src/core/types';

// Explicit controlled world fixtures. Natural session and browser routes are separate.
function fixture() {
  const w = createAlpha5(1); w.player.x = 5;
  w.enemies = []; w.alpha2!.monsters = []; w.alpha2!.doors = []; w.alpha2!.facilities = [];
  w.explored[0] = Array.from({length:30},(_,x)=>x); return w;
}
function step(w: World, c: Command) { const r=acceptAlpha5(w,c); expect(r.accepted,c).toBe(true); if(!r.accepted)throw Error(r.reason); return r.world; }
function rejects(w: World, c: string) { const before=canonical(w);expect(acceptAlpha5(w,c as Command).accepted).toBe(false);expect(canonical(w)).toBe(before); }
function trap(w:World,x:number,kind:'trap'|'hazard'='trap') { w.alpha2!.facilities.push({id:1,kind,floor:0,x,used:false,revealed:false,stock:[],gold:0}); }
describe('Alpha5 atomic jump',()=>{
  it('one and two cells cost16/22 once, preserve input and leave an exact receipt',()=>{
    const w=fixture(),before=canonical(w);
    for(const [x,cost] of [[4,16],[6,16],[3,22],[7,22]] as const) {
      const n=step(w,`a5:jump:${x}`);expect(n.tick).toBe(cost);expect(n.revision).toBe(1);expect(n.player.x).toBe(x);
      expect(n.alpha5!.lastJump).toEqual({revision:1,from:{x:5,floor:0},to:{x,floor:0},cost});expect(n.rng).toBe(w.rng);
    }
    expect(canonical(w)).toBe(before);
  });
  it('strict parser rejects zero, negative, fraction, cross-floor, trailing input and range',()=>{
    const w=fixture();for(const c of ['a5:jump:0','a5:jump:-1','a5:jump:5.2','a5:jump:0:7','a5:jump:7x','a5:jump:07','a5:jump:29']){expect(isAlpha5Command(c)).toBe(false);rejects(w,c);}
    for(const c of ['a5:jump:5','a5:jump:8','a5:jump:1'])rejects(w,c);
  });
  it('unseen landing and blind out-of-sight landing reject',()=>{
    const w=fixture();w.explored[0]=[5,6];rejects(w,'a5:jump:7');w.explored[0].push(7);addCondition2(w,'blind',0,80,0,'test');rejects(w,'a5:jump:7');expect(step(w,'a5:jump:6').player.x).toBe(6);
  });
  it('intermediate and landing closed or locked doors reject; open doors allow',()=>{
    for(const x of [6,7])for(const locked of [false,true]) {const w=fixture();w.alpha2!.doors=[{id:1,x,floor:0,open:false,locked}];rejects(w,'a5:jump:7');w.alpha2!.doors[0]!.open=true;expect(step(w,'a5:jump:7').player.x).toBe(7);}
  });
  it('intermediate and landing living actors reject, dead actors do not',()=>{
    for(const x of [6,7]){const w=fixture();spawnMonster2(w,'crawler',{floor:0,x});rejects(w,'a5:jump:7');w.enemies[0]!.hp=0;expect(step(w,'a5:jump:7').player.x).toBe(7);}
  });
  it('sleep/confused reject without RNG draws and slow doubles the fixed cost',()=>{
    for(const kind of ['sleep','confused'] as const){const w=fixture();addCondition2(w,kind,0,80,0,'test');rejects(w,'a5:jump:7');expect(inspectAlpha5(w).alpha5!.jumpTargets.every(t=>t.reason==='state')).toBe(true);}
    const w=fixture();addCondition2(w,'slow',0,80,0,'test');expect(step(w,'a5:jump:7').tick).toBe(44);
  });
  it('burden rejects using all carried weight including worn equipment',()=>{
    const w=fixture();while(inspectAlpha5(w).alpha2!.weight<=40)addItem2(w,'plate','bag',w.player,null,true);rejects(w,'a5:jump:7');expect(inspectAlpha5(w).alpha5!.jumpTargets.every(t=>t.reason==='burden')).toBe(true);
  });
  it('intermediate trap remains untouched, landing trap triggers exactly once',()=>{
    const w=fixture();trap(w,6);const n=step(w,'a5:jump:7');expect(n.player.hp).toBe(w.player.hp);expect(n.alpha2!.facilities[0]!.used).toBe(false);
    const landed=step(w,'a5:jump:6');expect(landed.player.hp).toBeLessThan(w.player.hp);expect(landed.alpha2!.facilities[0]!.used).toBe(true);expect(landed.tick).toBe(16);
  });
  it('intermediate fire does not burn and ordinary walking still contacts traps',()=>{
    const w=fixture();trap(w,6,'hazard');expect(step(w,'a5:jump:7').alpha2!.conditions).toHaveLength(0);expect(step(w,'a5:jump:6').alpha2!.conditions.some(c=>c.kind==='burn')).toBe(true);
    w.alpha2!.facilities[0]!.kind='trap';expect(step(w,'right').alpha2!.facilities[0]!.used).toBe(true);
  });
  it('enemies receive full time at the occupied destination and cannot occupy it',()=>{
    const w=fixture();spawnMonster2(w,'crawler',{floor:0,x:8});w.enemies[0]!.nextAt=10;const n=step(w,'a5:jump:7');expect(n.enemies[0]!.nextAt).toBeGreaterThan(22);expect(n.player.hp).toBeLessThan(w.player.hp);expect(n.enemies[0]!.x).not.toBe(n.player.x);
  });
  it('hidden trap presence does not change public jump offers',()=>{
    const w=fixture(),before=inspectAlpha5(w).alpha5!.jumpTargets;trap(w,7);expect(inspectAlpha5(w).alpha5!.jumpTargets).toEqual(before);
    const snapshot=canonical(w);for(let i=0;i<5;i++)inspectAlpha5(w);expect(canonical(w)).toBe(snapshot);
  });
  it('ordinary accepted commands clear the receipt; refusal keeps it',()=>{
    const n=step(fixture(),'a5:jump:7');rejects(n,'a5:jump:28');expect(n.alpha5!.lastJump).not.toBeNull();expect(step(n,'wait').alpha5!.lastJump).toBeNull();
  });
  it('end states reject; jumping to exit with relic wins through the same boundary',()=>{
    for(const status of ['won','dead'] as const){const w=fixture();w.status=status;rejects(w,'a5:jump:7');}
    const w=fixture();w.player.x=2;w.player.relic=true;expect(step(w,'a5:jump:1').status).toBe('won');
  });
  it('natural formal session roundtrips/seek/branch exactly, queries cost nothing',()=>{
    const s=new GameSession(1,'alpha5'),views=[s.view()];expect(s.submit('choose:vanguard').accepted).toBe(true);views.push(s.view());
    for(let i=0;i<4;i++){const before=s.capture(),t=s.queryJumpTargets().find(t=>t.status==='enabled')!;expect(s.capture()).toBe(before);expect(s.submit(t.command).accepted).toBe(true);views.push(s.view());}
    const raw=s.capture(),loaded=GameSession.fromArchive(raw);expect(JSON.parse(raw).identity).toEqual(ALPHA5_IDENTITY);expect(loaded.capture()).toBe(raw);
    for(let i=views.length-1;i>=0;i--)expect(loaded.replay(i)).toEqual(views[i]);
    expect(loaded.submit('wait')).toEqual(s.submit('wait'));expect(loaded.capture()).toBe(s.capture());
  });
  it('eight historical golden archives restore byte-for-byte after shared dispatch change',()=>{
    for(const name of ['mine','room','dungeon','expedition','alpha','alpha2','alpha3','alpha4']){
      const raw=readFileSync(new URL(`./fixtures/${name}-v1.json`,import.meta.url),'utf8').trim();
      const s=GameSession.fromArchive(raw);expect(s.capture(),name).toBe(raw);const before=s.capture();expect(s.submit('a5:jump:3').accepted).toBe(false);expect(s.capture()).toBe(before);
    }
  });
});
