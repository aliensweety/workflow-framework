# Walkthrough —— flow3

## 探索环境

- 项目: 读书频道 (`2b57ce62-e0a3-41d2-bcbc-340b58be3d5e`)
- 视口: 1280x1024（避免菜单溢出视口）
- 模型: Nano Banana 2（默认）

## 路径 1: 完整生成流程 ✅

### 1.1 新建项目
- 首页 click "新建项目" → 跳转到 `/project/{uuid}` 编辑器
- 编辑器页面 URL 格式: `/fx/zh/tools/flow/project/{uuid}`

### 1.2 输入 Prompt
- prompt 输入框是 `[contenteditable="true"]` div
- **必须用 JS focus** (`element.focus()`)，不能 MCP click（被搜索框遮挡）
- 输入用 `keyboard.type()` 或 `pressSequentially()` 逐字输入

### 1.3 设置参数
- click "🍌 Nano Banana 2 crop_portrait 1x" 按钮展开参数面板
- 比例: 5 个 tab (16:9, 4:3, 1:1, 3:4, 9:16)
- 数量: 4 个 tab (1x, x2, x3, x4)
- 模型: dropdown → 3 个选项 (Nano Banana Pro, Nano Banana 2, Imagen 4)
- 默认值 (Nano Banana 2 / 3:4 / 1x) 无需修改

### 1.4 提交生成
- **必须用 force click 或 JS click**（被顶部 textbox 遮挡）
- `page.locator('button:has-text("arrow_forward")').click({ force: true })`

### 1.5 检测生成状态
- 提交后页面出现新 generic 容器（非 link 元素）
- **生成中**: 显示百分比进度 (如 "73%")
- **失败**: 显示 "warning" + "失败" 文本
- **成功**: generic 容器变为 `link` 元素，href 包含 `/edit/{uuid}`
- **检测策略**: 提交前记录所有 `/edit/{uuid}` 的 UUID，提交后轮询 DOM 找新 UUID

### 1.6 下载图片 ✅
- **Step 1**: JS `dispatchEvent(new MouseEvent('mouseover', {bubbles:true}))` 触发图片 hover 工具栏
- **Step 2**: 定位 `[data-testid="virtuoso-item-list"]` 内的 "更多" 按钮，`page.mouse.click(x, y)` 物理点击
- **Step 3**: 定位 `[role="menuitem"]:has-text("下载")` 的坐标，`page.mouse.move(x, y)` 物理移动触发 Radix 子菜单
- **Step 4**: 定位 "2K" 或 "1K" 选项坐标，`page.mouse.click(x, y)` 点击
- **Step 5**: `page.waitForEvent('download')` 捕获下载事件
- **文件名**: `{prompt_slug}_{timestamp}.jpeg`
- **保存**: `download.saveAs(targetPath)` 保存到指定位置

## 路径 2: 上传参考图（待验证）

交互路径已确认：
- click prompt 输入框下方的 "add_2" 加号按钮（用 JS click 或 force click）
- 弹出 dialog (Radix dialog)，内含资源列表 + "上传图片" 按钮
- click "上传图片" 触发 file chooser
- 上传后图片附着在 prompt 输入框上方

## 路径 3: 打开已有项目

- 首页项目列表中每个项目是 `link` 元素，href = `/fx/zh/tools/flow/project/{uuid}`
- 或直接 `page.goto('/fx/zh/tools/flow/project/{uuid}')`
- 已有项目直接进入编辑器，可继续生成

## 路径 4: 参数切换

模型/比例/数量通过参数面板的 tab/dropdown 切换，交互方式一致。未逐一测试所有组合，但 UI 结构已确认。

## 关键技术发现

1. **混合操作模式**: hover 用 JS dispatchEvent，click 用物理鼠标 move+click。两者缺一不可。
2. **UUID diff 是唯一可靠的生成完成信号**: 生成中无 UUID，完成后才分配。
3. **2K 下载直接触发**: 这次测试中 2K 直接下载成功，未遇到"正在生成高清"等待。
4. **page.waitForEvent('download')**: 可靠捕获下载，无需监听文件系统。
