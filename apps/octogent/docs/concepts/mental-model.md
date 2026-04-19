# Mental Model

This page is for the exact model behind Octogent. The README is the pitch. This page is the boundary map.

## The main pieces

- the **developer** defines the jobs and reviews the output
- a **tentacle** holds the local context for one job
- a **terminal** is one live Claude Code session
- a **worker** is a terminal assigned to a narrower piece of work
- a **parent** is a terminal coordinating one or more workers
- a **channel** is a short-lived coordination path between terminals

## Tentacle vs terminal

These are different things.

- a **tentacle** is a folder with agent-readable files
- a **terminal** is a running session

Multiple terminals can point at the same tentacle. That matters for swarm work, because several workers may need the same local context while still remaining separate sessions.

## Tentacle vs worktree

These are also different things.

- a **tentacle** is the context layer
- a **worktree** is the git isolation layer

A tentacle can be used with:

- a shared-workspace terminal
- a worktree-backed terminal

The tentacle decides *what the job is about*. The worktree decides *where the code changes happen*.

## What belongs in files

The durable source of truth should live in files inside the tentacle.

That includes:

- context about the area
- notes and handoff information
- the current task list in `todo.md`

If another agent needs to understand the job later, the important information should already be there without depending on one old chat thread.

## What belongs in runtime state

The runtime owns:

- live terminal sessions
- websocket transport
- UI state
- transcripts
- message delivery state

That data helps the app run, but it is not the same thing as the durable job context.

## How delegation is supposed to work

The expected flow is:

1. the developer or a parent agent defines a job boundary
2. the tentacle files capture the local context
3. `todo.md` breaks the job into executable items
4. one or more child terminals take those items
5. workers report status through files and short messages
6. the parent or human reviews the result

If the boundary is vague, the orchestration gets worse. Octogent helps organize work, but it does not rescue a poorly defined job.

## What the project is actually trying to prove

- terminal coding agents can be treated as building blocks inside an orchestration layer
- file-based context is more reliable than trying to keep everything inside one long conversation
- one Claude Code session can coordinate other Claude Code sessions in a visible way
- simple task lists and short messages are enough for some useful multi-agent workflows
