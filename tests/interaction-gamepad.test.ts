import {expect,it} from 'vitest';
import {GamepadInput,type PadSnapshot} from '../src/interaction/gamepad';
const pad=(axes:number[]=[0,0],buttons:number[]=[]):PadSnapshot=>({connected:true,axes,buttons:Array.from({length:16},(_,i)=>({pressed:buttons.includes(i)}))});
it('a held stick emits one press, release/disconnect ends it, and blur requires neutral before resuming',()=>{
 const events:string[]=[];const input=new GamepadInput({down:k=>events.push('down:'+k),up:k=>events.push('up:'+k)});
 input.sample(pad([1,0]),false);for(let i=0;i<100;i++)input.sample(pad([1,0]),false);expect(events).toEqual(['down:ArrowRight']);
 input.cancel();for(let i=0;i<100;i++)input.sample(pad([1,0]),false);expect(events).toEqual(['down:ArrowRight','up:ArrowRight']);
 input.sample(pad(),false);input.sample(pad([1,0]),false);input.sample(undefined,false);expect(events.slice(-2)).toEqual(['down:ArrowRight','up:ArrowRight']);
});
it('menu traversal uses focus edges and a confirm press cannot repeat by polling',()=>{
 const events:string[]=[];const input=new GamepadInput({down:k=>events.push('down:'+k),up:k=>events.push('up:'+k)});
 input.sample(pad([0,1]),true);input.sample(pad(),true);input.sample(pad([0,0],[0]),true);for(let i=0;i<100;i++)input.sample(pad([0,0],[0]),true);
 expect(events).toEqual(['down:Tab','up:Tab','down:Enter']);
});
