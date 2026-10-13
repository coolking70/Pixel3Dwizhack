# M22 世界命中与逐步意图执行

目标：公开世界点选、已探索路径、逐步移动/开门/接近敌人与物品；所有结果只通过正式命令入口产生。

范围：`src/interaction`、`src/room/scene-hit-test.ts`、renderer 的只读命中/目标标记、`src/game-ui/input.ts`、专项交互测试。不改规则、会话、Game.vue 或 UI 布局。renderer 交付后由根负责 M24，不并行修改。

冻结接口沿用 `src/core/action-types.ts`。IntentExecutor 接 `{view,submit,busy,context,offers}`，每个调用最多发出一条正式命令；只持有一个不保存、不计摘要的暂态意图。路径只使用公开 explored/ladders；当前边界不匹配、伤害、新危险、条件变化、越层、失效目标与提交拒绝均取消。菜单/存读/回放/失焦由宿主调用 cancel。direction/release 绑定输入 source，开门后的松开不得继续行走。情境回调无机械能力。

SceneHitTest 用实际 Three camera 和 canvas CSS client rect，公开实体代理先于已探索地面；目标标记只消费当前 revision 的公开 offer。输入路由先 UI，世界点击仅同一有效 pointerup，拖离/取消/旧释放无效；宿主在模态与 busy 再阻断。

验收：正式新局/自然门边界与显式受控公共视图分别标记，验证每步命令、取消无补交、探索/梯子/危险、真实投影坐标与 pointer 生命周期；专属单测通过后提交 hash 与输入复现，根负责真实浏览器接线和独立审查。不得将局部单测当作整条 M25 验收。停止点为接口交付且测试结果如实记录，不自行更改规则/升级历史档。

## 实现与作者局部结果（2026-10-12）

- `IntentExecutor` 位于 `src/interaction/intent.ts`。`offers(ref)` 返回 `PublicActionOffer[]`；明确敌人默认攻击仍复查正式最近目标，不得点击 A 攻击 B。锁门始终进入 context；未锁门只接受当前 revision 的明确开门候选。点击敌人/物品逐步接近，终端攻击/拾取只提交一次。
- `direction(source,up/down)` 只在当前 x 的已知梯子连接提交一次正式攀爬，允许探索未知层；不自动横向走到梯子。成功越层立即清空意图。点击地面路径仍限已探索图；梯子实体不确定候选进入情境确认。该区分已由集成者确认。
- SceneHitTest 使用当前正交相机射线与 CSS client rect；敌人、地面物品、遗物、设施、门、梯子有独立公开代理，实体优先于地面。遗物使用冻结合同 `kind:relic` 与原公开 loot ID。梯子稳定 ID 为 `floor * map.width + x`，不使用过滤后索引。雾后实体不建立代理。
- RoomRenderer 增加 `hitTest`、`worldScreenPoint`、`setTargets`；当前 revision 的可用/不确定 offer 绘制青/金色标记，陈旧/禁用 offer 不显示。标记缓存可销毁，无机械写入。
- 输入路由支持第四参数世界回调，UI 优先；有效同 pointerup 才点击，长按不提前执行，拖离/旧释放/resize/失焦取消。普通 pointerup 后的 lostpointercapture 不取消刚建立的世界意图。`cancelActions()` 只清旧按压，不调用 worldCancel，避免意图自身 revision 更新取消自身；生命周期 `cancel()` 才通知 worldCancel。宿主 worldCancel 不应回调同一个 router.cancel，防止递归。

首次专项 **15/18**：三尺寸射线测试发现投影到零层时出现 `-0`；修正返回 floor 归一化后 **18/18**。随后加入显式梯子探索与点击敌人测试，最终 `npx vitest run tests/interaction-intent.test.ts tests/interaction-hit-test.test.ts tests/interaction-pointer.test.ts` **21/21，4.52 秒**，`npm run typecheck` 通过。

自然验证使用 `runAlpha2(42,channeler,items)` 的正式命令前缀：首个普通门前 direction→release→completed，只产生原价 8 tick 开门，完整 capture 与参考前缀相等；首次未知层攀爬同样与正式 down 前缀完整相等。其余危险、错误 offer、过期 revision、取消与射线案例是明确的受控公开视图/DOM事件夹具，不冒充真人浏览器验收。

当前停止于接口交付：尚未执行 M25 真浏览器世界点击/触屏整链、独立审查或本轮全量兼容/性能。renderer 交付后所有权归根，后续 M24 适配由根执行。
