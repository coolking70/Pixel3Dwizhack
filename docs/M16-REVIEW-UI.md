# M16B 独立审查记录

日期：2026-10-11。审查者：M16C 资产任务；未参与本次 UI 实现。作者/修复负责人：M16I。
范围：`src/game-ui/input.ts`、`layout.ts`、`native-ui.ts`、`src/alpha2/Game.vue`。
本记录区分审查、作者修复和实际复测；不代替完整设备验收或性能报告。

## 第一轮固定候选

| 文件 | SHA-256 |
| --- | --- |
| input.ts | 7A0790E67E24A4BF3F25D291E4F86F7897D2B21FBBCA49E1E1F624FD019B2E4D |
| layout.ts | 2FCB7EA608716B9A3AA69E33FDF9539E9AA6098FF75739F306ED08494A3EC525 |
| native-ui.ts | E983B8CD9FC65613983936DB619198CAB81963CC99646D5CCB27F5373007251F |
| Game.vue | B746B0B61D38F6679CEADC6C26594B245C6858026DEAB45036B566AF8C2160FD |

### P2：关闭背包后仍执行旧指针按压对应的丢弃命令

Chromium 156、1440×900、DPR 1，实际 Vite 开发页面 `http://127.0.0.1:5174/alpha2.html`。
通过正式新局进入游戏，打开画布背包，选择 `item:7` 干粮。在 `action:drop` 热区按下鼠标但不松开，按 Escape 关闭背包，再松开鼠标。

实际输出：`before=0, panelBeforeUp=world, after=4, panelAfterUp=world`。
这时用户已经取消背包交互，但旧 `Hotspot.activate` 仍提交了丢弃命令。

原因：`CanvasInputRouter.active` 跨模态继续保存旧闭包；`up` 只检查旧矩形，并未验证当前界面作用域。待处理的触屏长按回调也由同一个过期活动项驱动。
要求：面板/只读生命周期改变后取消旧活动按压与长按；不能简单取消每一次重绘，否则会破坏正常拖动与授权持续移动。

其他已执行检查：选择空背包格 `item:15` 后，没有动作热区；按住丢弃后发送 window blur 再松开，逻辑 tick 保持 0。未发现该失焦路径重复提交。
静态检查确认详情、目标、缩略图键均取自公开投影；秘密类别交给 category+appearance resolver，不依赖隐藏定义。

第一轮发现已交给 M16I。审查中检测到作者开始修改，后续新候选的行为不计入第一轮固定候选结果。

## 第二轮

作者完成模态/只读生命周期取消、键盘操作取消旧点击和动作修订取消；持续移动采用独立保留规则。固定候选：

| 文件 | SHA-256 |
| --- | --- |
| input.ts | E614483BA8A6A8A073274A067A1C069CD166709459953417EC0FC683078471AA |
| layout.ts | 2FCB7EA608716B9A3AA69E33FDF9539E9AA6098FF75739F306ED08494A3EC525 |
| native-ui.ts | 153FCF76138F0091A4E9EB01ADC57C075E9295E3E891BFC8DBDB87D82416B4EC |
| Game.vue | AD5A19741CDDF924141A8EAE5472C145C4761FA81D22041DAE65E69DC468272E |

独立 Chromium 复测同一正式新局路径，鼠标与 `hasTouch` + Chromium 原生 CDP touch 通路各一遍：

| 操作 | 实际结果 |
| --- | --- |
| 按下丢弃 → Escape → 等待 550ms → 松开 | 世界面板，tick 保持 0；鼠标旧闭包和触屏长按均已取消 |
| 正常重新打开背包、选择干粮、丢弃 | tick 从 0 到 4，取消修复没有禁用正常操作 |
| 丢弃后选择空格 item:15 | 没有动作热区，tick 保持 4 |
| 辅助工具栏进入回放，键盘打开背包、选已装备项、尝试卸下 | 保持背包面板、tick 保持 4；没有提交机械动作 |

复现脚本外置于 `C:/Users/coolking/AppData/Local/Temp/m16-ui-review.mjs`（要求 5174 Vite dev 服务）；不导入或修改会话内部状态。上述结果为定点复现，非全套 E2E 数量。

原 P2 已关闭；本轮没有新增阻塞发现。审查两轮结束。全套浏览器套件、持续输入完整矩阵和正式构建结果由 M16I 单独执行并记录，不重复计数。

## 覆盖限制

本审查是针对输入生命周期和公开数据边界的定点审查；没有执行全套 E2E、真人触屏/输入法、真手机性能、全部快捷操作或完整可访问性验收。
