/**
 * Inline Code Completion - Cursor-style ghost text suggestions
 *
 * Provides real-time code completion suggestions as ghost text that appears
 * ahead of the cursor. Users can accept with Tab or dismiss with Escape.
 */

import { EventEmitter } from 'events'
import type { ReadLine } from 'readline'

export interface CompletionConfig {
  enabled: boolean
  debounceMs: number
  maxSuggestionLength: number
  modelEndpoint?: string
}

export interface CompletionSuggestion {
  text: string
  confidence: number
  source: 'model' | 'snippet' | 'history'
}

const DEFAULT_CONFIG: CompletionConfig = {
  enabled: true,
  debounceMs: 300,
  maxSuggestionLength: 200,
}

// ANSI escape codes for ghost text
const ANSI = {
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  cursorSave: '\x1b[s',
  cursorRestore: '\x1b[u',
  clearLine: '\x1b[0K',
}

export class CodeCompletionEngine extends EventEmitter {
  private config: CompletionConfig
  private currentSuggestion: CompletionSuggestion | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private rl: ReadLine | null = null
  private lastInput: string = ''
  private history: string[] = []

  constructor(config: Partial<CompletionConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Setup completion for a readline interface
   */
  setup(rl: ReadLine): void {
    this.rl = rl

    // Intercept key events
    const origWrite = rl.write.bind(rl)

    // Handle Tab to accept suggestion
    rl.on('keypress', (char: string, key: any) => {
      if (key.name === 'tab' && this.currentSuggestion) {
        this.acceptSuggestion()
        return
      }
      if (key.name === 'escape') {
        this.dismissSuggestion()
        return
      }
      // Clear suggestion on other input
      if (char && char !== '') {
        this.clearGhostText()
      }
    })
  }

  /**
   * Request completion for current input
   */
  async requestCompletion(input: string, context?: {
    file?: string
    language?: string
    surroundingCode?: string
  }): Promise<CompletionSuggestion | null> {
    if (!this.config.enabled || !input.trim()) {
      return null
    }

    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        const suggestion = await this.generateSuggestion(input, context)
        if (suggestion) {
          this.currentSuggestion = suggestion
          this.showGhostText(suggestion.text)
          this.emit('suggestion', suggestion)
        }
        resolve(suggestion)
      }, this.config.debounceMs)
    })
  }

  /**
   * Generate completion suggestion using model
   */
  private async generateSuggestion(
    input: string,
    context?: { file?: string; language?: string; surroundingCode?: string }
  ): Promise<CompletionSuggestion | null> {
    // Check history first for quick matches
    const historyMatch = this.findHistoryMatch(input)
    if (historyMatch) {
      return {
        text: historyMatch,
        confidence: 0.9,
        source: 'history',
      }
    }

    // For now, return context-based suggestions
    // In production, this would call the model API
    const snippets = this.getSnippetSuggestions(input, context?.language)
    if (snippets.length > 0) {
      return {
        text: snippets[0],
        confidence: 0.7,
        source: 'snippet',
      }
    }

    return null
  }

  /**
   * Find matching command from history
   */
  private findHistoryMatch(input: string): string | null {
    const trimmed = input.trim().toLowerCase()
    for (const hist of this.history.slice().reverse()) {
      if (hist.toLowerCase().startsWith(trimmed) && hist.length > trimmed.length) {
        return hist.slice(trimmed.length)
      }
    }
    return null
  }

  /**
   * Get language-specific snippet suggestions
   */
  private getSnippetSuggestions(input: string, language?: string): string[] {
    const suggestions: string[] = []
    const lang = language || 'typescript'

    // Common patterns
    if (input.endsWith('=>')) {
      suggestions.push(' { }')
    }
    if (input.endsWith('function ')) {
      if (lang === 'typescript') {
        suggestions.push('name(params: type): returnType { }')
      } else {
        suggestions.push('name(params) { }')
      }
    }
    if (input.match(/console\.\w*$/)) {
      suggestions.push('log()', '.error()', '.warn()')
    }
    if (input.endsWith('import ')) {
      suggestions.push("{ } from ''", "* as name from ''")
    }
    if (input.match(/async\s+$/)) {
      suggestions.push('function name() { }', '(params) => { }')
    }

    return suggestions.slice(0, 3)
  }

  /**
   * Show ghost text in terminal
   */
  private showGhostText(text: string): void {
    if (!this.rl || !text) return

    const truncated = text.slice(0, this.config.maxSuggestionLength)
    process.stdout.write(ANSI.cursorSave)
    process.stdout.write(ANSI.dim + truncated + ANSI.reset)
    process.stdout.write(ANSI.cursorRestore)
  }

  /**
   * Clear ghost text from terminal
   */
  private clearGhostText(): void {
    if (this.currentSuggestion) {
      process.stdout.write(ANSI.clearLine)
      this.currentSuggestion = null
    }
  }

  /**
   * Accept current suggestion (insert into input)
   */
  acceptSuggestion(): void {
    if (!this.currentSuggestion || !this.rl) return

    const text = this.currentSuggestion.text
    this.rl.write(text)
    this.history.push(text)
    this.currentSuggestion = null
    this.emit('accepted', text)
  }

  /**
   * Dismiss current suggestion
   */
  dismissSuggestion(): void {
    this.clearGhostText()
    this.emit('dismissed')
  }

  /**
   * Add to history for future suggestions
   */
  addToHistory(input: string): void {
    if (input.trim()) {
      this.history.push(input)
      // Keep only last 100 entries
      if (this.history.length > 100) {
        this.history = this.history.slice(-100)
      }
    }
  }

  /**
   * Enable/disable completion
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    if (!enabled) {
      this.clearGhostText()
    }
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<CompletionConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Singleton instance
let instance: CodeCompletionEngine | null = null

export function getCodeCompletionEngine(config?: Partial<CompletionConfig>): CodeCompletionEngine {
  if (!instance) {
    instance = new CodeCompletionEngine(config)
  }
  return instance
}

/**
 * Setup code completion for REPL
 */
export function setupCodeCompletion(rl: ReadLine, config?: Partial<CompletionConfig>): CodeCompletionEngine {
  const engine = new CodeCompletionEngine(config)
  engine.setup(rl)
  return engine
}
