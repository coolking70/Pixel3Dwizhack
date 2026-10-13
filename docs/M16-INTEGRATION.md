# M16 集成记录与冻结合同

2026-10-11；负责人 M16I（主任务）。依据用户授权的 ROADMAP-M20 与 tasks/M16A/B/C/I；只交付 M16 纵向切片，M17 全面内容制作不在本轮。

## 实际基线

目录无 Git 元数据，不存在可报告的 commit 或远端分支。开工将源码包中 122 个源码、测试、资源、脚本及配置文件与工作目录逐文件 SHA-256 比较，全部一致（包内路径带 `project/` 前缀）。

- `releases/fallen-star-0.15.0-alpha.2-source.zip`：`46d18532493e7e0c82e1ad3c565223706f7403bda1d332bf554a97035cdbefe6`
- M15 运行包：`f10a5ae10690e888dc96976d1917ebd5e16ebd0100675ea62a250e6c5b56d181`
- 用户 M16 开发包：`57a51b0753ad9c07bc4d85bbc5101ca4696cc96db2f4c5ff20a566b53a2aa5a4`

## 步骤、范围与停止点

1. 冻结：只使用 PublicView / Item2View 与正式 GameSession.submit；保持 core/content/session 原样。六规则身份、commands 1–6、独立存档键及黄金夹具必须逐摘要恢复。
2. A 在 balance 目录实现三策略、CLI、报告与 90 局 smoke；不以目标胜率改数值。
3. B 在 game-ui/alpha2 实现同 WebGL canvas HUD、装备背包；C 在 visual/items 实现公开外观解析、真实 GLB、缓存和首批模型；按分离目录并行，主任务整合 renderer。
4. I 在 visual/motions 和 room/renderer 接入四阶段交互。准备/接触/效果/回稳仅插值已接受命令的 before→after；中止落到 after。
5. 固定候选执行类型/边界/单测、模型检查、旧 E2E 与新增浏览器验收、截图/性能采样。真实设备、独立审查或未覆盖项如实登记，不由作者自查替代。

## 共享合同 v1

- `ItemVisualSpec` / `DisplayItem`：归属 `src/visual/items`。秘密类别无论是否鉴定均仅以 `category:appearance` 解析，同实例鉴定不换造型。固定类别可用已公开 definition。几何、缓存键、GLB 节点不得携带隐藏映射。
- `CanvasInputRouter`：归属 `src/game-ui`。只发 UI 意图/正式命令；模态抢占移动，松开/失焦/暂停取消持续输入；不积攒命令。
- `RoomRenderer.setOverlay({ render(renderer,width,height), dispose() })`：同 renderer 的世界视图后绘制正交 UI，不增加可见 canvas。`invalidate()` 只重绘，不能提交规则。
- `PresentationActionReceipt` / `MotionProfile`：归属 `src/visual/motions`。schema 1；由 revision 增加的公开前后视图派生 actor/target、逻辑已付 tick、可见道具及空间 socket。只读收据不写入机械存档，不包含随机/隐藏定义。动画回调不补交已付动作；既有 MotionInput 只在持续输入授权仍有效时发出下一动作，失焦/失败必须取消授权。
- 模型资源由共享缓存拥有，实例拆除不释放共享 geometry/material；缓存销毁统一释放。异步加载必须有销毁/当前投影复核。

## 验收计划（不是通过声明）

原有 `npm run check`、`npm run check:models`、54 项浏览器回归；新增 assets audit、balance smoke、原生 UI 布局/键鼠/触屏/只读回放、外观防泄露、动作分段/手物接触/中止等价。大日志与图片放工作区外，执行结果和失败归因记录在 STATUS 与本记录末尾。

## 集成中发现并保留的失败

- 真实动作截图：开门后的远端把手距离过远，关门接触误差1.1843m。改为抓取可达的近铰链竖框，保留门扇旋转，补可达性单测；第二轮截图五个自然分支接触误差均为0（四舍五入到四位），不是仅用目标坐标冒充实际手掌。
- 同页连续改变视口暴露 CanvasTexture 旧帧叠影及 UI tone mapping 偏色，修复见 game-ui/README。首批失败截图保留在外部 m16-scenes/，第二轮在 m16-scenes-r2/。
- 两轮独立审查分别覆盖 balance（M16C）、UI（M16C）、视觉动作/装备（M16A）。拒绝预算错误分类、关闭背包后旧按压仍触发、丢失上下文结清额外行动、弓盾挂点均有反例和修复。详细冻结范围见 M16-REVIEW-UI.md / M16-REVIEW-VISUAL.md 与 reports/balance/README.md；不将局部审查等同全部产品独立验收。
- 第一次74项全浏览器回归进一步暴露真实 WebGL loss 与 RAF 的竞态：loss已发生但DOM事件尚未送达，原修复仅在事件回调中中止，正常完成帧仍可让tick20→30。增加帧入口 isContextLost 检查和幂等失败收束；新增确定性浏览器反例在真实 loseContext 后、DOM事件前执行已排队的完成帧。此后修复由M16I承担，位于既定两轮审查之后，不能伪称已经过第三轮独立关闭。首次失败完整test-results保留在外部 m16-first-full-context-failure/。

## 交付覆盖边界

M16只交付原生HUD/装备背包、12定义样品与四类动作；其余33定义的成品、M19商店/图鉴/全设置/完整回放的画布迁移不在本轮。商店外围仍是原HTML文字界面，没有新增商店3D预览，不能声称其模型展示验收完成。真实手机、Safari/Firefox、输入法/屏幕阅读器、长期GPU资源压力未验收；WebGL丢失后停止输入，需要刷新恢复，不声明自动恢复。900/9000配置未跑，不据90局自动代理结果声明真人平衡。没有物理删除可选模块矩阵：本次三个目录为固定产品模块，未声明可拔插能力。

## 效果后段补充检查

首次final-late硬件截图显示：推门接触起点误差0，但phase0.707时远端把手移出可达范围，误差0.7854m。此问题不改变任何机械结果，但不能将接触起点的通过外推成整段贴合。M16I修为手沿同一横杆向铰链侧移动，关闭仍用近端握点；新增开/关×五个转动相位的真实手掌IK断言。5项动作专项先通过（1.45秒），随后重新执行集成门禁。原失败截图和数值保留于m16-scenes-final-late，修复后另存m16-scenes-accepted。此补充同样不冒称新的独立审查轮次。

## 最终关闭记录

120/120单测（19文件，143.06秒）、严格类型/边界/生产构建通过；最终交互/原生UI/哨站28/28（1.3分钟）。模型/角色配方审计通过。首轮73/74及其唯一失败、前后两轮截图问题均保留，不改写为一次全套通过。最终五个自然分支10帧的接触和效果后段实际手掌误差均0.0000，保存逐次精确相等；硬件/软件最终性能报告的构建资源清单一致。

最终源码/测试/脚本/资产187文件清单已再次逐项核验无变化，摘要84b7dbb0cdc24ba83ef0081b3cb9879b5faab50b6f15ddf999372047f11f4f3f。详细实际执行与未覆盖项目见M16-ACCEPTANCE.md，性能数值见M16-PERFORMANCE.md，唯一当前结论见STATUS.md。未进入M17、未重打包/部署/推送，M15分发保留；源码开发仍沿用基线package版本。
