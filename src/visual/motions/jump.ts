import * as T from 'three';
import type { BlockCharacter } from '../../character-lab/character';

/** Original in-place pose for the shared 23-bone rig. No simulation capability. */
export function jumpSample(phase: number) {
  const t=T.MathUtils.clamp(phase,0,1), flight=T.MathUtils.clamp((t-.18)/.56,0,1);
  const squat=t<.18?Math.sin(t/.18*Math.PI):t>=.74?Math.sin((t-.74)/.26*Math.PI):0;
  return {travel:flight,height:Math.sin(flight*Math.PI)*1.1,squat,fold:Math.sin(flight*Math.PI),
    stage:t<.18?'prepare':t<.74?'contact':t<.88?'effect':'recover'} as const;
}
export function poseJump(actor:BlockCharacter,phase:number):void {
  const p=jumpSample(phase);actor.sample('idle',0);
  actor.bone('Pelvis').position.y-=p.squat*.15;
  actor.bone('Spine').rotation.x+=.2*p.squat+.12*p.fold;
  for(const side of ['L','R']){
    actor.bone(`Thigh${side}`).rotation.x-=.55*p.squat+.8*p.fold;
    actor.bone(`Shin${side}`).rotation.x+=.8*p.squat+1.1*p.fold;
    actor.bone(`UpperArm${side}`).rotation.x-=.4*p.fold;
    actor.bone(`Forearm${side}`).rotation.x-=.3*p.fold;
  }
  actor.root.updateMatrixWorld(true);
}

/** Keep a slow rendered frame from skipping the readable flight/landing pose.
 * This only stretches presentation; the committed rule clock never changes. */
export const nextJumpPhase=(previous:number,elapsed:number)=>Math.max(previous,Math.min(1,elapsed,previous+.10));
