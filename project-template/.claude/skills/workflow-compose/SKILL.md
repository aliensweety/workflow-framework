---
name: workflow-compose
description: 通过采访生成 workflow YAML 模板。当用户说"做一个新工作流"、"设计一个流程"、"把这件事做成可重复的工作流"、"create a workflow"、"design a workflow for X"、或提及要把某件重复性工作固化下来时触发。先用自然语言采访理解本质，再把理解翻译成结构化的 workflow YAML。不追求一次到位——第一版是草稿，用户进入打磨阶段还会改。
---

# workflow-compose

把一个想法，变成一份能跑的 workflow YAML。

核心产出物是 `workflows/<n>.yaml`。本 skill 只负责"把意图结构化"，不负责"把每个节点都敲定到可执行"——那是打磨阶段的事。

## 前置阅读

每次触发此 skill，先读 `../WORKFLOW_SCHEMA.md`（相对本 SKILL.md 的路径）。schema 里有一个关键前置概念："intent 是种子，其他字段是种子在特定环境下长出来的具体形态"——这直接影响采访时怎么引导用户。

## 采访阶段

采访不是问卷，是对话。不要一口气抛出十个问题。每次 1-2 个高价值问题，听完回答再往下。

### 第一轮：本质

让用户先讲。如果用户直接抛需求（"做一个 X 工作流"），先问清楚：

- 这个工作流要产出什么?交付物是什么形态?
- 这个工作流会跑多少次?一次性的不需要框架；重复性的才需要。
- 如果用户对这件事已经有一套手动流程，让他讲一遍现在是怎么做的。

### 第二轮：核心价值点

这是最关键的问题。问：

> "这个工作流里，哪几步是真正有价值、必须由人或 AI 深度思考才能做好的?哪几步做完就做完、程序化跑一跑就行?"

记录下"核心价值点"——这进 workflow 的 `intent` 字段。其余的是落地执行。

经验法则：
- 思考型节点（核心价值）→ `method: skill:<n>` 或 `method: claude-code` + `autonomy: ask`
- 执行型节点（落地）→ `method: script` + `autonomy: auto`
- 衔接型节点（格式转换、切分、装配）→ 打磨期 `method: claude-code` + `autonomy: report`，稳定后可下沉为 `script`

### 第三轮：fan-out 和 units

这一轮专门讨论是否需要 units。

第一问：**这个工作流是不是"一对多"?** 比如一篇文案对应多段配音、多张图片?

如果是 → 第二问：**你将来需不需要"局部修改"能力**?——比如做完之后说"第 3 张图改一下，重新出一张就行，其他不动"。

- 需要 → **用 units**。确定切分单位（段落?场景?章节?时间段?），写进 `manifest.unit_type` 和 `manifest.unit_fields`。fan-out 的产出步骤用 `iterates_over: units`。
- 不需要（修改总是从头重来）→ **不用 units**。fan-out 在脚本内部循环就行，framework 不需要看见。manifest 字段省略或填空。

如果不是 fan-out（纯线性）→ 不用 units。

**unit 切分的起点 step**：把这一步标清楚——它的 method 通常是 `claude-code` 或 `skill:<n>`，intent 写明"切分 X 写入 manifest.units"。这是 framework 看见 fan-out 结构的入口。

并行问题：fan-out 步骤里，哪些可以并行?哪些必须串行?（比如串行生图为了风格一致；TTS 可以并行；Grok 同 session 不能并发）。并行的写 `parallelism: N`，不写默认串行。

### 第四轮：逐节点

把前面讨论的节点顺序，逐个落到 `steps[]`。每个 step 问三件事（能从前面对话推出来的不用重复问）：

1. 这一步是 **思考型 / 执行型 / 衔接型**?→ 决定 `method`
2. 打磨期需要停下来审吗?→ 决定 `autonomy`（思考型默认 `ask`，其余 `report`）
3. 它读什么、写什么?→ 决定 `consumes` / `produces`

对于执行型节点，如果用户已经有现成的脚本/API/skill，直接问：
> "这一步你打算怎么跑?已经有脚本了吗?"

记下来写进 `command`。

**关于衔接节点**：如果下游需要的是上游产出的某个子集（比如 Gemini 返回的 JSON 里的 `response` 字段），就在流程中加一个衔接 step。打磨时可以先用 `method: claude-code`，让 Claude Code 临时处理；如果这个衔接逻辑稳定重复，之后可以写个小脚本下沉。

### 第五轮：dispatch（采访末期，可选）

打磨阶段一般不需要写 dispatch（默认 inline）。但如果用户在采访时已经明确说某步"需要轮询很久 / 输出量大 / 不想污染主会话"，可以在写 YAML 时直接标 `dispatch: subagent`。

否则跳过这一轮，让用户在打磨过程中自己发现哪些 step 适合 subagent，事后加上。

## 生成阶段

采访到能写 YAML 了（不需要面面俱到，有骨架就行），开始生成。

### 生成 workflow YAML

1. 写在 `workflows/<n>.yaml`。文件名用 kebab-case。
2. `intent` 字段要有密度。参考模板：

```
intent: |
  【一句话定位这个工作流做什么】
  核心价值点：【列出思考型节点及其关键】
  风格/约束：【不可妥协的调性、美学、规则】
  fan-out 结构：【如果用 units，说明 unit 是什么、在哪一步生成、之后怎么用】
```

3. `steps` 按时间顺序排。每个 step 的 `intent` 字段写"为什么有这一步"，不是"怎么做"。`command` 是"这么跑被验证过可以"的参考示例，不是机械指令——未来环境变了，Claude Code 会按 intent 重新判断。

### 识别需要新建的 skill / script

扫一遍 `steps`：

- `method: skill:<n>` 的 step，检查对应 skill 是否已存在于 `.claude/skills/<n>/`（项目级）或 `~/.claude/skills/<n>/`（personal 级）
- `method: script` 的 step，检查 `command` 里的脚本是否存在于项目的 `scripts/` 或 skill 目录下

不存在的，告诉用户路径，问要不要一起建骨架：
- 建 skill 骨架：`.claude/skills/<skill-name>/SKILL.md`（frontmatter + 空内容 + TODO）
- 建 script 骨架：`scripts/<n>.py`（或其他语言）

### 更新 CLAUDE.md

在项目根 CLAUDE.md 的 "Workflows" 小节登记这个新 workflow：名字 + intent 第一句 + 路径。

## 生成后提醒用户

> "草稿已出。进入打磨阶段——说'跑一下这个 workflow'，workflow-run 会触发；第一次跑会在思考型节点停下来和你对齐。打磨完后把那些节点的 autonomy 从 ask 改成 report，就进入稳定生产了。
>
> 跑的过程中遇到工具问题（脚本 bug、skill 不顺手）写到 issues.md；流程问题（step 顺序、字段不够）写到 workflow-issues.md。"

## 需要警惕的模式

- **不要把所有细节都问清楚才开始写**。采访目的是骨架，不是成品。细节留给打磨阶段。
- **不要在 workflow YAML 里塞原理解释、注释、附加说明**。这些放 `decisions.md` 里。YAML 要干净。
- **不要生成 schema 之外的字段**（status / retry / error_handling 等）——这些不该在 workflow 层处理。
- **不要把项目私有 skill 放到裸 `skills/` 下**。必须放在 `.claude/skills/<n>/`（Claude Code 硬性规定）。
- **不要默认所有 fan-out 都用 units**。先问"是否需要局部修改"——不需要就让脚本内部循环，framework 不看见。
- **不要主动给所有长任务加 dispatch: subagent**。采访阶段除非用户明确说，否则默认 inline，让打磨过程发现需要的地方。
