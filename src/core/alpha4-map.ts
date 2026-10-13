import { ALPHA4 as C } from '../content/alpha4';
import { ITEMS, ITEM_BY_ID } from '../content/alpha2';
import type { Item2, ItemDef } from './alpha2-types';
import type { Position, World } from './types';

/** Versioned generation stream; combat and historical map RNG are untouched. */
function roll4(w: World): number {
  let x = w.alpha4!.lootRng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return w.alpha4!.lootRng = x >>> 0;
}
function weighted<T>(w: World, values: readonly T[], weight: (value: T) => number): T {
  let n = roll4(w) % values.reduce((sum, value) => sum + weight(value), 0);
  for (const value of values) { n -= weight(value); if (n < 0) return value; }
  throw new Error('alpha4-generation-budget');
}
function add(w: World, definition: string, owner: Item2['owner'], p: Position, holder: number | null = null, known = false): Item2 {
  const s = w.alpha2!, d = ITEM_BY_ID[definition]!;
  const i: Item2 = { id: s.items.length + 1, definition, owner, position: { floor: p.floor, x: p.x }, holder,
    blessing: known ? 'uncursed' : (['uncursed','uncursed','uncursed','blessed','cursed'] as const)[roll4(w) % 5]!,
    enchantment: known ? 0 : roll4(w) % 3 === 0 ? 1 : 0, charges: d.charges ?? 0, durability: 6, proof: false, freshUntil: d.perishes ? w.tick + 1000 : 0 };
  s.items.push(i);
  if (known) {
    if (!s.knowledge.identified.includes(definition)) s.knowledge.identified.push(definition);
    s.knowledge.buc.push(i.id); s.knowledge.enchantment.push(i.id); s.knowledge.charges.push(i.id);
  }
  return i;
}
export function nativeCorpse4(w: World, enemyId: number): number {
  const m = w.alpha2!.monsters.find(m => m.id === enemyId);
  return m && !m.spawned && ['crawler','venomfang','rimebeast'].includes(m.definition) ? 1 : 0;
}
function looseCells(w: World, floor: number): number[] {
  const s = w.alpha2!, loose = s.items.filter(i => i.owner === 'ground' && i.position.floor === floor);
  return Array.from({ length: 28 }, (_, i) => i + 1).filter(x => x !== 1 && !(floor === 0 && x === 2)
    && !s.facilities.some(f => f.floor === floor && f.x === x)
    && !s.doors.some(d => d.floor === floor && d.x === x)
    && !s.links.some(l => (l.floor === floor || l.floor + 1 === floor) && l.x === x)
    && !w.enemies.some(e => e.floor === floor && e.x === x)
    && !loose.some(i => i.position.x === x)
    && Array.from({length:29-C.screenCells},(_,n)=>n+1).every(start => {
      const count = loose.filter(i => i.position.x >= start && i.position.x < start + C.screenCells).length;
      return count + (x >= start && x < start+C.screenCells ? 1 : 0) <= C.maxVisibleLooseItemsPerScreen;
    }));
}

export function generateLoot4(w: World): void {
  const s = w.alpha2!;
  // Existing IDs remain tombstones. Starting equipment and merchant stock retain
  // the historical generation, making the resource A/B comparison interpretable.
  for (const i of s.items) if (i.owner === 'ground' || i.owner === 'container') { i.owner = 'spent'; i.holder = null; }
  for (const f of s.facilities) if (f.kind !== 'merchant') f.stock = [];
  const tutorial = { id: s.facilities.length+1, kind:'chest' as const, floor:0, x:10, used:false, revealed:true, stock:[] as number[], gold:0 };
  s.facilities.push(tutorial);
  for (let floor=0; floor<6; floor++) {
    let used = w.enemies.filter(e=>e.floor===floor).reduce((sum,e)=>sum+nativeCorpse4(w,e.id),0);
    const containers = () => s.facilities.filter(f=>f.floor===floor && (f.kind==='chest'||f.kind==='garden') && f.stock.length<2);
    const enemies = () => w.enemies.filter(e=>e.floor===floor && nativeCorpse4(w,e.id)+(w.alpha4!.enemyDrops.find(r=>r.enemyId===e.id)?.itemIds.length??0)<C.encounterLootCap);
    const place = (definition:string, known=false, preferred?:'ground'|'container') => {
      const cells=looseCells(w,floor), boxes=containers(), foes=enemies();
      const available = (['ground','container','enemy'] as const).filter(o=>o==='ground'?cells.length:o==='container'?boxes.length:foes.length);
      const owner=preferred&&available.includes(preferred)?preferred:weighted(w,available,o=>C.ownerWeights[o]);
      if(owner==='ground') add(w,definition,owner,{floor,x:cells[roll4(w)%cells.length]!},null,known);
      else if(owner==='container') {const f=boxes[roll4(w)%boxes.length]!;f.stock.push(add(w,definition,owner,f,f.id,known).id);}
      else {
        const e=foes[roll4(w)%foes.length]!;
        let r=w.alpha4!.enemyDrops.find(r=>r.enemyId===e.id);
        if(!r){r={enemyId:e.id,itemIds:[]};w.alpha4!.enemyDrops.push(r);}
        r.itemIds.push(add(w,definition,'container',e,-e.id,known).id);
      }
      used++;
    };
    if(floor===0){
      // The former four-item stack is two distinct loose cells and a real chest.
      for(const [definition,x] of [['water',3],['venom',8]] as const){add(w,definition,'ground',{floor,x});used++;}
      for(const definition of ['cinder','latch']){tutorial.stock.push(add(w,definition,'container',tutorial,tutorial.id).id);used++;}
    }
    // Guaranteed, known supplies never depend on an enemy or a rare-item gate.
    place('renewal',true,floor%2?'container':'ground');
    place('ration',true,floor%2?'ground':'container');
    const eligible=ITEMS.filter(d=>d.minDepth<=floor);
    while(used<C.lootBudgetByDepth[floor]!) {
      const d=weighted<ItemDef>(w,eligible,d=>C.categoryWeights[d.category]);place(d.id);
    }
  }
}

/** Release a pre-budgeted reward only at the accepted mechanical boundary. */
export function releaseEnemyLoot4(w: World): void {
  for(const reservation of w.alpha4!.enemyDrops){
    const e=w.enemies.find(e=>e.id===reservation.enemyId);
    if(!e||e.hp>0)continue;
    for(const id of reservation.itemIds){const i=w.alpha2!.items.find(i=>i.id===id)!;
      if(i.owner==='container'&&i.holder===-e.id){i.owner='ground';i.holder=null;i.position={floor:e.floor,x:e.x};}}
  }
}
