---
name: workflow-debrief
description: 复盘一次(或多次)已经完成的 workflow run,把实战中暴露的问题沉淀回 flow.yaml / steps/*.yaml / notes。当用户说"复盘一下"、"过一遍刚才那次跑"、"哪些可以沉淀到大表"、"刚才的问题怎么改进"、"workflow 哪里写得不好"时触发。和用户对话过一遍 run 的过程,识别 description / command 该调整的地方、该写进 notes 的经验、该改的 flow 拓扑,用户确认后落地。
---

# workflow-debrief

每次 run 都是一次实战。框架的迭代不该靠用户自己记得回头改大表,而是**主动提供一个复盘入口**,把实战中浮出的问题沉淀回来。

## 前置阅读

读 `../WORKFLOW_SCHEMA.md` 了解文件结构。读 `<project>/decisions.md` 了解项目当前的哲学边界和长期取舍——复盘出的改动要和这些对齐。

## 何时触发

- 用户主动说"复盘一下"、"过一遍"、"哪些可以沉淀"
- workflow-run 结束时如果发现 step 失败被现场修复,可以提示用户:"这次跑有 X 个地方被现场修了,要不要复盘?"

不要每次 run 完都强制复盘——顺利的不必。

## 流程

### 第一步:定位要复盘的 run

最近一次 done 的 run;或用户指定某个 run。读它的 manifest.yaml 和对应 flow.yaml。

**先不要 Read 全部 steps/*.yaml**——只在分析到某个 step 的具体问题时再 Read 它。

### 第二步:扫描这次跑的"摩擦点"

来源有三:

1. **manifest 里的异常痕迹**:哪些 step 跑了不止一次、哪些 unit 状态反复、整体时长是否远超预期、taken_routes 是否反复改写过
2. **process-findings.md 的新条目**:用户/Claude Code 在跑的过程中临时记下的卡点
3. **会话上下文里的修复动作**:本次 session 里有没有"改了一行 command 才能跑通"、"猜了路径"、"手动跳过了某步"这种事

把它们汇总成一份"复盘清单"展示给用户,按"这是不是该回头改大表"分诊。

### 第三步:和用户对话过一遍

对每一条摩擦点,问一句:

> 这次 X step 的 command 改了 Y。这是临时修复,还是 steps/X.yaml 本来就该这么写?

用户回答驱动后续:

| 用户的回答 | 动作 |
|---|---|
| 节点定义本来就该这么写 | 改 `steps/<step_id>.yaml` 的 command/description |
| flow 拓扑本身有问题(漏了分支、并行错配、聚合点不对) | 改 `flow.yaml` |
| 跑的环境特殊导致的,下次不会这样 | 不动节点定义,记一条到 `workflows/notes/<step_id>.md` 的"经验与坑" |
| description 写得不清楚导致每次都要现场想 | 改 `steps/<step_id>.yaml` 的 description |
| 这步整体设计有问题,应该重做 | 标记下来,session 末讨论是否进 decisions.md 的历史决策;或者讨论开新 git 分支重做 |
| condition 路由经常选错 | 看是 judge 节点的脚本逻辑要改,还是 flow.yaml 的 routes label 设计不合理 |
| 不属于本项目,是框架本身的问题 | 写一条到 process-findings.md,session 末决定提 issue |

### 第四步:落地改动

按上一步收集的动作清单逐条做。每改一处当面给用户看 diff,确认后再下一条。**不批量改,不静默改。**

每改一份 yaml 文件,提醒用户改完是否要 git commit。让历史清晰。

### 第五步:收尾

总结:
- `flow.yaml` 改了哪几处
- `steps/*.yaml` 改了哪几个
- `workflows/notes/` 新写了几个 / 哪些 step
- `decisions.md` 加了哪几条历史决策
- `process-findings.md` 留了哪几条待提 issue

提醒用户:下次 run 前 git commit 一下,把这次复盘的改动留个清晰节点。

---

## 复盘多次 run

用户说"过一遍这周所有 run":

可以串起来扫——但每个 run 单独走第二、三、四步,不要混着讨论。多 run 复盘的额外价值在于看**模式**:

- 同一个 step 反复出问题 → 强信号,该改的不是某次,是节点定义本身
- 同一类问题在不同 step 反复出现 → 可能是 flow 拓扑或某个共用约定的问题
- branch 路由在多次 run 里分布是否合理 → judge 节点的逻辑可能要调

把这些模式作为额外发现报告给用户。

---

## 需要警惕的模式

- **不要替用户拍板**。复盘的核心是"用户和 Claude Code 一起判断哪些是临时哪些是长期"——单方面改大表风险很高(某次错误执行可能改坏流程)。
- **不要把所有摩擦点都改进大表**。环境性的、偶然的,进 notes 或不动。改大表的标准是"下次遇到同类情况,按改后的大表就能直接跑通"。
- **不要在复盘流程里启动 workflow-run 重跑**。复盘是反思,重跑是另一件事。
- **不要替框架仓修问题**。框架本身的问题进 process-findings.md。
- **不要复盘没跑过的工作流**。manifest 还在 in_progress 时问清楚:"想复盘已完成的部分,还是想中止 run?"
- **不要一开始就 Read 所有 steps/*.yaml**。按需 Read。
