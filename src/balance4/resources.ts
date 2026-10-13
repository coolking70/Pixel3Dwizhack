import type { Command, PublicView } from '../core/types';
export interface Resources4 {
  picked:number; bought:number; dropped:number; containersOpened:number; healingDrinks:number; foodEaten:number;
  healingNet:number; foodNet:number; fullBoundaries:number; boundaries:number; peakOrdinary:number; peakWeight:number;
  healingAcquired:number; foodAcquired:number; unknownAcquired:number;
}
const used=(v:PublicView)=>v.alpha2!.capacityUsed??v.alpha2!.bag.length;
export function resourceStart4(v:PublicView):Resources4 {
  return {picked:0,bought:0,dropped:0,containersOpened:0,healingDrinks:0,foodEaten:0,healingNet:0,foodNet:0,fullBoundaries:0,boundaries:0,peakOrdinary:used(v),peakWeight:v.alpha2!.weight,healingAcquired:0,foodAcquired:0,unknownAcquired:0};
}
/** Public deltas include concurrent hunger/enemy effects; they are not causal healing efficiency. */
export function resourceStep4(r:Resources4,b:PublicView,a:PublicView,c:Command):void {
  r.boundaries++;r.fullBoundaries+=used(a)>=a.alpha2!.capacity?1:0;r.peakOrdinary=Math.max(r.peakOrdinary,used(a));r.peakWeight=Math.max(r.peakWeight,a.alpha2!.weight);
  if(c.startsWith('take:'))r.picked++;if(c.startsWith('a2:buy:'))r.bought++;if(c.startsWith('drop:'))r.dropped++;
  if(/^a2:feature:\d+:(pay|force|harvest)$/.test(c))r.containersOpened++;
  const drink=/^a2:use:(\d+):drink:self$/.exec(c);
  if(c==='potion'||drink&&b.alpha2!.bag.find(i=>i.id===Number(drink[1]))?.definition==='renewal'){r.healingDrinks++;r.healingNet+=Math.max(0,a.player.hp-b.player.hp);}
  if(/^a2:use:\d+:eat:self$/.test(c)){r.foodEaten++;r.foodNet+=Math.max(0,a.alpha2!.food-b.alpha2!.food);}
  for(const i of a.alpha2!.bag.filter(i=>!b.alpha2!.bag.some(old=>old.id===i.id))){
    if(i.definition==='renewal')r.healingAcquired++;if(i.category==='food')r.foodAcquired++;if(!i.definition)r.unknownAcquired++;
  }
}
