```
   ██████╗  ██████╗  ██████╗  ████████╗ ███████╗ ██╗  ██╗
  ██╔════╝ ██╔═══██╗ ██╔══██╗ ╚══██╔══╝ ██╔════╝ ╚██╗██╔╝
  ██║      ██║   ██║ ██████╔╝    ██║    █████╗    ╚███╔╝
  ██║      ██║   ██║ ██╔══██╗    ██║    ██╔══╝    ██╔██╗
  ╚██████╗ ╚██████╔╝ ██║  ██║    ██║    ███████╗ ██╔╝ ██╗
   ╚═════╝  ╚═════╝  ╚═╝  ╚═╝    ╚═╝    ╚══════╝ ╚═╝  ╚═╝

        C O D E   O R C H E S T R A T I O N   +
        R E A S O N I N G   T E R M I N A L   E N G I N E
```

<p align="center">
  <strong>An open-source, agentic AI coding assistant for your terminal, desktop, and editor.</strong><br/>
  Runs entirely on free HuggingFace models. No Anthropic / OpenAI subscription required.
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick%20Start-5%20min-brightgreen" /></a>
  <a href="#-architecture"><img src="https://img.shields.io/badge/Architecture-Full%20Diagram-blue" /></a>
  <a href="#-command-reference-50-total"><img src="https://img.shields.io/badge/Commands-50+-purple" /></a>
  <a href="#-153-specialist-agents"><img src="https://img.shields.io/badge/Agents-153-orange" /></a>
  <a href="#-mcp-servers-53-registered"><img src="https://img.shields.io/badge/MCP%20Servers-53-cyan" /></a>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Install-1%20command-green" /></a>
  <a href="#-docker"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@gitlawb/cortex"><img src="https://img.shields.io/badge/npm-%40gitlawb%2Fcortex-red?logo=npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow" /></a>
</p>

---

## 📑 Table of Contents

- [Why CORTEX](#-why-cortex)
- [Feature Matrix](#-feature-matrix)
- [Architecture](#-architecture)
- [Data Flow](#-data-flow)
- [Quick Start](#-quick-start)
- [Four Ways to Run It](#-four-ways-to-run-it)
- [Zero-Command UX](#-zero-command-ux)
- [Command Reference (50+ total)](#-command-reference-50-total)
- [153 Specialist Agents](#-153-specialist-agents)
- [MCP Servers (53 registered)](#-mcp-servers-53-registered)
- [Model Fallback + Offline Mode](#-model-fallback--offline-mode)
- [Floating Desktop UI (Tier A)](#-tier-a--floating-desktop-ui-with-screen-watcher)
- [Web Dashboard](#-tier-a--web-dashboard)
- [VS Code Extension](#-tier-a--vs-code--cursor-extension)
- [Media & Diagrams](#-tier-a--media--diagrams)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Development](#-development)
- [Privacy & Security](#-privacy--security)
- [Benchmarks](#-benchmarks)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Why CORTEX

A fully-agentic AI coding assistant with **everything built-in** — 50+ slash commands, 153 specialist agents, 53 MCP servers, browser automation, voice I/O, screen vision, local LLM fallback, and a floating desktop UI. Zero vendor lock-in. One HuggingFace token is the only requirement.

| Problem | CORTEX's Solution |
|---|---|
| Claude Code / Cursor subscriptions are expensive | **Free** via HuggingFace GLM-5 |
| Every AI tool does one thing | **50+ slash commands** across 9 tiers |
| No personas / no specialists | **153 auto-loaded expert agents** |
| No ecosystem hooks | **53 MCP servers** (GitHub, Slack, Linear, Context7, Serena, Playwright, Git, ...) |
| Terminal-only or web-only | **CLI + Electron + Web + VS Code** — all four |
| No offline mode | **Ollama fallback** wired in |
| Can't see what you're doing | **Screen-watcher** with vision model |
| Telemetry concerns | **Zero telemetry** — 21 modules stubbed at build time |
| One model, one provider | **Auto-failover** between providers (`:together` → `:novita`) |

---

## ✨ Feature Matrix

| | Feature | Detail |
|---|---|---|
| 🧠 | **AI brain** | HuggingFace Router → GLM-5 (default) · swap any HF-hosted model |
| 🔄 | **Auto-failover** | Primary `zai-org/GLM-5:together` → fallback `:novita` on 5xx errors |
| 🦙 | **Offline mode** | Ollama detected automatically at `localhost:11434` — zero config |
| ⚡ | **50+ slash commands** | Smart commits, PR reviews, RAG, agents, voice, media, diagrams |
| 👥 | **153 specialist agents** | Engineering · Marketing · Security · Design · Testing · Compliance · XR |
| 🔌 | **53 MCP servers** | GitHub, Slack, Linear, Context7, Serena, Playwright, Jupyter, Git, Desktop-Commander, Exa, Tavily, DuckDuckGo, Time, Everything, Postgres, SQLite, Puppeteer, Fetch, Memory, Filesystem, Seq-Thinking |
| 🎤 | **Voice I/O** | Whisper (STT) + Bark (TTS) + Web Speech API |
| 👁 | **Screen vision** | Electron `desktopCapturer` → vision LLM every 10s |
| 🖼 | **Media generation** | Images (FLUX.1), video (HunyuanVideo), diagrams (Mermaid/Excalidraw/Draw.io) |
| 📚 | **RAG** | pgvector + HuggingFace embeddings over your codebase |
| 🤖 | **Autonomous daemon** | Background agent scans repo, writes daily briefs, drafts PRs |
| 🧪 | **Test generation** | Auto-generate tests for any file/function |
| 🛡 | **Security scan** | Deep audit for secrets, vulnerabilities, unsafe patterns |
| 🌐 | **Browser automation** | Lightpanda + Scrapling + Puppeteer |
| 🎨 | **4 user interfaces** | CLI · Electron floating UI · Web dashboard · VS Code extension |
| 🔐 | **Privacy-friendly** | No telemetry · gitignored secrets · local-first where possible |
| � | **Tentacles** | Multi-agent orchestration — scoped context folders, todo.md, inter-agent messaging, child-agent spawning ([docs](docs/TENTACLES.md)) |
| �🚀 | **Mac `.app` bundle** | Installable via Spotlight — no terminal needed |

---

## 🏗 Architecture

Full system diagram — every component, every connection:

```mermaid
graph TB
    subgraph USER["👤 USER INTERFACES"]
        direction LR
        CLI["🖥 CLI<br/>./cortex.mjs"]
        ELECTRON["🪟 Electron App<br/>./bin/AGI-ui<br/><i>Floating · Always-on-top</i>"]
        WEB["🌐 Web Dashboard<br/>localhost:3737"]
        VSCODE["💻 VS Code Extension<br/>Right-click menu"]
    end

    subgraph CORE["⚙️ CORTEX CORE (TypeScript + Bun)"]
        direction TB
        ROUTER["📋 CORTEX.md Router<br/><i>Zero-command UX · routes plain English → capability</i>"]
        REPL["🔁 REPL / Orchestrator<br/><i>src/entrypoints/cli.tsx</i>"]

        subgraph COMMANDS["50+ Slash Commands (9 Tiers)"]
            T1["Tier 1 · Core (7)"]
            T2["Tier 2 · Productivity (8)"]
            T3["Tier 3 · Code Intelligence (7)"]
            T4["Tier 4 · Git (6)"]
            T5["Tier 5 · Automation (6)"]
            T6["Tier 6 · RAG (5)"]
            T7["Tier 7 · Multi-Model (4)"]
            T8["Tier 8 · Observability (4)"]
            T9["Tier 9 · Next-Gen (3+)"]
        end

        subgraph AGENTS["👥 153 Specialist Agents"]
            A1["Engineering (26)"]
            A2["Marketing (29)"]
            A3["Design (8)"]
            A4["Testing (8)"]
            A5["Security / Compliance"]
            A6["60+ Niche"]
        end

        TOOLS["🔧 Built-in Tools<br/>Read · Write · Edit · Bash<br/>WebFetch · Glob · Grep · Notebook"]
    end

    subgraph AI["🧠 AI / MODEL LAYER"]
        direction TB
        SMART_ROUTER["🔀 Smart Router<br/>python/smart_router.py<br/><i>Latency + cost + health scoring</i>"]

        subgraph PROVIDERS["LLM Providers"]
            HF_TOGETHER["HF Router · GLM-5 (Together)<br/><i>PRIMARY</i>"]
            HF_NOVITA["HF Router · GLM-5 (Novita)<br/><i>FALLBACK on 5xx</i>"]
            OLLAMA["Ollama (local)<br/><i>OFFLINE fallback · llama3.2/moondream</i>"]
            HF_OTHER["Other HF Models<br/><i>Llama · DeepSeek · Qwen</i>"]
        end

        VISION["👁 Vision Model<br/>Screen → description<br/><i>Moondream / LLaVA via Ollama</i>"]
        VOICE["🎤 Voice Stack<br/>Whisper (STT) + Bark (TTS)"]
        EMBEDDINGS["📚 Embeddings<br/>HF sentence-transformers"]
    end

    subgraph MCP["🔌 MCP SERVERS (53)"]
        direction LR
        MCP_GH["GitHub"]
        MCP_SLACK["Slack"]
        MCP_LINEAR["Linear"]
        MCP_PG["Postgres"]
        MCP_SQL["SQLite"]
        MCP_PUP["Puppeteer"]
        MCP_FETCH["Fetch"]
        MCP_MEM["Memory"]
        MCP_FS["Filesystem"]
        MCP_SEQ["Seq-Thinking"]
        MCP_CTX7["Context7"]
        MCP_SERENA["Serena"]
        MCP_PLAY["Playwright"]
        MCP_JUPY["Jupyter"]
        MCP_AUTOMAC["Automation-Mac"]
        MCP_GIT["Git"]
        MCP_DESK["Desktop-Commander"]
        MCP_EXA["Exa"]
        MCP_TAVILY["Tavily"]
        MCP_DUCK["DuckDuckGo"]
        MCP_TIME["Time"]
    end

    subgraph DATA["💾 DATA / STATE"]
        direction LR
        PGVECTOR["pgvector<br/><i>RAG index</i>"]
        SQLITE["data/cortex.db<br/><i>History · memory</i>"]
        DIAGRAMS["data/diagrams/<br/><i>Mermaid · Excalidraw · Draw.io</i>"]
        LOGS["logs/<br/><i>Structured JSON</i>"]
        ENV[".env<br/><i>Secrets (gitignored)</i>"]
    end

    subgraph AUTOMATION["🤖 AUTOMATION"]
        DAEMON["Autonomous Daemon<br/><i>/autonomous start</i>"]
        SCHEDULER["Scheduler<br/><i>Cron-like AI tasks</i>"]
        WATCHER["File Watcher<br/><i>/watch</i>"]
    end

    subgraph BROWSER["🌐 BROWSER AUTOMATION"]
        LIGHT["Lightpanda"]
        SCRAPE["Scrapling"]
        PUPP["Puppeteer"]
    end

    USER --> CORE
    ROUTER --> COMMANDS
    ROUTER --> AGENTS
    REPL --> ROUTER
    COMMANDS --> TOOLS
    AGENTS --> TOOLS
    TOOLS --> MCP
    TOOLS --> BROWSER

    CORE --> AI
    SMART_ROUTER --> PROVIDERS
    ELECTRON --> VISION
    ELECTRON --> VOICE
    T6 --> EMBEDDINGS
    EMBEDDINGS --> PGVECTOR

    TOOLS --> DATA
    DAEMON --> CORE
    SCHEDULER --> CORE
    WATCHER --> CORE

    style USER fill:#1e3a5f,stroke:#4aa3df,color:#fff
    style CORE fill:#2d1b4e,stroke:#8b5cf6,color:#fff
    style AI fill:#1f3a2e,stroke:#10b981,color:#fff
    style MCP fill:#4e2d1b,stroke:#f59e0b,color:#fff
    style DATA fill:#3a1f2e,stroke:#ec4899,color:#fff
    style AUTOMATION fill:#1b3a4e,stroke:#06b6d4,color:#fff
    style BROWSER fill:#3a3a1b,stroke:#eab308,color:#fff
```

### Component Responsibilities

| Layer | Component | Responsibility |
|---|---|---|
| **UI** | CLI / Electron / Web / VS Code | User input surfaces (terminal, desktop, browser, IDE) |
| **Core** | CORTEX.md Router | Parses plain-English → slash command / agent / tool |
| **Core** | REPL | Orchestrates the agentic loop (observe → think → act) |
| **Core** | Slash Commands | 50+ opinionated workflows across 9 tiers |
| **Core** | Agents | 153 specialist personas with tailored system prompts |
| **Core** | Tools | Read/Write/Edit/Bash + MCP tool proxies |
| **AI** | Smart Router | Provider selection by latency/cost/health |
| **AI** | Vision / Voice / Embeddings | Multimodal + semantic-search pipelines |
| **MCP** | 53 Servers | GitHub · Slack · Linear · Context7 · Serena · Playwright · Jupyter · Git · Desktop-Commander · Exa · Tavily · DuckDuckGo · Time · Everything · Postgres · SQLite · Puppeteer · Fetch · Memory · FS · Seq-Thinking |
| **Data** | pgvector · SQLite · Filesystem | RAG index, history, generated artefacts |
| **Automation** | Daemon · Scheduler · Watcher | Background agentic loops |
| **Browser** | Lightpanda · Scrapling · Puppeteer | Web scraping + automation |

---

## 🔄 Data Flow

How a single user prompt traverses the system:

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant UI as 🖥 UI (CLI/Electron/Web/VSCode)
    participant ROUTER as 📋 CORTEX.md Router
    participant REPL as 🔁 Agentic REPL
    participant TOOLS as 🔧 Tools
    participant MCP as 🔌 MCP Servers
    participant LLM as 🧠 HF Router (GLM-5)
    participant FALLBACK as 🔀 Fallback (novita / Ollama)
    participant FS as 💾 Filesystem / DB

    U->>UI: "create portfolio site at ~/Desktop/..."
    UI->>ROUTER: raw prompt
    ROUTER->>ROUTER: classify → match playbook from CORTEX.md
    ROUTER->>REPL: enriched prompt + system context

    loop Agentic Loop (observe → think → act)
        REPL->>LLM: POST /v1/chat/completions
        alt Primary OK
            LLM-->>REPL: tool_calls + reasoning
        else 5xx / empty
            LLM->>FALLBACK: retry with :novita
            FALLBACK-->>REPL: tool_calls + reasoning
        end

        alt Tool: Read/Write/Edit/Bash
            REPL->>TOOLS: invoke
            TOOLS->>FS: fs.readFile / writeFile / exec
            FS-->>TOOLS: result
            TOOLS-->>REPL: observation
        else Tool: MCP
            REPL->>MCP: jsonrpc tool call
            MCP-->>REPL: result
        else Done
            REPL->>UI: final answer / file paths
        end
    end

    UI->>U: streamed response + artefacts
```

### Fast-mode bypass (Electron ⚡ Fast)

```
User → Electron → direct HF POST → stream text → DOM
        (no REPL, no tools, <2s)
```

### Offline mode

```
User → Electron / CLI → HF fails (no internet)
     → auto-fallback → Ollama (localhost:11434)
     → local model response
```

---

## 🚀 Quick Start

### 🏎 Fastest: One-command install (recommended)

```bash
git clone https://github.com/gokul77898/Cortex.git
cd Cortex
./install.sh          # creates .venv, installs Python + Node deps, builds CLI
cp .env.example .env  # add your HF_TOKEN
./cortex.mjs "hello"
```

### 🐳 Docker (zero local deps)

```bash
git clone https://github.com/gokul77898/Cortex.git
cd Cortex
cp .env.example .env  # add your HF_TOKEN
docker build -t cortex .
docker run -it --rm --env-file .env -v "$(pwd)/workspace:/workspace" cortex "hello"
```

Or with docker-compose:
```bash
docker-compose up -d
docker-compose run cortex "hello"
```

### 📦 npm (global install)

```bash
npm install -g @gitlawb/cortex
cortex "hello"
```

### 🔧 Makefile shortcuts

```bash
make install       # one-command setup
make run ARGS="hello"
make docker-build
make test
```

### Prerequisites (for manual install only)

- **Node.js** ≥ 20 & **Bun** ≥ 1.1  —  `brew install bun`
- **Python** ≥ 3.9  (for RAG, voice, media helpers)
- **HuggingFace token**  →  [hf.co/settings/tokens](https://huggingface.co/settings/tokens) (free)
- **Optional:** Ollama for offline mode  →  `brew install ollama`

### Manual install (if you skip `install.sh`)

```bash
git clone https://github.com/gokul77898/Cortex.git
cd Cortex
python3 -m venv .venv && source .venv/bin/activate
pip install -r python/requirements.txt uv
bun install
bun run build
```

### Configure

Copy `.env.example` → `.env`. **One key is required**; the rest are optional:

```bash
# REQUIRED — the AI brain (free @ huggingface.co/settings/tokens)
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
HF_MODEL_ID=zai-org/GLM-5:together          # primary
HF_MODEL_FALLBACK=zai-org/GLM-5:novita      # auto-used on 5xx
HF_BASE_URL=https://router.huggingface.co/v1

# OPTIONAL — each unlocks one MCP
GITHUB_TOKEN=ghp_xxxxx
SLACK_BOT_TOKEN=xoxb-xxxxx
SLACK_TEAM_ID=Txxxxxxxx
LINEAR_API_KEY=lin_api_xxxxx
POSTGRES_CONNECTION_STRING=postgresql://user@localhost:5432/dbname

# OPTIONAL — offline fallback
OLLAMA_HOST=http://localhost:11434
CORTEX_FAST_MODEL=llama3.2:3b
CORTEX_VISION_MODEL=moondream
```

> **6 MCPs work with zero config** (filesystem · puppeteer · fetch · memory · sequential-thinking · sqlite). The other 4 activate when their env tokens are set.

### Run

```bash
./cortex.mjs                                    # interactive CLI
./cortex.mjs -p "refactor auth to async/await"  # one-shot
./bin/AGI-ui                                    # Electron floating UI
./bin/AGI-web                                   # web dashboard
```

---

## 🎨 Four Ways to Run It

| Interface | Launch | Best For | Latency |
|---|---|---|---|
| **CLI** | `./cortex.mjs` | Full agentic workflows · all 50+ commands · all tools | 4-8s per step |
| **Electron UI** | `./bin/AGI-ui` | Always-on-top floating chat · screen watcher · voice · hotkey `⌘⇧A` | <2s (Fast mode) |
| **Web Dashboard** | `./bin/AGI-web` → `localhost:3737` | Browsable commands · agents · MCP status · history · SSE streaming | <2s |
| **VS Code Extension** | Right-click → Ask/Explain/Refactor/Fix | In-editor assistance · same brain as CLI | 4-8s |

---

## 🧠 Zero-Command UX

You don't need to memorize 50+ slash commands. `CORTEX.md` is auto-loaded into every session and teaches the AI to route plain-English to the right capability:

```text
✦  fix all the TODOs in this project
✦  my auth is broken — something about JWT expiry
✦  dockerize this
✦  clean up my git branches
✦  document the python helpers
✦  ship this feature but don't push yet
✦  find security issues and fix them
✦  write tests for the module I just opened
```

The AI picks the playbook from `CORTEX.md` and executes. Slash commands remain as explicit shortcuts.

---

## 📋 Command Reference (50+ total)

<details>
<summary><strong>Tier 1 · Core (7)</strong></summary>

| Command | Description |
|---|---|
| `/smart-commit` `/sc` | Conventional commit with auto-detected type/scope |
| `/pr-review` | Comprehensive AI PR review |
| `/db` | Database schema + query analysis |
| `/test-gen` | Generate tests for a file/function |
| `/security-scan` | Deep security audit |
| `/perf-analyze` | Performance hotspot analysis |
| `/scan-report` | View latest scan reports |
</details>

<details>
<summary><strong>Tier 2 · Developer Productivity (8)</strong></summary>

| Command | Description |
|---|---|
| `/refactor` `/rf` | AI refactoring (rename, extract, convert patterns) |
| `/explain` `/ex` | Explain any code/file/function in plain English |
| `/docs` | Auto-generate JSDoc / docstrings / README sections |
| `/fix` | Paste an error → AI diagnoses + fixes it |
| `/todo` | Scan + prioritize TODO/FIXME/HACK comments |
| `/deps` | Dependency audit (outdated, vulnerable, unused) |
| `/lint-fix` | Auto-fix lint errors across the repo |
| `/type-check` `/tc` | Deep type analysis + AI-suggested fixes |
</details>

<details>
<summary><strong>Tier 3 · Code Intelligence (7)</strong></summary>

| Command | Description |
|---|---|
| `/architecture` `/arch` | Mermaid architecture diagrams |
| `/complexity` `/cx` | Cyclomatic complexity + hot spots |
| `/dead-code` `/dc` | Find unused exports, functions, files |
| `/api-map` | Map every endpoint + its consumers |
| `/schema-diff` | Diff two schemas + generate migration |
| `/coverage-gap` | Find untested files + auto-generate tests |
| `/bundle-analyze` | Bundle size breakdown + optimization tips |
</details>

<details>
<summary><strong>Tier 4 · Git & Collaboration (6)</strong></summary>

| Command | Description |
|---|---|
| `/release-notes-ai` `/changelog` | Auto-generate release notes from commits |
| `/bisect` | AI-guided git bisect |
| `/conflict-resolve` `/cr` | AI merge conflict resolution |
| `/branch-cleanup` `/bclean` | Identify + delete stale branches |
| `/commit-squash` `/squash` | Smart squash plan for a PR |
| `/review-queue` `/rq` | PRs assigned to you, prioritized |
</details>

<details>
<summary><strong>Tier 5 · Automation / Agentic (6)</strong></summary>

| Command | Description |
|---|---|
| `/watch` | Watch files and auto-run checks on change |
| `/auto-fix` | Continuous loop: scan → fix → test → commit |
| `/pipeline` `/ci` | Generate CI/CD YAML (GitHub Actions · GitLab · CircleCI) |
| `/dockerize` | Auto-generate Dockerfile + docker-compose |
| `/deploy` | Deploy helpers (Vercel · Netlify · Railway · Fly) |
| `/scheduler` `/cron` | Cron-like scheduled AI tasks |
</details>

<details>
<summary><strong>Tier 6 · Knowledge / RAG (5)</strong></summary>

| Command | Description |
|---|---|
| `/ask` `/q` | Ask a question grounded in your codebase |
| `/ai-memory` `/amem` | Persistent project memory (writes `CORTEX.md`) |
| `/onboard` | Generate onboarding guide for new devs |
| `/search` `/s` | Semantic code search |
| `/stackoverflow` `/so` | Diagnose error messages |
</details>

<details>
<summary><strong>Tier 7 · Multi-Model / Swarm (4)</strong></summary>

| Command | Description |
|---|---|
| `/swarm` | Parallel AI sub-agents for big tasks |
| `/compare` `/cmp` | Same prompt, multiple models, compare answers |
| `/debate` | Two models debate a design decision |
| `/cheap` | Route a simple query to a cheaper model |
</details>

<details>
<summary><strong>Tier 8 · Observability (4)</strong></summary>

| Command | Description |
|---|---|
| `/logs` | AI log analysis (errors, anomalies, patterns) |
| `/metrics` | Repo health dashboard (LOC, churn, deps) |
| `/trace` | Distributed trace analysis (OTel · Jaeger · Zipkin) |
| `/alerts` | Set up AI-driven alert rules |
</details>

<details>
<summary><strong>Tier 9 · Next-Gen (3) 🔥</strong></summary>

| Command | Description |
|---|---|
| `/rag` `/r` | Semantic search over your codebase (pgvector + HF embeddings) |
| `/autonomous` `/auto` `/daemon` | Background agent: scans repo, writes briefs, opens draft PRs |
| `/voice` `/v` | Voice I/O via HF Whisper + Bark TTS |

**Tier 9 setup:** `pip install -r python/requirements-tier-s.txt` (once). RAG needs pgvector: `brew install pgvector`.
</details>

---

## 👥 153 Specialist Agents

`src/skills/agency/` holds 153 expert personas auto-discovered by the skills loader. Invoke implicitly via CORTEX.md or explicitly:

```bash
/engineering-backend-architect design a REST API for a blog
/design-ui-designer suggest a color palette for a fintech app
/testing-reality-checker are my tests actually meaningful?
/marketing-content-strategist write 3 blog post ideas
/blockchain-security-auditor top 5 ERC-20 vulnerabilities?
```

**Categories:**

```
Marketing (29) ████████████████████████▓
Engineering (26) ██████████████████████
Specialized (10) ████████▒
Sales (9)       ████████
Testing (8)     ███████
Design (8)      ███████
Paid-Media (7)  ██████
Support (6)     █████
Project (6)     █████
Product (5)     ████
Academic (5)    ████
Workflow (4)    ███
Niche (30+)     █████████████████████████
```

Niche = blockchain · healthcare · compliance · XR · recruitment · legal · finance · IoT · robotics · gaming · …

---

## 🔌 MCP Servers (53 registered)

CORTEX registers 53 Model Context Protocol servers in `.mcp.json`. They load on-demand via `npx` or `uvx`.

### 🎯 Top 5 Priority (Claude Code CLI level)

| MCP | Capability |
|---|---|
| `context7` | **Live library docs** — 10k+ libraries, version-specific docs |
| `serena` | **LSP-level code navigation** — rename symbol, find refs, go-to-def |
| `playwright` | **Official Playwright MCP** — browser automation (better than puppeteer) |
| `jupyter` | **Notebook editing** — .ipynb cell read/write/execute |
| `automation-mac` | **Computer use** — mouse + keyboard control on macOS |

### 🔧 Code Intelligence

| MCP | Capability |
|---|---|
| `git` | Git operations — blame, diff, log, rebase, branch |
| `ast-grep-mcp` | Structural code search/refactor using AST patterns |

### 🌐 Search & Data

| MCP | Capability | Free Tier |
|---|---|---|
| `exa` | Neural search (better than Google for code) | 1000 searches/month |
| `tavily` | Optimized for LLM agents | 1000 queries/month |
| `duckduckgo` | Privacy search | 100% free |

### 🤖 Automation

| MCP | Capability |
|---|---|
| `desktop-commander` | Execute shell, kill processes, manage sessions |
| `everything` | Spotlight-like file search |

### 📊 Database

| MCP | Capability |
|---|---|
| `sqlite` | Direct SQLite access (`data/cortex.db`) |
| `postgres` | Direct Postgres access (requires `POSTGRES_CONNECTION_STRING`) |

### 🔌 Original 11

| MCP | Capability |
|---|---|
| `filesystem` | Sandboxed FS beyond current directory |
| `puppeteer` | Browser automation + screenshots |
| `fetch` | Web scraping + URL reading |
| `memory` | Persistent cross-session knowledge graph |
| `sequential-thinking` | Structured step-by-step reasoning |
| `github` | PRs · issues · releases · workflows (requires `GITHUB_TOKEN`) |
| `slack` | Send messages · read channels (requires `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID`) |
| `linear` | Issues · projects · teams (requires `LINEAR_API_KEY`) |
| `time` | Current time, timezone conversion |
| `everything` | File search (Windows Everything) |

### 🆓 Open-Source Expansion Pack (31 new, zero API keys)

Added 2026-04 — all npm/pypi open-source, no credentials required:

**📚 Knowledge & Research:**
| MCP | Capability |
|---|---|
| `arxiv` | Search 2M+ scientific papers |
| `wikipedia` | Query Wikipedia articles |
| `hackernews` | Browse HN stories + comments |
| `reddit` | Browse Reddit (read-only) |
| `youtube-transcript` | Extract YouTube transcripts |
| `paperswithcode` | ML papers + code benchmarks |
| `semantic-scholar` | Academic paper search |
| `openalex` | 240M+ scholarly works |

**📄 Content Processing:**
| MCP | Capability |
|---|---|
| `pandoc` | Convert 40+ document formats |
| `pdf-reader` | Extract text from PDFs |
| `markdown` / `html-to-markdown` | Markdown conversion (markitdown) |
| `excel` | Read/write .xlsx files |
| `repomix` | Pack entire repo into single file |

**🛠 DevOps & Data:**
| MCP | Capability |
|---|---|
| `docker` | Manage containers/images locally |
| `kubernetes` | K8s cluster management |
| `redis` | Local Redis cache ops |
| `duckdb` | Analytics SQL (no server needed) |
| `chroma` | Local vector database |
| `qdrant` | Local vector database |

**🖥 System & macOS:**
| MCP | Capability |
|---|---|
| `applescript` | Run AppleScript commands |
| `apple-shortcuts` | Trigger macOS Shortcuts |
| `cli` | Safe shell command executor |
| `calculator` | Arbitrary-precision math |
| `screenshot` | Capture screen to file |

**🌐 Utilities:**
| MCP | Capability |
|---|---|
| `rss` | Parse RSS/Atom feeds |
| `mermaid` | Render Mermaid diagrams |
| `osm` | OpenStreetMap lookups |
| `weather` | Free weather data |
| `regex` | Test and debug regex patterns |
| `json-tools` | Transform/query JSON |

### Token-gated (set env var to enable)

| MCP | Env var | Capability |
|---|---|---|
| `github` | `GITHUB_TOKEN` | PRs · issues · releases · workflows |
| `postgres` | `POSTGRES_CONNECTION_STRING` | Direct Postgres access |
| `slack` | `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID` | Send messages · read channels |
| `linear` | `LINEAR_API_KEY` | Issues · projects · teams |
| `exa` | `EXA_API_KEY` | Neural search |
| `tavily` | `TAVILY_API_KEY` | LLM-optimized search |

Missing tokens don't break the CLI — those MCPs simply show *failed* at startup; everything else runs.

---

## 🔀 Model Fallback + Offline Mode

### Primary → Fallback provider chain

```
                                HF Router
                                    │
            ┌───────────────────────┼──────────────────────┐
            ▼                       ▼                      ▼
   zai-org/GLM-5:together   zai-org/GLM-5:novita    Ollama (local)
       ◆ PRIMARY               ◆ AUTO-RETRY             ◆ OFFLINE
       (5xx → switch)          (on 5xx failure)      (no internet)
```

| Layer | Behaviour |
|---|---|
| **Electron Fast mode** | HF non-streaming → on 5xx/empty → retry `HF_MODEL_FALLBACK` → on failure → Ollama |
| **CLI Full AGI** | Same provider chain, baked into `src/services/api/openaiShim.ts` |
| **Offline** | `OLLAMA_HOST` detected automatically; uses `llama3.2:3b` for chat, `moondream` for vision |

### Ollama setup

```bash
brew install ollama
ollama pull llama3.2:3b         # chat fallback
ollama pull moondream           # vision fallback
ollama serve                    # listens on :11434
```

Dashboard → **Overview** tab shows green Ollama indicator when reachable.

---

## 🖥 Tier A — Floating Desktop UI with Screen Watcher

```bash
./bin/AGI-ui
```

**Capabilities:**

| Mode | Backend | Speed | Tools |
|---|---|---|---|
| ⚡ **Fast** (default) | Direct HF chat · streaming | <2s first byte | — |
| 🧠 **Full AGI** | Spawns `cortex.mjs -p` · all tools · all MCPs | 4-8s/step | All |
| 👁 **Watch Screen** | `desktopCapturer` → vision LLM every 10s | Background | Injects screen caption into every prompt |
| 🎤 **Voice** | Web Speech API · `speechSynthesis` | Instant | STT + TTS |
| ⌨️ **Text** | Enter to send | Instant | — |

**Global hotkeys** (register when app is running):

| Key | Action |
|---|---|
| `⌘⇧A` | Toggle window visibility |
| `⌘⇧F` | Toggle fullscreen |
| `⌘⇧S` | Snap screen immediately |

### One-time: clickable `.app` bundle

```bash
./bin/AGI-install-app
```

Puts `CORTEX.app` in `~/Applications` → launch via **Spotlight (⌘Space → "CORTEX")** or drag to Dock.

First launch asks for macOS **Screen Recording** permission — approve once in *System Settings → Privacy → Screen Recording*.

---

## 🌐 Tier A — Web Dashboard

```bash
./bin/AGI-web                         # or `/web` inside the CLI
# → http://localhost:3737 (auto-opens)
```

| Tab | Shows |
|---|---|
| **Overview** | Counts · env health (HF · GitHub · Ollama) · active model · PID · uptime |
| **Ask** | Prompt input · SSE-streamed output from `cortex.mjs -p` |
| **Commands** | Browsable + filterable list of every `/slash` command |
| **Agents** | All 153 specialist agents with categories |
| **MCP** | Each server with `READY` / `NEEDS ENV` status |
| **History** | Last 50 prompts · timings · exit codes · click to re-run |

Tweak via `CORTEX_WEB_PORT=3939` · `CORTEX_AUTO_OPEN=false`.

---

## 💻 Tier A — VS Code / Cursor extension

Right-click any code → **Ask / Explain / Refactor / Fix with CORTEX**. See `apps/vscode-extension/README.md`.

**Dev-install (instant):** open `apps/vscode-extension` in VS Code → press **F5**.

**Permanent-install:**

```bash
cd apps/vscode-extension && npx @vscode/vsce package
code --install-extension cortex-vscode-0.1.0.vsix
# or: cursor --install-extension cortex-vscode-0.1.0.vsix
```

---

## 🎨 Tier A — Media & Diagrams

| Command | Generates | Backend |
|---|---|---|
| `/image <prompt>` | PNG (auto-opens) | HF FLUX.1-schnell · override `CORTEX_IMAGE_MODEL` |
| `/video <prompt>` | MP4 | HF HunyuanVideo · may need pro tier · override `CORTEX_VIDEO_MODEL` |
| `/diagram <desc>` | **Mermaid + Excalidraw + Draw.io** in `data/diagrams/` | Chat-completion → parser |

**Direct Python:**

```bash
python3 python/cortex_media.py image "cyberpunk cat at sunset"
python3 python/cortex_diagram.py "user signup flow with OAuth + 2FA"
```

---

## 🏗 Project Structure

```
cortex/
├── cortex.mjs                    # CLI launcher (loads .env, imports dist/cli.mjs)
├── dist/
│   └── cli.mjs                   # Bundled CLI (built via `bun run build`)
├── src/
│   ├── entrypoints/
│   │   └── cli.tsx               # CLI bootstrap (Ink terminal UI)
│   ├── commands/
│   │   ├── _tierHelper.ts        # Shared prompt-command factory
│   │   ├── tier1/ … tier9/       # 50+ slash commands organised by tier
│   │   └── index.ts              # COMMANDS() registry
│   ├── skills/
│   │   └── agency/               # 153 specialist agents (auto-loaded)
│   ├── components/               # Ink / React terminal UI
│   ├── services/
│   │   └── api/
│   │       ├── openaiShim.ts     # HF Router adapter (with model fallback)
│   │       └── providerConfig.ts # Provider resolution logic
│   ├── tools/                    # Built-in tools: Read · Write · Edit · Bash · …
│   └── utils/
│       ├── browser-disable.ts    # Prevents auto-launched browsers
│       └── …
├── apps/
│   ├── voice-ui/                 # Electron floating UI (Tier A)
│   │   ├── main.js               # Electron main process + HF chat + vision
│   │   ├── preload.js            # IPC bridge
│   │   └── index.html            # Renderer
│   ├── web-ui/                   # Express + SSE dashboard (Tier A)
│   └── vscode-extension/         # VS Code + Cursor extension (Tier A)
├── python/
│   ├── smart_router.py           # Multi-provider auto-router
│   ├── ollama_provider.py        # Ollama adapter
│   ├── cortex_rag.py             # RAG (pgvector + HF embeddings)
│   ├── cortex_voice.py           # Whisper STT + Bark TTS
│   ├── cortex_media.py           # Image / video generation
│   ├── cortex_diagram.py         # Mermaid / Excalidraw / Draw.io
│   ├── cortex_security.py        # Security scanner
│   └── cortex_db.py              # SQLite history / memory
├── bin/
│   ├── AGI                       # Symlink to cortex.mjs
│   ├── AGI-ui                    # Launch Electron floating UI
│   ├── AGI-web                   # Launch web dashboard
│   ├── AGI-install-app           # Build macOS .app bundle
│   └── cortex                    # Symlink
├── scripts/
│   ├── build.ts                  # Bun bundler (stubs 21 telemetry modules)
│   ├── start-web.sh              # Dev server
│   └── …
├── data/
│   ├── cortex.db                 # SQLite: history + memory
│   └── diagrams/                 # Generated diagrams
├── logs/                         # Structured JSON logs
├── .mcp.json                     # MCP server registry (10 servers)
├── CORTEX.md                     # Zero-command UX router (auto-loaded)
└── .env                          # Secrets (gitignored)
```

---

## 🛠 Tech Stack

| Layer | Stack |
|---|---|
| **Language** | TypeScript (strict) · Python 3.9+ · Bash |
| **Runtime** | Node.js 20+ · Bun 1.1+ |
| **Terminal UI** | Ink (React for CLI) · chalk · boxen |
| **Desktop UI** | Electron 33 · HTML/CSS/JS renderer |
| **Web UI** | Express · Server-Sent Events (SSE) · vanilla JS |
| **IDE UI** | VS Code Extension API |
| **AI** | HuggingFace Router · Together AI · Novita · Fireworks · Ollama |
| **RAG** | pgvector · sentence-transformers |
| **Voice** | Whisper · Bark TTS · Web Speech API |
| **Vision** | Moondream · LLaVA (via Ollama) |
| **Browser** | Lightpanda · Scrapling · Puppeteer |
| **Data** | SQLite (better-sqlite3) · pgvector |
| **MCP** | 10 servers via `npx @modelcontextprotocol/server-*` |
| **Build** | Bun bundler + custom telemetry-stub plugin |

---

## 🔧 Development

```bash
# Build the CLI bundle (must re-run after editing src/)
bun run build

# Type-check (pre-existing warnings OK)
bun tsc --noEmit

# Run interactively
./cortex.mjs

# Run a single prompt (non-interactive)
./cortex.mjs -p "explain the auth flow"

# Launch Electron UI
./bin/AGI-ui

# Launch web dashboard
./bin/AGI-web

# Run tests
bun test
```

### Adding a new slash command

All Tier 2-9 commands share a factory in `src/commands/_tierHelper.ts`:

```ts
import { makeTierCommand, CODE_EDIT_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'my-command',
  aliases: ['mc'],
  description: 'Does X',
  progressMessage: 'doing X',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## Protocol\n…your prompt here…`,
})
```

Register it in `src/commands.ts` → import + add to the `COMMANDS()` array → `bun run build`.

### Adding a new agent

Drop a `.md` or `.yaml` file into `src/skills/agency/<category>-<name>.md`. It's auto-discovered at startup — no registration needed.

### Adding a new MCP server

Edit `.mcp.json`:

```json
"my-server": {
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "env": { "MY_TOKEN": "${MY_TOKEN}" }
}
```

---

## 🛡 Privacy & Security

| | Detail |
|---|---|
| 🚫 **Zero telemetry** | 21 telemetry modules stubbed at build time (`scripts/build.ts`) |
| 🚫 **No browser auto-opens** | We removed auto-launches to `localhost`, OAuth prompts, etc. |
| 🔒 **Secrets stay local** | `.env` gitignored · never committed |
| 🔓 **No vendor lock-in** | Swap `HF_MODEL_ID` to any HF-hosted model |
| 🧹 **Secret scanner** | Built-in startup scan flags `.env` leaks, hardcoded tokens, and unsafe patterns |
| 🦙 **Offline-capable** | Full Ollama fallback — code can run without internet |

---

## 📊 Benchmarks

Measured on MacBook Air M2 · HF Router + Together provider · unless noted:

| Operation | Latency |
|---|---|
| Electron Fast-mode first byte | 0.8 – 1.5 s |
| Electron Fast-mode complete answer (100 tokens) | 2 – 4 s |
| CLI Full AGI · single tool step | 4 – 8 s |
| CLI Full AGI · 5-step task | 30 – 60 s |
| CLI Full AGI · full feature build (portfolio site) | 2 – 5 min |
| Ollama fallback · `llama3.2:3b` first byte | 45 – 60 s (cold) · 2 – 5 s (warm) |
| Screen snap + vision caption (Moondream) | 1 – 3 s |
| Build `dist/cli.mjs` | 3 – 5 s |
| Startup: CLI `./cortex.mjs` | 1 – 2 s |
| Startup: Electron UI | 1 – 2 s |
| Startup: Web dashboard | 0.5 s |

---

## 🗺 Roadmap

### ✅ Shipped

- 50+ slash commands across 9 tiers
- 153 specialist agents
- 53 MCP servers (Claude Code CLI level)
- 4 UIs (CLI · Electron · Web · VS Code)
- Auto-failover (`:together` → `:novita` → Ollama)
- Screen watcher + vision
- Voice I/O
- RAG with pgvector
- Autonomous daemon
- Media + diagrams (image · video · Mermaid · Excalidraw · Draw.io)
- macOS `.app` bundle
- Smart router with latency/cost/health scoring
- uvx installed for Python MCP servers
- CORTEX_ALLOW_OPEN flag for app launches

### 🚧 In progress

- Windows + Linux `.app` bundles
- Streaming fix for `zai-org/GLM-5:together` (currently returns empty SSE)
- Cloud sync for memory / history
- Plugin marketplace for community agents

### 🎯 Planned

- Voice wake word ("Hey CORTEX")
- Inline code-lens in VS Code
- Mobile app (React Native)
- Self-hosted control panel for enterprise

---

## 🤝 Contributing

1. Fork the repo
2. `git checkout -b feat/my-feature`
3. Hack — run `bun run build` after every `src/` change
4. Use `/smart-commit` (we eat our own dog food) to generate a conventional commit
5. Push + open a PR

All contributions welcome — new agents, new commands, new MCPs, UI polish, bug fixes, docs.

---

## 📜 License

MIT — do whatever you want, just don't sue me.

---

## 🙏 Credits

Built on the shoulders of the open-source  with extensive rewrites:

- 50+ custom AI commands (original)
- Full HuggingFace provider integration (GLM-5 · Llama · DeepSeek · Qwen)
- Electron floating UI with screen watcher
- Web dashboard + VS Code extension
- Smart multi-provider router with auto-failover
- 153 specialist agents
- 10 MCP server registry
- Full telemetry & vendor-auth strip-out
- Offline Ollama fallback chain
- **Mission 09: Brain-Swarm** default boot theme

Powered by **HuggingFace Router** + **Together AI** + **Novita** + **zai-org/GLM-5** + **Ollama**.

---

<p align="center">
  <strong>⭐ Star the repo if CORTEX saves you even one hour</strong><br/>
  <a href="https://github.com/gokul77898/Cortex">github.com/gokul77898/Cortex</a>
</p>
