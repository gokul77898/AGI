/**
 * Onboarding Wizard - Interactive setup guide for new CORTEX users
 *
 * Guides users through initial configuration including API keys,
 * model selection, and project setup. Creates config files and
 * marks completion status.
 */

import { EventEmitter } from 'events'
import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import readline from 'readline'

export interface OnboardingState {
  completed: boolean
  step: number
  preferences: {
    model?: string
    provider?: string
    apiKey?: string
    projectType?: string
    editor?: string
  }
  createdAt?: number
  completedAt?: number
}

export interface OnboardingStep {
  id: string
  title: string
  description: string
  prompt: string
  options?: { value: string; label: string; description: string }[]
  validate?: (input: string) => boolean | string
  action?: (input: string, state: OnboardingState) => Promise<void>
}

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to CORTEX',
    description: 'Your AI-powered coding assistant with 150+ specialist agents',
    prompt: 'Press Enter to begin setup...',
  },
  {
    id: 'provider',
    title: 'Choose Your AI Provider',
    description: 'CORTEX supports multiple AI providers',
    prompt: 'Select your preferred provider:',
    options: [
      { value: 'huggingface', label: 'Hugging Face', description: 'Free tier available, GLM-5 model' },
      { value: 'anthropic', label: 'Anthropic', description: 'Claude models (requires API key)' },
      { value: 'openai', label: 'OpenAI', description: 'GPT models (requires API key)' },
      { value: 'ollama', label: 'Ollama (Local)', description: 'Run models locally for free' },
    ],
  },
  {
    id: 'apiKey',
    title: 'API Configuration',
    description: 'Configure your API credentials',
    prompt: 'Enter your API key (or press Enter to skip and set later):',
    validate: (input) => {
      if (!input) return true // Allow skipping
      return input.length > 10 || 'API key seems too short'
    },
  },
  {
    id: 'projectType',
    title: 'Project Type',
    description: 'Help CORTEX understand your project',
    prompt: 'What type of project are you working on?',
    options: [
      { value: 'web', label: 'Web Application', description: 'React, Vue, Angular, etc.' },
      { value: 'backend', label: 'Backend/API', description: 'Node.js, Python, Go, etc.' },
      { value: 'mobile', label: 'Mobile App', description: 'React Native, Flutter, etc.' },
      { value: 'data', label: 'Data/ML', description: 'Jupyter, Python, R' },
      { value: 'cli', label: 'CLI Tool', description: 'Node.js, Go, Rust' },
      { value: 'general', label: 'General', description: 'Mixed or other' },
    ],
  },
  {
    id: 'editor',
    title: 'Editor Integration',
    description: 'Configure editor integration',
    prompt: 'Which editor do you use?',
    options: [
      { value: 'vscode', label: 'VS Code', description: 'Install CORTEX extension' },
      { value: 'jetbrains', label: 'JetBrains', description: 'IntelliJ, WebStorm, etc.' },
      { value: 'vim', label: 'Vim/Neovim', description: 'Terminal-based workflow' },
      { value: 'none', label: 'None', description: 'Use CLI only' },
    ],
  },
  {
    id: 'complete',
    title: 'Setup Complete!',
    description: 'CORTEX is ready to use',
    prompt: 'Press Enter to start using CORTEX...',
  },
]

const ANSI = {
  clear: '\x1b[2J\x1b[H',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
}

export class OnboardingWizard extends EventEmitter {
  private state: OnboardingState
  private configPath: string
  private rl: readline.Interface | null = null

  constructor() {
    super()
    this.configPath = path.join(homedir(), '.cortex', '.onboarded')
    this.state = {
      completed: false,
      step: 0,
      preferences: {},
    }
  }

  /**
   * Check if onboarding is completed
   */
  async isCompleted(): Promise<boolean> {
    try {
      await stat(this.configPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Load existing state
   */
  private async loadState(): Promise<void> {
    try {
      const data = await readFile(this.configPath, 'utf-8')
      this.state = JSON.parse(data)
    } catch {
      // Start fresh
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    await mkdir(path.dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, JSON.stringify(this.state, null, 2))
  }

  /**
   * Run the onboarding wizard
   */
  async run(): Promise<OnboardingState> {
    const completed = await this.isCompleted()
    if (completed) {
      console.log(`${ANSI.green}${ANSI.bold}✓${ANSI.reset} CORTEX is already configured.`)
      return { completed: true, step: STEPS.length, preferences: {} }
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    try {
      await this.loadState()
      await this.showWelcome()

      for (let i = this.state.step; i < STEPS.length; i++) {
        this.state.step = i
        await this.runStep(STEPS[i])
        await this.saveState()
      }

      this.state.completed = true
      this.state.completedAt = Date.now()
      await this.saveState()
      await this.showCompletion()

      return this.state
    } finally {
      this.rl?.close()
    }
  }

  /**
   * Show welcome banner
   */
  private async showWelcome(): Promise<void> {
    console.log(ANSI.clear)
    console.log()
    console.log(`${ANSI.bold}${ANSI.cyan}
   ██████╗ ██████╗  ██████╗ ██████╗ ███████╗
  ██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔════╝
  ██║     ██████╔╝██║   ██║██║  ██║█████╗
  ██║     ██╔══██╗██║   ██║██║  ██║██╔══╝
  ╚██████╗██║  ██║╚██████╔╝██████╔╝███████╗
   ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝${ANSI.reset}`)
    console.log()
    console.log(`${ANSI.dim}  Your AI-Powered Coding Assistant with 150+ Specialist Agents${ANSI.reset}`)
    console.log()
  }

  /**
   * Run a single step
   */
  private async runStep(step: OnboardingStep): Promise<void> {
    console.log()
    console.log(`${ANSI.bold}${ANSI.cyan}[${step.title}]${ANSI.reset}`)
    console.log(`${ANSI.dim}${step.description}${ANSI.reset}`)
    console.log()

    if (step.options) {
      await this.showOptions(step)
    } else {
      await this.promptInput(step)
    }
  }

  /**
   * Show options and get selection
   */
  private async showOptions(step: OnboardingStep): Promise<void> {
    if (!step.options) return

    step.options.forEach((opt, i) => {
      console.log(`  ${ANSI.bold}${i + 1}.${ANSI.reset} ${opt.label}`)
      console.log(`     ${ANSI.dim}${opt.description}${ANSI.reset}`)
    })
    console.log()

    const answer = await this.question(`  ${ANSI.yellow}➜${ANSI.reset} `)
    const idx = parseInt(answer) - 1

    if (idx >= 0 && idx < step.options.length) {
      const selected = step.options[idx]
      this.state.preferences[step.id as keyof typeof this.state.preferences] = selected.value

      await step.action?.(selected.value, this.state)
    } else {
      // Retry
      console.log(`${ANSI.dim}Invalid selection. Please try again.${ANSI.reset}`)
      await this.showOptions(step)
    }
  }

  /**
   * Prompt for text input
   */
  private async promptInput(step: OnboardingStep): Promise<void> {
    console.log(`  ${step.prompt}`)
    console.log()

    const answer = await this.question(`  ${ANSI.yellow}➜${ANSI.reset} `)

    if (step.validate) {
      const result = step.validate(answer)
      if (result !== true) {
        console.log(`${ANSI.dim}${result}${ANSI.reset}`)
        await this.promptInput(step)
        return
      }
    }

    this.state.preferences[step.id as keyof typeof this.state.preferences] = answer

    await step.action?.(answer, this.state)
  }

  /**
   * Show completion screen
   */
  private async showCompletion(): Promise<void> {
    console.log()
    console.log(`${ANSI.green}${ANSI.bold}✓ Setup Complete!${ANSI.reset}`)
    console.log()
    console.log(`${ANSI.dim}Your preferences have been saved to:${ANSI.reset}`)
    console.log(`  ${this.configPath}`)
    console.log()
    console.log(`${ANSI.bold}Quick Start:${ANSI.reset}`)
    console.log(`  ${ANSI.cyan}cortex${ANSI.reset}          ${ANSI.dim}Start interactive session${ANSI.reset}`)
    console.log(`  ${ANSI.cyan}cortex agents${ANSI.reset}   ${ANSI.dim}List 150+ specialist agents${ANSI.reset}`)
    console.log(`  ${ANSI.cyan}cortex /help${ANSI.reset}    ${ANSI.dim}Show available commands${ANSI.reset}`)
    console.log()
    console.log(`${ANSI.dim}Documentation: https://github.com/anthropics/cortex-code${ANSI.reset}`)
    console.log()
  }

  /**
   * Ask a question and get answer
   */
  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl?.question(prompt, resolve)
    })
  }

  /**
   * Reset onboarding (for re-running)
   */
  async reset(): Promise<void> {
    try {
      const { unlink } = await import('fs/promises')
      await unlink(this.configPath)
    } catch {
      // File doesn't exist
    }
    this.state = { completed: false, step: 0, preferences: {} }
  }

  /**
   * Get current state
   */
  getState(): OnboardingState {
    return { ...this.state }
  }
}

// Singleton
let wizardInstance: OnboardingWizard | null = null

export function getOnboardingWizard(): OnboardingWizard {
  if (!wizardInstance) {
    wizardInstance = new OnboardingWizard()
  }
  return wizardInstance
}

/**
 * Run onboarding if not completed
 */
export async function runOnboardingIfNeeded(): Promise<boolean> {
  const wizard = new OnboardingWizard()
  const completed = await wizard.isCompleted()

  if (!completed) {
    const state = await wizard.run()
    return state.completed
  }

  return true
}

/**
 * Force run onboarding
 */
export async function runOnboarding(): Promise<OnboardingState> {
  const wizard = new OnboardingWizard()
  await wizard.reset()
  return wizard.run()
}
