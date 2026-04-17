import { makeTierCommand, READ_ONLY_TOOLS, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'logs',
  description: 'Parse and analyze log files with AI — find errors, patterns, anomalies',
  progressMessage: 'analyzing logs',
  allowedTools: [...READ_ONLY_TOOLS, ...SHELL_TOOLS, 'Bash(tail:*)', 'Bash(awk:*)', 'Bash(sort:*)', 'Bash(uniq:*)'],
  buildPrompt: (args) => `## Log Analysis Protocol

**Log file / path:** ${args || '(ask user for log file location)'}

You are an SRE analyzing logs:

### 1. Triage
- Detect format: JSON, syslog, Apache, nginx, app-custom.
- Sample first 100 + last 100 lines.
- Total line count.

### 2. Extract signal
- **Error count** by type/code
- **Warning count**
- **Top 10 most frequent log messages**
- **Error spikes** — time windows with unusual volume
- **User/IP/session hot spots** — entities appearing disproportionately
- **Latency outliers** — if timing data present

### 3. Correlate
- Errors clustered in time (potential incident)
- Error → preceding events (causality)

### Output (Markdown)
\`\`\`
# Log Analysis: <file>

## Summary
- Lines: N
- Time range: X → Y
- Errors: A  Warnings: B

## Top Errors
| Count | Message | First seen | Last seen |

## Anomalies
- <time window>: <anomaly>

## Recommended actions
1. Investigate: <top issue>
2. ...
\`\`\`

### Rules
- Redact obvious secrets (tokens, keys) in output.
- For huge logs (>100MB), sample intelligently — don't try to read all.

Proceed.`,
})
