# M16A 无渲染平衡实验台

实施起点：0.15.0-alpha.2，alpha2-1 / commands 6；目录无 Git。只写 src/balance、tests/balance、scripts/balance-* 与本目录，package scripts 由 M16I 集成。

目标与接口：独立的 novice / survivor / fighter 策略只收冻结 PublicView、策略配置与自己的记忆；执行器独占 GameSession，仅 submit 正式命令。策略不获取 capture、fingerprint、规则 RNG 或内容定义。观测字段未提供的统计必须注明不可观测。

实现顺序：冻结观察/决策/运行结果接口 → 三策略及有界正式命令执行 → 分层/Wilson/配对 bootstrap 报告与失败 replay → 独立单测及 90 局实际 smoke。所有机械变更禁止；不为提高胜率改规则或补给。

验收：同配置命令序列与逐步摘要相等；冻结/隐藏信息边界；拒绝不推进 tick；失败 trace 重放；历史兼容由 M16I 统一运行。停止于三策略、CLI、报告、实际 smoke，不执行 M17 调参。作者自测不称独立审查。

原始数据外置：C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m16-balance。运行命令及真实结果将在执行后补充。

## 2026-10-11 实际执行

- 新增三种代理 `m16-public-1`，只读公开观察；代理自身的伪随机选择不接触规则 RNG。原有规则文件和数值未修改。
- `npx vitest run tests/balance/balance.test.ts`：最终 **8/8，10.80 秒**。涵盖三策略完整序列/摘要复现、只读观察/未知信息、拒绝原子性、已终局拒绝、行动/tick预算、失败trace和统计配对。`npx vue-tsc --noEmit` 通过。旧六身份黄金与整体构建由 M16I 执行，本报告不把旧结果当作本次结果。
- 最终 smoke：种子 1–10 × 三配装 × 三代理 = **90 个不同配置，89 胜、1 死；无 error/stuck/unsolved/limit**。对应 `final-smoke/`。首跑与复跑不是额外独立样本，不能累计为 270 局胜率样本。
- 90 个配对配置的**每条成功/拒绝命令、tick、机械摘要和最终摘要全部精确相等**；最终与原始 smoke 比較亦相等。paired-seed bootstrap 已执行；同候选对照胜率和tick差异均为0，不能据此推断不同版本难度。
- 失败自然样例：种子2 / breaker / fighter，在深度索引4、277次行动、2990 tick死亡，最后公开伤害来源 Emberling，最终摘要 `91ac71b4`。仓库保留 `seed-2-breaker-fighter.json`；`node scripts/balance-replay.mjs reports/balance/seed-2-breaker-fighter.json` 已逐边界通过。这里是策略自然死亡，不宣称规则缺陷。
- 顺序与两worker的相同9个受限配置（20行动）完整结果相等。CLI 的 JSON/CSV/Markdown、失败索引、90配置baseline配对已经真实生成。

此轮机械/策略源码 SHA-256：`d9578187e30f06500b718cd3a60b7c89a9d967bd7fc44bca87c4105c28aabdf2`（脚本对 src/core、content、session、balance 的 .ts 路径和内容计算；不代表全产品构建）。原始数据留在外部 `final-smoke/`；仓库轻量汇总已更新为下文集成候选。

### 真实 Node 性能样本

Windows 10.0.26300 x64、Node v24.14.0、i5-12600KF；无渲染，CPU并发2；90局共52.33秒。单局耗时中位1017.47ms / P95 1806.66ms / 峰1965.46ms；每局结束时worker堆采样中位54.14MB / P95 87.16MB / 峰92.86MB。包含复制、正式命令和完整摘要开销。采样同时其它任务仍可能消耗CPU，不能作为隔离机器吞吐基准；不是浏览器、GPU或手机性能，也不是峰值进程RSS。

### 首次失败与修复

第一轮专项6/8：seed42 fighter未终局而卡住；诊断九配置全部反复回到被不可见敌人占据的梯口。修复代理记录正式拒绝的梯边、选择另一条已公开梯路，并让卡住检测统计“无其它可见进展时同位置的重复访问”，避免长返程误判。`first-diagnostic/` 保留首次trace，未改世界或取消断言。Wilson 100%端点计算得到0.9999999999999999，实现在0/100%边界精确归一，未扩大测试容差。

随后发现Vite在worker里隐式创建WebSocket而有端口警告；明确关闭 `ws`、HMR和watch，最终运行无该警告。报告自查发现快捷 `potion` 没被计入 `itemUses`，修统计并补三策略严格计数断言；最终90局使用修正后的候选。此前结果和最终结果的机械trace相同，资源统计以 final-smoke 为准。

### 使用

```sh
node scripts/balance-run.mjs --preset smoke --concurrency 2 --out <外部目录>
node scripts/balance-run.mjs --preset nightly --out <外部目录>
node scripts/balance-run.mjs --preset milestone --out <外部目录>
node scripts/balance-run.mjs --seeds 1 --max-actions 20 --out <CI外部目录>
node scripts/balance-run.mjs --preset smoke --baseline <旧输出/runs.json> --out <新外部目录>
node scripts/balance-report.mjs <输出/runs.json> [旧输出/runs.json]
node scripts/balance-replay.mjs reports/balance/seed-2-breaker-fighter.json
```

preset 对应90/900/9000；`--seeds`覆盖每组种子数，最多1000；`--seed-start`默认1。动作上限默认1800（最大4096）；`--max-ticks`默认30000，在正式动作的首个稳定边界达到或越过阈值时停止；`--stuck-limit`默认96；`--concurrency`支持1–8，默认1。out默认使用系统临时目录，每次新目录。error退出码1；死亡/代理卡住/预算终止属于实验结果，必须读outcomes，不能仅凭进程退出码声称通关。不指定目标胜率。

### 覆盖边界与交接

900和9000局配置尚未执行；没有真人难度、真机或其它浏览器结论。三代理目前不试用未知耗材，未知试用次数为0，不证明其安全。稀有度未在公开投影暴露，故不统计；周期/环境伤害合并，状态次数仅为命令边界差异；伤害来源采用可见怪物与公开日志。没有强制最短化死亡trace，保存的是未经剪枝的可复现自然命令前缀。统计详情及置信区间定义见summary和源码。

作者实现/自测已完成，独立审查交M16C，集成、历史兼容和完成状态由M16I负责。未执行提交、推送或发布。

### 独立审查第一轮后边界修复

M16C 对固定候选发现：注入只提交不同非法wear命令的受控代理，在6次拒绝/0次正式行动时耗尽尝试预算，会误归类action-limit。修为agent-stuck并新增严格反例，确保没有把无效尝试当作已接受行动。此分支只影响仍在playing且尝试预算耗尽的结果；上述90局均won/dead，未触发该分支。smoke-summary中的源码SHA保留实际采样候选，不伪称为此后文件的哈希。

修复后作者全套balance专项 **9/9，10.71秒**。M16C第二轮冻结 runner SHA256 `3410678033c4ae9614761601ea257b513e3e30764f9200dbe5b33665552ea5a1`，独立重跑反例为 agent-stuck / actions0 / attempts6 / tick0，并逐attempt回放到摘要 `22b22378`；`-t attempt`专项实际2通过、另7由筛选未执行。原P2关闭，本轮无新增阻塞发现；两轮独立审查到此。设备/长规模实验缺口未因此关闭。

### M16I 集成候选复跑

独立审查修正后重新执行90配置（integration-smoke/），89胜1死、没有其它结果；与final-smoke逐条完整trace精确相等，包含每次拒绝、tick和摘要。源码 SHA-256 为 `16f77a010e4465cbececebdb20b157751036847e83efc103e19101bcc0646b38`，当前 smoke-summary.json / .md 对应本轮真实输出。重复配置不累计为独立胜率样本。

同一 Windows / Node / CPU、concurrency2，总48.68秒；单局中位1032.87ms / P95 1322.86ms / 峰1683.41ms；每局后worker heap中位59.11MB / P95 100.36MB / 峰107.46MB。采样非独占机器，不是峰值RSS或手机性能。
