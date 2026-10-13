import type {PublicView,Position} from '../core/types';
import type {TargetRef} from '../core/action-types';
import type {JumpTarget5} from '../core/alpha5-types';
import type {WorldHitCandidates,LadderEdge} from './ux-types';
export type WorldPointerIntent={kind:'move';target:Position}|{kind:'activate';target:TargetRef}|{kind:'jump';target:JumpTarget5}|{kind:'ladder';edges:readonly LadderEdge[]}|{kind:'pile';ids:readonly number[]};
/** One public priority contract for clicks and previews; disabled jumps keep their reason. */
export function worldPointerIntent(v:PublicView,c:WorldHitCandidates):WorldPointerIntent|null{
 const hit=c.hits[0];if(hit?.ref.type==='world-entity'&&hit.ref.kind==='enemy')return{kind:'activate',target:hit.ref};
 if(c.ladderEdges.length)return{kind:'ladder',edges:c.ladderEdges};
 const ground=c.hits.filter(h=>h.ref.type==='world-entity'&&h.ref.kind==='ground-item');
 if(c.pile&&(ground.length!==1||c.pile.ambiguous))return{kind:'pile',ids:c.pile.itemIds};
 if(hit?.ref.type==='world-entity')return{kind:'activate',target:hit.ref};
 if(c.jump){const target=v.alpha5?.jumpTargets.find(t=>t.position.floor===c.jump!.floor&&t.position.x===c.jump!.x);return target?{kind:'jump',target}:null;}
 return hit?.ref.type==='world-cell'?{kind:'move',target:hit.position}:null;
}
