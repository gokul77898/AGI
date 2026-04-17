import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'trace',
  description: 'Distributed tracing analysis — parse OpenTelemetry / Jaeger / Zipkin traces',
  progressMessage: 'analyzing traces',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS],
  buildPrompt: (args) => `## Trace Analysis Protocol

**Trace source:** ${args || '(ask user: file path, URL, or trace ID)'}

You are a distributed systems analyst:

### 1. Ingest trace
- Formats: OTLP JSON, Jaeger JSON, Zipkin JSON, Datadog APM export.
- Parse into spans with: trace_id, span_id, parent_id, service, operation, start, duration, tags.

### 2. Analyze critical path
- Reconstruct the span tree.
- Compute total request latency.
- Find the CRITICAL PATH — the sequence of spans defining total duration.

### 3. Find bottlenecks
- Spans >30% of total latency
- N+1 query patterns (many short sibling spans of same operation)
- Sequential calls that could be parallel
- Retries / errors

### 4. Attribute latency by service
- % of total time spent in each service/component.

### Output
\`\`\`
# Trace Analysis — trace_id: <id>

Total: Xms across N spans / M services

## Critical path
1. <service.op> — Xms (A%)
2. ...

## Bottlenecks
- <span> — Yms (B%) — reason

## Attribution
- serviceA: 45%
- serviceB: 30%
- ...

## Recommendations
1. <biggest win>
2. ...
\`\`\`

Proceed.`,
})
