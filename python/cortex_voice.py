#!/usr/bin/env python3
"""
CORTEX Voice I/O — speech-to-text (Whisper) and text-to-speech (TTS) via HuggingFace.

Usage:
    python3 cortex_voice.py listen                  # record 10s from mic → text
    python3 cortex_voice.py listen --seconds 30
    python3 cortex_voice.py transcribe file.wav     # transcribe an existing audio file
    python3 cortex_voice.py speak "Hello world"     # TTS → out.wav (and plays it)
    python3 cortex_voice.py speak "..." -o foo.wav --no-play

Requires env var: HF_TOKEN
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    sys.exit("❌ HF_TOKEN env var not set")

WHISPER_MODEL = os.environ.get("CORTEX_STT_MODEL", "openai/whisper-large-v3-turbo")
TTS_MODEL = os.environ.get("CORTEX_TTS_MODEL", "facebook/mms-tts-eng")


def require(mod_name: str, pip_name: str | None = None):
    try:
        return __import__(mod_name)
    except ImportError:
        pip = pip_name or mod_name
        sys.exit(f"❌ Missing dep: pip install {pip}")


# ─── Record audio ──────────────────────────────────────────────
def record(seconds: int, samplerate: int = 16000) -> Path:
    sd = require("sounddevice")
    np = require("numpy")
    print(f"🎙  Recording {seconds}s... (speak now)")
    audio = sd.rec(int(seconds * samplerate), samplerate=samplerate, channels=1, dtype="int16")
    sd.wait()
    tmp = Path(tempfile.mktemp(suffix=".wav"))
    with wave.open(str(tmp), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(samplerate)
        wf.writeframes(audio.tobytes())
    print(f"✅ Recorded to {tmp}")
    return tmp


# ─── Speech → Text (Whisper) ───────────────────────────────────
def transcribe(audio_path: Path) -> str:
    requests = require("requests")
    url = f"https://router.huggingface.co/hf-inference/models/{WHISPER_MODEL}"
    with open(audio_path, "rb") as f:
        data = f.read()
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "audio/wav",
        },
        data=data,
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Whisper error {r.status_code}: {r.text[:300]}")
    data = r.json()
    text = data.get("text") or data.get("generated_text") or str(data)
    return text.strip()


# ─── Text → Speech ─────────────────────────────────────────────
def synthesize(text: str, out_path: Path, play: bool = True):
    """TTS: prefer macOS `say` (offline, free), fall back to HF router.

    macOS has a world-class built-in TTS via `say` that produces .aiff/.wav
    instantly with no network call. We use it whenever available. On Linux
    we fall back to `espeak`. HF TTS is attempted last because the free tier
    is flaky for audio outputs.
    """
    # 1. macOS — built-in `say` is excellent and instant
    if sys.platform == "darwin":
        # `say -o file.aiff` then convert to WAV via afconvert
        aiff_tmp = out_path.with_suffix(".aiff")
        voice = os.environ.get("CORTEX_TTS_VOICE", "Samantha")
        r = subprocess.run(
            ["say", "-v", voice, "-o", str(aiff_tmp), text],
            capture_output=True,
        )
        if r.returncode == 0 and aiff_tmp.exists():
            # Convert to WAV
            subprocess.run(
                ["afconvert", "-f", "WAVE", "-d", "LEI16", str(aiff_tmp), str(out_path)],
                check=False, capture_output=True,
            )
            aiff_tmp.unlink(missing_ok=True)
            if out_path.exists():
                print(f"✅ macOS say ({voice}): {out_path.stat().st_size} bytes → {out_path}")
                if play:
                    subprocess.run(["afplay", str(out_path)], check=False)
                return

    # 2. Linux — espeak fallback
    if sys.platform.startswith("linux"):
        r = subprocess.run(
            ["espeak", "-w", str(out_path), text],
            capture_output=True,
        )
        if r.returncode == 0 and out_path.exists():
            print(f"✅ espeak: {out_path.stat().st_size} bytes → {out_path}")
            if play:
                subprocess.run(["aplay", str(out_path)], check=False)
            return

    # 3. HF Router fallback (rarely works on free tier for TTS)
    requests = require("requests")
    url = f"https://router.huggingface.co/hf-inference/models/{TTS_MODEL}"
    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {HF_TOKEN}", "Accept": "audio/wav"},
        json={"inputs": text, "options": {"wait_for_model": True}},
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(
            f"TTS failed on all backends. HF response: {r.status_code} {r.text[:200]}\n"
            f"On macOS, check that `say` is available. On Linux, install espeak."
        )
    out_path.write_bytes(r.content)
    print(f"✅ HF TTS: {len(r.content)} bytes → {out_path}")
    if play and sys.platform == "darwin":
        subprocess.run(["afplay", str(out_path)], check=False)
    elif play and sys.platform.startswith("linux"):
        subprocess.run(["aplay", str(out_path)], check=False)


# ─── CLI ───────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(prog="cortex_voice")
    sp = p.add_subparsers(dest="cmd", required=True)

    l = sp.add_parser("listen", help="Record from mic → transcribe")
    l.add_argument("--seconds", type=int, default=10)

    t = sp.add_parser("transcribe", help="Transcribe an existing audio file")
    t.add_argument("file")

    sk = sp.add_parser("speak", help="Text → speech → .wav")
    sk.add_argument("text")
    sk.add_argument("-o", "--out", default="out.wav")
    sk.add_argument("--no-play", action="store_true")

    args = p.parse_args()

    if args.cmd == "listen":
        audio = record(args.seconds)
        print("🔊 Transcribing...")
        text = transcribe(audio)
        print(f"\n📝 You said:\n{text}\n")
    elif args.cmd == "transcribe":
        text = transcribe(Path(args.file))
        print(text)
    elif args.cmd == "speak":
        synthesize(args.text, Path(args.out), play=not args.no_play)


if __name__ == "__main__":
    main()
