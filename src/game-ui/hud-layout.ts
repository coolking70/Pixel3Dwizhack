import type {Rect} from './input';
export const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
/** Local overlay rectangles; never a reserved world viewport. */
export function hudLayout(width:number,height:number,obstacles:readonly Rect[]=[],compact=false){
 const icon=44,gap=8,margin=12,right=width-margin-icon*2-gap;
 const bag={x:right,y:margin,width:icon,height:icon},more={...bag,x:right+icon+gap};
 const maxWidth=Math.max(90,Math.min(360,right-margin-gap));
 const left={x:margin,y:margin,width:maxWidth,height:width<520?26:48};
 const log={x:margin,y:left.y+left.height+6,width:maxWidth,height:compact||width<520?26:68};
 const avoid=(r:Rect)=>{const original={...r};for(const y of [r.y,r.y+52,r.y+104])for(const x of [r.x,Math.max(margin,(width-r.width)/2)]){const candidate={...r,x,y};if(y+r.height<=Math.min(height*.4,220)&&!obstacles.some(o=>overlaps(candidate,o))&&!overlaps(candidate,bag)&&!overlaps(candidate,more)){Object.assign(r,candidate);return;}}Object.assign(r,original);r.height=Math.min(r.height,26);};
 avoid(log);
 // Icons can move as a pair within the top right. Their painted and hit bounds stay identical.
 for(const y of [margin,64,116]){const a={...bag,y},b={...more,y};if(!obstacles.some(o=>overlaps(a,o)||overlaps(b,o))&&!overlaps(a,log)&&!overlaps(b,log)){bag.y=y;more.y=y;break;}}
 return{status:left,journal:log,bag,more};
}
