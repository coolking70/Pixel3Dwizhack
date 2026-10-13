const zh = {
  title: '角色工坊', subtitle: '02A / 方块人形 · 护甲轮廓 · 骨骼握持', game: '返回探索原型',
  loading: '正在装配骨骼与动作…', ready: '动作已就绪', error: '无法加载角色或图形上下文已丢失，请刷新重试。',
  compare: '皮甲 / 铁甲对照', outfit: '单人装备', cloth: '布衣', leather: '皮甲', plate: '铁甲', brigandine: '铆钉甲',
  helmet: '头盔', sword: '右手剑', shield: '左手盾', monochrome: '单色检查',
  motion: '动作', idle: '站立', walk: '行走', attack: '单手劈砍', block: '格挡', climb: '攀爬占位',
  play: '播放', pause: '暂停', phase: '动作相位', angle: '观察角度', front: '正面', quarter: '斜侧', side: '侧面', back: '背面',
  imported: '真实导入动作 · KayKit / CC0', authored: '自制攀爬占位 · 剑盾收背 · 尚未完成梯子贴合',
  armorTitle: '从轮廓区分材质', armorBody: '皮甲：贴身护胸、交叉绑带与腰袋。铁甲：宽肩、凸起胸板、护颈与分片裙甲。关闭颜色后，仍应看出两者差异。',
  gripTitle: '握住柄，而非悬在手边', gripBody: '剑柄穿过包握的手指，护手位于拳外。盾的内侧握把对齐左掌。可关闭盾牌、暂停劈砍并转动角色，检查手腕和穿插。',
  note: '这是独立美术试验，尚未替换游戏画面。四个公模动作已适配当前骨骼；攀爬仍是占位。没有跳跃。',
  source: '动作来源与许可', equipment: '部件开关', size: '显示尺寸', large: '放大检查',
};
const en: Record<keyof typeof zh, string> = {
  title: 'Character workshop', subtitle: '02A / Block humanoid · Armor silhouette · Bone grips', game: 'Exploration prototype',
  loading: 'Assembling rig and motion…', ready: 'Motion ready', error: 'Character loading failed or graphics context lost. Refresh to retry.',
  compare: 'Leather / plate comparison', outfit: 'Single outfit', cloth: 'Cloth', leather: 'Leather', plate: 'Plate', brigandine: 'Brigandine',
  helmet: 'Helmet', sword: 'Right sword', shield: 'Left shield', monochrome: 'Monochrome',
  motion: 'Motion', idle: 'Idle', walk: 'Walk', attack: 'One-handed chop', block: 'Block', climb: 'Climb placeholder',
  play: 'Play', pause: 'Pause', phase: 'Motion phase', angle: 'View angle', front: 'Front', quarter: 'Oblique', side: 'Side', back: 'Back',
  imported: 'Imported animation · KayKit / CC0', authored: 'Authored climb placeholder · Weapons stowed · Ladder alignment pending',
  armorTitle: 'Read the shape', armorBody: 'Leather: fitted vest, crossed straps and belt pouches. Plate: broad shoulders, raised breastplate, gorget and segmented tassets. Compare without color.',
  gripTitle: 'A handle inside the hand', gripBody: 'Fingers wrap around the handle, with the guard beyond the fist. The shield handle aligns to the left palm. Hide the shield, pause the chop and turn the character to inspect wrists and intersections.',
  note: 'An isolated art study, not the game renderer. Four source clips adapted to this rig; climbing remains a placeholder. No jumping.',
  source: 'Animation source and license', equipment: 'Equipment', size: 'Display size', large: 'Inspection size',
};
export type LabKey = keyof typeof zh;
export const labText = (locale: 'zh' | 'en', key: LabKey): string => (locale === 'zh' ? zh : en)[key];
