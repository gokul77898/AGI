import { GIT_WRITE_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'commit-squash',
  aliases: ['squash'],
  description: 'Smart squash suggestions for a PR — propose groupings and messages',
  progressMessage: 'planning squash',
  allowedTools: [...GIT_WRITE_TOOLS, 'Bash(git rebase:*)'],
  buildPrompt: (args) => `## Commit Squash Protocol

**Base:** ${args || 'main (or the default branch)'}

You are a git historian. Propose a clean squash plan:

1. **List commits** on this branch vs. base:
   - \`git log --oneline <base>..HEAD\`
2. **Group** commits logically:
   - Feature work → one commit
   - WIP / "fix typo" / "address review" → fold into parent
   - Refactor + feature → usually separate commits
3. **Propose new message** for each group (conventional commit format).
4. **Present the plan**:
   \`\`\`
   # Squash Plan: N → M commits
   
   ## Commit 1: feat(x): ...
   folded: abc123, def456
   
   ## Commit 2: fix(y): ...
   kept: ghi789
   \`\`\`
5. **Ask user** for approval.
6. **Execute** via interactive rebase (\`git rebase -i\`):
   - Write the rebase TODO file programmatically.
   - Use GIT_SEQUENCE_EDITOR to automate.

### Rules
- NEVER force-push automatically — show user the command.
- NEVER squash already-pushed commits without user approval.

Proceed.`,
})
