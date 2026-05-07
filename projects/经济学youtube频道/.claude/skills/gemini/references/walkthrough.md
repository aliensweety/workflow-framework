# Walkthrough —— Gemini Web

## 主流程信号

| 步骤 | 操作 | 期望前置信号 | 期望完成信号 |
|---|---|---|---|
| 1 | 打开主页 | 输入框可见 | textbox "为 Gemini 输入提示" |
| 2 | 输入 prompt | 输入框可编辑 | paragraph 显示输入文字 |
| 3 | 点击发送 | 发送按钮可点击 | URL 变化含 conversation_id |
| 4 | 等待回复 | "Gemini 说" heading 出现 | paragraph 出现回复内容 |
| 5 | 获取结果 | 回复段落出现 | conversation_id 从 URL 提取 |

## 多消息结构（a11y tree）

```
generic[ref=e75] (主对话区)
  generic[ref=e79] (对话列表容器)
    generic[ref=e195] (第1条消息对)
      heading "你说 {prompt}"
      generic (Gemini 回复)
        heading "Gemini 说"
        paragraph {回复内容}
    generic[ref=e269] (第2条消息对 = 最新)
      heading "你说 {prompt2}"
      generic (Gemini 回复)
        heading "Gemini 说"
        paragraph {回复内容2}
        button "重做" (最新回复专属)
  group[ref=e125] (输入区)
    textbox "为 Gemini 输入提示"  ← 输入框前的是最新回复
```

**定位最后回复**：输入框所在 `group` 的前一个兄弟 `generic` 就是最新一条 Gemini 回复。

## 模型走查结果

| 取值 | 走通? | 备注 |
|---|---|---|
| fast | ✓ | 默认，快速回答 |
| think | ✓ | 解决复杂问题 |
| pro | ✓ | 3.1 Pro |

## 工具走查结果

| 工具 | 走通? | 备注 |
|---|---|---|
| image_gen | ✓ | menuitemcheckbox "制作图片" |
| deep_research | ✓ | menuitemcheckbox "Deep Research" |

## 工具菜单选项（完整）

- 制作图片
- Canvas
- Deep Research
- 制作视频
- 制作音乐（新版）
- 学习

## 对话结构走查

| 场景 | 结果 |
|---|---|
| 新建对话 | URL 变为 /app/{conversation_id} |
| 通过 ID 恢复 | URL 直接 /app/{id} 加载历史 |
| 临时对话 | 右侧栏"临时对话"按钮 |

## 反爬观察

- [x] 发送按钮默认 disabled，输入框有内容才可点击
- [ ] 未观察到验证码/5秒盾/Cloudflare
- [ ] 未观察到操作间隔限制
- [ ] 页面没有 hover 专属元素
- [ ] 未测试粘贴限制

**04 阶段建议**：用 `lib/human.*` 模拟输入，但基础 click 可以用。

## 失败路径

- 未登录：跳转 /login（本环境已登录，跳过）

## 给 04-incremental-build 的 selector 概念清单

- [ ] 主输入框：`.ql-editor`（contenteditable div，非 textarea）
- [ ] 发送按钮：`button[aria-label='发送']`
- [ ] 输入框容器：`.ql-editor` 的父容器
- [ ] 最新回复区：输入框 `group[ref=e125]` 的前一个兄弟 generic
- [ ] 回复文字：`[ref=e301]` 内的 paragraph
- [ ] 模型选择器：`button:has-text('快速')`
- [ ] 工具菜单：`button:has-text('工具')`
- [ ] 图片工具项：`menuitemcheckbox:has-text('制作图片')`
- [ ] Deep Research 工具项：`menuitemcheckbox:has-text('Deep Research')`
- [ ] 临时对话按钮：`button:has-text('临时对话')`
- [ ] 新建对话链接：`link:has-text('发起新对话')`
- [ ] conversation_id：从 page.url() 提取 `/app/` 后的路径部分
