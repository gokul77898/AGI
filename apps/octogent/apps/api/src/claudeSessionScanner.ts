import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

export type UsageSlice = {
  key: string;
  tokens: number;
};

export type UsageDayEntry = {
  date: string;
  totalTokens: number;
  projects: UsageSlice[];
  models: UsageSlice[];
  sessions: number;
};

export type UsageChartResponse = {
  days: UsageDayEntry[];
  projects: string[];
  models: string[];
};

type AssistantEvent = {
  type: string;
  timestamp: string;
  sessionId: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
};

const isAssistantEvent = (value: unknown): value is AssistantEvent => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.type === "assistant" && typeof record.timestamp === "string";
};

const toDateKey = (timestamp: string): string | null => {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
};

type DayBucket = {
  totalTokens: number;
  projectTokens: Map<string, number>;
  modelTokens: Map<string, number>;
  sessions: Set<string>;
};

const scanJsonlFile = async (
  filePath: string,
  projectLabel: string,
  buckets: Map<string, DayBucket>,
): Promise<void> => {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (!isAssistantEvent(parsed)) continue;

    const dateKey = toDateKey(parsed.timestamp);
    if (!dateKey) continue;

    const usage = parsed.message?.usage;
    if (!usage) continue;

    const totalTokens =
      (usage.input_tokens ?? 0) +
      (usage.output_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0);

    if (totalTokens === 0) continue;

    let bucket = buckets.get(dateKey);
    if (!bucket) {
      bucket = {
        totalTokens: 0,
        projectTokens: new Map(),
        modelTokens: new Map(),
        sessions: new Set(),
      };
      buckets.set(dateKey, bucket);
    }

    bucket.totalTokens += totalTokens;
    bucket.projectTokens.set(
      projectLabel,
      (bucket.projectTokens.get(projectLabel) ?? 0) + totalTokens,
    );

    const modelKey = parsed.message?.model ?? "unknown";
    bucket.modelTokens.set(modelKey, (bucket.modelTokens.get(modelKey) ?? 0) + totalTokens);

    if (parsed.sessionId) {
      bucket.sessions.add(parsed.sessionId);
    }
  }
};

const scanProjectDirectory = async (
  projectDir: string,
  projectLabel: string,
  buckets: Map<string, DayBucket>,
): Promise<void> => {
  let entries: string[];
  try {
    entries = await readdir(projectDir);
  } catch {
    return;
  }

  const jsonlFiles = entries.filter((entry) => entry.endsWith(".jsonl"));
  await Promise.all(
    jsonlFiles.map((file) => scanJsonlFile(join(projectDir, file), projectLabel, buckets)),
  );
};

const slugToLabel = (slug: string): string => {
  const parts = slug.replace(/^-/, "").split("-");
  const codebaseIndex = parts.findIndex((p) => p.toLowerCase() === "codebase");
  const relevant = codebaseIndex >= 0 ? parts.slice(codebaseIndex + 1) : parts.slice(-1);
  if (relevant.length === 0) return slug;

  const joined = relevant.join("-");
  const worktreeMatch = joined.match(/^(.+?)--.*?-worktrees-(.+)$/);
  if (worktreeMatch) {
    return `${worktreeMatch[1]}/${worktreeMatch[2]}`;
  }
  return joined;
};

const sortedKeys = (totals: Map<string, number>): string[] =>
  Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

const mapToSlices = (map: Map<string, number>): UsageSlice[] =>
  Array.from(map.entries())
    .map(([key, tokens]) => ({ key, tokens }))
    .sort((a, b) => b.tokens - a.tokens);

const projectSlugFromCwd = (cwd: string): string => cwd.replace(/\//g, "-");

let cachedResult: { response: UsageChartResponse; fetchedAt: number; cacheKey: string } | null =
  null;
const CACHE_TTL_MS = 120_000;

export const scanClaudeUsageChart = async (
  scope: "all" | "project",
  workspaceCwd: string,
): Promise<UsageChartResponse> => {
  const projectSlug = scope === "project" ? projectSlugFromCwd(workspaceCwd) : null;
  const cacheKey = `${scope}:${projectSlug ?? "all"}`;

  if (
    cachedResult &&
    Date.now() - cachedResult.fetchedAt < CACHE_TTL_MS &&
    cachedResult.cacheKey === cacheKey
  ) {
    return cachedResult.response;
  }

  const buckets = new Map<string, DayBucket>();

  if (scope === "project" && projectSlug) {
    const label = slugToLabel(projectSlug);
    await scanProjectDirectory(join(CLAUDE_PROJECTS_DIR, projectSlug), label, buckets);
  } else {
    let projectDirs: string[];
    try {
      projectDirs = await readdir(CLAUDE_PROJECTS_DIR);
    } catch {
      projectDirs = [];
    }
    await Promise.all(
      projectDirs.map((dir) =>
        scanProjectDirectory(join(CLAUDE_PROJECTS_DIR, dir), slugToLabel(dir), buckets),
      ),
    );
  }

  const projectTotals = new Map<string, number>();
  const modelTotals = new Map<string, number>();

  const days: UsageDayEntry[] = Array.from(buckets.entries())
    .map(([date, bucket]) => {
      for (const [p, t] of bucket.projectTokens) {
        projectTotals.set(p, (projectTotals.get(p) ?? 0) + t);
      }
      for (const [m, t] of bucket.modelTokens) {
        modelTotals.set(m, (modelTotals.get(m) ?? 0) + t);
      }
      return {
        date,
        totalTokens: bucket.totalTokens,
        projects: mapToSlices(bucket.projectTokens),
        models: mapToSlices(bucket.modelTokens),
        sessions: bucket.sessions.size,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const response: UsageChartResponse = {
    days,
    projects: sortedKeys(projectTotals),
    models: sortedKeys(modelTotals),
  };
  cachedResult = { response, fetchedAt: Date.now(), cacheKey };
  return response;
};
