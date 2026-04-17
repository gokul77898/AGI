import { CODE_EDIT_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'cheap',
  description: 'Route this query to a smaller/cheaper HuggingFace model (for simple tasks)',
  progressMessage: 'routing to cheap model',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## Cheap Routing Protocol

**Task:** ${args || '(ask user what simple task to route)'}

You are a cost-routing agent. For simple tasks, use cheaper models:

### 1. Classify the task
- **Trivial** (rename a variable, format JSON, 1-line answer) → cheapest model
- **Simple** (short function, single-file edit) → mid-tier
- **Complex** (architecture, multi-file refactor) → full model (warn user to use default instead)

### 2. If simple/trivial, temporarily override the model
- Set environment for this task only:
  - \`HF_MODEL_ID=qwen/Qwen2.5-7B-Instruct:together\` (or similar small instruct)
- Execute the task with that model.

### 3. Report
- Task completed: yes/no
- Model used
- Approximate cost savings vs. default

### Rules
- If task seems complex, REFUSE and tell user: "this is too complex for a cheap model — use default".
- Never silently drop quality — if the cheap model can't do it, say so.

Proceed.`,
})
