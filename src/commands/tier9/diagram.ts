import { makeTierCommand, PKG_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'diagram',
  aliases: ['dia'],
  description:
    'Generate a diagram (Mermaid + Excalidraw + Draw.io) from a description. Usage: /diagram <description>',
  progressMessage: 'generating diagram',
  allowedTools: [
    ...PKG_TOOLS,
    'Bash(python3:*)',
    'Bash(pip:*)',
    'Bash(open:*)',
    'Read',
  ],
  buildPrompt: (args) => {
    const trimmed = (args ?? '').trim()
    if (!trimmed || trimmed === 'help') {
      return `## /diagram — text → Mermaid + Excalidraw + Draw.io

Usage:
  \`/diagram <description>\`   e.g. /diagram user-signup flow with OAuth + 2FA
  \`/diagram "AWS 3-tier arch" --format mermaid\`

Writes three files to \`data/diagrams/\`:
  • \`.mmd\`        — Mermaid source
  • \`.excalidraw\` — drop on https://excalidraw.com to edit
  • \`.drawio\`     — drop on https://app.diagrams.net to edit`
    }
    return `## CORTEX Diagram Generator

User invocation: \`/diagram ${trimmed}\`

Shell out to: \`python3 python/cortex_diagram.py ${JSON.stringify(trimmed)}\`

Show the user:
1. The Mermaid source (as a \`\`\`mermaid block — most chat UIs render it live)
2. The three output file paths
3. A one-liner suggesting they can drop the .excalidraw onto excalidraw.com

If the generated Mermaid has syntax errors, offer to re-run once with a tighter prompt.`
  },
})
