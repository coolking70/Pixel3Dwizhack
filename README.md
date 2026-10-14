# Dungeon Descent

TypeScript + Vue 3 + Three.js 的原创横版 roguelike 开发工程，保留早期 Canvas 基线。玩家不行动时规则世界静止；已接受的行动具有确定的时间成本，可以存档并从种子验证回放。

网页预览：[GitHub Pages](https://coolking70.github.io/Pixel3Dwizhack/)（main通过CI后自动发布，默认进入M35）。历史入口仍可按原HTML文件名访问，Pages中的M01入口为`mine.html`。网页存档按浏览器和站点隔离；从本地版本迁移时，在原页面导出JSON，再在网页“更多→游戏→存录”导入。

部署使用`npm run build:pages`生成`dist-pages/`；本地验证运行`npx playwright test --config playwright.pages.config.ts`，或`npm run preview -- --mode pages --port 5180 --strictPort`后访问`http://127.0.0.1:5180/Pixel3Dwizhack/`。常规`npm run build`及本地分发仍使用`dist/`。CI保留完整单测与历史/M31/M35浏览器分组，Pages在全部门禁通过后部署。

当前已交付本地候选 **M35 · 0.35.0-beta.2**：`/alpha6.html`，独立alpha6-1/commands10与dungeon-descent.m35存档。全画幅轻量HUD、短日志、两菜单入口、成功操作回世界、公开设施说明与分组、墓烬回廊2怪/3工具/2设施。158项精简检查及6条Chromium功能/局部性能链通过，18配置双跑/回放通关；旧九身份保留。操作见[M35试玩](docs/M35-PLAYTEST.md)，规则见[M35合同](docs/M35-RULES.md)，实际交付状态、首轮失败与设备缺口见[STATUS](docs/STATUS.md)、[M35验收](docs/M35-ACCEPTANCE.md)、[M35性能](docs/M35-PERFORMANCE.md)。软件GPU长尾和JS堆趋势仍开放。

保留已交付本地候选 **M31 · 0.31.0-beta.1**：`/alpha5.html`，独立alpha5-1/commands9与dungeon-descent.m31存档。新增正式跳跃、腐菌矿穴/断层工坊两个可玩生态包（2怪、2物、3设施），47公共外观/141GLB；旧八身份保留。96项精简单测与3条自然浏览器链通过，36配置双跑/回放通过；设备/长期性能缺口保留。玩法见[M31试玩](docs/M31-PLAYTEST.md)，规则见[M31合同](docs/M31-RULES.md)，真实交付状态与结果以[STATUS](docs/STATUS.md)、[M31验收](docs/M31-ACCEPTANCE.md)为准。

保留已交付本地候选 **M26 · 0.26.0-rc.1**：默认 `/alpha4.html`，独立 `alpha4-1` / commands8 与 `dungeon-descent.m26` 存档。统一角色与物品入口、六装备槽与16普通背包格、分类详情与连续操作、无伪暂停焦点恢复、双向梯子、可选指定ID的物品堆和新版资源预算均已实现。317单测、1000地图种子、180自然配置配对及浏览器分轮回归已完成；历史身份、存档和回放保留。实际验收与缺口见 [STATUS](docs/STATUS.md)、[M26验收](docs/M26-ACCEPTANCE.md)、[性能](docs/M26-PERFORMANCE.md)；操作见 [M26试玩](docs/M26-PLAYTEST.md)，需求见 [M26方案](docs/ROADMAP-M26.md)。真实手机、实体手柄及长期内存仍未验收。

保留已交付 **M25 本地交互候选 0.25.0-rc.2**：`/alpha3.html` 使用独立 `alpha3-1` / commands7 与 `dungeon-descent.m25` 存档；`/alpha2.html` 保留旧规则，默认界面升级为直接交互，旧按钮保留在 `?ui=buttons`。229单测、9000旧规则精确配对、94旧与28新浏览器唯一用例分轮通过；600资源循环和48自然动作采样已执行。真机/实体手柄未覆盖，软件卡顿、JS堆趋势和偶发时序/图形初始化观察项保留。范围以 [STATUS](docs/STATUS.md)、[M25验收](docs/M25-ACCEPTANCE.md) 为准；[试玩说明](docs/M25-PLAYTEST.md)、[性能](docs/M25-PERFORMANCE.md) 与 [路线图](docs/ROADMAP-M25.md) 分开记录实际结果和计划。

上一已交付基线为 **M20 星落远征 · 0.20.0-rc.1**，基于完整 **M15 Alpha 2 · 0.15.0-alpha.2** 持续开发。入口 `/alpha2.html` 默认在游戏画布内提供菜单、HUD、装备、背包、目标选择、商店、图鉴与存录；45公共物品外观各有三档LOD，场景与物品动作分阶段呈现。137项单测与9000配置精确配对通过，94个浏览器用例分轮验证；首轮失败与复测分别记录。实际验收、保留缺陷和设备覆盖边界以 [STATUS](docs/STATUS.md) 为准；见 [M20验收记录](docs/M20-ACCEPTANCE.md)、[变更记录](docs/M20-CHANGELOG.md)、[试玩说明](docs/M20-PLAYTEST.md) 和 [路线图](docs/ROADMAP-M20.md)。本地候选不代表所有手机或浏览器已认证。

保留 M15 的45种物品、分层鉴定、状态与材质/食物互动、12怪物原型、八类设施、六层种子片段和完整存录规则。`alpha2.html?ui=legacy` 可切回原DOM界面。该历史入口规则仍是 `alpha2-1` / commands 6，存档键不变；[M15试玩说明](docs/ALPHA2-PLAYTEST.md) 与 [规格](docs/ROADMAP-M15.md) 留作历史基线。

保留交付基线 **M10 星落远征 Alpha · 0.10.0-alpha.1**：打开 `/alpha.html`。三种起始配装、近战破甲与远程施法、咒术师/游击兵、双梯环路、门闩/拉杆、金币或生命开启补给箱，配有独立存档、指南与探索地图。深入六层、击败守护者、取得遗物并返回入口；没有跳跃。66 项单测、46 项浏览器回归通过，本地分发包已验证重复构建一致。实际验收与覆盖缺口见 [STATUS](docs/STATUS.md)，规格见 [ROADMAP-M10](docs/ROADMAP-M10.md)，试玩与分发运行说明见 [ALPHA-PLAYTEST](docs/ALPHA-PLAYTEST.md)。

保留 **M06 星落远征** 兼容基线：`/adventure.html` 使用原六层规则与独立存档。物品实例、五槽换装、背包、药剂鉴定、中毒/增益、圣坛、存读和文件备份、回放与结算均保留。

新增 `/combat-lab.html` 战斗检查场，可装配原创先遣者/铆钉甲数据资产，切换剑刺与战锤下劈，检查双向攻击、低位目标、受击与倒下，逐帧定位或循环播放；这里不推进游戏规则。角色模型包可用 `npm run assets:models` 重建，`npm run check:models` 验证配方一致性。

保留 **M02C 三房间 3D 地牢**：`/dungeon.html` 使用原有固定地图和存档，适合对比早期切片。

**M02B 可玩 3D 哨站**仍在 `/room.html`：双层入门战斗、拾取铁甲、穿脱和出口胜利。原有存档与规则保留；3D 页面共用本次改进后的动作衔接、握持和材质。

保留 **M01 确定性探索切片**：三层固定测试矿井、短剑战斗、药水、金币、遗物和返回入口的完整胜利流程。原始单文件试玩保留在 [prototypes/original.html](prototypes/original.html)，新工程不兼容它的旧存档。M01 不包含法杖、卷轴、饥饿或换装；后续 3D 场景已独立实现换装、鉴定卷轴，Alpha 增加法杖施法，Alpha 2 增加饱食和食物。

另有 **M02A 角色工坊**：启动后打开 `/character-lab.html`，对比 3D 皮甲与铁甲、检查剑盾握持，并播放真实导入的站立、行走、单手劈砍、格挡动作。支持暂停定位、转身、头盔/剑盾开关、单色和约 72/96/128px 显示。攀爬为自制占位，尚未完成梯子贴合。此页独立于规则游戏，不需要运行时 CDN，也不新增跳跃。

## 启动

使用 Node.js 22.12+（本机验证为 24.14.0）和 npm：

```sh
npm ci
npm run dev
```

打开终端打印地址下的 `/alpha5.html`，默认 `http://127.0.0.1:5173/alpha5.html`。根 `/` 保留 M01 兼容入口。这是 Vite 工程，不能直接双击根目录 HTML 启动。原始单文件原型仍可独立打开。

生产预览：

```sh
npm run build
npm run preview -- --port 4173
```

M31精简检查为 `npm run check:m31`，包含新增专项、受影响回归和资产/类型/构建；历史 `npm run check` 保留完整套件。本地候选包名 `releases/fallen-star-0.31.0-beta.1.zip` 与同名 `-source.zip`；最终交付回执为 `releases/M31-DELIVERY.json`。具体通过与未覆盖项见M31验收，不把旧浏览器矩阵当成本轮结果。

M26 本地候选为 `0.26.0-rc.1`，运行包和完整源码包位于 `releases/fallen-star-0.26.0-rc.1.zip` 与同名 `-source.zip`，各有 `.sha256` 和包内逐文件清单。运行包解压后执行 `node serve.mjs`，打开 `/alpha4.html`；源码包在 `project/` 执行上述命令。最终字节校验回执为 `releases/M26-DELIVERY.json`。M25/M20/M15历史包保持原样；没有上传、推送或部署。

## 操作与存录

| 操作 | 输入 |
| --- | --- |
| 直接交互（Alpha 2/3/4） | 点地面逐格移动、点敌人攻击、点物品拾取、点门/梯子/设施交互 |
| 持续移动 | 按住 A / D 或左右键；可选辅助面板提供方向按钮 |
| 攀爬 | 在梯子处按 W / S 或上下键 |
| 攻击 | 空格或点敌人；直接移动遇险会中断 |
| 拾取 | F，距离不超过一格 |
| 喝药 | Q；满血拒绝，不消耗药水或时间 |
| 等待 | 句号，每次 10 tick |
| 背包 / 帮助（远征） | B / H；也可点击对应按钮 |
| 停止 | 松开、Esc、失焦、切换标签页、打开面板或遇险 |

桌面键盘操作前可点击场景获得焦点。Alpha 2/3/4 原生界面中 Tab 依次访问画布热区，Enter 激活；物品详情进入目标选择后方向键切换目标，Escape 逐层返回。旧 DOM 入口沿用浏览器焦点导航。遇险后需要重新按方向键；不会在重新聚焦时恢复旧输入。新旧场景具体操作以各自试玩说明为准。

点击“保存”写入本浏览器 localStorage，点击“读档”恢复；不自动覆盖或自动加载。支持 JSON 导出/导入。存档含完整世界和种子命令历史，导入全部验证成功才替换当前冒险。文件中的版本、内容和历史不一致会拒绝，旧局保持可用。

“回放”使用滑块查看任意命令边界；远征从当前边界进入，滑到 0 可查看新局，M01 另有前后按钮。回放不能执行游戏动作，退出后回到实时局。每局上限为 4096 次已接受行动，导入上限 2 MiB；达到上限可导出并新开一局。摘要用于诊断，不是安全签名。

## 工程边界

```text
src/content/     机械内容与测试矿井定义
src/core/        纯模拟、整数时钟、规则随机、公开投影、完整摘要
src/session/     唯一会话命令入口、候选提交、存档、逐命令重放、存储端口
src/ui/          Vue 面板、Canvas、设备输入、中英文文案
src/character-lab/ 独立 Three.js 角色试验、骨骼挂点、装备与动作
src/room/        3D 房间 UI、公开状态映射、动作插值、镜头与场景
src/adventure/   六层远征 UI、实例背包、设置、指南、结算与双语文案
public/assets/character-study/ 转换后动作、来源散列与许可
tests/          自然通关、受控反例、输入控制器与生产构建浏览器测试
```

呈现 → 会话 → 模拟 → 内容。浏览器渲染、动画、设备重复事件不拥有规则时间。`GameSession.view()` 返回分离的公开数据，过滤视野外敌人与物品；RNG 和完整世界不进入展示投影。存档/导出是单独的完整数据通路。

## 验证

```sh
npm run check                 # 依赖边界、单元测试、严格类型、生产构建
npx playwright install chromium firefox webkit
npm run test:e2e              # 历史入口，自动启动4173生产预览
```

M26专项：先在独立终端 `npm run preview -- --port 5190 --strictPort`，再执行 `npx playwright test --config playwright.m26.config.ts`。已有生产服务器可用 `M26_URL` 指定，完整复现与分轮证据见M26验收文档。

M25直接交互使用独立配置。本地另一个终端先执行 `npm run preview -- --port 5174 --strictPort`，再执行 `npx playwright test --config playwright.m25.config.ts`。已有生产服务器可用环境变量 `M25_URL` 指定，例如PowerShell的 `$env:M25_URL='http://127.0.0.1:4186'`。旧套件对应 `E2E_BASE_URL`。并行运行必须传不同 `--output` 目录，避免Playwright清理对方证据。

首次在 Linux/CI 安装浏览器可使用 `npx playwright install --with-deps chromium firefox webkit`。`.github/workflows/ci.yml` 已登记两套配置，CI会启动各自生产预览；云端流水线尚未运行。

新配置含Chromium三尺寸、Firefox、WebKit桌面项目；实际通过与环境启动失败见验收报告，配置不代表全部通过。视口/触屏模拟不等同于真机，Windows WebKit也不代表Safari。只读失焦/指针取消场景包含合成事件注入，触屏tap使用Chromium的触摸输入通路，Gamepad使用浏览器模拟快照。

- [当前状态与实际结果](docs/STATUS.md)
- [本阶段规格与停止点](docs/MILESTONE-01.md)
- [架构决定与状态所有权](docs/ARCHITECTURE.md)
- [依赖与资产来源](docs/SOURCES.md)
- [3D 方块美术与动作/换装接口研究](docs/ART-DIRECTION.md)
- [M02A 角色试验规格](docs/MILESTONE-02A.md)
- [M02B 可玩房间规格](docs/MILESTONE-02B.md)
- [M02C 三房间地牢规格](docs/MILESTONE-02C.md)
- [M03–M06 范围与验收规格](docs/ROADMAP-M06.md)
- [原始架构参考](ARCHITECTURE-REFERENCE.md)

产品方向已明确：横版走廊与梯子探索，不规划主动跳跃或为跳跃设计的缺口/平台。M02A 已验证当前骨骼上的动作与刚性换装，尚不是通用换装系统或完整 3D 游戏；现有 Canvas 2D 切片继续作为规则与存录基线。3D 渲染和动作资产不自动增加玩法动作，也不改变行动驱动时间。详见美术研究文档。

M02B 的操作键与上表一致。开始在下层，向右击败爬行者；到铁甲附近按 F 拾取，在右侧选择装备；x=8 的梯子按 W 上楼，S 下楼。取得铁胸甲并击败敌人后，到上层右侧 x=11 出口完成。每次穿脱消耗 8 tick，附近敌人也会行动。触屏使用场景下方按钮；键盘操作可先点击场景获得焦点。

哨站存档使用独立键 `dungeon-descent.m02b` 和 `room-1` 身份，不覆盖 M01 存档。两页面不互相导入不同场景；M01 旧档仍可验证恢复。动画播放期间不积攒新命令；暂停/读档/回放会显示已提交行动的稳定结果。站定后停止渲染循环，规则与 NPC 不自行推进。

本机浏览器采样与截图可复现：先启动生产预览，再执行 `node scripts/profile-room.mjs <工作区外输出目录>`。样本环境与限制见当前状态；这不是手机真机基准测试。

## M02C 试玩路线

门厅向右拾取胸甲和药水，在 10 号梯口按 S 下楼。军械库主线向右，在 17 号梯口继续下到墓室；左翼支线有钉锤、塔盾、铁盔与补给，可跳过。墓室向左取得遗物，再沿原梯返回门厅最左端出口。坐标和当前房间显示在画面右上方，提示会随进度变化。

守卫会先蓄力并标记三格范围，提示剩余逻辑时间与预计伤害；退到范围之外或换层可避开。停下思考不会推进倒计时，但换装和喝药会消耗时间。钉锤比短剑多 3 攻击、少 1 防御；塔盾比木盾多 2 防御、少 2 攻击。选项括号显示相对当前装备的攻击 / 防御变化。

地牢使用 `dungeon-descent.m02c` 和 `dungeon-1` 身份，单独手动保存，不覆盖旧两场景。页面之间不混用存档。按住移动会在当前动作显示完成后继续，松开、遇险、失焦、暂停、保存或回放会取消后续意图；快速点击不会排队。

`node scripts/profile-dungeon.mjs <工作区外输出目录>` 经生产 UI 完成带支线的路线、截图和一次预热攀梯采样。5–10 分钟为首次探索设计目标，尚无真人时长验证；自动熟练路线可更快完成。

## M06 远征

每个种子决定梯口、遭遇模板和药剂瓶色。探索走廊两端可获得额外装备、卷轴和药剂；第三地区的精英守卫保护遗物，取得后回第一层 x=1 出口。地图由六条连续走廊组成，不是任意房间拓扑生成器。

背包容量 16，包含装备中的物品；遗物不占容量。按钮后的数字为逻辑 tick 费用：拾取 6、换装 8、丢弃 4、饮用/鉴定 10、圣坛 12。鉴定消耗卷轴，饮用未知药剂也会识别效果。治疗恢复 28 生命，解毒去除中毒，力量/护体分别增加 4 攻击/3 防御，持续 100 tick；中毒每 20 tick 造成 2 伤害，80 tick 时到期。圣坛可恢复满生命并解毒，仅用一次。

新身份 `expedition-1` / commands 4 / archive 1，独立本地存档键 `dungeon-descent.m06`。旧三场景不迁移，不互相混载。声音默认关闭，在设置启用；低画质关闭阴影并把像素密度限制为 1。新局、语言和画质不会覆盖手动存档。

`node scripts/profile-adventure.mjs <工作区外输出目录>` 通过已验证的自然路线存档采样深层攀梯、两档画质、64 次 seek 和反复恢复，输出截图和 JSON。请单独运行，避免与软件渲染浏览器测试争用 CPU。完整自然路线的实际 UI 操作由 `tests/browser/adventure.spec.ts` 另行验收。
