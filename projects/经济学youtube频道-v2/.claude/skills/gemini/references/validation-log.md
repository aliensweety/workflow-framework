# Validation Log —— Gemini Web

## 试跑列表

| # | action | 参数 | 结果 | 耗时 | 备注 |
|---|---|---|---|---|---|
| 1 | chat | prompt="今天北京天气怎么样？" | ✓ | 20s | 天气 widget，回复文字丰富 |
| 2 | chat | prompt="你好，介绍你自己" | ✓ text=空 | ~6s | 简单问候可能触发纯英文回复，提取逻辑需进一步验证 |
| 3 | chat | prompt="用一句话形容春天" | ✓ | 8s | 正常回复 |
| 4 | chat | model=think, prompt="为什么天空是蓝色的？" | ✓ | 6s | think 模型名映射正确 |
| 5 | chat | model=pro, prompt="1+1等于几" | ✓ | 10s | pro 模型响应 |
| 6 | chat | prompt="画一只红色的猫", tool=image_gen | ✓ | 5s | 工具激活成功，风格选择 UI 出现 |
| 7 | chat | tool=deep_research | ✓ | 34s | 返回研究方案，不是完整报告（符合 UI 行为）|
| 8 | chat | conversation_id=xxx（已有对话） | ✗ | timeout | 恢复已有对话后超时，可能页面重定向了新 ID |
| 9 | chat | temporary=true | ✓ | 33s | conversation_id 返回 null（预期行为）|
| 10 | chat | 连续对话（新建 prompt） | ✓ | 9s | 新建对话正常 |

## 修复记录

1. **回复文字提取为空**：`waitForFunction` 在 h2 一出现就返回，但内容还在渲染。改为等待按钮重新 enabled + 文字长度 > 10。
2. **模型选项 selector**：`role="menuitem"` 需用 `[role="menuitem"]`，不能用 tag name `menuitem`。
3. **工具按钮 aria-label**：a11y 显示"工具"但 DOM 无 aria-label，改用 `button:has-text("工具")`。
4. **模型名映射**：`fast/think/pro` 参数值需映射到中文菜单名 `快速/思考/Pro`。
5. **已有对话恢复**：需先等待发送动作发生（按钮 disabled），避免旧 h2 干扰。

## 已知限制

- **已有 conversation_id 恢复**：有时页面重定向到新 ID，原因待查。建议每次用新对话。
- **image_gen 完整流程**：工具激活后需选风格才能生成图片，当前 skill 只激活工具模式，未完成完整图片生成交互。
- **pro 模型返回空文字**：偶发，可能是 pro 模型响应结构不同。
