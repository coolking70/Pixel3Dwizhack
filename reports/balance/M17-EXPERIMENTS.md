# M17 合法物品与武器策略对照

2026-10-11，实际执行90个配置：种子1–10 × 三配装 × 三策略干预。所有配置以正式 `GameSession(seed,'alpha2')` 新局，只读取冻结公开view并调用submit；没有注入物品、资源、坐标或读取隐藏世界。策略版本独立为 `m17-experiment-1`，原 `m16-public-1` 三策略及runner字节保留，验证入口会检查其固定SHA。

| 干预 | 实际结果 | 未鉴定物品正式试用 | 公开见到替代武器的局 | 实际换主手 |
| --- | --- | ---: | ---: | ---: |
| explore 正常实验探索 | 30胜 | 150 | 30 | 6 |
| no-item-use 禁用所有物品使用 | 9胜、21死 | 0 | 30 | 0 |
| keep-starting-weapon 保留起始武器 | 30胜 | 150 | 30 | 0 |

no-item-use 禁用potion与全部a2:use，**包括食物、药剂、卷轴、充能法杖和工具使用**；仍可拾取、穿戴、基础攻击与原生cast施法，因此结果是完整策略/资源限制效果，不是某一种隐藏物品的独立效果。保留起始武器只禁止换主手，保留防具改变。所有失败均由同种子正式命令trace逐摘要重放通过，21个自然死亡不是21个规则缺陷。

成对比较按种子分块重采样：同种子的三配装一起抽取，共10个独立种子块、30个匹配配置，固定bootstrap种子362，2000次。禁物品相对正常探索胜率差 -0.70，95% percentile CI约[-0.867,-0.533]；保留起始武器胜率差0，但两组30/30均胜且真正发生的换主手仅6次，不能据此证明武器等价。后者最终HP平均差+0.233（CI[-2.367,+3.534]），tick平均差+26.733（CI[11.932,42.667]）。较少tick可能因更早死亡，不能单独解释为效率提升。

实际执行172.888秒，Node24/Windows，与9000基线实验并行，故不作为独占CPU吞吐或浏览器性能。原始 `runs.json`、逐失败trace、CSV、统计和扩展指标在外部 `m17-balance/experiments-90/`；仓库保存轻量 `m17-experiment-summary.md`。报告生成器随后修正了沿用旧三策略时的“未试用未知物品”固定文字，并把CI改为种子块bootstrap；只重新分析同90份真实结果，未伪称又执行90局。

策略决策文件 `src/balance/experiment-agent.ts` SHA256 `7aa840ad3edff5d897510f8e76361096495b693a96ec9b08a0f1c6cb72c90213`。报告模块与政策版本分别记录于summary.json的reportingSources。旧三策略9000基线在独立批次持续执行，不与这90配置混合计数。

## 工具与验证

```sh
node scripts/balance-experiment.mjs <外部目录> 10
node scripts/balance-experiment-report.mjs <外部目录/runs.json>
node scripts/balance-analyze.mjs <runs.json或summary-runs.json>
node scripts/balance-milestone.mjs <外部目录> 1000 6 100
node scripts/balance-compare.mjs <基线summary-runs.json> <候选summary-runs.json> <对照输出.json>
npx vitest run tests/balance/experiments.test.ts
```

新增专项先5/5，补公开正负状态计量反例后最终 **6/6，38.17秒**：冻结字节、自然未知试用/完全复现/逐步回放、两类干预合法性、公开指标/删失失败、完整矩阵缺失/重复/策略版本拒绝、同胜率不同trace检出、增益状态不误计负面。首次全局vue-tsc遇并行UI的Game.vue参数数量暂态错误，A文件无类型错误；后续再次 `npx vue-tsc --noEmit` 已退出0。最终产品门禁仍由集成负责。尚待集成安排独立审查，作者自查不称独立关闭。

扩展分析只使用已记录公开指标：正治疗动作的实际HP回复比、低于25%饱食时的行动占比、每深度进入/死亡/未终局删失数、每物品至少选用一次的局占比及区间、公开来源伤害份额、未知试用与同命令期间负面变化。未知负面变化是相关观测，不能证明来自该物品；稀有度和不可见中间事件不推断。JSON有全部分职业/策略分组和失败配置，不只保留总体胜率。

指标自查还发现旧runner的未知试用负面计数把任意新增状态视为负面，可能误计ward/light等增益；旧三策略未知试用0，不影响冻结基线。新 `m17-observation-1` 层通过逐命令正式重放，仅将HP下降或公开poison/sleep/blind/confused/slow/burn的新增计为同时负面变化，并单列增益引入。原始runs.json保留，重新观测的派生结果另存observed-runs.json；不改变任何命令、tick或摘要，不伪称再次自然游戏。后续报告/CSV使用修正观测。

## 独立审查首轮与修复

集成审查者首轮提出两项P2，作者已修复，第二轮由同一独立审查者实际复核关闭：

- `compareMatrices` 原把同种子的九配置当独立样本。现保留全部配置的trace/digest精确匹配判定，先对每个seed内的配对差值求平均，再做seed-block bootstrap，单列配置数与seedBlocks。新增复制同seed三配装不改变均值/区间的反例。专项7/7，19.44秒；最终断言使用meanDifference，避免不存在字段的空比较。
- 旧实验CLI只在结束时hash五文件，不能证明运行中源码稳定，且遗漏观察层。新CLI在加载Vite模块前递归冻结core/content/session/balance、所有balance脚本与package/lock（当前47文件），保存frozen-inputs.json，结束再核对完整文件集合与SHA；变化则拒绝候选。独立脚本实际验证原manifest通过、伪造observation SHA必拒绝。旧90原始结果保留为首次候选，不补写不存在的运行前冻结证明；其后观察层重建来源仍见reportingSources。

修复后 `m17-balance/experiments-90-reviewed/` 真正复跑90配置已完成，268.008秒（并行CPU负载）：30胜、9胜21死、30胜；90/90完整trace和最终digest与首次候选逐项一致。新观察层负面相关计数70；21死亡trace逐摘要重放通过。47文件运行前后hash一致，manifest SHA256 `17b128236e01c8b78a38590806fbca0757d7e5cc1ace3f602c4cd0f9f60dd286`。不与首次90相加当180个独立配置。最终均值字段修正后单独重跑seed复制回归1/1（其余6项仅测试过滤），通过。各arm摘要的pooled Wilson区间只作描述：同seed内配置相关，主要干预结论以seed-block结果为准。再次全局vue-tsc退出0。

第二轮独立复核记录：集成审查者固定compare `00ed6b4eb3f600513009085f7668a4e75c8714ee00000e9a86ddd09b15ee450a`、inputs `cf04958f9e610fff38ac5a3f271d17c078263748e9678bb028ba2bd61ff331fa` 候选，阅读compare/inputs/CLI，实际跑compare与seed回归2/2（过滤其余5项，不称全套），另独立调用manifest验证，47依赖包含observation、未变通过、伪造其hash被拒。两项P2关闭，本轮无新增阻塞；两轮到此，后续缺陷另行登记。作者90复跑与审查者专项不叠加计数。

M20完整9000同配置对照随后已在冻结候选实际完成，9000/9000轨迹及摘要一致，详见M20-COMPARISON.md；本文件保留M17实验阶段记录。
