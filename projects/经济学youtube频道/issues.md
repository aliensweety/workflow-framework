---

## 方法论 — UI 操作 + API 直接提交

**状态**：resolved（RunningHub TTS 场景验证通过）

**背景**：RunningHub 的"运行"按钮是 `<div class="ai-btn-run">`（非真实 `<button>`），事件是委托的。在 Playwright CDP attach 模式下，`dispatchEvent` / `btn.click()` / `page.locator().click()` 均无法触发提交（前端事件处理不响应非真实用户操作）。

**解决思路**：

1. 观察浏览器的**网络请求**，找到点按钮时实际发出的 API 请求
   - 本例：`POST https://www.runninghub.cn/task/webapp/create`
   - 请求体：webappId + inputs 数组（字段名、字段值、nodeId、nodeName）

2. 从**页面 cookie**提取认证 token
   - 本例：`Rh-Accesstoken=...` → `Authorization: Bearer ...`

3. UI 操作（填 textarea、上传音频）仍用 Playwright 完成
   - textarea：`page.evaluate()` 写 `.value` + React `input` 事件
   - 音频上传：`fileInput.setInputFiles()`

4. 提交一步改用 `page.evaluate(() => fetch(...))` 直接调 API
   - 绕过按钮点击
   - 从 API 响应直接拿 taskId，不依赖 DOM 轮询

**适用场景**：
- 网站按钮是 `<div>`/`<span>` 等非真实元素，事件委托，Playwright 点击失效
- 需要高可靠性的提交场景，不希望依赖 DOM 状态轮询

**风险与限制**：
- **绕过 UI 防抖**：API 没有 UI 那样的"等待按钮就绪"逻辑，可能被服务端限流
- **请求结构需抓包**：需要先观察正常操作时的网络请求
- **cookie 认证依赖**：必须从页面 cookie 拿 token（不能用纯 headless 脚本）
- **请求结构可能变**：网站改版时 inputs 数组的 nodeId/nodeName 容易失效

**发现时间**：2026-05-06

---



记录工具问题——skill / 脚本的 bug、缺依赖、调用方式不顺手等等。

这些不是 workflow 的事，应该回到对应 skill / 脚本的源项目里修。
本文档只负责记录现象，不负责修复。

格式建议（不强制）：

---

## <Skill 或 脚本名>

**状态**：open | in_progress | resolved | wontfix

**问题描述**：

**复现条件 / 错误信息**：

**临时 workaround**（如有）：

**发现时间**：

---

---

## runninghub-tts — start_tts 长文本无法正确识别完成

**状态**：resolved

**问题描述**：长文本（约 1850 词）提交后，`start_tts` 无法找到新 task。

**根因**：逐字打（`keyboard.type`）速度太慢，1850 词打完页面可能已超时或被浏览器截断。

**修复**：`start_tts` 改为粘贴（`navigator.clipboard.writeText` + `Control+v`），不再逐字打。

**发现时间**：2026-05-06

---

## google-flow — 生成时遭遇 "unusual activity" 限制

**状态**：resolved

**问题描述**：提交 prompt 生成图片时，Flow 弹出 "We noticed some unusual activity. Please visit the Help Center" 导致生成失败。

**根因**：MCP browser 工具直接操作 Flow 页面，不走 skill 的 human.* 节流机制，容易触发风控。

**修复**：google-flow SKILL.md 已补充 `AntiBotDetected` 失败模式，并明确禁止直接用 MCP browser 工具操作 Flow。

**复现条件 / 错误信息**：
- 触发频率：高（本次测试中单次生成即触发）
- 错误类型：AntiBot / rate limit（服务端检测，非客户端代码问题）
- 提示文案："We noticed some unusual unusual activity. Please visit the Help Center"

**临时 workaround**：未知（可能需要等待一段时间后重试，或在浏览器里手动完成验证）

**发现时间**：2026-05-05

**修复建议方向**：
- skill 层面：捕获 "unusual activity" 错误文案，在 SKILL.md 的失败模式表格中补充 `AntiBotError` 或类似错误类型
- 可能的自动化解法：等待一段时间、清除 session cookie、换 IP 等

---

## grok — 前置条件未满足时脚本应直接报错

**状态**：resolved

**问题描述**：运行 `grok/scripts/run.js` 时报错 `locator.waitFor: Timeout 10000ms exceeded`，等待 `button[aria-label="Submit"]` 出现。

**根因**：
1. Grok 新版没有 Submit 按钮，改用 Enter 提交
2. 回复完成信号是 `button[aria-label="赞"]`（不是 "Like"）

**修复**：
- chat.js：Enter 替代 Submit 按钮，`modelUsed` 变量提前声明
- signals.js：`REPLY_DONE` 改为 `button[aria-label="赞"]`
- chat.js：进页后自动关闭 X 关联弹窗和 cookie 弹窗

**发现时间**：2026-05-05

---

## grok — SKILL.md 未说明 --file 参数

**状态**：resolved

**问题描述**：Grok skill 支持 `--file` 参数上传本地文件，但 SKILL.md 里没有明确说明这个功能的用途和用法。

**修复**：grok SKILL.md 参数说明已补充 `--file` 用法：上传本地文件作为聊天附件，可多次使用上传多个。

**发现时间**：2026-05-06

---

## google-flow — 并行生成超时

**状态**：resolved

**根因**：Google Flow 是有状态 Web 应用，多个 tab 同时打开同一 project URL 时 session 冲突，服务器拒绝或超时。这是 Flow 端限制，非代码 bug。

**临时 workaround**：workflow 里保持 parallelism: 1，串行执行。（workflow 默认即如此，无需额外配置）

**发现时间**：2026-05-05

**修复**：无需代码修改，google-flow SKILL.md 已补充并发限制说明。

---

## runninghub-tts — start_tts 仍然失败（clipboard 修复后）

**状态**：resolved

**根因**：history panel 折叠时 taskid 不在 `body.innerText` 里；`prevTaskIds` 策略需在点击前展开面板

**修复**：点击前调用 `ensureHistoryPanelOpen`，用 `body.innerText` 正则匹配 taskid 并排除旧任务。

---

## runninghub-tts — start_tts 生成了"测试文本"音频

**状态**：resolved

**根因**：clipboard paste 对 5000+ 字符不可靠，`navigator.clipboard.writeText()` + `Control+v` 粘贴大文本时内容丢失

**修复**：改为 JS 直接写入 `textarea.value` + React 事件

**运行命令**：
```bash
node "D:/cc内容项目/workflow-framework/projects/经济学youtube频道/.claude/skills/runninghub-tts/scripts/run.js" \
  --action start_tts \
  --audio "D:/cc内容项目/workflow-framework/projects/经济学youtube频道/ref-audio.mp3" \
  --text "$(cat 'D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/script.md')" \
  --output "D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/tts_start.json"
```

**现象**：生成的音频只有"测试文本"四个字，不是完整文案。

**用户判断**：根因是 Task ID 获取错误，不是命令行长度限制。

**发现时间**：2026-05-06

---

## runninghub-tts — start_tts 长文本超出命令行参数长度限制

**状态**：resolved

**问题描述**：当 `--text` 参数内容很长（~1850 词，约 10KB+）时，Windows 命令行 `process.argv` 无法承载。

**根因**：Windows argv 约 8KB 上限

**修复**：run.js 新增 `--text-file <路径>` 参数，直接读取文件内容。

---

## 全局规范 — 禁止擅自修改 skill

**状态**：open

**问题描述**：Claude Code 在遇到 skill 问题时，倾向于自行排查并修改 skill 的 SKILL.md 或脚本代码。

**规范**：
- **禁止**修改任何 skill 的 SKILL.md、脚本文件、lib 文件
- 遇到问题 → 直接在 issues.md 记录运行指令 + 报错结果，**不做任何分析、根因推断或代码修改**
- skill 的维护由专门的 Claude Code 实例统一处理

**发现时间**：2026-05-06

---

## google-flow — AntiBot detected

**状态**：open

**运行命令**：
```bash
node "D:/cc内容项目/workflow-framework/projects/经济学youtube频道/.claude/skills/google-flow/scripts/run.js" \
  --action generate \
  --prompt "..." \
  --project-id 4cfa18e8-202b-4ea0-9326-557b39f3fb70 \
  --output "..."
```

**报错**：`[run.js] AntiBotDetected: unusual activity detected, profile may be blocked`

**发现时间**：2026-05-06

---

## grok — dialog-portal 弹窗阻塞输入

**状态**：resolved

**根因**：Grok 有多种弹窗（添加连接器、隐私偏好中心）挡住输入框，closeModals 未覆盖这些。

**修复**：chat.js 已补充 `[aria-label="关闭"]`、`[data-analytics-name="add-connector-modal"] button`、`[aria-label="隐私偏好中心"] button` 等关闭逻辑。

---

## runninghub-tts — start_tts 分片后仍然失败

**状态**：resolved

**根因**：按钮点击（`dispatchEvent`）在 CDP 模式下被 RunningHub 前端拦截，事件不触发提交

**修复**：改用直接调 `POST /task/webapp/create` API，从 cookie 的 `Rh-Accesstoken` 取 Bearer token。实测 4612 字长文本直接 API 提交成功，返回 taskid `2051965300043333634`。
