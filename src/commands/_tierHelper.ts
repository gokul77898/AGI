/**
 * Shared helper for CORTEX Tier 2–8 prompt-based commands.
 * Each command is a thin wrapper around the AI with a custom system prompt
 * and a whitelist of tools. This centralizes the boilerplate so all 40
 * Tier 2–8 commands can be defined in just a few lines each.
 */
import type { Command } from '../commands.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'

export type TierCommandSpec = {
  name: string
  aliases?: string[]
  description: string
  progressMessage: string
  allowedTools: string[]
  buildPrompt: (args: string) => string
}

export function makeTierCommand(spec: TierCommandSpec): Command {
  return {
    type: 'prompt',
    name: spec.name,
    aliases: spec.aliases,
    description: spec.description,
    allowedTools: spec.allowedTools,
    contentLength: 0,
    progressMessage: spec.progressMessage,
    source: 'builtin',
    async getPromptForCommand(args, context) {
      const promptContent = spec.buildPrompt(args ?? '')
      const finalContent = await executeShellCommandsInPrompt(
        promptContent,
        {
          ...context,
          getAppState() {
            const appState = context.getAppState()
            return {
              ...appState,
              toolPermissionContext: {
                ...appState.toolPermissionContext,
                alwaysAllowRules: {
                  ...appState.toolPermissionContext.alwaysAllowRules,
                  command: spec.allowedTools,
                },
              },
            }
          },
        },
        `/${spec.name}`,
      )
      return [{ type: 'text', text: finalContent }]
    },
  }
}

// Common tool sets reused across tiers
export const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'LS']
export const GIT_READ_TOOLS = [
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git branch:*)',
  'Bash(git show:*)',
  'Bash(git remote:*)',
]
export const GIT_WRITE_TOOLS = [
  ...GIT_READ_TOOLS,
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git checkout:*)',
  'Bash(git merge:*)',
  'Bash(git rebase:*)',
  'Bash(git push:*)',
]
export const CODE_EDIT_TOOLS = [
  ...READ_ONLY_TOOLS,
  'Edit',
  'MultiEdit',
  'Write',
]
export const SHELL_TOOLS = [
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(find:*)',
  'Bash(grep:*)',
  'Bash(rg:*)',
  'Bash(wc:*)',
  'Bash(head:*)',
  'Bash(tail:*)',
]
export const PKG_TOOLS = [
  'Bash(npm:*)',
  'Bash(pnpm:*)',
  'Bash(yarn:*)',
  'Bash(bun:*)',
  'Bash(pip:*)',
  'Bash(python:*)',
  'Bash(python3:*)',
]
