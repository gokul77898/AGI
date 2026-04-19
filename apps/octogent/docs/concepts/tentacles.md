# Tentacles

Tentacles are the core abstraction in Octogent.

## Definition

A tentacle is a folder under `.octogent/tentacles/<tentacle-id>/` that stores agent-readable markdown files.

The minimum useful files are:

- `CONTEXT.md`
- `todo.md`

Additional markdown files are allowed and are surfaced as tentacle vault files in the app.

## What a tentacle is for

Use a tentacle when you want a durable context layer for one slice of the codebase or one track of work.

Examples:

- API runtime
- frontend shell
- prompt system
- monitor integration
- release work

## What goes in `CONTEXT.md`

`CONTEXT.md` should explain:

- what this area owns
- the important files or directories
- what already exists
- constraints and edge cases
- what not to break
- any Claude Code skills that are especially useful for this tentacle, when relevant

The first heading and first non-empty paragraph are used by the runtime as the display name and description.

When a tentacle has suggested Claude Code skills, Octogent appends a managed block at the bottom of `CONTEXT.md`:

```md
<!-- octogent:suggested-skills:start -->
## Suggested Skills

You can use these skills if you need to.

- `skill-name`
<!-- octogent:suggested-skills:end -->
```

## What goes in `todo.md`

`todo.md` should contain markdown checkbox items:

```md
# Todo

- [ ] add request validation for monitor config
- [ ] cover the invalid payload case in tests
- [x] wire the route into the request handler
```

The runtime parses checkbox lines and computes progress.

## Tentacles and delegation

The point of a tentacle is not only documentation. It is operational context.

A worker attached to a tentacle can:

- read local notes first
- stay scoped to that area
- use the todo list as a work queue
- hand work to child agents without rebuilding context from scratch

## Tentacles and worktrees

Tentacles are not the same thing as worktrees.

- a tentacle is a context folder
- a worktree is an isolated git checkout for a terminal

You can use a tentacle with shared workspace terminals or worktree terminals.
