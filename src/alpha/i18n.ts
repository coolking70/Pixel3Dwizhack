import {adventureText,type AdventureKey} from '../adventure/i18n';
import type {Locale} from '../ui/i18n';
const zh={
 title:'星落远征 · Alpha',subtitle:'ALPHA 0.10.0 / 双径地牢',alphaLink:'Alpha · 双径远征',legacyLink:'M06 六层基线',
 'event.windup':'敌人开始蓄力，请查看预警区域。',idleNote:'停止输入即可思考。进度需手动保存；导出存档可用于备份和跨浏览器继续。',
 intro:'你不行动，世界就静止。选择起始配装，在两条梯路之间规划探索；门闩、敌人预警和补给决定风险。没有跳跃。',
 loadout:'起始配装',vanguard:'先遣者 · 剑盾',breaker:'破阵者 · 重锤铁甲',channeler:'引星者 · 法杖',
 vanguardDetail:'每次剑击 10 tick，均衡防护。适合快速出手后退离预警区域。',breakerDetail:'每次重锤攻击 20 tick，抵消 4 点敌方护甲。高防御但行动慢，留意蓄力截止。',channelerDetail:'R 施法，射程 5 格；消耗 3 法力和 18 tick，无视护甲。法力每 20 tick 恢复 1；近战较弱。',
 mana:'法力',cast:'施法 · R',spellStats:'射程 {range} · 消耗 {mana} 法力 / {ticks} tick',attackTime:'攻击耗时',manaHint:'再过 {ticks} tick 恢复 1 点法力；停下时不会自动恢复。',
 helpMove:'A / D 移动，W / S 在梯口上下，空格近战，R 法杖施法，F 拾取/附近门闩，Q 治疗药剂，B 背包，H 指南，Esc 暂停。触屏使用画面下方按钮。',
 helpCombat:'守卫攻击锁定点 ±1 格；咒术师只打锁定的一格，移动或关门可以躲避。游击兵攻击后会后撤。剑出手快，重锤破甲，法杖远程消耗法力。浏览背包和思考不耗时。',
 helpRoutes:'每层之间有两条梯路。普通门可开关；有锁门闩需同层拉杆开启，也可从上一层另一侧梯子绕行。梯口被敌人占据时换另一条路。补给箱可支付金币或生命开启，奖励留在地上。',
 routeHint:'探索左右两条梯路。锁住的门闩可以寻找拉杆，或沿另一条梯路绕行。',
 hexerWarning:'咒术师瞄准 {x} 格：{ticks} tick 后释放，预计伤害 {damage}。移动到另一格或关闭中间的门。',
 hexerDetail:'隔空瞄准后施法；攻击只命中锁定格，穿透一半防御。',skirmisherDetail:'近身攻击后后撤；追至端部或使用远程攻击。',
 minimap:'已探索路线',mapLegend:'● 当前位置　│ 梯子　■ 门闩',mechanisms:'附近机关与补给',nothingHere:'附近没有可操作机关。',
 openDoor:'开门 · 8',closeDoor:'关门 · 8',lockedDoor:'门闩已锁 · 寻找拉杆或绕路',lever:'拉动门闩 · 10',cache:'封存补给',cacheHint:'开启后获得治疗药剂与一件 +1 装备。两种代价任选其一；都会消耗 10 tick。',payCache:'支付 12 金币',forceCache:'损失 8 生命',gold:'金币',
 doorOpen:'你打开了通道门。',doorClosed:'你关上了通道门。',leverUsed:'拉杆打开了本层门闩。',cacheOpened:'补给封印解除，奖励留在地上。',
 savedRoom:'Alpha 进度已保存。',loadedRoom:'Alpha 进度已验证并恢复。',
 gearTiming:'近战耗时 {ticks} tick，破甲 {pierce}。',wandHint:'装备后可用 R 施法；法术基础伤害 14，射程 5，消耗 3 法力 / 18 tick。',
 onboarding:'首次探索：用 A/D 行走，拾取脚边药剂，再寻找梯子。遇到敌人时停下，先看预警与生命。',
};
const en:Record<keyof typeof zh,string>={
 title:'Fallen Star · Alpha',subtitle:'ALPHA 0.10.0 / Twin-route dungeon',alphaLink:'Alpha · Twin-route expedition',legacyLink:'M06 baseline',
 'event.windup':'An enemy winds up. Check the marked danger area.',idleNote:'Stop input to think. Save progress manually; export a backup to continue in another browser.',
 intro:'When you stop, the world stops. Choose your starting gear and explore two ladder routes. Gates, enemy tells and supplies shape your decisions. No jumping.',
 loadout:'Starting loadout',vanguard:'Vanguard · sword and shield',breaker:'Breaker · mace and plate',channeler:'Channeler · star wand',
 vanguardDetail:'Sword attacks cost 10 ticks, with balanced protection. Strike quickly and step away from marked danger.',breakerDetail:'Mace attacks cost 20 ticks and ignore 4 enemy armor. Strong protection, slower actions: watch windup deadlines.',channelerDetail:'R casts up to 5 tiles, ignoring armor. Costs 3 mana and 18 ticks. Regenerates 1 mana per 20 ticks; weak in melee.',
 mana:'Mana',cast:'Cast · R',spellStats:'Range {range} · {mana} mana / {ticks} ticks',attackTime:'Attack time',manaHint:'1 mana in {ticks} ticks. Waiting without taking an action does not regenerate mana.',
 helpMove:'A / D move, W / S climb at ladders, Space melee, R cast with a wand, F collect / nearby mechanism, Q healing potion, B inventory, H guide, Esc pause. Touch controls are below the scene.',
 helpCombat:'Guards hit their locked tile ±1. Hexers hit only the locked tile: sidestep or close an intervening door. Skirmishers retreat after striking. Swords are fast, maces pierce armor, wands spend mana at range. Browsing and thinking are free.',
 helpRoutes:'Each floor pair has two ladder routes. Ordinary doors toggle; locked gates need a lever on that floor, or a detour via the other ladder above. Try the other route if an enemy blocks a landing. Supply caches accept gold or health and leave rewards on the ground.',
 routeHint:'Explore both ladder routes. Find a lever for locked gates, or detour along the other ladder route.',
 hexerWarning:'Hexer targets tile {x}: releases in {ticks} ticks, expected damage {damage}. Move to another tile or close an intervening door.',
 hexerDetail:'Aims before casting at one locked tile; ignores half your armor.',skirmisherDetail:'Strikes, then retreats. Corner it or attack at range.',
 minimap:'Explored routes',mapLegend:'● You　│ Ladder　■ Gate',mechanisms:'Nearby mechanisms and supplies',nothingHere:'No mechanisms within reach.',
 openDoor:'Open · 8',closeDoor:'Close · 8',lockedDoor:'Locked gate · find lever or detour',lever:'Pull lever · 10',cache:'Sealed supplies',cacheHint:'Contains a healing potion and +1 equipment. Choose either payment; opening costs 10 ticks.',payCache:'Pay 12 gold',forceCache:'Lose 8 health',gold:'Gold',
 doorOpen:'You open the passage door.',doorClosed:'You close the passage door.',leverUsed:'The lever opens this floor’s gate.',cacheOpened:'The cache opens. Rewards remain on the ground.',
 savedRoom:'Alpha saved.',loadedRoom:'Alpha verified and restored.',gearTiming:'Melee costs {ticks} ticks, ignores {pierce} armor.',wandHint:'Equip to cast with R: base damage 14, range 5, costs 3 mana / 18 ticks.',
 onboarding:'First steps: A/D to walk, collect the nearby potion, then find a ladder. When enemies appear, stop and check their tells and your health.',
};
export type AlphaKey=keyof typeof zh|AdventureKey;
export function alphaText(locale:Locale,key:AlphaKey,values?:Record<string,string|number>):string{
 if(Object.hasOwn(zh,key))return(locale==='zh'?zh:en)[key as keyof typeof zh].replace(/\{(\w+)\}/g,(_,token:string)=>String(values?.[token]??''));
 return adventureText(locale,key as AdventureKey,values);
}
