# M25 Alpha 3 独立平衡基线

## 步骤、接口与停止点

2026-10-12。A 仅新增 `src/balance3/*`、`scripts/balance-alpha3.mjs`、`tests/balance-alpha3.test.ts` 与本文。旧 balance/core/content/session 保持冻结，不改变旧 9000 配对输入。

使用正式 `GameSession(seed,'alpha3')`，复用 `createAgent` 的三公开策略和三配装。新代理身份 `m25-alpha3-public-1` 明确记录继承 `m16-public-1`。旧策略提出投掷时只从当前公开 view 定位目标，转换为 `a3:throw:ID:floor:x`；缺失公共目标时终止为 agent-unsolved，不猜测隐藏坐标或回退到旧投掷命令。其余命令原样提交，无资源、位置或状态注入。

单局记录每次原提议、实际命令、接受/拒绝、原因、tick、digest，并记录终止原因、配置、规则身份。回放从正式新局开始逐尝试比较。动作、tick、尝试及无进展预算有界；tick 上限在下一命令前判断，最后合法动作可能跨过阈值。CLI 默认 10 种子 × 3 配装 × 3 策略，可设 1–1000 种子，每局独立文件及追加轻量索引，避免保留整个矩阵 trace。开跑前冻结完整相关源码清单并在结束校验；吞吐、分布及采样内存注明 Node 环境，不能替代浏览器性能。

验收：公开位置适配/隐藏目标不猜测、拒绝不改机械、完整逐步精确复播与篡改拒绝、三策略三配装小预算双跑确定性、非法配置拒绝及 CLI 小样本真实产物。新身份不与旧摘要比较。自测完成后冻结候选交根独立审查；本步不启动大型矩阵，也不宣称新规则平衡已验收。

## 策略与命令

冻结旧 `createAgent` 三策略没有投掷分支。基础矩阵保持该行为，不能以零投掷样本宣称覆盖新抛射。另设 `probe:true` / `m25-alpha3-one-throw-1`：正式选配装后，从公开背包选一件未装备食物，向同层当前可见、已探索且距离 1–5 的敌人提出一次投掷，然后继续原策略。这是单独探索策略，不并入基础矩阵；所有物品和状态均来自正式新局与命令。每个包含已接受新投掷的自然通关候选，可从新局精确重放导出完整 `natural-alpha3-won.json`。

CLI 示例（输出目录必须不存在，避免覆盖历史证据）：

```powershell
node scripts/balance-alpha3.mjs --seeds 1 --double-run 1 --out <新目录>
node scripts/balance-alpha3.mjs --seeds 1 --double-run 1 --probe 1 --out <另一新目录>
node scripts/balance-alpha3.mjs --replay <目录>/runs/1-vanguard-novice.json
```

省略 seeds 默认 10（90 局），最大 1000（9000 局）。最初仅运行 seed 1 的两种独立 9 配置小矩阵；后续授权的90+90扩展结果见本文末节，未运行9000。复播 CLI 要求当前来源清单 SHA 和保存的 trace SHA 一致；候选源发生变化时拒绝，不能静默将旧报告标为新候选结果。

## 首次执行与审查记录

首次专项 5/5 通过，但全局类型检查发现测试故意篡改 readonly identity 使用了直接赋值；改用 Object.assign 后通过。加显式探索策略后 6/6，通过真实自然 40 动作小样本的一次新投掷。第一次完整基础九配置双跑、逐尝试精确回放全部通关、0 次投掷，48.85 秒；这是首候选，不累计为更多独立种子。

其后基础短批在 package.json/package-lock.json 更新到 0.25.0-rc.2 时运行，九局虽全部通关且双跑/回放相同，结束来源校验仍正确拒绝，`valid:false`。保留外置 `alpha3-balance-final`，不当作冻结基线。包稳定后的 `alpha3-balance-stable` 与 `alpha3-probe-final` 分别 9/9 通关，来源一致；前者 0 投掷、49.19 秒，后者 9 次已接受投掷、52.03 秒。这些均属于审查第一候选。

根第一轮独立审查发现：把十动作上限局的 outcome 从 action-limit 改为 won，旧复播仍返回 `9a2f41a3`。作者实际复现并修复：复播核对终态 won/dead、可证明的动作/tick/会话限额、适配次数、最终/最低血量、最低食物、最深楼层与击杀数。新增伪造元数据反例后专项 7/7，3.34 秒。此次全局类型检查被并行 renderer.ts 的 collision 联合类型访问错误阻挡，A 未改该文件；不把这次全局检查记为通过。修复候选已交根第二轮；最终重建结果另列。

大日志和每局 trace 位于 `C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m25/`。没有大矩阵、新规则胜率调参或真机性能结论。每个种子的九配置相关，报告计数为描述性结果；重复运行只证明确定性，不增加独立样本量。

## 修复后最终候选实际结果

2026-10-12，外置 `alpha3-balance-reviewed` 与 `alpha3-probe-reviewed`。两组均 seed 1 × 三策略 × 三配装；maxActions=1800、maxTicks=30000、stuckLimit=96、concurrency=1、double-run=1。每组9/9自然通关，每个配置的第二次完整运行与第一次对象逐字段相等；每次首次结果均逐尝试精确重放。每组仍只有一个独立种子，不能外推总体胜率。

最终来源 SHA-256：`9dd4400cf531cfa1b09fe555c73dd2a3b9d962c3a791df318edec6c2dac3f1f5`，43 个相关输入，开始/结束校验一致。新规则 identity：`{"archive":1,"commands":7,"rules":"alpha3-1","content":"2681b398"}`。

| 策略/配装 | 基础行动/tick | 探索行动/tick | 结局 |
|---|---:|---:|---|
| novice/vanguard | 411/4150 | 414/4176 | 两组 won |
| survivor/vanguard | 429/4334 | 430/4340 | 两组 won |
| fighter/vanguard | 424/4282 | 426/4302 | 两组 won |
| novice/breaker | 398/4430 | 397/4390 | 两组 won |
| survivor/breaker | 409/4532 | 409/4492 | 两组 won |
| fighter/breaker | 410/4374 | 412/4394 | 两组 won |
| novice/channeler | 454/4768 | 460/4830 | 两组 won |
| survivor/channeler | 396/4212 | 398/4232 | 两组 won |
| fighter/channeler | 392/4174 | 395/4200 | 两组 won |

基础合计 3723 个已接受行动、9 次拒绝、0 次投掷；探索合计 3741 个已接受行动、9 次拒绝、9 次已接受投掷。基础的9次拒绝均为自然 down/blocked，精确回放也复现拒绝及其不推进机械状态。

环境：v24.14.0，win32 10.0.26300 x64，12th Gen Intel(R) Core(TM) i5-12600KF。Node顺序单进程采样；每局耗时包含正式游玩、精确回放及第二次游玩，非纯模拟基准；与其他集成工作共用机器，不宣称独占性能或产品回退。

| 批次 | 总秒 | 每局中位/P95/最大 ms | 采样堆中位/P95/最大 bytes | 采样RSS中位/P95/最大 bytes |
|---|---:|---|---|---|
| 基础 | 56.53 | 6211/7769/7769 | 43662768/76050120/76050120 | 249655296/251088896/251088896 |
| 探索 | 52.88 | 5613/6194/6194 | 36519600/68663104/68663104 | 250839040/251588608/251588608 |

内存是每局完成后的9个观测点，不是进程峰值或连续采样。CLI正向复播基础 seed1/vanguard/novice：412次尝试，digest `35dcedb6`；另真实运行伪造来源SHA与伪造trace摘要的CLI，两者退出1并分别拒绝来源不匹配与trace SHA不匹配。

自然黄金候选：`C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m25/alpha3-probe-reviewed/natural-alpha3-won.json`，SHA-256 `07e5cefa710f7e51bbc7ced62d583d50c05106d815f994b617c35b6280134778`。来源 seed1/vanguard/novice 探索策略、414个正式行动；首个新投掷 `a3:throw:8:0:12` 于tick106接受，最终digest `bffb742d`，trace SHA `3329e3109bf16d268f6838b17a2b4c85eadc1afbf21d2b76cadab54a408c9003`。归档由alpha3正式新局逐命令重放生成，未改旧档identity；根评审后负责复制为黄金夹具及seek/续录验收。

修复后源码冻结：

- `src/balance3/runner.ts`：`86d5d73955f0d9feab3c0ee0c187a495b0865ca2d4ae085c59e60de8ce76afce`
- `scripts/balance-alpha3.mjs`：`d090a9beb406bd9433182e5aac09a133ad94997c2d33e7659779b4594d617169`
- `tests/balance-alpha3.test.ts`：`8cf81b0face516273fad2f6011f95dec70a7b10a503742a306eab4f3adb37fcd`

根第二轮独立审查已结束：根阅读固定修复与测试，并独立执行 balance 专项 7/7 与自然黄金相关 21/21，合计本次 28/28 通过；原伪造 outcome 反例现被拒绝，第二轮关闭。该结论来自根独立执行，不与作者前述复测累计样本。自然黄金已进入根后续存录验收。

## 90 + 90 扩展基线执行

根另授权顺序执行 seed 1–10 × 三策略 × 三配装，基础和探索各90局，均开启 double-run 与精确回放；不改实现源码。产物目录为外置证据根下 `m25/alpha3-baseline-90` 与 `m25/alpha3-probe-90`。本节开始时仅表示实验已安排，结果在完成后补录；小样本结果不替代该批结果。

### 90 + 90 实际完成结果

2026-10-12，两组按上述命令顺序完成，退出0。每组89局won、1局dead，无error/action-limit/tick-limit/agent-stuck。两组均完成每配置第二次独立自然运行的完整结果相等比较，以及逐尝试 accepted/rejected、原因、tick、digest 的精确复播；180个配置结果全部复现。统计覆盖seed1–10，只有10个独立种子；双跑及复播不增加独立样本。

两组来源 SHA-256 均为 `9dd4400cf531cfa1b09fe555c73dd2a3b9d962c3a791df318edec6c2dac3f1f5`，43输入开始/结束一致，`inputsUnchanged:true`、`valid:true`。各自 `inputs.json`、`metadata.json`、`index.jsonl`、`summary.json/md` 和每局 `runs/*.json` 已保存；实现源码没有修改。

| 策略/配装 | 基础won/dead | 基础接受/拒绝 | 探索won/dead | 探索接受/拒绝 | 探索新投掷 |
|---|---:|---:|---:|---:|---:|
| novice/vanguard | 10/0 | 4185/3 | 10/0 | 4206/3 | 10 |
| survivor/vanguard | 10/0 | 4345/3 | 10/0 | 4357/3 | 10 |
| fighter/vanguard | 10/0 | 4278/3 | 10/0 | 4314/3 | 10 |
| novice/breaker | 10/0 | 4024/3 | 10/0 | 4036/3 | 10 |
| survivor/breaker | 10/0 | 4131/3 | 10/0 | 4132/3 | 10 |
| fighter/breaker | 9/1 | 4070/3 | 9/1 | 4097/3 | 10 |
| novice/channeler | 10/0 | 4701/3 | 10/0 | 4721/3 | 10 |
| survivor/channeler | 10/0 | 4012/3 | 10/0 | 4024/3 | 10 |
| fighter/channeler | 10/0 | 3962/3 | 10/0 | 3975/3 | 10 |

基础合计37708个已接受行动、27次拒绝、0次投掷；探索合计37862个已接受行动、27次拒绝、90次已接受新投掷。两组终局分布相同并不证明等价平衡，不能由10个种子推断整体胜率或投掷价值。

死亡trace（均由正式新局产生，双跑和逐尝试回放相同）：

- 基础 seed2/breaker/fighter：dead，277行动，tick2990，HP0，final/replay digest均`40a0cc7f`；`alpha3-baseline-90/runs/2-breaker-fighter.json`。
- 探索 seed2/breaker/fighter：dead，278行动，tick3000，HP0，final/replay digest均`6202f6da`；`alpha3-probe-90/runs/2-breaker-fighter.json`。

| 批次 | 总秒 | 每配置中位/P95/最大 ms | 采样堆中位/P95/最大 bytes | 采样RSS中位/P95/最大 bytes |
|---|---:|---|---|---|
| 基础90 | 586.61 | 5726/10577/11228 | 43780280/76850504/86551848 | 254861312/258928640/259117056 |
| 探索90 | 1555.81 | 13046/51118/78929 | 40047464/73278648/77087424 | 247037952/253603840/257064960 |

环境沿用上文Node24.14.0/Windows10.0.26300/i5-12600KF。每配置时耗包括两次自然运行和一次精确复播；每组90个完成后内存采样点。宿主并行存在其他Node集成任务，尤其探索批期间，因此吞吐仅描述共享负载，不用于归因规则性能。无连续内存/峰值内存/GPU/真机性能结论。未执行alpha3的9000配置大矩阵。

最终工具文件SHA复核：

- `src/balance3/runner.ts`：`86d5d73955f0d9feab3c0ee0c187a495b0865ca2d4ae085c59e60de8ce76afce`
- `scripts/balance-alpha3.mjs`：`d090a9beb406bd9433182e5aac09a133ad94997c2d33e7659779b4594d617169`
- `tests/balance-alpha3.test.ts`：`8cf81b0face516273fad2f6011f95dec70a7b10a503742a306eab4f3adb37fcd`
