---
name: workflow-run
description: 执行一个工作流(flow.yaml 拓扑 + steps/*.yaml 节点),维护 manifest 运行态。当用户说"跑工作流"、"开始生产"、"执行流程"、"run workflow"、"start a production run"、"继续上次的 run"或提及项目里已有的工作流时触发。沿 flow 拓扑递归执行(线性顺跑、branch 选路径、parallel 派并发);聚合点等齐再继续。每跑完一份产出立刻更新 manifest。支持 resume 和局部重跑。
---

# workflow-run

读 flow.yaml,沿拓扑递归执行,持续维护 manifest。

## 前置阅读

触发时先读 `../WORKFLOW_SCHEMA.md`,特别熟悉:

- §1.1 拓扑的递归定义(flow_element)
- §1.4 parallel 块对节点的要求
- §1.5 聚合规则
- §2 节点字段语义(尤其 `command` 三种形态 + 注释规则)
- §4 manifest 字段和状态语义

**核心理解:flow.yaml 的 `flow:` 是一个 flow_element 列表。flow_element 有三种形态:step id 字符串 / branch 块 / parallel 块。三种形态可递归嵌套。** 执行逻辑就是递归下降地处理这些形态。

**四条原则**:

- **落地是真相,种子是兜底**:有 `command` 直接跑;只有 command 跑不通或不存在才回 description
- **渐进披露**:steps/<id>.yaml **跑到那一步才 Read**;notes 异常路径才打开
- **聚合自然**:嵌套块结束后下一个 flow_element 自动等
- **每跑完一份产出立刻更新小表**

---

## 启动流程

### 第一步:读 flow.yaml

读 `workflows/flow.yaml`。不存在就提示用户先用 workflow-compose 编排。

**这一步只读拓扑**——不要预先把所有 steps/*.yaml 都读了。step 详情在递归执行到该 step 时再 Read。

### 第二步:定位 run(resume vs new)

扫项目 `runs/`,看有没有 `status: in_progress` 或 `paused` 的 run。

**有未完成的 run**:告诉用户 "发现 `<run_id>` 停在 `<current_step>`,恢复还是开新的?"。恢复 → 读 manifest;开新的 → 走新建。

**新建 run**:
1. 问实例名(用于 run_id)
2. 询问需要覆盖 `variables` 里的哪些值
3. 创建 `runs/<YYYY-MM-DD>_<instance>/`
4. 初始化 manifest:硬约束字段填好,`steps_status` 全部 pending(扁平,不管 step 嵌在哪一层),`units: []`,`taken_routes: {}`
5. 写盘

### 第三步:递归执行 flow

`flow:` 是一个 flow_element 列表。按顺序处理每个元素。每个元素有三种形态:

```
执行(elem):
    如果 elem 是字符串(step id):
        run_step(elem)

    如果 elem 是 branch 块:
        chosen_label = read_routing(elem.on)
        把其他路径上所有 step 标 skipped
        把 chosen_label 写入 taken_routes
        对 elem.routes[chosen_label] 这个列表:
            按顺序对每项执行(elem_inner)  # 递归

    如果 elem 是 parallel 块:
        并发启动每条线:
            每条线是一个 list,按顺序对每项执行(elem_inner)  # 递归
        等所有线完成

执行完一个元素 → 处理 flow 中下一个元素(自动聚合,因为下一个元素出现在块之后)
```

**关键:执行是递归的**。parallel 线里的元素可以再是 branch 或 parallel,branch 路径里的元素同样,任意嵌套。同一套逻辑处理所有深度。

---

## 怎么执行一个 step

### 第一步:Read 这个 step 的 yaml

跑到某 step 才 Read 它的 `steps/<step_id>.yaml`。这是渐进披露的关键。同一会话里 Read 过的不必重复读(stale 重跑除外,重跑时如果 yaml 改了要重读)。

### 第二步:建 step.dir

确保 `{run.dir}/<step_id>/` 目录存在(mkdir -p)。这是 `{step.dir}` 占位符的物理位置。

### 第三步:在 manifest 标 running

```yaml
steps_status:
  <step_id>: running
current_step: <step_id>
```

立刻写盘。

### 第四步:按 dispatch 派发

**`dispatch: subagent`** → 严格按下面的"subagent 派发指令模板"组装指令,然后派出。主会话不接收完整 stdout/stderr,**但仍然阻塞等待 sub-agent 返回**。

**默认 inline** → 在主会话里直接跑。

### 第五步:执行 command 或回退到 description

**有 `command`** → 按下面的"执行 command 三种形态"处理。**不读 description**(那是兜底)。

成功 → 第六步。
失败 → 异常路径(见下文)。

**没有 `command`** → 按 description 自主决定怎么做。可能调 skill、用基础工具推理、生成文件。produces 给出预期输出位置。完成 → 第六步。

### 第六步:produces 决定 fan-out 形态

- `produces: "{step.dir}/..."` → 单份产出,检查文件存在 → 标 done
- `produces: "manifest.units"` → fan-out 起点:把切分结果写入 manifest.units(每项至少 id、status)→ 标 step done
- `produces: "unit.<field>"` → 对 manifest.units 循环执行,每个 unit 跑完立刻 persist。所有 unit 完成才标 step done

并行多 unit 执行时:脚本支持并发且资源允许,可并发;否则串行。并发产出收齐后统一写一次 manifest 盘。

### 第七步:更新 manifest

- step 完成 → `steps_status[<step_id>] = done`,推进 `current_step`
- 立刻写盘

---

## 执行 command 的三种形态

`command` 字段可以是:

### 形态 A:单行字符串

```yaml
command: "python scripts/x.py --in {run.dir}/foo --out {step.dir}/bar"
```

变量插值 → Bash 一次性执行。退出码 0 = 成功。

### 形态 B:多行字符串(yaml `|`)

```yaml
command: |
  # 提交任务
  python scripts/runninghub_tts.py submit --text ... --out {step.dir}/task_id.txt
  # 轮询获取
  python scripts/runninghub_tts.py fetch --task-id {step.dir}/task_id.txt --out {step.dir}/voice.mp3
```

按行 split。**对每一行**:

1. trim 前导/尾随空白
2. 跳过空行
3. **如果 trim 后以 `#` 开头 → 注释,跳过执行**(可以可选地把注释 echo 出来给人看,但不算 step 的输出)
4. 否则:变量插值 → Bash 执行
5. 退出码非 0 → 整个 step 失败,**不再跑后续行**,走异常路径

所有非注释行执行成功 → step 标 done。

### 形态 C:字符串列表

```yaml
command:
  - "# 提交任务"
  - "python scripts/runninghub_tts.py submit ..."
  - "# 轮询获取"
  - "python scripts/runninghub_tts.py fetch ..."
```

**和形态 B 等价**——对列表的每个字符串执行同样的处理(trim、跳空、识别注释、变量插值、Bash 执行、非 0 即停)。

### 形态共通的"工作目录"规则

每条 command 在 `{step.dir}` 已建好的环境里执行。当前工作目录可以是项目根(`{run.dir}/..`),`{step.dir}` 通过占位符插值传给脚本,不依赖 `cd`。

不在 command 之间维持 shell 状态(env、cwd、变量)——每条独立子进程。如果用户需要在两条 command 间共享状态(比如临时变量),那这"两条命令"本质上是一条复合命令,应该写成 `cmd1 && cmd2` 形式;或者下沉到一个脚本里,command 只调那个脚本。

---

## subagent 派发指令模板

派给 sub-agent 的指令**必须严格按下面这个模板组装**——不可省略任何段落,尤其是边界约束。这是防止 sub-agent 在项目里东张西望的关键。

```
你是 workflow-run 派给你的 sub-agent,负责执行一个具体的 step。

【任务】
<step 的 description 全文>

【输入文件】(已知存在,你只能读这些)
- <consumes 解析后的绝对路径 1>
- <consumes 解析后的绝对路径 2>
... (如果没有 consumes 就写"无")

【产出要求】(你必须写入这些路径)
- <produces 解析后的绝对路径>
... (如果是 unit.<field> 形式,说明该 unit 的 id 和具体要写的字段)

【工作目录】
<step.dir 解析后的绝对路径>

【执行命令】(如果有 command)
按以下顺序执行这些命令,任一失败立即停下报告:
<变量插值完成后的命令列表,注释行保留作为说明>

或:(如果没有 command)
按【任务】描述自主完成,合理使用工具。

【严格约束 - 必须遵守】
1. 只读上面【输入文件】列出的文件。不要读项目内任何其他文件,包括但不限于:
   - workflows/flow.yaml、其他 steps/*.yaml、其他 notes/*.md
   - 其他 run 的 manifest 或产出
   - 项目根的 CLAUDE.md、decisions.md
   - 其他 step 的 {step.dir}
2. 只写入【产出要求】列出的路径,或【工作目录】内的临时文件。
3. 不要调用 workflow 相关 skill(workflow-compose / workflow-run / workflow-revise / workflow-debrief)。
4. 不要修改任何不在产出要求里的现有文件。
5. 完成后回报:
   - 产出路径(确认已写入)
   - 关键摘要(2-3 句)
   - 遇到的问题(如有,简述,不展开)
```

**为什么每个段落都不能省**:

- 没有"输入/产出"明确路径 → sub-agent 会去搜
- 没有"严格约束" → sub-agent 默认会主动了解上下文(读 CLAUDE.md、看相邻文件)
- 没有"回报格式" → sub-agent 会把完整 stdout 倾倒回来,污染主会话

**派 subagent 时唯一的可裁剪**:如果某段没内容(比如该 step 没 consumes),那一段写"无",不能整段删——保持模板结构稳定。

---

## 怎么执行 branch 块

`branch:` 块是 condition 分支。流程:

1. 找到 `branch.on` 引用的 step——它应该已经 `done` 了(branch 出现在它之后)
2. 读它的产出文件(通常是 `{step.dir}/routing.txt`),内容是路由标签
3. 匹配 `branch.routes` 的 key:
   ```yaml
   routes:
     deep: [research, write_script]
     light: [write_script]
   ```
   routing.txt 内容是 `deep`,选 `[research, write_script]` 这条路径
4. **遍历未选中路径上的所有 step**(包括嵌套块里的所有 step),在 `steps_status` 标 `skipped`
5. 把 `taken_routes[<branch_on_step>] = <chosen_label>` 写进 manifest,立刻 persist
6. 顺序执行选中路径里的元素(递归)
7. 路径执行完 → 继续 flow 中 branch 块之后的下一个元素

**匹配失败**:routing.txt 内容不在 routes 的 key 里 → 停下报错,**不要猜路径**。

**嵌套 branch**:被选中路径里再嵌一个 branch,递归执行——会触发另一次 read_routing 和 taken_routes 写入。每个 branch 在 taken_routes 里独立一条记录。

---

## 怎么执行 parallel 块

`parallel:` 块是并行分支。块结构是 list of list——每条线是一个 list,list 里是 flow_element。

流程:

1. 列出块里所有路径(每条路径是一个 list)
2. **检查每条路径的第一个执行单元能否真并行**:
   - 是 step id → 对应 step 必须有 `command`(纯脚本)或 `dispatch: subagent`
   - 是嵌套 branch / parallel → 内部最终落到的 step 也要满足
   如违反 → 停下报错(本应在 compose 阶段拦下,run 时再校验一次)
3. **同时启动所有路径**:
   - 每条路径是一个独立的执行单元,内部按顺序递归处理 list 里的元素
   - 纯脚本路径:启动子进程
   - 起手是 subagent 的路径:派 sub-agent(指令按"subagent 派发指令模板"组装);sub-agent 内部继续顺序处理后续元素(在它的隔离上下文里)
4. 等所有路径完成(任一失败立即停下来汇报)
5. 每条路径完成时 persist 涉及 step 的状态
6. 全部完成 → 继续 flow 中 parallel 块之后的下一个元素

**注意**:
- 真并行的多个写 manifest 操作要串行化(主会话作为协调者统一写),避免并发冲突
- parallel 线内部如果是多步,**这多步是按顺序的**——并不是把这条线里所有 step 都同时跑。"线"是顺序的,"线和线"才是并行的
- parallel 线里嵌 parallel 块时,内层 parallel 会再开一波并发——外层等内层完成才继续外层这条线

---

## 异常路径:command 跑不通时

step 失败时:

### 1. 打开 notes sidecar(如果 step 有 notes 字段)

用 Read 打开 `workflows/notes/<step_id>.md`。寻找处理方法:出错时段落、经验与坑、历史决策。

### 2. 回到 description 重新理解

按 description 重新判断这一步该做什么。可能修正 command 里的路径/参数/工具名,改用不同 skill,自己拼执行方式。

### 3. 修正后的 command 反写

修复后**告诉用户做了什么修改,问要不要反写回 steps/<step_id>.yaml**。

### 4. 仍然解决不了 → 停下问用户

呈现错误信息 + 已尝试的修复 + notes 提示 → 等用户决定。**不静默跳过、不重复尝试同一失败 command**。

---

## 持续维护 manifest

**每跑完一份产出立刻 persist**——resume 能力的基础:

- 单份产出 step 完成 → 写盘
- 多份产出 step 的每个 unit 完成 → 写盘
- 走过 branch 立刻写 `taken_routes` 和 skipped 状态
- parallel 各路径完成时各自更新 step 状态(主会话统一协调写)

---

## 完成

整个 flow 列表执行完(skipped 不算):
- `manifest.status = done`
- 给用户总结:run_id、耗时、产出路径、taken_routes(走的路径)、units 数量
- 提示:
  - 想沉淀实战经验 → 说"复盘一下",workflow-debrief 触发
  - 发现产出问题 → 说哪里要改,workflow-revise 触发

---

## 反馈通路(process-findings.md)

执行过程中发现**框架本身/流程结构**的问题,记一条到 `process-findings.md`。session 末过一遍决定哪些提 issue。

| 故障来源 | 动作 |
|---|---|
| `flow.yaml` / `steps/*.yaml` / `scripts/` / `runs/` 下的内容 | 直接改,跑下去 |
| 外部 skill / 工具的 bug | 那个 skill 文档自带反馈仓库地址,提到那里 |
| 框架部件本身 / 跑下来感觉某机制不顺 | 写到 `process-findings.md`,session 末讨论 |

提交 issue:`gh issue create -R aliensweety/workflow-framework`,标题带 `[项目名]` 前缀;提交后 URL 回写 process-findings.md。

---

## 需要警惕的模式

- **不要一开始就读所有 steps/*.yaml**。跑到那一步才读。
- **不要在正常路径读 notes**。读到字段名就够了。读 notes 是异常路径的事。
- **不要因为"想确认"而读 description**。有 command 直接跑。
- **command 是数组/多行时,不要把注释行当指令跑**。trim 后 `#` 开头的一律跳过。
- **派 subagent 时不要省略模板的任何段落**。"严格约束"是关键防东张西望机制。
- **不要让 subagent 自由探索项目结构**。它需要的所有信息在模板里一次性给清楚。
- **不要把 parallel 线和 parallel 路径搞混**。线是 list(顺序执行);线和线之间并行。
- **不要把嵌套 parallel/branch 当特例**。同一套递归逻辑处理任何深度。
- **不要把 manifest 当一次性写入**。每个 step、每个 unit 跑完都 persist。
- **不要在 flow.yaml 之外做拓扑判断**。flow 是真相,按它走。
- **不要猜路由 label**。routing.txt 不匹配 routes → 停下报错。
- **不要把 skipped 当 pending**——resume 时不要让它们突然要跑。
- **不要静默修复 command 错误**。改完告诉用户、问要不要反写回 steps/<id>.yaml。
- **不要把项目自己的 yaml/scripts 问题推到 process-findings.md**——直接在项目里改。
- **不要硬改外部 skill 源代码**。
