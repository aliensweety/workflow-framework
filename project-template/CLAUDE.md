# Project CLAUDE.md

本项目用 workflow-framework 跑一个具体的生产流程。

工作流的执行靠四个框架 skill:**workflow-compose**(编排)、**workflow-run**(执行)、**workflow-revise**(修改)、**workflow-debrief**(复盘)。它们按需触发,业务逻辑在里面。

## 目录

```
.
├── CLAUDE.md              # 你正在读的这个(指导文档,运行时读)
├── decisions.md           # 项目自述+心法(迭代时才读)
├── process-findings.md    # 打磨期临时笔记,session 末讨论提 issue
├── workflows/
│   ├── flow.yaml          # 流程图骨架(拓扑——谁连谁、分叉、聚合)
│   ├── steps/             # 节点池(每个 step 一个 yaml 文件)
│   │   ├── <step_id>.yaml
│   │   └── ...
│   └── notes/             # sidecar 笔记(按需创建 <step_id>.md)
├── scripts/               # 项目私有脚本
├── runs/                  # 每次运行的实例,含 manifest.yaml 和按 step 组织的产出
└── .claude/
    └── skills/            # 框架 skill + 项目私有 skill
```

## 四层信息:常驻 / 实例态 / 按需 step / 按需笔记

| 层 | 文件 | 加载时机 |
|---|---|---|
| 常驻 | `workflows/flow.yaml`(流程图骨架) | run 启动时进入上下文 |
| 实例态 | `runs/<run_id>/manifest.yaml`(进度) | run 启动时进入上下文 |
| 按需 | `workflows/steps/<step_id>.yaml`(节点定义) | run 跑到该 step 时 Read |
| 按需 | `workflows/notes/<step_id>.md`(扩展信息) | 异常路径或迭代修改时才 Read |

正常 run 一遍只加载实际走过的 step 文件,变体 step(visualize-img / visualize-video)不会污染上下文。

详细规范见 `.claude/skills/WORKFLOW_SCHEMA.md`。

## 多方案变体走 git

如果一个工作流有截然不同的变体(如"配图版"和"配视频版"),用 git 分支处理,不在框架里加"variants"机制:

```bash
git checkout -b visual-video    # 开新分支
# 改 flow.yaml + 增删 steps/*.yaml,跑、迭代
git checkout main               # 切回主方案
git worktree add ../<name>-video visual-video   # 想同时打开对比
```

Claude Code 可以代劳——你说"切到 visual-video 分支"它会做。每个分支的 flow.yaml 都干净、当前激活,避免大表被备选字段污染。

如果是同一个 step 的几种实现备选(同样是配图,有 grok 版和 gemini 版),改 `flow.yaml` 引用的 step 文件名就行——steps/ 里多放几个候选,flow.yaml 切换引用。

## 反馈通路

| 故障来源 | 动作 |
|---|---|
| `flow.yaml` / `steps/*.yaml` / `scripts/` / `runs/` 里的事 | 直接在项目里改 |
| 外部 skill / 工具的 bug | 那个 skill 文档自带反馈仓库地址,提到那里 |
| 框架本身(SCHEMA / 四个 SKILL) / 流程结构不顺 | 记一条到 `process-findings.md`,session 末讨论是否提 issue |

框架仓 issue 地址:[github.com/aliensweety/workflow-framework/issues](https://github.com/aliensweety/workflow-framework/issues)

跑完后说"复盘一下",`workflow-debrief` 会引导你把实战经验沉淀回 flow / steps / notes。

## 参考

- 字段语义、拓扑结构、小表结构:`.claude/skills/WORKFLOW_SCHEMA.md`
- 设计 DNA、核心原则、为什么这么设计:`<framework-repo>/FRAMEWORK.md`(不在运行时加载,做架构决策时读)
- 本项目的设计原理、哲学边界、长期取舍:`decisions.md`(迭代时才读)
