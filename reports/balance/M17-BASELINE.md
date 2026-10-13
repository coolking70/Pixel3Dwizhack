# M17A 9000 配置实际基线

2026-10-11。m16-public-1 冻结三策略，种子1–1000 × vanguard/breaker/channeler × novice/survivor/fighter；每配置正式新局、1800行动/30000tick/96重复无进展位置预算。十批，每批900局，并发6。机械规则仍为alpha2-1 / commands6，未调参。

**完成：8969胜、31死；error/action-limit/tick-limit/agent-stuck均0，未跳过任何配置。31失败全部逐正式命令、接受/拒绝、tick及digest回放通过，0回放错误。** 共43.667分钟；不是人工难度与可解性证明。

运行前冻结输入清单每批前后保持一致；manifest SHA256 `2b3c95d1d571ddba6dc2e8bf7456877111c083569058de0983f1cd83ebdb2114`。旧代理与runner字节冻结的SHA见m17-frozen-inputs.json；新实验策略和观察层不参与这9000局。

## 配装×策略分层

| 配装/策略 | 真实局数 | 胜 | 死 | 胜率 | Wilson 95%区间 |
| --- | ---: | ---: | ---: | ---: | --- |
| vanguard/novice | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |
| vanguard/survivor | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |
| vanguard/fighter | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |
| breaker/novice | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |
| breaker/survivor | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |
| breaker/fighter | 1000 | 972 | 28 | 97.200% | 95.983%–98.056% |
| channeler/novice | 1000 | 997 | 3 | 99.700% | 99.122%–99.898% |
| channeler/survivor | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |
| channeler/fighter | 1000 | 1000 | 0 | 100.000% | 99.617%–100.000% |

同一个配装/策略层有1000个不同seed。总量、跨策略/配装合并的Wilson区间及原冻结report的非分块paired值只作描述，不把同seed九配置当9000独立地图。M20候选比较必须用新增compareMatrices：完整9000配置严格配对、1000 seed块重采样，并检查每条trace SHA和最终digest；不能只看总体胜率。

## 公开诊断

- 28死属于breaker/fighter，公开死因为Emberling；channeler/novice另有2次Fallen Star warden、1次Ember bed。其余七层1000/1000胜。自然死亡未被登记为规则bug。
- 六深度进入数：9000、9000、9000、8996、8987、8972；相应死亡0、0、4、9、15、3，删失0。深度为内部0–5编号。
- 行动中位416/P95 469/峰508；tick中位4378/P95 4952/峰5402；最低HP中位26/P95 50。治疗每正回复动作中位22.6 HP、P95 24.714，包含泉水，不能解释为药剂理论效率。
- 食物消耗中位1/P95 2，所有观测均未落入<=25%饱食压力；这说明冻结代理会及时进食，不证明食物机制无影响。
- 38396次物品使用，未知试用0、商店支出0。未知物品和商店路径不由该基线覆盖；合法未知探索/禁物品/保留武器另见M17-EXPERIMENTS.md。
- equipmentRates包含起始装备；物品至少选用一次的局占比、公开伤害来源、治疗/食物/深度与失败配置完整列在m17-baseline-analysis.json。environment-or-periodic约82.77%为无法进一步归因的公开聚合余项，不擅自归到特定怪物或隐藏状态。

## Node模拟性能（逐批实际样本）

Windows 10.0.26300 x64；Node v24.14.0；Intel i5-12600KF；6 worker；每批900游戏。部分时间与构建/实验/测试并行，非独占CPU；不能替代真实浏览器/手机帧时间。heap为每局后worker采样，不是进程RSS峰或显存。未从批次分位数伪造全体分位数。

| 种子批次 | 每局ms中位 | P95 | 峰值 | worker heap MiB中位 | P95 | 采样峰 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| seeds-1-100 | 1489.5 | 1720.0 | 1953.2 | 54.9 | 84.8 | 91.8 |
| seeds-101-200 | 1605.3 | 3029.8 | 3934.8 | 55.2 | 85.9 | 95.4 |
| seeds-201-300 | 1693.9 | 3232.8 | 3920.7 | 53.8 | 84.4 | 93.8 |
| seeds-301-400 | 2495.6 | 3918.5 | 4732.2 | 51.3 | 81.9 | 90.5 |
| seeds-401-500 | 1533.5 | 2243.7 | 3007.9 | 54.5 | 84.3 | 96.9 |
| seeds-501-600 | 1529.2 | 2081.7 | 3024.5 | 54.9 | 85.9 | 96.4 |
| seeds-601-700 | 1462.5 | 1705.1 | 2126.0 | 55.9 | 86.9 | 102.9 |
| seeds-701-800 | 1591.1 | 2455.9 | 3133.4 | 54.4 | 85.3 | 97.6 |
| seeds-801-900 | 1447.7 | 1679.9 | 2121.1 | 54.4 | 85.9 | 100.5 |
| seeds-901-1000 | 1441.6 | 1651.8 | 1855.3 | 54.2 | 84.6 | 96.6 |

## 证据与复现

外置根：`C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m17-balance/baseline-9000/`。各seeds批次保存全部runs.json与失败JSON、CSV、MD、日志。summary-runs.json只有结果和完整trace SHA，不是回放存档；真实逐步复现须用rawBatch或failures中的原始trace。仓库只留本报告、分层summary/analysis、31失败索引和冻结清单。

```sh
node scripts/balance-milestone.mjs <新的外置目录> 1000 6 100
node scripts/balance-analyze.mjs <外置目录/summary-runs.json>
node scripts/balance-diagnose.mjs <外置目录>
node scripts/balance-replay.mjs <外置目录/seeds-1-100/failures/2-breaker-fighter.json>
```

31条回放索引见m17-failure-verification.json。首次seed2/breaker/fighter与M16故障样本仍相同digest91ac71b4；全部31均自然终局前缀，未做删除命令/人工注入的伪最短化。独立审查工具的两轮修复记录见M17-EXPERIMENTS.md。M17A工作完成；M20最终9000复跑现已完成，9000/9000轨迹及摘要一致，详见M20-COMPARISON.md。
