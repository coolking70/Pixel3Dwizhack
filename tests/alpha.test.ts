import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runAlpha,GameSession} from './alpha-route';
import {createWorld,accept,inspect} from '../src/core/simulation';
import {ALPHA,ALPHA_GEAR} from '../src/content/alpha';
import type {World,Command,Enemy} from '../src/core/types';
import type {Loadout} from '../src/core/alpha-types';
const step=(w:World,c:Command):World=>{const r=accept(w,c);if(!r.accepted)throw new Error(`${c}: ${r.reason}`);return r.world;};
const isolated=()=>{const w=createWorld(42,'alpha');w.enemies=[];return w;};
const enemy=(kind:Enemy['kind'],x:number,nextAt=10):Enemy=>({id:1,x,floor:0,kind,hp:70,maxHp:70,damage:12,armor:5,period:30,nextAt});
it('completes three distinct starting weapon routes across 60 seeds using only public commands',{timeout:60000},()=>{
 for(let seed=1;seed<=60;seed++)for(const loadout of ['vanguard','breaker','channeler'] as Loadout[]){const r=runAlpha(seed,loadout);expect(r.session.view().status,`${seed}/${loadout}`).toBe('won');expect(r.session.view().player.equipment!.mainHand).toBe(ALPHA.loadouts[loadout].mainHand);}
});
it('completes branch routes with actual doors, levers and cache choices',{timeout:60000},()=>{
 for(const seed of [1,7,42,101])for(const loadout of ['vanguard','breaker','channeler'] as Loadout[]){const r=runAlpha(seed,loadout,true);expect(r.session.view().status).toBe('won');expect(r.commands.some(c=>c.startsWith('cache:'))).toBe(true);expect(r.commands.some(c=>c.startsWith('lever:'))).toBe(true);}
});
it('keeps all old golden identities restorable and rejects cross-scenario replacement',()=>{
 const shipped=readFileSync('tests/fixtures/alpha-v1.json','utf8').trim();expect(GameSession.fromArchive(shipped).capture()).toBe(shipped);
 const alpha=new GameSession(42,'alpha'),before=alpha.capture();
 for(const name of ['mine','room','dungeon','expedition']){const raw=readFileSync(`tests/fixtures/${name}-v1.json`,'utf8').trim();expect(GameSession.fromArchive(raw).capture()).toBe(raw);expect(()=>alpha.restore(raw)).toThrow();}
 expect(alpha.capture()).toBe(before);
});
it('replays every branch boundary, restores active mana/intent/door state and continues identically',{timeout:60000},()=>{
 const {session,commands,states}=runAlpha(42,'channeler',true);
 states.forEach((view,index)=>expect(session.replay(index)).toEqual(view));
 for(const cut of [1,30,70,160]){const part=new GameSession(42,'alpha');commands.slice(0,cut).forEach(c=>part.submit(c));const restored=GameSession.fromArchive(part.capture());commands.slice(cut).forEach(c=>restored.submit(c));expect(restored.capture()).toBe(session.capture());}
 const forged=JSON.parse(session.capture());forged.world.alpha.mana=999;expect(()=>GameSession.fromArchive(JSON.stringify(forged))).toThrow();
});
it('defines meaningful time, armor penetration and finite spell resources (controlled combat)',()=>{
 const outcomes=[];
 for(const loadout of ['vanguard','breaker','channeler'] as Loadout[]){let w=step(isolated(),`choose:${loadout}`);w.enemies=[enemy('guard',3,1000)];w=step(w,loadout==='channeler'?'cast':'attack');outcomes.push(w);}
 expect(outcomes.map(w=>w.tick)).toEqual([10,20,18]);
 expect(outcomes[1]!.enemies[0]!.hp).toBeLessThan(outcomes[0]!.enemies[0]!.hp);
 expect(outcomes[2]!.alpha!.mana).toBe(9);expect(outcomes[2]!.enemies[0]!.hp).toBeLessThan(outcomes[0]!.enemies[0]!.hp);
 const w=outcomes[2]!;w.alpha!.mana=0;const raw=JSON.stringify(w);expect(accept(w,'cast').accepted).toBe(false);expect(JSON.stringify(w)).toBe(raw);
 const regened=step(w,'wait');expect(regened.alpha!.mana).toBe(1);expect(regened.tick).toBe(28);
});
it('locks hexer targets and allows a sidestep or door to defeat a queued spell (controlled)',()=>{
 let w=isolated();w.enemies=[enemy('hexer',6)];w=step(w,'wait');expect(w.enemies[0]!.intent).toEqual({x:2,floor:0});const hp=w.player.hp;
 w=step(w,'right');w=step(step(w,'wait'),'wait');expect(w.tick).toBe(40);expect(w.player.hp).toBe(hp);expect(w.beats!.some(b=>b.kind==='miss')).toBe(true);
 w=isolated();w.player={...w.player,x:11,floor:1};w.alpha!.doors[0] = {id:1,x:12,floor:1,open:true,locked:false};w.enemies=[{...enemy('hexer',15,8),floor:1,intent:{x:11,floor:1}}];
 const closed=step(w,'door:1');expect(closed.player.hp).toBe(w.player.hp);expect(closed.enemies[0]!.intent).toBeUndefined();
});
it('makes skirmishers strike and retreat only into a legal empty tile (controlled)',()=>{
 const w=isolated();w.enemies=[enemy('skirmisher',3)];const result=step(w,'wait');expect(result.player.hp).toBeLessThan(w.player.hp);expect(result.enemies[0]!.x).toBe(4);
 w.enemies.push({...enemy('crawler',4,100),id:2});expect(step(w,'wait').enemies[0]!.x).toBe(3);
});
it('makes doors real sight/traversal barriers and lever activation a persisted one-time action (controlled)',()=>{
 let w=isolated();w.player={...w.player,x:11,floor:1};const door=w.alpha!.doors[0]!;door.locked=true;w.enemies=[{...enemy('hexer',15,100),floor:1}];
 expect(accept(w,'right').accepted).toBe(false);expect(accept(w,'door:1').accepted).toBe(false);expect(inspect(w).enemies).toEqual([]);
 const lever=w.alpha!.levers[0]!;w.player.x=lever.x;w=step(w,`lever:${lever.id}`);expect(w.alpha!.doors[0]!.open).toBe(true);expect(accept(w,`lever:${lever.id}`).accepted).toBe(false);
 w.player.x=11;expect(step(w,'right').player.x).toBe(12);
});
it('pays for caches atomically and grounds distinct rewards even when the bag is full (controlled)',()=>{
 const w=isolated(),cache=w.alpha!.caches[0]!;w.player={...w.player,x:cache.x,floor:cache.floor,gold:0};
 const original=JSON.stringify(w);expect(accept(w,`cache:${cache.id}:pay`).accepted).toBe(false);expect(JSON.stringify(w)).toBe(original);
 for(const i of w.expedition!.items.filter(i=>i.owner==='ground').slice(0,8))i.owner='bag';
 const after=step(w,`cache:${cache.id}:force`);expect(after.player.hp).toBe(w.player.hp-ALPHA.cacheHp);expect(after.alpha!.caches[0]!.used).toBe(true);
 for(const id of cache.rewards)expect(after.expedition!.items.find(i=>i.id===id)!.owner).toBe('ground');
 expect(accept(after,`cache:${cache.id}:force`).accepted).toBe(false);expect(JSON.stringify(inspect(after).alpha)).not.toContain('rewards');
});
it('changes route placement and risk/resource distribution by seed while retaining connected continuous floors',()=>{
 const signatures=new Set<string>();
 for(let seed=1;seed<=60;seed++){
  const w=createWorld(seed,'alpha');signatures.add(JSON.stringify([w.alpha!.links,w.alpha!.doors,w.alpha!.caches]));
  for(let floor=0;floor<5;floor++){const links=w.alpha!.links.filter(l=>l.floor===floor);expect(links).toHaveLength(2);expect(links[0]!.x).toBeLessThan(12);expect(links[1]!.x).toBeGreaterThan(12);}
  expect(w.enemies.some(e=>e.floor===0&&Math.abs(e.x-w.player.x)<4)).toBe(false);
  expect(Object.keys(ALPHA_GEAR)).toContain('wand');
 }
 expect(signatures.size).toBe(60);
});
it('never lets rejected build changes, inspection or replay mutate the live candidate',()=>{
 const s=new GameSession(42,'alpha');s.submit('choose:breaker');const before=s.capture();
 for(const c of ['choose:vanguard','cache:01:pay','door:9999','cast'] as Command[])expect(s.submit(c).accepted).toBe(false);
 const view=s.view();view.alpha!.doors.length=0;view.expedition!.bag.length=0;s.replay(0);expect(s.capture()).toBe(before);
});
