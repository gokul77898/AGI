# Filesystem Layout

## Project-local files

`.octogent/` is created in the workspace.

Main paths:

- `.octogent/project.json`
- `.octogent/tentacles/`
- `.octogent/worktrees/`

Tentacle example:

```text
.octogent/
  tentacles/
    api-backend/
      CONTEXT.md
      todo.md
      routes.md
```

`CONTEXT.md` may end with a managed `Suggested Skills` block when the operator or planner attaches Claude Code skills to that tentacle.

Project-local Claude Code skills, when present, live under:

```text
.claude/
  skills/
    some-skill/
      SKILL.md
```

## Global state

Per-project runtime state is stored under:

```text
~/.octogent/projects/<project-id>/state/
```

Notable files:

- `tentacles.json`
- `deck.json`
- `transcripts/<sessionId>.jsonl`
- `monitor-config.json`
- `monitor-cache.json`
- `code-intel.jsonl`

## Prompt storage

- core prompts are synced from `prompts/`
- synced copies live in `.octogent/prompts/core/`
- user prompts live in `.octogent/prompts/`

## Practical rule

If something is agent-facing context, keep it in the tentacle folder.

If something is runtime-owned state, expect it under the global project state directory.
