import { makeTierCommand, READ_ONLY_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'explain',
  aliases: ['ex'],
  description: 'Explain any code, file, function, or symbol in plain English',
  progressMessage: 'explaining code',
  allowedTools: READ_ONLY_TOOLS,
  buildPrompt: (args) => `## Explain Protocol

**Target:** ${args || '(no target — ask the user what to explain)'}

You are a senior engineer teaching a colleague. Your job:

1. **Locate** the target (file path, function name, or concept) using Read/Grep/Glob.
2. **Read** it carefully, including related files it depends on.
3. **Explain** in plain English:
   - **Purpose** — what this code exists to do (1 sentence)
   - **How it works** — step-by-step walkthrough of the logic
   - **Key dependencies** — what it imports, what imports it
   - **Edge cases & gotchas** — non-obvious behavior, potential bugs
   - **Example usage** — a small code snippet showing how to call it

### Style
- Clear, concise, no jargon unless you define it.
- Use bullet points and short paragraphs.
- Reference exact line numbers when helpful.
- End with "**TL;DR:**" — one-sentence summary.

Proceed.`,
})
