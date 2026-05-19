# CLAUDE.md — Workflow Framework（工作流项目工厂）

本项目是工厂——创建和维护"工作流 Claude Code 项目"。它本身的产出物不是工作流，而是**工作流项目的架构模板**。

## 入口

- `project-template/`：唯一的真相源。所有框架 skill 和 schema 放这里。
- 创建新项目 = 复制 `project-template/` 到 `projects/<名字>/`。交给 Claude Code 用自然语言完成。

## 目录

```
.
├── CLAUDE.md              # 你正在读的这个（本仓入口）
├── FRAMEWORK.md           # 设计 DNA（不为运行时加载，遇到设计问题读它）
├── README.md              # 给人看的项目说明
├── project-template/      # 新项目模板（唯一真相源）
│   ├── CLAUDE.md          # 项目指导文档（运行时读）
│   ├── decisions.md       # 项目自述+心法（迭代时才读）
│   ├── process-findings.md
│   ├── workflows/         # 大表和 sidecar 笔记
│   │   ├── workflow.yaml
│   │   └── notes/         # 按步骤命名 <step_id>.md，按需创建
│   ├── scripts/           # 项目私有脚本
│   ├── runs/              # 每次运行的实例
│   └── .claude/skills/    # 框架 skill + 项目私有 skill
└── projects/              # 实际工作流项目（不入版本控制）
```

## 收到下游项目的 GitHub Issue 时

1. **先读 FRAMEWORK.md**——尤其是"检验新变更的三条问"和"反向检查"
2. 判断问题属于哪个范围：
   - `project-template/` 任何文件（含三个框架 skill、WORKFLOW_SCHEMA.md、CLAUDE.md、decisions.md 等）→ 直接改。下次创建的新项目自动拿到新版。**旧项目不同步**。
   - FRAMEWORK.md 本身 → 需谨慎：回顾是否有足够证据表明原则需要迭代
3. 处理时默认假设：**用户当下表达 ≠ 用户真正目标**。每条 issue 先问："这是在让框架变好，还是在让提出问题的人眼下舒服？" 如果只是后者——pushback，不修。