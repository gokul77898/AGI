import { makeTierCommand, PKG_TOOLS, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'deps',
  description: 'Dependency audit — find outdated, vulnerable, and unused packages',
  progressMessage: 'auditing dependencies',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, ...PKG_TOOLS],
  buildPrompt: () => `## Dependency Audit Protocol

You are a supply-chain auditor. Run a full dependency audit:

### 1. Detect package manager
- Read package.json / pyproject.toml / requirements.txt / Cargo.toml / go.mod.

### 2. Run ecosystem-appropriate audits
- **npm/yarn/pnpm/bun**:
  - \`npm outdated --json\` (or equivalent)
  - \`npm audit --json\` (vulnerabilities)
- **Python**:
  - \`pip list --outdated --format=json\`
  - \`pip-audit\` if available
- Capture output.

### 3. Find unused dependencies
- Grep source for each dep name in imports.
- Flag deps declared but never imported.

### 4. Report (Markdown)
\`\`\`
# Dependency Audit

## 🔴 Vulnerabilities (<N>)
| Package | Severity | CVE | Fix |
|---------|----------|-----|-----|

## 🟡 Outdated (<N>)
| Package | Current | Latest | Breaking? |

## 🗑 Unused (<N>)
- package-name — not imported anywhere

## Recommended actions
1. <top fix>
2. ...
\`\`\`

### Rules
- NEVER run \`npm install\` / \`pip install\` automatically — only report.
- Propose specific upgrade commands the user can run.

Proceed.`,
})
