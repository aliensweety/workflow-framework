# workflow-issues.md —— 外发给框架层

这份文件**不是你自己的 TODO**。是工作流项目 CC（你）发给 framework 层 CC（维护 workflow-framework 仓库的那个）的反馈。
对方会单独读、单独改框架。你只负责写一条事实，写完继续跑。

## 谁该出现在这里

两类信号：

**a. 框架部件本身有问题**
- `workflow-compose / workflow-run / workflow-revise` 三个 SKILL.md 指引不清、漏边界、自相矛盾
- `WORKFLOW_SCHEMA.md` 字段不够用、硬约束太死、规则歧义
- `install.bat` / `project-template` 行为别扭

**b. 行为信号——你在打磨/执行 workflow 时感觉框架没引导好**
- 你打磨 workflow 时被反复问同一类问题，说明 compose 的引导有缺
- 你跑 workflow 时不知道某步该不该停下、该不该报告，说明 autonomy 规则不够清
- 你自己感觉"明明是我的活却忍不住想写到 issues 里"，说明所有权边界写得不够清
- 你跑到一半想改 workflow YAML 结构，但 schema 里没有合适字段
- 用户当面指出你"没遵循流程"——这是最强的行为信号，必写

## 谁不该出现在这里

- 非框架 skill 的 bug → 写 `issues.md`
- 你自己 `workflows/`、`scripts/`、`runs/` 的问题 → 直接改，不写

## 写入格式（硬约束）

```
---

## <一句话现象>

**类别**：a (框架部件) | b (行为信号)

**触发场景**：
（你在做什么的时候碰到的，简短具体——"跑 voiceover step 时"、"compose 阶段问 fan-out 时"）

**现象**：
（实际看到的，不要推断"应该是因为"）

**发现时间**：YYYY-MM-DD

---
```

## 禁字段

不写：`根因`、`修复方案`、`PR 建议`、`状态`、`优先级`。
读者是框架层的 CC + 用户，他们会自己判断怎么改。你写"这里不顺"就够了，不用替他们设计。

（在此追加新条目）
