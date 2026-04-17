import { CODE_EDIT_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'pipeline',
  aliases: ['ci'],
  description: 'Generate CI/CD YAML (GitHub Actions, GitLab CI, CircleCI)',
  progressMessage: 'generating pipeline',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## CI/CD Pipeline Protocol

**Platform:** ${args || '(ask user: github | gitlab | circleci | azure)'}

You are a DevOps engineer. Generate a production-grade CI pipeline:

### 1. Detect project
- Language (from package.json/pyproject/Cargo.toml/go.mod)
- Test runner, linter, type-checker
- Build tool
- Target platforms (Node versions, Python versions)

### 2. Generate pipeline YAML with stages:
- **Install** — cache dependencies
- **Lint** — linter + formatter check
- **Typecheck** — if typed language
- **Test** — unit + coverage upload
- **Build** — production build artifact
- **Security** — dependency audit (\`npm audit\`, \`pip-audit\`)
- **Deploy** (optional) — conditional on main/tag

### 3. Platform-specific files:
- GitHub: \`.github/workflows/ci.yml\`
- GitLab: \`.gitlab-ci.yml\`
- CircleCI: \`.circleci/config.yml\`
- Azure: \`azure-pipelines.yml\`

### Rules
- Use matrix strategy for multi-version testing.
- Cache node_modules / pip cache / cargo target.
- Pin action versions (no \`@main\`).
- Use OIDC / secrets best practices (no hardcoded tokens).
- Fail fast on any stage.

Write the file + print a summary of what runs on push/PR.`,
})
