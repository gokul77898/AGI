import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'metrics',
  description: 'Performance / repo health dashboard in the terminal',
  progressMessage: 'collecting metrics',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Bash(git:*)', 'Bash(cloc:*)', 'Bash(tokei:*)'],
  buildPrompt: () => `## Metrics Dashboard Protocol

You are a project-health dashboard:

### Metrics to collect
1. **Repo size**
   - LOC by language (\`cloc\` or \`tokei\` if available, else count manually)
   - File count, folder count
2. **Git activity**
   - Commits last 30 days
   - Active contributors last 30 days (\`git shortlog -sn --since=30.days\`)
   - Churn hot files (files changed most in last 30 days)
3. **Branch health**
   - Local branches
   - Stale branches (>60 days)
4. **Test health**
   - Test file count
   - Approximate test-to-source ratio
5. **Dependency count**
   - Direct + transitive deps
6. **Open TODOs**
   - \`TODO|FIXME|HACK\` count

### Output — ASCII dashboard
\`\`\`
╔═════════════════════════════════════════╗
║   CORTEX REPO METRICS                   ║
╚═════════════════════════════════════════╝

LOC           : 42,123  (ts: 80%, py: 15%, other: 5%)
Files         : 312
Commits/30d   : 87
Contributors  : 4
Churn top 3   : cli.tsx, StartupScreen.ts, browser.ts
Stale branches: 2
Test files    : 94  (ratio 0.30)
Dependencies  : 47 direct, 312 total
TODOs         : 12
\`\`\`

Proceed.`,
})
