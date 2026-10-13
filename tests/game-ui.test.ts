import {expect,it} from 'vitest';
import {inventoryLayout} from '../src/game-ui/layout';
import {contains} from '../src/game-ui/input';
import {GameSession} from '../src/session/session';

it.each([[390,844],[844,390],[1440,900]])('six real slots and sixteen cells stay inside %ix%i', (width,height)=>{
 const layout=inventoryLayout(width,height);expect(layout.slots).toHaveLength(6);expect(layout.cells).toHaveLength(16);
 for(const r of [layout.panel,layout.preview,layout.close,layout.detail,...layout.slots,...layout.cells]){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.width).toBeGreaterThan(0);expect(r.height).toBeGreaterThan(0);expect(r.x+r.width).toBeLessThanOrEqual(width);expect(r.y+r.height).toBeLessThanOrEqual(height);}
 for(let i=0;i<layout.cells.length;i++)for(let j=i+1;j<layout.cells.length;j++){const a=layout.cells[i]!,b=layout.cells[j]!;expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);}
});
it('hit regions have nonoverlapping right and bottom edges',()=>{const r={x:10,y:20,width:30,height:40};expect(contains(r,10,20)).toBe(true);expect(contains(r,40,20)).toBe(false);expect(contains(r,10,60)).toBe(false);});
it('layout and public equipment inspection cannot consume actions or RNG',()=>{
 const session=new GameSession(42,'alpha2');session.submit('choose:channeler');const before=session.capture();
 for(let i=0;i<30;i++){const v=session.view();inventoryLayout(390,844);v.alpha2!.bag.forEach(item=>{if(item.equipped)expect(v.alpha2!.equipped[item.equipped]).toBe(item.id);});}
 expect(session.capture()).toBe(before);
});
