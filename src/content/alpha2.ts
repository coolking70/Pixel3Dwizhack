import type { EffectDef, ItemDef, MonsterDef, FacilityKind, Words } from '../core/alpha2-types';
export const ALPHA2 = { width: 30, floors: 6, sight: 6, hp: 80, mana: 15, manaPeriod: 18, capacity: 16, maxFood: 180, foodPeriod: 30, move: 10, climb: 16, take: 6, wear: 8, wait: 10, action: 12, throw: 14, zap: 16, cast: 16, spellMana: 3, spellDamage: 16, spellRange: 5, altarPrice: 12, chestPrice: 10, chestHp: 7, repairPrice: 0 } as const;
const fx = (id: string, targets: EffectDef['targets'], op: EffectDef['op'], power: number, extra: Partial<EffectDef> = {}): EffectDef => ({ id, targets, op, power, ...extra });
export const EFFECTS: Record<string, EffectDef> = Object.fromEntries([
    fx('heal', ['self', 'enemy'], 'heal', 30), fx('cure', ['self', 'enemy'], 'cure', 0),
    fx('venom', ['self', 'enemy'], 'status', 3, { condition: 'poison', duration: 80 }), fx('sleep', ['self', 'enemy'], 'status', 0, { condition: 'sleep', duration: 45 }),
    fx('clarity', ['self', 'enemy'], 'cure', 1), fx('ward', ['self', 'enemy'], 'status', 4, { condition: 'ward', duration: 120 }),
    fx('water', ['self', 'enemy', 'item', 'facility'], 'water', 12), fx('acid', ['self', 'enemy', 'item'], 'damage', 15, { element: 'acid' }),
    fx('identify', ['item'], 'identify', 0), fx('uncurse', ['item'], 'uncurse', 0), fx('map', ['self'], 'map', 0), fx('enchant', ['item'], 'enchant', 1),
    fx('blink', ['self'], 'blink', 0), fx('summon', ['self'], 'summon', 0),
    fx('fire', ['enemy', 'facility'], 'damage', 19, { element: 'fire' }), fx('cold', ['enemy', 'facility'], 'damage', 14, { element: 'cold' }),
    fx('shock', ['enemy'], 'damage', 17, { element: 'shock' }), fx('open', ['enemy', 'facility'], 'open', 0),
    fx('food', ['self'], 'food', 65), fx('fruit', ['self'], 'food', 45), fx('fungus', ['self'], 'food', 40), fx('meat', ['self'], 'food', 55),
    fx('cook', ['item'], 'cook', 0), fx('repair', ['item'], 'repair', 3), fx('light', ['self'], 'status', 0, { condition: 'light', duration: 200 }), fx('protect', ['item'], 'protect', 0),
    fx('impact', ['enemy'], 'damage', 7, { element: 'physical' }), fx('equip', ['self'], 'status', 0)
].map(e => [e.id, e]));
const item = (id: string, zh: string, en: string, category: ItemDef['category'], description: Words, actions: ItemDef['actions'], extra: Partial<ItemDef> = {}): ItemDef => ({ id, name: { zh, en }, description, category, material: category === 'potion' ? 'glass' : category === 'food' ? 'organic' : category === 'scroll' ? 'cloth' : category === 'wand' ? 'wood' : 'metal', value: 18, weight: 1, minDepth: 0, rarity: 1, tags: [category], sourceKey: 'original-alpha2', actions, ...extra });
const d = (zh: string, en: string): Words => ({ zh, en });
export const ITEMS: ItemDef[] = [
    item('renewal', '复苏药剂', 'Renewal draught', 'potion', d('恢复生命；也可投给生物。祝福增强，诅咒减弱。', 'Restores health, including when thrown. Blessing strengthens it; curses weaken it.'), { drink: 'heal', throw: 'heal' }),
    item('antidote', '清毒药剂', 'Cleansing draught', 'potion', d('喝下或投掷可清除毒素和燃烧。', 'Drink or throw to remove poison and burning.'), { drink: 'cure', throw: 'cure' }),
    item('venom', '苦胆毒液', 'Bitter venom', 'potion', d('喝下会中毒；投掷可使无毒抗的敌人中毒。', 'Poisons the drinker or a thrown target without poison resistance.'), { drink: 'venom', throw: 'venom' }, { value: 14 }),
    item('slumber', '沉眠药剂', 'Slumber draught', 'potion', d('让目标暂时睡眠，受伤会醒来。', 'Puts the target to sleep until hurt or the effect expires.'), { drink: 'sleep', throw: 'sleep' }, { value: 22 }),
    item('clarity', '明目药剂', 'Clarity draught', 'potion', d('解除失明、混乱和睡眠；不会解除诅咒。', 'Clears blindness, confusion and sleep, but not curses.'), { drink: 'clarity', throw: 'clarity' }),
    item('ward', '石肤药剂', 'Stone-skin draught', 'potion', d('暂时增加防御和火抗；负面祝福状态缩短持续时间。', 'Grants temporary armor and fire resistance; a curse shortens duration.'), { drink: 'ward', throw: 'ward' }, { value: 24 }),
    item('water', '净水', 'Clear water', 'potion', d('灭火、浇弱火生物。祝福水可对物品解咒，诅咒水会诅咒物品。', 'Extinguishes fire and harms fire creatures. Blessed water uncurses items; cursed water curses them.'), { drink: 'water', throw: 'water', apply: 'water' }, { value: 8 }),
    item('acid', '蚀刻酸', 'Etching acid', 'potion', d('伤害生物并腐蚀未防护金属；涂抹可损坏金属物品。', 'Damages creatures and corrodes unprotected metal; applying it corrodes a metal item.'), { drink: 'acid', throw: 'acid', apply: 'acid' }, { value: 20, minDepth: 1 }),
    item('insight', '洞察卷轴', 'Insight scroll', 'scroll', d('鉴定指定背包物品的真名、祝福、强化与充能。', 'Identifies a bag item, including blessing, enchantment and charges.'), { read: 'identify' }, { value: 20 }),
    item('release', '解缚卷轴', 'Release scroll', 'scroll', d('解除指定装备诅咒并揭示其祝福状态。', 'Uncurses one item and reveals its blessing.'), { read: 'uncurse' }, { value: 24 }),
    item('survey', '测绘卷轴', 'Survey scroll', 'scroll', d('揭示当前层地形和设施，不揭示远处生物或物品。', 'Maps this floor and reveals features, without revealing distant actors or items.'), { read: 'map' }, { value: 16 }),
    item('temper', '淬炼卷轴', 'Tempering scroll', 'scroll', d('强化指定装备，最高 +3；诅咒卷轴反而降低强化。', 'Enchants equipment up to +3. A cursed scroll reduces enchantment.'), { read: 'enchant' }, { value: 35, minDepth: 1 }),
    item('shift', '移步卷轴', 'Shifting scroll', 'scroll', d('传送到本层无敌人的安全格；诅咒时落到最远可用格。', 'Relocates to an empty safe tile on this floor; a curse chooses the farthest available tile.'), { read: 'blink' }, { value: 18 }),
    item('calling', '回响卷轴', 'Calling scroll', 'scroll', d('在附近召来一只矿穴爬行者；会消耗时间并带来风险。', 'Summons a mine crawler nearby, costing time and creating danger.'), { read: 'summon' }, { value: 12 }),
    item('cinder', '烬光法杖', 'Cinder wand', 'wand', d('消耗充能射出火焰，可引燃生物或未燃尽火区。投掷只造成撞击并落地。', 'Spends a charge on fire, igniting creatures or a fire bed. Throwing only impacts and drops it.'), { zap: 'fire', throw: 'impact' }, { charges: 5, value: 42, minDepth: 0 }),
    item('rime', '霜纹法杖', 'Rime wand', 'wand', d('寒冰伤害并减速，可扑灭火区。', 'Cold damage and slowing; also extinguishes fire beds.'), { zap: 'cold', throw: 'impact' }, { charges: 5, value: 40 }),
    item('arc', '电弧法杖', 'Arc wand', 'wand', d('闪电攻击；潮湿目标承受更多伤害。', 'Lightning hits wet targets harder.'), { zap: 'shock', throw: 'impact' }, { charges: 4, value: 44, minDepth: 1 }),
    item('mending', '愈合法杖', 'Mending wand', 'wand', d('消耗充能治疗自己或生物。', 'Spends a charge to heal yourself or another creature.'), { zap: 'heal', throw: 'impact' }, { charges: 4, value: 38 }),
    item('latch', '解扣法杖', 'Latch wand', 'wand', d('可打开邻近门闩或箱子；对生物造成减速。', 'Opens nearby gates or chests; slows creatures instead.'), { zap: 'open', throw: 'impact' }, { charges: 4, value: 32 }),
    item('sword', '巡路剑', 'Pathfinder sword', 'weapon', d('10 tick 出手的均衡金属剑。', 'A balanced metal sword with a 10-tick attack.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'sword', damage: 9, time: 10, range: 1, value: 26, weight: 3 }),
    item('knife', '短匕', 'Quick knife', 'weapon', d('伤害较低但只需 7 tick。', 'Lower damage, but attacks in 7 ticks.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'sword', damage: 6, time: 7, range: 1, value: 16, weight: 1 }),
    item('maul', '破岩锤', 'Rock maul', 'weapon', d('20 tick，抵消 5 护甲；适合重甲敌人。', '20 ticks, ignoring 5 armor; useful against plated enemies.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'mace', damage: 13, time: 20, range: 1, pierce: 5, value: 32, weight: 6 }),
    item('spear', '守望长矛', 'Watch spear', 'weapon', d('两格攻击范围，耗时 14 tick。', 'Reaches two tiles and costs 14 ticks.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'sword', damage: 8, time: 14, range: 2, material: 'wood', value: 25, weight: 3 }),
    item('bow', '星弦弓', 'Starstring bow', 'weapon', d('四格物理远射，耗时 16 tick；近距离伤害相同。', 'Four-tile physical shots, 16 ticks; same damage at close range.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'wand', damage: 7, time: 16, range: 4, material: 'wood', value: 30, weight: 2 }),
    item('fireblade', '余烬剑', 'Ember blade', 'weapon', d('火焰攻击，克制畏火生物，但难伤火灵。', 'Deals fire damage: strong against vulnerable creatures, weak against fire spirits.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'sword', damage: 10, time: 12, range: 1, element: 'fire', minDepth: 2, value: 45, weight: 3 }),
    item('silverblade', '月银剑', 'Moonsilver blade', 'weapon', d('银属性伤害可克制墓灵。', 'Silver damage counters crypt shades.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'sword', damage: 8, time: 10, range: 1, element: 'silver', value: 38, minDepth: 1, weight: 3 }),
    item('staff', '引星杖', 'Starcalling staff', 'weapon', d('近战较弱，装备后 R 消耗法力施法；独立于充能法杖。', 'Weak melee. Equip for R mana casting, independent of charged wands.'), { equip: 'equip', throw: 'impact' }, { slot: 'mainHand', visual: 'wand', damage: 4, time: 12, range: 1, material: 'wood', value: 30, weight: 2 }),
    item('brigandine', '铆钉甲', 'Brigandine', 'armor', d('均衡护甲，金属怕酸蚀。', 'Balanced armor; metal is vulnerable to acid.'), { equip: 'equip' }, { slot: 'chest', visual: 'brigandine', armor: 4, value: 32, weight: 5 }),
    item('plate', '岩钢胸甲', 'Rocksteel plate', 'armor', d('强力防护，修复和防腐可延长使用。', 'Strong protection; repair and proofing preserve it.'), { equip: 'equip' }, { slot: 'chest', visual: 'ironCuirass', armor: 6, value: 42, weight: 8 }),
    item('leather', '菌皮外衣', 'Fungal hide', 'armor', d('较轻，提供毒抗且不会被金属腐蚀损坏。', 'Light and poison resistant; unaffected by metal corrosion.'), { equip: 'equip' }, { slot: 'chest', visual: 'leatherVest', armor: 2, resists: ['poison'], material: 'organic', value: 26, weight: 2 }),
    item('cap', '旅人兜帽', 'Traveler hood', 'armor', d('轻型防护，不受酸蚀金属影响。', 'Light protection, immune to metal corrosion.'), { equip: 'equip' }, { slot: 'head', visual: 'leatherCap', armor: 1, material: 'cloth', value: 12 }),
    item('helm', '铁盔', 'Iron helm', 'armor', d('保护头部，提高防御。', 'Protects the head and raises armor.'), { equip: 'equip' }, { slot: 'head', visual: 'ironHelm', armor: 2, value: 22, weight: 3 }),
    item('boots', '霜地护腿', 'Rime greaves', 'armor', d('提供冷抗和防护。', 'Cold resistance and protection.'), { equip: 'equip' }, { slot: 'legs', visual: 'ironGreaves', armor: 2, resists: ['cold'], value: 26, weight: 3 }),
    item('shield', '木圆盾', 'Round shield', 'armor', d('可靠防护，不会被酸腐蚀金属。', 'Reliable wooden protection, not subject to metal corrosion.'), { equip: 'equip' }, { slot: 'offHand', visual: 'shield', armor: 2, material: 'wood', value: 20, weight: 2 }),
    item('tower', '塔盾', 'Tower shield', 'armor', d('更强的金属防护，易受酸蚀。', 'Stronger metal protection, vulnerable to corrosion.'), { equip: 'equip' }, { slot: 'offHand', visual: 'towerShield', armor: 4, value: 34, weight: 5 }),
    item('emberRing', '炭纹戒指', 'Ember ring', 'accessory', d('提供火抗；诅咒时增加饥饿消耗。', 'Grants fire resistance; a curse also increases hunger.'), { equip: 'equip' }, { slot: 'charm', resists: ['fire'], value: 35, material: 'stone', minDepth: 1 }),
    item('hungerCharm', '贪食护符', 'Ravenous charm', 'accessory', d('增加 4 近战伤害，但饱食消耗加倍；诅咒时更甚。', 'Adds 4 melee damage but doubles hunger consumption, worse when cursed.'), { equip: 'equip' }, { slot: 'charm', damage: 4, value: 28, material: 'stone', minDepth: 1 }),
    item('ration', '干粮', 'Trail ration', 'food', d('恢复 65 饱食，不会变质。', 'Restores 65 satiety and does not spoil.'), { eat: 'food' }, { value: 12 }),
    item('fruit', '洞果', 'Cave fruit', 'food', d('恢复 45 饱食；会变质，烹饪后可重新保存。', 'Restores 45 satiety; spoils, but cooking preserves it again.'), { eat: 'fruit' }, { perishes: true, value: 9 }),
    item('mushroom', '斑纹菌', 'Speckled fungus', 'food', d('恢复 40 饱食，生吃造成混乱；烹饪可去毒。', 'Restores 40 satiety; raw fungus confuses, cooking detoxifies it.'), { eat: 'fungus' }, { perishes: true, value: 7 }),
    item('meat', '鲜肉', 'Fresh meat', 'food', d('来自部分怪物。恢复饱食，放久会致病；先烹饪更安全。', 'Dropped by some creatures. Restores satiety but can spoil and poison; cook it first.'), { eat: 'meat' }, { perishes: true, value: 8 }),
    item('pot', '行军锅', 'Travel pot', 'tool', d('消耗一次耐用次数烹饪指定食品，去毒并延长保鲜。', 'Spends one use to cook food, detoxify it and extend freshness.'), { apply: 'cook' }, { charges: 4, value: 24, weight: 3 }),
    item('kit', '修理工具', 'Repair kit', 'tool', d('消耗一次使用次数，修复指定装备三点耐久。', 'Spends one use to restore three durability to equipment.'), { apply: 'repair' }, { charges: 4, value: 22, weight: 2 }),
    item('lantern', '辉石灯', 'Glowstone lantern', 'tool', d('消耗一次使用次数，暂时增加视野并有助发现陷阱。', 'Spends one use to increase sight temporarily and reveal traps.'), { apply: 'light' }, { charges: 3, value: 20, material: 'stone', weight: 2 }),
    item('salve', '防腐膏', 'Proofing salve', 'tool', d('消耗一次使用次数，为金属装备添加防腐层。', 'Spends one use to proof metal equipment against corrosion.'), { apply: 'protect' }, { charges: 3, value: 18 })
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const mon = (id: string, zh: string, en: string, behavior: MonsterDef['behavior'], extra: Partial<MonsterDef>): MonsterDef => ({ id, name: d(zh, en), description: d('观察意图与抗性，选择道具或移动反制。', 'Watch its intent and resistances; counter with items or movement.'), kind: 'crawler', behavior, hp: 22, damage: 7, armor: 0, period: 30, range: 1, element: 'physical', resists: [], weak: [], minDepth: 0, color: 0x919b72, scale: 1, sourceKey: 'original-alpha2', ...extra });
export const MONSTERS: MonsterDef[] = [
    mon('crawler', '矿穴爬行者', 'Mine crawler', 'chase', { description: d('近身追击，可用睡眠或远程攻击。', 'Chases into melee; counter with sleep or ranged attacks.') }),
    mon('venomfang', '毒牙虫', 'Venomfang', 'chase', { inflict: 'poison', resists: ['poison'], minDepth: 1, color: 0x4b9d69, description: d('咬击带毒，毒液无效；清毒药剂或毒抗可反制。', 'Venomous bite and poison immunity; use cleansing or poison resistance.') }),
    mon('sentinel', '墓室卫士', 'Crypt sentinel', 'guard', { kind: 'guard', hp: 38, damage: 13, armor: 4, period: 36, minDepth: 1, color: 0x97948c, description: d('蓄力后攻击锁定点三格；重锤可破甲。', 'Winds up a three-tile attack; mauls pierce its armor.') }),
    mon('hexer', '黯星咒师', 'Darkstar hexer', 'ranged', { kind: 'hexer', hp: 25, range: 5, element: 'shock', damage: 11, period: 34, minDepth: 1, color: 0x8570af, description: d('瞄准一个格子后施法。移开或关门可躲避。', 'Locks one tile before casting. Move away or close a door.') }),
    mon('raider', '掠路者', 'Road raider', 'retreat', { kind: 'skirmisher', hp: 25, period: 27, minDepth: 1, color: 0xae7952, description: d('攻击后后撤。长矛、投掷或远射可追击。', 'Retreats after striking. Use reach, thrown items or ranged shots.') }),
    mon('emberling', '烬灵', 'Emberling', 'chase', { hp: 25, element: 'fire', resists: ['fire'], weak: ['cold'], inflict: 'burn', minDepth: 2, color: 0xeb803b, description: d('火抗且畏冷；水能浇弱它，火攻击无效。', 'Immune to fire and vulnerable to cold; water harms it.') }),
    mon('rimebeast', '霜壳兽', 'Rime-shell', 'chase', { hp: 32, armor: 2, resists: ['cold'], weak: ['fire'], minDepth: 2, color: 0x7cbac9, scale: 1.15, description: d('耐寒畏火，霜杖难伤它。', 'Cold resistant and fire vulnerable.') }),
    mon('acidmaw', '蚀铁兽', 'Acid maw', 'ranged', { hp: 25, range: 3, element: 'acid', resists: ['acid'], minDepth: 2, color: 0xa8bd40, description: d('锁格喷酸，会腐蚀金属；涂防腐或穿非金属护甲。', 'Aimed acid corrodes metal. Proof it or wear nonmetal armor.') }),
    mon('shade', '残月墓灵', 'Moon shade', 'chase', { kind: 'hexer', hp: 28, resists: ['physical', 'poison'], weak: ['silver'], minDepth: 3, color: 0x59797e, description: d('耐普通物理与毒素，畏银和元素攻击。', 'Resists physical attacks and poison; use silver or elements.') }),
    mon('scavenger', '胆怯拾荒者', 'Timid scavenger', 'flee', { kind: 'skirmisher', hp: 18, damage: 5, period: 25, color: 0xc39b72, description: d('生命低时逃跑；可放过或远程追击。', 'Flees when wounded; let it go or finish at range.') }),
    mon('brood', '孢群母体', 'Spore brood', 'summon', { hp: 34, damage: 6, range: 4, period: 45, resists: ['poison'], weak: ['fire'], minDepth: 2, color: 0x9b73a0, scale: 1.25, description: d('先蓄力再召唤，最多两只幼虫；睡眠或击杀可打断。', 'Winds up before summoning at most two larvae; sleep or defeat interrupts it.') }),
    mon('warden', '星落守护者', 'Fallen Star warden', 'guard', { kind: 'guard', hp: 88, damage: 17, armor: 5, period: 38, minDepth: 5, color: 0xc6a66d, scale: 1.15, description: d('三格重击保护遗物。破甲、法术和避让均有效。', 'Guards the relic with a three-tile strike. Pierce, cast or evade.') })
];
export const MONSTER_BY_ID = Object.fromEntries(MONSTERS.map(m => [m.id, m]));
export const FACILITIES: Record<Exclude<FacilityKind, 'sporeBed' | 'relay' | 'barricade' | 'emberVent' | 'boneChime'>, {
    name: Words;
    description: Words;
}> = {
    merchant: { name: d('巡回商摊', 'Wayfarer shop'), description: d('有限金币和库存。买卖有价差，未知物品报价只作线索；出售不鉴定。', 'Finite stock and funds. Buy/sell spread; unknown prices offer clues, not identification.') },
    altar: { name: d('净化祭坛', 'Cleansing altar'), description: d('支付 12 金币，为指定背包物品解咒并揭示祝福状态。', 'Pay 12 gold to uncurse a bag item and reveal its blessing.') },
    fountain: { name: d('静泉', 'Still spring'), description: d('一次性恢复 25 生命并解毒。', 'One use: restores 25 health and cures poison.') },
    chest: { name: d('封印储箱', 'Sealed chest'), description: d('支付 10 金币或损失 7 生命打开；也可使用开锁法杖。', 'Pay 10 gold or 7 health, or use a latch wand. Contents remain on the ground.') },
    trap: { name: d('针刺机关', 'Needle trap'), description: d('搜索或照明可以发现；邻近时可花时间拆除，触发会伤害并中毒。', 'Search or light reveals it. Disarm nearby at a time cost; triggering hurts and poisons.') },
    garden: { name: d('菌果园', 'Fungal garden'), description: d('采集一次食物，采集会消耗时间；留意变质。', 'Harvest food once, at a time cost. Watch freshness.') },
    campfire: { name: d('营火', 'Campfire'), description: d('免费烹饪食品，但需要时间；去除菌毒并延长保鲜。', 'Cook food for no gold, but spend time. Removes fungus toxin and extends freshness.') },
    hazard: { name: d('余烬火区', 'Ember bed'), description: d('跨过会受火伤；可用水或冷魔法熄灭，也可利用火抗。', 'Crossing burns. Extinguish with water or cold, or use fire resistance.') }
};
// Localized copy is excluded from the mechanics identity; numerical and behavior data remain included.
export const ALPHA2_CONTENT = { config: ALPHA2, effects: EFFECTS, items: ITEMS.map(({ name: _, description: __, ...i }) => i), monsters: MONSTERS.map(({ name: _, description: __, ...m }) => m), facilities: Object.keys(FACILITIES) };
