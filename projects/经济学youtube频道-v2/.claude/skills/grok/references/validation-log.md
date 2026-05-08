# Validation Log —— grok

> 05-validation 阶段记录。dev step 全部跑通，端到端验证。

## dev step 验证结果

| 段 | dev step | 验证结果 | 关键发现 |
|---|---|---|---|
| A | step-A.js | ✅ | `div.ProseMirror[contenteditable="true"]` 就绪 |
| B | step-B.js | ✅ | human.type 逐字输入，SUBMIT 正确 enabled |
| C | step-C.js | ✅ | 提交后 URL 跳转到 `/c/{uuid}` |
| D | step-D.js | ✅ | 双路 race 3.5s 收到 done，reply 提取 "2"，"Thought for Xs" 前缀正确去掉 |
| E | step-E.js | ✅ | 5 个模型全部可选择（修复 has-text 大小写 + 精确 span 匹配） |
| F | step-F.js | ✅ | conversation_id 继续对话成功，追问追加新回复 |

## step-E 关键修复

**问题**：`[role="menuitem"]:has-text("Fast")` 大小写敏感，匹配到 Auto 菜单项的描述文本 "Chooses Fast or Expert"。

**修复**：改用 `[role="menuitem"]:has(span:text-is("Fast"))` 精确匹配模型名 span。  
**信号来源**：`probe` 探针确认菜单结构为 `[role="menuitem"] > span:模型名 + span:描述`。

## 端到端试跑

| # | action | 参数 | 结果 | 耗时 | 备注 |
|---|---|---|---|---|---|
| 1 | chat | prompt="What is 2+2?" | ✅ | 16.1s | 新对话，reply="4" |
| 2 | chat | prompt="What is 3x3?", model=expert | ✅ | 11.3s | 切 expert 模型，model_used="expert" |
| 3 | chat | prompt="What is the capital of France?", --output file | ✅ | ~10s | 文件输出正常 |

## 修复记录

- **signals.js `modelOption`**：从 `has-text` 改为 `has(span:text-is(...))` 精确匹配，解决大小写敏感 + 描述文本误匹配问题
- **human.js**：加注 `paste()` 为合法输入方式（不走 `fill()`）

## 已知限制

- `--output` 参数路径中 `\t` 被 Node 当作 tab 字符 → 使用正斜杠路径规避
