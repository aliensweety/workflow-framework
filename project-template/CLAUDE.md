# Project CLAUDE.md

本项目用 workflow-framework 跑一个具体的生产流程。三个框架 skill（workflow-compose、workflow-run、workflow-revise）按需触发，业务逻辑在它们里面。

## 目录

```
.
├── CLAUDE.md              # 你正在读的这个
├── .claude/
│   └── skills/            # 框架 skill 副本 + 项目私有 skill
├── workflows/             # workflow 模板（YAML）
├── scripts/               # 项目私有脚本（你自己写的）
├── runs/                  # 每次运行的实例，含 manifest.yaml 和产出物
├── tool-issues.md         # 跑工具坏了写这（命令+报错），外发给 skill/工具管理层
├── workflow-issues.md     # 框架/流程不顺写这（现象就行），外发给框架层
└── decisions.md           # 设计决策和原理（运行时不读）
```

两个 issues 文件**只写不读**——是发给上一层 CC 的简报，不是你自己的 TODO。写完继续跑。

## 参考

- schema：`.claude/skills/WORKFLOW_SCHEMA.md`（字段用法）
- 框架 DNA：`<framework-repo>/FRAMEWORK.md`（设计理念、边界）
