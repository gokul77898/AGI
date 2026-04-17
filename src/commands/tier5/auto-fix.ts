import { CODE_EDIT_TOOLS, GIT_WRITE_TOOLS, makeTierCommand, PKG_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'auto-fix',
  aliases: ['autofix'],
  description: 'Continuous loop: scan → fix → test → commit (until clean)',
  progressMessage: 'running auto-fix loop',
  allowedTools: [...CODE_EDIT_TOOLS, ...GIT_WRITE_TOOLS, ...SHELL_TOOLS, ...PKG_TOOLS],
  buildPrompt: (args) => `## Auto-Fix Loop Protocol

**Target issue class:** ${args || 'lint + type errors'}

You are an autonomous fix agent. Run a bounded fix loop:

### Loop (max 5 iterations)
1. **Scan** — run the relevant checker(s):
   - \`npm run lint\` / eslint
   - \`npm run typecheck\` / tsc
   - \`npm test\` (if user requested tests)
   - \`ruff\` / \`mypy\` (Python)
2. **If 0 errors** → exit loop, commit, done.
3. **If errors** → pick the highest-confidence 5 to fix this iteration.
4. **Apply fixes** via Edit/MultiEdit.
5. **Commit** each round: \`chore: auto-fix lint/type errors (round N)\`.
6. **Repeat**.

### Exit conditions
- 0 errors remaining
- No progress for 2 rounds (stuck)
- 5 rounds elapsed
- Error count grew (regression — revert last round, stop)

### Rules
- NEVER bypass tests by deleting them.
- NEVER cast to \`any\` / \`unknown\` as a shortcut.
- Commit per-round so user can revert granularly.
- Stop early and ask user if confused.

### Final report
- Rounds run
- Errors: before → after
- Commits created
- What remains (requires human)

Proceed.`,
})
