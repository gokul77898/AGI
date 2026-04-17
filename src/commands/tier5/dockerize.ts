import { CODE_EDIT_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'dockerize',
  description: 'Auto-generate Dockerfile + docker-compose.yml for the project',
  progressMessage: 'dockerizing project',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: () => `## Dockerize Protocol

You are a container engineer. Generate Docker config:

### 1. Analyze project
- Language + runtime (Node/Python/Go/Rust/etc.)
- Package manager + lockfile
- Build vs runtime artifacts
- External services (DB, Redis, queue) — check .env, docker-compose hints

### 2. Generate Dockerfile (multi-stage):
- **builder stage** — install deps, compile/bundle
- **runtime stage** — minimal base (alpine/distroless), non-root user, copy artifacts only
- Use .dockerignore to exclude node_modules, .git, secrets
- EXPOSE the right port
- HEALTHCHECK if applicable
- Use specific image tags (never \`:latest\`)

### 3. Generate docker-compose.yml if multi-service:
- App service + detected deps (postgres/redis/etc.)
- Volume mounts for dev
- Env file loading
- Service dependencies + healthchecks

### 4. Generate .dockerignore

### Files to write
- \`Dockerfile\`
- \`.dockerignore\`
- \`docker-compose.yml\` (if needed)
- Brief \`DOCKER.md\` with build + run commands

### Rules
- Non-root user for runtime (security).
- Minimize layers + final image size.
- NEVER bake secrets into images.

Proceed.`,
})
