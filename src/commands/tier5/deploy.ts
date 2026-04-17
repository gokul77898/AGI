import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'deploy',
  description: 'Deploy helpers (Vercel, Netlify, Railway, Fly.io, Render)',
  progressMessage: 'preparing deploy',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, 'Bash(vercel:*)', 'Bash(netlify:*)', 'Bash(flyctl:*)', 'Bash(railway:*)'],
  buildPrompt: (args) => `## Deploy Protocol

**Target:** ${args || '(ask user: vercel | netlify | railway | fly | render)'}

You are a deploy engineer. Prep a zero-downtime deployment:

### 1. Detect project type
- Static (Vite/Next export) → Vercel / Netlify / Cloudflare Pages
- SSR / API → Vercel / Railway / Fly / Render
- Container → Fly / Railway / Render

### 2. Generate/update config
- Vercel → \`vercel.json\`
- Netlify → \`netlify.toml\`
- Fly → \`fly.toml\` (needs Dockerfile)
- Railway → \`railway.toml\` / nixpacks config
- Render → \`render.yaml\`

### 3. Document env vars needed
- Grep for \`process.env.*\` / \`os.getenv(*)\` usage.
- List every required env var in a \`DEPLOY.md\`.

### 4. Pre-flight check
- Build succeeds locally
- Tests pass
- No \`.env\` committed
- Health check endpoint exists (if API)

### 5. Provide deploy command
- NEVER run \`vercel deploy --prod\` / similar without explicit user confirmation.
- Print the exact command user should run.

### Rules
- No production pushes without user approval.
- Always set up a preview/staging path first.

Proceed.`,
})
