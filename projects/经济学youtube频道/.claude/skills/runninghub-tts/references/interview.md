# Interview —— runninghub-tts

## What this flow does

用 IndexTTS2，以参考音频 + 文本生成配音，下载结果音频文件。

## Expected result

- 数据结构: JSON
- 字段:
  - `file_path` (string, 必): 下载到的音频文件本地路径
  - `task_id` (string, 可选): RunningHub 任务 ID
  - `took_ms` (number, 可选): 总耗时（毫秒）
  - `file_size` (number, 可选): 文件大小（字节）

## Parameters

| 参数 | 类型 | 取值范围 | 默认值 | 必填 |
|---|---|---|---|---|
| `--audio` | string | 本地音频文件路径 | （无）| 是 |
| `--text` | string | 要配音的文本 | （无）| 是 |
| `--output` | string | 结果音频保存路径 | （无）| 是 |

## Constraints

- 同时只能运行一个任务，不能并行提交（需等待前一个完成或检查状态后再提交）
- 积分/额度不够时的表现待开发期观察
- 未登录时的页面表现待开发期观察

## 任务模式（Q5）

- mode: `async`
- 理由：配音生成从几十秒到几分钟不等，几百字可能要几分钟
- task handle: DOM 提取的 Task ID（历史记录中显示）
- 拆为 `start_tts`（提交任务，拿 task_id 返回） + `get_tts`（传 task_id，检查状态/下载）

## 给 03-walkthrough 的清单

> 03 阶段必须用 MCP 亲手走一遍下面每一项

- [ ] 主流程（happy path）：上传音频 → 输入文本 → 点运行 → 等待完成 → 下载
- [ ] 历史记录面板：打开方式、Task ID 位置、状态显示
- [ ] 三点菜单：下载按钮的交互方式
- [ ] 正在运行时提交第二个任务的表现
- [ ] 积分/额度相关 UI 元素
- [ ] 失败路径：
  - [ ] 未登录状态
  - [ ] 积分不足
  - [ ] 其他异常
