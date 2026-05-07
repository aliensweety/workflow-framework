# Implementation Notes —— Gemini Web

## 段构造记录

| 段 | 操作 | dev step 脚本 | 验证后的 selector | 备注 |
|---|---|---|---|---|
| 1 | 打开主页 + 等输入框 | step-1.js | `S.COMPOSER` = `div.ql-editor[aria-label="为 Gemini 输入提示"]` | contenteditable div |
| 2 | 输入 prompt + 发送 + 等回复 | step-2.js + probe | `S.SUBMIT` = `button[aria-label="发送"]` | 发送按钮以 disabled 状态判断就绪 |
| 3 | 模型选择器 + 选项 | step-3.js | `S.MODEL_SELECTOR` = `button[aria-label="打开模式选择器"]` | `S.MODEL_OPTION(name)` = `[role="menuitem"]:has-text("${name}")` |
| 4 | think 模型发问题 | step-4.js | 模型名映射 `MODEL_MAP: {fast:'快速', think:'思考', pro:'Pro'}` | think 模型响应时间略长 |
| — | 工具菜单 | probe-tool-flow.js | `S.TOOLS_MENU` = `button:has-text("工具")` | aria-label 在 DOM 不存在 |
| — | 工具选项 | probe-tool-flow.js | `S.TOOL_OPTION(name)` = `[role="menuitemcheckbox"]:has-text("${name}")` | 选中后菜单自动关闭 |
| — | 回复提取 | probe-dom.js | h2 "Gemini 说" 的 parentElement.innerText | reply container = h2.parentElement |

## 关键发现

- **回复 DOM 结构**：`h2:has-text("Gemini 说")` 的父容器包含所有回复文字
- **发送按钮等待**：不能用简单的 disabled 检查，think 模型期间按钮消失。改用两步等待：先等按钮 disabled，再等 enabled + 文字出现
- **工具按钮 aria-label**：a11y 显示"工具"但 DOM 无 aria-label，只能用 `button:has-text("工具")`
- **模型选项**：role=`menuitem`，中文显示名需 MODEL_MAP 映射
- **image_gen 工具**：激活后进入风格选择 UI（"为图片选择风格"），需用户先选风格才能生成图片

## Deep Research 完成信号

| 场景 | 回复完成信号 |
|---|---|
| 普通回复 | `button[aria-label="发送"]` 从 disabled → enabled |
| Deep Research | DOM 文本中出现"已完成"（用 TreeWalker 搜索） |

Deep Research 两阶段：
1. **start_research**: 激活工具 → 发 prompt → 等研究方案出现 → 点击"开始研究"按钮（填入 composer）→ 点击发送 → 返回 conversation_id
2. **get_research_report**: 携带 conversation_id 打开页面 → 轮询 DOM 等"已完成"出现 → 提取报告文字

### "开始研究" 关键发现
- **"开始研究"按钮点击行为**：点击后在 composer 里填入"开始研究"文字，不会自动发送
- **必须两步**：click("开始研究" button) → click("发送")
- 研究开始后状态显示"正在研究 X 个网站…"
- 研究完成：status 变为"已完成"，最终报告出现在 chat 区（第三个 h2 "Gemini 说"）

## actions 列表

| action | 入参 | 出参 | 失败模式 |
|---|---|---|---|
| chat | prompt, model?, files?, tool?, conversation_id?, temporary? | {text, images, model, took_ms, conversation_id} | LoginRequired / AntiBot / RateLimit |
| start_research | prompt, model?, conversation_id? | {conversation_id, research_plan_text} | — |
| get_research_report | conversation_id, timeout? | {text, completed: bool} | — |

## 验证状态

- ✅ 基本 chat（fast 模型）
- ✅ 模型切换（think、pro）
- ✅ image_gen 工具激活（风格选择 UI 出现）
- ✅ deep_research 工具（完整两阶段流程已验证）
- ✅ 临时会话（temporary=true）
- ✅ 文件上传（filechooser 拦截 + setFiles）
- ✅ conversation_id 恢复（URL 全程保持不变）

## 文件上传机制

- 文件上传通过原生 OS 文件对话框（`input[type="file"]` 隐藏）
- Playwright 拦截：`page.waitForEvent('filechooser')` + `fileChooser.setFiles()`
- 上传成功 UI：`button "移除文件"test-upload.png""` + `composer.style="--uploader-height: 80px"`
