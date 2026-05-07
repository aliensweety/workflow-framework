# issues.md —— 工具问题（NOT MINE）

记录 `.claude/skills/<X>/` 下非框架 skill 的 bug、缺依赖、调用异常。
处理由专门维护那个 skill 的 Claude Code 负责。本文件**只记现象**。

## 写入约束（硬性）

只用这三个字段：

```
---

## <skill 或脚本名> — <一句话现象>

**运行命令**：（能复现的完整命令）

**报错 / 现象**：（原始报错或观察到的异常）

**发现时间**：YYYY-MM-DD

---
```

## 禁字段

下列字段不写到本文件：

- `根因` / `根本原因` / `分析` —— 不做根因推断
- `修复` / `修复建议` —— 不在这里改源码
- `规范` / `全局规范` / `约定` —— 是项目规则，写到 `CLAUDE.md`
- `方法论` / `经验` —— 写到 `decisions.md` 或对应 skill 的 README
- `状态`（open/resolved 等）—— 不维护状态机，记完就走

## 不归属本文件

- 你自己的 `workflows/`、`scripts/`、`runs/` 出问题 → 直接改，不记 issues
- 框架部件（workflow-compose / workflow-run / workflow-revise / WORKFLOW_SCHEMA.md）问题 → 写 `workflow-issues.md`
- workflow YAML 设计问题 → 写 `workflow-issues.md`

（在此追加新问题）
