# M16C 任务包：物品建模与交互动作合同

**任务属性**：和 M16A/B 并行；先接口后批量素材。  
**读序**：参照 M16A，补读 `docs/ART-DIRECTION.md`、`docs/design/items.md`、`docs/design/interaction-matrix.md`、`src/content/alpha2.ts`、`src/character-lab/types.ts`、`character.ts`、`src/room/presentation.ts`、`renderer.ts`。  
**主要可写**：`src/visual/items/**`、`src/visual/motions/**`、`assets-src/items/**`、`public/assets/items/**`、`scripts/build-item-models.mjs`、`scripts/audit-item-models.mjs`、`tests/visual/**`；对人物/房间源码的改动需要与集成方确认避免冲突。  
**禁止**：按物品隐藏真实定义直接选择未知物品视觉、改规则时间、依赖 animation callback 发放资源、无许可复用 WazHack 原版资产。

## 产物

- 45/45 物品的 `ItemVisualSpec` 清单，建立具体 silhouette/材质/握点/预览/地面/穿戴合同。
- 首批 12 件各自独立且可辨认的真实 3D 成品（见 ROADMAP-M20 第 5.3 节），包括源配方或 `.blend`、`GLB`、地面与背包检视截图、资产来源。
- 未鉴定瓶/杖/卷轴/饰品采用“本局公开外观 key → 可见模型”的映射，不能从网格文件名或 UI 数组读出真实效果。
- 共用资源缓存与缩略图批处理，不为每个背包格每帧创建新 renderer/scene。
- `PresentationActionReceipt` + `MotionProfile` 类型、四种动作的原型 clip 或程序动作：pickupLow、doorPush/doorPull、leverPull、chestOpen；包括 target socket 与接触阶段。
- 利用现有握点和 23 骨架制作真实手物接触，拾取时地面模型移交到手/背包、推门时门扇旋转、拉杆时设施响应。

## 验收

1. 45/45 清单有明确模型计划，12/12 首批样品满足具体独立轮廓，不只是颜色变化。
2. 地面/背包/装备三端使用同一可见 `assetId`；未鉴定同局同外观一致，跨种子身份会重新对应。
3. 12 件首批模型在低画质、石墙背景、48×48/64×64 预览仍可区分，并有可执行或可人工核对的图集。
4. 交互动作至少显示准备→伸手/接触→结果→回稳四段，否决微弱瞬间下蹲或物体瞬间消失的占位表现。
5. 失焦/回放/存档恢复只 settle 到安全终点，不重复机械操作；不能引入新的规则随机调用。

**停止条件**：首批模型和交互动作完整入游戏；剩余 33 件在 M18B 完成。未经用户批准不采购外部素材或付费动作包。
