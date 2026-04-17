import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'search',
  aliases: ['s'],
  description: 'Semantic search across your whole repo — find code by meaning, not just text',
  progressMessage: 'searching repo',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Semantic Search Protocol

**Query:** ${args || '(ask user for search query)'}

You are a semantic code search engine:

1. **Interpret** the query:
   - Extract keywords + synonyms.
   - Infer intent (find a function? a config? an error handler?).
2. **Multi-strategy search**:
   - Exact term → Grep with original keywords.
   - Synonyms → Grep with related terms (e.g. "auth" → also "login", "credential", "session").
   - File types → Glob for likely locations.
   - Read promising files to verify relevance.
3. **Rank results** by semantic match, not just string match.
4. **Output** — up to 10 most relevant matches:
   \`\`\`
   # Matches for "<query>"

   ## 1. <short description>  ★★★★★
   \`path/file.ts:L\`
   > snippet (3-5 lines showing the match)
   Why relevant: <1 sentence>

   ## 2. ...
   \`\`\`

### Rules
- NEVER return results you haven't verified by reading.
- If nothing matches, explicitly say so + suggest broader queries.
- Group near-duplicates.

Proceed.`,
})
