import {it,expect} from 'vitest';
import {GameSession,MAX_BYTES} from '../src/session/session';
it('120 Chinese characters survive note export and limits reject before creating an unloadable archive',()=>{
 const s=new GameSession(42,'alpha2'),id=s.view().alpha2!.bag[0]!.id,text='猜'.repeat(120),command=`a2:note:${id}:${encodeURIComponent(text)}` as const;
 expect(s.submit(command).accepted).toBe(true);expect(s.view().alpha2!.bag[0]!.note).toBe(text);expect(GameSession.fromArchive(s.capture()).capture()).toBe(s.capture());
 let rejected=false;for(let n=0;n<2200;n++){const result=s.submit(command);if(!result.accepted){expect(result.reason).toBe('limit');rejected=true;break;}}
 expect(rejected).toBe(true);const before=s.capture();expect(new TextEncoder().encode(before).byteLength).toBeLessThanOrEqual(MAX_BYTES);expect(s.submit(command)).toEqual({accepted:false,reason:'limit'});expect(s.capture()).toBe(before);expect(GameSession.fromArchive(before).capture()).toBe(before);
},120000);
