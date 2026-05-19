---
name: workflow-compose
description: 通过和用户对话生成 workflow YAML 大表。当用户说"做一个新工作流"、"设计一个流程"、"把这件事做成可重复的工作流"、"create a workflow"、"design a workflow for X"、或提及要把某件重复性工作固化下来时触发。自由对话直到能写出大表，不分轮、不走问卷。第一版是骨架，跑起来再迭代。
---

# workflow-compose

把一个想法变成一份能跑的工作流。核心产出物是 `workflows/workflow.yaml`。

## 前置阅读

每次触发先读 `../WORKFLOW_SCHEMA.md`（相对本 SKILL.md）——它给出大表字段语义、小表自适应机制、笔记 sidecar 约定。

特别熟悉这两条原则，因为它们决定怎么和用户对话：

- **落地是真相，种子是兜底**——能写死成具体执行指令的就写死，自然语言用来兜底
- **能写死就写死**——颗粒度越细越好，少留判断空间

---

## 对话方式

不是问卷，是对话。**自由对话直到能写出大表为止**。

不分轮、不预设步骤数、不一口气抛十个问题。每次 1-2 个真正能推进的问题，听完回答再往下。该问就问、该停就停。

**让用户尽量用自然语言把流程讲一遍**——他想把它稳定下来，就会主动尽量表达。Claude Code 的角色是听清楚，把自然语言翻译成大表。听不清就问，听清楚了就写。

---

## 需要弄清楚的事（不是问题清单，是检查清单）

写出大表之前，这些信息要么从对话里听到了，要么明确问出来：

1. **本质**：这个工作流要产出什么？为什么要稳定下来（重复性？）？
2. **流程骨架**：从输入到产出，需要哪些步骤？什么顺序？
3. **每一步做什么**：业务逻辑——从哪取输入、产出什么、用什么工具
4. **是不是多份产出**：某一步会出"一份输入 → N 份输出"的形态吗？（这决定 manifest_template 要不要写）
5. **核心价值点 vs 落地执行**：哪几步是真正需要思考的（写文案、做美学判断）？哪几步是程序性的（调 API、跑脚本）？

**前 4 项**用户描述工作流时通常自然就说了，不必专门问。
**第 5 项**值得专门问一句——它对编排时的颗粒度有指导意义：思考型步骤可以多留 description、少写 command；执行型步骤反过来。

---

## 翻译成大表

弄清楚后开始写 `workflows/workflow.yaml`。

### 整体结构

```yaml
name: <项目名/工作流名>
description: |
  一段密度高的自然语言。包含：
  - 一句话定位（这个工作流做什么）
  - 核心价值点（哪几步是关键的思考）
  - 风格/约束（不可妥协的调性、美学、规则）
  - 产出形态（最终交付物是什么）

manifest_template:           # 仅当有"多份产出"步骤时写
  unit_type: <segment/scene/chapter/...>
  unit_fields: [<list>]

steps:
  - id: ...
    description: ...
    command: ...             # 可选，能写死就写死
    consumes: ...            # 可选
    produces: ...            # 可选
    notes: ...               # 可选
```

### 每个 step 的写法

**id**：蛇形命名，能反映这一步做什么。

**description**：必填。写业务逻辑——做什么、从哪取输入、产出什么、为什么存在。

- 思考型步骤：description 可以多说几句，包括风格指引、判断标准
- 执行型步骤：description 一句话说明业务含义即可，重头是 command

**command**：能写死就写死。带占位符（`{run.dir}` / `{unit.<field>}` / `{run.id}`）。

判断标准：**这一步重复跑会不会得到一样的结果?**
- 会（调 API、跑脚本、确定性转换）→ 写 command
- 不会（写文案、做美学判断）→ 留空，让运行时按 description 决定

**consumes / produces**：能写就写，描述输入输出形态。produces 决定 fan-out 性质：

- 单份产出：`produces: "{run.dir}/script.md"`
- 写入 manifest.units（fan-out 起点）：`produces: "manifest.units"`
- 写入 unit 字段（fan-out 后续 step）：`produces: "unit.image"`

**notes**：本步骤如果有"打磨期间发现的坑、经验、出错处理、历史决策"，按需创建 `workflows/notes/<step_id>.md`，大表里写 `notes: workflows/notes/<step_id>.md`。

**第一版编排不必创建 notes 文件**——大表草稿出完直接跑，跑过几次发现有踩坑的地方再回头加 notes。这是 sidecar 机制的演化路径：从 description-only 开始，遇到坑再下沉到 notes。

### manifest_template 怎么决定

听对话里有没有"一份输入 N 份输出"的形态：

- 有 → 写 manifest_template。`unit_type` 用用户的自然语言（段/场景/章节/选题），`unit_fields` 列出每个 unit 会承载哪些信息
- 没有 → 不写

**不要问用户"要不要 units"**。这是抽象泄漏。用户描述输入输出形态就够了，是否产生 units 由编排器自己判断。

---

## 识别需要新建的 skill / script

写完大表，扫一遍 `steps`：

- `command` 里引用的脚本，检查是否存在于项目的 `scripts/` 或 skill 目录下
- 提及但未明确路径的工具，问用户："这一步你打算怎么跑？已经有脚本/skill 吗？"

不存在的，告诉用户路径，问要不要一起建骨架：
- 建 skill 骨架：`.claude/skills/<skill-name>/SKILL.md`（frontmatter + 空内容 + TODO）
- 建 script 骨架：`scripts/<name>.py`（或其他语言）

不强求一次到位——编排出骨架就行，细节留给打磨。

---

## 生成后提醒用户

> 草稿出来了。下一步：说"跑一下"或具体描述这次要做什么，workflow-run 会触发。
>
> 第一次跑的过程中遇到不对的地方，根据情况：
> - 是大表本身就写错了 → 直接改大表
> - 是某一步偶尔会踩的坑、经验性的判断 → 写进对应的 `workflows/notes/<step_id>.md`
> - 是流程整体不顺、框架问题 → 记到 `process-findings.md`，session 末决定是否提 issue

---

## 需要警惕的模式

- **不要走问卷**。自由对话，该问就问该停就停。
- **不要问机制层概念**：不问"要不要 units"、"要不要 subagent"、"要不要 ask"——这些用户没有词汇能回答，是抽象泄漏。
- **不要塞原理解释或长注释**。大表要干净。原理放 `decisions.md`，经验放 `workflows/notes/<step_id>.md`。
- **不要生成 schema 之外的字段**（status / retry / autonomy / method / dispatch / iterates_over / parallelism 这些都没有了）。需要某个能力先问自己是否真的需要——大概率 description + command + notes 已经覆盖。
- **不要把项目私有 skill 放到裸 `skills/` 下**。必须放在 `.claude/skills/<name>/`（Claude Code 硬性规定）。
- **不要追求一次写完所有 notes**。第一版只编排大表，notes 等跑过有踩坑再回头写。
- **不要为了"灵活"留判断空间**。能写死成 command 的就写死。颗粒度越细越好。

---

## 给 Claude Code 自己的最后一条提醒

写大表的过程要保持元认知：**当前在帮用户编排，还是在替用户做决定？**

如果用户描述里有自己的判断（"我希望第三步用 X 风格"），那是他的决定，照做。
如果用户没说但你在替他选某个机制（"这里应该用 subagent"），先收一收——大概率该机制根本不需要在大表里暴露，让 run 时再自主判断就好。