# Interview —— flow3

## What this flow does

让 AI 在 Google Flow 里用提示词生成图片，下载到本地。支持新建项目或打开已有项目，可选上传参考图，配置模型/比例/数量参数，生成后自动检测状态，完成后下载最高清版本（优先 2K，降级 1K）。

## Expected result

- 数据结构: JSON
- 字段:
  - `success` (boolean, 必): 是否生成成功
  - `imagePath` (string, 必): 下载后的本地文件路径
  - `imageUuid` (string, 必): 生成图片的 UUID（来自 /edit/{uuid}）
  - `resolution` (string, 必): 实际下载的分辨率 "2K" 或 "1K"
  - `projectId` (string, 可选): 使用的项目 ID
  - `prompt` (string, 可选): 实际使用的提示词
  - `error` (string, 可选): 失败时的错误信息

## Parameters

| 参数 | 类型 | 取值范围 | 默认值 | 必填 |
|---|---|---|---|---|
| prompt | string | 任意文本 | （无）| 是 |
| projectId | string | 项目 UUID 或 "new" | "new" | 否 |
| referenceImagePath | string | 本地文件路径 | （无）| 否 |
| model | string | "nano-banana-2" / "nano-banana-pro" / "imagen-4" | "nano-banana-2" | 否 |
| aspectRatio | string | "16:9" / "4:3" / "1:1" / "3:4" / "9:16" | "3:4" | 否 |
| count | number | 1 / 2 / 3 / 4 | 1 | 否 |
| downloadResolution | string | "2k" / "1k" / "best" | "best"（优先 2K 降级 1K） | 否 |

## Constraints

1. **顶部导航栏遮挡 pointer events**: toolbar 的搜索框和项目名 textbox position:fixed，拦截 MCP click/hover。所有交互必须用 `page.mouse.*` 物理坐标操作或 `force: true`。
2. **Radix Menu 子菜单**: "更多 → 下载" 的子菜单只响应物理 PointerEvent，JS dispatchEvent 和 force hover 无效。必须用 `page.mouse.move()` 物理移动。
3. **生成有失败可能**: 一次提交可能生成多张，部分可能失败（显示"warning 失败"）。只关心成功的。
4. **区分新旧图片**: 通过 UUID 集合 diff 精确识别新生成的图片。旧图片始终是 link 元素，新生成中/失败的图片是 generic 容器。
5. **生成状态生命周期**: 提交后 → generic 容器（无 link）→ 百分比进度 → 成功变 link 元素（分配 UUID）或 失败显示"失败"。
6. **下载子菜单**: 1K 始终可用，2K 需要高清重塑完成，4K 需付费升级（disabled）。
7. **参考图上传**: 通过 prompt 输入框下方的 "add_2" 加号按钮 → 弹窗 → "上传图片" 触发 file chooser。不是顶部 toolbar 的"添加媒体"。
8. **Virtuoso 虚拟滚动**: 图片 grid 使用虚拟滚动，不在视口的图片可能不在 DOM 中。收集 UUID 时需考虑。
9. **Help panel iframe**: 误触"help"会打开嵌套 iframe overlay，拦截所有交互。避免误触。

## 给 03-walkthrough 的清单

> 03 阶段必须用 MCP 亲手走一遍下面每一项

- [x] 主流程探索（已通过本次探索完成）
- [ ] 精确下载流程：hover → 更多 → 下载 → 选 2K/1K → 验证文件下载
- [ ] 上传参考图流程：加号 → 弹窗 → 上传图片 → file chooser → 确认附着在 prompt 上方
- [ ] 生成失败的处理：观察失败卡片 → 确认可重试
- [ ] 参数切换：model 三种 / aspectRatio 五种 / count 四种
