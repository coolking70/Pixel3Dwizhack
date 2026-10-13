# M16A 任务包：无渲染自动平衡实验台

**任务属性**：独立并行；不得修改 Alpha 2 机械规则。  
**输入基线**：`0.15.0-alpha.2`；首先读取 `AGENTS.md`、`README.md`、`docs/STATUS.md`、`docs/ARCHITECTURE.md`、`docs/ROADMAP-M15.md`、`docs/ROADMAP-M20.md`；检查工作树与源码实际状态，不能覆盖其他任务修改。  
**可写**：`src/balance/**`、`tests/balance/**`、`scripts/balance-*.mjs`、`reports/balance/**`、必要的 package scripts（需与集成方协调）。  
**禁止**：更改 `src/core/**` 的游戏规则、RNG、世界结构、物品数值；直接注入额外玩家资源；读取被公开投影隐藏的物品信息作为普通代理策略。

## 产物

- 可调用 `GameSession` 正式语义命令的无浏览器策略适配器，具有策略版本号、可复现伪随机选择与动作数上限。
- `novice`、`survivor`、`fighter` 三种只看公开投影的策略；可在后续增加 `experimenter`，`oracle` 必须显式标注上界。
- 脚本：90 局 smoke、900 局 baseline、9000 局 milestone，规模必须可参数化，允许 CI 使用更小烟测。
- 输出 JSON/CSV + Markdown 汇总：职业/策略/层级胜率、死因、时间与资源消耗分位数、种子列表、代理版本、异常回放指令。
- paired-seed 对照支持，带置信区间；对于 agent 死循环或无法解题明确区分，而非算作怪物击杀。

## 验收

1. 同版本、种子、代理与配置，两次运行的完整行动序列和机械摘要一致。
2. 代理无法读取未知物品的隐藏真实效果；可证明来源只限 `session.view()`。
3. 已停机/无效命令不加 tick；不越过局内合法操作。
4. 失败报告至少能复现一条正式命令 trace；受控边界测试另列。
5. 旧规则夹具仍可恢复；运行已有真实测试入口，不将既有测试通过当作新结果捏造。

**停止条件**：自动化平台、三策略和 smoke 实际运行完成；不要为了得到目标胜率擅改世界数值。发现疑似机制错误，提供种子与 trace 给集成任务。
