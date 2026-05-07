# Implementation Notes —— flow3

## 段构造记录

| 段 | 操作 | dev step | 验证点 | 备注 |
|---|---|---|---|---|
| 1 | 导航+记录旧UUID+输入prompt+提交 | step-1.js | 15张旧UUID记录正确，提交成功 | |
| 2 | 完整流程：输入→提交→等UUID diff→下载 | step-2.js | 生成完成+下载54KB 1K图片 | 2K降级1K正常 |

## 核心技术方案

| 环节 | 方案 | 原因 |
|---|---|---|
| hover 工具栏 | JS `dispatchEvent('mouseover')` | React 合成事件，物理鼠标不触发 |
| 按钮点击 | `page.mouse.click(x, y)` 物理坐标 | 顶部 toolbar 遮挡 pointer events |
| Radix 子菜单 | `page.mouse.move(x, y)` 物理移动 | 只响应 PointerEvent |
| 生成检测 | UUID 集合 diff 轮询 | 最可靠：生成中无UUID，完成后分配 |
| 下载捕获 | `page.waitForEvent('download')` | Playwright 原生支持 |

## 参考图上传探索（step-3 / step-4）

### 弹窗结构（`add_2` 按钮触发 `[role="dialog"]`）

| 元素 | 选择器 / a11y | 说明 |
|---|---|---|
| 频道下拉 | `button:has-text("读书频道 arrow_drop_down")` | 项目/频道筛选 |
| 搜索框 | `input[placeholder="搜索资源"]` | 模糊搜索已有图片（匹配 alt 文字） |
| 排序下拉 | `button:has-text("最近 arrow_drop_down")` | 排序筛选 |
| 图片列表 | `[role="dialog"] img` (不含 alt="搜索结果预览") | 已有图片缩略图，可点击选中 |
| 上传按钮 | `:text("上传图片")` | 底部，触发 file chooser |
| 预览图 | `img[alt="搜索结果预览"]` | 右侧预览区 |

### 两种添加参考图方式

| 方式 | 流程 | 结果 |
|---|---|---|
| 上传新图 | `add_2` → 弹窗 → "上传图片" → file chooser → 上传 | 弹窗关闭，图片出现在 prompt 上方 |
| 搜索已有图 | `add_2` → 弹窗 → 搜索框输入关键词 → 点击匹配图片 | 弹窗关闭，图片出现在 prompt 上方 |

### 参考图 DOM 位置

- 在 `[contenteditable="true"]` 往上 2 层 `<div class="sc-2951028b-0 ...">`
- img alt 固定为 "由您生成或上传的媒体内容都收录在集合中。"
- img src: `/api/trpc/media.getMediaUrlRedirect?name=<media-uuid>`
- 上传和搜索选中后的 DOM 结构完全一致

## actions 列表

| action | 入参 | 出参 | 失败模式 |
|---|---|---|---|
| generate | prompt, projectId?, model?, aspectRatio?, count?, downloadResolution?, referenceImagePath?, referenceSearch? | { success, imagePath, imageUuid, resolution, filename, sizeBytes, prompt, projectId, took_ms } | GenerationTimeout / MoreButtonNotFound / DownloadEventNotFound |
| start_generate | prompt, projectId?, model?, aspectRatio?, count?, referenceImagePath?, referenceSearch? | { imageUuid, status: 'generating', projectId, prompt } | GenerationTimeout / LoginRequired / AntiBotError |
| get_generate | imageUuid, projectId?, downloadResolution? | { status, imagePath?, imageUuid, resolution?, ... } | DownloadMenuItemNotFound / LoginRequired / AntiBotError |

## 异步拆分重构（step-19 / step-20 验证）

| 段 | 操作 | dev step | 验证结果 |
|---|---|---|---|
| A | 导航 → 记旧 UUID → 输入 prompt → 提交 | step-19 | ✅ 24 个旧 UUID 记录正确，提交成功 |
| B | raceSuccess 双路等待新 UUID | step-19 | ✅ 新 UUID `fed9603a-...` 在 15% 时就开始等待，完成后检测到 |
| C | 检测图片状态（ready / failure / generating） | step-20 | ✅ ready=true 正确检测 |
| D | hover → 更多 → 下载子菜单 → 选分辨率 → 下载 | step-20 | ✅ 1K 686KB 下载成功 |

拆分点：start_generate 在提交后立即等新 UUID 出现就返回，get_generate 做状态检测 + 下载。
