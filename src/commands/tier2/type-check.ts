import { CODE_EDIT_TOOLS, makeTierCommand, PKG_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'type-check',
  aliases: ['tc', 'typecheck'],
  description: 'Deep TypeScript/type analysis with AI-suggested fixes',
  progressMessage: 'running type analysis',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, ...PKG_TOOLS, 'Bash(tsc:*)', 'Bash(mypy:*)', 'Bash(pyright:*)'],
  buildPrompt: () => `## Type Check Protocol

You are a type-safety expert. Perform a deep type analysis:

1. **Detect type checker**:
   - TypeScript → \`tsc --noEmit\`
   - Python → \`mypy\` or \`pyright\`
   - Rust → \`cargo check\`

2. **Run it**, capture all type errors.

3. **For each error**:
   - Read the offending file + context.
   - Classify: missing annotation, \`any\` leak, narrowing issue, unsafe cast, structural mismatch.
   - Propose a fix that **tightens** type safety (not loosens).

4. **Apply high-confidence fixes** via Edit. Flag risky ones for user review.

5. **Re-check** until clean or user asks to stop.

### Rules
- NEVER add \`any\` / \`# type: ignore\` unless truly necessary.
- Prefer union types / generics over loose types.
- Add missing annotations to exported APIs first.

### Output
- Error count before/after
- Files touched
- Remaining errors categorized

Proceed.`,
})
