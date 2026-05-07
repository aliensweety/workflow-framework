---
name: workflow-run
description: 执行一个 workflow YAML，维护 manifest 运行态。当用户说"跑工作流"、"开始生产"、"执行流程"、"run workflow"、"start a production run"、"继续上次的 run"或类似意图，或提及项目里已有的 workflow 名字时触发。按 autonomy 级别决定是否停下来和用户交互：auto 直接跑、report 跑完简报、ask 停下等确认。支持 fan-out（iterates_over units）、并行（parallelism）、subagent 派发（dispatch）和 resume。
---

# workflow-run

读取 workflow YAML，按顺序执行每一步，持续维护 manifest。

## 前置阅读

触发时先读 `../WORKFLOW_SCHEMA.md`，确认字段语义。schema 里"intent 和其他字段的关系"那段尤其重要——**command / method / dispatch / consumes / produces 是示例而非机械指令，如果环境变了，按 intent 重新判断怎么落地**。

## 启动流程

### 第一步：定位 workflow

用户的话里通常有 workflow 线索（项目名、作品名、选题名）。读项目根目录 `workflows/` 下有哪些 YAML。

- 只有一个 → 直接用
- 多个 → 问用户哪个（除非描述明显对应某一个）
- 一个都没有 → 提示用户先用 `workflow-compose` 做一份

读进 workflow YAML 全部内容。

### 第二步：定位 run（resume vs new）

扫项目 `runs/`，看有没有 `status: in_progress` 或 `paused` 的 run，且 `workflow` 字段匹配当前要跑的 workflow。

**有 in-progress 的**：
- 告诉用户："发现上次的运行 `<run_id>`，停在 `<current_step>`。恢复，还是开新的?"
- 恢复 → 读 manifest.yaml，跳到第三步
- 开新的 → 走"新建 run"流程

**新建 run**：
1. 问用户这次运行的"实例名"（书名/选题/场景名等），用于 run_id
2. 创建 `runs/<YYYY-MM-DD>_<instance>/` 目录（如有重名加时间后缀）
3. 初始化 manifest.yaml：`run_id`、`workflow`、`instance`、`created_at`、`status: in_progress`、`current_step`（第一个 step 的 id）、`steps_status`（全部 pending）、`units: []`
4. 写入 manifest 文件

### 第三步：按 step 顺序执行

遍历 workflow.steps：

```
for step in workflow.steps:
  if steps_status[step.id] == done: 跳过
  if steps_status[step.id] == stale: 重跑（只对 status 为 stale 的 units）
  否则: 执行
```

执行 step 的通用流程：
1. 在 manifest 里标记 `running`，更新 `current_step`
2. 根据 `dispatch` 决定派发方式（见下一节）
3. 根据 `method` 分派执行
4. 成功 → 标记 `done`，更新 manifest；失败 → 标记回 `pending`，告诉用户错误
5. 按 autonomy 决定是否停下

## dispatch 派发

### dispatch: inline（默认）

在主会话里直接执行 step。command / skill / claude-code 推理都在主会话上下文里完成。

### dispatch: subagent

把这一步派给 sub-agent 跑。具体方式：

**对于 method: script**：用 Agent 工具（或 Task 工具）启动一个 sub-agent，告诉它：
- step 的 intent（让它知道在做什么）
- 要执行的 command（变量插值后的完整命令）
- 期望的产出位置（produces）
- 完成后回报：成功与否、产出文件路径、关键信息摘要

主会话不接收 stdout/stderr 的全部内容，只拿摘要。

**对于 method: claude-code 或 skill**：把 step.intent 和 consumes 文件作为任务交给 sub-agent，让它在自己的上下文里完成，回报产出。

**长时间任务的策略**：
- 如果 step 涉及轮询、等待外部任务（deep research、TTS 异步任务），sub-agent 启动后可以让它继续在后台跑。Claude Code v2 支持后台 sub-agent，主会话可以继续往下处理 inline 步骤。但当前框架默认 step 之间串行——所以 subagent 跑完才进下一步。
- 即便如此，dispatch: subagent 仍然有用——避免轮询过程中的大量 stdout 污染主会话上下文。

**降级**：如果环境不支持 sub-agent（旧版本 Claude Code、特殊配置），降级为 inline 执行并告诉用户。

## method 分派

### method: claude-code

Claude Code 自己用基础工具（Read、Edit、Bash、推理）完成。读 step.intent 理解要做什么，读 consumes 指向的内容，产出 produces 指向的文件或字段。

典型衔接型场景：从 JSON 抽字段、切分文本为 units、装配 manifest。

**写入 manifest.units 的 step（fan-out 起点）**：当 step.intent 说"切分 X 写入 manifest.units"时，Claude Code 要：
1. 读 consumes 文件
2. 按 intent 描述切分（找到合适 skill/工具/自己推理）
3. 把每个切片转成一个 unit dict（id 用 `<unit_type>_NNN` 零填充，status: pending，加上 unit_fields 定义的字段）
4. 写回 manifest.yaml 的 units 数组

### method: skill:<n>

把任务委派给一个专门的 skill：
1. 找到 skill（先看项目 `.claude/skills/<n>/`，再看 `~/.claude/skills/<n>/`）
2. 按描述触发让 Claude Code 识别并加载
3. 按它的指引完成任务，产出写到 produces 指定位置

### method: script

执行 command 字段里的 shell 命令：
1. 对 command 做变量插值（`{run.dir}`、`{run.id}`、`{workflow.name}`、`{unit.<field>}`、`{unit.id}`）
2. 用 Bash 工具执行（或派给 sub-agent，看 dispatch）
3. 检查 returncode：0 成功，非 0 失败
4. stdout/stderr 根据需要记录到 `{run.dir}/logs/<step_id>.log`

**command 是示例而非机械指令**。如果插值后命令在当前环境明显跑不通（脚本路径变了、参数名改了），按 step.intent 重新判断正确的调法，不要盲跑失败再问。修正后的命令可以反写回 workflow.yaml（提示用户确认）。

## fan-out 和并行

### step 有 `iterates_over: units` 时

**前提**：manifest.units 已经被前面某个 step 填充。如果 units 还是空数组，说明前面的"生成 units 的 step"还没跑或漏了——告诉用户问题。

对每个 status != done 的 unit 循环：
- command 插值用当前 unit 的字段
- 每跑完一个 unit，更新 manifest（小粒度持久化，防止中断丢失）
- 把产出文件路径回写到对应 unit 的字段（如 image_path）

### parallelism

- 不写 / 写 1 → 串行，按 unit 顺序一个一个跑
- 写 >1（如 4）→ 并行，最多同时跑 N 个 units

并行实现可以用 Python 的 concurrent.futures、xargs -P、node 的 Promise.all 等等——看脚本适合哪种方式。并行时同样要保证每个 unit 跑完及时持久化到 manifest，避免并发写冲突（最简单的做法是先收齐再统一写）。

如果脚本本身不支持并发调用（有 session 冲突、API 限流等），即使写了 parallelism 也要降级为串行并告诉用户原因。

**parallelism 和 dispatch 可以同时用**：每个 unit 的执行可以派给不同的 sub-agent 并行跑，主会话只汇总结果。

## autonomy 行为

每个 step 执行后按 `autonomy` 决定：

### auto
- 成功：悄悄继续，不要打扰
- 失败：停下，告诉用户错误

### report
- 成功：一句话简报（"完成 `<step_id>`：产出了 N 个 xxx"），继续
- 失败：同 auto

### ask
- 执行完**不管成败**都停下
- 展示产出关键内容（思考型步骤展示文案/prompt 等供用户审）
- 问："OK 吗?要改哪里?还是继续?"
- 用户 OK → 标记 done，继续
- 用户要改 → 协助修改，改完再问一次
- 用户说"后面也用这个 autonomy 跑完" → OK，本次会话降级 ask→report

**fan-out 场景下的 ask**：第一个 unit 跑完就停下问。用户确认方向后，剩余 units 默认提议降级 report 批量跑。不会每个 unit 都打断。

## 遇到问题：先分诊，再行动

跑 step 出错时，**先按"故障来源在哪个目录"分诊**。详细规则在项目 CLAUDE.md "你是谁，你的活有多大"那段——这里只放运行时速查表。

| 故障来源 | 归属 | 动作 |
|---|---|---|
| `workflows/<n>.yaml`（字段写错、command 调不通需按 intent 改写） | MINE | 直接改 YAML，跑下去 |
| `scripts/`（项目自己的脚本 bug） | MINE | 直接改脚本，跑下去 |
| `runs/<id>/manifest.yaml`（状态错乱、字段缺失） | MINE | 直接修 manifest，跑下去 |
| `runs/<id>/` 产出物（文件错位、格式问题） | MINE | 直接动产出，跑下去 |
| `.claude/skills/<非框架>/`（gemini / grok / google-flow / runninghub-tts 等） | SKILL 层 | **外发** `issues.md` 简报 |
| 4 个框架部件 或 workflow 设计层面 | 框架层 | **外发** `workflow-issues.md` 简报 |

**MINE 的处理**：是你的领地，直接改、继续跑、跑完简报里一句话提一下。

**外发到 `issues.md` 的处理**：
- 按 issues.md 模板硬约束字段写一条（运行命令 / 报错 / 发现时间）。**它不是你回头看的 TODO，是发给 Skill 管理层 CC 的报告**——写完就走，不分析、不维护状态。
- 如有 workaround 能让 run 继续，告诉用户后跑下去
- 走不下去：告诉用户"这一步因为 [skill 名] 的 [现象] 跑不动，已写入 issues.md。等 skill 修好后 resume。"

**外发到 `workflow-issues.md` 的处理**：
- 同样的"外发"逻辑——发给框架层 CC，不是你回头看的。包含 (a) 框架部件问题 和 (b) 行为信号（你打磨/执行时感到不顺、用户指出你没遵循流程等）。
- 写完告诉用户："这里触发了一个框架层信号，已写入 workflow-issues.md。"

**禁止**：把 MINE 的活推到外发文件里。"我 workflow YAML 自己写错了"、"我 manifest 状态乱了"、"我 scripts 脚本有 bug"——这些是你自己的活，自己改了就行。外发文件是给上一层 CC 用的，塞进自己的活只会干扰对方处理真正的外部问题。

## 完成

所有 steps 都 done：
- manifest.status = done
- 总结：run_id、耗时、产出路径、units 数量
- 建议：发现问题用 `workflow-revise` 改

## 需要警惕的模式

- **不要在 workflow YAML 里偷偷加字段**。发现字段不够用，写到 workflow-issues.md 等讨论。
- **不要批量全自动跑过 ask 节点**。ask 就是要停。
- **不要把 manifest 当一次性写入**。每个 step / 每个 unit 跑完都要持久化。
- **不要把 logs 和产出物混一起**。日志进 `{run.dir}/logs/`，正式产出在 `{run.dir}/` 其他位置。
- **不要"修好就偷偷继续"**。ask 节点改完要再确认一次。
- **不要机械执行失败的 command**。command 是示例，环境变了要按 intent 重判断。
- **不要为了让 run 继续就硬改外部 skill 源代码**（`.claude/skills/<非框架>/`）。外发到 issues.md，让 skill 管理层处理。
- **不要把 MINE 的问题推到外发文件上**。workflows/、scripts/、runs/ 是你的活，自己改。
- **不要回头读 issues.md / workflow-issues.md**——它们不是你的待办，是给上一层 CC 看的。写完就走。
