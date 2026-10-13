# M21–M25 执行与共享合同

2026-10-12。用户授权参考新路线图持续开发至M25。docs/ROADMAP-M25.md保留原规划；其基线审查数字是来源报告，本轮须实际验证。当前334冻结源码/资源全部与M20清单一致，无Git元数据。M20运行包ab128bdbcaab11760822456f80af132a04a4bc7a077b573b4c25c8fcb9d9440c、源码包8559b58ec9b140914f2e0afc7d95de251e11092f1cc31a6616f0a6244ad9d9c2只读保留。

## 权限、步骤与停止点

沿用本任务A/B/C及根集成者分工，范围扩展到已授权新规格。只本地编辑、测试、生成新分发；不提交/推送/部署，不购买素材，不读取参考游戏代码或资产。现有原创135GLB复用。缺少真实设备必须登记，不能把模拟当作真机。每步最多两轮独立审查，作者复测不称独立关闭。

1. M21：A负责新纯查询模块src/core/action-query.ts及tests/action-query.test.ts；根冻结action-types.ts并接入session。先完成全45定义/目标族、未知同类信息隔离、零副作用及原命令比较，再接入默认界面。
2. M22：B负责src/interaction/*、src/room/scene-hit-test.ts、renderer.ts、game-ui/input.ts及专属测试。实现公共世界命中、逐步意图执行、门与危险取消。不得改规则/Session或UI布局。renderer所有权在交付后归根，M24适配不并行覆盖。
3. M23：C负责game-ui/native-ui.ts、menus.ts、layout.ts、alpha2/i18n.ts及专属测试。根独占Game.vue。物品详情与合法目标均只消费统一查询；不自写另一套效果判定。修复盾缘裁切，默认去动作矩阵，保留可选辅助。
4. M24：根负责新alpha3规则、core/types.ts/simulation.ts/session.ts、alpha3入口、Game.vue及抛射收据适配。复用原alpha2实现时只在新场景分支调用，不改旧语义。新身份alpha3-1/commands7/archive1、独立存档dungeon-descent.m25；旧alpha2.html继续原身份，alpha3.html为新正式入口。
5. M25：根集成；固定候选交叉审查、七身份存录、新自然路线、旧9000配对、新规则独立基线、真实浏览器输入/截图/100次生命周期/性能、完整本地分发。UI与查询先通过再冻结M24，不能把所有阶段的计划一起写作完成。

## 唯一合同 v1

类型唯一来源src/core/action-types.ts：TargetRef、WorldIntent、PublicActionOffer、PublicTargetOffer、WorldHit。查询结果只读临时数据，不进World/摘要。字段revision绑定当前边界，status为enabled/disabled/uncertain，publicReason为i18n键；targetModes允许混合自身/物品/世界选择；command仅是可提交候选，最终由正式submit裁决。未知效果的公开等价源返回同等能力，不能试运行效果/RNG来筛选。

A导出queryActionOffers(world,itemId)、queryTargets(world,itemId,actionId)、queryContextOffers(world,target)。根提供GameSession同名只读包装；UI回放禁止调用活局查询。确认时根重新查询、核对revision/目标/命令，disabled与陈旧状态均不提交。原低层提交仍独立验证。其他组不改types或查询模块，可提交明确变更提案由根整合。

B导出IntentExecutor，构造参数{view,submit,busy,context,offers}，提供start(intent)、direction(source,'left'|'right'|'up'|'down')、release(source)、completed()、cancel()、active。只维护一个可取消的暂态意图，每次完成后检查公开危险/版本/目标，再提交最多一个原命令；context回调仅打开面板。Renderer新增hitTest(clientX,clientY):WorldHit|null、worldScreenPoint(ref)、setTargets(targets:PublicTargetOffer[])，这些只读公开视图。屏幕点使用CSS客户端坐标，UI热区优先，未知目标不可命中。

CanvasInputRouter第四个可选参数为{worldClick?:(clientX,clientY)=>void,worldMove?:(clientX,clientY)=>void,worldCancel?:()=>void}。世界点击只在同一有效pointer释放后提交，拖离/cancel/旧释放无效。C将这些回调传给根；模态覆盖与busy在根和UI均阻断世界输入。

C的NativeGameUI回调新增queryActions(itemId)、queryTargets(itemId,actionId)、queryContext(target)、commit(offer:PublicActionOffer|PublicTargetOffer)、worldClick/client位置、worldMove、worldCancel、targetsChanged(targets)、openContext(target)。可选字段先保持旧构造兼容。目标模式和详情由UI持有，生命周期取消清空targetsChanged([])；只有commit会请求规则提交。根统一接入并负责revision复查。新增用户文案进入i18n，键名前缀interaction.。

M23第二固定候选补充可选 `targetSelected(PublicTargetOffer|null)` 展示通知，根唯一接入renderer.setAim；不提供写状态能力、不更改机械协议。选择后的轨迹与确认目标一致，未选择时才允许悬停预览；取消/修订/换项发布null。B第二轮检查该回调生命周期，根第二轮集成反例另列M25-ACCEPTANCE。

## 验收与证据

保留原M20黄金/历史报告，新增测试不删除有效旧断言；旧UI结构改变时将旧原生测试保留在显式兼容入口，新默认流程用独立E2E覆盖。基线能力报告不可替代本轮执行。原始文件存外置证据根m25/，仓库留轻量摘要、失败与修复区分。开始实施不表示上述各门禁已通过。
