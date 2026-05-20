# process-findings

打磨期临时笔记。遇到卡点、不顺、模糊的地方,随手记一条。

**只记框架本身/通用流程层的问题**——项目自己的 flow.yaml、steps/、scripts、runs 里的问题直接在项目里改,不进这里。外部 skill / 工具的 bug 到它们各自的反馈仓提,不进这里。

session 末和用户一起过一遍,决定哪些提 GitHub issue 到 `aliensweety/workflow-framework`。

`workflow-debrief` 复盘流程会引导你判断哪些 finding 应该提 issue、哪些其实是项目自己的事。

---

## 记录格式(自由)

```
F<编号>  <日期>
现象:(一句话说明发生了什么)
场景:(run=... step=... branch=... 或别的能定位的信息)
状态:pending | submitted: <issue url> | dropped: <原因>
```

---

## 示例

```
F001  2026-05-20
现象:workflow-run 在 condition 分支后没有把未走路径的 step 标 skipped,导致 resume 时把它们当 pending 跑了
场景:run=2026-05-20_异乡人,branch=judge 选了 light 后,research step 状态是 pending 不是 skipped
状态:pending
```

```
F002  2026-05-20
现象:parallel 块里有一个 step 既无 command 又非 subagent,run 时没拦住,导致主会话被卡住等"假并行"
场景:编排 economy-video 工作流时观察到
状态:submitted: https://github.com/aliensweety/workflow-framework/issues/5
```
