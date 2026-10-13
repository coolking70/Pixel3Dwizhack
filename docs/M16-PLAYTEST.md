# M16 纵向切片试玩

构建后 `npm run preview -- --port 4173`，打开 `http://127.0.0.1:4173/alpha2.html`。开发用 `npm run dev`。本轮仍使用 `alpha2-1` / commands 6 / `dungeon-descent.m15`，存档内容和历史摘要兼容 M15；实际交付以 [STATUS](STATUS.md)、[验收记录](M16-ACCEPTANCE.md) 与 [性能报告](M16-PERFORMANCE.md) 为准。

## 游戏操作

- 启动器选配装和种子，进入地牢；默认正式 HUD、装备和背包绘制在同一游戏画布。
- A/D 或左右键持续移动，W/S 攀梯，空格攻击，F 拾取，Q 已知治疗，R 施法，X 搜索。松开、失焦、暂停和进入面板均停止后续行动。
- B 或画布“背包”进入六槽装备/16格背包。点选、悬停或触屏长按查看物品；Tab 切热区，方向键换选择，Enter/空格确认，Esc/B 返回。点击并拖动人物预览旋转。
- 穿戴/卸下、丢弃和物品动作均走正式命令。使用时先选动作，再切换公开目标并执行；取消不消耗时间。诅咒、容量、错误目标等正式拒绝显示在画布底部。
- 邻近物品和设施按钮在画布左侧，较多时可翻页。门闩、开关门、拾取和开箱有准备、接触、效果、回稳阶段；中途保存/失焦立即显示已提交结果。
- 保存、读档、语言及暂停位于底部。M19 的商店、图鉴、笔记、完整设置/回放等尚保留在“辅助面板”中；不是声称全菜单已迁移。文件导入/导出继续使用浏览器原生能力。
- `alpha2.html?ui=legacy` 保留 M15 DOM 界面，用于回退和历史真实UI回归；旧五入口独立存档继续保留。

## 美术范围

首批12定义：sword、knife、maul、shield、helm、renewal、insight、cinder、ration、lantern、emberRing、kit。8款固定模型与21款秘密类别公开外观变体，共29 GLB，防止某个真实药效固定对应某瓶型。鉴定后同实例模型不变。

其余物品明确登记计划；背包“待制作”不是完成模型。首批未装备时可在地面、拾取、缩略图查看同源资源；剑/匕/锤/盾/盔/护符共用角色挂点。角色基础护甲的历史模型继续保留。

## 开发验收入口

```sh
npm run check
npm run check:models
npm run check:items
npx playwright test --workers=2
npm run balance:smoke -- --concurrency 2 --out <外部结果目录>
node scripts/balance-replay.mjs reports/balance/seed-2-breaker-fighter.json
```

`balance:nightly` / `balance:milestone` 预设900/9000局，可用 `--seeds` 参数缩小。完整trace和大报告默认放系统临时目录；查看分类而不只看进程退出码。没有为了提高自动代理胜率修改规则或数值。

真实视觉复现，先启动脚本约定的生产预览服务：

```sh
npm run preview -- --port 4185 --strictPort
node scripts/profile-m16.mjs <外部截图目录>
node scripts/profile-m16-performance.mjs <外部性能目录> --hardware
```

离屏模型图集脚本 `node scripts/profile-item-models.mjs <外部目录>` 使用5174的开发服务（`npm run dev -- --port 5174 --strictPort`），输出48/64/96像素图集、地面和穿戴夹具。夹具不是自然机械路线；性能脚本须与测试/构建分开运行，桌面结果不得代替真机验收。
