import { CODE_EDIT_TOOLS, makeTierCommand } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'alerts',
  description: 'Set up AI-driven alert rules (log watchers / metric thresholds)',
  progressMessage: 'configuring alerts',
  allowedTools: CODE_EDIT_TOOLS,
  buildPrompt: (args) => `## Alert Rules Protocol

**What to alert on:** ${args || '(ask user: e.g. "error rate > 5%", "login failures spike", "build fails")'}

You are an SRE configuring alerting:

### 1. Clarify
- The signal to watch (log pattern, metric, http endpoint, exit code)
- Threshold / condition
- Notification channel (email, Slack, webhook, local notification)

### 2. Generate alert rule
Pick the simplest appropriate tool:
- **Prometheus** → write \`alert.rules.yml\`
- **Datadog** → write Terraform \`datadog_monitor\`
- **Local log watcher** → Bash script in \`scripts/alert-<name>.sh\` that tails a log + greps + curls a webhook
- **GitHub Actions** → workflow that runs on schedule + notifies

### 3. Write notification delivery
- Webhook URL (user provides)
- Slack webhook via curl
- \`osascript -e 'display notification'\` for macOS local

### 4. Test
- Simulate the condition if safe.
- Print how user can manually test the alert.

### Output
- File(s) written
- Install command
- Test command
- Uninstall command

### Rules
- NEVER hardcode webhook URLs / tokens in committed files — use \`.env\`.

Proceed.`,
})
