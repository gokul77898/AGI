import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'swarm',
  description: 'Spawn parallel AI sub-tasks for a big job (decompose → dispatch → merge)',
  progressMessage: 'orchestrating swarm',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, 'Task'],
  buildPrompt: (args) => `## Swarm Protocol

**Mission:** ${args || '(ask user what big task to decompose)'}

You are a swarm orchestrator. Break a large task into parallel sub-tasks:

### 1. Decompose
- Analyze the mission.
- Break into 3-8 INDEPENDENT sub-tasks (they must not block each other).
- For each sub-task define:
  - Clear, scoped goal
  - Required inputs
  - Expected output artifact

### 2. Dispatch
- Use the \`Task\` tool to spawn a sub-agent per sub-task, in PARALLEL.
- Pass each sub-agent a focused prompt + the tools it needs.

### 3. Monitor + collect
- Wait for all sub-agents to complete.
- Gather their outputs.

### 4. Synthesize
- Merge outputs into a unified result.
- Resolve any conflicts between sub-agents' work.
- Produce a single coherent deliverable.

### Output
- List of sub-tasks + their results
- Final synthesized output
- Any follow-up work

### Rules
- Sub-tasks MUST be truly independent — if they share state, run sequential.
- Limit to 8 parallel sub-agents max.
- If any sub-agent fails, report it clearly — don't hide errors.

Proceed.`,
})
