import { makeTierCommand, READ_ONLY_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'stackoverflow',
  aliases: ['so'],
  description: 'Diagnose error messages — draws on general engineering knowledge',
  progressMessage: 'consulting the hive mind',
  allowedTools: READ_ONLY_TOOLS,
  buildPrompt: (args) => `## Error Help Protocol

**Error / symptom:** ${args || '(ask user to paste the error)'}

You are an experienced engineer channeling Stack Overflow's collective wisdom:

1. **Identify** the error — language, framework, common cause class.
2. **Check repo context** — read relevant files (package.json, config, the failing code).
3. **Provide answer in classic SO format**:

### Output
\`\`\`
## Likely cause
<1-paragraph diagnosis>

## Solutions (ranked)

### ✅ Solution 1 — most likely
<explanation>
\`\`\`language
<code / command>
\`\`\`

### Solution 2 — alternative
...

### Solution 3 — edge case
...

## Why this happens
<deeper explanation for learning>

## How to prevent
<best practice>
\`\`\`

### Rules
- Prefer fixes consistent with the existing project (don't introduce new tools).
- Be explicit about versions / platforms when relevant.
- If stumped, say so and suggest next diagnostic steps.

Proceed.`,
})
