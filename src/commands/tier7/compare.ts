import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'compare',
  aliases: ['cmp'],
  description: 'Run the same question through multiple HuggingFace models, compare answers',
  progressMessage: 'comparing models',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Bash(curl:*)', 'Bash(python:*)', 'Bash(python3:*)'],
  buildPrompt: (args) => `## Model Comparison Protocol

**Question / prompt:** ${args || '(ask user what to compare)'}

You are an LLM evaluator. Compare outputs across models:

### 1. Pick 3 models to compare
Default: pull from HF_MODEL_ID env + 2 alternates available on the Hugging Face router.
Example set:
- zai-org/GLM-5:together  (current)
- meta-llama/Llama-3.3-70B-Instruct:together
- deepseek-ai/DeepSeek-V3:together

### 2. Run the same prompt through each
Use \`curl\` against \`$HF_BASE_URL/chat/completions\` with \`$HF_TOKEN\`:
\`\`\`sh
curl -s "$HF_BASE_URL/chat/completions" \\
  -H "Authorization: Bearer $HF_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"<MODEL>","messages":[{"role":"user","content":"<PROMPT>"}]}'
\`\`\`

### 3. Produce a comparison table
\`\`\`
# Comparison: "<prompt>"

| Model | Length | Style | Key points |

## Model A: zai-org/GLM-5
<answer>

## Model B: ...
<answer>

## Analysis
- Agreement: <what all models agreed on>
- Disagreement: <where they differed + which seems correct>
- Recommendation: <which answer to trust + why>
\`\`\`

Proceed.`,
})
