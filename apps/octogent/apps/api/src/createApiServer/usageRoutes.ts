import type { ApiRouteHandler } from "./routeHelpers";
import { writeJson, writeMethodNotAllowed } from "./routeHelpers";

export const handleCodexUsageRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { readCodexUsageSnapshot },
) => {
  if (requestUrl.pathname !== "/api/codex/usage") {
    return false;
  }

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const payload = await readCodexUsageSnapshot();
  writeJson(response, 200, payload, corsOrigin);
  return true;
};

export const handleClaudeUsageRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { readClaudeUsageSnapshot, readClaudeOauthUsageSnapshot, readClaudeCliUsageSnapshot },
) => {
  if (
    requestUrl.pathname !== "/api/claude/usage" &&
    requestUrl.pathname !== "/api/claude/usage/oauth" &&
    requestUrl.pathname !== "/api/claude/usage/cli"
  ) {
    return false;
  }

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const payload =
    requestUrl.pathname === "/api/claude/usage/oauth"
      ? await readClaudeOauthUsageSnapshot()
      : requestUrl.pathname === "/api/claude/usage/cli"
        ? await readClaudeCliUsageSnapshot()
        : await readClaudeUsageSnapshot();
  writeJson(response, 200, payload, corsOrigin);
  return true;
};

export const handleUsageHeatmapRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { scanUsageHeatmap },
) => {
  if (requestUrl.pathname !== "/api/analytics/usage-heatmap") {
    return false;
  }

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const scope = requestUrl.searchParams.get("scope") === "project" ? "project" : "all";
  const payload = await scanUsageHeatmap(scope);
  writeJson(response, 200, payload, corsOrigin);
  return true;
};

export const handleGithubSummaryRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { readGithubRepoSummary },
) => {
  if (requestUrl.pathname !== "/api/github/summary") {
    return false;
  }

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const payload = await readGithubRepoSummary();
  writeJson(response, 200, payload, corsOrigin);
  return true;
};
