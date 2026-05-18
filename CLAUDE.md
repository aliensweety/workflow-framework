# CLAUDE.md — Workflow Framework（工作流项目工厂）

本项目是工厂——创建和维护"工作流 Claude Code 项目"。它本身的产出物不是工作流，而是**工作流项目的架构模板**。

## 入口

- `install.bat`：创建新项目（复制 template）或更新现有项目的框架 skill。
- `project-template/`：唯一的真相源。所有框架 skill 和 schema 放这里。

## 目录

```
.
├── CLAUDE.md              # 你正在读的这个
├── FRAMEWORK.md           # 设计 DNA（不为运行时加载，遇到设计问题读它）
├── README.md              # 给人看的项目说明
├── framework.config.yaml  # 本仓 GitHub 地址
├── install.bat            # 项目创建 / 更新工具
├── project-template/      # 新项目模板（唯一真相源）
│   ├── CLAUDE.md          # 新项目入口模板
│   ├── .claude/skills/    # 框架 skill + 空位给私有 skill
│   ├── scripts/           # 空，项目自己填
│   ├── runs/              # 空，运行时填充
│   └── process-findings.md
├── projects/              # 实际工作流项目（不入版本控制）
└── examples/              # 示例 workflow YAML（参考用）
```

## 收到下游项目的 GitHub Issue 时

1. **先读 FRAMEWORK.md**——尤其是"检验新变更的三条问"
2. 判断问题属于哪个范围：
   - 模板 / install.bat → 直接改
   - 三个 SKILL.md / WORKFLOW_SCHEMA.md → 改完用 install.bat 选 2 同步到现有项目
   - FRAMEWORK.md 本身 → 需谨慎：回顾是否有足够证据表明原则需要迭代
3. 处理时默认假设：**用户当下表达 ≠ 用户真正目标**。每条 issue 先问："这是在让框架变好，还是在让提出问题的人眼下舒服？" 如果只是后者——pushback，不修。
