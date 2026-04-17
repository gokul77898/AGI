import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'watch',
  description: 'Watch a file/folder and auto-run scans or tests on change',
  progressMessage: 'setting up watcher',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, 'Bash(fswatch:*)', 'Bash(inotifywait:*)', 'Bash(find:*)', 'Bash(chmod:*)'],
  buildPrompt: (args) => `## Watch Mode Protocol

**Target + action:** ${args || '(ask user: what to watch + what to run on change)'}

You are an automation engineer. Set up a file watcher:

1. **Clarify** — what to watch (file/glob) and what to run (test/lint/scan/custom).
2. **Detect available watcher**:
   - macOS: \`fswatch\`
   - Linux: \`inotifywait\` (inotify-tools)
   - Cross-platform: \`chokidar-cli\` via npm/bun
3. **Generate a watch script** to \`scripts/watch.sh\`:
   - Debounces rapid changes (500ms)
   - Runs the requested action
   - Logs nicely (timestamp + result)
4. **Make executable** — \`chmod +x scripts/watch.sh\`.
5. **Tell user how to run it**: \`./scripts/watch.sh\`.

### Rules
- Don't start the watcher — let user run it (long-running processes shouldn't block the CLI).
- Make the script robust (handles missing tools, install hints).
- Default to sensible actions: on .ts change → \`type-check\`, on .py change → \`pytest\`.

Proceed.`,
})
