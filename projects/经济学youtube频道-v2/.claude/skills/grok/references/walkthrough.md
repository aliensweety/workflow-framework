# Walkthrough —— grok

日期: 2026-04-30

## 输入框

- DOM: `div.ProseMirror.tiptap[contenteditable="true"]`
- 父容器: `[data-testid="chat-input"]`
- Placeholder: "What do you want to know?"（`data-placeholder` 属性）
- TipTap/ProseMirror 编辑器，必须 keyboard.type() 逐字输入

## 模型选择

- 触发: `button[aria-label="Model select"]`
- 当前默认: Auto（不是 fast）
- 下拉菜单: `[role="menu"]` > `[role="menuitem"]`
- 可选模型:
  - Auto - "Chooses Fast or Expert"（默认）
  - Fast - "Quick responses"
  - Expert - "Thinks hard"
  - Grok 4.3 (beta) - "Early Access"
  - Heavy - "Team of Experts"
- 选中状态: 当前选中的 menuitem 里有 checkmark img

## 提交按钮

- `button[aria-label="Submit"]`
- 空输入时 disabled + hidden
- 有内容后 enabled + visible

## 回复完成信号

- 待 dev step 验证（上次用 `button[aria-label="Like"]` 作完成信号）
- 预期：回复完成后出现 Like/Dislike/Regenerate 按钮

## 回复提取

- 待 dev step 验证
- 上次用 `.message-bubble` 定位消息容器，nextElementSibling 找 Grok 回复

## URL 导航

- 新对话: `https://grok.com/`
- 提交后跳转: `https://grok.com/c/{conversation_id}`
- 回复完成后: `https://grok.com/c/{conversation_id}?rid={response_id}`

## 其他 UI 元素

- "Switch to Private Chat": link at `/c#private`
- "Attach" 按钮: `button[aria-label="Attach"]`（文件上传）
- SuperGrok 升级横幅: 始终在页面底部
- X 账号连接提示: 可关闭

## 反爬观察

- 未发现 unusual activity / verify 提示
- TipTap 编辑器需要逐字输入（fill 可能触发反爬）
