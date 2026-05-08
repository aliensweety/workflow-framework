# START —— 启动这个项目

## 这是什么

经济学 YouTube 频道工作流的 v2。v1 在 `../经济学youtube频道/`，跑过几次有产出。框架层已经整理过一轮模板，现在用新模板重新打磨这条流程。

## 第一件事

1. 读 `CLAUDE.md`（30 行）
2. 读 `reference/economics-video-v1.yaml`（v1 工作流，参考材料）

## 你的任务

跟用户对话，用 `workflow-compose` 打磨出一份 v2 的 workflow YAML 写到 `workflows/`。v1 是参考不是定稿——哪些沿用、哪些重做、哪些合并拆分跟用户讨论着定。

## 你能动 vs 不能动

能动：`workflows/`、`scripts/`、`runs/`
不能动：`.claude/skills/<任何>/`（无论是外部 skill 还是框架 skill）

外部 skill 坏了 → 写 `tool-issues.md` 一条
框架/流程不顺 → 写 `workflow-issues.md` 一条
两份都是简报，写完继续，不回头读。
