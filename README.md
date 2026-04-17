# CORTEX CLI

> **C**ode **O**rchestration + **R**easoning **T**erminal **E**ngine for **X**-scale development
>
> An open-source, agentic AI coding assistant that runs entirely in your terminal. Powered by **HuggingFace's GLM-5** (via Together AI) by default — no Anthropic/OpenAI subscription required.

```
   ██████╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗
  ██╔════╝██╔══██║██╔══██║╚══██╔══╝██╔═════╝╚██╗██╔╝
  ██║     ██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝
  ██║     ██║   ██║██╔══██║   ██║   ██╔══╝   ██╔██╗
  ╚██████╗╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗
   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═══════╝╚═╝  ╚═╝
```

---

## ✨ Features

- **47 custom slash commands** across 8 tiers — from smart commits to distributed tracing
- **153 specialist AI agents** (engineering, marketing, security, design, testing, etc.) auto-loaded from `src/skills/agency/`
- **10 MCP servers** for GitHub, Slack, Linear, Postgres, SQLite, Puppeteer, Fetch, Memory, Filesystem, Sequential Thinking
- **Zero-command UX** — `CORTEX.md` auto-routes plain-English requests to the right capability
- **Runs on HuggingFace** — bring your own free HF token, no vendor lock-in
- **Full IDE pair-programming** — reads, edits, runs commands, spawns sub-agents
- **Browser automation built-in** — Lightpanda + Scrapling + Puppeteer
- **Git-native** — understands your repo, commits, PRs, bisects, merges
- **Privacy-friendly** — all telemetry stubbed out, no data leaves your machine (except LLM calls)
- **Mission 09: Brain-Swarm** — default boot mode with `zai-org/GLM-5:together`

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **Bun** 1.1+ (`brew install bun` on macOS)
- **Python** 3.9+ (for a few helper scripts)
- A **HuggingFace token** with inference permissions → [hf.co/settings/tokens](https://huggingface.co/settings/tokens)

### Install

```bash
git clone https://github.com/gokul77898/Cortex.git
cd Cortex
bun install
bun run build
```

### Configure

Copy `.env.example` to `.env`. Only **one key is required**; the rest are optional:

```bash
# REQUIRED — the AI brain (free @ huggingface.co/settings/tokens)
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
HF_BASE_URL=https://router.huggingface.co/v1
HF_MODEL_ID=zai-org/GLM-5:together

# OPTIONAL — each unlocks one MCP server (skip anything you don't use)
GITHUB_TOKEN=ghp_xxxxx                     # github.com/settings/tokens
SLACK_BOT_TOKEN=xoxb-xxxxx                 # api.slack.com/apps
SLACK_TEAM_ID=Txxxxxxxx
LINEAR_API_KEY=lin_api_xxxxx               # linear.app/settings/api
POSTGRES_CONNECTION_STRING=postgresql://user@localhost:5432/dbname
```

> **6 MCPs work with zero config** (filesystem, puppeteer, fetch, memory, sequential-thinking, sqlite). The other 4 wait for their env tokens.

### Run

```bash
# Interactive mode
./cortex.mjs
# or, if symlinked as AGI:
AGI

# Print-once mode (non-interactive)
./cortex.mjs -p "refactor the auth module to use async/await"
```

---

## 🧠 Zero-Command UX

You don't need to memorize slash commands. The file `CORTEX.md` at the repo root is auto-loaded into every session and teaches the AI to auto-route plain-English requests. Just type what you want:

```
fix all the TODOs in this project
my auth is broken — something about JWT expiry
dockerize this
clean up my git branches
document the python helpers
ship this feature but don't push yet
```

The AI picks the right playbook from `CORTEX.md` and executes it. Slash commands are still available as shortcuts.

---

## 🔌 MCP Servers (10 registered)

CORTEX registers **10 Model Context Protocol servers** in `.mcp.json`. They load on-demand via `npx`.

### Zero-config MCPs (work immediately)
| MCP | Capability |
|---|---|
| `filesystem` | Sandboxed FS access beyond the current directory |
| `puppeteer` | Full browser automation + screenshots |
| `fetch` | Web scraping + URL reading |
| `memory` | Persistent cross-session knowledge graph |
| `sequential-thinking` | Structured step-by-step reasoning |
| `sqlite` | Direct SQLite access (`data/cortex.db`) |

### Token-gated MCPs (set the env var to enable)
| MCP | Env var | Capability |
|---|---|---|
| `github` | `GITHUB_TOKEN` | PRs, issues, releases, workflows |
| `postgres` | `POSTGRES_CONNECTION_STRING` | Direct Postgres access |
| `slack` | `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` | Post/read channels |
| `linear` | `LINEAR_API_KEY` | Issues, projects, teams |

Missing tokens don't break the CLI — those MCPs simply show as "failed" at startup and everything else runs normally.

---

## 👥 153 Specialist Agents

The `src/skills/agency/` folder holds 153 expert agents auto-discovered by the skills loader. Each one is a named persona with its own system prompt. They're invoked implicitly by the CORTEX.md router, or explicitly via:

```
/engineering-backend-architect design a REST API for a blog
/design-ui-designer suggest a color palette for a fintech app
/testing-reality-checker are my tests actually meaningful?
/marketing-content-strategist write 3 blog post ideas
/blockchain-security-auditor top 5 ERC-20 vulnerabilities?
```

**Breakdown:** 29 marketing · 26 engineering · 10 specialized · 9 sales · 8 testing · 8 design · 7 paid-media · 6 support · 6 project · 5 product · 5 academic · 4 workflow · 30+ niche (blockchain, healthcare, compliance, XR, recruitment, etc.)

---

## 📋 Command Reference (47 total)

### Tier 1 — Core (7)
| Command | Description |
|---------|-------------|
| `/smart-commit` `/sc` | Conventional commit with auto-detected type/scope |
| `/pr-review` | Comprehensive AI PR review |
| `/db` | Database schema + query analysis |
| `/test-gen` | Generate tests for a file/function |
| `/security-scan` | Deep security audit |
| `/perf-analyze` | Performance hotspot analysis |
| `/scan-report` | View latest scan reports |

### Tier 2 — Developer Productivity (8)
| Command | Description |
|---------|-------------|
| `/refactor` `/rf` | AI refactoring (rename, extract, convert patterns) |
| `/explain` `/ex` | Explain any code/file/function in plain English |
| `/docs` | Auto-generate JSDoc/docstrings/README sections |
| `/fix` | Paste an error → AI diagnoses + fixes it |
| `/todo` | Scan + prioritize TODO/FIXME/HACK comments |
| `/deps` | Dependency audit (outdated, vulnerable, unused) |
| `/lint-fix` | Auto-fix lint errors across the repo |
| `/type-check` `/tc` | Deep type analysis + AI-suggested fixes |

### Tier 3 — Code Intelligence (7)
| Command | Description |
|---------|-------------|
| `/architecture` `/arch` | Mermaid architecture diagrams |
| `/complexity` `/cx` | Cyclomatic complexity + hot spots |
| `/dead-code` `/dc` | Find unused exports, functions, files |
| `/api-map` | Map every endpoint + its consumers |
| `/schema-diff` | Diff two schemas + generate migration |
| `/coverage-gap` | Find untested files + auto-generate tests |
| `/bundle-analyze` | Bundle size breakdown + optimization tips |

### Tier 4 — Git & Collaboration (6)
| Command | Description |
|---------|-------------|
| `/release-notes-ai` `/changelog` | Auto-generate release notes from commits |
| `/bisect` | AI-guided git bisect |
| `/conflict-resolve` `/cr` | AI merge conflict resolution |
| `/branch-cleanup` `/bclean` | Identify + delete stale branches |
| `/commit-squash` `/squash` | Smart squash plan for a PR |
| `/review-queue` `/rq` | PRs assigned to you, prioritized |

### Tier 5 — Automation / Agentic (6)
| Command | Description |
|---------|-------------|
| `/watch` | Watch files and auto-run checks on change |
| `/auto-fix` | Continuous loop: scan → fix → test → commit |
| `/pipeline` `/ci` | Generate CI/CD YAML (GitHub Actions / GitLab / CircleCI) |
| `/dockerize` | Auto-generate Dockerfile + docker-compose |
| `/deploy` | Deploy helpers (Vercel / Netlify / Railway / Fly) |
| `/scheduler` `/cron` | Cron-like scheduled AI tasks |

### Tier 6 — Knowledge / RAG (5)
| Command | Description |
|---------|-------------|
| `/ask` `/q` | Ask a question, grounded in your codebase |
| `/ai-memory` `/amem` | Persistent project memory (writes `CORTEX.md`) |
| `/onboard` | Generate an onboarding guide for new devs |
| `/search` `/s` | Semantic code search |
| `/stackoverflow` `/so` | Diagnose error messages |

### Tier 7 — Multi-Model / Swarm (4)
| Command | Description |
|---------|-------------|
| `/swarm` | Parallel AI sub-agents for big tasks |
| `/compare` `/cmp` | Same prompt, multiple models, compare answers |
| `/debate` | Two models debate a design decision |
| `/cheap` | Route a simple query to a cheaper model |

### Tier 8 — Observability (4)
| Command | Description |
|---------|-------------|
| `/logs` | AI log analysis (errors, anomalies, patterns) |
| `/metrics` | Repo health dashboard (LOC, churn, deps) |
| `/trace` | Distributed trace analysis (OTel / Jaeger / Zipkin) |
| `/alerts` | Set up AI-driven alert rules |

---

## 🏗 Project Structure

```
cortex/
├── cortex.mjs              # Entry point
├── src/
│   ├── entrypoints/cli.tsx # CLI bootstrap
│   ├── commands/           # 47 custom commands (tier1–tier8)
│   │   ├── _tierHelper.ts  # Shared prompt-command factory
│   │   ├── tier2/          # Developer productivity (8)
│   │   ├── tier3/          # Code intelligence (7)
│   │   ├── tier4/          # Git & collab (6)
│   │   ├── tier5/          # Automation (6)
│   │   ├── tier6/          # Knowledge / RAG (5)
│   │   ├── tier7/          # Multi-model (4)
│   │   └── tier8/          # Observability (4)
│   ├── components/         # Ink / React terminal UI
│   ├── services/           # HF provider, API clients
│   ├── tools/              # Built-in tools (Edit, Read, Bash, ...)
│   └── utils/              # Browser auto-disable, shell exec, etc.
├── python/                 # Python helpers (cortex_db, cortex_security, ...)
├── scripts/                # build, start, stop, helpers
├── dist/cli.mjs            # Bundled CLI (committed? no — built via `bun run build`)
└── .mcp.json               # MCP server registry
```

---

## 🔧 Development

```bash
# Build
bun run build

# Type-check (pre-existing warnings are fine)
bun tsc --noEmit

# Run in dev mode
./cortex.mjs

# Run a non-interactive prompt
./cortex.mjs -p "explain the auth flow"
```

### Adding a new slash command

All Tier 2–8 commands share a factory in `@/src/commands/_tierHelper.ts`:

```ts
import { makeTierCommand, CODE_EDIT_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'my-command',
  aliases: ['mc'],
  description: 'Does X',
  progressMessage: 'doing X',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## Protocol\n...your prompt here...`,
})
```

Then register it in `@/src/commands.ts` (import + add to the `COMMANDS()` array).

---

## 🛡 Privacy & Security

- **No telemetry** — 21 telemetry modules are stubbed at build time
- **No browser auto-opens** — we removed auto-launches to `localhost`, OAuth prompts, etc.
- **Secrets stay local** — `.env` is gitignored; never committed
- **No vendor lock-in** — swap `HF_MODEL_ID` to any model on the HuggingFace Router

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Use `/smart-commit` to generate a conventional commit
4. Push and open a PR on GitHub

---

## 📜 License

MIT — do whatever you want, just don't sue me.

---

## 🙏 Credits

Built on the shoulders of the open-source Claude Code CLI fork with extensive modifications:

- 40+ custom AI commands
- Full HuggingFace provider integration (GLM-5, Llama, DeepSeek, etc.)
- Mission 09: Brain-Swarm boot theme
- All telemetry and vendor auth stripped out

Powered by **HuggingFace Router** + **Together AI** + **zai-org/GLM-5**.
