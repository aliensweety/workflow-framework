---
name: workflow-revise
description: 用自然语言修改已经跑完(或跑到一半)的工作流产出,沿 DAG 拓扑递归找下游重跑受影响部分。当用户在 run 完成后说"X 有问题"、"2:30 那段改一下"、"第三个场景不对"、"这段文案再润一下"等类似反馈时触发。不需要用户精确说出 unit id 或字段名——靠 Claude Code 理解 manifest、flow、steps 后定位。定位后标 stale,移交 workflow-run 重跑。
---

# workflow-revise

像和团队说话一样告诉 Claude Code 哪里要改。Claude Code 自己定位、标 stale、重跑。

## 前置阅读

先读 `../WORKFLOW_SCHEMA.md`,熟悉:

- §1.1 拓扑的递归定义
- §4 manifest 状态语义
- §4 stale 传播规则(DAG 递归)

## 核心视角

不分"模式"。无论是修改某个 unit 的字段,还是修改某个单产出 step,本质都是同一件事:

1. 在 manifest 找要改的**最小颗粒**(某个 unit 的某个字段,或某个 step 的某个产出文件)
2. 沿 flow.yaml 的 **DAG 拓扑递归找下游传递闭包**(哪些 step 会受影响)
3. 把那些 step 标 stale
4. 改 manifest.status 回 in_progress,current_step 指向最早需要重跑的 step
5. 移交 workflow-run

依靠 Claude Code 读完 manifest + flow + 相关 steps/*.yaml 后做整体理解。

---

## 流程

### 第一步:定位 run

用户的反馈通常隐含一次具体的 run:

1. 会话里刚跑完一个 run → 用那个
2. 否则扫 `runs/`,找最近一个 `status: done` 的
3. 不同实例之间有歧义 → 问用户

读那个 run 的 manifest.yaml 和对应 flow.yaml(以及涉及到的 steps/*.yaml,按需 Read)。

### 第二步:理解用户在指哪里

用户说的话可能是:

| 用户的话 | 在指什么 |
|---|---|
| "2:30 那段文案改一下" | 某个 unit 的 text 字段 |
| "第三个场景的图不对" | 某个 unit 的 image 字段(按场景序号定位) |
| "research 那部分重新做一下" | 某个单产出 step 的整体产出 |
| "整个文案推倒重写" | 某个 step 的产出 + 它之后的全部下游 |
| "让 judge 重新判断一次" | branch 路由改写(见 v1 限制) |

字段叫 `time` 还是 `timestamp`、`text` 还是 `content`,看 manifest 实际结构推。

### 第三步:定位前看历史决策(如果需要)

如果反馈涉及"这一步为什么这么做"或"我想改一下做法",**打开对应 step 的 notes sidecar**(如果有)。看历史决策、坑、放弃过的方案——可能改的方向已经被验证过不行。

显然合理的改动("换个具体内容"、"换个具体编号"),可以跳过这一步。

### 第四步:和用户确认定位

**改任何东西前先确认。**

多份产出:
> 你说的是 `seg_003`(时间 02:15-02:45,原文案 "...")对吗?

单产出:
> 你说的是 `deep_research` 这一步吧?重跑会让后续 segment、generate_images、generate_audio、assemble 都重跑。继续吗?

反复对不上就问:"能给我一个关键词或编号吗?"

### 第五步:推 DAG 下游(递归遍历)

定位后确定三件事:

1. **要改的最小颗粒**:哪个 unit 的哪个字段,或哪个 step 的哪个产出
2. **怎么改**:
   - 用户给了明确内容 → 直接改
   - 用户只给了方向("更哲学一点") → 产出该字段/产出的 step 标 stale
3. **下游链条**:沿 flow.yaml 的 DAG **递归遍历** 找下游

**DAG 下游推断的递归规则**:

```
find_downstream(被改 step, flow):
    在 flow 树中找到这个 step 的位置(可能在 list 顶层,可能在 branch 路径里,
    可能在 parallel 某条线里,可能在嵌套块的更深层)
    
    从该位置往后:
        if 后面还有同级元素:
            遍历它们(递归处理 step / branch / parallel)
        else if 在某个块内部已无后续:
            该块结束,跳到块所在的同级位置继续
    
    遇到 branch 块时:
        只追 taken_routes 选中的路径(其他路径被 skipped,不动)
    
    遇到 parallel 块时:
        所有路径都追(它们都跑了)
    
    遇到嵌套块:递归
    
    把所有追到的 step 加入"下游集合"
```

**字段-step 映射**:读相关 steps/*.yaml 的 produces 字段。`produces: unit.text` → 这个 step 产出 text。改 text → 这个 step 标 stale,它的下游也标 stale。

**例**:改 seg_003.text(在配音线和配图线汇合前的 segment step 后)
- text 由 `segment` step 产出(从 produces 推出)
- 沿 DAG 递归找 segment 的下游:
  - 后面是 parallel 块,两条线都要追
  - 配音线:voiceover → transcribe → correct_subtitles
  - 配图线:plan_images(产出 prompt) → generate_images(产出 image)
  - parallel 块后:assemble
- 这些 step 对 seg_003 标 stale,其他 unit 不动

### 第六步:更新 manifest

**多份产出**:
1. 用户给了新值 → 改对应 unit 的字段
2. 受影响 unit 的 status 改 stale
3. 受影响 step 在 steps_status 里改 stale
4. manifest.status 改 in_progress
5. current_step 指向要重跑的第一个 step

**单产出**:
1. 用户给了新值 → 直接修改对应 step 的产出文件
2. 该 step 在 steps_status 里改 stale
3. 沿 DAG 递归找的所有下游 step 都改 stale
4. manifest.status 改 in_progress
5. current_step 指向要重跑的第一个 step

### 第七步:移交 workflow-run

调 workflow-run 的逻辑。它会沿 flow 递归遍历:

- step done 且相关 unit 全 done → 跳过
- step stale → 重跑(多份产出只跑 status 为 stale 的 unit;单产出整个重跑)
- step skipped → 不动

---

## v1 限制:路由改写型 revise 不支持

用户说"重新让 judge 判断一次,这次走 light 不走 deep"——这是**路由改写**,不是普通的产出修改。v1 不支持自动处理。

处理方式:
1. 告诉用户:"路由改写当前需要手动:先在 manifest 把 `taken_routes` 改成你想要的;之前选中路径上的 step 全标 stale 或删 status;之前 skipped 路径上的 step 标 pending。然后我接着跑。"
2. 用户确认后协助手动操作

未来版本可能原生支持。如果你/用户对此挫败,记一条到 process-findings.md。

---

## 多点修改

用户一次给出多处反馈("2:30 改一下,第五场的图也不对"):

1. 对每一处分别定位 + 确认
2. 一起标 stale(下游 DAG 求并集)
3. 最后统一调 workflow-run 一次跑完

不要改一处跑一处。

---

## 整篇重来

用户说"整个推倒重写":
- 多份产出场景:把所有 unit 的相关字段和下游字段全标 stale
- 单产出场景:从对应 step 开始全部 stale
- 提醒:"这等于大部分内容重跑。要不要直接开一个新 run 保留这版做对照?"
- 让用户选:继续 stale 重跑,或新起一个 run

---

## 小修改可能不需要重跑

修改只是"改个错别字"且后续 step 不依赖被改内容的细节(字幕错别字、不影响后续渲染的纯文本修正)→ 直接改产出文件、不标 stale 也合理。

告诉用户做了什么决定:
> 已直接改了字幕里那个词,没动其他。需要重跑后续步骤吗?

---

## 需要警惕的模式

- **不要不经确认就改**。
- **不要依赖固定字段名硬匹配**。读 manifest + steps/*.yaml 的 produces 自己推。
- **不要改产出文件却不更新 manifest**。manifest 是 single source of truth。
- **多份产出场景不要把 stale 扩大到其他 unit**。
- **DAG 推断时不要追 skipped 路径**。被选择不走的路径不参与下游传播。
- **嵌套 flow 结构下不要假设"线性顺序"**。递归遍历是唯一正确的方式。
- **不要在 revise 流程里改 flow.yaml 或 steps/*.yaml**。要改流程结构用 workflow-compose,或手改 yaml。revise 只动 manifest 和产出文件。
- **不要尝试自动路由改写**。v1 是已知限制。
