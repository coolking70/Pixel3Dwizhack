# M26E 规则、生成与验收步骤

2026-10-12。仅规则/内容/会话、新 balance4、相关新测试脚本与本报告；不写 action-types、UI、打包或旧黄金。旧七身份及黄金保持。新身份 alpha4-1 / commands8 / archive1；首次容量/掉落改动在此身份生效。

公开接口：Item2View.equippableSlot 可选，只从公开已知定义、已装备槽或同公开类别共同槽推导；未知数值不补零。所有 Alpha 2 系列可使用该纯投影扩展。Alpha4 的 capacityUsed 为未装备携带实例数，capacityIncludesEquipment=false，capacity=16；bag 仍含全部携带，weight 包含穿戴。旧 capacity 实际是实例数量上限，不是重量上限；没有新增未授权的负重惩罚。

步骤1：新命令分支保持旧动作/时钟和物品效果，分别检查拾取、购买、卸下及换装净格数；拒绝返回 bagFull 并保持 RNG/tick/revision/存档全等。装备不临时改变 owner，不自动丢物。查询独立按新容量计算，不借试执行预测隐藏真相。

步骤2：在正式 Alpha3 新局上追加仅 Alpha4 的确定性生成阶段，版本化独立 loot RNG，生成原生实例与私有敌人预分配奖励。深度预算覆盖初始散落、容器、预分配敌人奖励及可预知自然尸体掉落；商店和玩家初始装备另计。配置含每深度预算、单遭遇上限、13格窗口初始散落上限及散落/容器/敌人分布权重。首层两个教学物品分散，另两个放入可付费/强开的首层箱子；保留箱子开启和击杀形成的有意义小堆。预算不删除玩家后来主动投掷/丢弃的物品，不伪装为动态世界总量硬上限。

步骤3：容量和保密受控反例、七旧黄金逐摘要、Alpha4 正式自然通关黄金及seek/续录、1000独立种子生成分布、多个公开代理/配装与Alpha3配对资源统计。生成统计允许读取生成器完整世界作离线审计，游戏代理仍只读公开投影且仅submit。先小矩阵验证，再冻结交独立审查；旧9000须集成者另行启动。新规划不计完成，首次失败与真实结果随后补录。

## 第一候选真实执行

- 类型检查已通过。容量、生成、资源工具首轮共12项通过，其中生成检查实际覆盖1–1000共1000独立种子；观察指标细化后工具3项复测通过。
- 首次失败：新容量测试误用不存在的 vitality 定义，4项失败/3项通过；改成内容表真实 emberRing 后7/7通过。旧测试和旧黄金未改。另新增工具编译时 rows 推断与双身份 union 报错，修复后类型通过。
- 七历史身份：alpha2专项14项与alpha3自然黄金21项，共35项通过，逐历史摘要和完整存档重建保持。
- 新黄金：正式alpha4新局 seed1/vanguard/novice，425命令，含a3:throw、开箱和采集；final 394a5ba3。22项验证全部边界、非单调seek和前缀续录。来源为外置smoke18自然正式capture，不做身份替换。
- 自然小矩阵：1独立seed×3配装×3策略×2规则=18局，18won。全部双跑全对象相同、逐尝试精确回放，18次实际接受投掷。耗时 88.42s；Node v24.14.0 / win32 10.0.26300 x64 / 12th Gen Intel(R) Core(TM) i5-12600KF。有同时进行的本地测试负载；不是设备渲染性能测试。
- 原始证据 C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd/m26/alpha4-smoke-18。输入前后验证一致，SHA256 01cbf655f218c70946a68ac1e90534f7a1d1125fddfbb174cd42025d4db436a6。首个smoke的healingDrinks统计包括其他self drink；此批保留，后续观察层已改为仅公开renewal/potion并加反例3/3通过，扩大AB使用新来源，不冒充同一统计版本。

1000种子生成A/B（每格旧alpha3 / 新alpha4，数字为每层均值；预算包括固有尸体，初始携带与商店另计）：

| 深度 | 资源预算 | 初始散落 | 13格窗口峰值均值 | renewal实例 | 食物含固有尸体 |
|---|---:|---:|---:|---:|---:|
| 1 | 12 / 12 | 9 / 5.964 | 7 / 3.998 | 1.072 / 1.219 | 4.334 / 2.855 |
| 2 | 8.679 / 10 | 5 / 5.109 | 3 / 3.61 | 2.258 / 1.302 | 2.704 / 3.061 |
| 3 | 10.532 / 10 | 5 / 4.685 | 3 / 3.364 | 2.24 / 1.258 | 4.551 / 2.993 |
| 4 | 10.409 / 11 | 5 / 5.321 | 3 / 3.719 | 3.269 / 1.303 | 2.552 / 3.076 |
| 5 | 8.475 / 11 | 5 / 5.927 | 3 / 4.013 | 2.24 / 1.334 | 2.558 / 3.099 |
| 6 | 7 / 12 | 5 / 7.553 | 3 / 4.669 | 2.099 / 1.378 | 1.362 / 2.576 |

全部新图初始单格散落≤1、每13格≤5、单次遭遇物品含尸体≤2、单容器≤2；每层有已知uncursed renewal和ration位于散落或可开容器，不依赖罕见钥匙。预分配敌人物品在死亡前不出现在公开ground/bag/facility stock，击杀之后只释放一次。两个教学散落在3和8，另两个在首层x10的真实可付费/强开箱子。玩家后续丢弃、投掷和开箱堆不受初始窗口预算抹除。

该改动重新分布深度与来源，没有统一减少所有掉落：首层旧4件同格改为分散，但新深层散落窗口均值高于旧3。renewal总量显著减少而总体资源预算增加，必须通过自然多种子资源AB评估；18局全部胜利不能证明难度合适，也不能代替既有高胜率限制。扩大AB与独立审查尚未完成，不更新项目完成状态。

categoryWeights 的准确公式：每个 eligible 定义按所属类别权重抽签；P(category)=该类别eligible定义数×配置权重/所有eligible定义权重之和，并不是先独立抽类别再均匀抽定义。根已接受该语义，content新增纯注释，不改变机械身份摘要。

## 状态归属和审查记录

- alpha4.lootRng：Alpha4生成器唯一所有者，版本化seed盐初始化，只生成阶段使用。完整存档/摘要包含它，查询和动画不读写。
- alpha4.enemyDrops：Alpha4规则唯一所有者，稳定enemy/item引用，预生成物品owner=container、holder为负enemy id。成功正式命令边界才释放为ground；失败克隆不发布，不重发。完整存档和逐命令重建验证引用及状态；旧身份没有这个可选字段。
- bagSlots4、capacityUsed、equippableSlot均纯派生，无持久化缓存。全部实际携带仍owner=bag，穿戴不减weight。
- B第1轮独立审查据根回执：16个固定机械文件哈希一致；实际1000种子/12容量反例通过，无发现。随后仅content权重公式注释更改，已通知B追加哈希；不计第二轮机械变更。
- 旧9000按根决定本轮不重复：与M25发布源码逐SHA确认alpha2.ts、clock、map、effects、shared、content/alpha2完全相同；M25既有9000证据不冒称M26重跑。
- 新黄金文件SHA256 c1c333fe51b4d3d24d376b282e59d5b41d1aafca448931e8b533e3b7c2b8e19c，测试SHA256 c7ceab387b95f5c1b38ae7128291e3ad8341e5faf54e75cfa83d69301a24f00c。
- 最终资源AB已启动：180配置（seed1–10×3配装×3策略×alpha3/4），同一m26-resource-public-1公开代理，double-run=1，1800动作/30000tick/96停滞预算；逐配置JSON含traceSHA256与每步摘要，输入manifest SHA256 1eb1cd6cf2da438558a19cd1b9c09c1d89119ac947ce717765a4bc896958db6f。当前只记开跑，结果完成后补录。

独立工具审查：根已只读检查runner/resources/distribution/agent，未发现必须修复项；确认代理只读取public并正式submit、离线地图audit隔离、双跑与每步摘要、来源守卫、seed-block bootstrap。审查另指出peakOrdinary字段实际采用该身份的capacityUsed（旧规则含装备、新规则不含），最终报告只称“身份容量计数峰值”，不将其解释为同口径普通物品数差。静态审查不计作180局运行验证。

## 实际入口和复现

```powershell
npm run typecheck
npx vitest run tests/alpha4.test.ts tests/alpha4-generation.test.ts tests/balance-alpha4.test.ts
npx vitest run tests/alpha2.test.ts tests/alpha3-golden.test.ts
npx vitest run tests/alpha4-golden.test.ts
node scripts/balance-alpha4.mjs --seeds 1 --double-run 1 --probe 1 --out <新的外置目录>
node scripts/balance-alpha4.mjs --seeds 10 --double-run 1 --probe 0 --out <新的外置目录>
node scripts/balance-alpha4.mjs --replay <当前来源匹配的单局JSON>
```

CLI默认maps=1000，独立生成分布同时记录alpha3/alpha4同seed；默认自然矩阵10seed、两个身份各9配置，逐局落盘不保留大trace矩阵。支持--scenario alpha3/alpha4/both、--maps 0跳过生成审计、--seeds最大1000，但本任务仅授权上述180配置。已有输出目录拒绝覆盖。CLI来源范围包含core/content/session/balance/balance4、实际脚本、package及lock；结束校验不一致则该批标无效。
