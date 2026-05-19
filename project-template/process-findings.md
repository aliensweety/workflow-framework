# process-findings

打磨期临时笔记。遇到卡点、不顺、模糊的地方，随手记一条。

**只记框架本身/通用流程层的问题**——项目自己的 workflow.yaml、scripts、runs 里的问题直接在项目里改，不进这里。外部 skill / 工具的 bug 到它们各自的反馈仓提，不进这里。

session 末和用户一起过一遍，决定哪些提 GitHub issue 到 `aliensweety/workflow-framework`。

---

## 记录格式（自由）

```
F<编号>  <日期>
现象：（一句话说明发生了什么）
场景：（run=... step=... 或别的能定位的信息）
状态：pending | submitted: <issue url> | dropped: <原因>
```

---

## 示例

```
F001  2026-05-19
现象：workflow-run 在 step 失败时没有自动打开对应的 notes sidecar
场景：run=2026-05-19_异乡人，step=generate_images 跑挂了，notes 文件存在但没读
状态：pending
```

```
F002  2026-05-19
现象：compose 把"产出多份"步骤的 produces 写成了 manifest.units，但没在大表头加 manifest_template
场景：编排 economy-video 工作流时观察到
状态：submitted: https://github.com/aliensweety/workflow-framework/issues/3
```