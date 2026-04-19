/**
 * Multi-file Batch Editing - Apply similar edits across multiple files
 *
 * Enables bulk find-and-replace, regex transformations, and structured
 * edits across multiple files with preview and rollback capabilities.
 */

import { EventEmitter } from 'events'
import { readFile, writeFile, mkdir, stat, unlink } from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import { createHash } from 'crypto'
import { tmpdir } from 'os'

export interface BatchEditOperation {
  type: 'replace' | 'regex' | 'insert' | 'prepend' | 'append'
  pattern: string
  replacement: string
  options?: {
    regexFlags?: string
    lineNumber?: number
    onlyFirst?: boolean
  }
}

export interface BatchEditResult {
  file: string
  success: boolean
  changes: number
  originalContent: string
  newContent: string
  diff?: string
  backupPath?: string
}

export interface BatchEditConfig {
  preview: boolean
  backup: boolean
  dryRun: boolean
  maxFiles: number
  excludePatterns: string[]
}

const DEFAULT_CONFIG: BatchEditConfig = {
  preview: true,
  backup: true,
  dryRun: false,
  maxFiles: 100,
  excludePatterns: ['node_modules/**', '.git/**', 'dist/**'],
}

export class BatchEditor extends EventEmitter {
  private config: BatchEditConfig
  private backups: Map<string, string> = new Map()

  constructor(config: Partial<BatchEditConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Find files matching pattern
   */
  async findFiles(pattern: string, cwd: string = process.cwd()): Promise<string[]> {
    const files = await glob(pattern, {
      cwd,
      absolute: true,
      ignore: this.config.excludePatterns,
      nodir: true,
    })
    return files.slice(0, this.config.maxFiles)
  }

  /**
   * Apply batch edit to files
   */
  async edit(
    filePattern: string,
    operation: BatchEditOperation,
    cwd: string = process.cwd()
  ): Promise<BatchEditResult[]> {
    const files = await this.findFiles(filePattern, cwd)
    const results: BatchEditResult[] = []

    this.emit('start', { files: files.length, operation })

    for (const file of files) {
      const result = await this.editFile(file, operation)
      results.push(result)
      this.emit('file', result)
    }

    this.emit('complete', {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    })

    return results
  }

  /**
   * Edit a single file
   */
  private async editFile(
    filePath: string,
    operation: BatchEditOperation
  ): Promise<BatchEditResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      let newContent = content
      let changes = 0

      switch (operation.type) {
        case 'replace':
          const result = this.applyReplace(newContent, operation)
          newContent = result.content
          changes = result.changes
          break

        case 'regex':
          const regexResult = this.applyRegex(newContent, operation)
          newContent = regexResult.content
          changes = regexResult.changes
          break

        case 'insert':
          newContent = this.applyInsert(newContent, operation)
          changes = 1
          break

        case 'prepend':
          newContent = operation.replacement + '\n' + newContent
          changes = 1
          break

        case 'append':
          newContent = newContent + '\n' + operation.replacement
          changes = 1
          break
      }

      if (changes === 0) {
        return {
          file: filePath,
          success: false,
          changes: 0,
          originalContent: content,
          newContent: content,
        }
      }

      // Backup original if enabled
      let backupPath: string | undefined
      if (this.config.backup && !this.config.dryRun) {
        backupPath = await this.createBackup(filePath, content)
      }

      // Write new content if not dry run
      if (!this.config.dryRun) {
        await writeFile(filePath, newContent)
      }

      return {
        file: filePath,
        success: true,
        changes,
        originalContent: content,
        newContent,
        diff: this.computeDiff(content, newContent),
        backupPath,
      }
    } catch (err) {
      return {
        file: filePath,
        success: false,
        changes: 0,
        originalContent: '',
        newContent: '',
      }
    }
  }

  /**
   * Apply simple replace
   */
  private applyReplace(
    content: string,
    operation: BatchEditOperation
  ): { content: string; changes: number } {
    let changes = 0
    let result = content

    if (operation.options?.onlyFirst) {
      const index = content.indexOf(operation.pattern)
      if (index !== -1) {
        result = content.slice(0, index) +
          operation.replacement +
          content.slice(index + operation.pattern.length)
        changes = 1
      }
    } else {
      const count = (content.match(new RegExp(this.escapeRegex(operation.pattern), 'g')) || []).length
      result = content.split(operation.pattern).join(operation.replacement)
      changes = count
    }

    return { content: result, changes }
  }

  /**
   * Apply regex transformation
   */
  private applyRegex(
    content: string,
    operation: BatchEditOperation
  ): { content: string; changes: number } {
    const flags = operation.options?.regexFlags || 'g'
    const regex = new RegExp(operation.pattern, flags)

    let changes = 0
    const result = content.replace(regex, (match, ...args) => {
      changes++
      // Support $1, $2, etc. in replacement
      let replacement = operation.replacement
      args.slice(0, -2).forEach((group, i) => {
        replacement = replacement.replace(new RegExp(`\\$${i + 1}`, 'g'), group || '')
      })
      return replacement
    })

    return { content: result, changes }
  }

  /**
   * Apply insert at line
   */
  private applyInsert(content: string, operation: BatchEditOperation): string {
    const lines = content.split('\n')
    const lineNum = operation.options?.lineNumber ?? 0
    lines.splice(Math.max(0, Math.min(lineNum, lines.length)), 0, operation.replacement)
    return lines.join('\n')
  }

  /**
   * Create backup of original file
   */
  private async createBackup(filePath: string, content: string): Promise<string> {
    const backupDir = path.join(tmpdir(), 'cortex-batch-edit')
    await mkdir(backupDir, { recursive: true })

    const hash = createHash('md5').update(filePath).digest('hex').slice(0, 8)
    const backupPath = path.join(backupDir, `${path.basename(filePath)}.${hash}.bak`)

    await writeFile(backupPath, content)
    this.backups.set(filePath, backupPath)

    return backupPath
  }

  /**
   * Compute simple diff
   */
  private computeDiff(original: string, modified: string): string {
    const origLines = original.split('\n')
    const newLines = modified.split('\n')

    const diff: string[] = []
    const maxLen = Math.max(origLines.length, newLines.length)

    for (let i = 0; i < maxLen; i++) {
      const orig = origLines[i]
      const newL = newLines[i]

      if (orig === newL) {
        continue
      }
      if (orig !== undefined && newL === undefined) {
        diff.push(`-${i + 1}: ${orig}`)
      } else if (orig === undefined && newL !== undefined) {
        diff.push(`+${i + 1}: ${newL}`)
      } else {
        diff.push(`-${i + 1}: ${orig}`)
        diff.push(`+${i + 1}: ${newL}`)
      }
    }

    return diff.join('\n')
  }

  /**
   * Rollback changes
   */
  async rollback(filePath: string): Promise<boolean> {
    const backupPath = this.backups.get(filePath)
    if (!backupPath) return false

    try {
      const content = await readFile(backupPath, 'utf-8')
      await writeFile(filePath, content)
      await unlink(backupPath)
      this.backups.delete(filePath)
      this.emit('rolledback', { file: filePath })
      return true
    } catch {
      return false
    }
  }

  /**
   * Rollback all changes
   */
  async rollbackAll(): Promise<{ successful: string[]; failed: string[] }> {
    const successful: string[] = []
    const failed: string[] = []

    for (const [filePath] of this.backups) {
      const result = await this.rollback(filePath)
      if (result) {
        successful.push(filePath)
      } else {
        failed.push(filePath)
      }
    }

    return { successful, failed }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Preview changes without applying
   */
  async preview(
    filePattern: string,
    operation: BatchEditOperation,
    cwd: string = process.cwd()
  ): Promise<{ file: string; diff: string; changes: number }[]> {
    const files = await this.findFiles(filePattern, cwd)
    const previews: { file: string; diff: string; changes: number }[] = []

    const originalDryRun = this.config.dryRun
    this.config.dryRun = true

    for (const file of files) {
      const result = await this.editFile(file, operation)
      if (result.success) {
        previews.push({
          file: result.file,
          diff: result.diff || '',
          changes: result.changes,
        })
      }
    }

    this.config.dryRun = originalDryRun
    return previews
  }
}

// Convenience functions
export async function batchReplace(
  pattern: string,
  search: string,
  replace: string,
  cwd?: string
): Promise<BatchEditResult[]> {
  const editor = new BatchEditor({ preview: false, backup: true })
  return editor.edit(pattern, { type: 'replace', pattern: search, replacement: replace }, cwd)
}

export async function batchRegex(
  pattern: string,
  regex: string,
  replacement: string,
  flags?: string,
  cwd?: string
): Promise<BatchEditResult[]> {
  const editor = new BatchEditor({ preview: false, backup: true })
  return editor.edit(
    pattern,
    { type: 'regex', pattern: regex, replacement, options: { regexFlags: flags } },
    cwd
  )
}

export async function batchInsert(
  pattern: string,
  text: string,
  lineNumber: number,
  cwd?: string
): Promise<BatchEditResult[]> {
  const editor = new BatchEditor({ preview: false, backup: true })
  return editor.edit(
    pattern,
    { type: 'insert', pattern: '', replacement: text, options: { lineNumber } },
    cwd
  )
}
