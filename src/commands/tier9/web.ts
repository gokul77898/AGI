import { makeTierCommand, PKG_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'web',
  aliases: ['dashboard', 'ui'],
  description:
    'Launch the localhost dashboard (live sessions, RAG, MCP, commands, agents) at http://localhost:3737',
  progressMessage: 'launching web UI',
  allowedTools: [
    ...PKG_TOOLS,
    'Bash(node:*)',
    'Bash(bun:*)',
    'Bash(npm:*)',
    'Bash(open:*)',
    'Bash(./bin/AGI-web:*)',
    'Read',
  ],
  buildPrompt: (_args) => {
    return `## /web — CORTEX Dashboard

Shell out to: \`./bin/AGI-web\`

The launcher:
1. Installs express + ws once (if needed)
2. Starts \`apps/web-ui/server.mjs\` on http://localhost:3737
3. Auto-opens the dashboard in the default browser

After launch, tell the user:
- Dashboard URL: http://localhost:3737
- Stop with Ctrl-C in the terminal that launched it
- The dashboard shows: live AGI sessions, MCP server status, command registry, agent directory, RAG index, command-history replay`
  },
})
