# Implementation Notes —— runninghub-tts

## 段构造记录

| 段 | 操作 | dev step | 验证后的 selector | 备注 |
|---|---|---|---|---|
| A | 打开页面 + 上传音频 + 输入文本 + 点运行 | dev/step-A.js | 全部验证通过 | textarea 用 .last()，file input 用 .last() |
| - | 验证运行面板 → 历史记录 → audio src 对应关系 | MCP evaluate | .rh-task-item（运行中）.history-item（完成后） | 任务完成后运行面板消失，自动进入历史记录 |

## 关键发现

1. 页面有 2 个 textarea 和 2 个 file input，必须用 .last() 选可见的那个
2. 运行按钮是 `div.ai-btn-run`，显示积分消耗 + 运行模式
3. 点击运行后出现浮动面板 `div.rh-task-item`，含 "生成中" 状态和 Task ID
4. 任务完成后浮动面板消失，任务自动出现在历史记录 `.history-item` 列表顶部
5. 每条历史记录内有 `<audio>` 元素，src 是 CDN 直链（FLAC 格式）
6. Task ID 在 `.history-id` 元素中，格式 "taskid: XXXXXXXX"
7. 下载不需要三点菜单，直接 fetch audio.src 即可

## 反爬

无反爬迹象。但仍使用 human.* 工具保守应对。
