import { CODE_EDIT_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'ai-memory',
  aliases: ['amem'],
  description: 'Persistent project memory — learns your conventions, writes CORTEX.md',
  progressMessage: 'updating memory',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## Project Memory Protocol

**Action:** ${args || 'update (default) | view | reset'}

You are the project's long-term memory keeper. Store learned conventions:

### Memory file: \`CORTEX.md\` in repo root

Sections:
- **Stack** — language, framework, DB, build tool
- **Conventions** — naming, file structure, import style, commit message style
- **Testing approach** — runner, location of tests, mocking style
- **Common pitfalls** — things that trip up newcomers in this codebase
- **Domain glossary** — project-specific terms
- **Do not touch** — files/folders that should never be modified without approval

### On "update"
1. Read existing CORTEX.md if present.
2. Survey the repo — entry points, package.json, tsconfig, a few source files.
3. Infer conventions from patterns seen.
4. Merge with existing memory (preserve user-added notes, update stale facts).
5. Write back to CORTEX.md.

### On "view"
- Print current CORTEX.md contents.

### On "reset"
- Ask user to confirm, then regenerate from scratch.

### Rules
- NEVER discard user-written notes — only augment.
- Keep file concise (<200 lines) — summarize, don't dump.
- Mark machine-generated sections with \`<!-- auto -->\` markers.

Proceed.`,
})
