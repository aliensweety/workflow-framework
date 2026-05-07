# Walkthrough —— runninghub-tts

## 主流程信号

| 步骤 | 操作 | 前置信号 | 完成信号 |
|---|---|---|---|
| 1 | 打开应用页 | (无) | textarea 可见 + "参考音频" 可见 |
| 2 | 上传参考音频 | "参考音频" 区域可见 | 上传预览出现 |
| 3 | 输入文本 | textarea 可编辑 | textarea 含目标文本 |
| 4 | 点击运行 | div.ai-btn-run 可点击 | 切到历史记录 tab 后新 task 出现 |
| 5 | 等待生成完成 | 历史记录中 task 可见 | task 对应的 audio 元素有 src |
| 6 | 下载结果 | audio.src 存在 | 文件保存到本地 |

## 页面结构

- **Tab 切换**："输入参数" / "历史记录"，点击切换
- **输入参数 tab**：参考音频上传区 + 文本输入 textarea + 运行按钮
- **历史记录 tab**：任务列表，每条含 Task ID + audio 元素

## 关键 selector

| 概念 | selector | 备注 |
|---|---|---|
| 音频上传 input | `input[type="file"][accept="audio/*"]` | 隐藏，需 setInputFiles |
| 文本输入框 | `textarea` (页面可见的那个) | Ant Design textarea |
| 运行按钮 | `div.ai-btn-run` | 显示积分消耗 + 运行模式 |
| 积分显示 | `div.coin-amount` | 当前积分 |
| 历史记录 tab | 含"历史记录"文字的元素 | 点击切换 |
| 输入参数 tab | 含"输入参数"文字的元素 | 点击切换 |
| Task ID | 历史记录中含 "taskid:" 的 div | 格式: "taskid: XXXXXXXXXXXXXXXXXXXX" |
| 音频元素 | `.history-result` 内的 `audio` | src 是直接下载链接 (FLAC) |
| 三点菜单 | `.anticon-ellipsis` | 被 header 遮挡，需 evaluate 点击 |

## 下载机制

不需要三点菜单。每条历史记录内嵌 `<audio>` 元素，src 是 CDN 直链：
```
https://rh-images.xiaoyaoyou.com/.../output/audio/ComfyUI_XXXXXX_xxxxx.flac
```

通过 Task ID 匹配到对应的历史记录 div，从中提取 audio.src，直接 fetch 下载。

## 反爬观察

- 未观察到验证码、Cloudflare 盾、unusual activity
- 未观察到操作最低间隔
- 上传组件是 Ant Design 标准 drag upload
- 页面无特殊反爬迹象

**04 阶段建议**：仍默认用 human.* 工具，保守应对。

## 失败路径

- 未登录：页面会跳转登录（待验证）
- 积分不足：运行按钮行为待观察
- 任务失败：历史记录中可能无 audio 元素或 audio.src 为空

## 异步模式要点

- start_tts：提交任务后切到历史记录 tab，等新 task 出现，提取 Task ID 返回
- get_tts：打开页面 → 切历史记录 tab → 找到 Task ID 对应记录 → 检查 audio.src → 有则下载返回 completed，无则返回 running
