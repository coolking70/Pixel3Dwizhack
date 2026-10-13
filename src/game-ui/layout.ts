import type {Rect} from './input';
export interface InventoryLayout { panel:Rect;preview:Rect;slots:Rect[];cells:Rect[];detail:Rect;close:Rect }
export function itemDetailLayout(width:number,height:number):{preview:Rect;copy:Rect;actions:Rect;back:Rect}{
 const wide=width>=680,preview={x:20,y:62,width:wide?Math.min(width*.43,420):width-40,height:wide?height-132:Math.min(220,height*.28)};
 const x=wide?preview.x+preview.width+24:20,y=wide?64:preview.y+preview.height+16,w=width-x-20;
 return{preview,copy:{x,y,width:w,height:128},actions:{x,y:y+136,width:w,height:Math.max(42,height-y-200)},back:{x:20,y:height-60,width:width-40,height:40}};
}
export function inventoryLayout(width:number,height:number):InventoryLayout{
 const panel={x:8,y:8,width:width-16,height:height-16},wide=width>=680;
 const spacious=width>=1100&&height>=650,left=wide?Math.min(spacious?400:300,width*.35):width-32,top=54,previewHeight=wide?Math.min(spacious?420:270,height-124):Math.min(192,height*.25);
 const slotWidth=wide?(spacious?96:76):Math.min(110,(width-156)/2),slotHeight=Math.min(spacious?88:58,previewHeight/3-4);
 const preview={x:wide?slotWidth+22:width/2-50,y:top,width:wide?left-2*slotWidth-16:100,height:previewHeight};
 const slots=Array.from({length:6},(_,i)=>({x:i<3?16:(wide?left-slotWidth+12:width-16-slotWidth),y:top+(i%3)*(slotHeight+4),width:slotWidth,height:slotHeight}));
 const gridX=wide?left+16:16,gridY=wide?54:top+previewHeight+12,gridWidth=wide?width-gridX-16:width-32;
 const cell=Math.min(spacious?96:64,(gridWidth-18)/4,(height-gridY-138)/4),cells=Array.from({length:16},(_,i)=>({x:gridX+(i%4)*(cell+6),y:gridY+Math.floor(i/4)*(cell+6),width:cell,height:cell}));
 const detail={x:wide?gridX+4*(cell+6)+8:16,y:wide?54:gridY+4*(cell+6)+8,width:wide?width-(gridX+4*(cell+6)+8)-16:width-32,height:wide?height-78:height-(gridY+4*(cell+6)+8)-16};
 if(wide&&detail.width<170){detail.x=gridX;detail.y=gridY+4*(cell+6)+8;detail.width=gridWidth;detail.height=height-detail.y-16;}
 return{panel,preview,slots,cells,detail,close:{x:width-88,y:16,width:64,height:30}};
}


/** M26 unified inventory: tabs share navigation; narrow views show one body at a time. */
export function unifiedInventoryLayout(width:number,height:number):InventoryLayout {
 const wide=width>=680,left=wide?Math.min(360,width*.42):width;
 const top=112,bottom=height-38,slotWidth=wide?72:88,preview={x:slotWidth+22,y:top,width:left-2*slotWidth-44,height:bottom-top};
 const slotHeight=Math.min(78,(bottom-top-16)/3),slots=Array.from({length:6},(_,i)=>({x:i<3?16:left-slotWidth-16,y:top+(i%3)*(slotHeight+8),width:slotWidth,height:slotHeight}));
 const gx=wide?left+8:16,gy=148,gw=width-gx-16,cell=Math.min(100,(gw-18)/4,(bottom-gy-18)/4);
 const cells=Array.from({length:16},(_,i)=>({x:gx+i%4*(cell+6),y:gy+Math.floor(i/4)*(cell+6),width:cell,height:cell}));
 return {panel:{x:8,y:8,width:width-16,height:height-16},preview,slots,cells,detail:{x:gx,y:bottom+6,width:gw,height:24},close:{x:width-88,y:16,width:64,height:30}};
}

/** Ground choices leave the center/lower world visible for the selected model. */
export interface GroundScreenPoint {x:number;y:number;selected?:boolean}
export function groundChoiceLayout(width:number,height:number,side:'left'|'right'='right',points:readonly GroundScreenPoint[]=[]){
 const wide=width>=680,w=wide?Math.min(420,width*.46):width-24,h=wide?Math.min(370,height-104):Math.min(330,height*.42);
 const preferred={x:wide&&side==='right'?width-w-12:12,y:wide?88:76,width:w,height:h};
 const candidates=[preferred,...(wide?[{...preferred,x:side==='right'?12:width-w-12}]:[{...preferred,y:height-h-12}]),{x:(width-w)/2,y:12,width:w,height:Math.min(h,194)},{x:(width-w)/2,y:height-Math.min(h,194)-12,width:w,height:Math.min(h,194)}];
 // Projected centers include a conservative visual margin, independent of world/camera alignment.
 const score=(r:Rect)=>points.reduce((sum,p)=>{const dx=Math.max(0,Math.min(r.x+r.width,p.x+48)-Math.max(r.x,p.x-48)),dy=Math.max(0,Math.min(r.y+r.height,p.y+64)-Math.max(r.y,p.y-64)),center=p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;return sum+(center?1e6:0)*(p.selected?100:1)+dx*dy*(p.selected?100:1);},0);
 const panel=points.length?candidates.reduce((best,r)=>score(r)<score(best)?r:best):preferred;
 const rows=Math.max(1,Math.floor((panel.height-130)/64)),inner=w-24,half=(inner-8)/2;
 return {panel,rows,row:(n:number):Rect=>({x:panel.x+12,y:panel.y+46+n*64,width:inner,height:56}),page:{x:panel.x+12,y:panel.y+panel.height-82,width:inner,height:30},all:{x:panel.x+12,y:panel.y+panel.height-44,width:half,height:32},cancel:{x:panel.x+20+half,y:panel.y+panel.height-44,width:half,height:32}};
}
