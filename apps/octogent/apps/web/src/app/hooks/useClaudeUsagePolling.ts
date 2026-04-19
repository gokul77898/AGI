import { useRef } from "react";

import { buildClaudeUsageUrl } from "../../runtime/runtimeEndpoints";
import { CODEX_USAGE_SCAN_INTERVAL_MS } from "../constants";
import type { ClaudeUsageSnapshot } from "../types";
import { normalizeClaudeUsageSnapshot } from "../usageNormalizers";
import { usePollingData } from "./usePollingData";

const fallback = (): ClaudeUsageSnapshot => ({
  status: "error",
  source: "none",
  fetchedAt: new Date().toISOString(),
});

export const useClaudeUsagePolling = () => {
  const lastOkRef = useRef<ClaudeUsageSnapshot | null>(null);

  const normalize = (raw: unknown): ClaudeUsageSnapshot | null => {
    const snapshot = normalizeClaudeUsageSnapshot(raw);
    if (snapshot?.status === "ok") {
      lastOkRef.current = snapshot;
      return snapshot;
    }
    // Keep showing the last successful snapshot until a new "ok" arrives
    return lastOkRef.current ?? snapshot;
  };

  const { data, isLoading, refresh } = usePollingData<ClaudeUsageSnapshot>({
    fetchUrl: buildClaudeUsageUrl(),
    intervalMs: CODEX_USAGE_SCAN_INTERVAL_MS,
    normalize,
    fallback,
  });

  return {
    claudeUsageSnapshot: data,
    isRefreshingClaudeUsage: isLoading,
    refreshClaudeUsage: refresh,
  };
};
