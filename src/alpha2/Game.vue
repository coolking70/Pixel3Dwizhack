<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { type Command } from '../core/types';
import type {Item2View,ItemAction,Journal2View,Words} from '../core/alpha2-types';
import { GameSession, MAX_BYTES, type SubmitResult } from '../session/session';
import { KEY_COMMANDS } from '../ui/input';
import type { Locale } from '../ui/i18n';
import { GamepadInput } from '../interaction/gamepad';
import {worldPointerIntent} from '../interaction/world-pointer';
import { IntentExecutor } from '../interaction/intent';
import { FocusInputGate } from '../interaction/focus';
import { PickupSequence } from '../interaction/pickup';
import type { ActionResult, LadderEdge } from '../interaction/ux-types';
import type { PublicActionOffer, PublicTargetOffer, TargetRef } from '../core/action-types';
import { MotionInput } from '../room/held';
import { parseRig } from '../character-lab/assets';
import { RoomRenderer } from '../room/renderer';
import { BattleAudio } from '../room/audio';
import type {AdventureKey} from '../adventure/i18n';
import {alpha2Text} from './i18n';
import {alpha5Text} from './alpha5-i18n';
import type {JumpTarget5} from '../core/alpha5-types';
import Inventory from './Inventory.vue';
import { NativeGameUI } from '../game-ui/native-ui';
import type { NativePanel } from '../game-ui/menus';
import Features from './Features.vue';
import type {Loadout} from '../core/alpha-types';
const scenario = location.pathname.endsWith('/alpha6.html') ? 'alpha6' : location.pathname.endsWith('/alpha5.html') ? 'alpha5' : location.pathname.endsWith('/alpha4.html') ? 'alpha4' : location.pathname.endsWith('/alpha3.html') ? 'alpha3' : 'alpha2';
const directMode = !['legacy','buttons'].includes(new URLSearchParams(location.search).get('ui') ?? '');
const nativeMode = new URLSearchParams(location.search).get('ui') !== 'legacy';

let nativeUI: NativeGameUI | undefined;
const loadout=ref<Loadout>('vanguard');
const SAVE=scenario==='alpha6'?'dungeon-descent.m35':scenario==='alpha5'?'dungeon-descent.m31':scenario==='alpha4'?'dungeon-descent.m26':scenario==='alpha3'?'dungeon-descent.m25':'dungeon-descent.m15';
let session = new GameSession(24681, scenario), renderer: RoomRenderer | undefined, importToken = 0;
const view = ref(session.view()), locale = ref<Locale>('zh'), notice = ref<AdventureKey>('ready');
const canvas = ref<HTMLCanvasElement>(), modal = ref<HTMLDialogElement>(), file = ref<HTMLInputElement>();
const status = ref<'loading' | 'ready' | 'error'>('loading'), busy = ref(false), paused = ref(false);
const focusGate = new FocusInputGate(), focused = ref(true);
const panelHistory:NativePanel[]=[];
const panel = ref<NativePanel | null>('newRun'), seed = ref('24681'), seedError = ref(false);
const replayAt = ref<number | null>(null), length = ref(0), sound = ref(false), volume = ref(.25), low = ref(false), textured = ref(true);
const audio = new BattleAudio(), controller = new AbortController();
const t=(key:string,values?:Record<string,string|number>)=>((scenario==='alpha5'||scenario==='alpha6')?alpha5Text:alpha2Text)(locale.value,key,values);
const words=(value?:Words)=>value?.[locale.value]??'';
const a2=computed(()=>view.value.alpha2!);
const search=ref(''),pending=ref<{id:number;action:ItemAction;target:string}|null>(null);
const book=computed(()=>[...a2.value.codex.items,...a2.value.codex.monsters,...a2.value.codex.facilities].filter(i=>words(i.name).toLocaleLowerCase().includes(search.value.toLocaleLowerCase())));
const exp = computed(() => view.value.expedition!);
const blocked = computed(() => status.value !== 'ready' || paused.value || directMode && !focused.value || replayAt.value !== null || view.value.status !== 'playing');
const actionBlocked = computed(() => blocked.value || busy.value);
const state = computed<AdventureKey>(() => replayAt.value !== null ? 'replaying' : paused.value ? 'paused' : view.value.status !== 'playing' ? view.value.status : busy.value ? 'busy' : 'frozen');
const threats = computed(() => view.value.enemies.filter(e => e.intent));
function targetsFor(action:ItemAction){return a2.value.targets.filter(target=>action==='drink'||action==='eat'?target.kind==='self':action==='throw'?['enemy','facility'].includes(target.kind):action==='read'?['self','item'].includes(target.kind):action==='apply'?target.kind!=='enemy':target.kind!=='item');}
function chooseAction(item:Item2View,action:ItemAction){if(action==='equip'){one(`wear:${item.id}`);return;}pending.value={id:item.id,action,target:targetsFor(action)[0]?.key??'self'};}
function usePending(){if(!pending.value)return;const {id,action,target}=pending.value;one(`a2:use:${id}:${action}:${target}`);if(!a2.value.bag.some(i=>i.id===id))pending.value=null;}
function note(item:Item2View,event:Event){one(`a2:note:${item.id}:${encodeURIComponent((event.target as HTMLInputElement).value)}`);}
function fact(event:Journal2View){return t(`log.${event.key}`,{name:words(event.name),target:words(event.target),amount:event.amount??0});}
function submit(command: Command): SubmitResult {
  if (actionBlocked.value || panel.value && !['bag','facilities'].includes(panel.value)) return { accepted: false, reason: 'blocked' };
  const before = session.view(), result = session.submit(command);
  if (result.accepted) {
    const after=session.view();if(after.alpha5&&!command.startsWith('a2:note:')){const source=before.alpha2?.bag.find(i=>i.id===Number(command.split(':')[2]??command.split(':')[1]));nativeUI?.showReceipt(JSON.stringify(before.alpha2?.journal.at(-1))===JSON.stringify(after.alpha2?.journal.at(-1))?(source?.name??{zh:alpha5Text('zh','execute'),en:alpha5Text('en','execute')}):null);}
    importToken++; view.value = session.view(); length.value = session.length; notice.value = result.interrupt ? 'stopped' : 'ready';
    if(before.tick===view.value.tick){renderer!.sync(view.value);busy.value=false;}else{busy.value = true; if(view.value.alpha5)nativeUpdate();renderer!.play(before, view.value, command); audio.play(view.value.beats ?? [], renderer!.duration);}
    if (view.value.status !== 'playing') closePanel();
  } else notice.value = result.reason;
  return result;
}
const held = new MotionInput(submit, () => busy.value);
let selectedSource: number | null = null, selectedAction: string | null = null, contextTarget: TargetRef | null = null;
  let selectedAim: TargetRef | null = null;
const intent = new IntentExecutor({view:()=>view.value,submit,busy:()=>actionBlocked.value||!!panel.value,context:target=>nativeUI?.openContext(target),offers:target=>session.queryContextOffers(target),feedback:reason=>nativeUI?.showHint(reason)});
const pickups = new PickupSequence({view:()=>view.value,submit,busy:()=>actionBlocked.value||!!panel.value,offers:target=>session.queryContextOffers(target)});
let padFrame=0;
const gamepad=new GamepadInput({down:(key,code)=>keydown(new KeyboardEvent('keydown',{key:key==='TabBack'?'Tab':key,code,shiftKey:key==='TabBack',cancelable:true})),up:(key,code)=>keyup(new KeyboardEvent('keyup',{key,code}))});
function pollPad(){
    if(directMode&&focused.value&&!document.hidden){const pad=[...(navigator.getGamepads?.()??[])].find(p=>p?.connected);gamepad.sample(pad??undefined,!nativeUI?.targeting&&(!!panel.value||!!nativeUI?.coversWorld||!!nativeUI?.worldChoicesOpen));}
  if(directMode)padFrame=requestAnimationFrame(pollPad);
}
let jumpChoice:JumpTarget5|null=null;
function cancelJump(){jumpChoice=null;renderer?.setJumpPreview(null);nativeUI?.showJumpTarget(null);}
function showJump(target:JumpTarget5|null){renderer?.setJumpPreview(target);nativeUI?.showJumpTarget(target);}
function beginJump(){
  if(!view.value.alpha5||actionBlocked.value||panel.value||nativeUI?.coversWorld||nativeUI?.worldChoicesOpen)return;
  pickups.cancel();intent.cancel();held.stop();
  const targets=session.queryJumpTargets(),face=view.value.player.face;
  jumpChoice=targets.find(t=>t.status==='enabled'&&t.position.x===view.value.player.x+face*2)??targets.find(t=>t.status==='enabled')??targets[0]??null;showJump(jumpChoice);
}
function commitJump(target:JumpTarget5){
  const current=session.queryJumpTargets().find(t=>t.command===target.command&&t.revision===target.revision&&t.status==='enabled');
  if(!current||actionBlocked.value||panel.value){nativeUI?.showHint(target.reason?'jump.'+target.reason:'intent.stale');return;}
  cancelJump();pickups.cancel();intent.cancel();held.stop();submit(current.command);
}
function jumpKey(event:KeyboardEvent):boolean{
  if(!jumpChoice)return false;
  if(event.key==='Escape'){event.preventDefault();cancelJump();return true;}
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();if(!event.repeat){const targets=session.queryJumpTargets(),at=targets.findIndex(t=>t.command===jumpChoice!.command),delta=event.key==='ArrowLeft'?-1:1;jumpChoice=targets[(at+delta+targets.length)%targets.length]??null;showJump(jumpChoice);}return true;
  }
  if(event.key==='Enter'){event.preventDefault();if(!event.repeat)commitJump(jumpChoice);return true;}
  if(event.key.toLowerCase()==='j'){event.preventDefault();return true;}
  cancelJump();return false;
}
function lifecycleCancel(){settle();}
function worldClick(x:number,y:number):void {
  pickups.cancel(); intent.cancel(); held.stop();
  if(!directMode||actionBlocked.value)return;
  const candidates=renderer?.hitCandidates(x,y),hit=candidates?.hits[0];
  if(!candidates)return;
  if(nativeUI?.targeting){if(!hit)return;if(!nativeUI.selectTarget(hit.ref))nativeUI.selectTarget({type:'world-cell',...hit.position});return;}
  if(panel.value||nativeUI?.coversWorld||nativeUI?.worldChoicesOpen)return;
  const choice=worldPointerIntent(view.value,candidates);if(!choice){cancelJump();return;}
  if(choice.kind==='jump'){showJump(choice.target);commitJump(choice.target);return;}
  cancelJump();
  if(choice.kind==='ladder'){if(choice.edges.length===1)climb(choice.edges[0]!);else nativeUI?.openLadderChoices([...choice.edges]);}
  else if(choice.kind==='pile')nativeUI?.openGroundPile([...choice.ids]);
  else intent.start(choice.kind==='move'?{type:'move-to',target:choice.target}:{type:'activate',target:choice.target});

}
function climb(edge:LadderEdge){pickups.cancel();held.stop();if(!actionBlocked.value&&!panel.value)intent.startClimb(edge);}
function pickupItems(ids:readonly number[]){
  pickups.cancel();intent.cancel();held.stop();
  if(actionBlocked.value||panel.value||!ids.length)return;
  if(ids.length===1)intent.start({type:'activate',target:{type:'world-entity',kind:'ground-item',id:ids[0]!}});
  else pickups.start(ids);
}
function worldLongPress(x:number,y:number){
  if(!directMode||actionBlocked.value||panel.value||nativeUI?.coversWorld||nativeUI?.worldChoicesOpen)return;
  pickups.cancel();intent.cancel();held.stop();
  const candidates=renderer?.hitCandidates(x,y);
  if(candidates?.pile)nativeUI?.openGroundPile([...candidates.pile.itemIds],true);else nativeUI?.showWorldRef(candidates?.hits[0]?.ref??null);
}
function commitOffer(offer:PublicActionOffer|PublicTargetOffer):ActionResult {
  const result=(accepted:boolean,publicReason?:string,interrupt?:boolean):ActionResult=>({accepted,revision:session.view().revision,bag:session.view().alpha2!.bag,publicReason,interrupt});
  if(actionBlocked.value||offer.revision!==view.value.revision||offer.status==='disabled'||!offer.command)return result(false,'interaction.unavailable');
  const current = selectedSource!==null ? ('ref' in offer && selectedAction ? session.queryTargets(selectedSource,selectedAction) : session.queryActionOffers(selectedSource)) : contextTarget ? session.queryContextOffers(contextTarget) : [];
  const valid=current.some(o=>o.revision===offer.revision&&o.status!=='disabled'&&o.command===offer.command&&('ref' in offer ? 'ref' in o&&JSON.stringify(o.ref)===JSON.stringify(offer.ref) : 'actionId' in o&&o.actionId===offer.actionId));
  if(!valid)return result(false,'interaction.unavailable');
  pickups.cancel();intent.cancel();held.stop();const outcome=submit(offer.command);
  return outcome.accepted?result(true,undefined,outcome.interrupt):result(false,outcome.reason==='bagFull'?'interaction.bagFull':'interaction.unavailable');
}

function settle(): void { cancelJump();gamepad.cancel();pickups.cancel();intent.cancel(); nativeUI?.cancelInput(); held.stop(); audio.stop(); renderer?.settle(); busy.value = false; }
function one(command: Command): void { cancelJump();pickups.cancel();intent.cancel(); held.stop(); submit(command); }
function blur(): void { settle(); if(directMode){focusGate.blur();focused.value=false;}else paused.value = true; }
function focus():void { if(directMode){focusGate.focus();focused.value=true;} }
function focusPointer(event:PointerEvent):void {if(directMode&&event.isPrimary&&event.button===0&&!focusGate.pointerDown()){event.preventDefault();event.stopImmediatePropagation();focused.value=true;canvas.value?.focus();}}
function padDisconnected():void {if(directMode)settle();}
function visibility(): void { if (document.hidden) blur(); }
function togglePause(): void { settle(); paused.value = !paused.value; }
async function openPanel(value: NonNullable<typeof panel.value>): Promise<void> { settle(); if(view.value.alpha5&&panel.value&&panel.value!==value&&panel.value!=='newRun')panelHistory.push(panel.value);panel.value = value; await nextTick(); if (nativeMode) { nativeUpdate(); canvas.value?.focus(); return; } if (!modal.value?.open) modal.value?.showModal(); }
function backPanel():void{const previous=panelHistory.pop();if(previous){nativeUI?.cancelInput();panel.value=previous;nativeUpdate();}else closePanel();}
function closePanel(): void { panelHistory.length=0; nativeUI?.cancelInput(); modal.value?.close(); panel.value = null; pending.value=null; nativeUpdate(); if(nativeMode) canvas.value?.focus(); }
function pointer(event: PointerEvent, command: Command): void {
  if (!event.isPrimary || event.button !== 0 || blocked.value || panel.value) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  if (command === 'left' || command === 'right') held.start(`pointer:${event.pointerId}`, command); else one(command);
}
function keydown(event: KeyboardEvent): void {
  if(directMode&&!focusGate.keyDown(event.repeat))return;
  if(!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&jumpKey(event))return;
  if(view.value.alpha5&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!panel.value&&!nativeUI?.targeting&&!nativeUI?.coversWorld&&!nativeUI?.worldChoicesOpen&&(event.key.toLowerCase()==='j'||event.code==='Gamepad:Enter')){event.preventDefault();if(!event.repeat)beginJump();return;}
  if (nativeMode && nativeUI?.keydown(event)) return;
  if (event.key === 'Escape') { event.preventDefault(); if (panel.value) closePanel(); else if(directMode)void openPanel('menu');else togglePause(); return; }
  if ((event.target as HTMLElement)?.closest('input,select,button,a,[contenteditable=true]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'b' || key === 'h') { event.preventDefault(); if (panel.value) closePanel(); else void openPanel(key === 'b' ? 'bag' : 'help'); return; }
  if (panel.value) return;
  const command = key === 'r' ? 'cast' : key==='x'?'a2:search':KEY_COMMANDS[key]; if (!command) return; event.preventDefault(); if (event.repeat) return;
  pickups.cancel();if(directMode&&['left','right','up','down'].includes(command))intent.direction(event.code,command as 'left'|'right'|'up'|'down');else if (command === 'left' || command === 'right') held.start(event.code, command); else one(command);
}
function keyup(event: KeyboardEvent): void { intent.release(event.code); held.release(event.code); }
function sync(): void { view.value = session.view(); length.value = session.length; renderer?.sync(view.value); }
function reset(): void {
  const value = Number(seed.value); if (!/^\d+$/.test(seed.value) || !Number.isInteger(value) || value < 1 || value > 0xffffffff) { seedError.value = true; return; }
  settle(); nativeUI?.resetNavigation(); importToken++; session = new GameSession(value, scenario); session.submit(`choose:${loadout.value}`); replayAt.value = null; paused.value = false; seedError.value = false; notice.value = 'ready'; closePanel(); sync();
}
function randomSeed(): void { seed.value = String(crypto.getRandomValues(new Uint32Array(1))[0] || 1); seedError.value = false; }
function save(): void { settle(); try { localStorage.setItem(SAVE, session.capture()); notice.value = 'savedRoom'; } catch { notice.value = 'storageError'; } }
function restore(raw: string): void { session.restore(raw); nativeUI?.resetNavigation(); importToken++; replayAt.value = null; paused.value = false; seed.value = String(session.view().seed); closePanel(); sync(); notice.value = 'loadedRoom'; }
function load(): void { settle(); importToken++; try { const raw = localStorage.getItem(SAVE); if (!raw) { notice.value = 'noSave'; return; } restore(raw); } catch { notice.value = 'invalidArchive'; } }
function exportSave(): void {
  settle(); const url = URL.createObjectURL(new Blob([session.capture()], { type: 'application/json' })); const a = document.createElement('a');
  a.href = url; a.download = `fallen-star-${scenario}-${session.view().seed}-${session.length}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice.value = 'exported';
}
async function importSave(event: Event): Promise<void> {
  settle(); const input = event.target as HTMLInputElement, selected = input.files?.[0]; input.value = ''; if (!selected) return;
  const token = ++importToken;
  try { if (selected.size > MAX_BYTES) throw new Error('budget'); const raw = await selected.text(); if (token !== importToken || controller.signal.aborted) return; restore(raw); }
  catch { if (token === importToken) notice.value = 'invalidArchive'; }
}
function replay(): void { settle(); nativeUI?.resetNavigation(); importToken++; if (replayAt.value !== null) { replayAt.value = null; sync(); } else { replayAt.value = session.length; seek(); } }
function seek(): void { settle(); nativeUI?.resetNavigation(); view.value = session.replay(replayAt.value!); renderer?.sync(view.value); }
function graphicsFailure(): void { settle(); status.value = 'error'; }
async function toggleAudio(): Promise<void> { try { await audio.enable(sound.value); } catch { sound.value = false; await audio.enable(false); notice.value = 'audioError'; } }
function nativeUpdate() { nativeUI?.update(view.value, locale.value, {direct:directMode,bag:panel.value==='bag',notice:t(notice.value),state:t(state.value),blocked:actionBlocked.value,readOnly:status.value!=='ready'||replayAt.value!==null||view.value.status!=='playing'||!directMode&&paused.value,busy:busy.value,panel:panel.value,seed:seed.value,loadout:loadout.value,seedError:seedError.value,length:length.value,replayAt:replayAt.value,sound:sound.value,volume:volume.value,low:low.value,textured:textured.value,ready:status.value==='ready'}); }
watch([view,locale,notice,state,actionBlocked,panel,seed,loadout,seedError,length,replayAt,sound,volume,low,textured,status], nativeUpdate);
watch(volume, value => audio.setVolume(value)); watch(low, value => renderer?.setQuality(value)); watch(textured, value => renderer?.setTexture(value));
watch(locale, value => { document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'; document.title = t('title'); });
onMounted(async () => {
  window.addEventListener('focus',focus);window.addEventListener('pointerdown',focusPointer,true);window.addEventListener('gamepaddisconnected',padDisconnected);window.addEventListener('resize',lifecycleCancel);canvas.value?.addEventListener('pointercancel',lifecycleCancel);if(directMode)padFrame=requestAnimationFrame(pollPad);
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
  if(!nativeMode) modal.value?.showModal();
  try {
    const response = await fetch('./assets/character-study/motions.json', { signal: controller.signal }); if (!response.ok) throw new Error('asset');
    const raw = await response.text(); if (raw.length > 500_000) throw new Error('budget'); const rig = parseRig(JSON.parse(raw)); if (controller.signal.aborted) return;
    renderer = new RoomRenderer(canvas.value!, rig, view.value, () => { busy.value = false; if(directMode){if(pickups.active)pickups.completed();else intent.completed();}else held.completed(); }, graphicsFailure, () => { pickups.cancel();intent.cancel();held.stop(); busy.value=false;status.value='ready';nativeUpdate(); }); status.value = 'ready';
    if(nativeMode) { nativeUI = new NativeGameUI(canvas.value!,rig,{
      queryActions:id=>replayAt.value===null?session.queryActionOffers(id):[],
      queryTargets:(id,action)=>replayAt.value===null?session.queryTargets(id,action):[],
      queryContext:target=>{contextTarget=target;return replayAt.value===null?session.queryContextOffers(target):[];},
      targetSelected:target=>{selectedAim=target?.ref??null;renderer?.setAim(selectedAim);},
      selectionChanged:(id,action)=>{selectedSource=id;selectedAction=action;},commit:commitOffer,
      worldScreenPoint:ref=>renderer?.worldScreenPoint(ref)??null,groundSelected:id=>renderer?.setGroundHover(id),worldClick,worldLongPress,pickupItems,climb,worldMove:(x,y)=>{const candidates=renderer?.hitCandidates(x,y),hit=candidates?.hits[0];if(!jumpChoice&&!nativeUI?.targeting){const choice=candidates?worldPointerIntent(view.value,candidates):null;showJump(choice?.kind==='jump'?choice.target:null);}if(nativeUI?.targeting&&!selectedAim)renderer?.setAim(hit?.ref??null,false);else if(!nativeUI?.targeting){const id=hit?.ref.type==='world-entity'&&hit.ref.kind==='ground-item'?hit.ref.id:null;renderer?.setGroundHover(id);if(id!==null||candidates?.pile)nativeUI?.showWorldHint(id!==null?[id,...(candidates?.pile?.itemIds??[]).filter(other=>other!==id)]:[...candidates!.pile!.itemIds]);else nativeUI?.showWorldRef(hit?.ref??null);}},worldCancel:()=>{cancelJump();pickups.cancel();intent.cancel();},targetsChanged:targets=>{selectedAim=null;renderer?.setTargets([...targets]);},openContext:target=>nativeUI?.openContext(target),
      open:value=>void openPanel(value),close:backPanel,completed:()=>{selectedSource=null;selectedAction=null;contextTarget=null;selectedAim=null;renderer?.setTargets([]);renderer?.setAim(null,false);closePanel();},hudObstacles:()=>renderer?.hudObstacles()??[],start:reset,seed:value=>{seed.value=value;seedError.value=false;},loadout:value=>{loadout.value=value;},random:randomSeed,import:()=>{settle();file.value?.click();},export:exportSave,replay,seek:at=>{replayAt.value=at;seek();},option:(name,value)=>{settle();if(name==='sound'){sound.value=!!value;void toggleAudio();}else if(name==='volume')volume.value=Number(value);else if(name==='low')low.value=!!value;else textured.value=!!value;},command:one,openBag:()=>void openPanel('bag'),closeBag:backPanel,pause:()=>{if(directMode)void openPanel('menu');else togglePause();},locale:()=>{locale.value=locale.value==='zh'?'en':'zh';},save,load,invalidate:()=>renderer?.invalidate(),stop:settle,hold:command=>{if(!blocked.value&&!panel.value){if(directMode)intent.direction('native-pointer',command);else held.start('native-pointer',command);}},release:()=>{intent.release('native-pointer');held.release('native-pointer');}}); renderer.setOverlay(nativeUI); nativeUpdate(); }
  } catch { if (!controller.signal.aborted) graphicsFailure(); }
});
onBeforeUnmount(() => { controller.abort(); importToken++; cancelAnimationFrame(padFrame);gamepad.cancel();window.removeEventListener('focus',focus);window.removeEventListener('pointerdown',focusPointer,true);window.removeEventListener('gamepaddisconnected',padDisconnected);window.removeEventListener('resize',lifecycleCancel);canvas.value?.removeEventListener('pointercancel',lifecycleCancel);intent.cancel();held.stop(); renderer?.dispose(); audio.dispose(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); });
</script>

<template><main class="adventure alpha alpha2" :class="{'native-game':nativeMode}">
<header><div><p class="eyebrow">{{t('subtitle')}}</p><h1>{{t('title')}}</h1></div><nav><button @click="openPanel('codex')">{{t('codex')}}</button><button @click="openPanel('help')">{{t('help')}}</button><button @click="openPanel('settings')">{{t('settings')}}</button><button @click="settle();locale=locale==='zh'?'en':'zh'">{{locale==='zh'?'EN':'中文'}}</button></nav></header>
<p class="objective">{{t('objective')}}</p><div class="route"><span v-for="(row,i) in view.explored" :key="i" :class="{current:i===view.player.floor}">{{i+1}} · {{row.length?t(view.map.rooms![i]!):t('unexplored')}}</span><b>{{t(view.player.relic?'relicHeld':'relicGoal')}}</b></div>
<div class="hud"><span :class="{critical:view.player.hp<25}">{{t('hp')}} <b data-testid="hp">{{view.player.hp}} / {{view.player.maxHp}}</b></span><span>{{t('damage')}} <b>{{view.gear!.damage}}</b></span><span>{{t('armor')}} <b>{{view.gear!.armor}}</b></span><span>{{t('mana')}} <b data-testid="mana">{{a2.mana}} / {{a2.maxMana}}</b></span><span>{{t('food')}} <b data-testid="food">{{a2.food}} / {{a2.maxFood}}</b></span><span>{{t('gold')}} <b>{{view.player.gold}}</b></span><span>{{t('tick')}} <b data-testid="tick">{{view.tick}}</b></span></div>
<div class="layout"><section class="play"><div v-if="threats.length" class="danger" role="alert"><p v-for="e in threats" :key="e.id">{{words(a2.monsters.find(m=>m.enemy===e.id)?.name)}} · {{t('intent',{x:e.intent!.x,ticks:e.nextAt-view.tick})}}</p></div>
<div class="viewport" :class="{blind:a2.conditions.some(c=>c.kind==='blind'),poisoned:a2.conditions.some(c=>c.kind==='poison')}"><div class="viewport-bar"><span role="status" :data-state="status">{{status==='ready'?t(state):t(status==='error'?'graphicsError':'loading')}}</span><span data-testid="position">{{t('floorLabel',{floor:view.player.floor+1})}} · {{view.player.x}}</span></div><canvas ref="canvas" tabindex="0" :aria-label="t('scene')"></canvas></div>
<section class="conditions"><span v-if="!a2.conditions.length">{{t('noEffects')}}</span><span v-for="effect in a2.conditions" :key="effect.kind" :class="effect.kind" :title="`${t('source')}: ${words(effect.source)}`">{{t(effect.kind)}} · {{effect.until-view.tick}} tick · {{words(effect.source)}}</span><small v-for="(r,i) in a2.resists" :key="i">{{t(r.element==='poison'?'poisonElement':r.element)}} {{t('immuneTo')}} · {{words(r.source)}}</small></section>
<div class="controls"><div class="dpad"><button v-for="command in ['left','up','down','right'] as const" :key="command" :data-command="command" :disabled="blocked" :aria-label="t(command)" @pointerdown="pointer($event,command)" @pointerup="held.release(`pointer:${$event.pointerId}`)" @pointercancel="held.stop()" @lostpointercapture="held.stop()" @click="($event.detail===0)&&one(command)">{{{left:'←',right:'→',up:'↑',down:'↓'}[command]}}</button></div><div class="actions"><button v-for="command in ['attack','interact','potion','wait'] as const" :key="command" :data-command="command" :disabled="actionBlocked" @click="one(command)">{{t(command)}}<span v-if="command==='attack'"> · {{a2.attackCost}}</span></button><button data-command="cast" :disabled="actionBlocked||!a2.bag.some(i=>i.equipped==='mainHand'&&i.definition==='staff')||a2.mana<3" @click="one('cast')">{{t('cast')}}</button><button data-command="a2:search" :disabled="actionBlocked" :title="t('searchHint')" @click="one('a2:search')">{{t('search')}}</button><button class="primary" @click="openPanel('bag')">{{t('bag')}} {{a2.bag.length}}/{{a2.capacity}}</button></div></div>
<p class="hint">{{t(view.player.relic?'relicHint':'routeHint')}}</p><p v-if="view.revision<8" class="onboarding">{{t('onboarding')}}</p>
<div class="toolbar"><button @click="togglePause">{{t(paused?'resume':'pause')}}</button><button @click="save">{{t('save')}}</button><button @click="load">{{t('load')}}</button><button @click="exportSave">{{t('export')}}</button><button @click="settle();file?.click()">{{t('import')}}</button><button @click="replay">{{t(replayAt===null?'replay':'live')}}</button><button @click="openPanel('newRun')">{{t('newRun')}}</button><input ref="file" data-testid="import-file" type="file" accept=".json,application/json" hidden @change="importSave"/></div>
<label v-if="replayAt!==null" class="replay">{{t('position')}} {{replayAt}} / {{length}}<input v-model.number="replayAt" :aria-label="t('position')" type="range" min="0" :max="length" step="1" @input="seek"/></label><p class="notice" aria-live="polite">{{t(notice)}}</p>
<section v-if="view.status!=='playing'" class="card result" data-testid="result"><h2>{{t(view.status)}}</h2><p>{{t('seed')}} {{view.seed}} · {{t('tick')}} {{view.tick}} · {{t('actions')}} {{replayAt??length}}</p><p>{{t('kills')}} {{exp.kills}} · {{t('known')}} {{a2.knownCount}}</p><button @click="openPanel('newRun')">{{t('newRun')}}</button></section>
</section><aside><Features :view="view" :locale="locale" :disabled="actionBlocked||!!panel" @command="one"/>
<section class="card"><h2>{{t('nearby')}}</h2><p v-if="!a2.nearby.length">{{t('nothing')}}</p><div v-for="item in a2.nearby" :key="item.id" class="near-item"><b>{{words(item.name)}}</b><small v-if="item.freshness">{{t(item.freshness)}}</small><button :data-take="item.id" :disabled="actionBlocked" @click="one(`take:${item.id}`)">{{t('take')}}</button></div><button v-if="view.loot.some(l=>l.kind==='relic'&&Math.abs(l.x-view.player.x)<=1)" :disabled="actionBlocked||!exp.bossDefeated" @click="one('interact')">{{t('relicTake')}}</button></section>
<section class="card enemies"><h2>{{t('threat')}}</h2><p v-if="!view.enemies.length">{{t('quiet')}}</p><div v-for="enemy in view.enemies" :key="enemy.id" :data-enemy="enemy.id"><b>{{words(a2.monsters.find(m=>m.enemy===enemy.id)?.name)}} · {{enemy.hp}}/{{enemy.maxHp}}</b><small>{{words(a2.monsters.find(m=>m.enemy===enemy.id)?.description)}}</small><small v-for="c in a2.monsters.find(m=>m.enemy===enemy.id)!.conditions" :key="c.kind">{{t(c.kind)}} · {{c.until-view.tick}} tick</small></div></section>
<section class="card journal"><h2>{{t('journal')}}</h2><ol><li v-for="(event,i) in [...a2.journal].reverse().slice(0,7)" :key="i">{{fact(event)}}</li></ol></section></aside></div>
<footer>{{t('idleNote')}} <a href="./alpha.html">M10 Alpha</a> · <a href="./combat-lab.html">{{t('combatLab')}}</a></footer>
<dialog ref="modal" :aria-label="panel?t(panel):t('help')" @cancel.prevent="closePanel"><template v-if="panel"><div class="dialog-heading"><h2>{{t(panel)}}</h2><button @click="closePanel">{{t('close')}}</button></div>
<template v-if="panel==='newRun'"><h3>{{t('welcome')}}</h3><p>{{t('intro')}}</p><p>{{t('objective')}}</p><form @submit.prevent="reset"><label>{{t('loadout')}}<select v-model="loadout" :aria-label="t('loadout')"><option v-for="v in ['vanguard','breaker','channeler'] as const" :key="v" :value="v">{{t(v)}}</option></select></label><p class="loadout-detail">{{t(`${loadout}Detail`)}}</p><label>{{t('seed')}}<input v-model="seed" inputmode="numeric" data-testid="seed"/></label><button type="button" @click="randomSeed">{{t('random')}}</button><p v-if="seedError" role="alert">{{t('seedError')}}</p><p v-if="length">{{t('confirmNew')}}</p><button class="primary" type="submit" :disabled="status!=='ready'">{{t('start')}}</button></form><p v-if="status!=='ready'" role="status">{{t(status==='error'?'graphicsError':'loading')}}</p><p>{{t('helpMove')}}</p><div class="toolbar"><button @click="load">{{t('load')}}</button><button @click="file?.click()">{{t('import')}}</button><button @click="locale=locale==='zh'?'en':'zh'">{{locale==='zh'?'EN':'中文'}}</button></div></template>
<template v-else-if="panel==='bag'"><p>{{t('bagHint')}}</p><p>{{a2.bag.length}}/{{a2.capacity}} · {{t('hp')}} {{view.player.hp}}/{{view.player.maxHp}} · {{t('tick')}} {{view.tick}} · <span :title="t('weightHint')">{{t('weight')}} {{a2.weight}}</span></p><fieldset v-if="pending" class="target-picker"><legend>{{t(pending.action)}} · {{words(a2.bag.find(i=>i.id===pending!.id)?.name)}}</legend><label>{{t('target')}}<select v-model="pending.target" :aria-label="t('target')"><option v-for="target in targetsFor(pending.action)" :key="target.key" :value="target.key">{{words(target.name)}}</option></select></label><button class="primary" :disabled="actionBlocked" @click="usePending">{{t('execute')}}</button><button @click="pending=null">{{t('cancelUse')}}</button></fieldset><Inventory :costs="a2.actionCosts" :items="a2.bag" :locale="locale" :disabled="actionBlocked" @command="one" @action="chooseAction" @note="note"/></template>
<template v-else-if="panel==='codex'"><p>{{t('known')}} {{a2.knownCount}} · {{t('codex')}}</p><label>{{t('searchBook')}}<input v-model="search" type="search" :aria-label="t('searchBook')"/></label><p v-if="!book.length">{{t('emptyBook')}}</p><article v-for="entry in book" :key="entry.id" class="codex-entry"><b>{{words(entry.name)}}</b><p>{{words(entry.description)}}</p></article></template>
<template v-else-if="panel==='help'"><p>{{t('helpMove')}}</p><p>{{t('helpCombat')}}</p><p>{{t('helpItems')}}</p><p>{{t('helpRoutes')}}</p><p>{{t('helpSave')}}</p></template>
<template v-else-if="panel==='settings'"><label><input v-model="sound" type="checkbox" @change="toggleAudio"/>{{t('audio')}}</label><label>{{t('volume')}}<input v-model.number="volume" type="range" min="0" max="1" step=".05"/></label><label><input v-model="low" type="checkbox"/>{{t('low')}}</label><label><input v-model="textured" type="checkbox"/>{{t('texture')}}</label></template>
<p class="notice" aria-live="polite">{{t(notice)}}</p></template></dialog>
</main></template>






