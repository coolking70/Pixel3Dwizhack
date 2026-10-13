# 3D 方块美术、共享动作与纸娃娃换装研究

日期：2026-10-11。状态：研究与接口草案；现已完成 M02A 角色试验和 M02B 可玩 3D 房间，保留 M01 2D 基线，未采购资产或迁移到 Unity。

## 产品约束

用户明确目标是横版走廊、梯子与物品决策，不需要主动跳跃，也不生成必须跳跃跨越的缺口或平台。3D 是呈现方向，不意味着自由三维行走或新增平台跳跃机制。可能的击退、坠落等必须另有玩法规格，不能由动画或物理引擎自动产生。

当前 Canvas 图形属于机制验证的占位视觉，未投入正式角色设计、材质和场景构图。因此当前观感简陋不能直接证明 2D 表现有上限；选择 3D 的主要收益是多角度角色、灯光体积、共享动画与可组合装备。3D 同样需要统一轮廓、比例、材质和动作设计。

WazHack 官方旧网页提到 Unity3D 插件，可以确认其历史 Unity 技术路线；这不是现代浏览器仍支持该插件的证据。[官方旧网页](https://www.wazhack.com/play)。本项目借鉴横版行动体验，不读取或复用它的模型、贴图、规则数据或动画。

## 推荐视觉方向

建议先试 **2.5D 横版镜头 + 块面低模角色 + 克制的像素贴图 + 模块化石木场景**。正交相机优先，轻微偏角用于显露厚度；正式游戏镜头仍须保证左右攻击距离、前后手和梯子位置可读。角色检视可单独旋转，不能据此把游戏相机改成自由旋转。

| 造型路线 | 特征与收益 | 主要代价 | 本项目建议 |
| --- | --- | --- | --- |
| 大块方盒人物 | 轮廓明确、刚性部件易制作 | 肘膝和细小装备容易单薄或穿插 | 可作低成本基线，不直接定为最终美术 |
| 细颗粒体素雕塑 | 阶梯轮廓、雕刻感强 | 高密度小块、变形关节和装备遮挡更复杂 | 适合道具、局部细节，先验证变形再用作角色主方案 |
| 块面低模 + 像素贴图 | 体素观感与骨骼动作较易结合 | 需统一 UV 密度、骨骼、权重与色板 | 优先研究；局部刚性、局部蒙皮可混用 |

美术上的方块感不要求运行时建立可破坏体素世界。静态方块场景可合并网格或实例化，角色使用正常骨骼网格；不必为每个小方块建立独立对象。

建议的首轮视觉规范是：偏写实的装备轮廓、适度夸张的头手比例；暖色火光与冷暗背景分层；石、木、布、皮、铁在色彩和粗糙度上有区别；不默认加满屏低分辨率后处理。UI 文字保持清晰。取 72/96/128 屏幕像素高的角色截图检查剑盾、背包和护甲辨识度，这些是研究尺寸，不是已经达标的资产预算。

## 技术路线

现有规则与会话层不依赖浏览器绘图，因此浏览器方案可保留它们，用 3D 适配器替换绘制，并让 Vue 继续承担面板。

| 路线 | 对当前工程的意义 | 适用判断 |
| --- | --- | --- |
| Vue + Three.js | 保留 TypeScript 模拟、存录与 UI；自行组织角色、资源与动画层 | 如果继续以浏览器原型/交付为主，优先做小规模验证 |
| Vue + Babylon.js | 也可保留 TypeScript 核心，采用另一套场景与动画设施 | 对动画工作流需求更重时，与 Three.js 做同资产验证后决定 |
| Unity | 编辑器和资产工作流可集中管理；需规划现有 TS 规则/UI 的重写或跨运行时接入 | 如果主目标转为原生桌面/手机，并愿意承担迁移，单独立项评估 |

Three.js 的 GLTFLoader 读取 glTF 2.0 并提供场景与动画片段；AnimationMixer 可播放、暂停与采样片段，SkeletonUtils 提供骨骼角色复制和重定向能力。这支持候选路线，但不保证任意角色/动作包直接兼容。[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)、[SkeletonUtils](https://threejs.org/docs/pages/module-SkeletonUtils.html)。

Babylon.js 的官方文档描述了 Avatar 动画重定向，包含参考姿势、骨名和比例补偿。它仍要求输入骨架和姿势正确，不能把引擎支持等同于资产免适配。[官方动画重定向说明](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/animation/animationRetargeting.md)。

## 通用模型和动作接口

“公模动作”在本项目中指可获得并有适用使用权的通用模型/动作资产，不等于公有领域，也不等于所有骨架都能共用。先建立项目的 `humanoid-v1` 骨架，动作来源经过导入工具离线适配；游戏不依赖来源骨名。

- 统一骨骼语义：root、hips、spine/chest、neck/head、左右肩、上臂/前臂/手、上腿/小腿/脚。武器、盾、背包分别挂在手与背部 socket。
- 记录骨骼父子层级、骨轴、T/A 参考姿势、单位、朝向、比例与 bind pose；骨名相同不足以证明兼容。
- 来源可为 FBX/BVH 等制作格式；发布优先规范化为 GLB。glTF 能携带动画与蒙皮，但并未自动给任意人形建立统一骨骼语义。[Blender glTF 手册](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html)。
- 先验证站立、行走、攻击、受击、死亡、攀爬、拾取、喝药；不把动作包附带的 jump 纳入产品命令。
- 动作绑定按角色骨架、武器姿态与语义选择；四足、飞行或异形敌人另设 rig profile，不强制塞入人形骨架。
- 移除或规范化 root motion，位移由模拟授权；脚滑、手握点、侧视姿势和武器穿插需要人工复核。优先离线重定向，运行时播放规范化动作。

Mixamo 可作为待评估来源之一；Adobe 文档限定其自动绑定和动画库主要服务双足人形，并列出身体结构与比例条件。不能指望分离方块部件自动绑定成功；可先用完整人形代理建立骨架，再把项目的方块网格绑定上去。[Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)。该文档也列出账号地区可用性限制，因此不能把它设为唯一来源；本轮未登录、下载或导入此类资产。

## 纸娃娃接口

纸娃娃需要支持几何变化，不能只有颜色切换。建议分为头部、胸甲、手臂/手套、腿部、靴子、主手、副手、背部等视觉槽位；最终装备规则的槽位可以不同，通过投影映射，不能由渲染器制定规则。

1. **刚性挂件**：剑、盾、部分头盔、背包等绑定 socket，携带本地位置/旋转/缩放与握点。组件仍可按部位拆分，不把整套装备焊死为一个模型。
2. **蒙皮部件**：布衣、贴身护甲或跨关节护具共用标准骨架与兼容 bind pose，不能只挂到一个胸骨节点上。形体差异通过 body profile 配套，不承诺任意胖瘦角色通穿。
3. **身体遮罩**：胸甲覆盖躯干、头盔隐藏部分头发等，使用语义 body regions；卸下后恢复。需要处理两件装备共同遮挡，不能靠单个布尔值互相覆盖。
4. **分离数值与外观**：存档保存装备实例身份和游戏状态，公开投影给出被允许显示的外观选择。网格 URL、动画句柄、材质对象和加载完成顺序不进入机械状态。
5. **异步生命周期**：资源加载绑定会话、角色与外观修订；旧结果不得覆盖新装备。失败显示占位，不能撤销已提交的装备规则效果。角色销毁时释放实例与订阅，共享资源通过明确生命周期管理。

以下仅为可讨论的接口形状，未接入生产代码：

```ts
type Motion = 'idle' | 'walk' | 'climb' | 'melee'
  | 'pickup' | 'drink' | 'hurt' | 'death';
type VisualSlot = 'head' | 'torso' | 'arms' | 'legs'
  | 'feet' | 'mainHand' | 'offHand' | 'back';

interface RigProfile {
  id: string; version: number; bodyProfile: string;
  skeletonAsset: string; bindPoseId: string;
  boneMap: Readonly<Record<string, string>>;
  sockets: Readonly<Record<string, string>>;
}
type EquipmentBinding =
  | { kind: 'rigid'; socket: string;
      position: readonly [number, number, number];
      rotation: readonly [number, number, number, number];
      scale: readonly [number, number, number] }
  | { kind: 'skinned'; rigId: string; bindPoseId: string };

interface EquipmentVisual {
  assetId: string; slot: VisualSlot; bodyProfiles: readonly string[];
  binding: EquipmentBinding; hiddenBodyRegions: readonly string[];
}
interface MotionBinding {
  rigId: string; semantic: Motion; stance: string; clipAsset: string;
  sourceRigId: string; retargetProfileVersion: number;
  rootMotion: 'inPlace';
}
interface CharacterPresenter {
  setAppearance(appearanceRevision: number,
    equipment: readonly EquipmentVisual[]): void;
  samplePose(motion: Motion, normalizedPhase: number): void;
  dispose(): void;
}
```

接口还需通过真实模型与一段动作验证，才可以冻结；仅声明 TypeScript 字段不视为完成动作兼容或换装。

## 与行动驱动时间的关系

既有规则仍决定命中、成本和位置。正式攻击动作若有多阶段，公开投影需提供 action identity、阶段和进度；呈现按这些事实采样。当前 M01 没有该信息，所以不能只接入 AnimationMixer 就宣称长动作与回放已支持。

受击特效可以展示已经提交的事实，画面插值只连接已提交位置；不能靠“动画播放到第几帧”决定命中。暂停时的角色机械姿态冻结；火光等环境装饰是否继续是独立表现偏好。真实渲染 delta 不传入模拟；回放定位先恢复相应公开状态，再定位动作，不补发历史声音或伤害。

## 下一次验证的最小范围

一个侧视房间、一个项目标准人形骨架、两套可组合服装、一把剑和一面盾。至少一条外部合法来源动作经过真实离线重定向；按暂停/继续、转身、攻击、换装、卸装与回放检查握点、遮挡和角色姿态。选定资产后记录来源与许可，不先采购大包。

对照当前 2D 基线：给相同种子和命令历史，机械快照/RNG/历史保持一致；对比 72/96/128px 角色可读性，记录目标设备下资源体积、绘制调用、帧耗时与内存。读档、异步装备加载、替换角色与 WebGL context loss 单独验证。没有真实资产和设备实测之前，不声称性能提高或“一套动作适配全部模型”。

本轮交互小样只是程序方块造型、关节姿势与刚性部件组合研究；不是外部 GLB、重定向、蒙皮服装或最终换装系统的验收证据。主项目仍运行原来的 Canvas 2D 呈现。

## M02A 后续实做边界

`/character-lab.html` 已将这一方向落实为独立工程试验：当前 23 骨骼比例配置、四个合法外部动作的离线转换、真实骨骼混合器、带蒙皮权重的内衬躯干、绑定骨骼的刚性衣甲、手掌 socket / 武器 grip 逆变换对齐，以及攀爬时转挂背部。来源见 `SOURCES.md`，实测见 `STATUS.md`。

这是特定骨骼轴向和比例的适配，不是任意人形骨架的通用重定向器。当前造型采用纯色块面低模，尚未加入像素纹理；只有内衬躯干蒙皮，尚未实现导入蒙皮衣甲、身体分区遮罩、装备属性、异步换装、梯子 IK 或游戏内动画时间映射。上下文丢失测试使用事件注入并显示刷新提示，不代表真实 GPU 故障恢复验证。上述仍是后续工作，不能把独立角色试验视为整个 3D 迁移已经完成。

M02B 后续更新：现已在 `/room.html` 实现基础像素材质开关、五槽位属性/外观、按当前几何分区的身体遮罩、梯子两段 IK 与接触周期，以及由已提交规则结果驱动的单动作插值。仍未实现任意模型衣甲、通用骨骼重定向、异步换装、复杂布料或全地牢 3D。M02A 独立工坊里的攀爬仍是无梯子上下文的姿势检查；实际接触约束由房间 renderer 提供。

M02C 后续更新：`/dungeon.html` 已扩展为三个固定 3D 房间。新增钉锤与塔盾轮廓，盾板纵轴与握柄分离，手持竖向而收背保持贴背；装备依然使用同一五槽位/骨骼挂点。房间以冷灰门厅、暖色军械库和青灰墓室及武器架/石棺区分。守卫用较高、较宽的轮廓与地面蓄力范围区分爬行者。角色/环境统一像素灰度纹理；攀梯转身/落脚及攻击端点做姿态融合。仍是有限刚性衣甲，不能保证所有极端姿态都无穿插，亦不是通用公模接入完成。

M03–M06 后续更新：`/adventure.html` 接入六层远征。守卫不再是整体平移方块，复用项目人形骨骼的行走、蓄力和劈砍，增加受击与倒下姿态；爬行者有六足交替步态和下颚扑咬，精英守卫有更大比例和头冠。表现读取带来源/目标的攻击收据，逐段采样并在接触时刻发出最多八个方块火花与合成短音。攻击动作仍主要基于一条源劈砍，更多武器专属动作和细腻过渡留待后续。

药瓶按本局外观映射呈现四种颜色；卷轴、圣坛与遗物有独立轮廓。房间按区域布置武器架和石棺，灯光跟随当前层。所有新物体为程序几何，源动作和许可未改变；现有 grip/socket、身体遮罩、纸娃娃槽位、攀梯收背接口继续使用。画质设置仅影响阴影与像素密度，不改变规则结果。
