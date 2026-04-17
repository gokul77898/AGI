import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'debate',
  description: 'Two AI models debate a design decision; you get both sides + a synthesis',
  progressMessage: 'running debate',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Bash(curl:*)'],
  buildPrompt: (args) => `## Debate Protocol

**Design question:** ${args || '(ask user for the decision to debate)'}

You are moderating a structured debate between two LLM agents:

### Setup
- **Agent A (Pro)** — argue FOR position A.
- **Agent B (Con)** — argue FOR position B.
- Both given the same context, rules, and repo knowledge.

### Rounds (3)
For each round, prompt each agent separately via HuggingFace router:
1. **Opening statement** — each argues their position (1-2 paragraphs).
2. **Rebuttal** — each responds to the other's opening.
3. **Closing** — each gives final argument.

### Synthesis (you, the moderator)
After 3 rounds produce:
\`\`\`
# Debate: <topic>

## Position A
<summary + strongest argument>

## Position B
<summary + strongest argument>

## Analysis
- Where they agree: ...
- Where they disagree: ...
- Strongest argument overall: ...

## Recommendation
<your moderator verdict with reasoning>
\`\`\`

### Rules
- Use HF_TOKEN + HF_BASE_URL for model calls.
- Keep each agent response under 300 words.
- Stay neutral until the final recommendation.

Proceed.`,
})
