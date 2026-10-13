<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { SLOTS, type Command, type Fact, type GearId, type Slot } from '../core/types';
import { GameSession } from '../session/session';
import { KEY_COMMANDS } from '../ui/input';
import { MotionInput } from './held';
import type { Locale } from '../ui/i18n';
import { parseRig } from '../character-lab/assets';
import { RoomRenderer } from './renderer';
import { roomText, type RoomKey } from './i18n';
const props = defineProps<{ dungeon?: boolean }>();
const scenario = props.dungeon ? 'dungeon' : 'room';
const SAVE = props.dungeon ? 'dungeon-descent.m02c' : 'dungeon-descent.m02b';
let session = new GameSession(24681, scenario);
const view = ref(session.view()), locale = ref<Locale>('zh'), notice = ref<RoomKey>('ready');
const canvas = ref<HTMLCanvasElement>(), status = ref<'loading' | 'ready' | 'error'>('loading');
const paused = ref(false), busy = ref(false), replayAt = ref<number | null>(null), length = ref(0), textured = ref(true);
const t = (key: RoomKey, values?: Record<string, string | number>): string => roomText(locale.value, key, values, props.dungeon);
const blocked = computed(() => status.value !== 'ready' || paused.value || replayAt.value !== null || view.value.status !== 'playing');
const nearby = computed(() => view.value.loot.filter(l => Math.abs(l.x - view.value.player.x) <= 1));
const state = computed<RoomKey>(() => replayAt.value !== null ? 'replaying' : paused.value ? 'paused' : view.value.status !== 'playing' ? view.value.status : busy.value ? 'busy' : 'frozen');
const threats = computed(() => view.value.enemies.filter(e => e.intent));
const location = computed(() => view.value.map.rooms?.[view.value.player.floor] ?? (view.value.player.floor === 1 ? 'lower' : 'upper'));
const routeHint = computed<RoomKey>(() => view.value.player.relic ? 'returnHint' : view.value.player.floor === 0 ? 'gateHint' : view.value.player.floor === 1 ? 'armoryHint' : 'cryptHint');
function gearLabel(id: GearId, compact = false): string {
  const item = view.value.gear!.catalog.find(g => g.id === id)!;
  const equipped = view.value.gear!.catalog.find(g => g.id === view.value.player.equipment![item.slot]);
  const delta = (n: number): string => n > 0 ? `+${n}` : String(n);
  if (compact) return `${t(id)} (${delta(item.damage - (equipped?.damage ?? 0))}) / (${delta(item.armor - (equipped?.armor ?? 0))})`;
  return `${t(id)} · ${t('damage')} ${item.damage} (${delta(item.damage - (equipped?.damage ?? 0))}) · ${t('armor')} ${item.armor} (${delta(item.armor - (equipped?.armor ?? 0))})`;
}
function equippedStats(slot: Slot): string {
  const item = view.value.gear!.catalog.find(g => g.id === view.value.player.equipment![slot]);
  return `${t('damage')} ${item?.damage ?? 0} / ${t('armor')} ${item?.armor ?? 0}`;
}
let renderer: RoomRenderer | undefined;
const controller = new AbortController();
function submit(command: Command) {
  if (blocked.value || busy.value) return { accepted: false, reason: 'blocked' } as const;
  const before = session.view(), result = session.submit(command);
  if (result.accepted) {
    view.value = session.view(); length.value = session.length; notice.value = result.interrupt ? 'stopped' : 'ready';
    busy.value = true; renderer!.play(before, view.value, command);
  } else notice.value = result.reason;
  return result;
}
const held = new MotionInput(submit, () => busy.value);
function stop(): void { held.stop(); }
function settle(): void { stop(); renderer?.settle(); busy.value = false; }
function blur(): void { settle(); paused.value = true; }
function togglePause(): void { settle(); paused.value = !paused.value; }
function one(command: Command): void { stop(); submit(command); }
function pointer(event: PointerEvent, command: Command): void {
  if (!event.isPrimary || event.button !== 0 || blocked.value) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  if (command === 'left' || command === 'right') held.start(`pointer:${event.pointerId}`, command); else one(command);
}
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { event.preventDefault(); togglePause(); return; }
  if ((event.target as HTMLElement)?.closest('input,select,button,a,[contenteditable=true]') || event.ctrlKey || event.metaKey || event.altKey) return;
  const command = KEY_COMMANDS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  if (!command) return; event.preventDefault(); if (event.repeat) return;
  if (command === 'left' || command === 'right') held.start(event.code, command); else one(command);
}
function keyup(event: KeyboardEvent): void { held.release(event.code); }
function sync(): void { view.value = session.view(); length.value = session.length; renderer?.sync(view.value); }
function reset(): void { settle(); session = new GameSession(24681, scenario); replayAt.value = null; paused.value = false; notice.value = 'ready'; sync(); }
function save(): void { settle(); try { localStorage.setItem(SAVE, session.capture()); notice.value = 'savedRoom'; } catch { notice.value = 'storageError'; } }
function load(): void {
  settle(); try { const raw = localStorage.getItem(SAVE); if (!raw) { notice.value = 'noSave'; return; } session.restore(raw); replayAt.value = null; paused.value = false; sync(); notice.value = 'loadedRoom'; } catch { notice.value = 'invalidArchive'; }
}
function replay(): void { settle(); if (replayAt.value !== null) { replayAt.value = null; sync(); } else { replayAt.value = session.length; seek(); } }
function seek(): void { settle(); view.value = session.replay(replayAt.value!); renderer?.sync(view.value); }
function equip(slot: Slot, event: Event): void {
  const id = (event.target as HTMLSelectElement).value as GearId | '';
  one(id ? `equip:${id}` : `unequip:${slot}`);
  (event.target as HTMLSelectElement).value = view.value.player.equipment![slot] ?? '';
}
function fact(event: Fact): string {
  if (event.kind === 'start') return t('eventStart'); if (event.kind === 'won') return t('eventWin');
  if (event.kind === 'equip') return `${t(event.amount === 0 ? 'removed' : 'equipped')} · ${t(event.gear!)}`;
  return t(`event.${event.kind}`, { amount: event.amount ?? 0, item: event.gear ? t(event.gear) : event.item ? t(event.item === 'potion' ? 'potionItem' : event.item) : '' });
}
function graphicsFailure(): void { settle(); status.value = 'error'; }
watch(textured, value => renderer?.setTexture(value));
watch(locale, value => { document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'; document.title = t('title'); });
onMounted(async () => {
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', blur);
  try {
    const response = await fetch('./assets/character-study/motions.json', { signal: controller.signal }); if (!response.ok) throw new Error('asset');
    const raw = await response.text(); if (raw.length > 500_000) throw new Error('budget'); const rig = parseRig(JSON.parse(raw)); if (controller.signal.aborted) return;
    renderer = new RoomRenderer(canvas.value!, rig, view.value, () => { busy.value = false; held.completed(); }, graphicsFailure); status.value = 'ready';
  } catch { if (!controller.signal.aborted) graphicsFailure(); }
});
onBeforeUnmount(() => { controller.abort(); stop(); renderer?.dispose(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', blur); });
</script>

<template>
  <main class="room-shell">
    <header><div><p class="kicker">{{ t('subtitle') }}</p><h1>{{ t('title') }}</h1></div><nav><a href="./adventure.html">{{ t('expeditionLink') }}</a><a :href="dungeon ? './room.html' : './dungeon.html'">{{ t(dungeon ? 'outpostLink' : 'dungeonLink') }}</a><a href="./">{{ t('baseline') }}</a><a href="./character-lab.html">{{ t('lab') }}</a><button @click="stop(); locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'EN' : '中文' }}</button></nav></header>
    <p class="objective">{{ t('objective') }}</p>
    <div v-if="dungeon" class="route-map" :aria-label="t('routeTitle')"><span v-for="(room, i) in view.map.rooms" :key="room" :class="{ current: i === view.player.floor, unknown: !view.explored[i]!.length }">{{ i + 1 }} · {{ t(view.explored[i]!.length ? room : 'unexplored') }}</span><b>{{ t(view.player.relic ? 'relicHeld' : 'relicGoal') }}</b></div>
    <div class="hud"><span>{{ t('hp') }} <b data-testid="room-hp">{{ view.player.hp }} / {{ view.player.maxHp }}</b></span><span>{{ t('damage') }} <b>{{ view.gear!.damage }}</b></span><span>{{ t('armor') }} <b>{{ view.gear!.armor }}</b></span><span>{{ t('potions') }} <b>{{ view.player.potions }}</b></span><span>{{ t('tick') }} <b data-testid="room-tick">{{ view.tick }}</b></span></div>
    <div class="room-grid"><section>
      <div v-if="threats.length" class="danger" role="alert"><p v-for="enemy in threats" :key="enemy.id">{{ t('guardWarning', { x: enemy.intent!.x, ticks: enemy.nextAt - view.tick, damage: Math.max(1, enemy.damage! - view.gear!.armor) }) }}</p></div>
      <div class="viewport"><div class="viewport-bar"><span role="status" :data-state="status">{{ status === 'ready' ? t(state) : t(status === 'error' ? 'graphicsError' : 'loading') }}</span><span data-testid="room-position">{{ t(location) }} · {{ view.player.x }}</span></div>
        <canvas ref="canvas" tabindex="0" :aria-label="t('scene')"></canvas>
        <div class="scene-hint">{{ nearby.length ? `${t('pickupHint')} · ${nearby.map(l => t(l.gear ?? (l.kind === 'potion' ? 'potionItem' : l.kind))).join(' / ')}` : t(dungeon ? routeHint : 'ladderHint') }}</div>
      </div>
      <div class="controls"><div class="dpad"><button v-for="command in ['left','up','down','right'] as const" :key="command" :disabled="blocked" :aria-label="t(command)" @pointerdown="pointer($event, command)" @pointerup="held.release(`pointer:${$event.pointerId}`)" @pointercancel="stop" @lostpointercapture="stop" @click="($event.detail === 0) && one(command)">{{ {left:'←',right:'→',up:'↑',down:'↓'}[command] }}</button></div><div class="action-buttons"><button v-for="command in ['attack','interact','potion','wait'] as const" :key="command" :disabled="blocked || busy" @click="one(command)">{{ t(command) }}</button></div></div>
      <p class="hint">{{ t('controls') }}</p>
      <div class="toolbar"><button @click="togglePause">{{ t(paused ? 'resume' : 'pause') }}</button><button @click="save">{{ t('save') }}</button><button @click="load">{{ t('load') }}</button><button @click="replay">{{ t(replayAt === null ? 'replay' : 'live') }}</button><button @click="reset">{{ t('restart') }}</button></div>
      <label v-if="replayAt !== null" class="replay">{{ t('position') }} {{ replayAt }} / {{ length }}<input v-model.number="replayAt" type="range" min="0" :max="length" step="1" @input="seek" /></label>
      <p class="notice" aria-live="polite">{{ t(notice) }}</p>
      <label class="texture"><input v-model="textured" type="checkbox" />{{ t('texture') }}</label>
    </section><aside>
      <section class="card"><h2>{{ t('gearTitle') }}</h2><p>{{ t('gearCost') }}</p><p v-if="dungeon">{{ t('comparisonHint') }}</p><label v-for="slot in SLOTS" :key="slot" class="gear-row">{{ t(slot) }}<select :value="view.player.equipment![slot] ?? ''" :aria-label="t(slot)" :disabled="blocked || busy" @change="equip(slot, $event)"><option value="">{{ t('emptySlot') }}</option><option v-for="item in view.gear!.catalog.filter(g => g.slot === slot && view.player.inventory!.includes(g.id))" :key="item.id" :value="item.id">{{ dungeon && item.id !== view.player.equipment![slot] ? gearLabel(item.id, true) : t(item.id) }}</option></select><small v-if="dungeon">{{ equippedStats(slot) }}</small></label><ul v-if="dungeon && nearby.some(l => l.gear)" class="loot-comparison"><li v-for="loot in nearby.filter(l => l.gear)" :key="loot.id">{{ gearLabel(loot.gear!) }}</li></ul></section>
      <section v-if="dungeon" class="card enemies"><h2>{{ t('threat') }}</h2><p v-if="!view.enemies.length">{{ t('quiet') }}</p><div v-for="enemy in view.enemies" :key="enemy.id"><b>{{ t(enemy.kind === 'guard' ? 'guard' : 'enemy') }} · {{ enemy.hp }} / {{ enemy.maxHp }}</b><p>{{ t(enemy.kind === 'guard' ? 'guardDetail' : 'crawlerDetail') }}</p></div></section>
      <section class="card journal"><h2>{{ t('journal') }}</h2><ol><li v-for="(event, index) in [...view.events].reverse().slice(0,8)" :key="index">{{ fact(event) }}</li></ol></section>
    </aside></div>
    <footer>{{ t('notes') }}</footer>
  </main>
</template>
