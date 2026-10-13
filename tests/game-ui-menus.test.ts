import {expect,it} from 'vitest';
import {CanvasMenus,type MenuCallbacks,type MenuState,type NativePanel,type Painter} from '../src/game-ui/menus';
import type {Rect} from '../src/game-ui/input';
import {GameSession} from '../src/session/session';
import {alpha2Text} from '../src/alpha2/i18n';
it.each([[390,844],[844,390],[1440,900]])('native menus expose bounded, nonoverlapping actions at %i x %i without mechanical mutation',(width,height)=>{
 const session=new GameSession(42,'alpha2');session.submit('choose:channeler');const before=session.capture(),regions:(Rect&{id:string})[]=[];
 const none=()=>{};const callbacks:MenuCallbacks={open:none,close:none,start:none,seed:none,loadout:none,random:none,import:none,export:none,replay:none,seek:none,option:none,save:none,load:none,locale:none,command:()=>{throw new Error('render submitted a command');},stop:none};
 const painter:Painter={text:none,box:none,button:(id,_label,r)=>regions.push({...r,id}),icon:none,t:key=>alpha2Text('zh',key),invalidate:none,rect:none};const menus=new CanvasMenus(painter,callbacks);
 const panels:NativePanel[]=['newRun','menu','settings','storage','replay','help','journal','codex','map','facilities','result','conditions'];
 for(const panel of panels){regions.length=0;const state:MenuState={panel,seed:'42',loadout:'channeler',seedError:false,length:1,replayAt:null,sound:false,volume:.25,low:false,textured:true,ready:true};menus.scope(panel);const view=session.view();if(panel==='result')view.status='won';menus.render(view,'zh',state,width,height,'');
  for(const r of regions){expect(r.x,`${panel}:${r.id}`).toBeGreaterThanOrEqual(0);expect(r.y,`${panel}:${r.id}`).toBeGreaterThanOrEqual(0);expect(r.x+r.width,`${panel}:${r.id}`).toBeLessThanOrEqual(width);expect(r.y+r.height,`${panel}:${r.id}`).toBeLessThanOrEqual(height);}
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){const a=regions[i]!,b=regions[j]!;expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${panel}: ${a.id} overlaps ${b.id}`).toBe(true);}
 }
 expect(session.capture()).toBe(before);
});


