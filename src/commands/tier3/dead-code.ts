import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'dead-code',
  aliases: ['dc', 'deadcode'],
  description: 'Find unused exports, functions, variables, and files',
  progressMessage: 'hunting dead code',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Dead Code Detection Protocol

**Scope:** ${args || 'entire repo'}

You are a code-pruning specialist. Find code that is no longer used:

### 1. Unused exports
- For each \`export\` in source files, grep for imports of that name.
- If zero importers (excluding tests), flag as unused.

### 2. Unused files
- For each file, check if it's imported anywhere.
- Entry points + config files are exempt.

### 3. Unused functions / variables (within a file)
- Functions/vars declared but never referenced in the same file.

### 4. Unreachable code
- Code after \`return\` / \`throw\` / \`process.exit\`.

### Output (Markdown)
\`\`\`
# Dead Code Report

## Unused exports (<N>)
- path/file.ts:L — \`functionName\`

## Unused files (<N>)
- path/to/file.ts

## Unused locals (<N>)
- path/file.ts:L — \`varName\` in \`funcName()\`

## Recommendations
<which to remove first>
\`\`\`

### Rules
- NEVER auto-delete — only report. Ask user for confirmation before removing.
- Consider dynamic imports (\`require(varName)\`) and re-exports.
- Test fixtures and types often look dead but aren't — investigate.

Proceed.`,
})
