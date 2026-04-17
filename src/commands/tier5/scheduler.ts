import { CODE_EDIT_TOOLS, makeTierCommand, SHELL_TOOLS } from '../_tierHelper.js'

export default makeTierCommand({
  name: 'scheduler',
  aliases: ['cron'],
  description: 'Set up cron-like scheduled AI tasks (runs scans/reports on a schedule)',
  progressMessage: 'configuring schedule',
  allowedTools: [...CODE_EDIT_TOOLS, ...SHELL_TOOLS, 'Bash(crontab:*)', 'Bash(launchctl:*)'],
  buildPrompt: (args) => `## Scheduler Protocol

**Task + schedule:** ${args || '(ask user: what task + when, e.g. "security-scan every day at 6am")'}

You are an ops engineer. Set up a scheduled CORTEX task:

### 1. Clarify
- Which CORTEX command to run (e.g. \`/security-scan\`)
- Schedule (cron expression or natural time: "daily at 6am", "every Monday")
- Where to write results (log file / email / webhook)

### 2. Choose scheduler based on OS
- macOS → launchd plist (preferred) or crontab
- Linux → systemd timer (preferred) or crontab
- Windows → Task Scheduler (schtasks)

### 3. Generate schedule file
- Create wrapper script \`scripts/scheduled-<task>.sh\`:
  - cd to repo
  - Load \`.env\`
  - Run the CORTEX command
  - Redirect output to \`logs/scheduled-<task>.log\`
- Create the scheduler registration file/entry.

### 4. Install command
- Print exact command user runs to enable the schedule.
- NEVER install without user approval (launchctl/crontab modifies system).

### Output
- Path to wrapper script
- Path to scheduler config
- Install command
- How to view logs
- How to uninstall

Proceed.`,
})
