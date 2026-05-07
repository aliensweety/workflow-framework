# issues.md —— 外发给 Skill 管理层

这份文件**不是你自己的 TODO**。是工作流项目 CC（你）发给 Skill 管理层 CC 的 bug 报告。
对方会单独读、单独修。你只负责写一条事实，写完继续跑。

## 谁该出现在这里

`.claude/skills/<X>/` 下**非框架**的 skill 出问题——脚本报错、依赖缺失、调用方式不通、输出格式坏掉等。
现有非框架 skill 例如：gemini / grok / google-flow / runninghub-tts。

## 谁不该出现在这里

- 你自己 `workflows/`、`scripts/`、`runs/` 出问题 → 直接改，不写
- 框架 4 件（workflow-compose / workflow-run / workflow-revise / WORKFLOW_SCHEMA.md）问题 → 写 `workflow-issues.md`
- workflow YAML 设计层面的不顺、字段不够、机制不灵 → 写 `workflow-issues.md`
- 项目规范、方法论笔记 → 写 `CLAUDE.md` 或 `decisions.md`

## 写入格式（硬约束）

```
---

## <skill 名> — <一句话现象>

**运行命令**：
（能复现的完整命令）

**报错 / 现象**：
（原始报错或观察到的异常，不要总结）

**发现时间**：YYYY-MM-DD

---
```

## 禁字段

不写：`根因`、`分析`、`修复`、`workaround 建议`、`状态`（open/resolved 等）、`规范`、`方法论`。
读者是 Skill 管理层的 CC，它有自己的工具、自己的上下文，不需要你的推断。你硬塞反而干扰它。

（在此追加新条目）
