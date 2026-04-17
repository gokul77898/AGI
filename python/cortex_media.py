#!/usr/bin/env python3
"""
CORTEX Media — image + video generation via HuggingFace Router.

Usage:
    python3 cortex_media.py image "cyberpunk cat at sunset"
    python3 cortex_media.py image "<prompt>" -o out.png --model black-forest-labs/FLUX.1-schnell
    python3 cortex_media.py video "5s explainer of login flow" -o out.mp4

Free-tier models used by default:
    image: black-forest-labs/FLUX.1-schnell
    video: tencent/HunyuanVideo  (may require pro tier; falls back gracefully)

Env overrides:
    CORTEX_IMAGE_MODEL   = HF model id for image
    CORTEX_VIDEO_MODEL   = HF model id for video
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time
from pathlib import Path

# Load .env from repo root if present
DOTENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(DOTENV_PATH):
    for line in open(DOTENV_PATH).read().splitlines():
        m = re.match(r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$', line)
        if m and not os.getenv(m.group(1)):
            val = m.group(2)
            if val and (val[0] == '"' or val[0] == "'") and val[-1] == val[0]:
                val = val[1:-1]
            os.environ[m.group(1)] = val

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    sys.exit("❌ HF_TOKEN env var not set (check .env)")

IMAGE_MODEL = os.environ.get("CORTEX_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
VIDEO_MODEL = os.environ.get("CORTEX_VIDEO_MODEL", "tencent/HunyuanVideo")


def require(mod: str, pip: str | None = None):
    try:
        return __import__(mod)
    except ImportError:
        sys.exit(f"❌ Missing dep: pip install {pip or mod}")


def _slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower()).strip("-")
    return (s[:40] or "out")


# ─── Image (FLUX) ──────────────────────────────────────────────
def generate_image(prompt: str, out: Path, model: str = IMAGE_MODEL) -> Path:
    requests = require("requests")
    url = f"https://router.huggingface.co/hf-inference/models/{model}"
    print(f"🎨 {model}  ← {prompt!r}")
    t0 = time.time()
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {HF_TOKEN}", "Accept": "image/png"},
        json={"inputs": prompt, "parameters": {"num_inference_steps": 4}},
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"HF {r.status_code}: {r.text[:300]}")
    out.write_bytes(r.content)
    ms = int((time.time() - t0) * 1000)
    print(f"✅ {out} ({len(r.content) // 1024} KB, {ms} ms)")
    # auto-open on macOS
    if sys.platform == "darwin":
        subprocess.run(["open", str(out)], check=False)
    return out


# ─── Video (HunyuanVideo / fallback) ───────────────────────────
def generate_video(prompt: str, out: Path, model: str = VIDEO_MODEL, seconds: int = 5) -> Path:
    requests = require("requests")
    url = f"https://router.huggingface.co/hf-inference/models/{model}"
    print(f"🎬 {model}  ← {prompt!r}  ({seconds}s)")
    t0 = time.time()
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {HF_TOKEN}", "Accept": "video/mp4"},
        json={
            "inputs": prompt,
            "parameters": {"num_frames": seconds * 24, "fps": 24},
        },
        timeout=600,
    )
    if r.status_code != 200:
        # Most free tokens can't access video models — surface actionable error
        raise RuntimeError(
            f"HF {r.status_code}: {r.text[:300]}\n"
            f"Tip: video models often need pro access. "
            f"Override with CORTEX_VIDEO_MODEL or use the FLUX image pipeline "
            f"+ ffmpeg to animate stills."
        )
    out.write_bytes(r.content)
    ms = int((time.time() - t0) * 1000)
    print(f"✅ {out} ({len(r.content) // 1024} KB, {ms} ms)")
    if sys.platform == "darwin":
        subprocess.run(["open", str(out)], check=False)
    return out


# ─── CLI ───────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(prog="cortex_media")
    sp = p.add_subparsers(dest="cmd", required=True)

    pi = sp.add_parser("image", help="Text → PNG via FLUX")
    pi.add_argument("prompt")
    pi.add_argument("-o", "--out", default=None)
    pi.add_argument("--model", default=IMAGE_MODEL)

    pv = sp.add_parser("video", help="Text → MP4")
    pv.add_argument("prompt")
    pv.add_argument("-o", "--out", default=None)
    pv.add_argument("--model", default=VIDEO_MODEL)
    pv.add_argument("--seconds", type=int, default=5)

    a = p.parse_args()

    out_dir = Path.cwd() / "data" / "media"
    out_dir.mkdir(parents=True, exist_ok=True)

    if a.cmd == "image":
        out = Path(a.out) if a.out else out_dir / f"img-{_slug(a.prompt)}-{int(time.time())}.png"
        generate_image(a.prompt, out, a.model)
    elif a.cmd == "video":
        out = Path(a.out) if a.out else out_dir / f"vid-{_slug(a.prompt)}-{int(time.time())}.mp4"
        generate_video(a.prompt, out, a.model, a.seconds)


if __name__ == "__main__":
    main()
