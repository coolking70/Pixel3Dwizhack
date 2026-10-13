import type {PublicView} from '../core/types';
import type {PublicActionOffer,TargetRef} from '../core/action-types';
import type {Words} from '../core/alpha2-types';
export interface FacilityPresentation {name:Words;description:Words;cost:number;reason?:string;groups:{id:string;offers:readonly PublicActionOffer[]}[]}
/** Projection of already-public facts only. No world, definitions, RNG or hidden state. */
export function facilityPresentation(v:PublicView,ref:TargetRef,offers:readonly PublicActionOffer[]):FacilityPresentation|null{
 if(ref.type!=='world-entity'||ref.kind!=='facility')return null;
 const f=v.alpha2?.facilities.find(f=>f.id===ref.id);if(!f)return null;
 const groups=new Map<string,PublicActionOffer[]>();for(const o of offers){const key=o.actionId.split(':')[0]!;groups.set(key,[...(groups.get(key)??[]),o]);}
 return{name:{...f.name},description:{...f.description},cost:f.cost,reason:!f.near?'interaction.outOfRange':!offers.length?f.kind==='campfire'?'facility.empty':'facility.noAction':offers.every(o=>o.status==='disabled')?offers[0]?.publicReason:undefined,groups:[...groups].map(([id,offers])=>({id,offers}))};
}
