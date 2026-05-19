---
name: workflow-run
description: 执行一个 workflow 大表，维护小表 manifest 运行态。当用户说"跑工作流"、"开始生产"、"执行流程"、"run workflow"、"start a production run"、"继续上次的 run"或提及项目里已有的工作流时触发。正常路径按 command 跑；只有 command 跑不通或没有 command 时才回 description 决定怎么做。step 失败时打开对应 sidecar 笔记。支持 resume 和局部重跑。
---

# workflow-run

读大表，按顺序执行每一步，持续维护小表。

## 前置阅读

触发时先读 `../WORKFLOW_SCHEMA.md`，确认字段语义和小表结构。

**重点理解三条核心原则**：

- **落地是真相，种子是兜底**：有 `command` 直接跑，不要因为"想确认一下"而把 description 也读一遍判断；只有 command 跑不通或不存在才回 description
- **渐进披露**：`notes` 字段是 sidecar 路径，正常路径**不要打开它**——读到字段名就够了。只在异常路径下用 Read 工具打开
- **每跑完一份产出立刻更新小表**：这是 resume 能力的基础

---

## 启动流程

### 第一步：定位大表

读 `workflows/workflow.yaml`。不存在就提示用户先用 `workflow-compose` 编排。

### 第二步：定位 run（resume vs new）

扫项目 `runs/`，看有没有 `status: in_progress` 或 `paused` 的 run。

**有未完成的 run**：
- 告诉用户："发现上次的运行 `<run_id>`，停在 `<current_step>`。恢复还是开新的?"
- 恢复 → 读对应 manifest.yaml，跳到第三步
- 开新的 → 走"新建 run"流程

**新建 run**：
1. 问用户这次的"实例名"（书名/选题/场景名等），用于 run_id
2. 创建 `runs/<YYYY-MM-DD>_<instance>/` 目录
3. 初始化 manifest.yaml：硬约束字段填好，`steps_status` 全部 pending，`units: []`
4. 写入磁盘

### 第三步：按 step 顺序执行

遍历 `workflow.steps`：

```
for step in steps:
  if steps_status[step.id] == done: 跳过
  if steps_status[step.id] == stale: 重跑
  否则: 执行
```

每个 step 的通用流程：
1. 在 manifest 里标 `running`，更新 `current_step`
2. 决定派发方式（见下）
3. 执行
4. 成功 → 标 `done`，更新 manifest；失败 → 标回 `pending`（或保留 `running` 加错误信息），打开 notes 看怎么办
5. 继续下一步（除非失败或用户介入）

---

## 怎么执行一个 step

### 默认路径：有 command 就照跑

```yaml
- id: generate_images
  description: 对每个 unit 调用 Grok 生图
  command: "python scripts/grok_image.py --prompt '{unit.prompt}' --out {run.dir}/img_{unit.id}.png"
```

直接对 command 做变量插值，用 Bash 工具执行。**不要为了"理解一下"读 description——那是兜底，不是双保险**。

成功（exit code 0）→ 更新 manifest。
失败 → 进入异常路径（见下）。

### 没有 command：按 description 自主完成

```yaml
- id: write_script
  description: |
    根据本期选题写一份完整文案，要点：
    - 结构按"问题→分析→结论"
    - 总长度 800-1200 字
    - 风格平实理性
  produces: "{run.dir}/script.md"
```

没 command 说明这是思考型步骤。按 description 自主决定怎么做——调 skill、用基础工具推理、生成文件，都可以。produces 给出输出位置。

完成后产出文件 → 更新 manifest。

### produces 决定 fan-out 形态

- `produces: "{run.dir}/script.md"` → 单份产出，正常 step
- `produces: "manifest.units"` → 这一步把内容切成多份写入 manifest.units（fan-out 起点）
- `produces: "unit.image"` → 这一步对每个 unit 跑一次，写入 unit.image 字段

**`unit.<field>` 形态的产出 = 对当前 manifest.units 循环执行**。每个 unit 跑完立刻 persist 到磁盘（防止中断丢失）。

具体执行时 command 里用 `{unit.<field>}` 占位符引用当前 unit 字段，循环替换。

### 长任务 / 大输出 自动派 subagent

不需要用户在大表里声明 dispatch。Claude Code 根据 step 性质自己判断：

- 长时间运行（轮询、等待外部任务）→ 派 subagent
- 输出量大但只需要最终结果（research、log 分析）→ 派 subagent
- 短任务、输出量小、需要主会话感知 → inline

派 subagent 时把 step.description 和 consumes 文件作为任务交过去，让它在自己的上下文里完成，回报产出位置和关键摘要。主会话不接收完整 stdout/stderr。

注意：**step 之间仍然串行**——subagent 跑完才进下一步。subagent 的作用是**隔离上下文**，不是非阻塞调度。

### 并行多 unit 自动判断

`unit.<field>` 形态的 step 默认按 unit 顺序循环。如果脚本支持并发调用（看 description / notes 是否提示）且资源允许，Claude Code 自主决定要不要并发跑。

如果脚本不支持并发（有 session 冲突、API 限流等），降级为串行。

---

## 异常路径：command 跑不通时

step 失败时：

### 1. 打开 notes sidecar（如果 step 有 notes 字段）

用 Read 工具打开 `workflows/notes/<step_id>.md`。读完寻找处理方法：

- 是否有"出错时"段落给了应对策略
- 是否有"经验与坑"提到过类似失败
- 是否有"历史决策"说明 command 为什么长这样

### 2. 回到 description 重新理解

按 description 重新判断这一步应该怎么做。可能需要：
- 修正 command 里的路径/参数/工具名
- 改用不同的 skill
- 自己用基础工具拼一个执行方式

### 3. 修正后的 command 反写

如果发现 command 本身写错了或环境变了（路径改了、参数名变了），修复后**告诉用户修正过、并询问要不要把修正反写回 workflow.yaml**。

### 4. 仍然解决不了 → 停下问用户

把错误信息、已经尝试的修复、notes 里的提示一起呈现，等用户决定。

---

## 持续维护小表

**每跑完一份产出立刻 persist**——这是 resume 能力的基础：

- 单份产出 step 完成 → 更新 steps_status[step.id] = done，更新 current_step，写盘
- 多份产出 step 的**每一个 unit** 完成 → 更新该 unit 的 status 和字段、写盘；step 整体的 status 等所有 unit 都完成才标 done

并行执行多 unit 时尤其注意：先收齐结果再统一写一次盘，避免并发写冲突。

---

## 完成

所有 steps 都 done：
- manifest.status = done
- 给用户一个总结：run_id、耗时、产出路径、units 数量
- 提示：发现问题用 workflow-revise 改

---

## 反馈通路（process-findings.md）

执行过程中如果发现**框架本身/流程结构**层面的不顺，记一条到 `process-findings.md`。session 末和用户一起过一遍，决定哪些提 GitHub issue。

**怎么分诊**：

| 故障来源 | 动作 |
|---|---|
| `workflow.yaml` / `scripts/` / `runs/` 下的内容 | 直接改，跑下去——这些是项目自己的事 |
| 外部 skill / 工具的 bug | 该 skill 文档自带反馈仓库地址，提到那里 |
| 框架部件本身（三个 SKILL、SCHEMA） / 跑下来感觉某机制不顺 | 写一条到 `process-findings.md`，session 末讨论 |

### 提交 GitHub issue

用户确认要提交某条 finding 后：

1. issue 标题：`[<项目名>] <一句话现象>`
2. issue body：项目名、现象、发生场景（run / step）、初步判断（如果有）
3. `gh issue create -R aliensweety/workflow-framework`
4. 把 issue URL 写回 process-findings.md 对应条目，状态改为 `submitted`

---

## 需要警惕的模式

- **不要在正常路径读 notes**。读到字段名就够了。读 notes 是异常路径的事。
- **不要因为"想确认"而读 description**。有 command 直接跑。description 是兜底。
- **不要把 manifest 当一次性写入**。每个 step、每个 unit 跑完都要 persist。
- **不要在大表里偷偷加字段**。schema 之外的字段不写。发现需要某种新能力，记到 process-findings.md。
- **不要"修好就偷偷继续"**。发现 command 错了改完之后，告诉用户做了什么决定。
- **不要机械执行失败的 command**。command 是落地真相，但环境变了要按 description+notes 重新判断。
- **不要把自己 workflow.yaml / scripts 的问题推到 process-findings.md**——那是框架/通用层的反馈通路，项目自己的事直接在项目里改。
- **不要硬改外部 skill 源代码**。每个 skill 自带反馈机制。