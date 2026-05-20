# notes — sidecar 扩展信息

每个需要扩展信息的 step 在这个目录放一个 `<step_id>.md` 文件。在 `steps/<step_id>.yaml` 里用 `notes: workflows/notes/<step_id>.md` 引用。

## 为什么有这个机制

`steps/<step_id>.yaml` 只承载"正常路径"——种子(description)+ 落地(command)。所有"平时不必读、需要时才有用"的信息——异常处理、业务详述、经验坑、历史决策、示例反例——都放进这里,作为**渐进披露的 sidecar 文件**。

**正常路径下 Claude Code 不读这些文件**。只在以下情况打开:

1. command 跑不通
2. 没有 command,需要从 description 生成执行方式时补充上下文
3. 编排修改(workflow-revise)时想看本步骤的历史决策
4. workflow-debrief 复盘时

## 建议但不强制的结构

文件内部自由格式 markdown。可以分段也可以不分段:

```markdown
# <step_id> — 扩展信息

## 出错时
(异常路径上 Claude Code 该参考什么、怎么处理)

## 业务逻辑详述
(steps/<id>.yaml 的 description 写不下的详细业务说明)

## 经验与坑
(这一步遇到过什么、为什么这么处理)

## 历史决策
(为什么 command 长这样、改过几次、为什么放弃过 X 方案)

## 示例 / 反例
```

不强制分段——一个 step 可能只有"出错时"段落,另一个只有"经验"段落。按需写。

## 创建时机

**第一版编排不必创建**。flow.yaml + steps/*.yaml 出来直接跑,跑过几次发现有踩坑的地方再回头加 sidecar。

`workflow-compose` 默认不会主动创建 notes 文件。在 step yaml 里也不要写 `notes: ...` 字段——除非这个 step 真的有要记下来的扩展信息。空的 sidecar 字段是噪音。

`workflow-debrief` 复盘流程会引导用户在合适的时机把经验/坑沉淀成 notes。
