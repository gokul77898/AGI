import { describe, expect, it } from "vitest";

import { InMemoryTerminalSnapshotReader } from "../src/adapters/InMemoryTerminalSnapshotReader";
import { buildTerminalList } from "../src/application/buildTerminalList";

describe("buildTerminalList", () => {
  it("returns terminals sorted by creation time", async () => {
    const reader = new InMemoryTerminalSnapshotReader([
      {
        terminalId: "terminal-b",
        label: "terminal-b",
        state: "blocked",
        tentacleId: "backend",
        createdAt: "2026-02-24T10:05:00.000Z",
      },
      {
        terminalId: "terminal-a",
        label: "terminal-a",
        state: "live",
        tentacleId: "backend",
        tentacleName: "planner",
        workspaceMode: "worktree",
        createdAt: "2026-02-24T10:00:00.000Z",
      },
      {
        terminalId: "terminal-c",
        label: "terminal-c",
        state: "live",
        tentacleId: "frontend",
        createdAt: "2026-02-24T10:10:00.000Z",
      },
    ]);

    const result = await buildTerminalList(reader);

    expect(result).toHaveLength(3);
    expect(result.map((t) => t.terminalId)).toEqual(["terminal-a", "terminal-b", "terminal-c"]);
  });

  it("preserves terminal fields including tentacle metadata", async () => {
    const reader = new InMemoryTerminalSnapshotReader([
      {
        terminalId: "terminal-1",
        label: "my-terminal",
        state: "live",
        tentacleId: "backend",
        tentacleName: "Backend Dev",
        workspaceMode: "worktree",
        createdAt: "2026-02-24T10:00:00.000Z",
      },
    ]);

    const result = await buildTerminalList(reader);

    expect(result[0]?.tentacleId).toBe("backend");
    expect(result[0]?.tentacleName).toBe("Backend Dev");
    expect(result[0]?.workspaceMode).toBe("worktree");
  });

  it("defaults workspaceMode to undefined when not provided", async () => {
    const reader = new InMemoryTerminalSnapshotReader([
      {
        terminalId: "terminal-1",
        label: "terminal-1",
        state: "idle",
        tentacleId: "general",
        createdAt: "2026-02-24T10:00:00.000Z",
      },
    ]);

    const result = await buildTerminalList(reader);

    expect(result[0]?.workspaceMode).toBeUndefined();
  });
});
