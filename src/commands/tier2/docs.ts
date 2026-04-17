import { CODE_EDIT_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'docs',
  aliases: ['doc'],
  description: 'Auto-generate JSDoc/docstrings/README sections for code',
  progressMessage: 'generating documentation',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## Docs Generation Protocol

**Target:** ${args || '(no target — ask the user: file, folder, or README)'}

You are a technical writer. Generate high-quality documentation:

1. **Locate** the target file(s) or folder.
2. **For source files** — add inline docs:
   - TypeScript/JavaScript → JSDoc blocks (@param, @returns, @throws, @example)
   - Python → Google-style docstrings
   - Rust/Go → doc comments
3. **For READMEs** — generate/update sections:
   - Purpose, Installation, Usage, API, Examples, Contributing
4. **Preserve existing docs** — only augment, never delete, unless outdated.

### Rules
- Every exported function/class MUST get a doc block.
- Use examples drawn from actual usage in the codebase (grep for call sites).
- Keep doc blocks concise — explain the **why**, not the obvious **what**.
- Use MultiEdit for efficiency when touching many files.

### Output
Print a summary of files documented and symbols covered.

Proceed.`,
})
