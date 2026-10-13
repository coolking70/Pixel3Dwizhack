<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { SLOTS, type Command, type Fact } from '../core/types';
import type { ItemView } from '../core/expedition-types';
import { GameSession, MAX_BYTES, type SubmitResult } from '../session/session';
import { KEY_COMMANDS } from '../ui/input';
import type { Locale } from '../ui/i18n';
import { MotionInput } from '../room/held';
import { parseRig } from '../character-lab/assets';
import { RoomRenderer } from '../room/renderer';
import { BattleAudio } from '../room/audio';
import { adventureText, type AdventureKey } from './i18n';
import AlphaFeatures from '../alpha/Features.vue';
import {alphaText,type AlphaKey} from '../alpha/i18n';
import type {Loadout} from '../core/alpha-types';
const props=withDefaults(defineProps<{alpha?:boolean}>(),{alpha:false});
const scenario=props.alpha?'alpha':'expedition';
const loadout=ref<Loadout>('vanguard');
const SAVE = props.alpha ? 'dungeon-descent.m10' : 'dungeon-descent.m06';
let session = new GameSession(24681, scenario), renderer: RoomRenderer | undefined, importToken = 0;
const view = ref(session.view()), locale = ref<Locale>('zh'), notice = ref<AdventureKey>('ready');
const canvas = ref<HTMLCanvasElement>(), modal = ref<HTMLDialogElement>(), file = ref<HTMLInputElement>();
const status = ref<'loading' | 'ready' | 'error'>('loading'), busy = ref(false), paused = ref(false);
const panel = ref<'newRun' | 'bag' | 'help' | 'settings' | null>('newRun'), seed = ref('24681'), seedError = ref(false);
const replayAt = ref<number | null>(null), length = ref(0), sound = ref(false), volume = ref(.25), low = ref(false), textured = ref(true);
const audio = new BattleAudio(), controller = new AbortController();
const t = (key: AlphaKey, values?: Record<string, string | number>): string => props.alpha ? alphaText(locale.value,key,values) : adventureText(locale.value,key as AdventureKey,values);
const exp = computed(() => view.value.expedition!);
const blocked = computed(() => status.value !== 'ready' || paused.value || replayAt.value !== null || view.value.status !== 'playing');
const actionBlocked = computed(() => blocked.value || busy.value);
const state = computed<AdventureKey>(() => replayAt.value !== null ? 'replaying' : paused.value ? 'paused' : view.value.status !== 'playing' ? view.value.status : busy.value ? 'busy' : 'frozen');
const threats = computed(() => view.value.enemies.filter(e => e.intent));
const shrine = computed(() => exp.value.shrines.some(s => !s.used && Math.abs(s.x - view.value.player.x) <= 1));
const hasScroll = computed(() => exp.value.bag.some(i => i.kind === 'scroll'));
function itemName(item: ItemView): string {
  if (item.gear) return `${t(item.gear)}${item.quality ? ` +${item.quality}` : ''}`;
  if (item.kind === 'flask') return `${t(item.effect ?? 'unknown')} · ${t(`flask${item.appearance}` as AdventureKey)}`;
  return t(item.kind === 'scroll' ? 'scroll' : 'relic');
}
function detail(item: ItemView): string {
  if (!item.gear) return t(item.kind === 'scroll' ? 'scrollDetail' : item.effect ? `${item.effect}Detail` : 'unknownDetail');
  const slot = view.value.gear!.catalog.find(g => g.id === item.gear)!.slot, old = exp.value.bag.find(i => i.equipped === slot);
  const timing=props.alpha&&slot==='mainHand' ? ' · '+(item.gear==='wand'?t('wandHint'):t('gearTiming',{ticks:item.gear==='mace'?20:10,pierce:item.gear==='mace'?4:0})) : '';
  return `${t('damage')} ${item.damage} / ${t('armor')} ${item.armor} · ${t('compare', { damage: Math.max(1, view.value.gear!.damage + item.damage! - (old?.damage ?? 0)), armor: view.value.gear!.armor + item.armor! - (old?.armor ?? 0) })}${timing}`;
}
function submit(command: Command): SubmitResult {
  if (actionBlocked.value || panel.value && panel.value !== 'bag') return { accepted: false, reason: 'blocked' };
  const before = session.view(), result = session.submit(command);
  if (result.accepted) {
    importToken++; view.value = session.view(); length.value = session.length; notice.value = result.interrupt ? 'stopped' : 'ready';
    busy.value = true; renderer!.play(before, view.value, command); audio.play(view.value.beats ?? [], renderer!.duration);
    if (view.value.status !== 'playing') closePanel();
  } else notice.value = result.reason;
  return result;
}
const held = new MotionInput(submit, () => busy.value);
function settle(): void { held.stop(); audio.stop(); renderer?.settle(); busy.value = false; }
function one(command: Command): void { held.stop(); submit(command); }
function blur(): void { settle(); paused.value = true; }
function visibility(): void { if (document.hidden) blur(); }
function togglePause(): void { settle(); paused.value = !paused.value; }
async function openPanel(value: NonNullable<typeof panel.value>): Promise<void> { settle(); panel.value = value; await nextTick(); if (!modal.value?.open) modal.value?.showModal(); }
function closePanel(): void { modal.value?.close(); panel.value = null; }
function pointer(event: PointerEvent, command: Command): void {
  if (!event.isPrimary || event.button !== 0 || blocked.value || panel.value) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  if (command === 'left' || command === 'right') held.start(`pointer:${event.pointerId}`, command); else one(command);
}
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); if (panel.value) closePanel(); else togglePause(); return; }
  if ((event.target as HTMLElement)?.closest('input,select,button,a,[contenteditable=true]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'b' || key === 'h') { event.preventDefault(); if (panel.value) closePanel(); else void openPanel(key === 'b' ? 'bag' : 'help'); return; }
  if (panel.value) return;
  const command = props.alpha && key === 'r' ? 'cast' : KEY_COMMANDS[key]; if (!command) return; event.preventDefault(); if (event.repeat) return;
  if (command === 'left' || command === 'right') held.start(event.code, command); else one(command);
}
function keyup(event: KeyboardEvent): void { held.release(event.code); }
function sync(): void { view.value = session.view(); length.value = session.length; renderer?.sync(view.value); }
function reset(): void {
  const value = Number(seed.value); if (!/^\d+$/.test(seed.value) || !Number.isInteger(value) || value < 1 || value > 0xffffffff) { seedError.value = true; return; }
  settle(); importToken++; session = new GameSession(value, scenario); if(props.alpha)session.submit(`choose:${loadout.value}`); replayAt.value = null; paused.value = false; seedError.value = false; notice.value = 'ready'; closePanel(); sync();
}
function randomSeed(): void { seed.value = String(crypto.getRandomValues(new Uint32Array(1))[0] || 1); seedError.value = false; }
function save(): void { settle(); try { localStorage.setItem(SAVE, session.capture()); notice.value = 'savedRoom'; } catch { notice.value = 'storageError'; } }
function restore(raw: string): void { session.restore(raw); importToken++; replayAt.value = null; paused.value = false; seed.value = String(session.view().seed); closePanel(); sync(); notice.value = 'loadedRoom'; }
function load(): void { settle(); importToken++; try { const raw = localStorage.getItem(SAVE); if (!raw) { notice.value = 'noSave'; return; } restore(raw); } catch { notice.value = 'invalidArchive'; } }
function exportSave(): void {
  settle(); const url = URL.createObjectURL(new Blob([session.capture()], { type: 'application/json' })); const a = document.createElement('a');
  a.href = url; a.download = `${props.alpha?'fallen-star-alpha':'fallen-star'}-${session.view().seed}-${session.length}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice.value = 'exported';
}
async function importSave(event: Event): Promise<void> {
  settle(); const input = event.target as HTMLInputElement, selected = input.files?.[0]; input.value = ''; if (!selected) return;
  const token = ++importToken;
  try { if (selected.size > MAX_BYTES) throw new Error('budget'); const raw = await selected.text(); if (token !== importToken || controller.signal.aborted) return; restore(raw); }
  catch { if (token === importToken) notice.value = 'invalidArchive'; }
}
function replay(): void { settle(); importToken++; if (replayAt.value !== null) { replayAt.value = null; sync(); } else { replayAt.value = session.length; seek(); } }
function seek(): void { settle(); view.value = session.replay(replayAt.value!); renderer?.sync(view.value); }
function fact(event: Fact): string {
  if(props.alpha&&event.effect&&['doorOpen','doorClosed','leverUsed','cacheOpened'].includes(event.effect))return t(event.effect as AlphaKey);
  if (event.note) return t(`note.${event.note}`, { item: event.effect ? t(event.effect as AdventureKey) : '' });
  if (event.kind === 'start') return t('eventStart'); if (event.kind === 'won') return t('eventWin');
  if (event.kind === 'equip') return `${t(event.amount === 0 ? 'removed' : 'equipped')}${event.gear ? ` · ${t(event.gear)}` : ''}`;
  return t(`event.${event.kind}`, { amount: event.amount ?? 0, item: event.gear ? t(event.gear) : event.item ? t(event.item === 'potion' ? 'potionItem' : event.item) : '' });
}
function graphicsFailure(): void { settle(); status.value = 'error'; }
async function toggleAudio(): Promise<void> { try { await audio.enable(sound.value); } catch { sound.value = false; await audio.enable(false); notice.value = 'audioError'; } }
watch(volume, value => audio.setVolume(value)); watch(low, value => renderer?.setQuality(value)); watch(textured, value => renderer?.setTexture(value));
watch(locale, value => { document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'; document.title = t('title'); });
onMounted(async () => {
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
  modal.value?.showModal();
  try {
    const response = await fetch('./assets/character-study/motions.json', { signal: controller.signal }); if (!response.ok) throw new Error('asset');
    const raw = await response.text(); if (raw.length > 500_000) throw new Error('budget'); const rig = parseRig(JSON.parse(raw)); if (controller.signal.aborted) return;
    renderer = new RoomRenderer(canvas.value!, rig, view.value, () => { busy.value = false; held.completed(); }, graphicsFailure); status.value = 'ready';
  } catch { if (!controller.signal.aborted) graphicsFailure(); }
});
onBeforeUnmount(() => { controller.abort(); importToken++; held.stop(); renderer?.dispose(); audio.dispose(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); });
</script>

<template>
  <main class="adventure" :class="{alpha:props.alpha}">
    <header><div><p class="eyebrow">{{ t('subtitle') }}</p><h1>{{ t('title') }}</h1></div><nav><button @click="openPanel('help')">{{ t('help') }}</button><button @click="openPanel('settings')">{{ t('settings') }}</button><button @click="settle(); locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'EN' : '中文' }}</button></nav></header>
    <p class="objective">{{ t('objective') }}</p>
    <div class="route" :aria-label="t('fullRoute')"><span v-for="(theme, i) in view.map.rooms" :key="i" :class="{ current: i === view.player.floor }">{{ i + 1 }} · {{ t(view.explored[i]!.length ? theme : 'unexplored') }}</span><b>{{ t(view.player.relic ? 'relicHeld' : 'relicGoal') }}</b></div>
    <div class="hud"><span :class="{ critical: view.player.hp <= 20 }">{{ t('hp') }} <b data-testid="hp">{{ view.player.hp }} / {{ view.player.maxHp }}</b></span><span>{{ t('damage') }} <b>{{ view.gear!.damage }}</b></span><span>{{ t('armor') }} <b>{{ view.gear!.armor }}</b></span><span>{{ t('potions') }} <b>{{ view.player.potions }}</b></span><span v-if="view.alpha" :title="t('manaHint',{ticks:view.alpha.nextMana})">{{t('mana')}} <b data-testid="mana">{{view.alpha.mana}} / {{view.alpha.maxMana}}</b></span><span v-if="view.alpha">{{t('gold')}} <b>{{view.player.gold}}</b></span><span>{{ t('tick') }} <b data-testid="tick">{{ view.tick }}</b></span></div>
    <div class="layout"><section class="play">
      <div v-if="threats.length" class="danger" role="alert"><p v-for="enemy in threats" :key="enemy.id">{{ t(enemy.kind==='hexer'?'hexerWarning':'guardWarning', { x: enemy.intent!.x, ticks: enemy.nextAt - view.tick, damage: Math.max(1, enemy.damage! - Math.floor(view.gear!.armor*(enemy.kind==='hexer'?.5:1))) }) }}</p></div>
      <div class="viewport"><div class="viewport-bar"><span role="status" :data-state="status">{{ status === 'ready' ? t(state) : t(status === 'error' ? 'graphicsError' : 'loading') }}</span><span data-testid="position">{{ t('floorLabel', { floor: view.player.floor + 1 }) }} · {{ view.player.x }}</span></div><canvas ref="canvas" tabindex="0" :aria-label="t('scene')"></canvas></div>
      <div class="effects"><span v-if="!exp.effects.length">{{ t('noEffects') }}</span><span v-for="effect in exp.effects" :key="effect.kind" :class="effect.kind" :title="t(`${effect.kind}Detail`)">{{ t(effect.kind) }} · {{ t('remaining', { ticks: effect.until - view.tick }) }}</span></div>
      <div class="controls"><div class="dpad"><button v-for="command in ['left','up','down','right'] as const" :key="command" :data-command="command" :disabled="blocked" :aria-label="t(command)" @pointerdown="pointer($event, command)" @pointerup="held.release(`pointer:${$event.pointerId}`)" @pointercancel="held.stop()" @lostpointercapture="held.stop()" @click="($event.detail === 0) && one(command)">{{ {left:'←',right:'→',up:'↑',down:'↓'}[command] }}</button></div><div class="actions"><button v-for="command in ['attack','interact','potion','wait'] as const" :key="command" :data-command="command" :disabled="actionBlocked" @click="one(command)">{{ t(command) }}<span v-if="view.alpha&&command==='attack'"> · {{view.alpha.attackCost}}</span></button><button v-if="view.alpha" data-command="cast" :disabled="actionBlocked||view.player.equipment!.mainHand!=='wand'||view.alpha.mana<view.alpha.spellCost" :title="t('spellStats',{range:view.alpha.range,mana:view.alpha.spellCost,ticks:view.alpha.spellTime})" @click="one('cast')">{{t('cast')}}</button><button class="primary" @click="openPanel('bag')">{{ t('bag') }} {{ exp.bag.length }}/{{ exp.capacity }}</button></div></div>
      <p class="hint">{{ t(view.player.relic ? 'relicHint' : 'routeHint') }}</p><p v-if="props.alpha&&view.revision<8" class="onboarding">{{t('onboarding')}}</p>
      <div class="toolbar"><button @click="togglePause">{{ t(paused ? 'resume' : 'pause') }}</button><button @click="save">{{ t('save') }}</button><button @click="load">{{ t('load') }}</button><button @click="exportSave">{{ t('export') }}</button><button @click="settle(); file?.click()">{{ t('import') }}</button><button @click="replay">{{ t(replayAt === null ? 'replay' : 'live') }}</button><button @click="openPanel('newRun')">{{ t('newRun') }}</button><input ref="file" data-testid="import-file" type="file" accept=".json,application/json" hidden @change="importSave" /></div>
      <label v-if="replayAt !== null" class="replay">{{ t('position') }} {{ replayAt }} / {{ length }}<input v-model.number="replayAt" :aria-label="t('position')" type="range" min="0" :max="length" step="1" @input="seek" /></label>
      <p class="notice" aria-live="polite">{{ t(notice) }}</p>
      <section v-if="view.status !== 'playing'" class="card result" data-testid="result"><h2>{{ t(view.status) }}</h2><p>{{ t('seed') }} {{ view.seed }} · {{ t('tick') }} {{ view.tick }} · {{ t('actions') }} {{ replayAt ?? length }}</p><p>{{ t('kills') }} {{ exp.kills }} · {{ t('collected') }} {{ exp.collected }}</p><button @click="openPanel('newRun')">{{ t('newRun') }}</button></section>
    </section><aside><AlphaFeatures v-if="view.alpha" :view="view" :locale="locale" :disabled="actionBlocked" @command="one" />
      <section class="card"><h2>{{ t('nearby') }}</h2><p v-if="!exp.nearby.length">{{ t('nothing') }}</p><div v-for="item in exp.nearby" :key="item.id" class="near-item"><b>{{ itemName(item) }}</b><small v-if="item.gear">{{ detail(item) }}</small><button :data-take="item.id" :disabled="actionBlocked" @click="one(`take:${item.id}`)">{{ t('take') }}</button></div><div v-if="shrine"><p>{{ t('shrineHint') }}</p><button :disabled="actionBlocked" @click="one('shrine')">{{ t('shrine') }}</button></div></section>
      <section class="card enemies"><h2>{{ t('threat') }}</h2><p v-if="!view.enemies.length">{{ t('quiet') }}</p><div v-for="enemy in view.enemies" :key="enemy.id" :data-enemy="enemy.id"><b>{{ t(enemy.elite ? 'boss' : enemy.venom ? 'venom' : enemy.kind === 'hexer' ? 'hexer' : enemy.kind === 'skirmisher' ? 'skirmisher' : enemy.kind === 'guard' ? 'guard' : 'enemy') }} · {{ enemy.hp }}/{{ enemy.maxHp }}</b><small>{{ t(enemy.kind === 'hexer' ? 'hexerDetail' : enemy.kind === 'skirmisher' ? 'skirmisherDetail' : enemy.kind === 'guard' ? 'guardDetail' : 'crawlerDetail') }}</small></div></section>
      <section class="card journal"><h2>{{ t('journal') }}</h2><ol><li v-for="(event, i) in [...view.events].reverse().slice(0,6)" :key="i">{{ fact(event) }}</li></ol></section>
    </aside></div>
    <footer>{{ t('idleNote') }} <a v-if="props.alpha" href="./adventure.html">{{t('legacyLink')}}</a><a v-else href="./alpha.html">{{alphaText(locale,'alphaLink')}}</a> · <a href="./dungeon.html">{{ t('dungeonLink') }}</a> · <a href="./character-lab.html">{{ t('lab') }}</a> · <a href="./combat-lab.html">{{ t('combatLab') }}</a></footer>
    <dialog ref="modal" :aria-label="panel ? t(panel) : t('help')" @cancel.prevent="closePanel"><template v-if="panel"><div class="dialog-heading"><h2>{{ t(panel) }}</h2><button @click="closePanel">{{ t('close') }}</button></div>
      <template v-if="panel === 'newRun'"><h3>{{ t('welcome') }}</h3><p>{{ t('intro') }}</p><p>{{ t('objective') }}</p><form @submit.prevent="reset"><template v-if="props.alpha"><label>{{t('loadout')}}<select v-model="loadout" :aria-label="t('loadout')"><option v-for="v in ['vanguard','breaker','channeler'] as const" :key="v" :value="v">{{t(v)}}</option></select></label><p class="loadout-detail">{{t(`${loadout}Detail`)}}</p></template><label>{{ t('seed') }}<input v-model="seed" inputmode="numeric" data-testid="seed" /></label><button type="button" @click="randomSeed">{{ t('random') }}</button><p v-if="seedError" role="alert">{{ t('seedError') }}</p><p v-if="length">{{ t('confirmNew') }}</p><button class="primary" type="submit" :disabled="status !== 'ready'">{{ t('start') }}</button></form><p v-if="status !== 'ready'" role="status">{{ t(status === 'error' ? 'graphicsError' : 'loading') }}</p><p>{{ t('helpMove') }}</p><div class="toolbar"><button @click="load">{{ t('load') }}</button><button @click="file?.click()">{{ t('import') }}</button><button @click="locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'EN' : '中文' }}</button></div></template>
      <template v-else-if="panel === 'bag'"><p>{{ t('bagHint') }}</p><div class="slots"><span v-for="slot in SLOTS" :key="slot">{{ t(slot) }}: {{ exp.bag.find(i => i.equipped === slot) ? itemName(exp.bag.find(i => i.equipped === slot)!) : '—' }}</span></div><p>{{ exp.bag.length }} / {{ exp.capacity }} · {{ t('hp') }} {{ view.player.hp }}/{{ view.player.maxHp }} · {{ t('tick') }} {{ view.tick }}</p><div class="bag-list"><article v-for="item in exp.bag" :key="item.id" :data-item="item.id" class="bag-item" :class="{ equipped: item.equipped }"><div><b>{{ itemName(item) }}</b><small>{{ detail(item) }}</small><small v-if="item.equipped">{{ t('equippedTag') }} · {{ t(item.equipped) }}</small></div><div class="item-actions"><button v-if="item.gear && !item.equipped" :disabled="actionBlocked" @click="one(`wear:${item.id}`)">{{ t('wear') }}</button><button v-if="item.equipped" :disabled="actionBlocked" @click="one(`unequip:${item.equipped}`)">{{ t('unequip') }}</button><button v-if="item.kind === 'flask'" :disabled="actionBlocked" @click="one(`use:${item.id}`)">{{ t('use') }}</button><button v-if="item.kind === 'flask' && !item.effect" :disabled="actionBlocked || !hasScroll" @click="one(`identify:${item.id}`)">{{ t('identify') }}</button><button v-if="!item.equipped" :disabled="actionBlocked" @click="one(`drop:${item.id}`)">{{ t('drop') }}</button></div></article></div></template>
      <template v-else-if="panel === 'help'"><p>{{ t('helpMove') }}</p><p>{{ t('helpCombat') }}</p><p v-if="props.alpha">{{t('helpRoutes')}}</p><p>{{ t('helpItems') }}</p><p>{{ t('poisonDetail') }}</p><p>{{ t('helpSave') }}</p></template>
      <template v-else-if="panel === 'settings'"><label><input v-model="sound" type="checkbox" @change="toggleAudio" />{{ t('audio') }}</label><label>{{ t('volume') }}<input v-model.number="volume" type="range" min="0" max="1" step=".05" /></label><label><input v-model="low" type="checkbox" />{{ t('low') }}</label><label><input v-model="textured" type="checkbox" />{{ t('texture') }}</label></template>
      <p class="notice" aria-live="polite">{{ t(notice) }}</p>
    </template></dialog>
  </main>
</template>
