# steps — 节点池

每个 step 一个独立 yaml 文件,文件名 = step id。

例:
```
steps/
├── write_script.yaml
├── judge.yaml
├── research.yaml
└── generate_images.yaml
```

每个文件的字段定义见 `.claude/skills/WORKFLOW_SCHEMA.md` 的 \"steps/<step_id>.yaml\" 节。

## 为什么 step 独立成文件

1. **渐进披露**:run 跑到某个 step 才 Read 它的 yaml,正常 run 一遍不会把所有 step 的 description/command 都吃进上下文
2. **变体管理**:同一个项目里可以同时存在 `visualize-img.yaml` 和 `visualize-video.yaml`,flow.yaml 引用哪个就只加载哪个
3. **跨项目复用**:直接复制单文件,不需要拆大表
4. **独立编辑**:改一个 step 不被旁边 step 干扰注意力

## 由 workflow-compose 自动写入

不需要手写。`workflow-compose` 会和用户对话出流程拓扑后,把每个 step 的定义自动写到这个目录。