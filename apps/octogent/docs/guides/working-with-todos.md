# Working With Todos

Todos are the operational center of a tentacle.

## Format

Use markdown checkboxes in `todo.md`.

```md
# Todo

- [ ] inspect websocket reconnect path
- [ ] add regression test for idle grace handling
- [ ] update runtime docs
```

The parser only treats checkbox lines as todo items.

## Good todo items

Good todo items are:

- specific
- testable
- narrow enough for one agent
- written so they still make sense without extra chat history

Bad todo items are vague and force the agent to rediscover the assignment.

## Suggested pattern

- keep one tentacle per work area
- keep one `todo.md` per tentacle
- write tasks at the level of a child agent assignment
- mark items done in the file, not only in the UI

## Why this matters

The current runtime reads `todo.md`, shows progress in the Deck view, and uses incomplete items when launching swarm work.

That means the todo file is both:

- a planning tool for the developer
- an execution source for delegation

## Example

```md
# Todo

- [ ] add API route for terminal rename
- [ ] test invalid terminal ids
- [ ] document rename flow in CLI reference
```

This gives you three clean delegation units instead of one oversized prompt.
