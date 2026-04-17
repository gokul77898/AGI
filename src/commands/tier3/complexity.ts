import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'complexity',
  aliases: ['cx'],
  description: 'Cyclomatic complexity report + refactor hot spots',
  progressMessage: 'measuring complexity',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Complexity Analysis Protocol

**Scope:** ${args || 'entire source tree'}

You are a code-quality analyst. Measure cyclomatic complexity:

1. **Enumerate source files** (skip tests, generated, vendored).
2. **For each file, approximate complexity**:
   - Count branches: if/else, switch/case, loops, ternaries, &&/||, try/catch.
   - Count functions and their individual complexity.
   - Flag functions with >10 branches (high), >20 (critical).
3. **Rank files** by total complexity.
4. **Identify hot spots** — files AND functions needing refactor.

### Output (Markdown)
\`\`\`
# Complexity Report

## Summary
- Files analyzed: N
- Avg function complexity: X
- Critical hot spots: M

## Top 10 Most Complex Files
| File | Lines | Funcs | Avg CC | Max CC |

## Top 10 Most Complex Functions
| File:Line | Name | CC | Recommendation |

## Refactor Recommendations
1. <specific file + approach>
2. ...
\`\`\`

Proceed.`,
})
