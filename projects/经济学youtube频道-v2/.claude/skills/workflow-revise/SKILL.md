---
name: workflow-revise
description: 用自然语言修改已经跑完（或跑到一半）的工作流产出，并沿依赖链重跑受影响部分。当用户在 run 完成后说"X 有问题"、"2:30 那段改一下"、"第三个场景不对"、"这段文案再润一下"、"图片风格不对"等类似反馈时触发。不需要用户精确说出 unit id 或字段名——靠 Claude Code 理解 manifest 和用户意图做定位。定位后标记 stale，移交 workflow-run 重跑。
---

# workflow-revise

像和团队说话一样告诉 Claude Code 哪里要改。Claude Code 自己定位、自己标 stale、自己重跑。

## 前置阅读

先读 `../WORKFLOW_SCHEMA.md` 的 "stale 传播规则" 和 "何时用 units" 部分。

## 流程

### 第一步：定位 run

用户的反馈通常隐含一次具体的 run。优先级：

1. 会话里刚跑完一个 run（通常是的），用那个
2. 否则扫项目 `runs/`，找 `status: done` 最近的一个
3. 如果有多个候选（不同 workflow / 不同实例），问用户

读进那个 run 的 manifest.yaml 和对应的 workflow YAML。

### 第二步：识别"用 units" 还是"不用 units"

读 manifest：

- **manifest.units 非空** → 这是 units 模式。修改可以定位到具体 unit，沿链只重跑该 unit 的下游。
- **manifest.units 为空数组（或没这个字段）** → 这是无 units 模式。修改靠 step 定位，标 stale 后该 step 及其所有下游 step 都要重跑。

两种模式的定位方式不同，下面分开讲。

### 第三步 A：units 模式的定位

**关键原则：不靠固定字段名硬匹配。** 让 Claude Code 读完 manifest 全文，对用户的自然语言做整体理解。

例 1："2:30 那段文案改成更有哲学味"
- 扫 units，找时间范围包含 2:30 的那个（可能是 `time: "02:15-02:45"`）
- 定位 seg_00X
- 要改的是 `text` 字段（从"文案"推出来）

例 2："第三场的小红熊猫画得不够苍凉"
- 扫 units，找第 3 个（或场景 3 对应的）
- 要改的是 `prompt` 字段或 `image` 字段（通常先改 prompt 再重跑出图）

字段叫 `time` 还是 `timestamp` 还是 `time_range`，由 manifest 结构决定，读一遍就知道。

### 第三步 B：无 units 模式的定位

例 1："research 那段不对，重新 research 一下"
- 找到 `deep_research` step（从 step.id 和 intent 匹配）
- 整个 step 标 stale，它和它之后的所有 step 都要重跑
- 如果用户对 research 内容有具体要求（"换个角度"），把要求带到重跑时——可以直接修改 step 输出（research.md）作为约束，或者在 ask autonomy 时加约束 prompt

例 2："字幕里某个词错了，手动修一下就行"
- 这种小修改不需要重跑——直接改 produces 文件
- manifest 不变（step 还是 done）
- 告诉用户："已直接改 subtitles.srt 的那个词，没动其他。需要重跑后续步骤吗?"

### 第四步：确认定位

**改任何东西前，先和用户确认**：

units 模式：
> "你说的是 unit `seg_003`（时间 02:15-02:45，原文案 '...'）对吗?"

无 units 模式：
> "你说的是 `deep_research` 这一步吧?重跑这步会让后续 write_script、voiceover 等都重跑（因为它们依赖 research.md）。继续吗?"

简短展示关键字段。用户确认后才进下一步。

反复对不上就问用户："能给我一个关键词或编号吗?"

### 第五步：确定要改什么 + 传播链

定位后，确定三件事：

1. **要改的字段（units 模式）或 step（无 units 模式）**
2. **要怎么改**：
   - 用户给了明确内容 → 直接改
   - 用户只给了方向（"更哲学一点"）→ 产出这个字段的 step 要重跑
3. **下游链条**：
   - units 模式：workflow 里产出该字段的 step 之后的所有 `iterates_over: units` 的 step，对当前 unit 都变 stale
   - 无 units 模式：标 stale 的 step 之后的所有 step 全部 stale

**如何推断字段由哪个 step 产出**：读 workflow 的 step 顺序和每个 step 的 intent / produces / updates_field 等——Claude Code 看 workflow 一眼就能推出"哦，text 是 segment 这一步切出来的"、"prompt 是 image_prompts 这一步写的"。不需要在 schema 里声明映射关系。

例：units 模式改 seg_003.text
- text 由 segment step 写入（从它的 intent/produces 推出）
- 后续 image_prompts / generate_images / tts / assemble 这些 iterates_over: units 的 step，对 seg_003 都变 stale
- 其他 unit 不受影响

### 第六步：更新 manifest

#### units 模式

1. 用户给了新值 → 把 unit 的字段直接改了
2. 受影响 unit 的 `status` 改为 `stale`
3. 受影响的 steps 在 `steps_status` 里改为 `stale`（表示"整体完成但对部分 unit 要重跑"——具体哪些 unit 看 unit.status）
4. manifest.status 改回 `in_progress`
5. current_step 改为要重跑的第一个 step

#### 无 units 模式

1. 用户给了新值 → 直接修改对应 step 的产出文件
2. 该 step 在 `steps_status` 里改为 `stale`
3. 之后的所有 step 也改为 `stale`
4. manifest.status 改回 `in_progress`
5. current_step 改为要重跑的第一个 step

### 第七步：移交 workflow-run

调用 workflow-run 的逻辑。它会从头遍历 steps，对每个 step：
- 该 step 是 done 且相关 unit 全部 done → 跳过
- 该 step 是 stale → 重跑（units 模式只跑 status 为 stale 的 unit；无 units 模式整个 step 重跑）

对 ask autonomy 的 step，重跑时停下让用户审——这一轮的关键就是修正。

## 处理多点修改

用户一次给出多处反馈（"2:30 改一下，第五场的图也不对"）：

1. 对每一处分别做"定位+确认"
2. 一起标 stale
3. 最后统一调 workflow-run 一次跑完所有 stale

不要改一处跑一处。批量更省时间，也更容易观察连带效果。

## 处理"整篇重来"

用户说"整个文案推倒重写"：
- units 模式：把所有 units 的 text 和其下游字段全标 stale
- 无 units 模式：从写文案那个 step 开始全部 stale
- 提醒："这等于大部分内容重跑。要不要直接开一个新 run 保留这版做对照?"
- 让用户选：继续 stale 重跑，或者新起一个 run

## 需要警惕的模式

- **不要不经确认就改**。定位再明显也先问。错改一处导致全链重跑，浪费比多问一句大得多。
- **不要依赖固定字段名硬匹配**。读 manifest 结构自己推。
- **不要改产出文件却不更新 manifest**。manifest 是 single source of truth。
- **units 模式下不要把 stale 传播扩大到其他 unit**。改一个只影响它自己和它的下游 step 中本 unit 的部分，不波及兄弟 unit。
- **不要在 revise 流程里改 workflow YAML 模板本身**。要改模板用 workflow-compose，或手改 YAML。revise 只动实例 manifest 和产出文件。
- **小修改不一定要重跑**。如果用户的修改只是"改个错别字"且后续 step 不依赖文本细节，直接改文件、不传播 stale 也是合理选择——告诉用户做了什么决定。
