#!/usr/bin/env python3
"""
CORTEX Voice Loop — continuous hands-free AGI.

Runs a loop: listen → transcribe → ask AGI → speak response → repeat.
Say "goodbye", "exit", "quit", or "stop" to end.

Usage:
    python3 cortex_voice_loop.py                 # 10s listen windows
    python3 cortex_voice_loop.py --seconds 15    # longer listens
    python3 cortex_voice_loop.py --voice Alex    # different TTS voice
    python3 cortex_voice_loop.py --no-speak      # transcribe only, no TTS
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VOICE_SCRIPT = REPO_ROOT / "python" / "cortex_voice.py"
AGI_BIN = REPO_ROOT / "cortex.mjs"

EXIT_PHRASES = {"goodbye", "exit", "quit", "stop", "bye", "end"}


def banner():
    print("\n" + "═" * 60)
    print("🎤 CORTEX Voice Loop — hands-free AGI")
    print("═" * 60)
    print("• Speak your request after the beep")
    print("• Say 'goodbye' / 'exit' / 'quit' to end")
    print("• Press Ctrl-C anytime to stop\n")


def speak(text: str, voice: str = "Samantha"):
    """Fast TTS via macOS `say` directly (no file intermediate)."""
    if sys.platform == "darwin":
        subprocess.run(["say", "-v", voice, text], check=False)
    elif sys.platform.startswith("linux"):
        subprocess.run(["espeak", text], check=False)
    else:
        print(f"🔊 (tts unavailable on {sys.platform}): {text}")


def listen(seconds: int) -> str:
    """Record from mic + transcribe via Whisper. Returns stripped text."""
    subprocess.run(["afplay", "/System/Library/Sounds/Tink.aiff"], check=False)
    r = subprocess.run(
        [sys.executable, str(VOICE_SCRIPT), "listen", "--seconds", str(seconds)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"⚠️  listen failed: {r.stderr}")
        return ""
    # Extract the transcription — printed after "📝 You said:"
    m = re.search(r"📝 You said:\s*\n(.+?)(?:\n\n|\Z)", r.stdout, re.DOTALL)
    if m:
        return m.group(1).strip()
    return ""


def ask_agi(prompt: str) -> str:
    """Invoke AGI in print-once mode and return the response text."""
    if not AGI_BIN.exists():
        return f"AGI binary not found at {AGI_BIN}"
    print(f"🧠 Asking AGI: {prompt[:80]}...")
    r = subprocess.run(
        [str(AGI_BIN), "-p", prompt],
        capture_output=True, text=True,
        timeout=180,
        cwd=str(REPO_ROOT),
    )
    out = r.stdout.strip()
    if not out:
        return r.stderr.strip() or "(AGI returned no output)"
    # Strip ANSI escape codes for clean TTS
    out = re.sub(r"\x1b\[[0-9;]*[mGK]", "", out)
    return out


def summarize_for_speech(text: str, max_chars: int = 600) -> str:
    """Trim long AGI responses so TTS doesn't drone on forever."""
    # Remove code blocks — TTS reading code is useless
    text = re.sub(r"```[\s\S]*?```", " (code block omitted) ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    # Cut at sentence boundary if possible
    truncated = text[:max_chars]
    last_period = truncated.rfind(".")
    if last_period > max_chars // 2:
        truncated = truncated[: last_period + 1]
    return truncated + " (response truncated)"


def main():
    p = argparse.ArgumentParser(prog="cortex_voice_loop")
    p.add_argument("--seconds", type=int, default=10, help="listen window per turn")
    p.add_argument("--voice", default=os.environ.get("CORTEX_TTS_VOICE", "Samantha"))
    p.add_argument("--no-speak", action="store_true", help="disable TTS, print only")
    args = p.parse_args()

    banner()
    speak("CORTEX voice loop online. How can I help?", voice=args.voice)

    while True:
        try:
            text = listen(args.seconds)
            if not text:
                print("… (nothing heard, try again)\n")
                continue
            print(f"🗣  You: {text}\n")

            if any(phrase in text.lower() for phrase in EXIT_PHRASES):
                speak("Goodbye, Gokul.", voice=args.voice)
                print("👋 Exiting voice loop.")
                break

            response = ask_agi(text)
            print(f"🤖 AGI:\n{response}\n{'─' * 60}\n")

            if not args.no_speak:
                speak(summarize_for_speech(response), voice=args.voice)

        except KeyboardInterrupt:
            print("\n👋 Interrupted. Exiting.")
            break
        except Exception as e:
            print(f"⚠️  Error: {e}")
            continue


if __name__ == "__main__":
    main()
