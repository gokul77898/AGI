import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'fix',
  description: 'Paste an error or stack trace → AI diagnoses the root cause and fixes it',
  progressMessage: 'diagnosing error',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Error Fix Protocol

**Error / Stack trace provided by user:**
\`\`\`
${args || '(no error pasted — ask the user to paste the error or stack trace)'}
\`\`\`

You are a senior debugger. Follow this protocol:

1. **Parse** the error — identify file paths, line numbers, error type, message.
2. **Locate** the offending code using Read/Grep. Read surrounding context.
3. **Diagnose root cause**:
   - What is the code doing wrong?
   - What is the expected behavior?
   - Is it a type error, logic error, missing dependency, race condition, etc?
4. **Fix** — apply the minimal change that resolves the issue.
5. **Verify** — trace through the fix mentally. Check for regressions.
6. **Explain** — tell the user:
   - Root cause (1–2 sentences)
   - What you changed (file + lines)
   - Why this fixes it
   - How to prevent it in the future

### Rules
- Fix the **root cause**, not the symptom.
- Prefer minimal single-line changes when possible.
- If the error is environmental (missing package, config), propose the fix but don't execute install commands without asking.

Proceed.`,
})
