#!/usr/bin/env bash
# =============================================================================
# CORTEX CLI - One-command installer
# =============================================================================
# Creates a Python venv, installs all Python deps, installs uvx for MCP servers,
# installs npm deps, and builds the CLI. Run once after cloning.
# =============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "╔════════════════════════════════════════════════════╗"
echo "║          CORTEX CLI Installer                      ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# ---------- 1. Python venv ----------
echo "▶ [1/5] Creating Python venv at .venv/ ..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "  ✓ venv created"
else
  echo "  ✓ venv already exists"
fi

# Activate venv for this script
source .venv/bin/activate
echo "  ✓ venv activated: $(which python)"

# ---------- 2. Python deps ----------
echo ""
echo "▶ [2/5] Installing Python dependencies ..."
pip install --quiet --upgrade pip
pip install --quiet -r python/requirements.txt
echo "  ✓ Installed: transformers, torch, huggingface_hub, python-dotenv, openai, httpx, psutil, tiktoken"

# ---------- 3. uvx for MCP servers ----------
echo ""
echo "▶ [3/5] Installing uvx (Python MCP runner) ..."
pip install --quiet uv
echo "  ✓ uv/uvx installed in venv"

# ---------- 4. Node deps ----------
echo ""
echo "▶ [4/5] Installing Node.js dependencies ..."
if [ -f "bun.lock" ] && command -v bun &> /dev/null; then
  bun install --silent
  echo "  ✓ Installed via bun"
else
  npm install --silent
  echo "  ✓ Installed via npm"
fi

# ---------- 5. Build CLI ----------
echo ""
echo "▶ [5/5] Building CLI (dist/cli.mjs) ..."
npm run build
echo "  ✓ Built dist/cli.mjs"

# ---------- Done ----------
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  ✅ CORTEX installed successfully                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Quick start:"
echo "   ./cortex.mjs \"hello world\""
echo ""
echo "📝 Configure .env with your API keys (see .env.example)"
echo ""
