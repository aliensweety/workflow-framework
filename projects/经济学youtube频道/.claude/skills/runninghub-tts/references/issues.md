# runninghub-tts issues

---

## 方法论 — UI 操作 + API 直接提交

**状态**：已验证（RunningHub TTS 场景）

**背景**：RunningHub 的"运行"按钮是 `<div class="ai-btn-run">`（非真实 `<button>`），事件是委托的。Playwright CDP attach 模式下 `dispatchEvent` / `btn.click()` / `page.locator().click()` 均无法触发提交。

**解决思路**：

1. **抓包找 API**：观察正常操作时的网络请求，找到点按钮时实际发出的 API
   - 本例：`POST https://www.runninghub.cn/task/webapp/create`
   - 请求体结构：webappId + inputs 数组（字段名、字段值、nodeId、nodeName）

2. **从 cookie 提取认证 token**
   - 本例：`Rh-Accesstoken=...` → `Authorization: Bearer ...`
   - 用 `document.cookie.match(/Rh-Accesstoken=([^;]+)/)`

3. **UI 操作仍用 Playwright**（这些没有事件委托问题）
   - textarea：`page.evaluate()` 写 `.value` + React `input` 事件
   - 音频上传：`fileInput.setInputFiles()`

4. **提交改用 `fetch` API**
   - `page.evaluate(() => fetch(url, { method: 'POST', headers: {...}, body: JSON.stringify({...}) }))`
   - 从响应直接拿 taskId，不依赖 DOM 轮询

**适用场景**：
- 按钮是 `<div>`/`<span>` 等非真实元素，事件委托导致 Playwright 点击失效
- 需要高可靠性的提交场景，不希望依赖按钮 DOM 状态轮询

**风险与限制**：
- **绕过 UI 防抖**：API 没有 UI 那样的"等待按钮就绪"逻辑，可能被服务端限流
- **请求结构需抓包**：需先观察正常操作时的网络请求
- **cookie 认证依赖**：必须从页面 cookie 拿 token（不能用纯 headless 脚本）
- **请求结构可能变**：网站改版时 inputs 数组的 nodeId/nodeName 容易失效
- **其他网站的检测**：对有行为分析/请求频率监控的系统，API 调用反而比 UI 点击更容易触发风控

**发现时间**：2026-05-06

---

## 已知问题

### 1. 连续快速提交时 waitForRunBtnReady 超时
**严重程度**：低  
**触发条件**：队列较长（8+）时连续调用 `start_tts`，音频上传后按钮状态恢复慢  
**现象**：`等待运行按钮就绪超时（30s）`  
**原因**：队列积压时音频处理完成后按钮状态更新延迟  
**当前处理**：无自动重试  
**建议**：可在 `waitForRunBtnReady` 超时后加一次 `sleep(5000)` 再重试的逻辑

---

## 已解决

### 4. clipboard paste 对 5000+ 字符不可靠
**状态**：已解决
**原因**：`navigator.clipboard.writeText()` + `Control+v` 在大文本场景下内容丢失。更深层原因：`dispatchEvent` 的按钮点击被 RunningHub 前端拦截，提交不触发。
**修复**：改用 JS 写入 textarea + 直接调 `POST /task/webapp/create` API（从 cookie 的 `Rh-Accesstoken` 取 Bearer token）。绕过按钮点击。
**验证**：实测 4612 字长文本 API 直接提交成功，返回 taskid `2051965300043333634`。
**发现时间**：2026-05-06

### 1. taskid 检测返回旧值（历史记录旧 task）
**状态**：已解决  
**原因**：`page.evaluate(() => document.body.innerText)` 在 CDP 模式下返回缓存 DOM 值  
**修复**：改用 `page.locator().textContent()` 或 `page.evaluate()` 读实时 DOM  
**方案**：提交成功后直接读 `body.innerText` 中第一个 `taskid:` 匹配项（历史面板顶部最新任务）

### 2. 提交后 textarea 未清空 / 历史面板无新 task
**状态**：已解决  
**原因**：同问题 1  
**修复**：taskid 检测改为页面 body 全文搜索

### 3. `page.evaluate` 返回缓存 DOM
**状态**：已解决  
**说明**：Playwright CDP attach 模式下 `evaluate()` 读缓存，需要用 locator API 或强制刷新后读取  
**修复**：关键读取（按钮文本、taskid）均改用 locator 或 `evaluate()` 读实时 DOM（对 body.innerText 有效）