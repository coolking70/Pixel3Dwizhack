import { expect, it } from 'vitest';
import { runGame4, replayTrace4, captureTrace4 } from '../src/balance4/runner';
import { GameSession, ALPHA4_IDENTITY, ALPHA3_IDENTITY } from '../src/session/session';
import { LOADOUTS, STRATEGIES } from '../src/balance/types';
import { resourceStart4, resourceStep4 } from '../src/balance4/resources';
const config={seed:1,loadout:'vanguard' as const,strategy:'survivor' as const,maxActions:12,maxTicks:30000,stuckLimit:96};
it('same public policy in both identities double-runs and exactly replays all nine configurations',()=>{
  for(const scenario of ['alpha3','alpha4'] as const)for(const loadout of LOADOUTS)for(const strategy of STRATEGIES){
    const run=runGame4({...config,scenario,loadout,strategy});expect(run).toEqual(runGame4({...config,scenario,loadout,strategy}));expect(run.identity).toEqual(scenario==='alpha3'?ALPHA3_IDENTITY:ALPHA4_IDENTITY);expect(replayTrace4(run)).toBe(run.finalDigest);
    expect(GameSession.fromArchive(captureTrace4(run)).fingerprint()).toBe(run.finalDigest);
  }
});
it('resource metadata and terminal outcome tampering cannot pass replay receipts',()=>{
  const run=runGame4(config),r=structuredClone(run);r.resources.picked++;expect(()=>replayTrace4(r)).toThrow('Resource summary');
  const outcome=structuredClone(run);outcome.outcome='won';expect(()=>replayTrace4(outcome)).toThrow('Terminal outcome');
});
it('resource observations do not count non-healing self drinks as healing supplies',()=>{
  const s=new GameSession(1,'alpha4'),b=s.view(),a=structuredClone(b),r=resourceStart4(b);
  const item=b.alpha2!.bag.find(i=>i.definition==='renewal')!;item.definition='antidote';
  resourceStep4(r,b,a,`a2:use:${item.id}:drink:self`);expect(r.healingDrinks).toBe(0);
  item.definition='renewal';a.player.hp=b.player.hp+8;resourceStep4(r,b,a,`a2:use:${item.id}:drink:self`);expect(r.healingDrinks).toBe(1);expect(r.healingNet).toBe(8);
});
