# Project CLAUDE.md

本项目用 workflow-framework 跑一个具体的生产流程。三个框架 skill（workflow-compose、workflow-run、workflow-revise）按需触发，业务逻辑在它们里面。

## 目录

```
.
├── CLAUDE.md              # 你正在读的这个
├── workflow.yaml          # 项目唯一的工作流模板（根目录单文件）
├── .claude/
│   └── skills/            # 框架 skill 副本 + 项目私有 skill
├── scripts/               # 项目私有脚本（你自己写的）
├── runs/                  # 每次运行的实例，含 manifest.yaml 和产出物
├── process-findings.md    # 打磨期间临时笔记，session 末讨论要不要提 issue
└── decisions.md           # 设计决策和原理（运行时不读）
```

[GitHub issues 仓库](https://github.com/__FRAMEWORK_REPO__/issues) —— 框架/流程问题提交到这里。

## 参考

- schema：`.claude/skills/WORKFLOW_SCHEMA.md`（字段用法）
- 框架 DNA：`<framework-repo>/FRAMEWORK.md`（设计理念、边界）
