---
name: runninghub-tts
description: 用 IndexTTS2 模型，以参考音频 + 文本生成配音，下载结果音频文件。用户提到"配音"、"TTS"、"语音合成"、"朗读"、"RunningHub 配音"以及类似意图时，使用本 skill。
---

# runninghub-tts

用 IndexTTS2，以参考音频 + 文本生成配音，下载结果音频文件。

## 使用

```bash
# 提交配音任务（异步，立即返回 task_id）
node .claude/skills/runninghub-tts/scripts/run.js --action start_tts --audio <音频路径> --text <配音文本>

# 查询任务状态 / 下载结果
node .claude/skills/runninghub-tts/scripts/run.js --action get_tts --task-id <task_id> [--output <保存路径>] [--wait <秒数>]
```

参数：
- `--audio` (必填)：参考音频文件本地路径（mp3/wav 等常见格式）
- `--text` (必填)：要配音的文本内容
- `--task-id` (必填，get_tts)：start_tts 返回的 task_id
- `--output` (可选，get_tts)：结果音频保存路径，不指定时返回 audio_url
- `--wait` (可选，get_tts)：等待秒数，循环检查是否完成，完成则提前返回，超时返回 running

## 输出

stdout 输出 JSON。

start_tts 返回：
```json
{ "task_id": "2050940666023976962", "status": "pending", "started_at": 1714732800000, "hint_eta_ms": 90000 }
```

get_tts 返回：
```json
{ "task_id": "...", "status": "completed", "result": { "file_path": "C:\\path\\to\\output.flac", "file_size": 123456 } }
```
status 取值：`pending` | `running` | `completed` | `failed` | `not_found`

## 轮询

`get_tts` 支持 `--wait`，在 wait 秒内自动轮询（每 3 秒检查一次），完成则提前返回，超时返回 running。无需调用方写外部循环。

## 失败模式

stderr 抛 Error，message 含失败原因：
- `未找到音频上传 input`：音频上传 input 不存在
- `运行按钮处于 disabled 状态`：可能积分不足
- `未找到"历史记录"tab`：页面结构变化
- `历史记录中未找到 taskid`：提交后历史记录未出现新任务
- `任务提交失败: 积分不足`：积分不够
- `任务提交失败: 未登录`：登录态丢失

## 并发限制

RunningHub 不支持并发任务。第一个任务还在跑时，点击 RUN 不会创建新任务。workflow 必须是串行的：等前一个任务完成后再提交下一个。`get_tts --wait` 可轮询等待完成。

## 前置条件

基站项目（web-skill-creator-cdp-3）的 dedicated Chrome 必须在 9222 端口运行中，且已在 Chrome 里登录 RunningHub（runninghub.cn）。