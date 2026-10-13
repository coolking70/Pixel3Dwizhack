# M21 纯能力查询步骤与验收

2026-10-12。基线0.20.0-rc.1，唯一接口为src/core/action-types.ts。A仅写action-query.ts、本专项测试与本文；不修改旧效果/命令/公共投影/Session、规则身份或存档。

目标：三个纯入口queryActionOffers(world,itemId)、queryTargets(world,itemId,actionId)、queryContextOffers(world,target)返回绑定revision的公开动作/目标。实现先取得既有公开投影，后续前提判断只消费此投影与公开定义注册表；不调用accept/useItem/effect、RNG或候选试执行。未知物品按类别候选定义的并集给能力，不能使用原投影中来自真实定义的actions差异筛选。未知BUC、充能、依赖未公开地图的传送/召唤前提返回uncertain，已公开确定阻碍返回disabled。

范围：45定义×物品动作及drop/unequip；self、bag item、可见敌人、已发现门/设施目标；拾取、门/闩、设施收费/强开/泉/采集/陷阱、交易/净化/烹饪/充能、梯子与攻击情境。world-cell投掷留给M24新身份。查询不把合法命令承诺为成功效果/命中。

验收：表驱动对照真实acceptAlpha2（受控夹具单列）与自然GameSession.submit；每个enabled命令不得确定性拒绝；未知定义/BUC/充能同公开边界等价；已满耐久、金属/非金属、防腐、装备诅咒、视距/门阻挡、结束/睡眠、设施资源边界等反例；冻结世界查询后完整序列化、tick/revision/RNG不变，返回值无世界引用。所有45定义至少一项enabled或明确uncertain真实可用路线，拒绝的同源/目标族不混入enabled。

停止点：模块和专项自测完成后固定hash交根独立审查，最多两轮；不跑9000或大浏览器，不更新全里程碑完成状态。

## 实现与实际验收

三个入口已实现，输出递归冻结并绑定公开 revision。查询先取得 `inspectAlpha2`，后续仅使用公开投影；未知定义取同类别公开定义候选并集，未知 BUC/充能不读取真实值。已知材料、耐久、防腐、装备、资源、距离与可见性给出公开拒绝原因。传送、召唤及梯子目的端占用涉及未公开条件时保留 uncertain。公开遗物使用真实投影 ID；隐藏守卫的存在不改变结果，只有公开守卫或公开击败记录能进一步确定。

情境交易 actionId 为 `buy:<id>`、`sell:<id>`、`cleanse:<id>`、`cook:<id>`、`recharge:<id>`，附正式命令。梯子 ID 为上端楼层乘地图宽度加 x。门、设施、拾取、近战和法杖攻击遵循实际正式入口的目标选择及费用前提。

2026-10-12 作者实际执行：

- `npx vitest run tests/action-query.test.ts --reporter=verbose`：14/14 通过，13.80 秒。
- 受控矩阵包含 45 定义、68 声明动作，103 个 enabled 目标及 845 个 disabled 目标；每个 enabled 目标均通过真实 `acceptAlpha2`。受控状态并非自然游玩证据。
- 原有自然 Alpha 2 黄金路线全部 402 条命令保持摘要；分散选取 33 个 enabled 候选，在该路线的正式存档边界恢复后经 `GameSession.submit` 全部接受。
- 未知身份/BUC/充能公开等价、已知空充能、装备诅咒、门阻挡、设施费用边界、满背包、遗物守卫、深冻结查询及完整世界/RNG 不变均有专项断言。
- `npx vue-tsc --noEmit`：退出 0。`node scripts/check-boundaries.mjs`：退出 0，检查 30 个文件的模拟/内容/会话无渲染依赖及角色工坊隔离。

首次执行记录：自然路线初稿在每个采样边界对全部候选重复恢复历史，成本过高，作者手动中断，退出 1，不计通过；同时修正夹具错误名称 emberCharm 为现有 emberRing。首次完整运行 10/11 通过，失败是覆盖数量要求大于 100 而实际 81，真实命令接受断言没有失败；随后加入第二只火焰免疫敌人，覆盖合法但无伤害的效果，并保留数量断言。后续 11/11、13/13 通过后追加维护者裁决的门目标回归，最终为上述 14/14；这些是重叠复测，不累计测试数量。

## 历史缺陷与边界

旧 Alpha 2 命令对门接受部分 damage/water 效果，但门目标未形成 facility 实例，效果会落到角色自身：例如火焰法杖伤害自身，门保持原状。维护者裁决保留旧命令/效果以维护回放兼容，由新查询将此类门目标标为 disabled / wrongTarget。专项同时验证新查询屏蔽与旧正式接受行为仍在；本次没有宣称修复旧规则。未知物品仍按同类别公开候选返回等价 uncertain，不能借已知缺陷过滤泄露真实身份。

本查询只持有 world，无法判断 Session 外层的历史条数/字节预算或提交时修订变化；该边界由正式会话入口复核。enabled 表示当前公开机械前提成立，不承诺效果命中、随机结果或后来提交成功。M24 world-cell 落点尚未实现。本专项没有重新执行 9000 局、全量浏览器或手机验收，也不将作者自测称为独立审查。

## 第一候选冻结

待根执行独立审查；以下为 SHA-256（文档不计入代码冻结）：

- `src/core/action-query.ts`：`79D01F6DEAF058A78ED8268107BAA92F7A87091506BA80D65A9CE0EC9A34D75C`
- `tests/action-query.test.ts`：`BE2F275BC3BD002E0788E1006BD49F139863FEF01F337649BB517D9A9F693746`
- 读取的共享合同 `src/core/action-types.ts`：`DB701BE9BC95FE9E4745441BE75421DB985FAD333A8285216100C499358B28E9`（根维护，A 未修改）。
