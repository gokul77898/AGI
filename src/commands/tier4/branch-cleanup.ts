import { GIT_WRITE_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'branch-cleanup',
  aliases: ['bclean'],
  description: 'Identify and delete stale branches (local + remote)',
  progressMessage: 'auditing branches',
  allowedTools: [...GIT_WRITE_TOOLS, 'Bash(git fetch:*)', 'Bash(git branch:-d:*)', 'Bash(git branch:-D:*)', 'Bash(git push:*)'],
  buildPrompt: () => `## Branch Cleanup Protocol

You are a git hygienist. Audit and clean up branches:

1. **Fetch + prune**:
   - \`git fetch --all --prune\`
2. **List branches**:
   - \`git branch -a --sort=-committerdate\`
   - \`git for-each-ref --sort=-committerdate refs/heads/ --format='%(refname:short) %(committerdate:iso) %(authorname)'\`
3. **Classify each branch**:
   - **Merged** — \`git branch --merged main\`
   - **Stale** — no commits in >60 days
   - **Active** — recent commits
   - **Default/protected** — main, master, develop, release/*
4. **Report** (Markdown table):
   | Branch | Last commit | Author | Status | Safe to delete? |
5. **Ask user** before deleting anything.
6. **Delete** on confirm:
   - Local: \`git branch -d <name>\` (or -D if unmerged but user approved)
   - Remote: \`git push origin --delete <name>\`

### Rules
- NEVER delete protected branches.
- ALWAYS confirm with user before deletion.
- NEVER force-delete unmerged branches without explicit user approval.

Proceed.`,
})
