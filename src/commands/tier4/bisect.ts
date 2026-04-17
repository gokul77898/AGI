import { GIT_WRITE_TOOLS, makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'bisect',
  description: 'AI-guided git bisect to find the commit that introduced a bug',
  progressMessage: 'running guided bisect',
  allowedTools: [...GIT_WRITE_TOOLS, ...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Bash(git bisect:*)'],
  buildPrompt: (args) => `## Guided Bisect Protocol

**Bug description:** ${args || '(ask user for bug description + how to reproduce it)'}

You are a senior debugger. Drive a git bisect:

1. **Clarify** — ensure you know:
   - How to reproduce the bug (test command, URL, or steps)
   - A known-good commit ($GOOD) — ask user
   - A known-bad commit ($BAD) — default HEAD
2. **Start** — \`git bisect start $BAD $GOOD\`
3. **Loop**:
   - Analyze HEAD, identify WHAT changed recently that's likely relevant.
   - Run the repro test.
   - \`git bisect good\` or \`git bisect bad\`
4. **When done**:
   - Show the culprit commit + diff.
   - Explain likely root cause in plain English.
   - Propose a fix.
   - Run \`git bisect reset\` to clean up.

### Rules
- ALWAYS \`git bisect reset\` when done or on error.
- Never leave the repo in a bisecting state.
- If repro is ambiguous, ask user before marking good/bad.

Proceed.`,
})
