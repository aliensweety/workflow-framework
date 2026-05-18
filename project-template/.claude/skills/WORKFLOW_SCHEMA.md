# Workflow Schema

这份文档是框架的**运行时规范**。三个 skill（compose/run/revise）都引用它。

**位置**：项目级 `<project>/.claude/skills/WORKFLOW_SCHEMA.md`（与三个 skill 文件夹同级）。
三个 SKILL.md 通过相对路径 `../WORKFLOW_SCHEMA.md` 引用。

要理解"为什么这么设计"，读框架根目录的 `FRAMEWORK.md`。这份文档只讲"字段怎么用"。

本框架有两种 YAML 文件：
- **Workflow YAML**（模板）：项目根 `workflow.yaml`，定义流程，不变。
- **Manifest YAML**（运行态）：`runs/<timestamp>_<instance>/manifest.yaml`，记录这一次生产的具体产出和状态。

---

## 0. intent 和其他字段的关系

这个前置概念决定了怎么看 YAML 里所有字段：

**intent 是种子，其他字段是种子在特定环境下长出来的具体形态。**

- `intent` 是目标 + 不可妥协的约束
- `method` / `command` / `consumes` / `produces` / `dispatch` 等是**"这么跑被验证过可以"的示例**，不是机械指令
- 打磨阶段可能每次都重新生成这些字段，稳定后沉淀下来减少重复判断
- 环境变了（脚本路径改了、API 换了、新 skill 可用了），Claude Code 应该按 intent 重新判断怎么落地，而不是盲跟 command

这个定性贯穿下面所有字段的理解。

---

## 1. Workflow YAML

### 完整字段

```yaml
name: <string>                       # 必填，workflow 唯一标识
intent: |                            # 必填，自然语言描述工作流本质（种子）
  一段自由文字，描述这个工作流的目的、核心价值点、风格约束、fan-out 结构。
  这是给未来会话的记忆锚点。
  写本质：核心价值在哪几步？风格/调性如何？什么不能妥协？

manifest:                            # 可选，仅当用 units 时需要
  unit_type: <string>                # units 在这个 workflow 里叫什么（segment/scene/chapter/...）
  unit_fields: [<list of strings>]   # 每个 unit 承载哪些字段

steps:                               # 必填，有序列表
  - id: <string>                     # 必填，step 唯一标识（蛇形命名）
    intent: <string>                 # 必填，一句话说明这一步做什么、为什么存在（种子）
    method: <see below>              # 必填，执行方式
    autonomy: <auto | report | ask>  # 可选，默认 report
    dispatch: <inline | subagent>    # 可选，默认 inline
    consumes: <string or list>       # 可选，输入（文件路径 或 manifest 字段）
    produces: <string>               # 可选，输出（文件路径 或 unit 字段）
    iterates_over: units             # 可选，有此字段则对每个 unit 跑一次
    parallelism: <int>               # 可选，默认 1（串行）；>1 表示 iterates_over 时单 step 内的并行度
    command: <string>                # 仅当 method == script 时必填
    skill: <string>                  # 仅当 method == skill 时必填（也可写成 method: "skill:<n>"）
```

### method 三种

| method | 含义 | 何时用 |
|---|---|---|
| `claude-code` | Claude Code 直接用推理和基础工具完成 | 衔接型节点（切段、抽字段、轻量格式转换） |
| `skill:<n>` | 调用一个专门的 skill（progressive disclosure） | 思考型节点（需要风格指引、示例、较多上下文） |
| `script` | 执行 shell 命令 | 执行型节点（跑脚本、调 API、确定性转换） |

打磨期和稳定期可以演化:一开始衔接用 `claude-code`，稳定后下沉为 `script`；思考型一开始可能 `claude-code` + `ask`，稳定后包装成 `skill`。

### autonomy 三级

| level | 行为 |
|---|---|
| `auto` | 直接跑，成功不报告，失败才停 |
| `report` | 跑完给一句话简报，继续下一步 |
| `ask` | 执行完停下展示产出，等用户确认/修改后才继续 |

**默认值**：`report`。

**打磨期建议**：思考型节点设为 `ask`。稳定后批量改为 `report`。

### dispatch 两种

| dispatch | 行为 |
|---|---|
| `inline`（默认） | 在主会话里直接跑这一步 |
| `subagent` | 派给 sub-agent 在隔离的上下文里跑，主会话收回结果 |

**何时用 subagent**：
- 长时间运行的 step（轮询外部任务、等待 API 响应）
- 输出量大但只需要最终结论（deep research、log 分析）
- 会污染主会话上下文的 step（大量 stdout、长文档处理）

**何时保持 inline**：
- 短任务、纯命令调用
- 衔接型节点（claude-code 自己抽字段、切段——这些主会话直接做最快）
- 需要主会话感知中间结果做判断的 step

打磨阶段不需要写 dispatch（默认 inline）。打磨完后发现某步符合 subagent 特征，加上 `dispatch: subagent` 沉淀下来。

### parallelism

只在 `iterates_over: units` 的 step 上有意义。控制**单个 step 内**多个 unit 之间的并行度。

| 值 | 含义 |
|---|---|
| `1`（默认，不写即 1） | 串行：每个 unit 跑完再跑下一个 |
| `>1`（如 `4`） | 并行：最多同时跑 N 个 units |

**注意**：并行只是流程层面的意图。要真正并行执行，被调用的脚本本身必须支持并发调用（API 有没有限流、会不会踩同一个文件、有没有 session 冲突等）。如果脚本不支持，即使写了 parallelism，workflow-run 也应当降级为串行并告诉用户。

**和 dispatch 的关系**：parallelism 控制"step 内的 units"并行；dispatch 控制"单个 step（或 step 内的单次循环）"派发到哪。两者正交，可以同时使用。

**Step 之间永远串行**——当前框架不支持跨 step 并行调度。

### 变量插值

在 `command`、`consumes`、`produces` 字段里可以用以下占位符：

| 占位符 | 含义 |
|---|---|
| `{run.dir}` | 当前 run 的目录（如 `runs/2026-04-18_异乡人/`） |
| `{run.id}` | 当前 run 的 id |
| `{unit.<field>}` | 当前 unit 的某个字段（仅在 `iterates_over: units` 的 step 里可用） |
| `{unit.id}` | 当前 unit 的 id |

### 一个最小例子

```yaml
name: minimal-example
intent: |
  最小示例，演示三种节点方法、dispatch、iterates_over 的组合用法。
  核心：第二步（research）是耗时长任务，subagent 派发；第三步对每个 item 出结果。

manifest:
  unit_type: item
  unit_fields: [description, result]

steps:
  - id: prepare
    intent: 准备素材文件
    method: script
    autonomy: auto
    command: "python scripts/prepare.py --output {run.dir}/raw.txt"

  - id: research
    intent: 长时间研究任务，派给 subagent 跑
    method: script
    dispatch: subagent
    autonomy: report
    consumes: "{run.dir}/raw.txt"
    produces: "{run.dir}/research.md"
    command: "python scripts/long_research.py --input {run.dir}/raw.txt --output {run.dir}/research.md"

  - id: plan_items
    intent: 把 research 结果切成多个 item 写入 manifest.units
    method: claude-code
    autonomy: ask
    consumes: "{run.dir}/research.md"
    produces: "{run.dir}/manifest.yaml"

  - id: process_each
    intent: 对每个 item 跑一次，可并行
    method: script
    iterates_over: units
    parallelism: 4
    autonomy: auto
    command: "python scripts/finalize.py --desc '{unit.description}' --output {run.dir}/{unit.id}.done"
```

---

## 2. Manifest YAML

Manifest 是一次运行的状态文件。框架硬约束以下字段；其余由 workflow 自己声明。

### 完整字段

```yaml
run_id: <string>                     # 必填，运行唯一标识（通常 <timestamp>_<instance>）
instance: <string>                   # 必填，这次运行的实例名（如书名/选题/场景名）
created_at: <ISO timestamp>          # 必填
status: <in_progress | done | paused>  # 必填
current_step: <step_id>              # 必填，当前正在/上次停在哪一步

steps_status:                        # 必填，每个 step 的状态
  <step_id>: <pending | done | stale | running>

units:                               # 仅当 workflow 用 fan-out 时有内容
  - id: <string>                     # 必填，unit 唯一标识
    status: <pending | done | stale>  # 必填
    # workflow.manifest.unit_fields 里定义的字段
    <field1>: <value>
    <field2>: <value>
```

### 何时用 units，何时不用

**用 units 的场景**：
- 一篇文案 → 多张配图、多段配音
- 一个故事 → 多个分镜
- 一份大纲 → 多个章节

判断：你需要 framework 级别的"局部修改能力"——"第 3 段改一下" workflow-revise 能定位并只重跑那一段。

**不用 units 的场景**：
- 纯线性流程（topic → research → script → done，每步一个产物）
- fan-out 在脚本内部解决，且不需要 framework 看见结构
- 修改总是从头重来

不用 units 时，`manifest` 字段可以省略，或写 `unit_type: run`、`unit_fields: []`。manifest.units 留空数组。

### 硬约束 vs 自定义

**硬约束**（所有 workflow 都必须遵守）：
- `run_id`, `instance`, `created_at`, `status`, `current_step`, `steps_status`
- 每个 unit 有 `id` 和 `status`

**自定义**（由 workflow.manifest.unit_fields 决定）：
- 每个 unit 其他的字段——时间戳/文本/路径/场景编号等等

**为什么这么分**：框架需要机械能力（列出 steps 状态、遍历 units、标记 stale、resume），这些动作依赖硬约束字段。识别"2:30 对应哪个 unit"这种事，交给 Claude Code 对整个 manifest 做理解，不靠固定字段名。

### stale 传播规则

当用户说"unit X 的字段 Y 有问题"：

1. Claude Code 读 manifest + workflow，识别哪些 step 会影响字段 Y（按 step 顺序推断）
2. 把那个写入 Y 字段的 step 和其后所有 `iterates_over: units` 的 step，在 `steps_status` 里标记为 `stale`（针对 unit X）
3. 把 unit X 的 `status` 标记为 `stale`
4. 交给 workflow-run 重跑

**简化原则**：不搞复杂的依赖图。workflow 的 step 顺序就是依赖顺序。step B 在 step A 之后，就假定 B 依赖 A。哪个 step 产出哪个字段，由 Claude Code 看 workflow 自己推，不需要在 schema 里声明。

**当 workflow 没有 units**：定位靠 step + 文件路径。"research 那段错了" → 找到 deep_research step → 标 stale → 它和它之后的所有 step 都重跑。

### 一个 manifest 例子

```yaml
run_id: 2026-04-18_异乡人
instance: 异乡人
created_at: 2026-04-18T10:23:00
status: in_progress
current_step: generate_images

steps_status:
  script: done
  segment: done
  image_prompts: done
  generate_images: running
  tts: pending
  assemble: pending

units:
  - id: seg_001
    status: done
    time: "00:00-00:30"
    text: "加缪笔下的默尔索..."
    prompt: "a red panda sitting alone on a beach..."
    image: runs/2026-04-18_异乡人/images/seg_001.png
    audio: null
  - id: seg_002
    status: done
    time: "00:30-01:05"
    text: "..."
    prompt: "..."
    image: runs/2026-04-18_异乡人/images/seg_002.png
    audio: null
```

---

## 3. 项目目录约定

```
my-project/
├── CLAUDE.md                        # 项目入口
├── .claude/
│   └── skills/                      # 框架 skill 副本 + 项目私有 skill
│       ├── WORKFLOW_SCHEMA.md       # 框架（install.bat 同步）
│       ├── workflow-compose/        # 框架（install.bat 同步）
│       ├── workflow-run/            # 框架（install.bat 同步）
│       ├── workflow-revise/         # 框架（install.bat 同步）
│       └── <my-skill>/              # 项目私有，install.bat 不动
├── workflow.yaml                    # 项目唯一工作流模板（根目录单文件）
├── scripts/                         # 项目私有脚本（执行型节点调用）
│   └── <n>.py
├── runs/                            # 每次运行的实例
│   └── <run_id>/
│       ├── manifest.yaml
│       └── <产出物...>
├── process-findings.md              # 打磨期间临时笔记，session 末和用户讨论要不要提 issue
└── decisions.md                     # 设计决策和原理（不在 runtime 加载）
```

**项目私有 skill 必须放在 `.claude/skills/` 下**（Claude Code 的硬性规定），不能是裸 `skills/`。
