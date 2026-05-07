# grok skill issues

## dialog-portal 弹窗阻塞输入

**状态**：resolved

**问题描述**：运行 `chat` action 时报错 `locator.click: Timeout... <div id="dialog-portal"> subtree intercepts pointer events`

**根因**：Grok 有多种弹窗可能挡住输入框：
1. `添加连接器` 弹窗（`<div role="dialog" data-analytics-name="add-connector-modal">`），关闭按钮 `[aria-label="关闭"]`
2. `隐私偏好中心` OneTrust cookie 弹窗（`<div role="dialog" aria-label="隐私偏好中心">`）
   - 弹窗本身 `display: block` / `pointerEvents: auto`，阻挡点击
   - 但内部所有按钮 `offsetParent === null`（不可见），无法点击
   - 这是 OneTrust SDK 加载延迟导致的半渲染状态

**修复**：chat.js 的弹窗关闭逻辑补充：
- `'[aria-label="关闭"]'` — 添加连接器弹窗
- `'[data-analytics-name="add-connector-modal"] button'` — 连接器弹窗内按钮
- `[aria-label="隐私偏好中心"] button:has-text("接受")` — 隐私弹窗接受按钮
- **终极兜底**：`page.evaluate()` 直接隐藏 OneTrust 弹窗（`el.style.display = 'none'`），当检测到弹窗存在但内部按钮不可见时强制隐藏

**验证**：2026-05-07 实测 `Hello` prompt 正常回复 `"Hello! 👋 What's on your mind today?"`

**发现时间**：2026-05-07

---