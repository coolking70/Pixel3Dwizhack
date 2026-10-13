import type {Command,PublicView} from '../core/types';
import type {Item2View} from '../core/alpha2-types';
import type {Loadout} from '../core/alpha-types';
import type {Locale} from '../ui/i18n';
import type {Rect} from './input';
import type {PublicActionOffer,PublicTargetOffer,TargetRef} from '../core/action-types';
import type {ActionResult,NavigationState} from '../interaction/ux-types';

export interface InteractionCallbacks {
 returnToWorld?:()=>boolean;
 completed?:()=>void;
 targetSelected?:(target:PublicTargetOffer|null)=>void;
 selectionChanged?:(itemId:number|null,actionId:string|null)=>void;
 queryActions?:(itemId:number)=>readonly PublicActionOffer[];
 queryTargets?:(itemId:number,actionId:string)=>readonly PublicTargetOffer[];
 queryContext?:(target:TargetRef)=>readonly PublicActionOffer[];
 commit?:(offer:PublicActionOffer|PublicTargetOffer)=>ActionResult|void;
 targetsChanged?:(targets:readonly PublicTargetOffer[])=>void;
}
export function targetRefKey(ref:TargetRef):string {switch(ref.type){case 'self':return 'self';case 'inventory-item':return `item:${ref.itemId}`;case 'equipment-slot':return `slot:${ref.slot}`;case 'world-cell':return `cell:${ref.floor}:${ref.x}`;case 'world-entity':return `entity:${ref.kind}:${ref.id}`;}}
/** Disposable public-query state. No rule access or command reconstruction. */
export class ItemInteraction {
 itemId:number|null=null; action:PublicActionOffer|null=null; targets:readonly PublicTargetOffer[]=[];
 selected:PublicTargetOffer|null=null; confirmation:PublicActionOffer|PublicTargetOffer|null=null;
 context:TargetRef|null=null; offers:readonly PublicActionOffer[]=[];
 navigation:NavigationState={page:'bag',selectedItemId:null,originIndex:0,selectedSlot:null,previousActionId:null};
 publicReason:string|undefined;
 private revision=-1;private readOnly=true;private busy=false;private bag:readonly Item2View[]=[];
 constructor(private cb:InteractionCallbacks){}
 sync(revision:number,readOnly:boolean,bag?:readonly Item2View[],busy=false){
  const changed=revision!==this.revision,modeChanged=readOnly!==this.readOnly;
  this.revision=revision;this.readOnly=readOnly;this.busy=busy;if(bag)this.bag=bag;
  if(modeChanged)this.cancel();else if(changed){this.suspend();if(this.itemId!==null&&bag&&!bag.some(i=>i.id===this.itemId))this.returnToBag(bag);}
  if(this.itemId!==null&&!this.action)this.offers=readOnly?[]:(this.cb.queryActions?.(this.itemId)??[]);
 }
 private clearPending(){const hadTargets=this.targets.length>0,hadSelected=this.selected!==null;this.action=null;this.selected=null;this.confirmation=null;this.targets=[];if(hadSelected)this.cb.targetSelected?.(null);if(hadTargets)this.cb.targetsChanged?.([]);this.cb.selectionChanged?.(this.itemId,null);}
 /** Lifecycle invalidation retains the location but never retains an executable offer. */
 suspend(){this.clearPending();this.offers=this.readOnly?[]:this.itemId!==null?(this.cb.queryActions?.(this.itemId)??[]):this.context?(this.cb.queryContext?.(this.context)??[]):[];}
 private returnToBag(bag:readonly Item2View[]){const ordinary=bag.filter(i=>!i.equipped);this.navigation.page='bag';this.navigation.selectedSlot=null;this.navigation.originIndex=Math.min(this.navigation.originIndex,Math.max(0,ordinary.length-1));this.navigation.selectedItemId=ordinary[this.navigation.originIndex]?.id??null;this.itemId=null;this.offers=[];this.cb.selectionChanged?.(null,null);}
 cancel(){const hadTargets=this.targets.length>0,hadSelected=this.selected!==null;this.itemId=null;this.action=null;this.selected=null;this.confirmation=null;this.context=null;this.offers=[];this.targets=[];if(hadSelected)this.cb.targetSelected?.(null);if(hadTargets)this.cb.targetsChanged?.([]);this.cb.selectionChanged?.(null,null);}
 open(itemId:number){this.cancel();this.publicReason=undefined;this.itemId=itemId;this.navigation.selectedItemId=itemId;const item=this.bag.find(i=>i.id===itemId);this.navigation.selectedSlot=item?.equipped??null;if(item?.equipped)this.navigation.page='character';else{this.navigation.page='bag';this.navigation.originIndex=Math.max(0,this.bag.filter(i=>!i.equipped).findIndex(i=>i.id===itemId));}this.offers=this.readOnly?[]:(this.cb.queryActions?.(itemId)??[]);this.cb.selectionChanged?.(itemId,null);}
 openContext(target:TargetRef){this.cancel();this.context=target;this.offers=this.readOnly?[]:(this.cb.queryContext?.(target)??[]);}
 choose(offer:PublicActionOffer){if(this.readOnly||this.busy||offer.revision!==this.revision||offer.status==='disabled'||!this.offers.includes(offer))return;this.action=offer;this.navigation.previousActionId=offer.actionId;this.publicReason=undefined;const hadSelected=this.selected!==null;this.selected=null;this.confirmation=null;if(hadSelected)this.cb.targetSelected?.(null);this.cb.selectionChanged?.(this.itemId,offer.actionId);
  if(offer.targetModes.length&&this.itemId!==null){this.targets=this.cb.queryTargets?.(this.itemId,offer.actionId)??[];this.cb.targetsChanged?.(this.targets);}
  else if(offer.requiresConfirmation)this.confirmation=offer;
  else this.commit(offer);
 }
 select(ref:TargetRef):boolean{const key=targetRefKey(ref),target=this.targets.find(t=>targetRefKey(t.ref)===key);if(!target)return false;this.selected=null;this.confirmation=null;if(target.status!=='disabled'&&target.revision===this.revision){this.selected=target;this.confirmation=target;}this.cb.targetSelected?.(this.selected);return true;}
 cycle(delta:number){const enabled=this.targets.filter(t=>t.status!=='disabled'&&t.revision===this.revision);if(!enabled.length)return;const at=enabled.indexOf(this.selected!);this.select(enabled[(at+delta+enabled.length)%enabled.length]!.ref);}
 confirm(){if(this.confirmation)this.commit(this.confirmation);}
 private commit(offer:PublicActionOffer|PublicTargetOffer){
  if(this.readOnly||this.busy||offer.status==='disabled'||offer.revision!==this.revision||!offer.command)return;
  const submittedRevision=offer.revision;
  const source=this.itemId,actionId=this.action?.actionId,context=this.context,oldSlot=this.bag.find(i=>i.id===source)?.equipped;
  const result=this.cb.commit?.(offer);
  if(!result){this.publicReason="interaction.unavailable";return;}
  this.publicReason=result.publicReason;
  if(!result.accepted)return;
  if(result.revision<=submittedRevision){this.publicReason="interaction.unavailable";return;}
  if(this.cb.returnToWorld?.()){this.cancel();this.cb.completed?.();return;}
  this.revision=result.revision;this.bag=result.bag;this.clearPending();this.context=null;
  const item=result.bag.find(i=>i.id===source);
  if(actionId==='equip'||actionId==='unequip'){
   this.itemId=null;this.offers=[];this.navigation.page='character';this.navigation.selectedItemId=item?.id??null;this.navigation.selectedSlot=item?.equipped??oldSlot??null;this.cb.selectionChanged?.(null,null);
  }else if(item){this.itemId=item.id;this.navigation.selectedItemId=item.id;this.offers=this.readOnly?[]:(this.cb.queryActions?.(item.id)??[]);this.cb.selectionChanged?.(item.id,null);}
  else if(source!==null)this.returnToBag(result.bag);
  else{this.cancel();if(context&&result.interrupt)this.openContext(context);}
 }
 back(){const context=this.context;if(this.action||this.confirmation){this.clearPending();if(this.itemId!==null)this.offers=this.readOnly?[]:(this.cb.queryActions?.(this.itemId)??[]);else if(context)this.openContext(context);}else this.cancel();}
 get aiming(){return !!this.action&&this.action.targetModes.some(m=>m==='world-cell'||m==='world-entity');}
}

export type NativePanel='newRun'|'bag'|'help'|'settings'|'codex'|'menu'|'facilities'|'map'|'journal'|'storage'|'replay'|'result'|'conditions';
export interface MenuState {direct?:boolean;panel:NativePanel|null;seed:string;loadout:Loadout;seedError:boolean;length:number;replayAt:number|null;sound:boolean;volume:number;low:boolean;textured:boolean;ready:boolean}
export interface MenuCallbacks {openContext?:(target:TargetRef)=>void;open:(panel:NativePanel)=>void;close:()=>void;start:()=>void;seed:(value:string)=>void;loadout:(value:Loadout)=>void;random:()=>void;import:()=>void;export:()=>void;replay:()=>void;seek:(at:number)=>void;option:(name:'sound'|'volume'|'low'|'textured',value:number|boolean)=>void;save:()=>void;load:()=>void;locale:()=>void;command:(command:Command)=>void;stop:()=>void}
export interface Painter {text:(value:string,x:number,y:number,width:number,size?:number,color?:string)=>void;box:(r:Rect,fill?:string,stroke?:string)=>void;button:(id:string,label:string,r:Rect,action:()=>void)=>void;icon:(item:Item2View,r:Rect)=>void;t:(key:string,values?:Record<string,string|number>)=>string;invalidate:()=>void;rect:(r:Rect,color:string)=>void}
/** The DOM element is solely a platform IME/virtual-keyboard bridge. All visible editing is canvas. */
class TextInputBridge {
 readonly input=document.createElement('input');
 constructor(label:string,value:string,max:number,changed:(value:string)=>void,finish:(save:boolean)=>void){const i=this.input;i.value=value;i.maxLength=max;i.setAttribute('aria-label',label);i.dataset.nativeInput='true';Object.assign(i.style,{position:'fixed',left:'20px',top:'90px',width:'1px',height:'1px',opacity:'0.01',fontSize:'16px',border:'0',padding:'0'});i.addEventListener('input',()=>changed(i.value));i.addEventListener('keydown',e=>{e.stopPropagation();if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();finish(true);}if(e.key==='Escape'){e.preventDefault();finish(false);}});document.body.append(i);i.focus();i.select();}
 dispose(){this.input.remove();}
}
export class CanvasMenus {
 private moreGroup:string|null=null;
 back(){if(this.panel==='menu'&&this.moreGroup){this.moreGroup=null;this.p.invalidate();return true;}return false;}
 private page=0;private stockPage=0;private bagPage=0;private facility=0;private tradeItem=0;private query='';private bookEntry='';
 private panel:NativePanel|null=null;private journalPage=0;
 private editor:{label:string;value:string;commit:(value:string)=>void;bridge:TextInputBridge}|undefined;
 private inspected:Item2View|undefined;
 constructor(private p:Painter,private cb:MenuCallbacks){}
 get editing(){return !!this.editor;}
 get inspecting(){return !!this.inspected;}
 inspect(item:Item2View){this.cb.stop();this.inspected=item;this.p.invalidate();}
 closeInspection(){this.inspected=undefined;this.p.invalidate();}
 scope(panel:NativePanel|null){if(panel!==this.panel){if(panel===null)this.moreGroup=null;this.cancelEdit();this.inspected=undefined;if(this.panel==='journal')this.journalPage=this.page;this.page=panel==='journal'?this.journalPage:0;this.bookEntry='';this.panel=panel;}}
 cancelEdit(){this.editor?.bridge.dispose();this.editor=undefined;}
 edit(label:string,value:string,max:number,commit:(value:string)=>void){this.cb.stop();this.cancelEdit();const finish=(save:boolean)=>{const editor=this.editor;this.cancelEdit();if(save&&editor)editor.commit(editor.value);this.p.invalidate();};const bridge=new TextInputBridge(label,value,max,value=>{if(this.editor)this.editor.value=value;this.p.invalidate();},finish);this.editor={label,value,commit,bridge};this.p.invalidate();}
 private paragraph(value:string,x:number,y:number,width:number,maxLines=5,size=14){const chars=Math.max(12,Math.floor(width/(size*.72))),lines=value.match(new RegExp(`.{1,${chars}}`,'gu'))??[];lines.slice(0,maxLines).forEach((line,i)=>this.p.text(line,x,y+i*(size+9),width,size));return y+Math.min(maxLines,lines.length)*(size+9);}
 private pages(count:number,size:number,y:number,width:number){const total=Math.max(1,Math.ceil(count/size));this.page%=total;this.p.button('page:previous','←',{x:24,y,width:54,height:32},()=>{this.page=(this.page+total-1)%total;this.p.invalidate();});this.p.text(`${this.page+1}/${total}`,90,y+16,width-190);this.p.button('page:next','→',{x:width-78,y,width:54,height:32},()=>{this.page=(this.page+1)%total;this.p.invalidate();});}
 render(view:PublicView,locale:Locale,state:MenuState,width:number,height:number,notice:string){const p=this.p,t=p.t,a=view.alpha2!,panel=state.panel??'result';
   p.box({x:8,y:8,width:width-16,height:height-16},'#0a1a25','#a1875c');p.text(t(panel==='menu'?'mainMenu':panel),24,32,width-148,21,'#f2ca87');p.button('close',t('close'),{x:width-118,y:16,width:94,height:32},()=>{if(!this.back())this.cb.close();});p.text(notice,24,height-24,width-48,12,'#e0bd83');
   if(panel==='newRun'){
     let y=this.paragraph(t('intro'),24,75,width-48,height<500?2:4);p.text(t('loadout'),24,y+12,width-48,15);y+=34;
     const names=['vanguard','breaker','channeler'] as const,w=(width-56)/3;names.forEach((name,i)=>p.button(`loadout:${name}`,`${state.loadout===name?'◆ ':''}${t(name)}`,{x:24+i*(w+4),y,width:w,height:40},()=>this.cb.loadout(name)));y+=62;
     if(height>=500)y=this.paragraph(t(`${state.loadout}Detail`),24,y,width-48,3)+12;
     p.button('seed',`${t('seed')}: ${state.seed}`,{x:24,y,width:width-152,height:38},()=>this.edit(t('seed'),state.seed,10,this.cb.seed));p.button('random',t('random'),{x:width-116,y,width:92,height:38},this.cb.random);y+=50;
     p.button('start',t('start'),{x:24,y,width:width-48,height:44},()=>{if(state.ready)this.cb.start();});if(state.seedError)p.text(t('seedError'),24,y+62,width-48,13,'#ff927f');
     const footer=height-62;[['load',t('load'),this.cb.load],['import',t('import'),this.cb.import],['locale',locale==='zh'?'EN':'中文',this.cb.locale]].forEach(([id,label,fn],i)=>p.button(String(id),String(label),{x:24+i*(width-48)/3,y:footer,width:(width-48)/3-4,height:34},fn as ()=>void));
   }else if(panel==='menu'){
     if(view.alpha5){
      const groups:Record<string,NativePanel[]>={records:['journal','codex','map','facilities'],game:['storage','replay','newRun'],settings:['settings','help','conditions']};
      const entries=this.moreGroup?groups[this.moreGroup]!:Object.keys(groups);
      entries.forEach((key,i)=>p.button(`open:${key}`,t(this.moreGroup?key:'menu.'+key),{x:24,y:70+i*46,width:width-48,height:38},()=>{if(this.moreGroup)this.cb.open(key as NativePanel);else{this.moreGroup=key;p.invalidate();}}));
     }else{const entries:NativePanel[]=['bag','facilities','map','journal','codex','storage','settings','help','newRun','conditions'];if(state.direct)entries.splice(entries.indexOf('conditions'),1);const cols=width>700?3:2,w=(width-56)/cols;entries.forEach((key,i)=>p.button(`open:${key}`,t(state.direct&&key==='bag'?'interaction.inventory':key),{x:24+(i%cols)*(w+4),y:70+Math.floor(i/cols)*52,width:w,height:44},()=>this.cb.open(key)));}

   }else if(panel==='settings'){
     const rows:[string,string,()=>void][]=[['sound',`${t('audio')}: ${t(state.sound?'on':'off')}`,()=>this.cb.option('sound',!state.sound)],['low',`${t('low')}: ${t(state.low?'on':'off')}`,()=>this.cb.option('low',!state.low)],['textured',`${t('texture')}: ${t(state.textured?'on':'off')}`,()=>this.cb.option('textured',!state.textured)],['locale',locale==='zh'?'English':'中文',this.cb.locale]];
     rows.forEach(([id,label,fn],i)=>p.button(`setting:${id}`,label,{x:24,y:70+i*49,width:width-48,height:40},fn));p.button('volume:down',`${t('volume')} −`,{x:24,y:275,width:(width-56)/2,height:36},()=>this.cb.option('volume',Math.max(0,state.volume-.1)));p.button('volume:up',`${Math.round(state.volume*100)}% +`,{x:width/2+4,y:275,width:(width-56)/2,height:36},()=>this.cb.option('volume',Math.min(1,state.volume+.1)));
   }else if(panel==='storage'){
     const entries:[string,string,()=>void][]=[['save',t('save'),this.cb.save],['load',t('load'),this.cb.load],['export',t('export'),this.cb.export],['import',t('import'),this.cb.import],['replay',t(state.replayAt===null?'replay':'live'),()=>{if(state.replayAt===null)this.cb.replay();this.cb.open('replay');}]];entries.forEach(([id,label,fn],i)=>p.button(id,label,{x:24,y:70+i*48,width:width-48,height:40},fn));
   }else if(panel==='replay'){
     p.text(`${t('position')} ${state.replayAt??state.length} / ${state.length}`,24,84,width-48,18);const steps=[-32,-1,1,32];steps.forEach((step,i)=>p.button(`seek:${step}`,`${step>0?'+':''}${step}`,{x:24+i*(width-48)/4,y:112,width:(width-48)/4-4,height:42},()=>this.cb.seek(Math.max(0,Math.min(state.length,(state.replayAt??state.length)+step)))));p.button('seek:0',t('replayStart'),{x:24,y:166,width:(width-56)/2,height:40},()=>this.cb.seek(0));p.button('seek:end',t('replayEnd'),{x:width/2+4,y:166,width:(width-56)/2,height:40},()=>this.cb.seek(state.length));p.button('live',t('live'),{x:24,y:222,width:width-48,height:42},()=>{this.cb.replay();this.cb.close();});this.paragraph(t('replayReadOnly'),24,290,width-48,3);
   }else if(panel==='help'){
     const rows=['helpMove','helpCombat','helpItems','helpRoutes','helpSave'];this.pages(rows.length,1,height-78,width);this.paragraph(t(rows[this.page]!),24,80,width-48,Math.floor((height-170)/24),15);
   }else if(panel==='conditions'){
     const rows=[`${t('damage')} ${view.gear!.damage} · ${t('armor')} ${view.gear!.armor} · ${t('gold')} ${view.player.gold}`,...a.conditions.map(c=>`${t(c.kind)} · ${c.until-view.tick} · ${t('source')}: ${c.source[locale]}`),...a.resists.map(r=>`${t(r.element==='poison'?'poisonElement':r.element)} ${t('immuneTo')} · ${r.source[locale]}`),...view.enemies.map(e=>`${a.monsters.find(m=>m.enemy===e.id)?.name[locale]} ${e.hp}/${e.maxHp}${e.intent?` · ${t('intent',{x:e.intent.x,ticks:e.nextAt-view.tick})}`:''}`)];const size=Math.max(2,Math.floor((height-155)/44));this.pages(rows.length,size,height-78,width);rows.slice(this.page*size,(this.page+1)*size).forEach((line,i)=>p.text(line,24,82+i*44,width-48,14));
   }else if(panel==='journal'){
     const rows=[...a.journal].reverse(),size=Math.max(2,Math.floor((height-155)/44));this.pages(rows.length,size,height-78,width);rows.slice(this.page*size,(this.page+1)*size).forEach((e,i)=>{p.text(t(`log.${e.key}`,{name:e.name?.[locale]??'',target:e.target?.[locale]??'',amount:e.amount??0}),24,82+i*44,width-48,14);});
   }else if(panel==='codex'){
     p.button('book:search',`${t('searchBook')}: ${this.query}`,{x:24,y:66,width:width-48,height:38},()=>this.edit(t('searchBook'),this.query,120,value=>{this.query=value;this.page=0;this.bookEntry='';}));const rows=[...a.codex.items,...a.codex.monsters,...a.codex.facilities].filter(e=>e.name[locale].toLocaleLowerCase().includes(this.query.toLocaleLowerCase()));
     const selected=rows.find(e=>e.id===this.bookEntry);if(selected){p.text(selected.name[locale],24,135,width-48,18,'#f2ca87');this.paragraph(selected.description[locale],24,172,width-48,Math.floor((height-260)/24));p.button('book:back',t('back'),{x:24,y:height-80,width:width-48,height:36},()=>{this.bookEntry='';p.invalidate();});}else{const size=Math.max(2,Math.floor((height-210)/46));this.pages(rows.length,size,height-78,width);if(!rows.length)p.text(t('emptyBook'),24,138,width-48);rows.slice(this.page*size,(this.page+1)*size).forEach((e,i)=>p.button(`book:${e.id}`,e.name[locale],{x:24,y:118+i*46,width:width-48,height:39},()=>{this.bookEntry=e.id;p.invalidate();}));}
   }else if(panel==='map'){
     const cell=(width-60)/Math.max(1,view.map.width),y0=84,row=Math.min(52,(height-180)/6);for(let f=0;f<view.map.floors;f++){p.text(String(f+1),24,y0+f*row+8,20);for(const x of view.explored[f]!)p.rect({x:44+x*cell,y:y0+f*row,width:Math.max(2,cell-1),height:16},'#769a91');}for(const link of view.map.ladders)p.rect({x:44+link.x*cell+cell/2,y:y0+link.floor*row,width:3,height:row+12},'#dcb36d');for(const door of view.alpha!.doors)p.rect({x:44+door.x*cell+cell*.35,y:y0+door.floor*row-2,width:Math.max(3,cell*.25),height:20},door.open?'#80cfa9':'#d88c61');p.rect({x:44+view.player.x*cell,y:y0+view.player.floor*row-3,width:cell,height:22},'#ffe1a0');p.text(a.segments.filter(segment=>segment.floor===view.player.floor).map(segment=>t(segment.tag)+' '+segment.start+'–'+segment.end).join(' · '),24,height-100,width-48,12);this.paragraph(t('mapLegend'),24,height-66,width-48,1);
   }else if(panel==='facilities'){if(state.direct){const near=a.facilities.filter(f=>f.near),rows=Math.max(1,Math.floor((height-160)/48));this.pages(near.length,rows,height-78,width);near.slice(this.page*rows,(this.page+1)*rows).forEach((f,n)=>p.button(`context:facility:${f.id}`,f.name[locale],{x:24,y:72+n*48,width:width-48,height:40},()=>this.cb.openContext?.({type:'world-entity',kind:'facility',id:f.id})));if(!near.length)p.text(t('noNearFeature'),24,92,width-48);}else this.trade(view,locale,width,height);}
   else if(panel==='result'){p.text(t(view.status),24,90,width-48,28,'#f2ca87');this.paragraph(`${t('seed')} ${view.seed} · ${t('tick')} ${view.tick} · ${t('actions')} ${state.length} · ${t('kills')} ${view.expedition!.kills}`,24,144,width-48,3,17);p.button('result:newRun',t('newRun'),{x:24,y:height-150,width:width-48,height:44},()=>this.cb.open('newRun'));p.button('result:save',t('save'),{x:24,y:height-96,width:(width-56)/2,height:38},this.cb.save);p.button('result:export',t('export'),{x:width/2+4,y:height-96,width:(width-56)/2,height:38},this.cb.export);}
 }
 private trade(view:PublicView,locale:Locale,width:number,height:number){const p=this.p,t=p.t,a=view.alpha2!,near=a.facilities.filter(f=>f.near);this.facility%=Math.max(1,near.length);const f=near[this.facility];if(!f){p.text(t('noNearFeature'),24,90,width-48);return;}
   p.button('facility:next',`${f.name[locale]} ${this.facility+1}/${near.length} →`,{x:24,y:65,width:width-48,height:36},()=>{this.facility++;this.stockPage=0;this.bagPage=0;p.invalidate();});p.text(`${t('gold')} ${view.player.gold} · ${t('shopFunds')} ${f.gold??0}`,24,120,width-48,13);
   const cw=(width-56)/2,rows=Math.max(1,Math.min(7,Math.floor((height-312)/62))),left=f.stock,right=a.bag;
   p.text(f.kind==='merchant'?t('buy'):t('facilities'),24,148,cw,15,'#f2ca87');p.text(t('bag'),32+cw,148,cw,15,'#f2ca87');
   this.stockPage%=Math.max(1,Math.ceil(left.length/rows));this.bagPage%=Math.max(1,Math.ceil(right.length/rows));
   const row=(item:Item2View,x:number,y:number,buy:boolean)=>{p.button(`${buy?'buy':'tradeItem'}:${item.id}`,'',{x,y,width:cw,height:55},()=>{if(buy)this.cb.command(`a2:buy:${f.id}:${item.id}`);else{this.tradeItem=item.id;p.invalidate();}});p.icon(item,{x,y,width:42,height:54});p.text(item.name[locale],x+44,y+16,cw-48,12);p.text(buy?`${t('buy')} ${item.buy}`:`${item.id===this.tradeItem?'◆ ':''}${t('sell')} ${item.sell}`,x+44,y+37,cw-48,11);};
   left.slice(this.stockPage*rows,(this.stockPage+1)*rows).forEach((item,i)=>row(item,24,166+i*62,true));right.slice(this.bagPage*rows,(this.bagPage+1)*rows).forEach((item,i)=>row(item,32+cw,166+i*62,false));
   const footer=height-93;p.button('stock:next','← / →',{x:24,y:footer-42,width:cw,height:32},()=>{this.stockPage++;p.invalidate();});p.button('tradeBag:next','← / →',{x:32+cw,y:footer-42,width:cw,height:32},()=>{this.bagPage++;p.invalidate();});
   const selected=right.find(i=>i.id===this.tradeItem),actions:{id:string;label:string;command:Command}[]=[];if(f.kind==='merchant'&&selected){actions.push({id:'sell',label:t('sell'),command:`a2:sell:${f.id}:${selected.id}`});if(selected.category==='wand')actions.push({id:'recharge',label:t('recharge'),command:`a2:recharge:${f.id}:${selected.id}`});}if(f.kind==='altar'&&selected)actions.push({id:'cleanse',label:t('cleanse'),command:`a2:cleanse:${f.id}:${selected.id}`});if(f.kind==='campfire'&&selected)actions.push({id:'cook',label:t('cook'),command:`a2:cook:${f.id}:${selected.id}`});
   if(!f.used)for(const key of f.kind==='chest'?['pay','force']:f.kind==='fountain'?['drink']:f.kind==='garden'?['harvest']:f.kind==='trap'?['disarm']:[])actions.push({id:key,label:t(key==='drink'?'featureDrink':key),command:`a2:feature:${f.id}:${key}` as Command});actions.forEach((action,i)=>p.button(`feature:${action.id}`,action.label,{x:24+i*(width-48)/actions.length,y:footer,width:(width-48)/actions.length-4,height:38},()=>this.cb.command(action.command)));
 }
 renderEditor(width:number,height:number){if(!this.editor)return;const p=this.p,e=this.editor;p.box({x:8,y:8,width:width-16,height:height-16},'#0a1a25','#d8bd80');p.text(e.label,24,38,width-48,18,'#f2ca87');this.paragraph(e.value||'▏',24,90,width-48,Math.floor((height-180)/24),16);const finish=(save:boolean)=>{const value=e.value,commit=e.commit;this.cancelEdit();if(save)commit(value);p.invalidate();};p.button('edit:save',p.t('execute'),{x:24,y:height-92,width:(width-56)/2,height:44},()=>finish(true));p.button('edit:cancel',p.t('cancelUse'),{x:width/2+4,y:height-92,width:(width-56)/2,height:44},()=>finish(false));}
 renderInspection(_view:PublicView,locale:Locale,width:number,height:number){const item=this.inspected;if(!item)return;const p=this.p,t=p.t;p.box({x:8,y:8,width:width-16,height:height-16},'#0a1a25','#a1875c');p.text(item.name[locale],24,34,width-48,21,'#f2ca87');p.icon(item,{x:24,y:58,width:120,height:125});this.paragraph(item.description?.[locale]??t('unknownDetails'),156,80,width-180,4);const lines=[`${t(item.blessing??'bucUnknown')} · ${t('weight')} ${item.weight}`,...(['weapon','armor','accessory','tool'].includes(item.category)?[`${t('durability')} ${item.durability}/6 · ${t('enchantment')} ${item.enchantment??'?'}`]:[]),...(['weapon','armor','accessory'].includes(item.category)?[`${t('damage')} ${item.damage??'?'} / ${t('armor')} ${item.armor??'?'}`]:[]),...(item.category==='wand'?[`${t('charges')} ${item.charges??'?'}`]:[]),...(item.freshness?[t(item.freshness)]:[]),`${t('note')}: ${item.note}`];lines.forEach((line,i)=>p.text(line,24,200+i*26,width-48,13));p.button('inspect:back',t('back'),{x:24,y:height-70,width:width-48,height:40},()=>this.closeInspection());}
 dispose(){this.cancelEdit();}
}



