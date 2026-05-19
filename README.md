# Workflow Framework

Claude Code 驱动的工作流框架。把"稳定可重复的生产流程"变成 Claude Code 能用自然语言搭建、运行、修改的东西。

## 读什么

- **[FRAMEWORK.md](./FRAMEWORK.md)** —— 项目 DNA。设计理念、核心原则、边界、演化哲学。对"为什么这么设计"有疑问时读这份。不在运行时默认加载。
- **[CLAUDE.md](./CLAUDE.md)** —— 本仓入口。issue 处理流程、项目结构。
- **[project-template/.claude/skills/WORKFLOW_SCHEMA.md](./project-template/.claude/skills/WORKFLOW_SCHEMA.md)** —— 运行时规范。大表/小表/笔记 三类文件的字段定义。三个 skill 都引用它。
- **`projects/<某个项目>/workflows/`** —— 看真实工作流长什么样，比看虚构示例更有信息量。

## 核心隐喻：大表 / 小表 / 笔记

| 概念 | 文件 | 角色 |
|---|---|---|
| 大表 | `workflows/workflow.yaml` | 流程定义。该做什么。**不变。** |
| 小表 | `runs/<run_id>/manifest.yaml` | 进度记录。这次做到哪了。**实时维护。** |
| 笔记 | `workflows/notes/<step_id>.md` | 单步的扩展信息。**按需创建，平时不读。** |

所有其他术语（units、fan-out、stale 传播）都是这三件东西的具体形态或衍生。

## 三个框架 skill

| Skill | 职责 |
|---|---|
| `workflow-compose` | 和用户对话 → 写大表 |
| `workflow-run` | 读大表 → 顺序执行 → 维护小表 |
| `workflow-revise` | 自然语言修改 → 定位 → 标 stale → 触发重跑 |

源文件都在 `project-template/.claude/skills/`——这是**唯一的真相源**。修改框架就改这里，下次创建的新项目自动带上新版本。**旧项目不回头同步**。

## 核心原则速记

- **落地是真相，种子是兜底**：有 `command` 直接跑；没 `command` 或跑不通才回 `description` 重新理解
- **渐进披露**：`notes` sidecar 文件正常路径不读，异常路径才打开
- **能写死就写死**：编排越具体越好，少留判断空间
- **Claude Code 是主语**：能让它自主判断的就别加字段

更多详情见 FRAMEWORK.md。

## 创建新项目

在本仓根目录跟 Claude Code 说："复制 `project-template/` 到 `projects/<新项目名>/`"。整个模板（含框架 skill）会被拷贝过去，构成一个独立的、自包含的项目快照。

之后 `cd projects/<名字>` 开始干活。

## 旧项目不回头同步

框架演化只惠及**下一个**新项目。已经存在的项目在它创建那一刻的框架快照上独立运行，不被回头改动。

这是有意的设计选择，不是偷懒：

- 旧项目已经在旧机制上跑通了。强行同步意味着每次框架变更都触发一轮重构，得不偿失。
- 如果旧项目业务逻辑真的需要新框架能力，更快的做法是**新建一个项目，参照旧项目的业务结构重新搭一遍**。
- 重构比修改快，是 FRAMEWORK.md 演化哲学的延伸。

## 第三方 skill

`gemini`、`grok`、`runninghub-tts` 这类调用外部模型/服务的 skill 不在本仓管理范围内，由独立的 skill 仓库维护。新项目创建后按需自行拉取。

## 演化

按 FRAMEWORK.md 的演化哲学——实践与迭代交替。跑起来遇到问题就回来讨论，改完再跑。每一次实战暴露真问题，比预想十个边界情况强。