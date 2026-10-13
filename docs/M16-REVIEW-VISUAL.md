# M16 视觉独立审查

日期：2026-10-11。审查者为 M16A 代理，未参与被审实现；实现与修复由 M16I 完成。限定范围：`src/visual/motions/receipt.ts`、`pose.ts`、`src/room/renderer.ts`、`src/visual/items/equipment.ts`，只读追踪相关 Game.vue、MotionInput、模型cache与角色骨架。本次仅新增审查文档，未改实现或测试。

## 第一轮：两个 P2

1. **WebGL context lost 会额外提交一次仍按住的方向命令。** `onLost` 先调用 `settle()`，该函数通过 `finished()` 进入 Game.vue 的 `held.completed()`；失败回调中的 `held.stop()` 尚未执行。用自然正式会话 seed42 / alpha2 按住 right：第一条命令后 tick10；模拟 renderer 发起的结清及真实完成回调后变为 tick20、两条正式命令。原问题与命令结果无关，来自失败中止被当作普通播放完成。要求失败中止不回调允许继续提交的正常完成入口。
2. **持弓时新 GLB 盾仍绑定左手，覆盖旧角色的盾收背语义。** `ItemEquipment.sample(false)` 原先无条件将 offHand 绑定 leftGrip。`BlockCharacter.sampleBow(.5)` 已把旧盾移到 backShield，随后新盾仍在 PalmGripL。要求当前主手为公开已知 bow 时也保持新盾收背，并保留普通持剑左手持盾和攀爬/交互收背。

第一轮开始时 renderer 为 `7239361d478ea3028325860381dd18edbd509877802a4713686b13a3b4122ccc`，pose 为 `8647fd717c83cb5cc9b163cc1f33a3b06d46e8ca9dabf5ca2c6a8d47e5a85dae`。集成任务同时修正手部接触，结束读取时 renderer 已为 `82d63f81b34c1f8ad886dad2bd2134b4efc168b1ed1410586a8fc1e0becb1a38`，pose 为下表所列。上述两个具体反例对应的行为在这两个读取点都存在；因此不把第一轮描述成对整个不变候选的通过。equipment 当时固定为 `af567f6e65e0ec187cb26debec50959a5f8991f8c1269ad073262f5e2a7d82ae`。

额外检查了公开收据边界、拒绝/跨种子过滤、地面转手后的中止归还、共享网格释放、已dispose后的异步回调、装备异步加载使用最新items、旧场景不加载Alpha2模型等路径。未发现可证明的额外规则污染；这些源码检查不代替浏览器/GPU生命周期测试。

## 第二轮固定候选

复核前后均计算 SHA-256，以下四文件未变化：

| 文件 | SHA-256 |
| --- | --- |
| src/visual/motions/receipt.ts | `1a502c940aa76edec6dcebf04aecab5ac6269f6a2f8d91179dd9c061231c4daa` |
| src/visual/motions/pose.ts | `0380b9c11312e0dfa83c4c8810041cb6de0da90f86142a155d2fbec529d46213` |
| src/room/renderer.ts | `2f63a8b5487c684c9fa179213e355f330faca5c50c60d430c128ed91b3ebf48c` |
| src/visual/items/equipment.ts | `7c3ec97babef3cc67bf3f878d973e72d12611744c4c49842de4a55fc19d4b46c` |

修复实现：onLost 调用 `settle(false)`；settle 增加默认 true 的 notify，只在允许时发出 finished。offHand 的绑定考虑公开items中主手bow，或显式stowed。异步装备回调按当前 climb/interaction 判断收背，不把所有 busy 动作都视作需要收背。

独立复跑使用 Node24.14.0、Vite SSR加载实际TypeScript模块、实际 GameSession / MotionInput / BlockCharacter；只替换 WebGL 绘制和加载完成的模型cache，不改世界状态：

| 复核输入 | 实际结果 | 结论 |
| --- | --- | --- |
| seed42按住right，失败通路settle(false)，随后stop | tick10→10；完整capture字节相同；commands1；finished0 | P2-1关闭 |
| 同配置普通settle(true)对照 | tick10→20；commands2；finished1 | 保留正常持续输入能力 |
| bow+shield，朝向±1，sampleBow相位0/.5/1，再equipment.sample(false) | 六次实际parent均严格等于actor.backShield | P2-2关闭 |
| 同两朝向换sword+shield，sample(false)/sample(true) | 四次分别严格等于leftGrip/backShield | 未破坏普通持盾与收背 |

这里是一次独立受控复现脚本的断言与观测，不记作十个新增测试套件用例。脚本经PowerShell here-string传入 `node --input-type=module`；核心可重现设置如下（类由上述实际文件通过 Vite `ssrLoadModule` 加载）：

```js
// GameSession仅使用正式新局和submit；不读取或修改内部world。
const s = new GameSession(42, 'alpha2');
let busy = false, finished = 0;
const held = new MotionInput(command => {
  const result = s.submit(command);
  if (result.accepted) busy = true;
  return result;
}, () => busy);
held.start('Keyboard', 'right');
const before = s.capture();
globalThis.cancelAnimationFrame = () => {};
const rendererHarness = {
  raf: 0, animation: {}, view: s.view(),
  clearInteraction: () => {}, sync: () => {},
  finished: () => { finished++; busy = false; held.completed(); },
};
RoomRenderer.prototype.settle.call(rendererHarness, false);
held.stop();
assert.equal(s.capture(), before);
assert.equal(s.view().tick, 10);
assert.equal(s.length, 1);
assert.equal(finished, 0);

// 模型cache替身仅提供已加载Group，测试真实装备绑定函数。
const eq = new ItemEquipment(actor, () => {});
eq.cache = { peek: () => new THREE.Group(), preload: async () => {}, dispose: () => {} };
eq.update([publicShieldWithOffHandSlot, publicBowWithMainHandSlot]);
actor.sampleBow(.5);
eq.sample(false);
assert.equal(eq.slots.get('offHand').root.parent, actor.backShield);
```

实际标准输出：

```json
{"contextLoss":{"unchanged":true,"before":10,"after":10,"commands":1,"finished":0},"normalCompletionControl":{"unchanged":false,"before":10,"after":20,"commands":2,"finished":1},"bowPhasesDirectionsPassed":6,"swordReadyAndStowedControls":4}
```

两轮审查到此：两个已复现P2均关闭，第二轮没有新增阻塞发现。本次没有独立执行真实 WebGL contextlost 事件、GPU资源恢复、移动端或完整浏览器套件，不能据上述受控结果宣称这些项目通过。真实浏览器 contextlost 专项由 M16I 实现和执行，结果以 STATUS 和集成报告为准。不同物品/朝向的实际接触截图、长期异步资源压力仍按集成任务证据与覆盖缺口登记。
