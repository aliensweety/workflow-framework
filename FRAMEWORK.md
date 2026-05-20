# FRAMEWORK

整个框架的 DNA——核心理念、关键机制、边界、演化哲学。

**不在运行时默认加载**。给人读、给 Claude Code 在做架构决策前按需读。

每次想给框架加字段、加规则、加机制之前,先读这份。

---

## 这个框架是什么

一个 Claude Code 驱动的工作流框架。让"稳定可重复的生产流程"能被 Claude Code 用自然语言搭建、运行、修改。

它在光谱上的位置:N8N 的可重复执行能力 + DAG 表达力 + Claude Code 的自然语言灵活性。

## 为什么非要这个框架

Claude Code 用 skill 或纯对话就能"做一连串事情"。这个框架真正的价值不是把步骤串起来——**是把每次执行变成可持久化、可观察、可局部修改的实例**,并且**让 Claude Code 只管编排和运行,业务逻辑完全下沉到节点**。

具体说,框架要解决这些问题:

- 跑到一半中断了,下次 resume 继续
- 跑完一周后回来说"第 3 段改一下",能定位并只重跑受影响部分
- 同一个流程跑过 10 次,每次的产出和中间态都在 `runs/` 里留着,可对比可回溯
- 同一份模板可以对不同选题重复生产(模板和实例分离)
- **流程不是一根直线**——有判断分支、有并行、有汇合,而且这些可以任意嵌套

不需要这些能力的场景(一次性、跑完即扔),用 skill 或直接对话更简单。

---

## 核心隐喻:Flow / Steps / Runs / Notes

理解这套架构只需要四类文件:

| 概念 | 文件 | 角色 |
|---|---|---|
| 流程图 | `workflows/flow.yaml` | 拓扑——谁连谁、哪里分叉、哪里聚合。极薄。 |
| 节点池 | `workflows/steps/<step_id>.yaml` | 每个 step 的定义,独立文件。按需加载。 |
| 进度 | `runs/<run_id>/manifest.yaml` | 这次跑到哪了、走了哪条路径。 |
| 笔记 | `workflows/notes/<step_id>.md` | 单步的扩展信息。按需创建,平时不读。 |

**为什么拆成 flow + steps 而不是一份大表:**
- 拓扑结构(树形/图)和节点内容(平铺字段)是两种不同的信息形态,强行塞一个文件相互拉扯
- 拓扑用 yaml 嵌套块表达——缩进就是树深,视觉自然
- 节点独立成文件——编辑某步不被旁边干扰,跨项目复用直接拷文件,变体替换改 flow.yaml 一行就行
- Claude Code 启动只加载 flow.yaml(极小)+ manifest.yaml(小),具体 step 跑到再读

---

## 核心原则一:flow.yaml 纯程序性,运行时不依赖 LLM

**flow.yaml 的拓扑结构是纯程序性的**——所有判断在节点内部完成,大表只做 step 编排和 label 匹配。

具体含义:
- `branch.on` 只接 step id 不接表达式语言
- judge 节点的脚本/逻辑输出明确字符串作为 label,branch 只做字符串匹配
- 没有"需要 LLM 介入才能决定走哪条"的运行时决策

**为什么这一条不能妥协:**

1. **稳定性**:大表运行行为完全确定。同一份 manifest + flow + step 产出,每次跑结果一样。
2. **可转译性**:未来可以原样翻译成 n8n、Airflow 这类程序性 DAG 引擎。在 flow.yaml 加表达式语言或 LLM 判断会破坏这条。
3. **责任分离**:Claude Code 在 run 时的"自主能力"只在**异常路径**介入,正常路径上整套流程是确定性的。

**业务逻辑下沉到节点**:节点内部用什么——脚本、外部 API、skill、subagent 里嵌 LLM 推理——都行。只要节点对外的契约是确定的(读什么输入、产出什么、输出何种 label)。

---

## 核心原则二:落地是真相,种子是兜底

**每个 step 暴露两层信息:**

- **种子(`description` 字段)**:业务逻辑——这一步做什么、从哪取输入、产出什么、为什么存在。永远暴露。
- **落地(`command` 字段)**:确定性的执行指令,带占位符。可选。

**运行时行为:**

- 有 `command` → 直接按 command 跑。不判断、不思考、不解释。
- 没 `command`,或 command 跑不通 → 回到 `description` 重新理解,生成执行方式。
- step 失败、或编排时想改、或回溯历史决策 → 打开 `notes` sidecar 文件读扩展信息。

**为什么这样设计:**

判断本身就是不稳定性来源。能写死的就写死——写死的内容是稳定执行真相,每次跑都得到一样结果。Claude Code 的自主判断能力是**异常路径**才介入的,不是正常路径的默认行为。

**颗粒度原则**:编排时越具体越好。一个 step 是脚本 + 占位符能搞定的,就只写脚本 + 占位符。description 写得清晰是为了**出错时还有路可走**,不是为了正常路径反复重判。

---

## 核心原则三:渐进披露作为架构哲学

Claude Code 自己的 skill 系统就是渐进披露的——frontmatter 永远加载,SKILL.md 触发时加载,bundled 资源按需加载。这个框架沿用同一架构。

**四类信息按"是否进入正常路径上下文"分层:**

| 层 | 内容 | 加载时机 |
|---|---|---|
| 常驻 | flow.yaml(流程图骨架) | run 启动时加载,正常路径全程在上下文里 |
| 常驻 | manifest.yaml(进度) | run 启动时加载,每跑完一份产出更新 |
| 按需 | steps/<step_id>.yaml | run 跑到该 step 时才 Read 加载 |
| 按需 | notes/<step_id>.md | 异常路径或编排修改时才打开 |

**注意**:steps/ 文件是按需加载的——即便定义了 20 个 step,正常 run 一遍只加载实际走过的那些。**变体不会污染上下文**:同一个项目可以同时存在 `visualize-img.yaml` 和 `visualize-video.yaml`,flow.yaml 引用哪个就只加载哪个。

**notes sidecar 触发条件**(三选一):
- command 跑不通
- 没有 command、需要从 description 生成执行方式
- 编排修改时想看这一步的历史决策

**为什么必须是独立文件,不是字段的"约定不读":**

LLM 的注意力机制不存在"读进上下文但不看"。任何写进同一文件的内容,模型每一轮都会处理。所谓"约定不读"在原理上不成立——只有**文件没被 Read 工具打开**,内容才真的没进上下文。

---

## 核心原则四:自主判断不是免费的

"让 Claude Code 自主判断"听起来优雅,但每一次"自主"都意味着:
- 重新读上下文做判断 → 消耗注意力
- 不同会话可能得到不同答案 → 不稳定性
- 用户/CC 都不知道何时该触发 → 容易被略过

**判断标准:**

- 判断结果在不同时间不同会话会变化 → 让 Claude Code 自主,是对的。
- 判断结果永远相同(dispatch 派不派 subagent、产出放哪个目录) → 写死成字段。

**这条原则来自实战教训。** 早期版本取消了 dispatch 字段、让 CC 自主决定派不派 subagent,结果实跑发现 CC 根本不会主动派——因为没有触发信号。同理,自主决定输出文件夹结构、自主决定何时复盘,全都不会自发发生。

每次准备取消一个字段之前,问一句:**这件事的判断,在不同情境会不会得到不同答案?** 不会 → 留字段,不要"让它自主"。

---

## flow.yaml 的拓扑表达:递归定义

拓扑用 yaml 嵌套块表达。**结构是递归的**——任何位置都接受任何元素。

```
flow_element :=
    | step_id                        # 一个 step
    | branch_block                   # condition 分支
    | parallel_block                 # parallel 分支

branch_block :=
    branch:
      on: <step_id>
      routes:
        <label>: [<flow_element>, <flow_element>, ...]
        <label>: [<flow_element>, ...]

parallel_block :=
    parallel:
      - [<flow_element>, <flow_element>, ...]     # 一条线
      - [<flow_element>, ...]                     # 另一条线

flow:
  - <flow_element>
  - <flow_element>
  - ...
```

**关键性质**:`flow_element` 是递归的。`parallel` 块里的每条线是 `flow_element` 列表,列表里每个元素又可以是 step / branch / parallel,任意嵌套。`branch` 的 routes 同理。

这一条让框架对任何复杂拓扑都有表达力,**且不需要任何特例**。

---

## 聚合是自然语义,不是字段

`branch` / `parallel` 块**结束后**的下一个 step 就是聚合点。Claude Code 等块内所有走过的路径完成再继续。**不需要 `after:` / `depends_on:` 字段。**

```yaml
flow:
  - A
  - parallel:
      - [B]
      - [C]
  - D            # D 自动等 B 和 C
```

```yaml
flow:
  - A
  - branch:
      on: A
      routes:
        x: [B]
        y: [C]
  - D            # D 等被选中的那条路径完成(B 或 C 二选一)
```

嵌套场景同样自然——内层 block 结束后回到外层路径,外层路径完成后回到再外层。整个语义靠 yaml 嵌套结构本身承载。

---

## 取消的旧概念(每一项的理由)

| 旧概念 | 取消理由 |
|---|---|
| `autonomy: auto/report/ask` 三档 | 不需要预先声明节奏。**只有两种状态:正常路径继续 / 出错停下**。 |
| `method: claude-code/skill/script` 三种 | 三种之间有大量重叠。怎么做就在 description / command 里写,类型标签是抽象泄漏。 |
| `iterates_over: units` | 从 produces 写"多份/unit 字段"就能识别,不需要独立字段。 |
| `parallelism: N` | 由 Claude Code 在 run 时根据脚本能力和资源约束自主判断。 |
| "打磨期 / 稳定期" 二阶段叙事 | 这只是"遇到问题就解决"的循环描述。 |
| compose 的"采访分轮"结构 | 自由对话直到能写大表,不分轮。 |
| compose 问"用不用 units / 要不要局部修改能力" | 抽象泄漏——把机制内部决定暴露成用户决定。 |
| 单文件大表 | 拓扑和节点内容塞一个文件互相拉扯。 |
| parallel 路径限制单 step | **递归定义后取消此限制**。任何位置接受任何 flow_element。 |

---

## 三条不可妥协的核心价值

### 1. Claude Code 是主语,不是被规范的对象

框架存在是为了**让 Claude Code 跑得更顺**,不是为了**约束 Claude Code 的行为**。

每加一条规则前问:"Claude Code 自己能做到吗?"——能,就不要写。

### 2. 落地优先于自然语言,种子兜底

正常路径上,**写死的指令是真相**。自然语言的 description 是种子,平时帮 Claude Code 理解流程意义,异常时回去重生成落地。

### 3. 程序的归程序,思考的归思考

能用脚本确定性完成的事,不要拿到 Claude Code 的注意力里消耗 token。能用自然语言指引的事,不要硬写成代码。

判断标准:**这件事重复跑会不会得到一样的结果?** 会 → 脚本(写进 command);不会 → 思考(留在 description)。

---

## 文档角色

每个工作流项目里有两份不同性质的 md:

### CLAUDE.md = 指导文档
- Claude Code 每次启动会读
- 简洁、执行性强、"该做什么"
- 内容:项目结构、入口点、反馈通路

### decisions.md = 自述文档 + 心法
- 平时不读,只在迭代、回头反思、判断"这次改动是否真的让项目变好"时读
- 内容:项目是什么、要成为什么、哲学边界、长期取舍、历史决策
- 顶部置心法(每个新项目从模板继承)

两者必须分开。塞在一起会互相污染:指导文档变啰嗦,自述文档变工具化。

---

## 反馈通路与复盘

### process-findings.md + GitHub issue

项目跑起来后,**框架/流程的问题提交到框架仓的 GitHub Issues**:

1. 跑流程时遇到卡点、不顺、模糊 → 随手记到 `process-findings.md`
2. session 末和用户一起过一遍,决定哪些提 issue
3. 提交时用 `gh issue create -R aliensweety/workflow-framework`,标题带 `[项目名]` 前缀

外部 skill / 工具的问题由每个 skill 文档自带的反馈机制处理,不在这里。

### workflow-debrief: 实战累积闭环

每次 run 都是一次实战。框架的迭代不该靠用户自己记得回头改大表,**`workflow-debrief` 这个 skill 提供主动的复盘入口**,把实战中浮出的问题沉淀回流程图、节点定义或 notes。

用户说"复盘一下"、"过一遍刚才那次跑"时触发。流程概要:扫 manifest 异常痕迹 + process-findings.md + 会话上下文里的修复动作 → 和用户对话过一遍 → 分诊到改 flow.yaml / 改 steps/X.yaml / 写 notes / 提框架 issue。

详见 `<project>/.claude/skills/workflow-debrief/SKILL.md`。

---

## 旧项目不回头同步

框架演化只惠及**下一个**新项目。已经存在的项目在它创建那一刻的快照上独立运行,不被回头改动。

这是有意的设计选择:
- 旧项目已经在旧机制上跑通了。强行同步意味着每次框架变更触发一轮重构。
- 如果旧项目业务逻辑真的需要新框架能力,更快的做法是**新建一个项目,参照旧项目的业务结构重新搭一遍**。
- 重构比修改快,是演化哲学的延伸。

---

## 多方案变体走 git,不走框架

工作流的不同方案(如配图 vs 配视频片段)——**用 git 分支处理,不在框架里加机制**。

```bash
git checkout -b visual-video
# 改 flow.yaml + 增删 steps/*.yaml,跑、迭代
git checkout main
git worktree add ../<project>-video visual-video
```

Claude Code 可以代劳——用户说"切到 visual-video 分支"它会做。

如果是同一个 step 的几种实现备选(同样是配图,有 grok 版和 gemini 版),改 flow.yaml 引用的 step 文件名就行——steps/ 里多放几个候选,flow.yaml 切换引用。

---

## 远景:可转译为程序性 DAG 引擎

由于核心原则一(flow.yaml 纯程序性),当工作流足够稳定后,**可以原样转译为 n8n / Airflow / Prefect 等程序性 DAG 引擎**:

- flow.yaml 的 branch / parallel 直接对应 n8n 的 IF / Split In Batches 节点
- 节点的 command 直接对应 n8n 的 Execute Command 节点
- judge 节点(本框架里输出 label 的脚本)在 n8n 里用 LLM 节点 + Switch 节点表达

转译后失去 Claude Code 的"异常路径自主修复"能力——出错就停。这是合理的权衡:工作流稳定后异常少,纯程序性运行更快更省。

**这条远景对当前架构的约束**:绝不在 flow.yaml 引入表达式语言、不在 branch.on 接除 step id 之外的东西、不让运行时决策依赖 LLM。这些妥协一旦发生就会污染转译路径。

---

## 一组明确的"不做什么"

写在这里防止以后想多:

- **不做** 节点内循环 / step 内迭代的拓扑表达——循环是程序性的,写进脚本或 subagent 内部
- **不做** workflow 嵌套调用 workflow(子工作流)——用 subagent 节点表达
- **不做** flow.yaml 内的条件表达式语言——judge 节点的脚本产出明确路由 label,大表只匹配 label
- **不做** branch.on 接表达式或多 step——只接单一 step id
- **不做** 跨 workflow 共享 state。要串多个 workflow 就用文件系统手动衔接
- **不做** agent 间通信和 agent team 编排。subagent 是单向派发
- **不做** 全自动 pipeline。Claude Code 全程在场是设计选择,不是过渡态
- **不做** 规范脚本的输出格式
- **不做** 嵌套 fan-out(两层 units)。需要两层结构时拍平,章索引作为 unit 的一个字段
- **不做** 前置定义所有 edge case
- **不做** 路由改写型 revise(用户中途说"这次走另一条路")——v1 不支持

---

## Backlog(看到了但现在不做)

- **Hooks / 程序化触发**:让工作流项目自身有意识,不全靠 Claude Code 判断
- **嵌套 fan-out**:5 章 × N 节这种两层结构,现阶段拍平处理
- **路由改写型 revise**:中途切换 condition 分支
- **HTML 可视化面板**:扫 flow.yaml + manifest.yaml 生成进度图,作为独立工具
- **跨机器移植性**:相对路径引用应该够,真撞上再加机制
- **n8n 转译 skill**:当一个工作流稳定后一键转译为 n8n 工作流文件

---

## 演化哲学

**实践与迭代交替。** 不追求一次设计完美。

第一版跑起来,遇到具体问题,讨论根因,改。改完再跑,再遇到问题。

以 AI 时代的落地速度,**重构比修改更快**。骨架是用来在每次迭代时防止方向走偏的,不是一劳永逸的蓝图。

---

## 检验新变更的三条问

每次想加字段、加规则、加机制之前,对照问:

1. **Claude Code 自己做不到吗?**(做得到 → 不加)
2. **没有这个,自然语言表达就受损吗?**(不受损 → 不加)
3. **程序和思考的边界清楚吗?**(模糊 → 先用 description 跑一阵看清楚再决定要不要进 command)

三个都过,才加。

## 反向检查(配对使用)

每次加完想加的东西,再问一遍:

> **这次改动是否让项目更难变好?**

具体追问:
- 引入了未来想改也改不动的字段?
- 把可选变成强制?
- 把简单变成复杂?
- 让 Claude Code 多了一次本不必要的判断?
- **破坏了"flow.yaml 纯程序性"或"可转译"的承诺?**

正向检查"是否真的让项目变好"和反向检查配对使用。
