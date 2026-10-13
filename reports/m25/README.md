# M25 轻量复现资料

最终状态以 ../../docs/STATUS.md 与 M25-ACCEPTANCE.md 为准。这里保存可随源码分发的摘要，不保存大日志、截图或9000局逐命令文件。

- frozen-candidate.json：362项代码、资源、脚本与测试SHA256；不包括后续文档/报告，不是Git提交。
- production-build.json：173项生产产物SHA256。
- changes-from-m20.json：与M20冻结文件的新增、字节变化和保留统计；字节变化包括换行归一化，不全是语义改动。
- historical-files.json：旧规则与黄金文件的细项核对。
- historical-balance.json：9000配对逐trace/最终摘要比较、冻结输入和完整外置证据位置。
- source-rebuild.json：独立解压安装/229单测/类型与构建、产物一致性；单独性能采样器的覆盖单列。
- lifecycle-summary.json：两渲染路径×三尺寸100周期的统计、GC趋势与资源计数；原始逐阶段样本外置。
- action-performance.json：两渲染路径、三自然动作、两画质的中位/P95/峰及环境；以实际文件存在和完成字段为准。

完整原始证据根为 C:/Users/coolking/.codex/visualizations/2026/10/11/01a129c4-1522-7131-8c77-c1a1ae3a19cd，分别在m25/和m25-performance/；路径属于本次机器，其他机器应使用自己的外置输出目录重新运行仓库脚本。性能方法与限制见 ../../docs/M25-PERFORMANCE.md，平衡分层及失败trace见 ../../docs/M25-BALANCE-NEW.md。

运行包/源码包各自包含逐文件manifest及SHA侧车。最终交付散列和解压校验回执置于本地 releases/M25-DELIVERY.json，避免把包自身SHA循环写入源码包。没有提交、推送或远程CI执行的声称。
