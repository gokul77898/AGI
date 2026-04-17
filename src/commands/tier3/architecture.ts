import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'architecture',
  aliases: ['arch'],
  description: 'Generate architecture diagrams (Mermaid) from codebase',
  progressMessage: 'mapping architecture',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Write'],
  buildPrompt: (args) => `## Architecture Diagram Protocol

**Scope:** ${args || 'entire repo'}

You are a software architect. Produce a Mermaid architecture diagram:

1. **Survey** — list top-level folders, entry points, config files.
2. **Map modules** — identify layers (entrypoints, services, tools, utils, UI).
3. **Map data flow** — how requests/events travel through the system.
4. **Detect integrations** — external APIs, DBs, queues, filesystems.

### Output (save to ARCHITECTURE.md)
- **Overview** — 2-paragraph narrative of the system.
- **Component diagram** — Mermaid \`graph TD\` showing modules + deps.
- **Data flow diagram** — Mermaid \`sequenceDiagram\` for the primary use case.
- **Tech stack table** — language, framework, DB, build tool.
- **Key files** — where to look for each concern.

### Rules
- Use real file/folder names, not placeholders.
- Group related modules into subgraphs.
- Keep diagrams readable — max ~25 nodes per diagram.

Write the final document to \`ARCHITECTURE.md\` in the repo root.`,
})
