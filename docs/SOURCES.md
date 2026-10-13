# 依赖与资产来源

记录日期：2026-10-11。依赖版本来自本次安装结果与包内 `package.json`；实际精确依赖树、下载来源、完整性散列和传递依赖许可见根目录 `package-lock.json`。安装使用 npm registry，未读取或引入参考游戏源码。

| 直接依赖 | 本次锁定版本 | 包声明许可 | 来源 |
| --- | --- | --- | --- |
| Vue | 3.5.43 | MIT | https://github.com/vuejs/core |
| Vite | 8.3.4 | MIT | https://github.com/vitejs/vite |
| @vitejs/plugin-vue | 6.0.10 | MIT | https://github.com/vitejs/vite-plugin-vue |
| TypeScript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| vue-tsc | 3.3.13 | MIT | https://github.com/vuejs/language-tools |
| Vitest | 5.0.3 | MIT | https://github.com/vitest-dev/vitest |
| @playwright/test | 1.64.0 | Apache-2.0 | https://github.com/microsoft/playwright |
| @types/node | 24.19.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

除 Vue 外均为开发与验证依赖。依赖包自带的 LICENSE / NOTICE 保留在安装内容中；项目尚未对外发布，发布打包时应随实际分发范围携带相应许可与通知。根包保持 private，不代用户指定著作权归属或宣称已经完成正式许可发布。

本阶段没有下载图片、字体或音频，没有使用图像生成模型。矿井、人物、敌人、火光与物品图标由本会话以 Canvas 基本图形独立绘制，系统字体和 Unicode 符号由用户设备提供。它们是开发占位视觉，尚无可发布的精灵图集或统一动画资产门禁。

`prototypes/original.html` 为用户目录原有文件的逐字节副本，SHA-256：`C44097298B03D9408B1857614C9EF17C55EC7A6BAD25CA78C7F1A6D74E20F224`。其页面布局、主题和产品意图用于本阶段参考，原文件不参与生产构建。不为其未提供的外部来源作额外声明。

读取材料仅为此目录的原型、`ARCHITECTURE-REFERENCE.md` 和 `AGENTS.template.md`。参考文档指向的外部仓库、受限代码和历史审查材料没有作为本次实现输入；不将当前工程称为经过法律认证的洁净室实现。

## 后续 3D 美术研究

上述读取范围描述 M01 初始实现。2026-10-11 的后续研究另外阅读 WazHack 官方产品页、Three.js、Babylon.js、Blender 与 Adobe 的官方能力说明；来源链接汇总于 `docs/ART-DIRECTION.md`。未获取 WazHack 的实现或游戏资产，未下载通用角色/动作包。

独立交互造型小样从 jsDelivr 加载固定版本 Three.js 0.180.0（MIT，来源 https://github.com/mrdoob/three.js），仅在讨论用小样中使用，未加入主项目依赖。方块模型、关节层级、衣甲与动作姿势由本会话程序生成；不是第三方动作重定向或蒙皮换装的证明，也没有使用图像生成模型。

## M02A 工程角色试验（后续实现）

本节更新上方历史读取范围。已安装 Three.js **0.186.1**（运行时，MIT）及 `@types/three` **0.186.0**（开发，MIT）；精确依赖见锁文件。角色试验使用本地打包的 Three.js，无运行时 CDN。库许可副本位于 `public/assets/character-study/Three-LICENSE.txt`。

真实动作来自 Kay Lousberg 的 [KayKit Adventurers Character Pack 1.0 原作者仓库](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0)，固定提交 `672074b73ba276876a19e8816ecdc5241817ab47`，源文件 `addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb`。作者以 CC0 发布，原许可副本保留为 `public/assets/character-study/KayKit-LICENSE.txt`。原 GLB SHA-256 为 `60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168`。

`scripts/import-character-motion.mjs` 仅支持这个已固定的源文件和比例配置：选择 23 根骨骼，重命名并缩放骨段；选择 `Idle`、`Walking_A`、`1H_Melee_Attack_Chop`、`Blocking`，保留旋转和骨盆上下起伏，去除 root motion 与水平位移。项目不打包原模型/贴图、IK 控制器或其他动作。转换后 `motions.json` 为 102897 字节，来源和转换方式同时保存在 `provenance.json`。

重新转换：`npm run assets:motion` 从固定源下载；也可 `npm run assets:motion -- <Knight.glb绝对路径> <LICENSE.txt绝对路径>` 离线转换，源散列不符则拒绝。普通开发/构建不必重新下载。大源文件外置于本会话的可视化目录，项目内保留轻量派生数据与来源记录。

方块角色、皮甲/铁甲几何、手指、剑盾、房间和攀爬占位由本项目程序构建。真实动作已适配当前骨骼，但不能据此宣称支持任意 FBX、glTF 或 Humanoid 动作；攀爬不是该资产包的导入动作。没有获取 WazHack 游戏资产，没有新增图像/字体/音频或图像生成内容。

## M02B 可玩房间

沿用上面的四个 CC0 动作与已锁定 Three.js，无新增外部资产或依赖。房间几何、爬行者、拾取箱、五槽位装备映射、两段肢体 IK、梯子接触周期与 8×8 灰度像素材质均为本项目代码生成；攀爬为项目程序动作，并非声称来自 KayKit。程序纹理在内存生成，不使用图像模型或外部贴图。来源许可继续随 production public 目录保留。

## M02C 三房间地牢

本节描述 M02C 历史；M03–M06 来源增量见下方。

沿用相同依赖与四个动作，没有新下载或第三方资产。钉锤、塔盾、墓穴守卫、药瓶/遗物、武器架/石棺、蓄力地面标记和房间配色均由项目代码构建。姿态融合与侧手盾板轴向修正基于已登记骨架，不增加动作资产或改变源许可。旧原型及原始参考文件保留。

## M03–M06 星落远征

沿用上述固定 CC0 动作、Three.js 和 Vue 依赖，无新增下载、采购、图片或字体。守卫重新使用项目适配后的角色骨骼；爬行者六足/下颚关节、精英头冠、药瓶/卷轴/圣坛和命中粒子由项目代码构建。声音由 WebAudio 振荡器和音量包络实时合成，为本项目原创短提示音，无外部录音或音效素材。仍不支持任意动作包、模型或衣甲自动适配；没有 Unity 迁移，也未获取 WazHack 资产或实现。

## M07 角色资产与检查场

先遣者模型、铆钉甲、剑和战锤为原创部件资产，MIT，数据位于 `src/character-lab/models/vanguard.json`，确定性制作配方为 `scripts/build-character-pack.mjs`。`npm run assets:models` 重建，`npm run check:models` 检查数据与配方是否相同。27 个角色部件、41 个衣甲部件和两武器共 12 个部件，使用既有 23 骨架、骨骼局部或绑定姿态坐标、身体区域遮罩和掌握点合同。

没有下载新公模。此数据导入是项目受限方块资产格式，不是任意 FBX/glTF 自动导入/重定向。剑前刺和低位目标瞄准为原创姿态适配；战锤仍使用上述 CC0 劈砍经相位和上身姿势调整。原四段动作及其散列未修改。

## M08–M10

仍无新增第三方下载或依赖。法杖水晶、咒术师头罩、游击兵配装、门闩/拉杆/补给箱、投射物、小地图和施法音调均由项目原创几何/界面/合成代码组成；运动反解仅用于表现。项目新增 MIT 许可文件，明确不为未确认来源的归档原型与参考资料重新授权。分发包包含项目许可、Vue 许可、既有 Three/KayKit 许可与来源 JSON；不包含归档原型或参考文档。


## M11–M15 Alpha 2 原创增量

45 个物品、12 怪物原型、八类设施、命令/效果与经济数值、双语说明、道具/设施方块几何和武器变体均为本项目原创 MIT 内容。概念参考为用户提供蓝图与官方帮助/Mod 文档，见 `research/source-index.md`；未下载社区资产或复制百科文本、统计表、攻略代码。弓、长矛、匕首、余烬/月银剑使用已有项目掌握点合同，自制几何。原有 KayKit 动作的 CC0 归属保持；本轮没有引入新运行依赖、付费素材或通用外部模型导入器。

内容来源元数据 `sourceKey: original-alpha2` 统一解析到研究索引：sourceUrl 为用户蓝图本地路径，originalGameVersion 为 not-applicable，confidence 为 hypothesis，adaptationNotes 为原创组合规则与数值、非原版复刻。单测验证的是本工程规格，不能作为 WazHack 原机制准确性的证据。

## M16 原创视觉与工具增量

用户 `Fallen_Star_M16_Development_Kit.zip` 中的路线图和任务包为本轮实施规格，导入到 `docs/ROADMAP-M20.md`、`docs/tasks/`；附件本身的计划描述不是实际验收结果。

`assets-src/items/recipes.mjs` 为本项目原创 MIT 程序几何；`public/assets/items/manifest.json` 登记29份公开外观GLB、源配方散列、产物SHA-256、尺寸/三角面预算、地面/缩略图/握点/穿戴合同。8个固定模型和21个随机外观模型支持首批12定义跨种子使用；完整45定义的制作计划为离线文档数据，不把秘密效果映射写入展示注册表。

拾取、门扇推拉、门闩和箱盖动作在现有23骨架上使用原创分段姿态及目标反解，不新增第三方动作；沿用原CC0骨架/基础动作归属。UI使用浏览器本地系统字体栅格化到离屏Canvas纹理，没有打包、下载或重新授权系统字体。Three GLTFLoader/离屏渲染仍来自已锁定Three.js依赖；无新增外部依赖、采购、WazHack资产或图像生成素材。
