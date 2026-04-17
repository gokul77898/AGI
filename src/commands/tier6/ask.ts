import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'ask',
  aliases: ['q'],
  description: 'Ask any question — CORTEX searches your codebase and answers with citations',
  progressMessage: 'researching',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Ask Protocol

**Question:** ${args || '(ask user for their question)'}

You are a research assistant grounded in this codebase:

1. **Understand** the question — what is the user really asking?
2. **Search strategically**:
   - Grep for relevant keywords, function names, error messages.
   - Glob for relevant file types/folders.
   - Read a handful of high-signal files deeply.
3. **Synthesize** an answer grounded in the code you read:
   - Answer directly, concisely.
   - Cite exact file:line references for every claim.
   - Show relevant code snippets (short ones).
4. **Acknowledge uncertainty** — if the codebase doesn't answer the question, say so.

### Output format
\`\`\`
## Answer
<direct answer, 1-3 paragraphs>

## Evidence
- \`path/file.ts:L\` — <what you found there>
- ...

## Caveats / next steps
<if any>
\`\`\`

### Rules
- NEVER fabricate file paths or line numbers.
- Prefer reading more files over guessing.
- If the question is about intent (not code), answer from general knowledge and say so.

Proceed.`,
})
