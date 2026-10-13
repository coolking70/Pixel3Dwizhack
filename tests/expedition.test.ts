import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameSession } from '../src/session/session';
import { accept, createWorld, inspect } from '../src/core/simulation';
import { runExpedition } from './expedition-route';
import type { Command, World } from '../src/core/types';
import { EnemyActor } from '../src/room/enemy-actor';
import { parseRig } from '../src/character-lab/assets';
import { CONTACT, strikeAt } from '../src/room/combat-timeline';

describe('M03–M05 expedition contracts', () => {
  it('retains dungeon-1 seed history and exact serialized snapshot', () => {
    const raw = readFileSync('tests/fixtures/dungeon-v1.json', 'utf8'); expect(GameSession.fromArchive(raw).capture()).toBe(raw);
  });
  it('generates deterministic, connected bounded maps with mandatory resources across 100 seeds', () => {
    const maps = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const w = createWorld(seed, 'expedition'), m = w.expedition!.map;
      expect(createWorld(seed, 'expedition')).toEqual(w); expect(m.ladders).toHaveLength(5);
      expect(m.ladders.every(x => x > 1 && x < m.width-2)).toBe(true);
      expect(w.enemies.some(e => e.floor === 0 && Math.abs(e.x-w.player.x)<4)).toBe(false);
      expect(w.enemies.filter(e => e.elite)).toHaveLength(1);
      expect(w.expedition!.items.filter(i => i.effect === 'healing').length).toBeGreaterThanOrEqual(8);
      const reachable = new Set(['0/2']), queue = [{floor:0,x:2}];
      while (queue.length) { const p = queue.shift()!; const next = [{...p,x:p.x-1},{...p,x:p.x+1}]; if(m.ladders[p.floor]===p.x)next.push({...p,floor:p.floor+1});if(m.ladders[p.floor-1]===p.x)next.push({...p,floor:p.floor-1});
        for(const n of next) { const key=`${n.floor}/${n.x}`;if(n.floor>=0&&n.floor<m.floors&&n.x>=1&&n.x<m.width-1&&!reachable.has(key)){reachable.add(key);queue.push(n);} }
      }
      expect(reachable.size).toBe((m.width-2)*m.floors); maps.add(JSON.stringify(m));
    }
    expect(maps.size).toBeGreaterThan(90);
  });
  it('finishes main and optional routes on varied seeds using only public commands', () => {
    for (const seed of [1, 42, 24681, 0xffffffff]) for (const branch of [false,true]) {
      const {session} = runExpedition(seed,branch); expect(session.view().status).toBe('won'); expect(session.view().expedition!.bossDefeated).toBe(true);
    }
  });
  it('keeps the mandatory route naturally completable for the 100-seed generation corpus', { timeout: 30000 }, () => {
    for (let seed = 1; seed <= 100; seed++) expect(runExpedition(seed).session.view().status, `seed ${seed}`).toBe('won');
  });
  it('has identical warm/cold reverse seeks and discards checkpoints when a different run is restored', () => {
    const route = runExpedition(1), warm = route.session;
    for (const position of [warm.length, 64, 32, 0, 95, warm.length - 1]) {
      expect(warm.replay(position)).toEqual(GameSession.fromArchive(warm.capture()).replay(position));
    }
    const other = new GameSession(42, 'expedition'); other.submit('right'); warm.restore(other.capture());
    expect(warm.replay(1)).toEqual(other.view()); expect(warm.replay(0)).toEqual(other.replay(0));
  });
  it('consumes shrines once and antidotes remove poison before the paid time advances (controlled state)', () => {
    const w = createWorld(7, 'expedition'); w.enemies = []; w.player.hp = 8;
    const shrine = w.expedition!.map.shrines[0]!; w.player.floor = shrine.floor; w.player.x = shrine.x;
    w.expedition!.effects = [{ kind: 'poison', nextAt: 5, until: 80 }];
    const result = accept(w, 'shrine'); if (!result.accepted) throw new Error('shrine');
    expect(result.world.player.hp).toBe(64); expect(result.world.expedition!.effects).toEqual([]); expect(result.world.tick).toBe(12);
    expect(accept(result.world, 'shrine').accepted).toBe(false); expect(shrine.used).toBe(false);
    const antidote = w.expedition!.items.find(i => i.effect === 'antidote')!; antidote.owner = 'bag';
    const cured = accept(w, `use:${antidote.id}`); if (!cured.accepted) throw new Error('antidote');
    expect(cured.world.player.hp).toBe(8); expect(cured.world.expedition!.effects).toEqual([]);
    expect(cured.world.expedition!.identified).toContain('antidote'); expect(accept(cured.world, `use:${antidote.id}`).accepted).toBe(false);
  });
  it('sequences exact strike actors and targets with a single shared contact point', () => {
    const beats = [{ kind: 'attack' as const, actor: 0, target: 2, position: { x: 2, floor: 0 }, tick: 0 }, { kind: 'hurt' as const, actor: 2, target: 0, position: { x: 2, floor: 0 }, tick: 8 }, { kind: 'attack' as const, actor: 2, target: 0, position: { x: 3, floor: 0 }, tick: 8 }];
    expect(strikeAt(beats, CONTACT / 2)).toEqual({ beat: beats[0], phase: CONTACT });
    expect(strikeAt(beats, .75)).toEqual({ beat: beats[2], phase: .5 });
    expect(strikeAt(beats, 1)).toBeNull(); expect(strikeAt([], .5)).toBeNull();
  });
  it('restores and replays every boundary, including item ownership and active status effects', { timeout: 60000 }, () => {
    const {session,commands,states} = runExpedition(42,true);
    states.forEach((v,i)=>expect(session.replay(i)).toEqual(v));
    for(const cut of [0,20,60,120,states.findIndex(v=>v.player.relic)]) {
      const part=new GameSession(42,'expedition');commands.slice(0,cut).forEach(c=>part.submit(c));
      const restored=GameSession.fromArchive(part.capture());commands.slice(cut).forEach(c=>restored.submit(c));expect(restored.capture()).toBe(session.capture());
    }
    const live=new GameSession(7,'expedition'), before=live.capture(); const forged=JSON.parse(before);forged.world.expedition.items[0].owner='spent';
    expect(()=>live.restore(JSON.stringify(forged))).toThrow();expect(()=>live.restore(new GameSession(7,'dungeon').capture())).toThrow();expect(live.capture()).toBe(before);
  });
  it('filters unidentified potion effects, preserves projection isolation, and identifies by consuming exactly one scroll', () => {
    const w=createWorld(7,'expedition'), potion=w.expedition!.items.find(i=>i.effect==='might'||i.effect==='ward')!;potion.owner='bag';
    const unknown=inspect(w).expedition!.bag.find(i=>i.id===potion.id)!;expect(unknown.effect).toBeUndefined();expect(JSON.stringify(unknown)).not.toContain(potion.effect!);
    const result=accept(w,`identify:${potion.id}`);if(!result.accepted)throw new Error('identify');
    expect(inspect(result.world).expedition!.bag.find(i=>i.id===potion.id)!.effect).toBe(potion.effect);
    expect(result.world.expedition!.items.filter(i=>i.kind==='scroll'&&i.owner==='spent')).toHaveLength(1);
    expect(accept(result.world,`identify:${potion.id}`).accepted).toBe(false);
    const v=inspect(w);v.expedition!.bag.length=0;expect(inspect(w).expedition!.bag.length).toBeGreaterThan(0);
  });
  it('rejects repeated ownership transfers, full bags and equipped drops atomically', () => {
    const w=createWorld(7,'expedition'), s=new GameSession(7,'expedition'), before=s.capture();
    for(const c of ['drop:1','wear:1','take:9999','use:1','identify:1','wear:0','wear:01','use:NaN','potion'])expect(s.submit(c as Command).accepted).toBe(false);
    expect(s.capture()).toBe(before);
    const floorItem=w.expedition!.items.find(i=>i.owner==='ground')!;floorItem.position={floor:0,x:2};
    const pickup=accept(w,`take:${floorItem.id}`);if(!pickup.accepted)throw new Error('take');expect(accept(pickup.world,`take:${floorItem.id}`).accepted).toBe(false);
    const full=createWorld(7,'expedition');for(const i of full.expedition!.items.slice(8,16))i.owner='bag';const target=full.expedition!.items[16]!;target.position={floor:0,x:2};
    expect(accept(full,`take:${target.id}`)).toEqual({accepted:false,reason:'bagFull'});
  });
  it('orders poison and buff expiry deterministically and never advances on inspection (controlled state)', () => {
    let w=createWorld(7,'expedition');w.enemies=[];w.expedition!.effects=[{kind:'poison',until:40,nextAt:20},{kind:'ward',until:20,nextAt:20}];
    const step=(current:World,c:Command):World=>{const r=accept(current,c);if(!r.accepted)throw new Error('step');return r.world;};
    const raw=JSON.stringify(w);for(let i=0;i<50;i++)inspect(w);expect(JSON.stringify(w)).toBe(raw);
    w=step(step(w,'wait'),'wait');expect(w.player.hp).toBe(62);expect(w.expedition!.effects.map(e=>e.kind)).toEqual(['poison']);
    w=step(step(w,'wait'),'wait');expect(w.player.hp).toBe(62);expect(w.expedition!.effects).toEqual([]);
  });
  it('includes exact attack participants and does not expose hidden enemy activity', () => {
    const w=createWorld(1,'expedition');w.enemies[0]!.x=3;const r=accept(w,'attack');if(!r.accepted)throw new Error('attack');
    expect(r.world.beats).toContainEqual(expect.objectContaining({kind:'attack',actor:0,target:w.enemies[0]!.id}));
    expect(inspect(r.world).beats!.every(b=>b.position.floor===0)).toBe(true);
  });
  it('samples independent joint poses without replacing enemy geometry and releases retained actors', () => {
    const rig=parseRig(JSON.parse(readFileSync('public/assets/character-study/motions.json','utf8')));
    for(const kind of ['crawler','guard'] as const) {
      const a=new EnemyActor(kind,rig);const children=a.root.children.length;let disposed=0;
      a.root.traverse(o=>{if('geometry' in o)(o.geometry as import('three').BufferGeometry).addEventListener('dispose',()=>disposed++);});
      for(const pose of ['idle','walk','windup','attack','hurt','death'] as const)for(const p of [0,.25,.5,1])a.sample(pose,p,-1,.7);
      expect(a.root.children.length).toBe(children);expect(a.root.userData.pose).toBe('death');a.dispose();expect(disposed).toBeGreaterThan(0);
    }
  });
});
