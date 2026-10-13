# M26 执行与接口合同（2026-10-12）

基线：M25 RC2，362项冻结文件逐SHA一致，无Git元数据。用户授权参考M26方案完成开发；附文是设计/验收输入，不能作完成证据。旧M25/M20包、七历史身份与黄金不覆盖。当前目标为本地 alpha4 纵向完整交付；不推送或部署。

## 所有权及停止点

- 规则：独立 alpha4-1 / commands 8 / archive 1；容量与掉落只在新身份生效。规则实现及其测试、1000种子分布和配对资源统计为一个步骤。
- 世界表现：梯子边、物品堆位姿、统一候选命中、意图执行为一个步骤；scene-hit-test 只有一个写者。
- 原生UI：统一背包、详情导航、地面候选面板及双语文案为一个步骤。
- 集成者：Game.vue、输入生命周期、共享类型、入口/打包、浏览器验收和唯一状态入口。每步冻结后进行独立审查，最多两轮；不把作者自查称独立审查。
- 设备不可用的项目明确未验收；严重实现缺陷不凭轮数关闭。完成本地包后记录性能和设备缺口。

## 共享协议 v1

代码定义在 `src/interaction/ux-types.ts`，全部是短命表现数据，不进入机械摘要或存档。

`NavigationState` 保存 page、selectedItemId、originIndex、selectedSlot、previousActionId；不保存可执行命令。`ActionResult` 返回 accepted、当前revision、当前公开bag及公开原因/interrupt。commit回调同步返回结果；成功后先按稳定ID判断归属，再刷新offers；动画busy仅禁止提交，不能销毁导航。拒绝保留原上下文。外部存读/回放切换和失焦撤销待确认，不复用旧offer。

`WorldHitCandidates` 返回 hits、ladderEdges 和可选 pile{cell,itemIds}。保留原 hitTest 供历史调用；新入口使用 hitCandidates。唯一命中激活指定稳定ID；重叠/溢出打开候选面板，不默认取首项。pile.itemIds 包含同逻辑格公开成员，不只限可视上限。

`LadderEdge{linkId,fromFloor,toFloor,x}` 是明确物理连通边。IntentExecutor 新增 startClimb(edge)，在公开已知路径走到 fromFloor/x 后，重新校验同一物理边并仅提交一次 up/down；允许目标层未探索，禁止任意黑暗单元导航。renderer 提供 ladderScreenPoint(edge)，候选与箭头使用目标段；不得用动画驱动规则。

`GroundPileVisual` 由公开ground item和外观解析器纯计算；所有渲染和命中共用此变换。pose为世界坐标、angle为平放/倾角，bounds为对应代理体积。itemIds稳定排序，最多4可视成员，超过上限有计数标记与选择器；不使用规则随机、墙钟或隐藏definition。所有项目都可从选择器访问。

NativeGameUI 新增 openGroundPile(ids,inspectOnly=false)、showWorldHint(ids)、openLadderChoices(edges)；回调 pickupItems(ids)、climb(edge)、worldLongPress(x,y)。逐项拾取由集成者提交正式take:id，每步重查位置/公开offer/容量/危险，取消、失焦、敌人或拒绝即停止。长按只显示信息，抬手不执行拾取。

集成补充：groundSelected(itemId|null)连接选择器鼠标/键盘焦点与真实模型高亮；showWorldHint传所选ID在首位及同堆其余ID。readOnly只表达回放、终局、未就绪（以及旧模式暂停）；失焦属于短命blocked，取消待确认但保留详情导航。

## 保密、容量与验收

bag仍含所有携带实例以服务装备绑定；UI网格过滤equipped。旧身份说明总携带含装备，新身份普通格16，全部携带重量仍计入负重。满格卸下拒绝并公开提示先腾格，取消零变化；禁止自动丢弃。比较槽位从公开装备/装备offer识别，不读取隐藏定义；未知数值显示?而非0。

按M26路线图逐项验证：七旧黄金不变、alpha4黄金/回放/拒绝事务、1000独立种子分布及不同代理配装配对、纯UI零tick/revision/archive变化、焦点新输入一次、详情刷新、梯子明确跨层、1/2/4/8堆稳定ID点取、长按/全拾取中断。真实浏览器与模拟设备、自然路线与受控夹具分别记录。首次失败和修复复测分别保留，不将既有M25测试结果冒称M26通过。
