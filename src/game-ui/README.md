# M16B 原生界面步骤与合同

目标：在同一 WebGL canvas 绘制 HUD、六装备槽、可旋转角色、16 格背包与动作/目标页；只读取 PublicView，通过外部 command 回调提交命令。

范围：src/game-ui、src/alpha2 入口、专项测试。M19 商店/图鉴/配置仍为显式辅助界面；旧 UI 以 ?ui=legacy 保留。无新增机械状态、身份或存档字段。

接口：NativeGameUI.render(renderer,width,height) 是 RoomRenderer overlay；update 仅接公开视图及显示状态。CanvasInputRouter 接 CSS 像素热区和回调，不引用 Session。由 Game.vue 统一停止持续输入、执行语义命令、保存与加载。物品缩略图使用 M16C resolver 和共享离屏缓存；未知外观不使用隐藏 definition。

文本：原生文本使用浏览器中英字体在离屏 Canvas 字形层光栅化，再通过正交场景绘到同一个游戏画布，不使用可见 DOM 面板充当背包。角色预览使用真实 BlockCharacter 与公开装备。

验收：类型、输入/布局单测；390×844、844×390、桌面浏览器；开包选择穿戴返回与鼠标/触摸/键盘；旧 UI 正式命令摘要对照。独立集成者运行历史档与全套验收。实际触屏硬件、输入法、屏幕阅读器和长期 GPU 内存仍需单独验收。

停止点：切片稳定且可复现，登记真实结果，不进入 M17 的全面内容制作。

## 2026-10-11 M16B 局部实际结果

- 初次集成候选：布局与原生/旧 UI 穿脱后完整存档比较 8/8 浏览器用例通过（34.6 秒）。这批断言未覆盖同页面连续 resize 的像素内容。
- 集成者人工查看同页面 desktop→390→844 截图，发现旧 UI framebuffer 叠影和色彩过亮。修复为尺寸变化时重建并释放 CanvasTexture，明确 SRGB 色彩与 UI 材质不参与世界 tone mapping，并在 overlay 绘前恢复全画布 viewport/scissor。桌面网格扩为 96px，角色预览高度扩为 420px。
- 修复后 `npm run build` 通过；`npx vitest run tests/game-ui.test.ts` 5/5（376ms）。
- 最终局部 `npx playwright test tests/browser/native-ui.spec.ts --workers=1` **12/12（48.8 秒）**。desktop Chromium / iPhone 13 Chromium 触屏模拟分别执行 6 项；12 包含此前 8 项，不累计。涵盖三视口热区、modal 世界按键隔离、鼠标/触摸穿脱与 legacy 完整 capture 相等、键盘穿脱、取消食用、触屏长按，以及 844→390→1440→844 后 canvas PNG 字节完全相等。
- 原生 HUD 还提供 cast/search、邻近拾取、门/门闩、箱子/泉水/花园/陷阱命令热区；核心只接收正式命令。M16I 负责自然交互 trace 和阶段截图验收。

可复现诊断：canvas 的 `data-regions` 只含公开标签、CSS 像素热区，不持有机械能力；`data-ui-assets-pending` 表示缩略图加载中数量。`data-tick` / `data-revision` 来自公开投影。规格外的隐藏状态不进入诊断。

仍未覆盖：真实手机 GPU/触屏与输入法、屏幕阅读器、Safari/Firefox、长期 GPU 缓存压力。M19 商店/图鉴/设置/导入/完整回放 UI 仍通过显式“辅助面板”进入 HTML 外围；不是 M19 完成。缺少模型的物品显示双语“待制作”，不宣称 45/45 美术完成。独立审查与全套兼容验收归 M16I；以上是作者实现与局部自查。

### 独立审查第一轮后的输入修复候选

M16C 审查者通过真实按下/释放顺序找到 P2：在背包按下“丢下”但未释放，Esc 关闭后旧 pointerup closure 仍会丢弃并推进 4 tick。作者修复 router 在面板、只读状态、settle/close 生命周期切换时取消按压及长按；普通 revision 更新只取消单击，保留已授权的移动 hold。背包键盘导航也取消旧按压。新增严格真实鼠标与 touchStart/End 复现（比较 tick、revision 和完整 capture），并增加持续移动在自身 revision 更新后继续、释放后停止的保护测试。图标在矩形装备槽中改为等比 contain，不再拉伸方形缩略图。类型检查通过；本修复候选等待 M16I 统一构建、浏览器复测与独立第二轮复核，不计入前述 12/12 结果。

### 集成后的实际复测

M16C第二轮独立复核已完成，范围与冻结散列见 docs/M16-REVIEW-UI.md。随后第一次全量浏览器运行中原生UI为16/16；最终图形失效保护/可见提示修正后，原生UI、交互与哨站联合复测28/28（1.2分钟），其中原生UI仍16/16。最终119项单测/类型/构建通过。这些结果替代“等待集成”状态，数量不与前轮12项叠加。

最终推门后段修正后再次执行 `npm run check`：120/120（143.06秒）；原生UI/交互/哨站浏览器28/28（1.3分钟）。原生UI仍是16个不同用例，未累计重复执行次数。

## M19 原生菜单迁移步骤合同（2026-10-11）

目标：正式入口新局、菜单、图鉴/搜索/笔记、设施交易、地图日志、设置、保存/文件/回放和结算全部由同一 canvas 绘制。保留 legacy 分支及原断言；原生自然流程新增独立覆盖。

范围：src/game-ui、src/alpha2 和相关测试。无 core/content/session/renderer/模型状态变更。NativeGameUI 扩展只读显示状态和宿主回调；每个机械动作仍由 Game.vue 的 one/submit 执行；只读菜单不支付时间。

实现接口：CanvasMenus 复用字形层、热区与同源缩略图；TextInputBridge 仅为原生画布中的文本字段提供 IME/虚拟键盘输入，文本和确认按钮仍在画布。文件选择采用不可见 input，保存/恢复/文件/回放沿用原会话入口。面板切换停止持续输入并取消旧按压。

验收：类型、三视口与模态输入；原生新局及自然命令链、商店资金/物品守恒、已知图鉴过滤/中文笔记/跨语言、保存和回放只读、坏档保活局、graphics失败兜底。最终全套/性能/独立审查由M20集成者执行。仅完成实际通过的项目才登记结果。

### M19 作者局部验证与冻结候选

同画布迁移已实现；旧的 M16 辅助 HTML 入口现已移除，`?ui=legacy` 保留。原生新局、背包详情/笔记/目标、设施买卖、图鉴搜索、地图、日志、状态、设置、存读/文件、回放和结算都通过 CanvasMenus。文件与不可见 IME 输入桥只连接原受控入口。bag/facilities 执行动作时临时显示世界及 HUD，完成后回原面板；动画不提交额外命令。`coversWorld` 仅反映实际不透明面板，供渲染器跳过被覆盖世界绘制。

- 迁移主体候选 `alpha2-Y14WwdX0.js`：`npx playwright test tests/browser/native-ui.spec.ts tests/browser/native-menus.spec.ts --workers=1` **22/22，7.8 分钟**。包括原生 16 项和菜单 6 项；桌面正式新局自然路线 402 条命令、移动模拟 70 条前缀逐条核对 tick/revision，最终完整 capture 对照正式 GameSession，桌面抵达结算。
- 随后补充状态页、公开目标编号、实际导出文件内容/文件选择器导入、动作期间世界可见断言及删除无用辅助开关。候选 `alpha2-CoCNxlog.js`：两文件筛选 `canvas new-run|all native menus|native pointer and touch` **6/6，1.2 分钟**；含买卖资金与物品守恒、中文笔记、回放只读、坏档保活局、同画布导出/导入完整存档对照。
- 最终地图补充公开门状态与房间分段标签。候选 `alpha2-BTAn2TKk.js`：`npm run build` 通过（既有大 chunk 提示仍在）；`npx vitest run tests/game-ui.test.ts tests/game-ui-menus.test.ts` **8/8，609ms**；`npx playwright test tests/browser/native-menus.spec.ts --grep 'all native menus' --workers=1` **2/2，43 秒**。
- 菜单测试在 390×844、844×390、1440×900 验证九类页面的热区范围、切换/搜索/设置不推进时间；单测同时检查各菜单动作热区不重叠、渲染不能提交规则命令。resize 后等待当前画布实际尺寸诊断，不读取旧布局热区。
- 外置截图位于 `C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m19-native/`。作者查看横屏新局、竖屏商店、桌面地图图片；本项是自查，不称独立审查。

以上分阶段复测相互重叠，不累计为额外不同用例。最后候选尚待集成者统一全套/性能验收及 M16C 独立审查；真实手机 GPU/触屏与输入法、屏幕阅读器和 Safari/Firefox 仍未覆盖。没有改变规则身份、存档字段或公开知识过滤边界。

### M19 独立第一轮反例与修复复测

M16C 在固定 13 文件 SHA256 候选上独立复现两个 P2：world 状态提前返回键盘处理，导致 Tab 无法到达 HUD 菜单；触屏长按“丢下”在未释放前推进 4 tick，拖出取消已来不及。修复后 world 接入原热区 Tab/Enter 焦点路径，Tab 同时停止持续输入；router 区分 `longPress` 与 `activate`，普通按钮长按只显示提示，背包格长按显示公开物品详情，释放或拖出均不把长按变为机械命令。

新增两个严格浏览器复现，验证 Tab/Enter 进入菜单及存档页不改变完整 capture，真实 touchStart 等待 550ms 后 tick/revision 不变，拖出释放后完整 capture 仍相等。原键盘/长按用例增强为必须看见 detail，再返回 bag/world。修复候选 `alpha2-Ddidf5Mf.js` 的原生 suite **20/20，1.1 分钟**。

随后接入资产组公开食物 freshness 外观缓存：`itemAppearanceKey(item)` 与 `ItemThumbnailCache.getItem(item,96)`；没有读取秘密身份。最终第二轮候选 `alpha2-DP0RmJyI.js` 构建通过，UI 单测 **8/8，640ms**；`npx playwright test tests/browser/native-ui.spec.ts --grep 'world HUD|touch long press|keyboard equips|pointer and touch' --workers=1` **10/10，44.9 秒**。这 10 项是 20 项的复测子集。源码清单 `ui-candidate-round2.json` 外置，第二轮独立复核与最终集成门禁待执行。

### M19 第二轮结论与集成修复

M16C 第二轮独立复核确认首轮两个 P2 已关闭，同时发现新增 P2：world 鼠标悬停“保存”后 Space 被按钮焦点截获，原本攻击没有执行。按维护者裁决修正为 world 只路由 Tab/Enter；Space、方向和既有游戏快捷键继续原正式命令入口。两轮独立审查已达到约定上限，本修复不称第三轮独立审查通过。

新增真实反例对照：无按钮悬停时 Space 与 fresh start 悬停保存后 Space 均推进 10 tick，完整 capture 相等；既有 Tab/Enter 菜单入口测试保留。最终候选 `alpha2-DWTnPnsO.js` 的 `npm run build` 通过；`npx playwright test tests/browser/native-ui.spec.ts --grep 'world HUD|world Space' --workers=1` **4/4，15.5 秒**。最终集成复测归 M20I，source 清单外置 `ui-candidate-integration.json`。
