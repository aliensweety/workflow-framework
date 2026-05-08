# Implementation Notes —— grok

> 按新流程（04-incremental-build）重构后的开发记录。

## selector 集中管理（lib/signals.js）

| 信号 | Selector | 来源 dev step |
|---|---|---|
| COMPOSER | `div.ProseMirror[contenteditable="true"]` | step-A |
| SUBMIT | `button[aria-label="Submit"]` | step-B |
| SUBMIT_ENABLED | `button[aria-label="Submit"]:not([disabled])` | step-B |
| MODEL_SELECT | `button[aria-label="Model select"]` | step-E |
| modelOption(name) | `[role="menuitem"]:has(span:text-is("${MODEL_LABELS[name]}"))` | step-E（修复：精确匹配 span 避免误匹配描述文本）|
| REPLY_DONE | `button[aria-label="Like"]` | step-D |
| ANTIBOT | `[aria-label*="verify"],[aria-label*="captcha"],[aria-label*="unusual"]` | step-D |
| RATE_LIMIT | `[role="alert"]:has-text("rate limit")` | step-D |

## dev step 清单（新规范：字母命名，独立可重复跑）

| 段 | dev step | 验证内容 | 状态 |
|---|---|---|---|
| A | `dev/step-A.js` | 开页 + 等 COMPOSER 就绪 | ✅ |
| B | `dev/step-B.js` | human.type 逐字输入 + SUBMIT enabled | ✅ |
| C | `dev/step-C.js` | 提交 + 等 URL 跳转到 /c/{id} | ✅ |
| D | `dev/step-D.js` | 完整流程 + 双路 race 等回复完成 | ✅ |
| E | `dev/step-E.js` | 模型选择各取值（auto/fast/expert/grok-4.3/heavy） | ✅ |
| F | `dev/step-F.js` | conversation_id 继续对话 | ✅（需真实 ID）|

## 段与段之间的发现

### 段 A
- DOM 类型确认：`div.ProseMirror[contenteditable="true"]`
- TipTap 编辑器，必须 keyboard.type 逐字

### 段 B
- 提交按钮有 disabled 状态，必须等 `:not([disabled])` 才点
- human.type 后自动 enable

### 段 C
- 提交后 URL 从 `/` 跳转到 `/c/{uuid}`

### 段 D
- **双路等待**：`Promise.race([REPLY_DONE, ANTIBOT, RATE_LIMIT])`
- Like 按钮出现即回复完成（仅 assistant 消息有）
- 回复内容从 Like 按钮向上找 `.message-bubble`
- Thinking 前缀需去掉：`text.replace(/^Thought for \d+s\s*/, '')`

### 段 E
- 模型列表：auto / fast / expert / grok-4.3 / heavy（全部可选择）
- heavy 实测不触发订阅墙（可直接选）
- 菜单结构：`[role="menuitem"] > span:模型名 + span:描述`
- **重要修复**：`has-text("Fast")` 误匹配 Auto 描述 → 改用 `has(span:text-is("Fast"))`

### 段 F
- conversation_id 直接拼 URL 打开
- 继续对话输入框在底部，可能被"Scroll down"按钮挡
- 多轮对话时取 `document.querySelectorAll('button[aria-label="Like"]')` 最后一个

## actions/chat.js 结构

```
段 A: goto + waitForSelector(COMPOSER)
段 B: human.type(COMPOSER, prompt)
段 C: human.click(MODEL_SELECT) + modelOption(model) [可选]
段 D: human.click(SUBMIT_ENABLED) + waitForFunction(/c/)
段 E: Promise.race([REPLY_DONE, ANTIBOT, RATE_LIMIT])
段 F: evaluate 提取 reply
```

## 硬规范检查

- [x] success-flag 模式（失败保留 page）
- [x] 双路等待（Promise.race 成功+失败信号）
- [x] input 用 human.type 逐字
- [x] newPage 后立即 bringToFront
- [x] run.js 末尾 process.exit(0)
- [x] dev/ 下无一次性 probe 脚本
- [x] dev step 末尾 dev.hold() 挂住
- [x] 所有 selector 在 signals.js，来源追溯到 dev step
