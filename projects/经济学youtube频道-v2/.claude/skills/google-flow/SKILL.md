---
name: google-flow
description: 调用 Google Flow 生成图片并下载到本地。用户只要提到"用 Flow 生成图"、"生成 AI 图片"、"Flow 画图"、"文生图"以及类似意图，都使用本 skill。支持配置模型、比例、数量，自动下载最高清版本。
---

# google-flow

在 Google Flow (labs.google/fx) 中用提示词生成 AI 图片，下载到本地。默认使用 Nano Banana 2 模型、3:4 比例、生成 1 张，自动下载 2K（降级 1K）。

## 典型流程

所有生成操作都在**项目**内进行，`--project-id` 是必填参数。

1. **获取项目 ID**：用 `list-projects` 查看已有项目；没有合适的就 `create-project --name <名称>` 新建一个，返回的 `projectId` 后续复用
2. **生成图片**：`generate --prompt "描述" --project-id <uuid>` → 同步等待生成完成，自动下载最高清版本到本地
3. **（可选）参考图**：需要参考图时分两步——先 `upload-media` 上传到项目媒体库，再在 generate 时用 `--reference-search "关键词"` 搜索并引用。支持多张参考图（多个 `--reference-search` flag）。已上传的图片永久在库中，不要重复上传

## Actions

| action | 说明 | 入参 | 出参 |
|---|---|---|---|
| generate | 同步：提交 prompt，等待生成完成并下载 | --prompt (必), --project-id (必), --model, --aspect-ratio, --count, --reference-search, --download-resolution | JSON（含 images 数组）|
| create-project | 创建新项目 | --name | JSON（含 projectId）|
| list-projects | 列出所有项目 | （无） | JSON（含 projects 列表）|
| list-media | 查询项目媒体库 | --project-id (必), --search | JSON（含 images 列表）|
| upload-media | 上传本地图片到项目媒体库 | --image (必), --project-id (必) | JSON（含 name）|

## 参数

| 参数 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `--prompt` | 是 | — | 生成提示词 |
| `--project-id` | 是 | — | Flow 项目 UUID（用 create-project 获取）|
| `--model` | 否 | nano-banana-2 | 模型：nano-banana-2 / nano-banana-pro |
| `--aspect-ratio` | 否 | 3:4 | 比例：16:9 / 4:3 / 1:1 / 3:4 / 9:16 |
| `--count` | 否 | 1 | 数量：1 / 2 / 3 / 4 |
| `--download-resolution` | 否 | best | best(优先2K) / 2k / 1k |
| `--reference-search` | 否 | — | 搜索已上传图片的名称，支持多个 flag 或逗号分隔 |
| `--output` | 否 | stdout | 保存路径（后缀固定为 .json）|

## 参考图使用

上传和使用分开：
1. **上传**：`upload-media --image <路径> --project-id <uuid>` → 图片进入项目媒体库，返回 `name`（原始文件名）
2. **使用**：`generate --reference-search "文件名关键词"` → 从媒体库搜索已上传图片作为参考图，支持多张：`--reference-search "小浣熊" --reference-search "比奇堡"`
3. **查看库**：`list-media --project-id <uuid>` → 列出所有图片名称，确认搜索关键词

不要重复上传同一张图。已上传的图片会永久留在项目媒体库中，用 reference-search 复用即可。

## 输出

```json
{
  "success": true,
  "images": [
    {
      "imageUuid": "4b5b8bf8-...",
      "imagePath": "D:\\...\\runtime\\filename.jpeg",
      "resolution": "2K",
      "filename": "filename.jpeg",
      "sizeBytes": 54240
    }
  ],
  "prompt": "a cute cat",
  "projectId": "2b57ce62-...",
  "took_ms": 45000
}
```

count > 1 时 `images` 数组包含多张图片的下载结果。

## 并发与频率限制

Google Flow 不支持并发生成。多个 tab 同时打开同一 project URL 会产生 session 冲突，导致全部超时。workflow 必须串行执行（默认 parallelism: 1）。

Flow 有官方速率限制，同一项目连续生成时每张图片间至少间隔 10~15 秒，间隔太短会触发风控。

## 失败模式

stderr 抛 Error，message 含失败原因：

- `GenerationTimeout`: 120 秒内未检测到新图片
- `AntiBotDetected`: 页面出现"unusual activity"警告，Profile 被风控（需重新登录 Google 账号）
- `LoginRequired`: 登录态丢失（URL 跳转到登录页）
- `DownloadMenuItemNotFound`: 下载菜单未出现
- `DownloadEventNotFound`: 点击下载后无下载事件
- `ResolutionOptionNotFound`: 分辨率选项未出现

失败时 page 不关闭，可用 MCP 查看现场。

## 前置条件

基站项目（web-skill-creator-cdp-3）的 dedicated Chrome 必须在 9222 端口运行中，且已在 Chrome 里登录 Google 账号。

**禁止直接用 MCP browser 工具操作 Flow 页面**——MCP 操作不走 skill 的 human.* 节流，容易触发风控并污染全局 Profile。所有图片生成必须通过 skill 脚本（`generate` action）进行。
