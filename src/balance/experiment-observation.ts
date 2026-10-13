import {GameSession} from '../session/session';
import type {RunResult} from './types';

const harmful = new Set(['poison','sleep','blind','confused','slow','burn']);
export function harmfulChange(beforeHp:number,afterHp:number,before:readonly {kind:string}[],after:readonly {kind:string}[]):boolean {
  return afterHp<beforeHp||after.some(c=>harmful.has(c.kind)&&!before.some(old=>old.kind===c.kind));
}
/** Rebuild the already-recorded natural trace via submit. This observation
 * layer is never passed to an agent and never reads capture/internal worlds. */
export function observeExperiment(result:RunResult) {
  const session=new GameSession(result.config.seed,'alpha2');let unknownTrials=0,coincidentHarm=0,beneficialStatusIntroductions=0;
  for(const entry of result.trace){
    const before=session.view(),actual=session.submit(entry.command),after=session.view();
    if(actual.accepted!==entry.accepted||(!actual.accepted&&actual.reason!==entry.reason)||session.fingerprint()!==entry.digest)throw new Error('Experiment observation replay divergence');
    if(!actual.accepted||!entry.command.startsWith('a2:use:'))continue;
    const item=before.alpha2!.bag.find(i=>i.id===Number(entry.command.split(':')[2]));
    if(!item||item.definition)continue;
    unknownTrials++;
    if(harmfulChange(before.player.hp,after.player.hp,before.alpha2!.conditions,after.alpha2!.conditions))coincidentHarm++;
    if(after.alpha2!.conditions.some(c=>['ward','might','invisible','light'].includes(c.kind)&&!before.alpha2!.conditions.some(old=>old.kind===c.kind)))beneficialStatusIntroductions++;
  }
  if(session.fingerprint()!==result.finalDigest)throw new Error('Experiment final replay divergence');
  return {version:'m17-observation-1' as const,unknownTrials,coincidentHarm,beneficialStatusIntroductions};
}
