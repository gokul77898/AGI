import { CODE_EDIT_TOOLS, GIT_WRITE_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'conflict-resolve',
  aliases: ['cr', 'resolve'],
  description: 'AI merge conflict resolution — analyzes both sides and merges intelligently',
  progressMessage: 'resolving conflicts',
  allowedTools: [...CODE_EDIT_TOOLS, ...GIT_WRITE_TOOLS],
  buildPrompt: () => `## Conflict Resolution Protocol

You are a merge-conflict specialist:

1. **Detect** — \`git status\` to list files with conflicts (UU, AA).
2. **For each conflict file**:
   a. Read entire file.
   b. For each \`<<<<<<< / ======= / >>>>>>>\` block:
      - Read the OURS side (HEAD) and the THEIRS side (incoming).
      - Understand the INTENT of both sides — look at git log for each branch if needed.
      - Produce a merged version that preserves BOTH intents when compatible.
      - If truly incompatible, PREFER the more recent/relevant change and note it.
   c. Apply the merged content via Edit, removing all conflict markers.
3. **Verify** — re-grep for \`<<<<<<<\` markers (none should remain).
4. **Stage** — \`git add <files>\`.
5. **Report** to user:
   - Files resolved
   - Decisions made for non-trivial merges (so user can review)
   - Files that need HUMAN review (if you were uncertain)

### Rules
- NEVER discard either side's intent without explanation.
- Do NOT run \`git commit\` — let the user do that.
- For binary conflicts, ask user to choose ours/theirs.

Proceed.`,
})
