import type {ItemDef,MonsterDef,EffectDef,Words} from '../core/alpha2-types';
const words=(zh:string,en:string):Words=>({zh,en});
export const ITEMS6:ItemDef[]=[
 {id:'rimeUrn',name:words('凝霜汲壶','Rime siphon'),description:words('汲取余热：冷却灰烬风口，或熄灭自身燃烧。4充能；诅咒使用会迟缓。','Draw out heat: cool an ember vent or extinguish yourself. Four charges; cursed use slows you.'),category:'tool',material:'stone',value:30,weight:2,minDepth:4,rarity:2,tags:['crypt','cold'],sourceKey:'original-alpha6',actions:{apply:'cool6'},charges:4},
 {id:'silverCenser',name:words('银砂香炉','Silver-sand censer'),description:words('喷出银砂伤害亡灵，或净化骨鸣龛。4充能；银击穿透骨鸣庇护，祝福更强。','Project silver sand at creatures or purify a bone chime. Four charges; silver bypasses the chime ward, blessing strengthens the strike.'),category:'tool',material:'metal',value:36,weight:2,minDepth:4,rarity:2,tags:['crypt','silver'],sourceKey:'original-alpha6',actions:{zap:'silver6'},charges:4},
 {id:'vigilMirror',name:words('守夜棱镜','Vigil prism'),description:words('清除自身失明与混乱，或净化骨鸣龛。3充能；祝福另疗4，诅咒净化反噬失明。','Clear blindness and confusion or purify a bone chime. Three charges; blessed use heals four, cursed purification blinds the user.'),category:'tool',material:'glass',value:32,weight:1,minDepth:4,rarity:2,tags:['crypt','purify'],sourceKey:'original-alpha6',actions:{apply:'purify6'},charges:3},
];
export const MONSTERS6:MonsterDef[]=[
 {id:'cinderMourner',name:words('负烬哀者','Cinder mourner'),description:words('预告后吐火。活风口两格内每次行动回复3；潮湿或迟缓可截断回复，冷伤克制。','Telegraphs fire. Restores three each turn within two cells of an active vent; wet or slow interrupts recovery. Vulnerable to cold.'),kind:'crawler',behavior:'ranged',hp:24,damage:5,armor:0,period:23,range:4,element:'fire',resists:['fire'],weak:['cold'],inflict:'burn',minDepth:4,color:0x987060,scale:1,sourceKey:'original-alpha6'},
 {id:'ossuaryGuard',name:words('骨龛执盾者','Ossuary sentinel'),description:words('靠近活骨鸣龛时额外抵消3物理伤害。银击越过庇护并造成弱点伤害；净化龛即可解除庇护。','An active nearby bone chime absorbs three additional physical damage. Silver bypasses the ward and exploits its weakness; purify the chime to remove the ward.'),kind:'guard',behavior:'guard',hp:28,damage:6,armor:2,period:24,range:1,element:'physical',resists:['poison'],weak:['silver'],minDepth:4,color:0xa9a397,scale:1,sourceKey:'original-alpha6'},
];
export const FEATURES6={
 emberVent:{name:words('灰烬风口','Ember vent'),description:words('接触灼烧并受4火伤，供养附近哀者。可手动盖住，或用水、寒冰、凝霜汲壶冷却。','Contact burns and deals four fire damage; feeds nearby mourners. Cover by hand or cool with water, cold or a rime siphon.')},
 boneChime:{name:words('骨鸣龛','Bone chime'),description:words('接触迟缓，庇护两格内执盾者。可手动消音，或用银砂香炉、守夜棱镜净化。','Contact slows you and wards sentinels within two cells. Silence by hand or purify with silver sand or a vigil prism.')},
};
export const EFFECTS6:Record<string,EffectDef>={cool6:{id:'cool6',op:'cure',power:0,targets:['self','facility']},silver6:{id:'silver6',op:'damage',power:7,element:'silver',targets:['enemy','facility']},purify6:{id:'purify6',op:'cure',power:1,targets:['self','facility']}};
export const FACILITY_EFFECTS6:Record<string,readonly string[]>={emberVent:['water','cold','cool6'],boneChime:['silver6','purify6']};
export const REGION6={id:'ossuary',name:words('墓烬回廊','Ashen ossuary'),floors:[4,5]};
