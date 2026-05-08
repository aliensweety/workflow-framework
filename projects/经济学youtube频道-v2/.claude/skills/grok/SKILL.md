---
name: grok
description: 调用 Grok 网页端（grok.com）发送文本 prompt 并拿回 AI 回复，支持选择模型（auto/fast/expert/heavy/grok-4.3）和继续已有对话。当用户问 Grok / 让 Grok 回答 / Grok 帮我 / Grok 搜索 / 用 Grok 写代码 / 翻译 / 解释 以及类似让 AI 回答问题的意图时，使用本 skill。
---

# grok

在 Grok 网页端发送文本 prompt，获取 AI 回复。支持同步和异步两种调用方式。

## Actions

| action | 说明 | 入参 | 出参 |
|---|---|---|---|
| chat | 同步：发送 prompt，等待回复完成 | --prompt (必), --file (可选，可多次), --model (可选), --conversation_id (可选), --private (可选) | JSON（含 reply 字段）|
| start_chat | 异步第一步：提交 prompt，拿到 conversation_id | --prompt (必), --file (可选，可多次), --model (可选), --private (可选) | JSON（含 conversation_id, status=running）|
| get_chat | 异步第二步：用 conversation_id 查结果 | --conversation_id (必) | JSON（含 status/completed/reply）|

## 使用

### 同步（适合短问题，回复通常 3~16s）

```bash
# 从调用方项目根目录出发，Junction 解析到基站 skill
node .claude/skills/grok/scripts/run.js --action chat --prompt "你的问题"
node .claude/skills/grok/scripts/run.js --action chat --prompt "你的问题" --model expert
```

### 异步（适合长任务或需要并发）

```bash
# 第一步：提交，拿到 conversation_id
node .claude/skills/grok/scripts/run.js --action start_chat --prompt "长任务 prompt"

# 第二步：轮询查结果
node .claude/skills/grok/scripts/run.js --action get_chat --conversation_id <id>
# → status=completed 时返回 reply
# → status=running 时继续等待后重查
```

### 继续已有对话

```bash
node .claude/skills/grok/scripts/run.js --action chat --prompt "追问" --conversation_id <id>
```

### 输出文件

```bash
node .claude/skills/grok/scripts/run.js --action chat --prompt "你的问题" --output reply
```

`--output` 把结果保存到指定路径，后缀固定为 `.json`（忽略调用方传入的任何后缀）。调用方需要什么字段自己解析 JSON。

**参数：**

| 参数 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `--prompt` | chat/start_chat 必填 | — | 要问 Grok 的问题 |
| `--file` | 否 | — | 上传本地文件作为聊天附件，可多次使用上传多个 |
| `--model` | 否 | auto | 模型：auto / fast / expert / grok-4.3 / heavy |
| `--conversation_id` | 否 | — | 已有对话 ID，继续该对话 |
| `--private` | 否 | — | 开启隐私对话（一次性，无历史记录，关掉后无法继续） |
| `--output` | 否 | stdout | 保存路径（后缀固定为 .json）|

## 输出

### chat / start_chat

```json
{
  "reply": "Grok 的完整回复正文",
  "conversation_id": "cc3591f2-62be-49e8-bb50-b9fb4eebcc26",
  "conversation_url": "https://grok.com/c/cc3591f2-62be-49e8-bb50-b9fb4eebcc26",
  "model_used": "auto",
  "took_ms": 5234,
  "status": "success"
}
```

### get_chat

```json
// 回复完成
{
  "conversation_id": "...",
  "status": "completed",
  "reply": "Grok 的完整回复正文",
  "model_used": "expert"
}

// 还在生成中
{ "conversation_id": "...", "status": "running" }
```

**status 枚举**（get_chat）：

| 值 | 含义 |
|---|---|
| `completed` | 成功，`reply` 字段有值 |
| `running` | 还在生成，继续轮询 |
| `not_found` | conversation_id 找不到（导航失败时） |

## 并发能力

| action | 模式 | 说明 |
|---|---|---|
| chat | serial-only | 使用 OS 剪贴板，不支持并发 |
| start_chat | serial-only | 同上（提交串行，但提交后立即返回）|
| get_chat | parallel-safe | 只读操作，可并发 poll 多个 conversation_id |

## 失败模式

stderr 抛 Error，message 含失败原因。常见：

- **AntiBotError**：触发反爬检测（unusual activity / captcha）
- **RateLimitError**：频率限制
- **Selector timeout**：页面结构变化，selector 失效
- **Reply timeout**：同步 chat 120 秒内未完成回复（异步 start_chat 无此限制）

失败时 page 不关闭，可用 MCP 查看现场。

## 前置条件

基站项目（web-skill-creator-cdp-3）的 dedicated Chrome 必须在 9222 端口运行中，且已在 Chrome 里登录 https://grok.com。

**禁止直接用 MCP browser 工具操作 Grok 页面**——高频操作场景下走 skill 脚本才是正确的使用方式。MCP 是低频工具，直接用 MCP 操作会绕过 skill 的节流和健壮性处理，累计高频请求容易触发风控。
