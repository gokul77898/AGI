# API Reference

Octogent exposes a local HTTP and WebSocket API.

## Terminals

- `GET /api/terminal-snapshots` - returns the current terminal list and snapshot state for the UI
- `POST /api/terminals` - creates a new terminal session
- `PATCH /api/terminals/:terminalId` - updates terminal metadata such as the display name
- `DELETE /api/terminals/:terminalId` - removes a terminal and closes its active session
- `WS /api/terminals/:terminalId/ws` - streams live terminal IO over WebSocket

## Git and worktrees

- `GET /api/tentacles/:tentacleId/git/status` - reads git status for a worktree-backed tentacle
- `POST /api/tentacles/:tentacleId/git/commit` - creates a commit from the tentacle worktree
- `POST /api/tentacles/:tentacleId/git/push` - pushes the tentacle branch
- `POST /api/tentacles/:tentacleId/git/sync` - syncs the tentacle worktree with its base branch
- `GET /api/tentacles/:tentacleId/git/pr` - reads pull request information for the tentacle branch
- `POST /api/tentacles/:tentacleId/git/pr/merge` - merges the tentacle pull request

## Deck and tentacles

- `GET /api/deck/skills` - lists available Claude Code skills discovered from project-local `.claude/skills/<skill>/SKILL.md` entries
- `GET /api/deck/tentacles` - lists tentacles with metadata, vault files, and todo progress
- `POST /api/deck/tentacles` - creates a new tentacle
- `DELETE /api/deck/tentacles/:tentacleId` - deletes a tentacle and its stored files
- `PATCH /api/deck/tentacles/:tentacleId/skills` - updates the tentacle's suggested Claude Code skills and rewrites the managed block in `CONTEXT.md`
- `POST /api/deck/tentacles/:tentacleId/todo` - adds a todo item to `todo.md`
- `PATCH /api/deck/tentacles/:tentacleId/todo/toggle` - marks a todo item done or undone
- `PATCH /api/deck/tentacles/:tentacleId/todo/edit` - edits the text of a todo item
- `POST /api/deck/tentacles/:tentacleId/todo/delete` - deletes a todo item
- `GET /api/deck/tentacles/:tentacleId/files/:filename` - reads one markdown file from the tentacle vault
- `POST /api/deck/tentacles/:tentacleId/swarm` - spawns worker terminals from incomplete todo items

## Prompts

- `GET /api/prompts` - lists available prompt templates
- `POST /api/prompts` - creates a user prompt
- `GET /api/prompts/:promptId` - reads one prompt
- `PUT /api/prompts/:promptId` - updates one prompt
- `DELETE /api/prompts/:promptId` - deletes one prompt

## Channels

- `GET /api/channels/:terminalId/messages` - lists messages for one terminal channel
- `POST /api/channels/:terminalId/messages` - sends a message to one terminal channel

## Code intel

- `POST /api/code-intel/events` - records one code-intel event
- `GET /api/code-intel/events` - returns the stored code-intel event log

## Hooks

- `POST /api/hooks/:hookName` - ingests lifecycle events coming from Claude Code hooks

Current hook names:

- `session-start`
- `user-prompt-submit`
- `pre-tool-use`
- `notification`
- `stop`

## Usage and telemetry

- `GET /api/codex/usage` - returns Codex usage data when available
- `GET /api/claude/usage` - returns Claude usage data when available
- `GET /api/github/summary` - returns GitHub summary and repo telemetry data
- `GET /api/analytics/usage-heatmap?scope=all|project` - returns heatmap data from Claude session history

## UI state

- `GET /api/ui-state` - reads the persisted UI state for the current project
- `PATCH /api/ui-state` - updates the persisted UI state

## Workspace setup

- `GET /api/setup` - reads the verified first-run setup status for the current workspace
- `POST /api/setup/steps/:stepId` - runs one setup step and returns the refreshed setup snapshot

## Monitor

- `GET /api/monitor/config` - reads monitor configuration
- `PATCH /api/monitor/config` - updates monitor configuration
- `GET /api/monitor/feed` - returns the current monitor feed snapshot
- `POST /api/monitor/refresh` - forces a monitor refresh

## Conversations

- `GET /api/conversations` - lists stored conversations
- `DELETE /api/conversations` - deletes all stored conversations
- `GET /api/conversations/search?q=...` - searches conversations by text
- `GET /api/conversations/:sessionId` - reads one conversation in full
- `GET /api/conversations/:sessionId/export?format=json|md` - exports one conversation as JSON or Markdown

## Request limits and defaults

- JSON request bodies are capped at `1 MiB`
- invalid JSON returns `400`
- unsupported methods return `405`
- the server binds to loopback by default
