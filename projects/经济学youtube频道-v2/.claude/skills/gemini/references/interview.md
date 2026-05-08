# Interview —— Gemini Web

## What this flow does

让 AI 用 Gemini 账号发 prompt、获取回复。回复可能是纯文字、文字+图片、或纯图片。Skill 支持：切换模型（快速/思考/Pro）、选择工具（制作图片/Deep Research）、上传文件（图片/文档）、新建对话、通过 conversation_id 恢复已有对话、临时会话。

## Expected result

- 数据结构: JSON
- 字段:
  - `text` (string, 必): 回复正文（纯文字或空字符串）
  - `images` (array, 可选): 回复中的图片列表，无图片时为空数组 []
    - `thumbnail_url` (string): 复制用缩略图 URL
    - `hd_url` (string): 下载用高清原图 URL
  - `model` (string, 必): 实际使用的模型 id（fast / think / pro）
  - `took_ms` (number, 必): 总耗时（毫秒）
  - `conversation_id` (string, 必): 本次对话的 ID（用于后续恢复）

## Parameters

| 参数 | 类型 | 取值 | 默认值 | 必填 |
|---|---|---|---|---|
| `prompt` | string | 任意文本 | — | 是 |
| `files` | array | 文件路径数组 | [] | 否 |
| `model` | string | fast / think / pro | fast | 否 |
| `tool` | string | image_gen / deep_research | （无）| 否 |
| `conversation_id` | string | 已有对话 ID | 新建 | 否 |
| `temporary` | boolean | true / false | false | 否 |

## Constraints

- 未登录时页面会跳转到登录页（本次已登录，跳过）
- image_gen 和 deep_research 不能同时开启
- 上传文件有大小限制（需实测）
- 发送按钮在输入框为空时 disabled，有内容才可点击
- 多轮对话中，"最后一条回复"需要用发送按钮所在区域的上一个兄弟元素来定位（即用户发送的那条消息的下一个 sibling 就是最新的回复）
- 工具菜单展开后会覆盖模型选择器，需先关闭工具菜单再操作模型
- 图片悬停才显示复制/下载按钮

## 给 03-walkthrough 的清单

> 03 阶段必须用 MCP 亲手走一遍下面每一项

- [ ] 主流程（fast 模型，纯文字 prompt → 获取回复）
- [ ] 模型 fast：正常对话
- [ ] 模型 think：正常对话
- [ ] 模型 pro：正常对话
- [ ] 工具 image_gen：制作图片，验证图片返回格式
- [ ] 工具 deep_research：Deep Research 模式
- [ ] 上传单个图片文件
- [ ] 上传多个文件（图片+文档混搭）
- [ ] 新建对话
- [ ] 通过 conversation_id 恢复已有对话（不支持从历史列表选择）
- [ ] 临时对话（temporary=true）
- [ ] 失败路径：未登录（已知：会跳登录页，本次跳过）
- [ ] 多轮对话：连续发两条，确认最后一条回复的定位方式
- [ ] 多轮对话带图片：验证回复中图片的 thumbnail_url 和 hd_url
