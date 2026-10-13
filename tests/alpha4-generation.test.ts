import { expect, it } from 'vitest';
import { distribution4, auditMap4 } from '../src/balance4/distribution';
import { createAlpha4, acceptAlpha4, inspectAlpha4 } from '../src/core/alpha4';
import { canonical } from '../src/core/digest';
import { nativeCorpse4 } from '../src/core/alpha4-map';

it('audits 1000 independent seeds: exact per-depth budget, loose density, no singleton gates and bounded encounter drops',()=>{
  const result=distribution4(1000);expect(result.rows).toHaveLength(1000);expect(new Set(result.rows.map(r=>r.seed)).size).toBe(1000);
  expect(result.rows.every(r=>r.alpha4.floors.every(f=>f.peakStack===1&&f.accessibleGuaranteed))).toBe(true);
},30000);
it('preallocated enemy loot is hidden until formal death, bounded with corpse drops, released only once',()=>{
  const w=createAlpha4(42),s=w.alpha2!,reservation=w.alpha4!.enemyDrops[0]!,e=w.enemies.find(e=>e.id===reservation.enemyId)!;
  w.player.x=e.x-1;w.player.floor=e.floor;e.hp=1;e.nextAt=999999;w.enemies=w.enemies.filter(enemy=>enemy.id===e.id);
  w.explored[e.floor]=Array.from({length:30},(_,i)=>i);s.doors=[];s.facilities=[];
  const before=canonical(w),view=inspectAlpha4(w);
  expect(reservation.itemIds.every(id=>!view.alpha2!.ground.some(i=>i.id===id)&&!view.alpha2!.bag.some(i=>i.id===id))).toBe(true);
  const r=acceptAlpha4(w,'attack');expect(r.accepted).toBe(true);if(!r.accepted)return;
  expect(canonical(w)).toBe(before);expect(r.world.enemies[0]!.hp).toBe(0);
  const ground=r.world.alpha2!.items.filter(i=>i.owner==='ground'&&i.position.floor===e.floor&&i.position.x===e.x);
  expect(ground.length).toBe(reservation.itemIds.length+nativeCorpse4(w,e.id));expect(ground.length).toBeLessThanOrEqual(2);
  const next=acceptAlpha4(r.world,'wait');expect(next.accepted).toBe(true);if(next.accepted)expect(next.world.alpha2!.items.filter(i=>i.owner==='ground').map(i=>i.id)).toEqual(r.world.alpha2!.items.filter(i=>i.owner==='ground').map(i=>i.id));
});
it('the first-floor teaching set is separated and the real chest is payable or forceable without a rare item',()=>{
  const w=createAlpha4(1),s=w.alpha2!,chest=s.facilities.find(f=>f.floor===0&&f.x===10)!;
  expect(chest.kind).toBe('chest');expect(chest.stock.map(id=>s.items.find(i=>i.id===id)!.definition)).toEqual(['cinder','latch']);
  expect(s.items.filter(i=>i.owner==='ground'&&i.position.floor===0&&['water','venom'].includes(i.definition)).map(i=>i.position.x)).toEqual(expect.arrayContaining([3,8]));
  w.player.x=9;w.enemies=[];const initial=canonical(w);
  for(const verb of ['pay','force'] as const){const r=acceptAlpha4(w,`a2:feature:${chest.id}:${verb}`);expect(r.accepted).toBe(true);if(r.accepted)expect(r.world.alpha2!.items.filter(i=>chest.stock.includes(i.id)&&i.owner==='ground')).toHaveLength(2);}
  expect(canonical(w)).toBe(initial);expect(auditMap4(createAlpha4(1))).toEqual(auditMap4(createAlpha4(1)));
});
