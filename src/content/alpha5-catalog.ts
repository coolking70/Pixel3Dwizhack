import type { ItemDef, MonsterDef, EffectDef, Words } from '../core/alpha2-types';
const words=(zh:string,en:string):Words=>({zh,en});
export const ITEMS5:ItemDef[]=[
 {id:'sporeBell',name:words('净菌摇铃','Spore-clearing bell'),description:words('摇响可清除自身毒火，或封闭菌床。4次充能；诅咒铃封床时会反噬中毒，祝福铃同时疗伤。','Clear poison and burning on yourself, or seal a spore bed. Four charges; a cursed seal poisons its user, a blessed seal also heals.'),category:'tool',material:'metal',value:28,weight:2,minDepth:0,rarity:2,tags:['fungal','counter-spores'],sourceKey:'original-alpha5',actions:{apply:'purge5'},charges:4},
 {id:'coilKey',name:words('线圈调谐器','Coil tuner'),description:words('修复装备或切断继电器。5次充能；祝福提高修复量，诅咒调谐器切断电源时反噬电击。','Repair equipment or isolate a relay. Five charges; blessing improves repairs, a cursed tuner shocks its user when isolating a relay.'),category:'tool',material:'metal',value:32,weight:2,minDepth:2,rarity:2,tags:['workshop','counter-relay'],sourceKey:'original-alpha5',actions:{apply:'tune5'},charges:5},
];
export const MONSTERS5:MonsterDef[]=[
 {id:'sporeTender',name:words('菌冠培育者','Mycelial tender'),description:words('预告后喷射毒孢；靠近活菌床时逐次回复生命。封床或用火克制。','Telegraphs a spore shot. Recovers beside a live spore bed each turn. Seal the bed or use fire.'),kind:'crawler',behavior:'ranged',hp:18,damage:4,armor:0,period:20,range:4,element:'poison',resists:['poison'],weak:['fire'],inflict:'poison',minDepth:0,color:0x929858,scale:1,sourceKey:'original-alpha5'},
 {id:'repairSpider',name:words('回线维护蛛','Loop-mender'),description:words('近击后退。受损且远离玩家时返回继电器维修；断电或电击可打破循环。','Strikes and retreats. When hurt and away from you, returns to a relay to repair. Isolate the relay or exploit shock weakness.'),kind:'crawler',behavior:'retreat',hp:22,damage:6,armor:2,period:18,range:1,element:'physical',resists:['poison'],weak:['shock'],minDepth:2,color:0x6c9da4,scale:1,sourceKey:'original-alpha5'},
];
export const FEATURES5={
 sporeBed:{name:words('脉动菌床','Pulsing spore bed'),description:words('踩入染毒，附近菌冠回复。可慢慢封闭，或用净菌铃/水封床；火焰烧尽但会灼伤近处操作者。','Poisons on contact and sustains nearby tenders. Seal by hand, bell or water; fire destroys it but burns a nearby operator.')},
 relay:{name:words('故障继电器','Faulty relay'),description:words('接触电击，为维护蛛提供维修点。可手动断电，或用调谐器/解扣杖隔离。','Shocks on contact and repairs loop-menders. Disconnect by hand or isolate with a tuner/unlatching wand.')},
 barricade:{name:words('浅矮横梁','Low crossbeam'),description:words('不能步行穿过，可跳越但不能站在上面；也可花时间拆开。','Blocks walking. Jump over, never onto it, or spend time dismantling it.')},
};
export const EFFECTS5:Record<string,EffectDef>={
 purge5:{id:'purge5',targets:['self','facility'],op:'cure',power:0},
 tune5:{id:'tune5',targets:['item','facility'],op:'repair',power:3},
};
export const FACILITY_EFFECTS5:Record<string,readonly string[]>={sporeBed:['purge5','water','fire'],relay:['tune5','open'],barricade:['open']};
export const REGIONS5=[{id:'fungal',name:words('腐菌矿穴','Mycelial mine'),floors:[0,1,2],monster:'sporeTender',item:'sporeBell',feature:'sporeBed'},
 {id:'workshop',name:words('断层工坊','Faultline workshop'),floors:[3,4,5],monster:'repairSpider',item:'coilKey',feature:'relay'}] as const;
