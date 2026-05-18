# Workflow Framework

Claude Code 驱动的工作流框架。把"稳定可重复的生产流程"变成 Claude Code 能用自然语言搭建、运行、修改的东西。

## 读什么

- **[FRAMEWORK.md](./FRAMEWORK.md)** —— 项目 DNA。设计理念、核心价值、关键机制、边界。对"为什么这么设计"有疑问时读这份。不在运行时默认加载。
- **[CLAUDE.md](./CLAUDE.md)** —— 本仓入口。issue 处理流程、项目结构。
- **[project-template/.claude/skills/WORKFLOW_SCHEMA.md](./project-template/.claude/skills/WORKFLOW_SCHEMA.md)** —— 运行时规范。workflow YAML 和 manifest YAML 的字段定义。三个 skill 都引用它。
- **[examples/book-review-video.yaml](./examples/book-review-video.yaml)** —— 一个完整示例。

## 三个框架 skill

| Skill | 职责 |
|---|---|
| `workflow-compose` | 采访用户 → 生成 workflow YAML |
| `workflow-run` | 执行 workflow → 维护 manifest |
| `workflow-revise` | 自然语言修改 → 定位 unit → 沿链重跑 |

源文件都在 `project-template/.claude/skills/`——这是**唯一的真相源**。修改框架就改这里，然后用 install.bat 同步到现有项目。

## 关键机制（速查）

- **autonomy**：`auto` / `report` / `ask`——打磨期 ask，稳定后 report
- **dispatch**：`inline`（默认）/ `subagent`——长任务、大输出派给 sub-agent 隔离主会话
- **iterates_over: units**：fan-out 起点把 N 个切片写进 manifest.units，之后步骤对每个 unit 跑一次
- **parallelism**：fan-out step 内 units 之间的并行度，默认 1
- **issues 反馈**：打磨期间记到 `process-findings.md`，session 末和用户一起决定提 GitHub issue 到框架仓

## 安装与更新

双击 `install.bat`（或命令行运行），出现菜单：

```
1. Create new project
2. Update framework skills in all existing projects
3. Exit
```

### 创建新项目（选 1）

输入项目名，项目被创建在 `projects/<名字>/`，整个 `project-template` 复制过来，包括框架 skill 副本。

### 更新已有项目（选 2）

修改了 `project-template/.claude/skills/` 下的框架 skill 后，选 2 一键同步到 `projects/` 下所有现有项目。只覆盖这几项：

- `WORKFLOW_SCHEMA.md`
- `workflow-compose/`
- `workflow-run/`
- `workflow-revise/`

项目私有 skill（`gemini/`、`grok/` 等）不会被覆盖。

更新后在各项目里重启 Claude Code 让它重新加载 skill。

### 为什么扭进项目里一份副本

让每个项目独立、可移植。拷到别的机器也能跑，不依赖全局 skill。

### 可选：装到 personal 级别

如果某天你不再需要每个项目独立可移植，可以装一份到 `~/.claude/skills/` 跨项目共用：

```bash
mkdir -p ~/.claude/skills
cp -r project-template/.claude/skills/* ~/.claude/skills/
```

但推荐还是走 install.bat 路子。

## 演化

按 FRAMEWORK.md 的演化哲学——实践与迭代交替。跑起来遇到问题就回来讨论，改完再跑。每一次实战暴露真问题，比预想十个边界情况强。
