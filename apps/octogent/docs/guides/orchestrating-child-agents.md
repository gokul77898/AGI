# Orchestrating Child Agents

Octogent uses child terminals to split work into parallel streams.

## Current model

- a parent terminal can exist as the main coordinator
- child terminals can be created with a parent terminal ID
- the Deck swarm flow can create one worker per incomplete todo item
- workers can run in shared mode or worktree mode

## When to use child agents

Use child agents when:

- tasks are independent enough to run in parallel
- the parent can define clean scopes
- each task fits one tentacle or one todo item

Do not use them when the work is too entangled and the agents will overwrite each other.

## Recommended workflow

1. create or pick a tentacle
2. write or refine `CONTEXT.md`
3. break the work into checkbox items in `todo.md`
4. spawn worker terminals from those items
5. review results in the parent terminal
6. use channel messages when workers need to coordinate

## Shared vs worktree

Use `shared` when:

- the tasks are read-heavy
- the changes are small
- you want fast setup

Use `worktree` when:

- the tasks touch overlapping files
- you want clean git isolation
- you expect larger code edits

## Limits

- PTY sessions do not survive API restarts
- channel messages are in-memory only
- delegation quality depends on the quality of `CONTEXT.md` and `todo.md`
