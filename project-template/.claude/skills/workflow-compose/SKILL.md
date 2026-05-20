---
name: workflow-compose
description: 通过和用户对话生成工作流的 flow.yaml 拓扑骨架 + steps/*.yaml 节点池。当用户说"做一个新工作流"、"设计一个流程"、"把这件事做成可重复的工作流"、"create a workflow"、"design a workflow for X"、或提及要把某件重复性工作固化下来时触发。自由对话直到能写出大表,不分轮、不走问卷。拓扑递归表达,parallel/branch 任意嵌套。第一版是骨架,跑起来再迭代。
---

# workflow-compose

把一个想法变成一份能跑的工作流。核心产出物是两类文件:

- `workflows/flow.yaml` — 拓扑骨架(谁连谁、哪里分叉、哪里聚合)
- `workflows/steps/<step_id>.yaml` — 每个节点一个独立文件

## 前置阅读

每次触发先读 `../WORKFLOW_SCHEMA.md`(相对本 SKILL.md)——它给出:

- `flow_element` 的递归定义(step / branch / parallel)
- branch 和 parallel 块的语法
- parallel 块对节点的要求(必须能真并行)
- 节点字段语义
- 占位符约定

**特别注意 schema 里 §1.1 拓扑的递归定义** 那一节——这是表达力的核心。任何位置都接受任何 flow_element,parallel 的每条线、branch 的每条 route 都可以包含 step / branch / parallel 任意组合。

也特别熟悉两条原则:

- **落地是真相,种子是兜底**——能写死成具体执行指令的就写死
- **能写死就写死**——颗粒度越细越好

---

## 对话方式

不是问卷,是对话。**自由对话直到能写出 flow + steps 为止**。

不分轮、不预设步骤数、不一口气抛十个问题。每次 1-2 个真正能推进的问题,听完回答再往下。

**让用户尽量用自然语言把流程讲一遍**——他想把它稳定下来,就会主动表达。Claude Code 的角色是听清楚,把自然语言翻译成 flow + steps。听不清就问,听清楚了就写。

---

## 需要弄清楚的事

写出文件之前,这些信息要么从对话里听到了,要么明确问出来:

1. **本质**:这个工作流要产出什么?为什么要稳定下来(重复性)?
2. **流程骨架**:
   - 有哪些步骤?什么顺序?
   - **有没有判断分支**(走 A 还是 B)?分支由什么决定?
   - **有没有并行的"线"**(同时做两件可独立推进的事)?每条线内部还有几步?
   - 各条线在哪里汇合?
3. **每一步做什么**:业务逻辑——从哪取输入、产出什么、用什么工具
4. **是否多份产出**:某一步会出"一份输入 → N 份输出"的形态吗?(决定 manifest_template)
5. **核心价值点 vs 落地执行**:哪几步是真正需要思考的?哪几步是程序性的?
6. **工作流级变量**:有没有反复要用到的路径/配置,适合提到 flow.yaml 顶部 `variables:`?

第 2 项里"线"这个概念关键——很多用户描述工作流时会说"两条并行的线",这通常意味着 `parallel` 块且**每条线是多步**。不要把它误翻译成"两个并行块串联"。

---

## 翻译成文件

### 第一步:画拓扑图(给自己看)

写代码前先在脑中画出流程图。建议在对话里发给用户一份 ASCII 拓扑图请他确认:

```
selection
   │
  judge ──→ routing.txt: deep | light
   │
   ├─── deep ──→ research ──┐
   │                         │
   └─── light ───────────────┴──→ write_script
                                       │
                  ┌────────────────────┴───────────────────┐
                  │                                         │
            voiceover                                  plan_images
                  │                                         │
            transcribe                              generate_images
                  │                                         │
        correct_subtitles                                   │
                  │                                         │
                  └────────────────┬────────────────────────┘
                              assemble_video
```

让用户认领这个图。如果图错了,改对话里讨论;如果图对了,**这个图就是后面写 yaml 时的 ground truth**。

### 第二步:写 flow.yaml

对照拓扑图写 `workflows/flow.yaml` 的 `flow:` 列表。**flow 只放拓扑结构,不放 step 细节**。

```yaml
name: <项目名/工作流名>
description: |
  一段密度高的自然语言(目的、核心价值、风格约束、产出形态)

variables:
  <key>: <value>

manifest_template:
  unit_type: <segment/scene/chapter/...>
  unit_fields: [<list>]

flow:
  - <step_id>                       # 线性
  - branch:                         # condition 分支
      on: <step_id>
      routes:
        <label>: [<flow_element>, ...]
        <label>: [<flow_element>, ...]
  - parallel:                       # parallel 分支
      - [<flow_element>, ...]       # 一条线
      - [<flow_element>, ...]       # 另一条线
  - <聚合后的 step_id>
```

**关键提醒——parallel 的每条线是 list,不是 step id**:

错误写法(把两条多步线拆成两个并行块串联):

```yaml
flow:
  - parallel:
      - voiceover                   # ❌ 单独 step 不是一条线
      - plan_images
  - parallel:
      - transcribe                  # ❌ 串接两个并行块,聚合语义错了
      - generate_images
  - correct_subtitles
  - assemble
```

这样的语义是:第 1 个 parallel 块结束后等 voiceover 和 plan_images **都完成**才进第 2 个 parallel,把"两条独立线"强制成"必须同步前进"。

正确写法(每条线是一个 list):

```yaml
flow:
  - parallel:
      - [voiceover, transcribe, correct_subtitles]   # 配音线整体作为一条
      - [plan_images, generate_images]               # 配图线整体作为一条
  - assemble
```

**配图线短可以先跑完,配音线慢慢跑,assemble 等两条都完成**——这才是真正的"两条并行线"。

#### 嵌套也用同一套规则

parallel 线里要嵌套 parallel 或 branch?直接放进 list 里:

```yaml
flow:
  - parallel:
      - [voiceover, transcribe, correct_subtitles]
      - - plan_images
        - parallel:
            - [generate_chars]
            - [generate_scenes]
        - merge_images
  - assemble
```

yaml 缩进表达"这条线是个 list,里面第一项是 step,第二项是嵌套 parallel,第三项又是 step"。

**branch 嵌进 parallel 线、parallel 嵌进 branch 路径** 同样自然——所有位置都接受任何 flow_element。

#### parallel 校验

对每条 parallel 线的**第一个执行单元**校验:
- 是 step id → 对应的 step 必须有 `command`(纯脚本)或 `dispatch: subagent`
- 是嵌套 branch / parallel → 内部第一个最终的 step 也要满足

如果遇到违反的(某 step 是 LLM 推理为主、又被 parallel 引用),要么改成有 command 的纯脚本、要么加 dispatch: subagent。**写文件时就拦住,不要让 run 时再炸**。

### 第三步:写 steps/<step_id>.yaml

flow 骨架定下来后,对照 `flow:` 里出现的每个 step id,在 `workflows/steps/<step_id>.yaml` 写节点定义。

每个文件的写法:

```yaml
id: <和文件名一致>
description: |
  业务逻辑——做什么、从哪取输入、产出什么、为什么存在
command: ...               # 可选,能写死就写死
consumes: ...              # 可选
produces: ...              # 可选
dispatch: subagent         # 可选,仅在需要时写
notes: ...                 # 可选,第一版通常不写
```

#### `description` 写法

- 思考型步骤:多说几句,包括风格指引、判断标准
- 执行型步骤:一句话说明业务含义即可,重头是 command

#### `command` 判断

**这一步重复跑会不会得到一样的结果?**
- 会(调 API、跑脚本、确定性转换)→ 写 command,带占位符
- 不会(写文案、做美学判断)→ 留空,让 run 按 description 决定

**输出路径首选 `{step.dir}/...`**(等于 `{run.dir}/<step_id>/`)。run 自动建子目录,产出按 step 组织。

#### `dispatch` 判断

- 长任务、大输出量、污染主会话 → `dispatch: subagent`
- **被 parallel 块引用且无纯 command** → 必须 `dispatch: subagent`,否则并行是假的
- 短任务、输出量小 → 不写(默认 inline)

**不让用户决定 dispatch**——你判断写不写,写完告诉用户做了这个决定让他确认。

#### `produces` 决定 fan-out 形态

- `produces: "{step.dir}/..."` → 单份产出
- `produces: "manifest.units"` → fan-out 起点
- `produces: "unit.<field>"` → fan-out 后续 step:对每个 unit 跑一次

**fan-out 可以和 parallel 自由组合**:某个 step 同时是 parallel 块"配图线"的一员、又是 fan-out 后续 step、又是 subagent 调度——三件事正交,组合使用没限制。

#### condition 分支判断点的写法

被 `branch.on` 引用的 step,它的 `produces` 必须明确包含一个**路由标签文件**:

```yaml
id: judge
description: |
  判断本期题材是寓言还是童话。输出 'fable' 或 'fairy_tale' 到 routing.txt。
command: "python scripts/judge.py --in {vars.topic_file} --out {step.dir}/routing.txt"
produces: "{step.dir}/routing.txt"
```

`routing.txt` 内容必须与 flow.yaml 里 routes 的 key 完全匹配。

**不在 flow.yaml 里写表达式语言**——所有"判断逻辑"在 judge 节点内部完成。

---

## 自检:拓扑图和 yaml 是否一致

写完 flow.yaml 后做一次自检:

> 我画的拓扑图里**每条分叉、每个汇合点**,在 yaml 里都对应得上吗?

特别检查:
- 拓扑图里"两条独立线" → yaml 里是不是写成了一个 `parallel` 块,且每条线是 list?(不是两个 parallel 串联)
- 拓扑图里某条线有多个步骤 → yaml 里这条线是不是一个 list,所有步骤都在里面?
- 拓扑图里 branch 之后两条路径不同长度 → yaml 里两条 route 的 list 长度是不是不同?
- 拓扑图里有嵌套(parallel 里又有 parallel 或 branch) → yaml 里有对应的嵌套结构?

如果图和 yaml 对不上,**几乎一定是 yaml 写错了**——你脑子里的图是对的,但翻译时退化了。回头改 yaml。

---

## 识别需要新建的 skill / script

写完 steps/*.yaml,扫一遍每个 step 的 command:

- 引用的脚本是否存在于项目的 `scripts/` 或 skill 目录下
- 提及但未明确路径的工具,问用户:"这一步你打算怎么跑?已经有脚本/skill 吗?"

不存在的,告诉用户路径,问要不要一起建骨架。

---

## 写完之后给用户的提醒

> 工作流骨架就位:
> - `workflows/flow.yaml`(流程图)
> - `workflows/steps/`(N 个节点定义)
>
> 我已画的拓扑图:[贴一份]
>
> 下一步:说"跑一下"或具体描述这次要做什么,workflow-run 会触发。
>
> 跑过程中遇到不对的地方:
> - flow 拓扑写错了 → 直接改 flow.yaml
> - 某个 step 的 description/command 不对 → 改对应的 steps/<id>.yaml
> - 某一步偶尔会踩的坑、经验性的判断 → 跑出来再写进 `workflows/notes/<step_id>.md`
> - 流程整体不顺、框架问题 → 记到 `process-findings.md`
>
> 跑完后想沉淀实战经验,说"复盘一下",workflow-debrief 会触发。

---

## 需要警惕的模式

- **不要走问卷**。自由对话。
- **不要问机制层概念**:不问"要不要 units / subagent / ask"——这些是抽象泄漏。
- **不要把 parallel 多步线写成两个 parallel 块串联**——这是当前最容易翻车的点。一条"线"是 list,放进 parallel 的一个元素位。
- **不要在 flow.yaml 里写 step 字段**——flow 只承载拓扑,字段全在 steps/*.yaml。
- **不要把所有 step 写进一个文件**。每个 step 必须独立 yaml,这是渐进披露的基础。
- **不要在 flow.yaml 写表达式语言**——judge 节点产出路由标签,大表只匹配 label。
- **不要塞原理解释或长注释**。flow 和 step 文件要干净。
- **不要生成 schema 之外的字段**。
- **不要把项目私有 skill 放到裸 `skills/` 下**。必须 `.claude/skills/<name>/`。
- **不要追求一次写完所有 notes**。第一版只编排 flow + steps,notes 等跑过有踩坑再回头写。
- **不要为了"灵活"留判断空间**。能写死成 command 的就写死。
- **不要让 parallel 块里的线"第一个执行单元"无法真并行**——写到这一步反查,如果出现就修复。
- **写完后必须做"图 vs yaml"自检**——发现不一致改 yaml。
