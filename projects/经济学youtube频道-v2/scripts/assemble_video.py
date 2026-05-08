"""
assemble_video.py
经济学YouTube视频全自动剪辑合成脚本。
将配音、字幕、图片序列导入剪映，输出最终MP4。

用法:
  python scripts/assemble_video.py ^
    --voiceover <mp3> ^
    --manifest <manifest.yaml> ^
    --images <images_dir> ^
    --subtitles <srt> ^
    --output <mp4>

参数:
  --voiceover    配音音频文件路径
  --manifest     manifest.yaml 路径（含 units 数组）
  --images       图片文件夹路径（兜底查找 unit.id.jpg）
  --subtitles    字幕 SRT 文件路径
  --output       最终输出 MP4 路径
"""

import os
import sys
import argparse
import re
import json

# 动态定位 jianying-editor skill 路径
current_dir = os.path.dirname(os.path.abspath(__file__))
env_root = os.getenv("JY_SKILL_ROOT", "").strip()
skill_root = None
for p in [
    env_root,
    os.path.join(current_dir, ".agent", "skills", "jianying-editor"),
    os.path.join(current_dir, ".trae", "skills", "jianying-editor"),
    os.path.join(current_dir, ".claude", "skills", "jianying-editor"),
    os.path.join(current_dir, "skills", "jianying-editor"),
    os.path.abspath(".agent/skills/jianying-editor"),
    os.path.abspath(".claude/skills/jianying-editor"),
]:
    if p and os.path.exists(os.path.join(p, "scripts", "jy_wrapper.py")):
        skill_root = p
        break

if not skill_root:
    raise ImportError("Could not find jianying-editor skill root. Set JY_SKILL_ROOT env var.")

sys.path.insert(0, os.path.join(skill_root, "scripts"))
from jy_wrapper import JyProject
from pyJianYingDraft.keyframe import KeyframeProperty as KP

# 微幅垂直平移参数
PAN_ZOOM_SCALE = 1.06   # 略微放大，防止平移时露出黑边
PAN_OFFSET = 0.035       # 位移幅度（归一化值，约 38px @1080p）

# 解析时间字符串 "00:00-00:10" -> (0, 10)
def parse_time_range(tr):
    m = re.match(r"(\d+):(\d+)-(\d+):(\d+)", tr)
    if not m:
        raise ValueError(f"Invalid time_range format: {tr}")
    start_sec = int(m.group(1)) * 60 + int(m.group(2))
    end_sec = int(m.group(3)) * 60 + int(m.group(4))
    return start_sec, end_sec

def seconds_to_str(s):
    """Convert seconds to jianying time format: '5s', '12s', etc."""
    return f"{s}s"

def main():
    parser = argparse.ArgumentParser(description="Assemble economics video with JianYing")
    parser.add_argument("--voiceover", required=True, help="Voiceover audio file")
    parser.add_argument("--manifest", required=True, help="manifest.yaml")
    parser.add_argument("--images", required=True, help="Images directory")
    parser.add_argument("--subtitles", required=True, help="Subtitles SRT file")
    parser.add_argument("--output", required=True, help="Output MP4 path")
    parser.add_argument("--image-plan", default=None, help="image_plan.json fallback when manifest.units is empty")
    parser.add_argument("--draft-name", default="Economics_Video", help="JianYing draft name")
    args = parser.parse_args()

    # 读取 manifest.yaml
    try:
        import yaml
    except ImportError:
        print("[ERROR] PyYAML is required: pip install pyyaml")
        sys.exit(1)

    with open(args.manifest, "r", encoding="utf-8") as f:
        manifest = yaml.safe_load(f)

    units = manifest.get("units", [])
    if not units and args.image_plan and os.path.exists(args.image_plan):
        print(f"[Assemble] manifest.units empty, loading from {args.image_plan}")
        with open(args.image_plan, "r", encoding="utf-8") as f:
            plan = json.load(f)
        for idx, item in enumerate(plan):
            units.append({
                "id": f"seg_{idx:03d}",
                "time_range": item.get("time_range", ""),
                "image_prompt": item.get("image_prompt", ""),
            })
    if not units:
        print("[WARN] No image segments found, assembling audio + subtitles only.")

    print(f"[Assemble] Creating JianYing project: {args.draft_name}")
    project = JyProject(args.draft_name, width=1920, height=1080)

    # 1. 导入配音音轨
    print(f"[Assemble] Adding voiceover: {args.voiceover}")
    project.add_media_safe(os.path.abspath(args.voiceover), "0s", track_name="Voiceover")

    # 2. 按 units 顺序添加图片 B-roll
    images_dir = os.path.abspath(args.images)
    print(f"[Assemble] Adding {len(units)} image segments...")
    for i, unit in enumerate(units):
        time_range = unit.get("time_range")
        if not time_range:
            print(f"  unit {unit.get('id', i)}: no time_range, skipping")
            continue
        start_sec, end_sec = parse_time_range(time_range)
        duration_sec = end_sec - start_sec
        start_str = seconds_to_str(start_sec)
        duration_str = f"{duration_sec}s"

        # 图片路径：优先 unit.image_path，兜底 images_dir/unit.id.jpg
        img_path = unit.get("image_path") or ""
        if not img_path:
            fallback = os.path.join(images_dir, f"{unit.get('id', i)}.jpg")
            if os.path.exists(fallback):
                img_path = fallback
            else:
                print(f"  unit {unit.get('id', i)}: image not found at {fallback}, skipping")
                continue
        elif not os.path.isabs(img_path):
            img_path = os.path.abspath(img_path)

        if not os.path.exists(img_path):
            print(f"  unit {unit.get('id', i)}: image not found at {img_path}, skipping")
            continue

        print(f"  unit {unit.get('id', i)}: {start_str} ({duration_str}) -> {img_path}")
        seg = project.add_media_safe(img_path, start_time=start_str, duration=duration_str, track_name="B-roll")

        # 微幅垂直平移（Ken Burns）：交替上下
        if seg is not None:
            duration_us = duration_sec * 1_000_000
            seg.add_keyframe(KP.uniform_scale, 0, PAN_ZOOM_SCALE)
            if i % 2 == 0:  # 偶数：向下移
                seg.add_keyframe(KP.position_y, 0, -PAN_OFFSET)
                seg.add_keyframe(KP.position_y, duration_us, PAN_OFFSET)
            else:            # 奇数：向上移
                seg.add_keyframe(KP.position_y, 0, PAN_OFFSET)
                seg.add_keyframe(KP.position_y, duration_us, -PAN_OFFSET)

    # 3. 导入字幕 SRT
    if os.path.exists(args.subtitles):
        print(f"[Assemble] Importing subtitles: {args.subtitles}")
        srt_file = project.script
        srt_file.import_srt(os.path.abspath(args.subtitles), track_name="Subtitles")

    # 4. 保存草稿
    print("[Assemble] Saving project...")
    project.save()

    # 5. 导出 MP4
    print(f"[Assemble] Exporting to {args.output}...")
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    auto_exporter_path = os.path.join(skill_root, "scripts", "auto_exporter.py")
    import subprocess
    result = subprocess.run(
        [sys.executable, auto_exporter_path, args.draft_name, args.output, "--res", "1080", "--fps", "60"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"[Assemble] Done! Output: {args.output}")
    else:
        print(f"[WARN] Auto-export returned {result.returncode}. Draft saved, manual export needed.")
        print(result.stdout)
        print(result.stderr)

if __name__ == "__main__":
    main()
