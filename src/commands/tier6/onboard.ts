import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'onboard',
  description: 'Generate an onboarding guide for new developers',
  progressMessage: 'generating onboarding guide',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS],
  buildPrompt: () => `## Onboarding Guide Protocol

You are writing a day-one guide for a new developer joining this project:

### Audience
A competent engineer who is new to THIS codebase but proficient in the stack.

### Content — write to \`ONBOARDING.md\`
1. **Welcome** — 1-paragraph project purpose.
2. **Prerequisites** — required tools + versions (Node, Python, Docker, etc.).
3. **Setup** — exact commands to go from clean clone → running locally.
4. **Architecture at a glance** — 1-page high-level diagram/description.
5. **Where to find things** — quick lookup table of concerns → folders.
6. **How to run tests** — commands + what to expect.
7. **How to contribute** — branch naming, commit style, PR process.
8. **Common tasks** — "add a new endpoint", "add a new page", etc. with step-by-step.
9. **Debugging tips** — logs location, debug flags, common errors.
10. **Who to ask** — owners of major areas (if detectable from git shortlog).

### Rules
- EVERY command must be copy-pasteable and tested mentally for correctness.
- Use real file paths + real examples from the codebase.
- Keep to <500 lines.

Proceed.`,
})
