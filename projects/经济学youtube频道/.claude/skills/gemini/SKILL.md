---
name: gemini
description: 在 Google Gemini Web 页面上发送 prompt，获取 AI 回复。支持切换模型（快速/思考/Pro）、选择工具（制作图片/Deep Research）、上传文件和图片、新建对话、通过 conversation_id 恢复已有对话、临时会话模式。只要用户提到"问 Gemini"、"让 Gemini 回复"、"在 Gemini 上提问"或类似意图，都使用本 skill。
---

# gemini

在 Google Gemini Web (https://gemini.google.com) 上完成对话操作。

## Actions

| action | 说明 | 入参 | 出参 |
|---|---|---|---|
| chat | 同步：发送 prompt，等待回复完成 | --prompt (必), --model, --tool, --files, --conversation_id, --temporary | JSON（含 text/conversation_id）|
| start_chat | 异步第一步：提交 prompt，拿到 conversation_id | --prompt (必), --model, --files, --conversation_id, --temporary | JSON（含 conversation_id, status=running）|
| get_chat | 异步第二步：用 conversation_id 查结果 | --conversation_id (必) | JSON（含 status/completed/text）|
| start_research | Deep Research 第一步 | --prompt (必), --conversation_id | JSON（含 conversation_id, research_plan_text）|
| get_research_report | Deep Research 第二步（一次检查，不轮询）| --conversation_id (必) | JSON（含 completed/text）|

## 使用

### 同步（适合短问题）

```bash
node skills/gemini/scripts/run.js --action chat \
  --prompt "你的问题" \
  [--model fast|think|pro] \
  [--tool image_gen|deep_research] \
  [--files "path/to/file1,path/to/file2"] \
  [--conversation_id abc123] \
  [--temporary true]
```

### 异步（适合长任务或需要并发）

```bash
# 第一步：提交，拿到 conversation_id
node skills/gemini/scripts/run.js --action start_chat \
  --prompt "长任务 prompt" \
  [--model think]

# 第二步：轮询查结果
node skills/gemini/scripts/run.js --action get_chat \
  --conversation_id <上一步返回的ID>
# → status=completed 时返回 text
# → status=running 时继续等待后重查
```

### 继续已有对话

```bash
node skills/gemini/scripts/run.js --action chat \
  --prompt "追问" \
  --conversation_id <已有ID>
```

## 参数

| 参数 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `--prompt` | chat/start_chat/start_research 必填 | — | 要问的问题 |
| `--model` | 否 | fast | 模型：fast（快速）、think（思考）、pro（3.1 Pro） |
| `--tool` | 否 | — | 工具：image_gen（制作图片）、deep_research（Deep Research） |
| `--files` | 否 | [] | 上传文件路径，逗号分隔，支持图片和文档 |
| `--conversation_id` | 否 | 新建 | 已有对话 ID，从上一次输出的 conversation_id 字段获取 |
| `--temporary` | 否 | false | true=开启临时会话模式 |

## 输出

### chat / start_chat

```json
{
  "text": "Gemini 的回复正文",
  "images": [
    {
      "thumbnail_url": "https://.../thumb/200/...",
      "hd_url": "https://.../thumb/2000/..."
    }
  ],
  "model": "fast",
  "took_ms": 8500,
  "conversation_id": "abc123def456"
}
```

### get_chat

```json
// 回复完成
{
  "conversation_id": "abc123def456",
  "status": "completed",
  "text": "Gemini 的回复正文",
  "images": [],
  "model_used": "think"
}

// 还在生成中
{ "conversation_id": "abc123def456", "status": "running" }
```

**status 枚举**（get_chat）：

| 值 | 含义 |
|---|---|
| `completed` | 成功，`text` 字段有值 |
| `running` | 还在生成，继续轮询 |

### start_research

```json
{
  "conversation_id": "abc123def456",
  "research_plan_text": "研究方案摘要文字..."
}
```

### get_research_report

```json
{ "text": "完整研究报告文字...", "completed": true }
```

## 并发能力

| action | 模式 | 说明 |
|---|---|---|
| chat | serial-only | 使用 OS 剪贴板，不支持并发 |
| start_chat | serial-only | 提交串行，但提交后立即返回 |
| get_chat | parallel-safe | 只读操作，可并发 poll 多个 conversation_id |
| get_research_report | parallel-safe | 只读操作 |

## 失败模式

stderr 抛 Error，message 含失败原因：

- `LoginRequired`：登录态丢失（页面跳转到了登录页）
- `AntiBotError`：触发反爬检测（出现验证码/unusual activity）
- `RateLimitError`：频率限制

失败时 page 不关闭，可用 MCP 查看现场。

## 前置条件

基站项目（web-skill-creator-cdp-3）的 dedicated Chrome 必须在 9222 端口运行中，且已在 Chrome 里登录 https://gemini.google.com。
