---
name: workflow-revise
description: 用自然语言修改已经跑完（或跑到一半）的工作流产出，沿依赖链重跑受影响部分。当用户在 run 完成后说"X 有问题"、"2:30 那段改一下"、"第三个场景不对"、"这段文案再润一下"、"图片风格不对"等类似反馈时触发。不需要用户精确说出 unit id 或字段名——靠 Claude Code 理解 manifest 和用户意图做定位。定位后标 stale，移交 workflow-run 重跑。
---

# workflow-revise

像和团队说话一样告诉 Claude Code 哪里要改。Claude Code 自己定位、标 stale、重跑。

## 前置阅读

先读 `../WORKFLOW_SCHEMA.md` 的 **stale 传播规则** 和 **小表的形态：单产出 / 多产出 自适应** 两节。

## 核心视角

不分"模式"。无论是修改某个 unit 的字段，还是修改某个单产出 step，本质都是同一件事：

1. 在小表里找到要改的那个**最小颗粒**（某个 unit 的某个字段，或某个 step 的某个产出文件）
2. 沿大表的 step 顺序识别**依赖链**（哪些 step 产出会受这次修改影响）
3. 把那些 step 在小表里标 stale（多份产出场景下只标受影响的 unit）
4. 改 manifest.status 回 in_progress，current_step 指向最早需要重跑的 step
5. 移交 workflow-run

依靠 Claude Code 读完小表 + 大表后做整体理解。不靠固定字段名硬匹配。

---

## 流程

### 第一步：定位 run

用户的反馈通常隐含一次具体的 run。优先级：

1. 会话里刚跑完一个 run → 用那个
2. 否则扫 `runs/`，找最近一个 `status: done` 的
3. 不同实例之间有歧义 → 问用户

读那个 run 的 manifest.yaml 和对应的 workflow.yaml。

### 第二步：理解用户在指哪里

用户说的话可能是：

| 用户的话 | 在指什么 |
|---|---|
| "2:30 那段文案改一下" | 某个 unit 的 text 字段 |
| "第三个场景的图不对" | 某个 unit 的 image 字段（按场景序号定位） |
| "research 那部分重新做一下" | 某个单产出 step 的整体产出 |
| "整个文案推倒重写" | 某个 step 的产出 + 它之后的全部下游 |

读完小表，对用户的自然语言做整体理解。字段叫 `time` 还是 `timestamp`、`text` 还是 `content`，看 manifest 实际结构推。

### 第三步：定位前先看历史决策（如果需要）

如果用户的反馈涉及"这一步为什么这么做"或"我想改一下做法"，**打开对应 step 的 notes sidecar**（如果有）。看历史决策、坑、放弃过的方案——可能用户的修改方向已经被前人验证过不行。

只有改动方向是显然合理的（"换个具体内容"、"换个具体编号"），可以跳过这一步。

### 第四步：和用户确认定位

**改任何东西前先确认。**

多份产出场景：
> 你说的是 `seg_003`（时间 02:15-02:45，原文案 "..."）对吗？

单产出场景：
> 你说的是 `deep_research` 这一步吧？重跑会让后续 write_script、voiceover 等都重跑。继续吗？

简短展示关键字段。反复对不上就问："能给我一个关键词或编号吗？"

### 第五步：判断要改什么 + 传播链

定位后确定三件事：

1. **要改的最小颗粒**：哪个 unit 的哪个字段，或哪个 step 的哪个产出
2. **怎么改**：
   - 用户给了明确内容（"改成 X"） → 直接改
   - 用户只给了方向（"更哲学一点"） → 产出该字段/产出的 step 要重跑
3. **下游链条**：从该 step 之后所有依赖被改内容的 step

**推断依赖**：读大表的 step 顺序和每个 step 的 description / produces / consumes——Claude Code 看一眼就能推出"text 是 segment 这一步切出来的"、"prompt 是 image_prompts 这一步写的"。不要在 schema 里硬声明依赖图。

例：改 seg_003.text
- text 由 segment_and_prompt 这一步写入（从 produces 推出）
- 后续所有 `produces: unit.<...>` 的 step（image_prompts → generate_images → tts → assemble）对 seg_003 都变 stale
- 其他 unit 不受影响

例：改 deep_research 整体（单产出 step）
- deep_research 标 stale
- 它之后所有 step 都标 stale（因为单产出场景下下游 step 一般都依赖前一步的产出文件）

### 第六步：更新小表

**多份产出场景**：
1. 用户给了新值 → 把对应 unit 的字段直接改了
2. 受影响的 unit 的 status 改为 stale
3. 受影响的 step 在 steps_status 里改为 stale（表示"整体完成但对部分 unit 要重跑"）
4. manifest.status 改回 in_progress
5. current_step 改为要重跑的第一个 step

**单产出场景**：
1. 用户给了新值 → 直接修改对应 step 的产出文件
2. 该 step 在 steps_status 里改为 stale
3. 之后的所有 step 也改为 stale
4. manifest.status 改回 in_progress
5. current_step 改为要重跑的第一个 step

### 第七步：移交 workflow-run

调 workflow-run 的逻辑。它会从头遍历 steps：

- step 是 done 且相关 unit 全部 done → 跳过
- step 是 stale → 重跑（多份产出场景只跑 status 为 stale 的 unit；单产出场景整个 step 重跑）

如果某个 step 之前没有 command（要靠 description 跑），重跑时和第一次跑一样——Claude Code 按 description 决定怎么做。

---

## 多点修改

用户一次给出多处反馈（"2:30 改一下，第五场的图也不对"）：

1. 对每一处分别定位 + 确认
2. 一起标 stale
3. 最后统一调 workflow-run 一次跑完

不要改一处跑一处。批量更省时间，也更容易观察连带效果。

---

## 整篇重来

用户说"整个推倒重写"：
- 多份产出场景：把所有 unit 的相关字段和下游字段全标 stale
- 单产出场景：从写文案那个 step 开始全部 stale
- 提醒："这等于大部分内容重跑。要不要直接开一个新 run 保留这版做对照?"
- 让用户选：继续 stale 重跑，或新起一个 run

---

## 小修改可能不需要重跑

如果用户的修改只是"改个错别字"且后续 step 不依赖被改内容的细节（比如字幕里的错别字、不影响后续渲染的纯文本修正），直接改产出文件、不标 stale 也是合理选择。

告诉用户做了什么决定即可：
> 已直接改了字幕里那个词，没动其他。需要重跑后续步骤吗？

---

## 需要警惕的模式

- **不要不经确认就改**。定位再明显也先问。错改一处导致全链重跑，浪费比多问一句大得多。
- **不要依赖固定字段名硬匹配**。读小表结构自己推。
- **不要改产出文件却不更新小表**。小表是 single source of truth。
- **多份产出场景不要把 stale 扩大到其他 unit**。改一个只影响它自己和它的下游 step 中本 unit 的部分，不波及兄弟 unit。
- **不要在 revise 流程里改大表本身**。要改大表用 workflow-compose，或手改 YAML。revise 只动小表和产出文件。
- **重跑前 notes 已读过的话别重读**。如果第三步已经读了 notes 看历史决策，重跑触发 workflow-run 时不必再读一次（除非异常路径再次触发）。