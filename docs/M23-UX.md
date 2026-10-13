# M23 原生物品与装备 UX 执行记录

目标：以冻结 ActionOffer/TargetRef 查询合同替换详情页自行推断能力；保留 `direct !== true` 的 M20 布局。范围仅 native-ui、menus、layout、alpha2 i18n、专属 interaction 单测。Game.vue、输入路由、场景命中和规则归其他负责人，135 GLB 原样复用。

实施接口：`NativeState.direct` 控制新流程；可选 queryActions/queryTargets/queryContext/commit/worldClick/worldMove/worldCancel/targetsChanged 回调。独立详情持有公开物品 ID；操作/目标候选绑定 revision，禁用不可确认，未知显示可尝试。自身、包物、装备槽及世界目标使用查询返回的同一列表。取消只清临时状态，不发命令。情境收费候选遵循 requiresConfirmation。

验收：公开查询驱动状态机的接受/拒绝/取消/修订/只读专项，三尺寸详情/目标热区布局，真实模型预览和盾缘完整性；作者自查与根集成浏览器及独立审查分别记录。没有查询验收前不打开默认 direct；不改旧模拟/存档/规则摘要。不运行大套浏览器、9000 或发布。

停止点：实现与专项通过，提供固定文件哈希和覆盖限制交根集成；尚未执行的验收不写为完成。

实际实现（2026-10-12 作者自查候选）：

- direct 闸门、最小 HUD、可开关辅助控制、独立物品详情、公开基础属性比较、滚轮/分页语义操作；实际 GLB 预览可拖动旋转，沿用外观 resolver 与公开 freshness。
- ItemInteraction 只保存查询快照，revision / readOnly / 生命周期使 pending 失效；selectionChanged 保留来源到宿主 commit 回调，随后清空。自身、六装备槽、包物、世界目标均来自 queryTargets；未知边框和状态明确，禁用不能确认。情境确认返回原情境，再返回退出。
- 世界目标模式保留最小 HUD，targetsChanged 交渲染器绘制目标，键盘方向键循环同一候选表，Enter 单次确认。触屏长按物品只查看，不执行动作。
- 角色预览按纵横比扩大视距，物品预览按包围球适配，盾缘留有边距；空包格用占位横线。

实际验证：`npm run typecheck` 通过；`npx vitest run tests/game-ui-interaction.test.ts tests/game-ui.test.ts tests/game-ui-menus.test.ts` 最终 19/19，647 ms（其中新 interaction 11 项，其余为原有 8 项；不累计中间重跑）。新测试覆盖严格候选引用、禁用/未知、修订/只读取消、收费确认与返回、宿主提交上下文、空取消同步回入、三尺寸与全部查询原因双语。

真实 Chromium headless / Vite 5174 作者轻量检查：1440×900、844×390、390×844 均完成新局→背包→盾牌独立详情，模型加载无 pageerror，热区均在画布内；三尺寸食物目标选择和双层返回保持 tick 0，正式卸盾均为 tick 8。触屏模拟长按干粮进入详情保持 tick 0；投掷世界瞄准后方向键选择与 Escape 取消仍 tick 0；食用自行目标由键盘循环和 Enter 正式提交，tick 12。实际查看 390 盾详情、844 角色装备、844 目标列表、390 世界瞄准及最终 844 盾详情 PNG，盾缘未裁切；横屏详情每页两项，分页继续可达。此为软件浏览器自查，不能替代真实触屏或独立验收。

首次失败与修复：真实首启触发 render resize → cancel → targetsChanged([]) → renderer 同步 draw 的递归；作者改为空 targets 取消不重复通知并加单测，根集成者另加 draw 重入保护。复跑三个视口首启与上述流程 pageerror 均空。原始 inspection 脚本首次 Windows ESM 路径格式错误改为 file:/// 后运行，非产品缺陷。横屏目标确认区和选项分页空间由作者自查调整后复拍。

轻量脚本、十张 PNG 及固定 SHA256 清单外置：`C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m23-ui`（inspect.mjs / flows.mjs / touch-aim.mjs / ui-candidate.json）。尚未覆盖：全 45 物品 × 全动作/目标矩阵、付费设施自然浏览器路线、回放/恢复完整矩阵、100 次资源循环、真机与非 Chromium、性能；由根 M25 集成验收组织。作者未运行全套浏览器或9000局，未改GLB、规则、共享 Game/input，未提交发布。独立审查尚未执行，不把本自查称为独立关闭。

第一轮独立审查后修复与第二候选（2026-10-12）：B 在冻结候选发现 P1 门 open 缺文案导致锁门情境渲染抛错、close误用菜单返回文案；P2 已选目标时 Enter 无条件执行确认，覆盖了实际取消焦点。作者接受并修复：open/close使用独立双语门动作键；Enter统一服从原生焦点，方向键循环目标时将焦点明确移至确认按钮，指针目标选择保留既有Tab顺序。新增宿主展示回调targetSelected，目标选中/禁用/返回/修订取消分别发布公开target/null，仅驱动已选轨迹。

作者复测：typecheck通过；相关3文件23/23单测，1.14s（新增actual NativeGameUI.keydown + CanvasInputRouter焦点取消/方向键确认、付费确认取消、targetSelected生命周期、门文案回归）。沿B原独立脚本创建author-r1-fixed副本，原lockedDoor自然存档tick754点击后保持754，情境为“开门·不可执行·已上锁 / 扳动门闩·可执行”，无pageerror且实际查看截图；公开自然context候选的中英文文案全部可解析。原“干粮→eat→self→Tab两次到取消→Enter”三视口复跑均tick0且回itemDetail；重跑触屏长按tick0、世界瞄准取消tick0、箭头+Enter食用tick12。首复跑844视口被同期Game HMR重置newRun，未作为通过，待根确认稳定后加终态断言重跑三尺寸通过。

第二候选SHA256见外置m23-ui/ui-candidate-round2.json；此段是作者修复验证，独立第二轮由B执行，未自行宣称独立关闭。

B第二轮现已执行完成：六文件哈希前后一致，23/23单测1.41s；原锁门tick754情境正常，三尺寸Tab取消均tick0，八种targetSelected生命周期及箭头Enter消费正例通过。首轮P1/P2和close误义闭合，无新可复现缺陷；两轮上限已到。报告为外置m23-ui/independent-r2-report.json，完整设备、性能、全物品组合仍由M25验收另列。


M25集成补充：生产自然流程发现横屏底部确认遮住地面点、竖屏敌人在镜头外时缺触摸切换。作者将844横屏确认移至顶部，世界瞄准卡片新增前/后目标按钮及公开i18n提示；根调整相机只在正式选中公开目标时同时纳入玩家/目标。三尺寸真实触摸next/prev施杖均保持选择tick108/revision15不变，执行后完整archive与oracle一致，26/26 UI专项通过。外置m25-landscape-fix和m25-touch-target-fix保留脚本、结果与截图；这些为后续集成修复，不增加独立审查轮次。
