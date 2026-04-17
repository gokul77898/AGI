import { GIT_READ_TOOLS, makeTierCommand, READ_ONLY_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'review-queue',
  aliases: ['rq'],
  description: 'Pull PRs assigned to you (GitHub/GitLab) + produce a review priority queue',
  progressMessage: 'fetching PRs',
  allowedTools: [...GIT_READ_TOOLS, ...READ_ONLY_TOOLS, 'Bash(gh:*)', 'Bash(glab:*)'],
  buildPrompt: () => `## Review Queue Protocol

You are a code-review triage assistant:

1. **Detect platform** (GitHub via \`gh\` CLI, GitLab via \`glab\`).
2. **Fetch assigned PRs**:
   - GitHub: \`gh pr list --search "review-requested:@me" --json number,title,author,additions,deletions,updatedAt,headRefName\`
   - GitLab: \`glab mr list --reviewer=@me --output json\`
3. **For each PR**, score priority:
   - **URGENT** — labeled hotfix/critical, or blocking main
   - **HIGH** — small PR (<200 LOC), quick win
   - **MEDIUM** — normal PR
   - **LOW** — draft, large (>1000 LOC), stale
4. **Produce queue** (Markdown):
   \`\`\`
   # Review Queue — N PRs waiting

   ## 🔴 Urgent (<count>)
   - #123 title — +X/-Y — author — url
     Summary: <1-sentence>
     Why urgent: <reason>

   ## 🟡 High / Medium / Low
   ...
   \`\`\`
5. **Recommend** which 3 to tackle first based on your score.

Proceed.`,
})
