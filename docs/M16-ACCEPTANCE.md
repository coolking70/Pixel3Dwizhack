# M16 本地切片验收记录

日期：2026-10-11。实现以用户授权的M16任务包为范围，源码基线、接口和首次失败见 [M16-INTEGRATION](M16-INTEGRATION.md)。本轮不是M17–M20全量完成或发行验收。

最终源码/测试/脚本/资产及构建配置共187文件，按排序路径与文件SHA-256计算的候选清单摘要为 `84b7dbb0cdc24ba83ef0081b3cb9879b5faab50b6f15ddf999372047f11f4f3f`。不含Markdown文档；完整清单在外部证据根目录的 `m16-accepted-source-manifest.json`。这是文件清单摘要，不是Git提交或发布版本号。

## 实际产物与文件范围

| 组 | 产物与主要修改 |
| --- | --- |
| M16A | `src/balance/`、`scripts/balance-*`、`tests/balance/`、`reports/balance/`：三公开信息代理、正式命令CLI、分层统计、配对bootstrap、自然失败重放 |
| M16B | `src/game-ui/`、`src/alpha2/Game.vue` / `i18n.ts` / `style.css`：同画布HUD、六槽装备、16格背包、键鼠触屏路由和3D预览 |
| M16C | `assets-src/items/`、`public/assets/items/`、`src/visual/items/`、资产生成/审计脚本：45计划、12定义样品、29公开外观GLB、共用缩略图/挂点 |
| M16I | `src/visual/motions/`、`src/room/renderer.ts`、`src/character-lab/character.ts`：公开动作收据、分段IK、物品转手、门/闩/箱盖、失败中止 |
| 门禁 | `scripts/check-boundaries.mjs`、`tests/visual/`、`tests/m16-trace.ts`、原生UI/交互浏览器测试、两项profile脚本；package仅新增脚本，未升级依赖或版本 |

`src/core`、`src/content`、`src/session`的24个既有文件与M15源码包SHA-256完全相同。没有更改六规则身份、历史黄金夹具或存档键；`alpha2-1` / commands6 / archive1 / content144ae545保留。原Alpha2浏览器测试仅将入口切换到显式`?ui=legacy`，原断言保留。无Git元数据，未提交、推送、部署或覆盖M15分发包。

## 真实命令和结果

环境：Windows 10.0.26300、Node24.14.0、Playwright1.64.0 / Chromium156；桌面与iPhone13尺寸Chromium触屏模拟。后者不是真实手机。

| 命令 | 实际结果 |
| --- | --- |
| `npm run check`（最终产品代码） | 120/120单测，19文件，143.06秒；24纯规则文件及新增目录边界、严格类型、八入口生产构建通过 |
| `npm run check:models` | 27身体、41护甲、12武器部件配方一致 |
| `npm run check:items` | 45计划、12样品定义、29GLB；421284字节、4884三角形，散列/结构/预算检查通过 |
| `npx playwright test --workers=2`（第一次全量候选） | 73/74，13.3分钟；旧54项全通过，原生UI16项全通过；桌面WebGL失效竞态1项失败，首次证据保留 |
| `npx playwright test tests/browser/interactions.spec.ts tests/browser/native-ui.spec.ts tests/browser/room.spec.ts --workers=2`（最终推门修正后） | 28/28，1.3分钟；交互6、原生UI16、旧哨站6，包括新增“DOM失效通知前RAF完成”反例 |
| `node scripts/balance-run.mjs --preset smoke --concurrency 2 --baseline <final-smoke/runs.json> --out <integration-smoke>` | 90配置，89胜1死，48.68秒；与前轮完整trace精确相同，源码SHA见balance报告 |
| `node scripts/balance-replay.mjs reports/balance/seed-2-breaker-fighter.json` | 277次自然命令逐边界验证通过，死亡摘要91ac71b4 |
| `node scripts/profile-m16.mjs <外部目录>` | 自然命令前缀/分支产生五个动作检查点，真实画布热区执行；接触/效果截图与每次保存的完整档精确比较通过，页面错误0 |

新增WebGL修复后没有重新运行整套76项浏览器测试。上述28项包含重复覆盖，不能累计成102项独立通过；也不能把第一次73/74改写为全量通过。后段截图又发现推门远端握点不可达，修正后增加第120项单测并重新执行check和28项浏览器复测；首次后段截图保留。性能脚本目录遍历和周期性操作采样、截图后段取帧属于测试工具变更，不改变游戏规则。

## 视觉、动作与独立审查

已查看48/64/96px模型图集、地面与穿戴夹具；五个自然分支包含拾取、门闩、关门、开箱、推门。程序姿态有准备/接触/效果/回稳，单测覆盖两朝向实际手掌与落脚；浏览器捕获实际接触误差均为0.0000（四位小数），阈值0.08m。门扇/箱盖旋转，拾取物体转入手挂点再收纳。动画后的保存、失焦结清均严格等于事先用正式命令产生的after存档。

实际看过桌面1440×900、390×844、844×390背包和动作截图。UI是同一可见WebGL画布中的正交层；中文/英文文字经离屏Canvas纹理绘制。模型缩略图有一个离屏渲染器和缓存，不为每格每帧创建renderer。未制作定义明确显示“待制作”。`?ui=legacy`保留回退，完整外围菜单仍有HTML。

balance、原生UI、视觉动作/装备分别进行两轮独立审查，反例、候选散列和关闭范围见 [视觉审查](M16-REVIEW-VISUAL.md)、[UI审查](M16-REVIEW-UI.md)、[balance报告](../reports/balance/README.md)。最终真实WebGL竞态在两轮之后由集成者发现并修复，只有作者浏览器复测，不冒称独立第三轮关闭。

## 未覆盖与下一责任人

- M16I保留最后WebGL竞态及推门后段握点修复的独立复核缺口；图形失效有可见提示并停输入，需要刷新，没有自动恢复验收。
- 真机触屏/GPU、Safari/Firefox、输入法/屏幕阅读器、长时压力和GPU内存未执行。桌面有限采样不替代这些项目。
- 动作完整矩阵尚未逐项覆盖每种动作×反向真实场景×全部装备×低帧×每一种中断；当前有双向IK单测和五个自然浏览器分支，不宣称穷尽。
- 900/9000局实验、真人难度/趣味性、美术最终认可待后续。自动代理胜率不等同玩家胜率。
- 剩余33件最终美术及三档LOD、商店3D预览、M19完整菜单画布迁移尚未完成；HTML商店没有新模型展示验收。

下一阶段由维护者依据本报告安排M17的基线分析和内容细化；本轮停在M16切片，不自动调规则数值或批量制作后续内容。性能详情单列 [M16-PERFORMANCE](M16-PERFORMANCE.md)，所有大图、原始trace与性能JSON均放工作区外。
