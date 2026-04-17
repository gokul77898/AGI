import { GIT_READ_TOOLS, makeTierCommand, READ_ONLY_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'release-notes-ai',
  aliases: ['rnai', 'changelog'],
  description: 'Auto-generate polished release notes / changelog from commits',
  progressMessage: 'generating release notes',
  allowedTools: [...GIT_READ_TOOLS, ...READ_ONLY_TOOLS, 'Write'],
  buildPrompt: (args) => `## Release Notes Protocol

**Range:** ${args || 'since last tag (or last 50 commits)'}

You are a release manager. Generate user-friendly release notes:

1. **Determine range** — \`git describe --tags --abbrev=0\` for last tag; else \`HEAD~50\`.
2. **List commits** — \`git log <range> --pretty=format:"%h %s"\`.
3. **Categorize** by conventional-commit type or inferred nature:
   - 🚀 **Features** (feat)
   - 🐛 **Bug fixes** (fix)
   - ⚡ **Performance** (perf)
   - 📚 **Docs** (docs)
   - 🔧 **Chore / Internal** (chore, build, ci, refactor)
   - 💥 **Breaking changes** (BREAKING CHANGE footer)
4. **Rewrite each line** for a user audience — drop internal jargon, focus on user-visible impact.
5. **Highlight** the 2-3 most important changes at top.

### Output (Markdown)
\`\`\`
# Release v<X.Y.Z> — <date>

**Highlights**
- ...

## 🚀 Features
- ...

## 🐛 Fixes
- ...

## 💥 Breaking
- ...

## Contributors
<list from git shortlog>
\`\`\`

Save to \`CHANGELOG.md\` (prepended, not replacing existing).`,
})
