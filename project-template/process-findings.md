# process-findings

打磨期间临时笔记。遇到卡点、不顺、模糊的地方，随手记一条。session 末和用户一起看，决定哪些要提 GitHub issue。

---
（以下为示例，记录格式自由）

F001  2026-05-18
现象：跑到 image step 时 parallelism=4 但 API 限流，3/4 个 unit 失败
场景：run=2026-05-18_异乡人，step=generate_images
状态：submitted: https://github.com/moriatom/workflow-framework/issues/1

F002  2026-05-18
现象：workflow-revise 只改了 unit 字段但没 auto-set step stale
场景：run=2026-05-15_经济学，seg_003.text 改完没有标下游 stale
状态：dropped（是自己的 manifest 读写问题，不是框架问题）
