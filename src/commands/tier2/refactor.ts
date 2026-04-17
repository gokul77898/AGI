import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'refactor',
  aliases: ['rf'],
  description: 'AI-powered refactoring (rename symbols, extract functions, convert patterns)',
  progressMessage: 'analyzing code for refactor',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Refactor Protocol

**Target:** ${args || '(no target specified — ask the user what to refactor)'}

You are an expert refactoring agent. Your job:

1. **Locate** the target code (file, symbol, or pattern) using Grep/Glob.
2. **Analyze** all usages and cross-references across the codebase.
3. **Plan** the refactor — list every file that will change.
4. **Apply** the changes using Edit/MultiEdit. Keep behavior identical.
5. **Verify** — re-grep for old patterns; ensure all references updated.

### Rules
- Preserve public APIs unless explicitly asked to break them.
- Keep formatting/style consistent with surrounding code.
- NEVER remove tests unless they're explicitly obsolete.
- Make atomic edits — if a change breaks the build, revert it.

### Output
After refactoring, print a summary:
- Files changed (with counts)
- Symbols renamed / functions extracted
- Any follow-up work the user should do

Proceed now.`,
})
