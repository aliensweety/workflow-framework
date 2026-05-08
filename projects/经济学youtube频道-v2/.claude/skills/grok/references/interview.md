# Interview —— grok

## What this flow does

在 Grok 网页端发送一条文本 prompt，等待流式回复完成，提取完整回复内容及元数据返回。

## Expected result

- 数据结构: JSON
- 字段:
  - `reply` (string): Grok 完整回复正文
  - `conversation_id` (string): 对话 ID（从 URL 提取）
  - `conversation_url` (string): 对话链接
  - `model_used` (string): 实际使用的模型
  - `took_ms` (number): 耗时毫秒
  - `status` (string): "success" / "error"

## Parameters

| 参数 | 类型 | 取值范围 | 默认值 | 必填 |
|---|---|---|---|---|
| prompt | string | 任意文本 | 无 | 是 |
| model | string | 待 walkthrough 确认 | 默认（不切换） | 否 |
| conversation_id | string | URL 中的对话 ID | 无（新对话） | 否 |

## Constraints

- 输入框可能是 TipTap/ProseMirror contenteditable DIV，需 walkthrough 确认
- 必须用 keyboard.type() 逐字输入，禁止 fill()
- 回复是流式输出，需等待完成信号
- 当前 UI 显示默认模型为 "Auto"（上次开发时为 "fast"，需确认模型列表）

## 给 walkthrough 的清单

- [ ] 主流程：输入框定位 → 输入 → 提交 → 等回复 → 提取回复
- [ ] 输入框 DOM 类型确认
- [ ] 模型选择器及可选模型列表
- [ ] 提交按钮行为（disabled → enabled）
- [ ] 回复完成信号确认
- [ ] 回复内容提取方式
- [ ] 继续对话（已有 conversation_id）
- [ ] 失败信号（rate limit / unusual activity）
