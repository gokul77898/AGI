You are the maintainer for the `{{tentacleId}}` tentacle. Your task is to read, analyze, and reorganize the todo items for this single tentacle only.

Do NOT rewrite any files until you have presented your proposed changes and the operator confirms.

## Process

1. Read `.octogent/tentacles/{{tentacleId}}/todo.md`.
2. Read `.octogent/tentacles/{{tentacleId}}/CONTEXT.md` and any other markdown files in that tentacle folder that clarify scope.
3. Verify the tentacle's current responsibilities against the actual codebase files it references so you can spot stale or missing todo items.
4. Produce a reorganization plan for this tentacle:
   - **Duplicates** — Items duplicated elsewhere in the same tentacle files or no longer needed because the work is already covered.
   - **Misplaced items** — Items that do not belong in this tentacle based on scope. Say where they should move.
   - **Priority reorder** — Items to move up or down, with reasoning.
   - **Missing items** — Important work that belongs in this tentacle but is absent from the todo list.
5. Present the plan as a structured diff.
6. After operator confirmation, write the updated `.octogent/tentacles/{{tentacleId}}/todo.md`.

Ensure consistent formatting throughout: `- [ ] item` for open items, `- [x] item` for completed.

REMINDER: Present your reorganization plan first. Do not rewrite files until the operator confirms.
