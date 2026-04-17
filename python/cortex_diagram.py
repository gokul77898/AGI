#!/usr/bin/env python3
"""
CORTEX Diagram — generate Mermaid + Excalidraw + Draw.io diagrams.

Usage:
    python3 cortex_diagram.py "user-signup flow"
    python3 cortex_diagram.py "AWS 3-tier arch" --format mermaid
    python3 cortex_diagram.py "data pipeline" -o flow.mmd

Outputs:
    data/diagrams/<slug>.mmd        — Mermaid
    data/diagrams/<slug>.excalidraw — Excalidraw JSON (importable at excalidraw.com)
    data/diagrams/<slug>.drawio     — Draw.io XML (importable at app.diagrams.net)

The heavy lifting is done by the HF chat completion — we prompt it to emit
strict, parseable Mermaid, then mechanically convert to Excalidraw + Draw.io.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    sys.exit("❌ HF_TOKEN env var not set")

BASE_URL = os.environ.get("HF_BASE_URL", "https://router.huggingface.co/v1")
MODEL = os.environ.get("HF_MODEL_ID", "zai-org/GLM-5:together")


def require(mod: str, pip: str | None = None):
    try:
        return __import__(mod)
    except ImportError:
        sys.exit(f"❌ Missing dep: pip install {pip or mod}")


def _slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower()).strip("-")
    return (s[:40] or "diagram")


# ─── Generate Mermaid via chat ──────────────────────────────────
def generate_mermaid(description: str) -> str:
    requests = require("requests")
    sys_prompt = (
        "You are a diagram generator. Given a system/process description, "
        "output ONLY a valid Mermaid diagram — no prose, no code fences, no "
        "explanations. Pick the best diagram type (flowchart, sequenceDiagram, "
        "classDiagram, erDiagram, stateDiagram-v2). Use short node IDs. "
        "Include clear labels on arrows. Keep it under 30 nodes."
    )
    r = requests.post(
        f"{BASE_URL.rstrip('/')}/chat/completions",
        headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": description},
            ],
            "max_tokens": 1500,
            "temperature": 0.3,
        },
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(f"HF {r.status_code}: {r.text[:300]}")
    text = r.json()["choices"][0]["message"]["content"].strip()
    # Strip stray code fences if the model added them
    text = re.sub(r"^```(?:mermaid)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# ─── Mermaid → Excalidraw (boxes + arrows) ──────────────────────
def mermaid_to_excalidraw(mermaid: str) -> dict:
    """Extract node IDs + edges from a flowchart-ish Mermaid source and
    emit a minimal Excalidraw JSON. Works best for flowchart/graph types."""
    nodes: dict[str, str] = {}  # id -> label
    edges: list[tuple[str, str, str]] = []  # (src, dst, label)

    node_re = re.compile(r"([A-Za-z_][\w]*)\s*[\[\(\{]([^\]\)\}]+)[\]\)\}]")
    edge_re = re.compile(r"([A-Za-z_][\w]*)\s*-->?\s*(?:\|([^|]+)\|\s*)?([A-Za-z_][\w]*)")

    for line in mermaid.splitlines():
        for m in node_re.finditer(line):
            nodes.setdefault(m.group(1), m.group(2).strip())
        for m in edge_re.finditer(line):
            src, label, dst = m.group(1), (m.group(2) or "").strip(), m.group(3)
            nodes.setdefault(src, src)
            nodes.setdefault(dst, dst)
            edges.append((src, dst, label))

    elements = []
    pos: dict[str, tuple[int, int]] = {}
    # Simple grid layout
    for i, (nid, label) in enumerate(nodes.items()):
        col, row = i % 4, i // 4
        x, y = 80 + col * 260, 80 + row * 160
        pos[nid] = (x + 100, y + 40)
        elements.append({
            "id": f"node-{nid}",
            "type": "rectangle",
            "x": x, "y": y, "width": 200, "height": 80,
            "strokeColor": "#1e1e1e", "backgroundColor": "#e0f2fe",
            "fillStyle": "solid", "strokeWidth": 2, "roundness": {"type": 3},
            "seed": hash(nid) & 0xFFFFFFFF,
        })
        elements.append({
            "id": f"text-{nid}",
            "type": "text", "x": x + 10, "y": y + 28,
            "width": 180, "height": 25, "fontSize": 16, "fontFamily": 1,
            "text": label, "textAlign": "center",
            "seed": (hash(nid) + 1) & 0xFFFFFFFF,
        })
    for i, (s, d, label) in enumerate(edges):
        if s in pos and d in pos:
            sx, sy = pos[s]; dx, dy = pos[d]
            elements.append({
                "id": f"edge-{i}",
                "type": "arrow",
                "x": sx, "y": sy,
                "width": dx - sx, "height": dy - sy,
                "points": [[0, 0], [dx - sx, dy - sy]],
                "strokeColor": "#1e1e1e", "strokeWidth": 2,
                "startBinding": {"elementId": f"node-{s}"},
                "endBinding": {"elementId": f"node-{d}"},
                "seed": (i + 1000),
            })
    return {
        "type": "excalidraw", "version": 2, "source": "cortex",
        "elements": elements, "appState": {"viewBackgroundColor": "#ffffff"},
        "files": {},
    }


# ─── Mermaid → Draw.io XML ──────────────────────────────────────
def mermaid_to_drawio(mermaid: str) -> str:
    nodes: dict[str, str] = {}
    edges: list[tuple[str, str, str]] = []
    node_re = re.compile(r"([A-Za-z_][\w]*)\s*[\[\(\{]([^\]\)\}]+)[\]\)\}]")
    edge_re = re.compile(r"([A-Za-z_][\w]*)\s*-->?\s*(?:\|([^|]+)\|\s*)?([A-Za-z_][\w]*)")
    for line in mermaid.splitlines():
        for m in node_re.finditer(line):
            nodes.setdefault(m.group(1), m.group(2).strip())
        for m in edge_re.finditer(line):
            s, l, d = m.group(1), (m.group(2) or "").strip(), m.group(3)
            nodes.setdefault(s, s); nodes.setdefault(d, d)
            edges.append((s, d, l))

    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for i, (nid, label) in enumerate(nodes.items()):
        col, row = i % 4, i // 4
        x, y = 40 + col * 200, 40 + row * 120
        safe = label.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        cells.append(
            f'<mxCell id="{nid}" value="{safe}" style="rounded=1;whiteSpace=wrap;html=1;" '
            f'vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="160" height="60" as="geometry"/></mxCell>'
        )
    for i, (s, d, label) in enumerate(edges):
        safe = label.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        cells.append(
            f'<mxCell id="e{i}" value="{safe}" style="endArrow=classic;html=1;" '
            f'edge="1" parent="1" source="{s}" target="{d}">'
            f'<mxGeometry relative="1" as="geometry"/></mxCell>'
        )
    return (
        '<?xml version="1.0"?>\n'
        '<mxfile host="cortex"><diagram name="cortex">'
        '<mxGraphModel><root>' + "".join(cells) + '</root></mxGraphModel>'
        '</diagram></mxfile>'
    )


# ─── CLI ───────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(prog="cortex_diagram")
    p.add_argument("description")
    p.add_argument("-o", "--out", default=None, help="Base path (writes .mmd/.excalidraw/.drawio)")
    p.add_argument("--format", choices=["all", "mermaid", "excalidraw", "drawio"], default="all")
    a = p.parse_args()

    out_dir = Path.cwd() / "data" / "diagrams"
    out_dir.mkdir(parents=True, exist_ok=True)
    base = Path(a.out) if a.out else out_dir / f"{_slug(a.description)}-{int(time.time())}"

    print(f"✏️  generating Mermaid for: {a.description!r}")
    t0 = time.time()
    mermaid = generate_mermaid(a.description)
    print(f"   ({int((time.time() - t0) * 1000)} ms)")

    written = []
    if a.format in ("all", "mermaid"):
        mmd = base.with_suffix(".mmd")
        mmd.write_text(mermaid + "\n")
        written.append(mmd)
    if a.format in ("all", "excalidraw"):
        ex = base.with_suffix(".excalidraw")
        ex.write_text(json.dumps(mermaid_to_excalidraw(mermaid), indent=2))
        written.append(ex)
    if a.format in ("all", "drawio"):
        dr = base.with_suffix(".drawio")
        dr.write_text(mermaid_to_drawio(mermaid))
        written.append(dr)

    print("\n─── Mermaid preview ───")
    print(mermaid)
    print("\n─── Files written ─────")
    for w in written:
        print(f"  • {w}")
    print("\nTip: drop .excalidraw onto https://excalidraw.com · .drawio onto https://app.diagrams.net")


if __name__ == "__main__":
    main()
