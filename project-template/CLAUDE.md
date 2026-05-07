# Project CLAUDE.md

本项目用 workflow-framework 跑一个具体的生产流程。三个框架 skill（workflow-compose、workflow-run、workflow-revise）按需触发，业务逻辑在它们里面。

## 目录

```
.
├── CLAUDE.md                    # 你正在读的这个
├── .claude/
│   └── skills/                  # 框架 skill 副本 + 项目私有 skill
├── workflows/                   # workflow 模板（YAML）
├── scripts/                     # 项目私有脚本（你自己写的）
├── runs/                        # 每次运行的实例，含 manifest.yaml 和产出物
├── issues.md                    # 外发给 skill 管理层
├── workflow-issues.md           # 外发给框架层
└── decisions.md                 # 设计决策和原理（运行时不读）
```

## Workflows

<!-- workflow-compose 会在这里登记新建的 workflow。格式：
- **<n>**：<intent 第一句> — `workflows/<n>.yaml`
-->

（暂无 workflow，用 workflow-compose 新建一个）

## 参考

- schema：`.claude/skills/WORKFLOW_SCHEMA.md`（字段用法）
- 框架 DNA：`<framework-repo>/FRAMEWORK.md`（设计理念、边界）
