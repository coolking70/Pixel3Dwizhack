export interface Rect { x:number;y:number;width:number;height:number }
export interface Hotspot extends Rect { id:string;label:string;activate:()=>void;hold?:()=>void;release?:()=>void;hover?:()=>void;longPress?:()=>void }
export interface WorldPointerCallbacks {worldClick?:(clientX:number,clientY:number)=>void;worldMove?:(clientX:number,clientY:number)=>void;worldLongPress?:(clientX:number,clientY:number)=>void;worldCancel?:()=>void}
export function contains(r:Rect,x:number,y:number):boolean{return x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height;}
/** Presentation-only router. Never owns a session, mechanical state or action timer. */
export class CanvasInputRouter {
 regions:Hotspot[]=[];focus='';
 private active:Hotspot|undefined;
 private longPress:ReturnType<typeof setTimeout>|undefined;
 private pressed=false;
 private pointer:number|undefined;
 private worldPress=false;
 private start={x:0,y:0};
 private bounds='';
 private listeners=new AbortController();
 constructor(private canvas:HTMLCanvasElement,private changed:()=>void,private rotate:(delta:number)=>void,private world:WorldPointerCallbacks={}){
  const options={signal:this.listeners.signal};
  canvas.addEventListener('pointerdown',this.down,options);canvas.addEventListener('pointermove',this.move,options);
  canvas.addEventListener('pointerup',this.up,options);canvas.addEventListener('pointercancel',this.cancel,options);canvas.addEventListener('lostpointercapture',this.captureLost,options);
  window.addEventListener('blur',this.cancel,options);window.addEventListener('resize',this.cancel,options);
 }
 private point(e:PointerEvent){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 private rectKey(){const r=this.canvas.getBoundingClientRect();return`${r.left}/${r.top}/${r.width}/${r.height}`;}
 private down=(e:PointerEvent)=>{
  if(!e.isPrimary||e.button!==0)return;this.cancel();const p=this.point(e);this.start=p;this.bounds=this.rectKey();this.active=this.regions.find(r=>contains(r,p.x,p.y));this.worldPress=!this.active&&!!this.world.worldClick;
  if(!this.active&&!this.worldPress)return;e.preventDefault();this.pointer=e.pointerId;this.canvas.focus();this.canvas.setPointerCapture(e.pointerId);this.pressed=false;
  if(this.active){this.focus=this.active.id;this.active.hold?.();this.changed();if(e.pointerType==='touch'&&!this.active.hold)this.longPress=setTimeout(()=>{this.pressed=true;this.active?.longPress?.();},450);}
  else if(this.worldPress&&e.pointerType==='touch')this.longPress=setTimeout(()=>{this.pressed=true;this.world.worldLongPress?.(e.clientX,e.clientY);},450);
 };
 private move=(e:PointerEvent)=>{
  if(this.pointer!==undefined&&e.pointerId!==this.pointer)return;const p=this.point(e);
  if(this.active?.id==='preview'){this.rotate(p.x-this.start.x);this.start=p;this.pressed=true;return;}
  if(this.pointer!==undefined&&Math.hypot(p.x-this.start.x,p.y-this.start.y)>10){clearTimeout(this.longPress);this.pressed=true;if(this.worldPress){this.worldPress=false;this.world.worldCancel?.();}}
  if(!this.active&&e.pointerType==='mouse'){const region=this.regions.find(r=>contains(r,p.x,p.y)),id=region?.id??'';if(id!==this.focus){this.focus=id;this.changed();region?.hover?.();}if(!region)this.world.worldMove?.(e.clientX,e.clientY);}
 };
 private up=(e:PointerEvent)=>{
  if(e.pointerId!==this.pointer)return;const active=this.active,p=this.point(e),world=this.worldPress,r=this.canvas.getBoundingClientRect();clearTimeout(this.longPress);this.active=undefined;this.pointer=undefined;this.worldPress=false;active?.release?.();
  if(this.pressed||this.bounds!==this.rectKey()||world&&Math.hypot(p.x-this.start.x,p.y-this.start.y)>10)return;
  if(active&&!active.hold&&contains(active,p.x,p.y))active.activate();
  else if(world&&contains({x:0,y:0,width:r.width,height:r.height},p.x,p.y)&&!this.regions.some(region=>contains(region,p.x,p.y)))this.world.worldClick?.(e.clientX,e.clientY);
 };
 // Normal capture release follows pointerup; it must not cancel the new click intent.
 private captureLost=()=>{if(this.pointer!==undefined)this.cancel();};
 /** Invalidate press closures on modal/lifecycle changes, including pending long press. */
 private clearPress(){clearTimeout(this.longPress);const pointer=this.pointer;this.pointer=undefined;this.active?.release?.();this.active=undefined;this.worldPress=false;this.pressed=false;if(pointer!==undefined&&this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);}
 cancel=()=>{this.clearPress();this.world.worldCancel?.();};
 /** A committed action invalidates old clicks, while an authorized movement hold survives its own animation. */
 cancelActions(){if(!this.active?.hold)this.clearPress();}
 keydown(e:KeyboardEvent):boolean{if(e.key==='Tab'){e.preventDefault();const at=this.regions.findIndex(r=>r.id===this.focus),n=this.regions.length;this.focus=this.regions[(at+(e.shiftKey?-1:1)+n)%n]?.id??'';this.changed();return true;}if(e.key==='Enter'||e.key===' '){const region=this.regions.find(r=>r.id===this.focus);if(region){e.preventDefault();if(!e.repeat)region.activate();return true;}}return false;}
 dispose(){this.cancel();this.listeners.abort();}
}
