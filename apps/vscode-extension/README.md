# CORTEX — VS Code / Cursor extension

Right-click any code selection → **Ask / Explain / Refactor / Fix with CORTEX**.

## Install (dev mode)

1. Open this folder in VS Code or Cursor: `apps/vscode-extension`
2. Press **F5** → opens an Extension Development Host window with CORTEX loaded.
3. In that window, open any code file, select some code, right-click → choose a CORTEX action.

## Install (permanent, local)

```bash
cd apps/vscode-extension
npm install -g @vscode/vsce      # one-time
vsce package                     # creates cortex-vscode-0.1.0.vsix
code --install-extension cortex-vscode-0.1.0.vsix   # or `cursor --install-extension …`
```

## Commands

| Title | What it does |
|---|---|
| **CORTEX: Ask about selection** | You type a question; CORTEX answers with the selection as context. |
| **CORTEX: Explain selection** | Line-by-line explanation. |
| **CORTEX: Refactor selection** | You give a goal; CORTEX rewrites + explains changes. |
| **CORTEX: Find bugs in selection** | Bug hunt + minimal fixes. |
| **CORTEX: Ask about whole file** | Sends the whole file (up to 50k chars) + your question. |

Output streams into a Markdown editor tab beside your code.

## Configuration

The extension auto-detects `cortex.mjs` in:
1. Any open workspace folder
2. `~/Documents/openclaude/cortex.mjs`

Override via **Settings → Extensions → CORTEX → Cli Path**.

## Requires

Your repo's `cortex.mjs` and its `.env` (with `HF_TOKEN`). The extension runs with
`--dangerously-skip-permissions` so no yes/no prompts block the streaming output.
