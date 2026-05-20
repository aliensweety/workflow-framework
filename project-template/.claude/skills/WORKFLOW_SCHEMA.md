# Workflow Schema

框架的**运行时规范**。四个 skill(compose/run/revise/debrief)都引用它。

**位置**:项目级 `<project>/.claude/skills/WORKFLOW_SCHEMA.md`,各 SKILL.md 通过相对路径 `../WORKFLOW_SCHEMA.md` 引用。

要理解"为什么这么设计",读框架根目录的 `FRAMEWORK.md`。本文档只讲"字段怎么用"。

本框架有四类文件:

| 类型 | 位置 | 角色 |
|---|---|---|
| 流程图 | `workflows/flow.yaml` | 拓扑结构。谁连谁、哪里分叉、哪里聚合。 |
| 节点池 | `workflows/steps/<step_id>.yaml` | 每个 step 的独立定义文件。 |
| 进度 | `runs/<run_id>/manifest.yaml` | 这次跑到哪了、走了哪条路径。 |
| 笔记 | `workflows/notes/<step_id>.md` | 单步扩展信息。 |

---

## 0. 核心原则速记(来自 FRAMEWORK.md)

- **flow.yaml 纯程序性**:branch.on 只接 step id,所有判断在节点内部完成
- **落地是真相,种子是兜底**:有 `command` 直接跑,没 `command` 或跑不通才回 `description`
- **渐进披露**:`steps/<id>.yaml` 只在 run 跑到该 step 时加载;`notes` 在异常路径才打开
- **能写死就写死**;**自主判断不是免费的**
- **聚合是自然语义**:`branch` / `parallel` 块结束后下一个 step 自动等

---

## 1. flow.yaml(流程图骨架)

### 顶层字段

```yaml
name: <string>                    # 必填,workflow 唯一标识
description: |                    # 必填,整个工作流的种子
  目的、核心价值、风格约束、产出形态。

variables:                        # 可选,工作流级变量
  <key>: <value>                  # 在 command 里用 {vars.<key>} 引用

manifest_template:                # 可选,如果有 fan-out 步骤就声明小表骨架
  unit_type: <string>             # units 在本工作流叫什么(segment/scene/chapter)
  unit_fields: [<list of strings>]

flow:                             # 必填,拓扑结构(flow_element 列表)
  - <flow_element>
  - <flow_element>
  - ...
```

### 1.1 拓扑的递归定义

**`flow_element` 有三种形态**:

```
flow_element :=
    | <step_id>               # 字符串,引用 steps/<step_id>.yaml
    | branch_block            # condition 分支
    | parallel_block          # parallel 分支
```

**`branch_block`**:

```yaml
branch:
  on: <step_id>               # 引用哪个 step 的产出做路由
  routes:
    <label>: [<flow_element>, <flow_element>, ...]    # 这条路径上的元素序列
    <label>: [<flow_element>, ...]
```

**`parallel_block`**:

```yaml
parallel:
  - [<flow_element>, <flow_element>, ...]    # 一条线(顺序执行)
  - [<flow_element>, ...]                    # 另一条线
```

**关键**:`flow_element` 是递归的——`branch.routes` 的列表和 `parallel.parallel` 的每条线,都接受任何形态的 flow_element。**没有"只能放 step id"的限制,没有"只能嵌一层"的限制**。

### 1.2 拓扑示例

#### 线性

```yaml
flow:
  - write_script
  - voiceover
  - publish
```

#### 单层 condition 分支

```yaml
flow:
  - judge
  - branch:
      on: judge
      routes:
        deep: [research, write_script]
        light: [write_script]
  - voiceover                     # 自动聚合
```

#### 单层 parallel 分支(每条线一个 step)

```yaml
flow:
  - script_done
  - parallel:
      - [generate_images]         # 一条线只有一个 step,也要用列表表达
      - [generate_audio]
  - assemble                      # 自动聚合
```

#### parallel 分支,每条线多步

```yaml
flow:
  - write_script
  - parallel:
      - [voiceover, transcribe, correct_subtitles]   # 配音线:三步串行
      - [plan_images, generate_images]               # 配图线:两步串行
  - assemble_video                                   # 自动聚合,等两条线都完成
```

#### 嵌套:parallel 线里嵌 parallel

```yaml
flow:
  - write_script
  - parallel:
      - [voiceover, transcribe, correct_subtitles]
      - - plan_images
        - parallel:                                   # 配图线内部又分
            - [generate_chars]
            - [generate_scenes]
        - merge_images
  - assemble_video
```

注意 yaml 缩进——`- - plan_images` 表示这条线是一个列表,列表第一项是 step,第二项是嵌套的 parallel 块。

#### 嵌套:parallel 线里嵌 branch

```yaml
flow:
  - write_script
  - parallel:
      - [voiceover, transcribe, correct_subtitles]
      - - plan_images
        - branch:
            on: plan_images
            routes:
              cartoon: [generate_grok]
              realistic: [generate_gemini]
        - postprocess
  - assemble_video
```

#### 嵌套:branch 路径里嵌 parallel

```yaml
flow:
  - judge
  - branch:
      on: judge
      routes:
        full:
          - research
          - parallel:
              - [generate_images, postprocess]
              - [voiceover, transcribe]
        light:
          - write_only
  - assemble
```

### 1.3 condition 分支的判断机制

被 `branch.on` 引用的 step 的产出必须包含一个**路由标签**(通常是 `{step.dir}/routing.txt`,内容是 routes 里的某个 key)。

Claude Code 读这个产出,匹配 routes 的 key,选择路径。

**没有表达式语言**——judge 节点的脚本自己负责输出明确的字符串作为 label。如果路由逻辑复杂,放进 judge 节点的脚本里实现,不暴露到 flow.yaml。

匹配失败处理:routing.txt 内容不在 routes 的 key 里,run 时停下报错,**不猜路径**。

### 1.4 parallel 块对节点的要求

`parallel` 块里某条线的**第一个执行单元**必须能真并行——意味着:

- 是个 step id,且对应的 step 有 `command`(纯脚本,主会话开多进程)
- 是个 step id,且对应的 step 有 `dispatch: subagent`
- 是个嵌套 branch / parallel 块——内部最终也要满足上述条件

**在主会话直接靠 LLM 推理的 step 不能并行**(LLM 推理本质单线程)。

compose 写出来后 / run 启动时都要校验这条。

### 1.5 聚合规则

`branch` / `parallel` 块**结束后**的下一个 flow_element 就是聚合点。run 等块内已走过的路径完成才继续:

- `parallel` 块后 → 等块内**所有**路径完成
- `branch` 块后 → 等块内**被选中的那条**路径完成(其他路径标 skipped,自然不参与等)

**不需要 `after:` / `depends_on:` 字段**——聚合语义内嵌在 yaml 结构里。

---

## 2. steps/<step_id>.yaml(节点定义)

每个 step 一个独立 yaml 文件,文件名 = step id。

### 完整字段

```yaml
id: <string>                      # 必填,蛇形命名,等于文件名(去扩展名)
description: |                    # 必填,本步骤的种子
  业务逻辑——做什么、从哪取输入、产出什么、为什么存在

command: <string | list>          # 可选,确定性执行指令(详见下文)
consumes: <string>                # 可选,输入路径或字段
produces: <string>                # 可选,输出形态(单份 / 多份 / unit 字段)
dispatch: subagent                # 可选,默认 inline
notes: <path>                     # 可选,指向 workflows/notes/<step_id>.md
```

### 字段语义

#### `id`(必填)

文件名去扩展名 = id。例如 `steps/judge.yaml` 里 `id: judge`。

#### `description`(必填)

**这一步的种子**。业务逻辑:做什么、从哪取输入、产出什么、为什么存在。

平时帮 Claude Code 理解流程意义;command 跑不通时,回它重新生成执行方式。

不要在这里写"打磨经验、坑、出错怎么办"——那些进 sidecar 笔记。

#### `command`(可选)

**确定性的执行指令**。能写死就写死。

**支持三种形态**:

**单行字符串**:

```yaml
command: "python scripts/grok_image.py --prompt '{unit.prompt}' --out {step.dir}/img_{unit.id}.png"
```

**多行字符串**(用 yaml 的 `|`):

```yaml
command: |
  # 提交配音任务
  python scripts/runninghub_tts.py submit --text {run.dir}/write_script_grok/script.md --out {step.dir}/task_id.txt
  # 轮询获取配音结果
  python scripts/runninghub_tts.py fetch --task-id {step.dir}/task_id.txt --out {step.dir}/voice.mp3
```

**字符串列表**:

```yaml
command:
  - "# 提交配音任务"
  - "python scripts/runninghub_tts.py submit --text {run.dir}/write_script_grok/script.md --out {step.dir}/task_id.txt"
  - "# 轮询获取配音结果"
  - "python scripts/runninghub_tts.py fetch --task-id {step.dir}/task_id.txt --out {step.dir}/voice.mp3"
```

**注释规则**:多行/列表形式下,以 `#` 开头的行(去掉前导空白后)视为注释,run 时**跳过执行**,只渲染给人看(包括 viz)。

注释的用途是给具体某条命令加微说明——例如"这一行是提交任务"、"这一行是轮询获取"。注释不替代 `description`(节点种子);它只是 shell 风格的内联注释,作用域只是这一条命令。

**执行规则**:

- 多条命令按列表/行顺序串行执行,每条独立子进程,共享同一 step.dir 工作目录
- 任一条非注释行失败 → 整个 step 失败,走异常路径
- 所有非注释行都成功 → step 标 done

**何时该用多条命令**(典型场景):

- 异步任务的"提交 → 轮询/获取"两阶段(配音、视频生成、长 research)
- 同一步内多个独立子任务,但逻辑上是同一件事(不值得拆成多个 step)
- 准备数据 + 主操作 + 简单清理

**何时不该用多条命令**:

- 几个独立步骤被强行塞进一个 command —— 拆成多个 step,让 flow 表达拓扑
- 用复杂 shell 控制流(if / for / pipe 一长串)—— 这种逻辑应该下沉到一个脚本里,command 只调那个脚本

有 command → run 直接跑,不判断。
没 command → run 按 description 自主决定怎么做。

#### `consumes` / `produces`(可选)

输入和输出。值可以是字面路径、变量插值、unit 字段名。

```yaml
# 单份产出
produces: "{step.dir}/script.md"

# 多份产出(小表会自然展开 units)
produces: "manifest.units"

# 写入 unit 的某个字段
produces: "unit.image"

# condition 分支的判断点要在 produces 写明路由文件
produces: "{step.dir}/routing.txt"
```

#### `dispatch`(可选)

派发方式。默认 `inline`——在主会话里直接跑。

写 `dispatch: subagent` 表示:**派给 sub-agent 隔离上下文跑、回报摘要给主会话**。适用场景:
- 长任务(轮询、等外部任务)
- 输出量大但只需要最终结果(research、log 分析)
- 会污染主会话上下文(大量 stdout / 长文档)
- **被 `parallel` 块引用且没有纯 command 的 step**——真并行需要 subagent

主会话仍然阻塞等待 sub-agent 返回。dispatch 不引入并行调度,只引入上下文隔离;真并行靠 `parallel` 块。

**派发 subagent 时的指令规范**(workflow-run 必须遵守):派给 sub-agent 的指令必须完整、自包含、严格界定边界,防止 sub-agent 在项目里东张西望读不相关文件。详见 workflow-run/SKILL.md 的"subagent 派发指令模板"节。

#### `notes`(可选,sidecar)

指向 `workflows/notes/<step_id>.md` 的路径。run 在正常路径下不读;触发条件:

- command 跑不通
- 没有 command,需要从 description 生成执行方式
- 编排修改时想看本步骤的历史决策
- workflow-debrief 复盘时

文件内部结构自由 markdown,建议但不强制分段:出错时 / 业务逻辑详述 / 经验与坑 / 历史决策 / 示例反例。

### 变量占位符

可在 `command` / `consumes` / `produces` 里使用:

| 占位符 | 含义 |
|---|---|
| `{run.dir}` | 当前 run 的目录 |
| `{run.id}` | 当前 run id |
| `{step.dir}` | 当前 step 的产出子目录,等于 `{run.dir}/<step_id>/` |
| `{unit.id}` | 当前 unit 的 id(多份产出场景) |
| `{unit.<field>}` | 当前 unit 的某个字段(多份产出场景) |
| `{vars.<key>}` | flow.yaml 的 variables 字段定义的工作流级变量 |

---

## 3. 最小例子

文件结构:

```
workflows/
├── flow.yaml
└── steps/
    ├── write_script.yaml
    ├── judge.yaml
    ├── research.yaml
    ├── voiceover.yaml
    ├── transcribe.yaml
    ├── correct_subtitles.yaml
    ├── plan_images.yaml
    ├── generate_images.yaml
    └── assemble.yaml
```

`flow.yaml`(展示线性 + branch + 多步 parallel 的组合):

```yaml
name: economy-video
description: |
  经济学短视频生产。一个选题文件 → 文案 → 配音线 + 配图线 → 合成。
  核心价值在于文案的洞察密度。

variables:
  topic_file: prompts/topic.md

manifest_template:
  unit_type: scene
  unit_fields: [text, prompt, image]

flow:
  - judge
  - branch:
      on: judge
      routes:
        deep: [research, write_script]
        light: [write_script]
  - parallel:
      - [voiceover, transcribe, correct_subtitles]
      - [plan_images, generate_images]
  - assemble
```

`steps/judge.yaml`:

```yaml
id: judge
description: |
  判断本期是否需要深度研究。
  根据 topic 的论述密度决定。
  输出 'deep' 或 'light' 到 routing.txt 作为下游路由。
command: "python scripts/judge.py --topic {vars.topic_file} --out {step.dir}/routing.txt"
produces: "{step.dir}/routing.txt"
```

`steps/voiceover.yaml`(展示多条 command):

```yaml
id: voiceover
description: 用配音 skill 把文案转成音频。提交任务 → 轮询获取结果。
command:
  - "# 提交配音任务"
  - "python scripts/runninghub_tts.py submit --text {run.dir}/write_script/script.md --out {step.dir}/task_id.txt"
  - "# 轮询获取配音结果"
  - "python scripts/runninghub_tts.py fetch --task-id {step.dir}/task_id.txt --out {step.dir}/voice.mp3"
consumes: "{run.dir}/write_script/script.md"
produces: "{step.dir}/voice.mp3"
dispatch: subagent
```

`steps/generate_images.yaml`(fan-out 后续 step):

```yaml
id: generate_images
description: 对每个 scene 调用 Grok 生图,存到 unit.image
command: "python scripts/grok_image.py --prompt '{unit.prompt}' --out {step.dir}/img_{unit.id}.png"
consumes: unit.prompt
produces: unit.image
dispatch: subagent
```

注意 `generate_images` 同时是:
- parallel 块"配图线"的一员
- fan-out 后续 step(对每个 unit 跑一次)
- dispatch: subagent(因为在 parallel 块里,需要真并行)

三件事正交,组合使用。

---

## 4. manifest.yaml(小表)

一次运行的状态文件。框架硬约束以下字段;其余由 flow 自定义。

### 字段

```yaml
run_id: <string>                  # 必填,运行唯一标识
instance: <string>                # 必填,本次运行的实例名
created_at: <ISO timestamp>       # 必填
status: <in_progress | done | paused>
current_step: <step_id>           # 必填,当前/上次停在哪一步

run_vars:                         # 本次运行覆盖的变量(可选)
  <key>: <value>

steps_status:                     # 每个 step 的状态(扁平结构,不管 step 在多少层嵌套里)
  <step_id>: <pending | done | stale | running | skipped>

taken_routes:                     # condition 分支的实际路由记录
  <branch_on_step>: <chosen_label>   # 例: judge: deep

units:                            # 仅当某步产出多份时填充
  - id: <string>
    status: <pending | done | stale>
    <field1>: <value>
```

### 状态语义

- `pending`:还没跑,会跑
- `running`:正在跑
- `done`:跑完了
- `stale`:之前跑过但因为上游变了需要重跑
- `skipped`:condition 分支没选中这条路径,**永远不会跑**

### taken_routes

记录 condition 分支的实际选择。key 是 branch 块 `on:` 引用的 step id,value 是选中的 label。

**嵌套 branch**:每个 branch 不管嵌在多少层,都用它的 `on:` 字段作为 key。如果有两个 branch 引用同一个 step 做路由(罕见,不推荐),用 `<on_step>:<context>` 形式区分。

### stale 传播规则(DAG 递归)

当用户说"unit X 的字段 Y 有问题"或"step Z 不对":

1. Claude Code 读 manifest + flow.yaml + 相关 steps/*.yaml,识别 DAG 中哪些 step 是被改 step 的**下游传递闭包**
2. 推断算法是**递归遍历 flow 树**:
   - 从被改 step 出发,在 flow 树中找到它的位置
   - 沿树向后(列表中下一个、父块结束后下一个)追
   - 遇到 branch 块:**只追 taken_routes 选中的那条路径**,其他路径不动
   - 遇到 parallel 块:**所有路径都要追**(因为它们都跑了)
   - 块结束后的聚合点必然在下游
3. 标 stale;多份产出场景下只标受影响的 unit
4. 改 manifest.status 回 in_progress

---

## 5. 项目目录约定

```
my-project/
├── CLAUDE.md                      # 项目指导(运行时读)
├── decisions.md                   # 项目自述+心法(迭代时读)
├── process-findings.md
├── workflows/
│   ├── flow.yaml
│   ├── steps/
│   │   ├── <step_id_1>.yaml
│   │   └── <step_id_2>.yaml
│   ├── notes/
│   │   ├── <step_id_1>.md
│   │   └── <step_id_2>.md
│   └── viz/                       # 可选,可视化面板(独立工具)
├── scripts/
│   └── <name>.py
├── runs/
│   └── <run_id>/
│       ├── manifest.yaml
│       ├── <step_id_1>/           # 按 step 自然组织
│       │   └── <产出物>
│       ├── <step_id_2>/
│       │   └── <产出物>
│       └── ...
└── .claude/
    └── skills/
        ├── WORKFLOW_SCHEMA.md
        ├── workflow-compose/
        ├── workflow-run/
        ├── workflow-revise/
        ├── workflow-debrief/
        └── <project-skill>/
```

**关键约定**:

1. 项目私有 skill 必须放在 `.claude/skills/` 下(Claude Code 硬性规定)
2. flow / steps / notes 三个目录平铺在 workflows/ 下
3. `runs/<run_id>/<step_id>/` 子目录由 run 自动创建,产出按 step 组织
