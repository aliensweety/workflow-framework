# Workflow Schema

框架的**运行时规范**。三个 skill（compose/run/revise）都引用它。

**位置**：项目级 `<project>/.claude/skills/WORKFLOW_SCHEMA.md`，三个 SKILL.md 通过相对路径 `../WORKFLOW_SCHEMA.md` 引用。

要理解"为什么这么设计"，读框架根目录的 `FRAMEWORK.md`。本文档只讲"字段怎么用"。

本框架有三种文件：

| 类型 | 位置 | 角色 |
|---|---|---|
| 大表 | `workflow.yaml` | 流程定义。该做什么、按什么顺序。不变。 |
| 小表 | `runs/<run_id>/manifest.yaml` | 进度记录。这次做到哪了。每跑完一份产出立刻更新。 |
| 笔记 | `workflows/notes/<step_id>.md` | 单步的扩展信息。按需创建，平时不读。 |

---

## 0. 核心原则速记（来自 FRAMEWORK.md）

- **落地是真相，种子是兜底**：有 `command` 直接跑，没 `command` 或跑不通才回 `description` 重新理解
- **渐进披露**：`notes` 字段是 sidecar 文件路径，正常路径不读
- **能写死就写死**：编排越具体越好，自主判断只在异常路径介入
- **大表/小表自适应**：产出多份时小表自然展开 `units`，不需要"模式"开关

---

## 1. 大表（workflow.yaml）

### 完整字段

```yaml
name: <string>                     # 必填，workflow 唯一标识
description: |                     # 必填，整个工作流的种子
  目的、核心价值、风格约束、产出形态。
  给未来会话的记忆锚点。

manifest_template:                 # 可选，编排时声明小表骨架
  unit_type: <string>              # units 在本工作流叫什么（segment/scene/chapter)
  unit_fields: [<list of strings>] # 每个 unit 承载哪些字段

steps:                             # 必填，有序列表
  - id: <string>                   # 必填，蛇形命名
    description: |                 # 必填，本步骤的种子
      业务逻辑——做什么、从哪取输入、产出什么、为什么存在
    command: <string>              # 可选，确定性执行指令（带占位符）
    consumes: <string>             # 可选，输入路径或字段
    produces: <string>             # 可选，输出形态（单份 / 多份 / unit 字段）
    notes: <path>                  # 可选，指向 workflows/notes/<step_id>.md
```

### 字段语义

#### `description`（必填）

**这一步的种子**。写业务逻辑：做什么、从哪取输入、产出什么、为什么存在。

- 平时帮 Claude Code 理解流程意义
- command 跑不通时，回它重新生成执行方式

不要在这里写"打磨经验、坑、出错怎么办"——那些进 sidecar 笔记。

#### `command`（可选）

**确定性的执行指令**。能写死就写死。例：

```yaml
command: "python scripts/grok_image.py --prompt '{unit.prompt}' --out {run.dir}/img_{unit.id}.png"
```

有 command → run 直接跑，不判断。
没 command → run 按 description 自主决定怎么做。

**颗粒度原则**：能写到一行指令的，就只写一行指令。不要为了"灵活"而留判断空间。

#### `consumes` / `produces`（可选）

输入和输出。**值不要求是字面路径**——可以是字面路径、变量插值、也可以是 unit 字段名。形态由 produces 自然决定 fan-out 性质：

```yaml
# 单份产出
produces: "{run.dir}/script.md"

# 多份产出（小表会自然展开 units）
produces: "manifest.units"          # 把内容切成 N 份写入 manifest.units

# 写入 unit 的某个字段
produces: "unit.image"
```

#### `notes`（可选，sidecar）

指向 `workflows/notes/<step_id>.md` 的路径。**run 在正常路径下不读这个文件**——只在以下情况打开：

- command 跑不通
- 没有 command，需要从 description 生成执行方式
- 编排修改时想看本步骤的历史决策

文件内部结构自由。建议但不强制的分段：

```markdown
# <step_id> — 扩展信息

## 出错时
（异常路径上 Claude Code 该参考什么）

## 业务逻辑详述
（description 写不下的详细说明）

## 经验与坑
（这一步遇到过什么、为什么这么处理）

## 历史决策
（为什么 command 长这样、改过几次、为什么放弃过 X 方案）

## 示例 / 反例
```

可以全有，也可以只有其中一段。

### 变量占位符

可在 `command` / `consumes` / `produces` 里使用：

| 占位符 | 含义 |
|---|---|
| `{run.dir}` | 当前 run 的目录 |
| `{run.id}` | 当前 run id |
| `{unit.id}` | 当前 unit 的 id（多份产出场景） |
| `{unit.<field>}` | 当前 unit 的某个字段（多份产出场景） |

### 最小例子

```yaml
name: minimal-example
description: |
  最小示例。一段文案 → 切分多段 → 逐段生图。

manifest_template:
  unit_type: segment
  unit_fields: [text, prompt, image]

steps:
  - id: write_script
    description: 用文案写作 skill 写一份完整文案
    command: "claude-code skill:script-writer --topic '{run.id}' --out {run.dir}/script.md"
    produces: "{run.dir}/script.md"

  - id: segment_and_prompt
    description: |
      把文案切成 N 段（按语义分段），每段配一句画面 prompt。
      把切分结果写入 manifest.units，含 text 和 prompt 字段。
    consumes: "{run.dir}/script.md"
    produces: "manifest.units"
    notes: workflows/notes/segment_and_prompt.md

  - id: generate_images
    description: 对每个 unit 调用 Grok 生图，存到 unit.image
    command: "python scripts/grok_image.py --prompt '{unit.prompt}' --out {run.dir}/img_{unit.id}.png"
    consumes: unit.prompt
    produces: unit.image
    notes: workflows/notes/generate_images.md
```

---

## 2. 小表（manifest.yaml）

一次运行的状态文件。框架硬约束以下字段；其余由大表自定义。

### 形态：单产出 / 多产出 自适应

manifest 不需要预先选"模式"。根据每一步实际产出形态自然展开：

- 某步产出**一份** → `steps_status` 里一行
- 某步产出**多份**（produces 指向 `manifest.units` 或 `unit.<field>`） → `steps_status` 里一行 + `units` 数组展开

### 字段

```yaml
run_id: <string>                   # 必填，运行唯一标识
instance: <string>                 # 必填，本次运行的实例名（书名/选题/场景名）
created_at: <ISO timestamp>        # 必填
status: <in_progress | done | paused>  # 必填
current_step: <step_id>            # 必填，当前/上次停在哪一步

steps_status:                      # 必填，每个 step 的状态
  <step_id>: <pending | done | stale | running>

units:                             # 仅当某步产出多份时填充
  - id: <string>                   # 必填，unit 唯一标识
    status: <pending | done | stale>  # 必填
    # 其余字段由 workflow.manifest_template.unit_fields 决定
    <field1>: <value>
    <field2>: <value>
```

### 硬约束 vs 自定义

**硬约束**（所有 workflow 都必须遵守）：
- `run_id`, `instance`, `created_at`, `status`, `current_step`, `steps_status`
- 每个 unit 有 `id` 和 `status`

**自定义**（由 workflow.manifest_template.unit_fields 决定）：
- unit 的其他字段——文本/路径/时间戳/场景编号等

框架机械动作（列出 steps 状态、遍历 units、标记 stale、resume）依赖硬约束字段。识别"2:30 对应哪个 unit"这种事交给 Claude Code 对整个 manifest 做理解，不靠固定字段名。

### 持久化纪律

**每跑完一份产出立刻更新 manifest**——多份产出的 step 也要每个 unit 跑完就写一次。这是 resume 能力的基础：如果中途中断，下次会话读 manifest 就知道做到哪了，不必从头扫文件系统反推。

### stale 传播规则

当用户说"unit X 的字段 Y 有问题"或"step Z 不对"：

1. Claude Code 读 manifest + workflow，识别哪些 step 会影响被改的内容（按 step 顺序推断）
2. 把那个产出该内容的 step 和其后所有产出多份的 step（对该 unit）在 `steps_status` 里标 `stale`
3. 把该 unit 的 `status` 标 `stale`
4. 交给 workflow-run 重跑

**简化原则**：不搞复杂的依赖图。大表的 step 顺序就是依赖顺序。step B 在 step A 之后，就假定 B 依赖 A。哪个 step 产出哪个字段，由 Claude Code 看 workflow 自己推。

**单产出场景**：定位靠 step + 文件路径。"research 那段错了" → 找到 research step → 标 stale → 它和它之后的所有 step 都重跑。

### 小表例子

```yaml
run_id: 2026-05-19_异乡人
instance: 异乡人
created_at: 2026-05-19T10:23:00
status: in_progress
current_step: generate_images

steps_status:
  write_script: done
  segment_and_prompt: done
  generate_images: running

units:
  - id: seg_001
    status: done
    text: "加缪笔下的默尔索..."
    prompt: "a red panda sitting alone on a beach..."
    image: runs/2026-05-19_异乡人/img_seg_001.png
  - id: seg_002
    status: done
    text: "..."
    prompt: "..."
    image: runs/2026-05-19_异乡人/img_seg_002.png
  - id: seg_003
    status: pending
    text: "..."
    prompt: "..."
    image: null
```

---

## 3. 笔记（sidecar）

每个需要扩展信息的 step 在 `workflows/notes/<step_id>.md` 放一个 markdown 文件。大表里 `notes: workflows/notes/<step_id>.md` 引用它。

**正常路径不读**。Claude Code 在 run 时遇到 `notes` 字段时只把它当成一个**路径引用**，不打开文件。

**触发打开的三种条件**：
1. command 跑不通
2. 没有 command，需要从 description 生成执行方式
3. 编排修改（workflow-revise）时定位到本步骤，想看历史决策

内容自由格式。可以是单段说明，也可以分段组织（出错时 / 业务详述 / 经验 / 历史决策 / 示例）。

---

## 4. 项目目录约定

```
my-project/
├── CLAUDE.md                      # 项目指导（运行时读）
├── decisions.md                   # 项目自述+心法（迭代时读）
├── process-findings.md            # 打磨期间临时笔记
├── workflows/
│   ├── workflow.yaml              # 大表
│   └── notes/                     # sidecar 笔记
│       ├── <step_id_1>.md
│       └── <step_id_2>.md
├── scripts/                       # 项目私有脚本
│   └── <name>.py
├── runs/                          # 每次运行的实例
│   └── <run_id>/
│       ├── manifest.yaml          # 小表
│       └── <产出物>
└── .claude/
    └── skills/                    # 框架 skill + 项目私有 skill
        ├── WORKFLOW_SCHEMA.md     # 本文档
        ├── workflow-compose/
        ├── workflow-run/
        ├── workflow-revise/
        └── <project-skill>/       # 项目私有
```

**项目私有 skill 必须放在 `.claude/skills/` 下**（Claude Code 硬性规定），不能是裸 `skills/`。

**workflow.yaml 在 `workflows/` 子目录而不是项目根**——为了和 `workflows/notes/` 在同一层级，引用路径短、视觉上聚合。