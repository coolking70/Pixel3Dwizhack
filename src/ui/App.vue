<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Command, Fact, PublicView } from '../core/types';
import { ArchiveError, GameSession, MAX_BYTES, type SubmitResult } from '../session/session';
import { loadSession, saveSession } from '../session/storage';
import { HeldInput, KEY_COMMANDS } from './input';
import { translate, type Locale, type TextKey } from './i18n';
import { drawMine } from './renderer';

let session = new GameSession();
const view = ref<PublicView>(session.view());
const locale = ref<Locale>('zh');
const t = (key: TextKey, values?: Record<string, string | number>) => translate(locale.value, key, values);
const notice = ref<TextKey>('ready');
const panel = ref<'help' | 'newRun' | null>(null);
const replayAt = ref<number | null>(null);
const historyLength = ref(0);
const seedInput = ref('24681');
const seedError = ref(false);
const scene = ref<HTMLCanvasElement>();
const modal = ref<HTMLDialogElement>();
const fileInput = ref<HTMLInputElement>();
const blocked = computed(() => panel.value !== null || replayAt.value !== null || view.value.status !== 'playing');
const status = computed<TextKey>(() => replayAt.value !== null ? 'replaying' : view.value.status === 'playing' ? 'frozen' : view.value.status);
const hpPercent = computed(() => view.value.player.hp / view.value.player.maxHp * 100);
const facts = computed(() => [...view.value.events].reverse());
let importToken = 0;

function sync(): void { view.value = session.view(); historyLength.value = session.length; }
function submit(command: Command): SubmitResult {
  if (blocked.value) return { accepted: false, reason: 'ended' };
  try {
    const result = session.submit(command);
    if (result.accepted) { sync(); notice.value = result.interrupt ? 'stopped' : 'ready'; }
    else notice.value = result.reason;
    return result;
  } catch { notice.value = 'error'; return { accepted: false, reason: 'invalid' }; }
}
const held = new HeldInput(submit);
function single(command: Command): void { held.stop(); submit(command); }
function pointer(event: PointerEvent, command: Command): void {
  if (!event.isPrimary || event.button !== 0 || blocked.value) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  if (command === 'left' || command === 'right') held.start(`pointer:${event.pointerId}`, command);
  else single(command);
}
function releasePointer(event: PointerEvent): void { held.release(`pointer:${event.pointerId}`); }
function accessibleClick(event: MouseEvent, command: Command): void { if (event.detail === 0) single(command); }
function keydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') { held.stop(); return; }
  if ((event.target as HTMLElement)?.closest('input,textarea,select,button,a,dialog,[contenteditable="true"]')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const command = KEY_COMMANDS[key];
  if (!command || blocked.value) return;
  event.preventDefault();
  if (event.repeat) return;
  if (command === 'left' || command === 'right') held.start(event.code, command);
  else single(command);
}
function keyup(event: KeyboardEvent): void { held.release(event.code); }
function stop(): void { held.stop(); }
async function openPanel(which: 'help' | 'newRun'): Promise<void> {
  held.stop(); panel.value = which; seedError.value = false;
  await nextTick(); modal.value?.showModal();
}
function closePanel(): void { held.stop(); modal.value?.close(); panel.value = null; }
function newRun(): void {
  if (!/^\d+$/.test(seedInput.value) || Number(seedInput.value) < 1 || Number(seedInput.value) > 0xffffffff) { seedError.value = true; return; }
  session = new GameSession(Number(seedInput.value)); importToken++; replayAt.value = null;
  closePanel(); sync(); notice.value = 'ready';
}
function save(): void {
  held.stop();
  try { saveSession(session, window.localStorage); notice.value = 'saved'; }
  catch { notice.value = 'storageError'; }
}
function errorText(error: unknown): TextKey { return error instanceof ArchiveError ? error.code : 'storageError'; }
function load(): void {
  held.stop();
  try {
    if (loadSession(session, window.localStorage)) { importToken++; replayAt.value = null; sync(); notice.value = 'loaded'; }
    else notice.value = 'noSave';
  } catch (error) { notice.value = errorText(error); }
}
function exportSave(): void {
  held.stop();
  const url = URL.createObjectURL(new Blob([session.capture()], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `dungeon-${session.view().seed}-${session.length}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice.value = 'exported';
}
async function importSave(event: Event): Promise<void> {
  held.stop();
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  const token = ++importToken, boundary = session.fingerprint();
  try {
    if (file.size > MAX_BYTES) throw new ArchiveError('invalidArchive');
    const raw = await file.text();
    if (token !== importToken || boundary !== session.fingerprint()) return;
    session.restore(raw); replayAt.value = null; sync(); notice.value = 'imported';
  } catch (error) { if (token === importToken) notice.value = errorText(error); }
}
function replay(position: number): void {
  held.stop();
  try { view.value = session.replay(position); replayAt.value = position; }
  catch (error) { notice.value = errorText(error); }
}
function exitReplay(): void { held.stop(); replayAt.value = null; sync(); }
function factText(fact: Fact): string {
  return t(`event.${fact.kind}`, { amount: fact.amount ?? 0, item: fact.item ? t(fact.item === 'potion' ? 'potions' : fact.item) : '' });
}
let animation = 0;
let observer: ResizeObserver | undefined;
function frame(time: number): void {
  if (scene.value) drawMine(scene.value, view.value, time);
  animation = requestAnimationFrame(frame);
}
onMounted(() => {
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
  window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
  window.addEventListener('pointerup', releasePointer); window.addEventListener('pointercancel', stop);
  observer = new ResizeObserver(entries => {
    const width = Math.round(entries[0]?.contentRect.width ?? 832);
    if (scene.value) { scene.value.width = Math.max(280, width); scene.value.height = width < 500 ? 320 : 420; }
  });
  if (scene.value) observer.observe(scene.value);
  animation = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  held.stop(); observer?.disconnect(); cancelAnimationFrame(animation);
  window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
  window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop);
  window.removeEventListener('pointerup', releasePointer); window.removeEventListener('pointercancel', stop);
});
</script>

<style scoped>.room-link{display:flex;align-items:center;color:#d1bd85;font-size:12px;padding:8px;text-decoration:underline;white-space:nowrap}</style>
<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="emblem">◆</span><div><h1>DUNGEON <em>DESCENT</em></h1><small>{{ t('subtitle') }}</small></div></div>
      <nav :aria-label="t('notice')">
        <a class="room-link" href="./alpha2.html" @click="stop">{{ locale === 'zh' ? 'Alpha 2 · 道具与地牢生态' : 'Alpha 2 · Items and ecology' }}</a>
        <a class="room-link" href="./alpha.html" @click="stop">{{ t('alphaLink') }}</a>
        <a class="room-link" href="./adventure.html" @click="stop">{{ t('expeditionLink') }}</a>
        <a class="room-link" href="./dungeon.html" @click="stop">{{ t('dungeonLink') }}</a>
        <a class="room-link" href="./room.html" @click="stop">{{ t('roomLink') }}</a>
        <button @click="openPanel('help')">{{ t('help') }}</button>
        <button data-testid="save" @click="save">{{ t('save') }}</button>
        <button data-testid="load" @click="load">{{ t('load') }}</button>
        <button class="primary" @click="openPanel('newRun')">{{ t('newRun') }}</button>
        <button class="language" @click="stop(); locale = locale === 'zh' ? 'en' : 'zh'">{{ t('language') }}</button>
      </nav>
    </header>
    <div class="eyebrow"><span>✦ {{ t('mine') }} <span class="muted"> / {{ t('region') }}</span></span><span class="mono">{{ t('seed') }} {{ view.seed }}</span></div>
    <section class="status-grid">
      <div class="health stat"><label>{{ t('hp') }} <strong data-testid="hp">{{ view.player.hp }} / {{ view.player.maxHp }}</strong></label><div class="track"><span :style="{ width: hpPercent + '%' }"></span></div></div>
      <div class="stat"><label>{{ t('gold') }}</label><strong>{{ view.player.gold }}</strong></div>
      <div class="stat"><label>{{ t('depth') }}</label><strong>B{{ view.player.floor + 1 }} <small>/ 03</small></strong></div>
      <div class="stat"><label>{{ t('tick') }}</label><strong><span data-testid="tick">{{ view.tick }}</span> <small>tick</small></strong></div>
      <div class="stat"><label>{{ t('actions') }}</label><strong data-testid="revision">{{ view.revision }}</strong></div>
    </section>
    <div v-if="replayAt !== null" class="replay-bar">
      <strong>{{ t('replaying') }} · {{ replayAt }} / {{ historyLength }}</strong>
      <label>{{ t('position') }}<input type="range" min="0" :max="historyLength" :value="replayAt" data-testid="replay-slider" @input="replay(Number(($event.target as HTMLInputElement).value))"></label>
      <button :disabled="replayAt === 0" @click="replay(replayAt - 1)">{{ t('previous') }}</button><button :disabled="replayAt === historyLength" @click="replay(replayAt + 1)">{{ t('next') }}</button>
      <button data-testid="exit-replay" @click="exitReplay">{{ t('close') }}</button><p>{{ t('replayHelp') }}</p>
    </div>
    <main class="game-grid">
      <section class="play-area">
        <div class="frame-head"><strong>◆ {{ t('mine') }}</strong><span :class="{ danger: view.status === 'dead' }">● {{ t(status) }}</span></div>
        <div class="game-frame"><canvas ref="scene" width="832" height="420" tabindex="0" :aria-label="t('scene')" data-testid="scene"></canvas></div>
        <div class="objective">✧ <span>{{ t(view.player.relic ? 'returnHome' : 'objective') }}</span></div>
        <div class="controls">
          <div class="dpad">
            <span></span><button :aria-label="t('up')" :disabled="blocked" @click="single('up')">↑</button><span></span>
            <button v-for="direction in (['left', 'down', 'right'] as const)" :key="direction" :aria-label="t(direction)" :data-testid="direction" :disabled="blocked"
              @pointerdown="pointer($event, direction)" @lostpointercapture="releasePointer" @click="accessibleClick($event, direction)">{{ { left: '←', down: '↓', right: '→' }[direction] }}</button>
          </div>
          <div class="actions"><button v-for="command in (['attack', 'interact', 'potion', 'wait'] as const)" :key="command" :class="{ primary: command === 'attack' }" :disabled="blocked" :data-testid="command" @click="single(command)">
            {{ { attack: '⚔', interact: '✦', potion: '♜', wait: '◷' }[command] }} {{ t(command) }} <kbd>{{ { attack: 'Space', interact: 'F', potion: 'Q', wait: '.' }[command] }}</kbd>
          </button></div>
        </div>
        <p class="control-hint">{{ t('controls') }}</p>
        <p class="notice" role="status" data-testid="notice">{{ t(notice) }}</p>
        <section class="card journal"><div class="heading"><h2>{{ t('journal') }}</h2><small>{{ t('latest') }}</small></div>
          <ol><li v-for="(fact, index) in facts.slice(0, 7)" :key="index" :class="{ newest: index === 0 }"><span>›</span>{{ factText(fact) }}</li></ol>
        </section>
      </section>
      <aside>
        <section class="card explorer"><div class="portrait">♞</div><div><h2>{{ t('explorer') }}</h2><p>{{ t('equipment') }}</p><span class="green">{{ t(status) }}</span></div></section>
        <section class="card"><div class="heading"><h2>{{ t('threat') }}</h2><span class="badge">{{ view.enemies.length }}</span></div>
          <p v-if="!view.enemies.length" class="muted">{{ t('quiet') }}</p>
          <div v-for="enemy in view.enemies" :key="enemy.id" class="enemy"><span>◆</span><div><b>{{ t('enemy') }}</b><small>{{ enemy.hp }} / {{ enemy.maxHp }} HP · {{ t('distance') }} {{ Math.abs(enemy.x - view.player.x) }}</small></div></div>
        </section>
        <section class="card"><h2>{{ t('inventory') }}</h2><div class="item"><span class="item-icon">♜</span><div><b>{{ t('potions') }} × {{ view.player.potions }}</b><small>{{ t('potionDetail') }}</small></div></div><div class="item"><span class="item-icon">✧</span><div><b>{{ t('relic') }}</b><small>{{ t(view.player.relic ? 'relicHeld' : 'relicAbsent') }}</small></div></div></section>
        <section class="card"><h2>{{ t('explored') }}</h2><div class="map-row" v-for="floor in view.map.floors" :key="floor"><small>B{{ floor }}</small><i v-for="tile in view.map.width" :key="tile" :class="{ seen: view.explored[floor - 1]!.includes(tile - 1), you: view.player.floor === floor - 1 && view.player.x === tile - 1 }"></i></div></section>
        <div class="philosophy"><strong>{{ t('premise') }}</strong><p>{{ t('detail') }}</p></div>
        <section class="archive-actions"><button data-testid="replay" :disabled="replayAt !== null" @click="replay(0)">{{ t('replay') }}</button><button @click="exportSave">{{ t('export') }}</button><button @click="stop(); fileInput?.click()">{{ t('import') }}</button><input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importSave"></section>
      </aside>
    </main>
    <footer>{{ t('footer') }}<span>M01 · 0.1.0</span></footer>
    <dialog ref="modal" @cancel="closePanel" @close="panel = null">
      <div class="heading"><h2>{{ t(panel === 'newRun' ? 'newRun' : 'help') }}</h2><button @click="closePanel">{{ t('cancel') }}</button></div>
      <template v-if="panel === 'newRun'"><p>{{ t('seedHelp') }}</p><form @submit.prevent="newRun"><label>{{ t('seed') }}<input v-model="seedInput" inputmode="numeric" autofocus></label><p v-if="seedError" role="alert">{{ t('invalidSeed') }}</p><button class="primary" type="submit">{{ t('start') }}</button></form></template>
      <template v-else><p>{{ t('helpText') }}</p><p>{{ t('helpTime') }}</p></template>
    </dialog>
  </div>
</template>
