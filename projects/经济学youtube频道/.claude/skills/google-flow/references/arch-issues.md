# Flow3 开发过程中的架构问题记录

## 1. 顶部导航栏遮挡 pointer events（严重）

**现象**: MCP 的 `browser_click` / `browser_hover` 反复报错 `<input> intercepts pointer events`。

Flow 编辑器的顶部 toolbar（搜索框、项目名 textbox）position: fixed，即使视觉上不重叠，
Playwright 的 clickability check 也判定它们拦截了 pointer events。

**受影响的交互**:
- prompt 输入框（被搜索框遮挡）
- "add_2 创建" 按钮（被项目名 textbox 遮挡）
- "arrow_forward 创建" 按钮（同上）
- 图片 grid 中的 hover（被搜索框遮挡）

**解决方案**: dev step 中必须用以下方式之一绕过：
- `page.mouse.move(x, y)` + `page.mouse.click(x, y)` 物理坐标操作
- `element.click({ force: true })` 跳过 actionability check
- `element.evaluate(el => el.click())` / `dispatchEvent` 纯 JS 触发

**注意**: `force: true` 和 JS `dispatchEvent` 对 Radix UI 组件无效（见问题 3）。
物理坐标 `page.mouse.*` 是最可靠方案。

## 2. Radix UI Menu 的 hover/click 不响应程序化事件（严重）

**现象**: Flow 使用 Radix UI 的 Menu 组件。"更多 → 下载" 的子菜单需要 hover 触发。
`force: true` hover、JS `dispatchEvent(new MouseEvent('mouseover'))` 均无法打开子菜单。

**原因**: Radix Menu 内部用 `onPointerEnter` / `onPointerMove` 监听，而非标准的
`mouseover`/`mouseenter`。程序化创建的 MouseEvent 不触发 PointerEvent handler。

**解决方案**: 用 `page.mouse.move()` 物理移动鼠标到目标元素的坐标。
必须先通过 `boundingBox()` 获取坐标，再 `page.mouse.move(x, y)`。

## 3. 菜单渲染在视口外（中等）

**现象**: "更多"菜单展开后，"下载"选项可能落在视口底部之外。
Playwright 报错 `element is outside of the viewport`，`scrollIntoView` 无效
（因为菜单是 fixed/absolute 定位的，不受 scroll 影响）。

**解决方案**:
- 用 `browser_resize` 增大视口高度（至少 1024px）
- 或在 dev step 中用 `page.mouse.move()` 直接操作坐标（不受视口限制）

## 4. Help Panel iframe 遮挡（低频但致命）

**现象**: 不小心触发 "help 产品帮助" 按钮后，会打开一个 iframe overlay。
这个 overlay 在 a11y tree 里不太明显，但会拦截所有 pointer events。

**解决方案**: 测试时避免误触。如果触发了：
- 关闭 help panel iframe
- 或用 `el.remove()` 删除遮挡层

## 5. Tab 关闭操作超时/卡死（用户报告）

**现象**: `browser_tabs(action: "close")` 执行极慢，几乎卡死。

**可能原因**:
- Flow 页面有大量 event listener（虚拟滚动 Virtuoso + Radix Menu + 多个 iframe）
- MCP 在关闭 tab 时需要清理这些 listener，导致超时
- Help panel iframe 的嵌套结构增加了清理复杂度

**解决方案**: 开发中尽量复用同一个 tab，减少频繁开关。用 `page.goto()` 导航代替开关 tab。

## 6. 图片 Grid 使用虚拟滚动（Virtuoso）

**现象**: 图片列表使用 `data-testid="virtuoso-item-list"` 虚拟滚动。
不在视口内的图片可能不在 DOM 中。

**影响**: `querySelectorAll('a[href*="/edit/"]')` 可能只返回当前可见的图片。
需要先 scroll 到顶部再收集 UUID，或用多次 scroll 收集完整列表。

## 7. 生成状态的生命周期

通过实测观察到的状态转换：

```
提交 → [generic 容器，无 link]
     → 百分比进度（"73%"）← 生成中
     → "warning" + "失败" ← 失败（有删除按钮）
     → [link 元素，href="/edit/{uuid}"] ← 成功（关键信号！）
```

**区分新旧图片的方法**:
- 提交前记录所有 `/edit/{uuid}` 的 UUID 集合
- 提交后轮询 DOM，找不在旧集合中的新 UUID link
- 生成中的图片是 `generic` 容器（非 link），UUID 暂不可用
- 生成完成后才变成 `link` 元素并分配 UUID

## 8. 综合建议：dev step 的操作模式

基于以上所有问题，dev step 脚本中应遵循：

1. **所有点击/悬停用 `page.mouse.*` 坐标操作**，不用 MCP browser_click/browser_hover
2. **获取元素坐标用 `boundingBox()`**，不用 ref
3. **导航用 `page.goto()`**，不开新 tab
4. **轮询 DOM 用 `page.evaluate()`**，不看 a11y snapshot
5. **状态检测用 UUID 集合 diff**，不依赖视觉信号
6. **视口保持 1280x1024+**，避免菜单溢出
