<script setup lang="ts">
import {onMounted,onBeforeUnmount,reactive,ref,watch} from 'vue';
import {parseRig} from '../character-lab/assets';
import {CombatStudy,type Inspection} from './scene';
import {inspectionText,type InspectionKey} from './i18n';
const locale=ref<'zh'|'en'>('zh'),t=(k:InspectionKey)=>inspectionText(locale.value,k);
const canvas=ref<HTMLCanvasElement>(),status=ref<'loading'|'ready'|'error'>('loading'),playing=ref(false);
const options=reactive<Inspection>({model:'vanguard',outfit:'brigandine',weaponStyle:'sword',helmet:false,sword:true,shield:true,face:1,phase:0,enemy:'guard',action:'strike',monochrome:false});
let scene:CombatStudy|undefined,raf=0,last=0;const controller=new AbortController();
function stop(){playing.value=false;cancelAnimationFrame(raf);last=0;}
function frame(time:number){if(!playing.value||status.value!=='ready')return;options.phase=(options.phase+(last?Math.min(time-last,50)/1600:0))%1;last=time;raf=requestAnimationFrame(frame);}
function step(amount:number){stop();options.phase=Math.max(0,Math.min(1,options.phase+amount));}
watch(playing,value=>{cancelAnimationFrame(raf);last=0;if(value)raf=requestAnimationFrame(frame);});
watch(options,()=>scene?.update(options));
watch(locale,()=>{document.documentElement.lang=locale.value==='zh'?'zh-CN':'en';document.title=t('title');});
function fail(){stop();status.value='error';}
onMounted(async()=>{window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);try{
 const response=await fetch('./assets/character-study/motions.json',{signal:controller.signal});if(!response.ok)throw new Error('asset');const text=await response.text();if(text.length>500000)throw new Error('budget');const rig=parseRig(JSON.parse(text));if(controller.signal.aborted)return;
 scene=new CombatStudy(canvas.value!,rig,fail);scene.update(options);status.value='ready';
}catch{if(!controller.signal.aborted){scene?.dispose();scene=undefined;fail();}}});
onBeforeUnmount(()=>{controller.abort();stop();scene?.dispose();window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);});
</script>
<template><main class="workshop"><header><div><p class="eyebrow">{{t('subtitle')}}</p><h1>{{t('title')}}</h1></div><nav><a href="./adventure.html">{{t('back')}}</a><a href="./character-lab.html">{{t('old')}}</a><button @click="locale=locale==='zh'?'en':'zh'">{{locale==='zh'?'EN':'中文'}}</button></nav></header>
<div class="study-grid"><section class="stage"><div class="stage-top"><span role="status" :data-state="status">{{t(status)}}</span><span>{{t(options.weaponStyle??'sword')}}</span></div><canvas ref="canvas" :aria-label="t('title')"></canvas><div class="stage-bottom"><span>{{t('step')}}</span><span>{{Math.round(options.phase*100)}}%</span></div><div class="timeline"><button :disabled="status!=='ready'" @click="playing=!playing">{{t(playing?'pause':'play')}}</button><label>{{t('phase')}}<input v-model.number="options.phase" type="range" min="0" max="1" step="0.001" @pointerdown="stop" @keydown="stop" /></label></div><div class="angles"><button @click="step(-1/60)">{{t('previous')}}</button><button @click="stop();options.phase=.45">{{t('contact')}}</button><button @click="step(1/60)">{{t('next')}}</button></div></section>
<aside><fieldset :disabled="status!=='ready'"><label>{{t('model')}}<select v-model="options.model" :aria-label="t('model')"><option v-for="v in ['classic','vanguard'] as const" :value="v" :key="v">{{t(v)}}</option></select></label><label>{{t('outfit')}}<select v-model="options.outfit" :aria-label="t('outfit')"><option v-for="v in ['cloth','leather','plate','brigandine'] as const" :value="v" :key="v">{{t(v)}}</option></select></label><label>{{t('weapon')}}<select v-model="options.weaponStyle" :aria-label="t('weapon')"><option v-for="v in ['sword','mace'] as const" :value="v" :key="v">{{t(v)}}</option></select></label><label>{{t('enemy')}}<select v-model="options.enemy" :aria-label="t('enemy')"><option v-for="v in ['guard','crawler'] as const" :value="v" :key="v">{{t(v)}}</option></select></label><label>{{t('action')}}<select v-model="options.action" :aria-label="t('action')"><option v-for="v in ['strike','incoming','walk','death'] as const" :value="v" :key="v">{{t(v)}}</option></select></label><label>{{t('face')}}<select v-model.number="options.face" :aria-label="t('face')"><option :value="1">{{t('right')}}</option><option :value="-1">{{t('left')}}</option></select></label><div class="toggles"><label v-for="v in ['helmet','shield','monochrome'] as const" :key="v" class="check"><input v-model="options[v]" type="checkbox" />{{t(v)}}</label></div></fieldset><article><p>{{t('note')}}</p><p>{{t('asset')}}</p></article></aside></div></main></template>
