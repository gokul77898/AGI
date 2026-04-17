import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'api-map',
  aliases: ['apimap'],
  description: 'Map all API endpoints and their consumers across the codebase',
  progressMessage: 'mapping API endpoints',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Write'],
  buildPrompt: () => `## API Map Protocol

You are an API cartographer. Produce a complete endpoint map:

### 1. Find endpoint definitions
Grep for common patterns:
- Express/Fastify/Koa: \`app.(get|post|put|delete|patch)\`, \`router.*\`
- Python: \`@app.route\`, \`@router.(get|post|...)\`, \`path(...)\`
- Next.js: files under \`app/**/route.ts\`, \`pages/api/**\`
- OpenAPI/Swagger specs (.yaml/.json)
- tRPC procedures, GraphQL schemas

### 2. For each endpoint capture
- HTTP method + path
- Handler function/file:line
- Auth requirements (middleware)
- Request/response shape (if typed)

### 3. Find consumers
- Grep for fetch/axios/httpx calls matching each path.
- List call-site files.

### Output (save to API_MAP.md)
\`\`\`
# API Map — <N> endpoints

## By Module
### /auth
| Method | Path | Handler | Auth | Consumers |

## Orphaned endpoints (no consumers found)
...

## Orphaned calls (consumers calling undefined endpoints)
...
\`\`\`

Write to \`API_MAP.md\`.`,
})
