import { CODE_EDIT_TOOLS, makeTierCommand, PKG_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'lint-fix',
  aliases: ['lintfix'],
  description: 'Auto-fix lint errors across the repo using the project linter',
  progressMessage: 'fixing lint errors',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, ...PKG_TOOLS, 'Bash(eslint:*)', 'Bash(prettier:*)', 'Bash(ruff:*)', 'Bash(black:*)'],
  buildPrompt: () => `## Lint Fix Protocol

You are a code-quality engineer. Auto-fix lint issues:

1. **Detect linter** from package.json / pyproject.toml / config files:
   - ESLint, Biome, Prettier, TSLint (JS/TS)
   - Ruff, Black, flake8, pylint (Python)
   - rustfmt, clippy (Rust)
   - gofmt, golangci-lint (Go)

2. **Run linter in check mode** first to catalogue errors.

3. **Run linter in fix mode** (e.g. \`--fix\`, \`--write\`) to auto-resolve.

4. **For remaining errors** the linter can't auto-fix:
   - Read each file + error.
   - Apply manual Edit/MultiEdit to resolve.
   - Skip anything requiring human judgment (flag for user).

5. **Re-run linter** to confirm clean.

### Output
- Summary: fixed count vs. remaining
- List of errors requiring human review

Proceed.`,
})
