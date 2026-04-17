import { CODE_EDIT_TOOLS, GIT_READ_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'schema-diff',
  aliases: ['sdiff'],
  description: 'Diff two DB schemas and generate a migration',
  progressMessage: 'diffing schemas',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, ...GIT_READ_TOOLS],
  buildPrompt: (args) => `## Schema Diff Protocol

**Targets:** ${args || '(ask user: two schema files, or git refs like HEAD~1..HEAD)'}

You are a database migration expert. Produce a migration:

### 1. Obtain both schemas
- File paths → Read both.
- Git refs → \`git show ref:path/to/schema\` for each.
- Live DB → ask user to export.

### 2. Detect schema format
- Prisma, Drizzle, SQLAlchemy, TypeORM, raw SQL DDL, Sequelize.

### 3. Compute diff
For each table:
- Added / dropped / renamed
- Columns: added / dropped / type-changed / nullability / default
- Indexes: added / dropped
- Constraints: FK / unique / check

### 4. Generate migration
- SQL DDL (safe — no destructive ops without warnings)
- ORM-specific migration file if applicable
- Include rollback ("down") as well as forward ("up")

### Rules
- FLAG destructive operations (DROP, ALTER TYPE, NOT NULL on populated cols).
- Prefer additive, reversible changes.
- Include data-migration stubs where type changes need it.

### Output
- Write migration file to appropriate folder.
- Print summary of changes + warnings.

Proceed.`,
})
