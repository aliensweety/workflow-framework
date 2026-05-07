---
name: memos
description: 向用户分享文件和生产成果。当工作流产出了配音、图片、文案等需要用户查看的内容时，使用本 skill 将文件上传到用户的 Memos 笔记网站 https://blog.056666.xyz，这样用户可以在网页上直接预览/下载，而不用在 Claude Code 对话界面里翻找。
---

# Memos — 成果分享

把文件发布到用户笔记网站供查阅。

脚本路径：`scripts/memos.sh`

## 核心用法

当工作流（economics-video）产出以下内容时，需要主动分享给用户：

| 产出物 | 命令 |
|--------|------|
| 配音音频 | `bash scripts/memos.sh memo.create "<描述>" && upload voiceover.mp3 --memo-id <刚创建的id>` |
| AI 图片（每张） | `upload seg_000.jpg --memo-id <id>` |
| 文案/脚本文件 | `upload script.md --memo-id <id>` |
| 字幕文件 | `upload subtitles.srt --memo-id <id>` |

**推荐流程：先创建一条 memo 汇总描述视频，再把所有附件逐一上传到这条 memo 下。**

## 命令

```
memo.create <内容描述> [--visibility PRIVATE|PUBLIC]
memo.list [--limit N]
memo.get <id>
memo.update <id> <新内容>
memo.delete <id>

upload <文件路径> [--memo-id <memo-id>]
```

## 示例

```bash
# 创建汇总笔记
ID=$(bash scripts/memos.sh memo.create "经济学视频 - 美元霸权 | 配音 & 配图 #经济学视频" | jq -r '.name' | cut -d'/' -f2)

# 上传所有附件
bash scripts/memos.sh upload voiceover.mp3 --memo-id "$ID"
bash scripts/memos.sh upload images/seg_000.jpg --memo-id "$ID"
bash scripts/memos.sh upload images/seg_001.jpg --memo-id "$ID"
bash scripts/memos.sh upload images/seg_002.jpg --memo-id "$ID"
```

Memo ID 接受 `abc123` 和 `memos/abc123` 两种格式。