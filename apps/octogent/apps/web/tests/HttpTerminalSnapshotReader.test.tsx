import { describe, expect, it } from "vitest";

import { HttpTerminalSnapshotReader } from "../src/runtime/HttpTerminalSnapshotReader";

describe("HttpTerminalSnapshotReader", () => {
  it("loads snapshots and filters out malformed payload entries", async () => {
    const reader = new HttpTerminalSnapshotReader({
      endpoint: "https://runtime.example.com/api/terminal-snapshots",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => [
          {
            terminalId: "agent-1",
            label: "root-a",
            state: "live",
            tentacleId: "tentacle-a",
            tentacleName: "planner",
            createdAt: "2026-02-24T10:00:00.000Z",
          },
          {
            label: "invalid-entry",
          },
        ],
      }),
    });

    await expect(reader.listTerminalSnapshots()).resolves.toEqual([
      {
        terminalId: "agent-1",
        label: "root-a",
        state: "live",
        tentacleId: "tentacle-a",
        tentacleName: "planner",
        createdAt: "2026-02-24T10:00:00.000Z",
      },
    ]);
  });

  it("throws when API response is not ok", async () => {
    const reader = new HttpTerminalSnapshotReader({
      endpoint: "https://runtime.example.com/api/terminal-snapshots",
      fetcher: async () => ({
        ok: false,
        status: 503,
        json: async () => [],
      }),
    });

    await expect(reader.listTerminalSnapshots()).rejects.toThrow(
      "Unable to load terminal snapshots (503)",
    );
  });
});
