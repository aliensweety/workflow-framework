#!/usr/bin/env python3
"""
Workflow YAML → Obsidian Canvas (.canvas) 转换器
扫描 workflows/*.yaml，在项目根目录生成同名 .canvas 文件。
双击 generate_canvas.bat 或直接 python workflow2canvas.py 运行。

布局策略：
  - 主流程从上到下（bottom → top 连线）
  - 外部文件输入从左侧连入（right → left）
  - 跳跃边（跨越中间节点）从右侧弧形绕过（right → right）
  - 卡片高度按内容自动计算
"""

import json, os, sys, secrets
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    import yaml
except ImportError:
    print("Installing PyYAML ...")
    os.system(f"{sys.executable} -m pip install pyyaml -q")
    import yaml

# ── Paths ──────────────────────────────────────────────────────
BASE = Path(__file__).resolve().parent
WF_DIR = BASE / "workflows"

# ── Layout ─────────────────────────────────────────────────────
CARD_W = 440          # step card width
MAIN_X = 460          # main column left edge
GAP_Y = 70            # vertical gap between cards
EXT_X = 30            # external input x
EXT_W = 360           # external input width
EXT_H = 56            # external input height
TITLE_W = 900         # title node width

# ── Obsidian colors ────────────────────────────────────────────
# 1=Red 2=Orange 3=Yellow 4=Green 5=Cyan 6=Purple
METHOD_CLR = {"claude-code": "5", "script": "2"}
AUTONOMY_ICON = {"ask": "🔴", "report": "🟡", "auto": "🟢"}
METHOD_ICON = {"claude-code": "🤖", "script": "⚙️"}


# ── Helpers ────────────────────────────────────────────────────
def uid():
    return secrets.token_hex(8)


def strip_run(tmpl):
    return tmpl.replace("{run.dir}/", "").strip() if tmpl else ""


def norm_list(val):
    if not val:
        return []
    return [val] if isinstance(val, str) else list(val)


def estimate_height(text, width):
    """Estimate rendered markdown height in pixels.

    Rough model based on Obsidian's markdown rendering:
      - H1 ≈ 38px, H2 ≈ 32px
      - body line ≈ 21px
      - empty line ≈ 10px
      - padding top/bottom ≈ 24px each
    """
    usable = width - 48
    cpl = max(20, usable / 7.5)
    px = 24  # top pad
    for line in text.split("\n"):
        if line.startswith("# "):
            px += 38
        elif line.startswith("## "):
            px += 32
        elif not line:
            px += 10
        else:
            px += max(1, len(line) / cpl) * 21
    px += 24  # bottom pad
    return max(100, int(px))


# ── YAML loading ───────────────────────────────────────────────
def load_workflows():
    if not WF_DIR.exists():
        sys.exit(f"❌ workflows/ not found: {WF_DIR}")
    out = []
    for f in sorted(WF_DIR.glob("*.yaml")):
        with open(f, encoding="utf-8") as fh:
            d = yaml.safe_load(fh)
        d["_src"] = f.name
        out.append(d)
    return out


# ── Graph analysis ─────────────────────────────────────────────
def build_graph(steps):
    """Return (deps, topo_order, externals).

    deps      sid → [upstream sid …]
    externals sid → [external filename …]
    """
    producers = {}
    for s in steps:
        fn = strip_run(s.get("produces", ""))
        if fn:
            producers[fn] = s["id"]

    deps, exts = {}, {}
    for s in steps:
        sid = s["id"]
        deps[sid], exts[sid] = [], []
        for c in norm_list(s.get("consumes")):
            fn = strip_run(c)
            if fn in producers:
                deps[sid].append(producers[fn])
            else:
                exts[sid].append(fn)

    # Kahn's topo sort
    indeg = {s["id"]: len(deps[s["id"]]) for s in steps}
    q = sorted(sid for sid, d in indeg.items() if d == 0)
    order = []
    while q:
        n = q.pop(0)
        order.append(n)
        for s in steps:
            sid = s["id"]
            if n in deps[sid]:
                indeg[sid] -= 1
                if indeg[sid] == 0:
                    q.append(sid)
                    q.sort()
    return deps, order, exts


# ── Card text ──────────────────────────────────────────────────
def title_text(wf):
    name = wf.get("name", "workflow")
    intent = " ".join(wf.get("intent", "").split())
    return f"# 📋 {name}\n\n{intent}"


def step_card_text(step):
    m = step.get("method", "?")
    a = step.get("autonomy", "auto")
    lines = [
        f"## {step['id']}",
        "",
        f"{METHOD_ICON.get(m, '❓')} `{m}`   {AUTONOMY_ICON.get(a, '⚪')} `{a}`",
        "",
    ]
    intent = " ".join(step.get("intent", "").split())
    lines.append(intent)
    if step.get("command"):
        lines += ["", f"`{step['command']}`"]
    out = strip_run(step.get("produces", ""))
    if out:
        lines += ["", f"📤 `{out}`"]
    return "\n".join(lines)


# ── Canvas builder ─────────────────────────────────────────────
def build_canvas(wf):
    steps = wf.get("steps", [])
    if not steps:
        return None

    nodes, edges = [], []
    ectr = [0]

    def eid():
        ectr[0] += 1
        return f"e{ectr[0]}"

    # ── Title node (auto-height) ──
    t_text = title_text(wf)
    t_h = estimate_height(t_text, TITLE_W)
    title_id = uid()
    nodes.append({
        "id": title_id,
        "type": "text",
        "x": 0, "y": 0,
        "width": TITLE_W, "height": t_h,
        "text": t_text,
        "color": "6",
    })

    # ── Topology ──
    deps, order, exts = build_graph(steps)
    smap = {s["id"]: s for s in steps}

    # ── Card content & heights ──
    texts, heights = {}, {}
    for sid in order:
        t = step_card_text(smap[sid])
        texts[sid] = t
        heights[sid] = estimate_height(t, CARD_W)

    # ── Position: top-to-bottom ──
    pos = {}
    y = t_h + GAP_Y
    for sid in order:
        pos[sid] = (MAIN_X, y)
        y += heights[sid] + GAP_Y

    # ── External input nodes (left side) ──
    ext_ids = {}       # (sid, fn) → node_id
    dedup_ext = {}     # fn → node_id

    for sid in order:
        sx, sy = pos[sid]
        for i, fn in enumerate(exts.get(sid, [])):
            if fn not in dedup_ext:
                nid = uid()
                dedup_ext[fn] = nid
                # align vertically with the consuming step
                ey = sy + i * (EXT_H + 15)
                nodes.append({
                    "id": nid,
                    "type": "text",
                    "x": EXT_X, "y": int(ey),
                    "width": EXT_W, "height": EXT_H,
                    "text": f"📄 `{fn}`",
                    "color": "3",
                })
            ext_ids[(sid, fn)] = dedup_ext[fn]

    # ── Step nodes ──
    for sid in order:
        px, py = pos[sid]
        nodes.append({
            "id": sid,
            "type": "text",
            "x": int(px), "y": int(py),
            "width": CARD_W, "height": heights[sid],
            "text": texts[sid],
            "color": METHOD_CLR.get(smap[sid].get("method")),
        })

    # ── Edges ──
    prod_map = {}
    for s in steps:
        fn = strip_run(s.get("produces", ""))
        if fn:
            prod_map[s["id"]] = fn

    # title → root step(s)
    for sid in order:
        if not deps[sid]:
            edges.append({
                "id": eid(),
                "fromNode": title_id, "fromSide": "bottom",
                "toNode": sid, "toSide": "top",
                "color": "6",
            })

    # step → step
    for sid in order:
        for dep in deps[sid]:
            from_idx = order.index(dep)
            to_idx = order.index(sid)
            is_skip = (to_idx - from_idx) > 1

            if is_skip:
                # Long-range dependency: arc around the right side
                edge = {
                    "id": eid(),
                    "fromNode": dep, "fromSide": "right",
                    "toNode": sid, "toSide": "right",
                    "color": "4",
                }
            else:
                # Direct successor: straight down
                edge = {
                    "id": eid(),
                    "fromNode": dep, "fromSide": "bottom",
                    "toNode": sid, "toSide": "top",
                }
            lbl = prod_map.get(dep, "")
            if lbl:
                edge["label"] = lbl
            edges.append(edge)

    # external → step (left side)
    for sid in order:
        for fn in exts.get(sid, []):
            nid = ext_ids[(sid, fn)]
            edges.append({
                "id": eid(),
                "fromNode": nid, "fromSide": "right",
                "toNode": sid, "toSide": "left",
                "color": "3",
            })

    return {"nodes": nodes, "edges": edges}


# ── Main ───────────────────────────────────────────────────────
def main():
    print("🔄 Workflow → Obsidian Canvas\n" + "─" * 38)
    wfs = load_workflows()
    if not wfs:
        print("⚠️  No .yaml files in workflows/")
        return
    print(f"📂 Found {len(wfs)} workflow(s)\n")

    for wf in wfs:
        name = wf.get("name", "?")
        canvas = build_canvas(wf)
        if not canvas:
            print(f"  ⚠️  {name}: no steps, skipped")
            continue
        out = BASE / f"{name}.canvas"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(canvas, f, indent=2, ensure_ascii=False)
        nn, ne = len(canvas["nodes"]), len(canvas["edges"])
        print(f"  ✅ {out.name}  ({nn} nodes, {ne} edges)")

    print(f"\n🎉 Done — open .canvas in Obsidian.")


if __name__ == "__main__":
    main()
