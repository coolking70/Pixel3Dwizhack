import { translate, type Locale, type TextKey } from '../ui/i18n';
const zh = {
  brigandine: '铆钉甲', wand: '引星法杖', hexer: '咒术师', skirmisher: '游击兵', outpostLink: '哨站试验', mace: '钉锤', towerShield: '塔盾',
  guard: '墓穴守卫', guardDetail: '慢速靠近；蓄力后攻击锁定区域。', crawlerDetail: '靠近后连续近战，注意生命值。',
  potionItem: '治疗药水', 'event.move': '你沿走廊前行。', 'event.climb': '你沿梯子来到另一层走廊。',
  gate: '门厅', armory: '旧军械库', crypt: '封印墓室', unexplored: '尚未探索', routeTitle: '地牢路线', relicGoal: '目标：墓室遗物',
  gateHint: '向右探索；在 10 号梯口下到军械库。', armoryHint: '主线：右侧 17 号梯口下墓室；支线：左翼装备库。', cryptHint: '沿左侧走廊寻找遗物，留意守卫蓄力。', returnHint: '遗物已到手，沿梯子返回门厅左端出口。',
  guardWarning: '守卫蓄力：{ticks} tick 后击中 {x} ± 1 格，预计伤害 {damage}。退离标记区域或换层可躲避；停下思考不耗时。',
  comparisonHint: '下方为当前装备贡献；选项括号依次为攻击 / 防御变化。钉锤降低防御，塔盾降低攻击。',
  'event.hit': '攻击命中，造成 {amount} 点伤害。',
  title: '灰岩哨站', subtitle: 'M02B · 可玩的 3D 房间', baseline: '2D 探索基线', lab: '角色工坊',
  objective: '击败爬行者，拾取铁胸甲，沿梯子上楼，从右侧门离开。',
  paused: '已暂停', pause: '暂停', resume: '继续', busy: '行动呈现中', frozen: '世界静止 · 等待行动',
  loading: '正在装配房间…', graphicsError: '3D 加载失败或图形上下文丢失，请刷新。当前存档不会被覆盖。',
  armor: '防御', damage: '攻击', emptySlot: '卸下', head: '头部', chest: '胸甲', legs: '护腿', mainHand: '主手', offHand: '副手',
  leatherCap: '皮帽', ironHelm: '铁盔', leatherVest: '皮甲', ironCuirass: '铁胸甲', leatherLegs: '皮护腿', ironGreaves: '铁胫甲', sword: '旅人短剑', shield: '木盾',
  gearTitle: '纸娃娃装备', gearCost: '每次穿脱消耗 8 tick，附近敌人也会行动。拾取后才可装备。',
  texture: '像素材质', route: '行动记录', restart: '重新开始', replay: '查看回放', live: '返回当前进度',
  controls: 'A/D 移动 · W/S 攀梯 · 空格攻击 · F 拾取 · Q 喝药 · Esc 暂停',
  won: '已通过哨站', dead: '冒险结束', floor: '楼层', lower: '下层', upper: '上层',
  pickupHint: '附近可拾取', ladderHint: '站在梯子处使用上 / 下', savedRoom: '哨站进度已保存。', loadedRoom: '哨站进度已验证并恢复。',
  eventStart: '你进入了灰岩哨站。', eventWin: '你带着战利品离开了哨站。', equipped: '已装备', removed: '已卸下',
  notes: '无行动，规则不推进。梯子动画、相机和像素材质不改变存档结果。',
};
const en: Record<keyof typeof zh, string> = {
  brigandine: 'Brigandine', wand: 'Star wand', hexer: 'Hexer', skirmisher: 'Skirmisher', outpostLink: 'Outpost study', mace: 'Flanged mace', towerShield: 'Tower shield',
  guard: 'Crypt guard', guardDetail: 'Slow approach. Winds up, then strikes the locked area.', crawlerDetail: 'Closes in for repeated melee attacks. Watch your health.',
  potionItem: 'Healing potion', 'event.move': 'You move along the corridor.', 'event.climb': 'You climb to another corridor.',
  gate: 'Gatehouse', armory: 'Old armory', crypt: 'Sealed crypt', unexplored: 'Unexplored', routeTitle: 'Dungeon route', relicGoal: 'Goal: crypt relic',
  gateHint: 'Explore right. Descend at ladder 10 to the armory.', armoryHint: 'Main route: ladder 17 on the right. Optional gear cache: left wing.', cryptHint: 'Find the relic in the left corridor. Watch for guard windups.', returnHint: 'Relic secured. Climb back to the exit at the left of the gatehouse.',
  guardWarning: 'Guard windup: strike at {x} ± 1 in {ticks} ticks, expected damage {damage}. Leave the marked area or change floors. Thinking costs no time.',
  comparisonHint: 'Current item stats appear below. Option parentheses show attack / armor changes. Mace trades armor for damage; tower shield does the reverse.',
  'event.hit': 'Your attack hits for {amount} damage.',
  title: 'Limestone Outpost', subtitle: 'M02B · Playable 3D room', baseline: '2D baseline', lab: 'Character workshop',
  objective: 'Defeat the crawler, collect the iron cuirass, climb upstairs and leave through the right door.',
  paused: 'Paused', pause: 'Pause', resume: 'Resume', busy: 'Presenting action', frozen: 'World frozen · Your move',
  loading: 'Assembling room…', graphicsError: '3D loading failed or graphics context lost. Refresh to retry. Saved progress is preserved.',
  armor: 'Armor', damage: 'Attack', emptySlot: 'Unequip', head: 'Head', chest: 'Chest', legs: 'Legs', mainHand: 'Main hand', offHand: 'Off hand',
  leatherCap: 'Leather cap', ironHelm: 'Iron helmet', leatherVest: 'Leather vest', ironCuirass: 'Iron cuirass', leatherLegs: 'Leather leggings', ironGreaves: 'Iron greaves', sword: 'Traveler blade', shield: 'Wood shield',
  gearTitle: 'Paper doll', gearCost: 'Each equipment change costs 8 ticks; nearby enemies also act. Collect gear before equipping it.',
  texture: 'Pixel texture', route: 'Action history', restart: 'Restart', replay: 'View replay', live: 'Return to live run',
  controls: 'A/D move · W/S climb · Space attack · F collect · Q drink · Esc pause',
  won: 'Outpost cleared', dead: 'Run ended', floor: 'Level', lower: 'Lower', upper: 'Upper',
  pickupHint: 'Nearby loot', ladderHint: 'Use up / down at the ladder', savedRoom: 'Outpost progress saved.', loadedRoom: 'Outpost progress verified and restored.',
  eventStart: 'You enter the limestone outpost.', eventWin: 'You leave the outpost with your loot.', equipped: 'Equipped', removed: 'Removed',
  notes: 'No action, no rule time. Ladder motion, camera and pixel textures do not affect saved outcomes.',
};
export type RoomKey = keyof typeof zh | TextKey;
const dungeonZh: Partial<Record<RoomKey, string>> = {
  title: '灰岩地牢', subtitle: 'M02C · 三房间地牢', objective: '探索门厅、军械库与墓室，取回星落遗物，再从门厅左端离开。军械库左翼有可选装备支线。',
  won: '遗物归来 · 探险成功', eventStart: '你来到灰岩地牢的门厅。', eventWin: '你带着星落遗物回到门厅，完成了探险。',
  savedRoom: '地牢进度已保存。', loadedRoom: '地牢进度已验证并恢复。', scene: '三房间地牢，可用键盘或下方触屏按钮操作',
  'event.hurt': '敌人击中你，损失 {amount} 点生命。', 'event.defeat': '敌人倒下，获得 {amount} 枚金币。', 'event.miss': '攻击落空。', 'event.dead': '你倒在地牢中。可查看回放，或重新开始。',
};
const dungeonEn: Partial<Record<RoomKey, string>> = {
  title: 'Limestone Dungeon', subtitle: 'M02C · Three-room dungeon', objective: 'Explore the gatehouse, armory and crypt. Recover the relic and return to the left gate. The armory left wing holds optional gear.',
  won: 'Relic returned · Expedition complete', eventStart: 'You enter the limestone gatehouse.', eventWin: 'You return to the gatehouse with the fallen-star relic.',
  savedRoom: 'Dungeon progress saved.', loadedRoom: 'Dungeon progress verified and restored.', scene: 'Three-room dungeon controlled by keyboard or touch buttons below',
  'event.hurt': 'An enemy hits you for {amount} damage.', 'event.defeat': 'An enemy falls. You gain {amount} gold.', 'event.miss': 'Your attack misses.', 'event.dead': 'You fall in the dungeon. Review the replay or start again.',
};
export function roomText(locale: Locale, key: RoomKey, values?: Record<string, string | number>, dungeon = false): string {
  const override = dungeon && (locale === 'zh' ? dungeonZh : dungeonEn)[key];
  if (override) return override.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? ''));
  if (Object.hasOwn(zh, key)) return (locale === 'zh' ? zh : en)[key as keyof typeof zh].replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? ''));
  return translate(locale, key as TextKey, values);
}
