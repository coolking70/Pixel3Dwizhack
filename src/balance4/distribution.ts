import { createAlpha4 } from '../core/alpha4';
import { createAlpha3 } from '../core/alpha3';
import { ALPHA4 } from '../content/alpha4';
import { ITEM_BY_ID } from '../content/alpha2';
import { nativeCorpse4 } from '../core/alpha4-map';
import type { World } from '../core/types';

/** Offline map audit only. Never passed to a natural-playing agent. */
export function auditMap4(w:World) {
  const s=w.alpha2!, live=s.items.filter(i=>i.owner==='ground'||i.owner==='container');
  const floors=Array.from({length:6},(_,floor)=>{
    const items=live.filter(i=>i.position.floor===floor),nativeCorpses=w.enemies.filter(e=>e.floor===floor).reduce((sum,e)=>sum+nativeCorpse4(w,e.id),0);
    const loose=items.filter(i=>i.owner==='ground'),containers=items.filter(i=>i.owner==='container'&&(i.holder??0)>0),enemy=items.filter(i=>i.owner==='container'&&(i.holder??0)<0);
    const peakWindow=Math.max(...Array.from({length:29-ALPHA4.screenCells},(_,i)=>loose.filter(item=>item.position.x>=i+1&&item.position.x<i+1+ALPHA4.screenCells).length));
    const peakStack=Math.max(0,...loose.map(i=>loose.filter(j=>j.position.x===i.position.x).length));
    const definitions=items.map(i=>ITEM_BY_ID[i.definition]!);
    const accessibleGuaranteed=['renewal','ration'].every(def=>items.some(i=>i.definition===def&&(i.owner==='ground'||(i.holder??0)>0)&&s.knowledge.buc.includes(i.id)&&i.blessing==='uncursed'));
    return {floor,items:items.length,totalBudget:items.length+nativeCorpses,nativeCorpses,loose:loose.length,container:containers.length,enemy:enemy.length,peakWindow,peakStack,healing:definitions.filter(d=>d.id==='renewal').length,food:definitions.filter(d=>d.category==='food').length+nativeCorpses,accessibleGuaranteed};
  });
  return {seed:w.seed,floors,encounterMax:Math.max(...w.enemies.map(e=>nativeCorpse4(w,e.id)+(w.alpha4?.enemyDrops.find(r=>r.enemyId===e.id)?.itemIds.length??0))),containerMax:Math.max(0,...s.facilities.filter(f=>f.kind!=='merchant').map(f=>f.stock.length))};
}
export function distribution4(count=1000,start=1) {
  if(!Number.isInteger(count)||count<1||count>10000||!Number.isInteger(start)||start<1||start+count-1>0xffffffff)throw new Error('Seed range');
  const rows:{seed:number;alpha3:ReturnType<typeof auditMap4>;alpha4:ReturnType<typeof auditMap4>}[]=[];
  for(let seed=start;seed<start+count;seed++) {
    const a=createAlpha3(seed),b=createAlpha4(seed),old=auditMap4(a),next=auditMap4(b);
    if(a.rng!==b.rng||JSON.stringify(a.enemies)!==JSON.stringify(b.enemies)||JSON.stringify(a.alpha2!.doors)!==JSON.stringify(b.alpha2!.doors)||JSON.stringify(a.alpha2!.links)!==JSON.stringify(b.alpha2!.links))throw new Error(`Map/combat base changed ${seed}`);
    if(next.encounterMax>ALPHA4.encounterLootCap||next.containerMax>2||next.floors.some(f=>f.totalBudget!==ALPHA4.lootBudgetByDepth[f.floor]||f.peakWindow>ALPHA4.maxVisibleLooseItemsPerScreen||f.peakStack>1||!f.accessibleGuaranteed))throw new Error(`Loot invariant ${seed}`);
    rows.push({seed,alpha3:old,alpha4:next});
  }
  const groups=['alpha3','alpha4'].map(key=>({identity:key,floors:Array.from({length:6},(_,floor)=>{
    const records=rows.map(row=>row[key as 'alpha3'|'alpha4'].floors[floor]!);
    return Object.fromEntries(Object.keys(records[0]!).map(field=>[field,typeof records[0]![field as keyof typeof records[0]]==='number'?{mean:records.reduce((sum,r)=>sum+Number(r[field as keyof typeof r]),0)/count,min:Math.min(...records.map(r=>Number(r[field as keyof typeof r]))),max:Math.max(...records.map(r=>Number(r[field as keyof typeof r])))}:records.every(r=>r.accessibleGuaranteed)]));
  })}));
  return {schema:1,generation:ALPHA4.generation,seeds:count,seedStart:start,independentSeeds:count,config:ALPHA4,groups,rows};
}
