<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { CharacterStudy, type StudyOptions } from './scene';
import type { RigData } from './types';
import { labText, type LabKey } from './i18n';
import { parseRig } from './assets';
const locale = ref<'zh' | 'en'>('zh');
const t = (key: LabKey): string => labText(locale.value, key);
const canvas = ref<HTMLCanvasElement>();
const status = ref<'loading' | 'ready' | 'error'>('loading');
const options = reactive<StudyOptions>({ outfit: 'leather', helmet: true, sword: true, shield: true, motion: 'idle', phase: 0, angle: 25, compare: true, monochrome: false, pixelHeight: 0 });
const playing = ref(false);
const motions = ['idle', 'walk', 'attack', 'block', 'climb'] as const;
const outfits = ['cloth', 'leather', 'plate'] as const;
const toggles = ['helmet', 'sword', 'shield', 'monochrome'] as const;
const sourceNote = computed(() => t(options.motion === 'climb' ? 'authored' : 'imported'));
let study: CharacterStudy | undefined, request = 0, lastTime = 0;
const controller = new AbortController();
let data: RigData | undefined;
function fail(): void { playing.value = false; status.value = 'error'; }
function frame(time: number): void {
  if (!playing.value || status.value !== 'ready') return;
  const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0; lastTime = time;
  const duration = data?.clips.find(c => c.name === options.motion)?.duration ?? 2;
  options.phase = (options.phase + delta / duration) % 1;
  request = requestAnimationFrame(frame);
}
function stop(): void { playing.value = false; }
watch(playing, value => { cancelAnimationFrame(request); lastTime = 0; if (value) request = requestAnimationFrame(frame); });
watch(options, () => { if (status.value === 'ready') study?.update(options); });
watch(() => options.motion, () => { options.phase = 0; });
watch(locale, value => { document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'; document.title = t('title'); });
onMounted(async () => {
  window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
  try {
    const response = await fetch('./assets/character-study/motions.json', { signal: controller.signal });
    if (!response.ok) throw new Error('Motion asset unavailable');
    const raw = await response.text();
    if (raw.length > 500_000) throw new Error('Motion asset too large');
    data = parseRig(JSON.parse(raw));
    if (controller.signal.aborted) return;
    study = new CharacterStudy(canvas.value!, data, fail); study.update(options); status.value = 'ready';
  } catch { if (!controller.signal.aborted) { study?.dispose(); study = undefined; fail(); } }
});
onBeforeUnmount(() => { controller.abort(); cancelAnimationFrame(request); study?.dispose(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); });
</script>

<template>
  <main class="workshop">
    <header><div><p class="eyebrow">{{ t('subtitle') }}</p><h1>{{ t('title') }}</h1></div><nav><a href="./">{{ t('game') }}</a><button @click="locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'EN' : '中文' }}</button></nav></header>
    <div class="study-grid">
      <section class="stage">
        <div class="stage-top"><span role="status" :data-state="status">{{ t(status) }}</span><span v-if="options.compare">{{ t('leather') }} / {{ t('plate') }}</span><span v-else>{{ t(options.outfit) }}</span></div>
        <canvas ref="canvas" :aria-label="t('title')"></canvas>
        <div class="stage-bottom"><span>{{ sourceNote }}</span><span>{{ Math.round(options.phase * 100) }}%</span></div>
        <div class="timeline"><button :disabled="status !== 'ready'" @click="playing = !playing">{{ t(playing ? 'pause' : 'play') }}</button><label>{{ t('phase') }}<input v-model.number="options.phase" type="range" min="0" max="1" step="0.005" @pointerdown="stop" @keydown="stop" /></label></div>
      </section>
      <aside>
        <fieldset :disabled="status !== 'ready'">
          <label class="check prominent"><input v-model="options.compare" type="checkbox" />{{ t('compare') }}</label>
          <label>{{ t('outfit') }}<select v-model="options.outfit" :aria-label="t('outfit')" :disabled="options.compare"><option v-for="outfit in outfits" :key="outfit" :value="outfit">{{ t(outfit) }}</option></select></label>
          <p class="label">{{ t('equipment') }}</p><div class="toggles"><label v-for="toggle in toggles" :key="toggle" class="check"><input v-model="options[toggle]" type="checkbox" />{{ t(toggle) }}</label></div>
          <label>{{ t('motion') }}<select v-model="options.motion" :aria-label="t('motion')"><option v-for="motion in motions" :key="motion" :value="motion">{{ t(motion) }}</option></select></label>
          <label>{{ t('size') }}<select v-model.number="options.pixelHeight" :aria-label="t('size')"><option :value="0">{{ t('large') }}</option><option v-for="size in [72,96,128]" :key="size" :value="size">≈ {{ size }} px</option></select></label>
          <label>{{ t('angle') }} <span>{{ options.angle }}°</span><input v-model.number="options.angle" type="range" min="-180" max="180" step="1" /></label>
          <div class="angles"><button v-for="preset in [{key:'front',value:0},{key:'quarter',value:35},{key:'side',value:90},{key:'back',value:180}] as const" :key="preset.key" @click="options.angle = preset.value">{{ t(preset.key) }}</button></div>
        </fieldset>
        <article><h2>{{ t('armorTitle') }}</h2><p>{{ t('armorBody') }}</p><h2>{{ t('gripTitle') }}</h2><p>{{ t('gripBody') }}</p></article>
      </aside>
    </div>
    <footer><p>{{ t('note') }}</p><a href="./assets/character-study/provenance.json" target="_blank">{{ t('source') }} ↗</a></footer>
  </main>
</template>
