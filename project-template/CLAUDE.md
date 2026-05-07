# Project CLAUDE.md

本项目使用 workflow-framework。三个框架 skill（workflow-compose、workflow-run、workflow-revise）已装在 `~/.claude/skills/`（也可能复制到了本项目的 `.claude/skills/`，project 级优先）。

## 目录

```
.
├── CLAUDE.md                    # 你正在读的这个
├── .claude/
│   └── skills/                  # 项目私有 skill（思考型节点用）
├── workflows/                   # workflow 模板（YAML）
├── scripts/                     # 项目私有脚本（执行型节点调用）
├── runs/                        # 每次运行的实例，含 manifest.yaml 和产出物
├── issues.md                    # 工具问题（skill / 脚本 bug、缺陷）
├── workflow-issues.md           # 流程/架构问题（workflow 改进、framework 反馈）
└── decisions.md                 # 设计决策和原理（运行时不读）
```

## 如何使用

### 新建一个工作流
说"做一个关于 X 的工作流"或"设计一个 X 流程"，`workflow-compose` 触发，采访后生成 `workflows/<n>.yaml`。

### 运行一个工作流
说"跑一下 <workflow 名>"或"开始生产 <实例名>"，`workflow-run` 触发，创建 `runs/<timestamp>_<instance>/` 并按 autonomy 设定执行。

### 修改产出
跑完后说"X 那段有问题"或"第几场改一下"，`workflow-revise` 触发，定位 unit / step 沿链重跑。

### 遇到问题
跑工作流时遇到工具问题（skill 报错、脚本 bug、缺依赖）→ 写到 `issues.md`，继续往下跑或停下告诉用户。
遇到流程问题（step 顺序不对、字段不够、想加新机制）→ 写到 `workflow-issues.md`，找用户讨论。

**不要硬改工具或框架**——术业有专攻，记下来等专门处理。

## Workflows

<!-- workflow-compose 会在这里登记新建的 workflow。格式：
- **<n>**：<intent 第一句> — `workflows/<n>.yaml`
-->

（暂无 workflow，用 workflow-compose 新建一个）

## 参考

- schema：`~/.claude/skills/WORKFLOW_SCHEMA.md`（字段用法）
- 框架 DNA：`<framework-repo>/FRAMEWORK.md`（设计理念、边界）
- 三种 method：`claude-code` / `skill:<n>` / `script`
- 三级 autonomy：`auto` / `report` / `ask`
- 两种 dispatch：`inline`（默认）/ `subagent`
- 并行：fan-out step 加 `parallelism: N`（默认 1 串行）

## 项目私有 skill

思考型节点需要的 skill 放 `.claude/skills/<skill-name>/SKILL.md`。project 级别，只在本项目激活。共用的思考型 skill 装到 `~/.claude/skills/` 变 personal 级。
