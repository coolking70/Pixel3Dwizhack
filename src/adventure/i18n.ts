import { roomText, type RoomKey } from '../room/i18n';
import type { Locale } from '../ui/i18n';
const zh = {
  combatLab: '战斗检查场', title: '星落远征', subtitle: '灰岩地牢 · 六层冒险', objective: '深入墓室，击败遗物守护者，取回星落遗物，再返回第一层左端出口。', 'note.collect': '你收起了一件物品。',
  newRun: '新的远征', start: '进入地牢', seed: '地图种子', random: '随机种子', seedError: '种子须为 1 至 4294967295 的整数。',
  welcome: '你不行动，世界就静止。', intro: '沿连续走廊探索，在梯口上下楼。靠近敌人后可攻击，也可撞向敌人出手；没有跳跃操作。',
  bag: '背包', help: '冒险指南', settings: '设置', close: '返回冒险', take: '拾取 · 6', wear: '装备 · 8', drop: '丢下 · 4', use: '饮用 · 10', identify: '鉴定 · 10', unequip: '卸下 · 8',
  bagHint: '装备也占容量。浏览不耗时，按钮后的数字是行动消耗的 tick；附近敌人会同时行动。',
  unknown: '未鉴定药剂', flask0: '琥珀瓶', flask1: '青玉瓶', flask2: '紫晶瓶', flask3: '乳白瓶',
  healing: '治疗药剂', antidote: '解毒药剂', might: '力量', ward: '护体', poison: '中毒', scroll: '鉴定卷轴',
  healingDetail: '恢复最多 28 点生命。', antidoteDetail: '解除中毒。', mightDetail: '攻击 +4，持续 100 tick。', wardDetail: '防御 +3，持续 100 tick。',
  unknownDetail: '饮用会揭示效果；也可消耗一张卷轴安全鉴定。同种瓶色在本局效果一致。', scrollDetail: '在未知药剂上选择鉴定，消耗一张卷轴。',
  poisonDetail: '每 20 tick 损失 2 点生命；解毒剂或圣坛可解除。', remaining: '剩余 {ticks} tick',
  nearby: '脚边物品', nothing: '附近没有物品。', shrine: '圣坛 · 12', shrineHint: '一次性恢复全部生命并解毒。',
  noEffects: '状态正常', boss: '遗物守护者', venom: '毒性爬行者', supply: '补给走廊', nest: '爬行者巢穴', watch: '守卫哨道',
  routeHint: '寻找梯子向下探索。走廊两端可能有装备、药剂或圣坛。', relicHint: '遗物已取得：沿梯子回到第一层左端。',
  helpMove: 'A / D 或方向键移动；W / S 在梯口攀梯；空格攻击；F 拾取；Q 使用已知治疗药剂；B 背包；H 指南；Esc 暂停。',
  helpCombat: '守卫蓄力时，橙色区域是下一次攻击范围。退离该区域或换层可躲避。爬行者会直接攻击，深层爬行者带毒。停下来查看背包和思考都不耗时。',
  helpItems: '拾取后再装备。更换装备、饮用药剂、鉴定和丢弃都会推进时间。装满背包时先卸下并丢弃旧装备。遗物不占背包容量。',
  helpSave: '本地存档需手动保存。可导出文件备份；导入会验证完整行动历史。回放只读，返回当前进度可继续冒险。新局不会覆盖已保存的存档。',
  audio: '合成音效', volume: '音量', low: '低画质（关闭阴影，降低像素密度）', audioError: '浏览器未能启用音效，可再次点击开关。',
  export: '导出存档', import: '导入存档', exported: '存档已导出。', savedRoom: '远征进度已保存。', loadedRoom: '远征进度已验证并恢复。',
  won: '遗物归来 · 远征成功', dead: '倒在地牢 · 远征结束', result: '本次远征', kills: '击败敌人', collected: '拾取次数', actions: '行动次数',
  eventStart: '你走入灰岩地牢，寻找星落遗物。', eventWin: '你带着星落遗物重返入口。',
  'note.identify': '已识别：{item}。', 'note.poison': '你中毒了。', 'note.might': '力量药剂生效。', 'note.ward': '护体药剂生效。', 'note.cure': '毒素已清除。', 'note.shrine': '圣坛恢复生命并清除毒素。', 'note.drop': '你放下了一件物品。',
  scene: '六层地牢，可用键盘或触屏操作', idleNote: '行动费用在提交时结算；动画只呈现结果。暂停会结束当前动画，不会撤销已经发生的行动。',
  confirmNew: '开始后会替换当前未保存进度。', equippedTag: '穿戴中', compare: '替换后攻击 {damage} / 防御 {armor}', floorLabel: '第 {floor} 层', fullRoute: '探索路线',
};
const en: Record<keyof typeof zh, string> = {
  combatLab: 'Combat inspection', title: 'Fallen Star Expedition', subtitle: 'Limestone dungeon · Six-floor adventure', objective: 'Defeat the relic guardian, recover the fallen star, then return to the left exit on floor one.', 'note.collect': 'You collect an item.',
  newRun: 'New expedition', start: 'Enter dungeon', seed: 'Map seed', random: 'Random seed', seedError: 'Enter an integer from 1 to 4294967295.',
  welcome: 'When you stop, the world stops.', intro: 'Explore continuous corridors and use ladders between floors. Attack nearby enemies or walk into them to strike. There is no jump control.',
  bag: 'Inventory', help: 'Guide', settings: 'Settings', close: 'Return to adventure', take: 'Take · 6', wear: 'Equip · 8', drop: 'Drop · 4', use: 'Drink · 10', identify: 'Identify · 10', unequip: 'Unequip · 8',
  bagHint: 'Equipped items count toward capacity. Browsing is free. Button numbers are tick costs; nearby enemies act during that time.',
  unknown: 'Unidentified potion', flask0: 'Amber flask', flask1: 'Jade flask', flask2: 'Amethyst flask', flask3: 'Ivory flask',
  healing: 'Healing potion', antidote: 'Antidote', might: 'Might', ward: 'Ward', poison: 'Poison', scroll: 'Identify scroll',
  healingDetail: 'Restores up to 28 health.', antidoteDetail: 'Removes poison.', mightDetail: '+4 attack for 100 ticks.', wardDetail: '+3 armor for 100 ticks.',
  unknownDetail: 'Drinking reveals its effect. A scroll identifies it safely. Matching flask colors share an effect within this run.', scrollDetail: 'Choose Identify on an unknown potion to spend one scroll.',
  poisonDetail: 'Loses 2 health every 20 ticks. An antidote or shrine removes poison.', remaining: '{ticks} ticks remaining',
  nearby: 'Nearby items', nothing: 'No items nearby.', shrine: 'Use shrine · 12', shrineHint: 'Restores all health and removes poison, once.',
  noEffects: 'Healthy', boss: 'Relic guardian', venom: 'Venom crawler', supply: 'Supply corridor', nest: 'Crawler nest', watch: 'Guard passage',
  routeHint: 'Find ladders and explore below. Corridor ends may hold equipment, potions or shrines.', relicHint: 'Relic secured: climb back to the left exit on floor one.',
  helpMove: 'A / D or arrows to move; W / S at ladders; Space to attack; F to collect; Q for known healing potions; B inventory; H guide; Esc pause.',
  helpCombat: 'An orange area marks a guard’s next attack. Step outside it or change floors to evade. Crawlers attack directly; deep crawlers carry venom. Browsing and thinking cost no time.',
  helpItems: 'Collect before equipping. Equipment changes, potions, identification and drops advance time. When full, unequip and drop old gear. The relic takes no inventory space.',
  helpSave: 'Save manually in this browser or export a backup. Imports verify the complete action history. Replay is read-only; return to live progress to continue. New runs leave your local save intact.',
  audio: 'Synthesized effects', volume: 'Volume', low: 'Low quality (no shadows, reduced pixel density)', audioError: 'Audio could not start. Try toggling it again.',
  export: 'Export save', import: 'Import save', exported: 'Save exported.', savedRoom: 'Expedition saved.', loadedRoom: 'Expedition verified and restored.',
  won: 'Relic returned · Expedition complete', dead: 'Fallen in the dungeon · Run ended', result: 'Expedition results', kills: 'Enemies defeated', collected: 'Items collected', actions: 'Actions',
  eventStart: 'You enter the limestone dungeon in search of the fallen star.', eventWin: 'You return to the entrance with the fallen-star relic.',
  'note.identify': 'Identified: {item}.', 'note.poison': 'You are poisoned.', 'note.might': 'Might potion takes effect.', 'note.ward': 'Ward potion takes effect.', 'note.cure': 'Poison removed.', 'note.shrine': 'The shrine restores health and removes poison.', 'note.drop': 'You put down an item.',
  scene: 'Six-floor dungeon with keyboard and touch controls', idleNote: 'Action costs settle on submission. Animation presents the result. Pausing ends the animation without undoing the committed action.',
  confirmNew: 'Starting replaces your current unsaved progress.', equippedTag: 'Equipped', compare: 'After replacement: attack {damage} / armor {armor}', floorLabel: 'Floor {floor}', fullRoute: 'Exploration route',
};
export type AdventureKey = keyof typeof zh | RoomKey;
export function adventureText(locale: Locale, key: AdventureKey, values?: Record<string, string | number>): string {
  if (Object.hasOwn(zh, key)) return (locale === 'zh' ? zh : en)[key as keyof typeof zh].replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? ''));
  return roomText(locale, key as RoomKey, values, true);
}
