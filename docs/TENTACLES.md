# CORTEX Tentacles — multi-agent orchestration

> Inspired by [octogent](https://github.com/hesamsheikh/octogent). Implemented
> natively in Cortex with zero upstream code — no license contamination.

## Why

Running 10 CORTEX sessions in parallel is painful: contexts blur, you forget
which agent was doing what, no task is truly owned. **Tentacles** fix this
by giving each slice of work its own folder with scoped context, a todo list,
and an inbox for inter-agent messages.

One orchestrator CORTEX can spawn child CORTEX agents into different tentacles
and coordinate them via message passing. Parent-worker multi-agent work
becomes tractable.

## The model

Each tentacle lives at `.cortex/tentacles/<id>/`:

| File | Purpose |
|---|---|
| `CONTEXT.md` | Scoped instructions any agent reads on entry |
| `todo.md` | Markdown checklist of work items |
| `notes/` | Free-form notes the agent drops as it learns |
| `inbox.jsonl` | Incoming messages (one JSON per line) |
| `outbox.jsonl` | Sent messages (audit log) |
| `state.json` | Metadata: status, parent, children, pids |

## CLI

```bash
# Create scoped jobs
cortex-tentacle new docs-refactor --context "Rewrite API docs" --todo "README" --todo "API.md"
cortex-tentacle new db-migration  --parent docs-refactor --todo "schema v2"

# Inspect
cortex-tentacle list
cortex-tentacle show docs-refactor

# Manage todos
cortex-tentacle todo docs-refactor                 # list
cortex-tentacle todo docs-refactor add "update CHANGELOG"
cortex-tentacle todo docs-refactor check 0          # mark done

# Inter-agent messaging
cortex-tentacle msg db-migration docs-refactor "Schema v2 shipped, update API docs"
cortex-tentacle inbox docs-refactor

# Launch a child CORTEX agent inside a tentacle
cortex-tentacle spawn docs-refactor "work through the todos one by one"

# Cleanup
cortex-tentacle remove db-migration
```

## Environment passed to child agents

When `spawn` launches a child CORTEX, these env vars are injected so the
agent knows it's inside a tentacle:

- `CORTEX_TENTACLE_ID` — the tentacle id
- `CORTEX_TENTACLE_ROOT` — the root folder of all tentacles

The child's `cwd` is set to the tentacle folder, so relative file writes
land inside the tentacle's notes and todo area by default.

## Patterns

### Parent-worker fanout

```bash
cortex-tentacle new coordinator --todo "split refactor across 3 workers"
cortex-tentacle new worker-frontend --parent coordinator
cortex-tentacle new worker-backend  --parent coordinator
cortex-tentacle new worker-tests    --parent coordinator

# Spawn workers from the coordinator
cortex-tentacle spawn worker-frontend "refactor components/"
cortex-tentacle spawn worker-backend  "refactor api/"
cortex-tentacle spawn worker-tests    "update all tests"
```

### Message-based handoff

Workers drop completion messages into the coordinator's inbox:
```bash
cortex-tentacle msg worker-backend coordinator "api refactor done, ready for tests"
```

The coordinator polls the inbox and triggers the next stage.

## Design notes

- **Append-only messaging**: `inbox.jsonl` / `outbox.jsonl` are JSONL so they
  survive crashes and partial writes without corruption.
- **No UI**: CLI only. The parent CORTEX agent is the UI.
- **Durable**: tentacles persist on disk between runs.
- **Sandboxed cwd**: child agents default to writing into their tentacle
  folder, not the whole repo.

## Limitations

- No automatic PTY survival across API restarts (unlike octogent's web UI).
- No websocket-based live log feed — just check `state.json` and the pids.
- Messaging is pull-based; agents must check their inbox explicitly.
