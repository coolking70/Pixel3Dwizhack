import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CanvasInputRouter} from '../src/game-ui/input';
class Canvas extends EventTarget {capture:number|undefined;getBoundingClientRect(){return{left:20,top:30,width:400,height:300};}focus(){}setPointerCapture(id:number){this.capture=id;}hasPointerCapture(id:number){return this.capture===id;}releasePointerCapture(id:number){if(this.capture===id){this.capture=undefined;this.dispatchEvent(new Event('lostpointercapture'));}}}
let canvas:Canvas,router:CanvasInputRouter,clicks:number[][],cancelled:number,ui:number;
const event=(type:string,x=200,y=150,id=1)=>Object.assign(new Event(type,{cancelable:true}),{clientX:x,clientY:y,pointerId:id,pointerType:'touch',button:0,isPrimary:true});
beforeEach(()=>{vi.stubGlobal('window',new EventTarget());vi.useFakeTimers();canvas=new Canvas();clicks=[];cancelled=0;ui=0;router=new CanvasInputRouter(canvas as unknown as HTMLCanvasElement,()=>{},()=>{},{worldClick:(x,y)=>clicks.push([x,y]),worldCancel:()=>cancelled++});router.regions=[{id:'ui',label:'UI',x:0,y:0,width:40,height:40,activate:()=>ui++}];});
afterEach(()=>{router.dispose();vi.useRealTimers();vi.unstubAllGlobals();});
it('world dispatch occurs only on matching valid release and capture loss cannot cancel it',()=>{
 canvas.dispatchEvent(event('pointerdown'));expect(clicks).toEqual([]);canvas.dispatchEvent(event('pointerup',200,150,2));expect(clicks).toEqual([]);canvas.dispatchEvent(event('pointerup'));expect(clicks).toEqual([[200,150]]);const after=cancelled;canvas.dispatchEvent(event('lostpointercapture'));expect(cancelled).toBe(after);canvas.dispatchEvent(event('pointerup'));expect(clicks).toHaveLength(1);
});
it('UI priority, drag out and back, lifecycle cancellation and foreign release never submit world',()=>{
 canvas.dispatchEvent(event('pointerdown',30,40));canvas.dispatchEvent(event('pointerup',30,40));expect(ui).toBe(1);expect(clicks).toEqual([]);
 canvas.dispatchEvent(event('pointerdown'));canvas.dispatchEvent(event('pointermove',280,150));canvas.dispatchEvent(event('pointermove'));canvas.dispatchEvent(event('pointerup'));expect(clicks).toEqual([]);
 for(const cancel of [()=>router.cancel(),()=>window.dispatchEvent(new Event('blur')),()=>canvas.dispatchEvent(event('pointercancel')),()=>window.dispatchEvent(new Event('resize'))]){canvas.dispatchEvent(event('pointerdown'));cancel();canvas.dispatchEvent(event('pointerup'));}expect(clicks).toEqual([]);
});
it('long press never performs a mechanical activation before release and cancelActions does not cancel live world intentions',()=>{
 canvas.dispatchEvent(event('pointerdown',30,40));vi.advanceTimersByTime(600);expect(ui).toBe(0);canvas.dispatchEvent(event('pointerup',30,40));expect(ui).toBe(0);
 canvas.dispatchEvent(event('pointerdown'));vi.advanceTimersByTime(600);expect(clicks).toEqual([]);canvas.dispatchEvent(event('pointerup'));expect(clicks).toHaveLength(0);const before=cancelled;router.cancelActions();expect(cancelled).toBe(before);
});
it('world long press inspects once, release never picks up, and cancellation releases pointer capture',()=>{
 router.dispose();const inspect=vi.fn();router=new CanvasInputRouter(canvas as unknown as HTMLCanvasElement,()=>{},()=>{},{worldClick:(x,y)=>clicks.push([x,y]),worldLongPress:inspect});
 canvas.dispatchEvent(event('pointerdown'));vi.advanceTimersByTime(450);expect(inspect).toHaveBeenCalledExactlyOnceWith(200,150);vi.advanceTimersByTime(1000);canvas.dispatchEvent(event('pointerup'));expect(clicks).toEqual([]);
 canvas.dispatchEvent(event('pointerdown'));router.cancel();expect(canvas.capture).toBeUndefined();vi.advanceTimersByTime(600);expect(inspect).toHaveBeenCalledTimes(1);canvas.dispatchEvent(event('pointerup'));expect(clicks).toEqual([]);
});
