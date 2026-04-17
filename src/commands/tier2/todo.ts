import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'todo',
  description: 'Scan codebase for TODO/FIXME/HACK comments and prioritize them',
  progressMessage: 'scanning for TODOs',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## TODO Scan Protocol

**Scope:** ${args || 'entire repo'}

You are a tech-debt analyst. Find and prioritize all TODOs:

1. **Scan** using Grep for: \`TODO\`, \`FIXME\`, \`HACK\`, \`XXX\`, \`@todo\`, \`@fixme\`.
   (exclude node_modules, dist, build, .git, venv)
2. **For each match**, extract:
   - File + line
   - The TODO comment text
   - Surrounding code context (5 lines)
3. **Categorize** each TODO:
   - **CRITICAL** — security, data loss, crashes
   - **HIGH** — correctness bugs, broken features
   - **MEDIUM** — tech debt, refactor candidates
   - **LOW** — nice-to-haves, stylistic

### Output (Markdown)
\`\`\`
# TODO Report — <N> items found

## CRITICAL (<count>)
- \`path/file.ts:42\` — "FIXME: race condition in auth"
  > context: ...

## HIGH (<count>)
...

## MEDIUM / LOW
...

## Recommendations
<top 3 to tackle first>
\`\`\`

Proceed.`,
})
