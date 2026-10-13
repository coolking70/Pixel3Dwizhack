import { expect, it } from 'vitest';
import { adaptCommand3, captureTrace3, PROBE3_VERSION, replayTrace3, runGame3 } from '../src/balance3/runner';
import { ALPHA3_IDENTITY, GameSession } from '../src/session/session';
import { LOADOUTS, STRATEGIES, type RunConfig } from '../src/balance/types';
import type { Command } from '../src/core/types';

const config:RunConfig = { seed:1,loadout:'vanguard',strategy:'survivor',maxActions:10,maxTicks:30000,stuckLimit:96 };
it('adapts only public positions, never reveals missing targets, and leaves nonthrows unchanged',()=>{
  // Controlled public projection: no hidden world or engine state is changed.
  const session = new GameSession(1,'alpha3');session.submit('choose:vanguard');
  const view=session.view(),item=view.alpha2!.bag.find(item=>item.category==='potion')!;
  view.enemies=[{...view.enemies[0]!,id:991,floor:0,x:7,hp:3}];
  expect(adaptCommand3(`a2:use:${item.id}:throw:e991`,view)).toBe(`a3:throw:${item.id}:0:7`);
  expect(adaptCommand3(`a2:use:${item.id}:throw:e992`,view)).toBeNull();
  expect(adaptCommand3('a2:use:99999:throw:e991',view)).toBeNull();
  expect(adaptCommand3(`a2:use:${item.id}:drink:self`,view)).toBe(`a2:use:${item.id}:drink:self`);
  const facility=view.alpha2!.facilities[0];if(facility)expect(adaptCommand3(`a2:use:${item.id}:throw:f${facility.id}`,view)).toBe(`a3:throw:${item.id}:${facility.floor}:${facility.x}`);
  expect(session.view().enemies.some(enemy=>enemy.id===991)).toBe(false);
});

it('all nine configurations double-run identically and replay every accepted and rejected attempt',()=>{
  for(const loadout of LOADOUTS)for(const strategy of STRATEGIES){
    const run=runGame3({...config,loadout,strategy});
    expect(run).toEqual(runGame3({...config,loadout,strategy}));
    expect(run.identity).toEqual(ALPHA3_IDENTITY);expect(run.actions).toBe(10);expect(run.outcome).toBe('action-limit');
    expect(replayTrace3(run)).toBe(run.finalDigest);
    const archive=captureTrace3(run),restored=GameSession.fromArchive(archive);
    expect(restored.fingerprint()).toBe(run.finalDigest);expect(JSON.parse(archive).identity).toEqual(ALPHA3_IDENTITY);
  }
});

it('records refusals without changes, feeds original rejected proposals back, and stops repeated failure',()=>{
  const observations:string[]=[];
  const run=runGame3(config,()=>({next(view,rejected){expect(Object.isFrozen(view)).toBe(true);expect(Object.isFrozen(view.player)).toBe(true);observations.push(JSON.stringify(rejected));return 'wear:99999';}}));
  expect(run.outcome).toBe('agent-stuck');expect(run.actions).toBe(0);expect(run.rejected).toBe(2);expect(run.ticks).toBe(0);
  expect(observations).toEqual(['[]','["wear:99999"]']);expect(run.trace[0]!.digest).toBe(run.trace[1]!.digest);expect(replayTrace3(run)).toBe(run.finalDigest);
});

it('a natural new-game self throw is adapted and formally rejected without advancing time',()=>{
  let stage=0;
  const run=runGame3({...config,maxActions:3},()=>({next(view,rejected){
    if(stage++===0)return 'choose:vanguard';
    const item=view.alpha2!.bag.find(item=>item.category==='potion')!;
    const proposed:Command=`a2:use:${item.id}:throw:self`;
    if(!rejected.length)return proposed;
    expect(rejected).toContain(proposed);return null;
  }}));
  // Self-cell is intentionally invalid: this validates conversion and real rejection,
  // not an invented successful throw or a controlled mechanical fixture.
  expect(run.adaptedThrows).toBe(1);expect(run.trace[1]!.command.startsWith('a3:throw:')).toBe(true);
  expect(run.trace[1]!.accepted).toBe(false);expect(run.outcome).toBe('agent-unsolved');expect(replayTrace3(run)).toBe(run.finalDigest);
});

it('enforces attempt/tick budgets and rejects bad configuration and altered traces',()=>{
  let n=9000;const limited=runGame3({...config,maxActions:2},()=>({next:()=>`wear:${n++}`}));
  expect(limited.attempts).toBe(6);expect(limited.actions).toBe(0);expect(limited.outcome).toBe('agent-stuck');
  const ticks=runGame3({...config,maxTicks:1},()=>({next:view=>view.revision===0?'choose:vanguard':'wait'}));expect(ticks.outcome).toBe('tick-limit');
  expect(()=>runGame3({...config,maxActions:0})).toThrow();expect(()=>runGame3({...config,seed:0})).toThrow();
  const run=runGame3(config),bad=structuredClone(run);bad.trace[0]!.digest='wrong';expect(()=>replayTrace3(bad)).toThrow('attempt 1');
  const wrongIdentity=structuredClone(run);Object.assign(wrongIdentity.identity,{rules:'alpha2-1'});expect(()=>replayTrace3(wrongIdentity)).toThrow('identity');
  const wrongCommand=structuredClone(run);wrongCommand.trace[0]!.command='wait';expect(()=>replayTrace3(wrongCommand)).toThrow('adapter');
});

it('separately identified exploratory policy throws a naturally owned food at a visible enemy once',()=>{
  const run=runGame3({...config,maxActions:40,probe:true});
  expect(run.agentVersion).toBe(PROBE3_VERSION);expect(run.adaptedThrows).toBe(1);
  const thrown=run.trace.find(entry=>entry.command.startsWith('a3:throw:'))!;expect(thrown.accepted).toBe(true);
  expect(run).toEqual(runGame3({...config,maxActions:40,probe:true}));expect(replayTrace3(run)).toBe(run.finalDigest);
  const archive=JSON.parse(captureTrace3(run));expect(archive.identity).toEqual(ALPHA3_IDENTITY);
});

it('refuses forged terminal outcomes, throw counts, and public summaries',()=>{
  const run=runGame3(config);
  for(const outcome of ['won','dead'] as const){const bad=structuredClone(run);bad.outcome=outcome;expect(()=>replayTrace3(bad)).toThrow('Terminal outcome');}
  const budget=structuredClone(run);budget.outcome='tick-limit';expect(()=>replayTrace3(budget)).toThrow('Budget outcome');
  for(const field of ['adaptedThrows','finalHp','minHp','minFood','maxDepth','kills'] as const){const bad=structuredClone(run);bad[field]++;expect(()=>replayTrace3(bad)).toThrow('Public summary');}
});
