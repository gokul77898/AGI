/**
 * AI Merge Conflict Resolution - Intelligently resolve git merge conflicts
 *
 * Detects merge conflicts in the repository and uses AI to resolve them
 * based on context, preserving both versions as comments when uncertain.
 */

import { EventEmitter } from 'events'
import { readFile, writeFile } from 'fs/promises'
import { spawn } from 'child_process'
import path from 'path'

export interface Conflict {
  file: string
  startLine: number
  endLine: number
  ourVersion: string
  theirVersion: string
  commonAncestor?: string
  context?: string
}

export interface Resolution {
  file: string
  conflict: Conflict
  resolution: string
  confidence: number // 0-1
  method: 'ai' | 'ours' | 'theirs' | 'manual'
  preservedBoth?: boolean
}

export interface ResolverConfig {
  autoResolve: boolean
  reviewMode: boolean
  preserveUncertain: boolean
  minConfidence: number // 0-1, minimum confidence to auto-resolve
  logResolutions: boolean
}

const DEFAULT_CONFIG: ResolverConfig = {
  autoResolve: true,
  reviewMode: false,
  preserveUncertain: true,
  minConfidence: 0.7,
  logResolutions: true,
}

export class MergeResolver extends EventEmitter {
  private config: ResolverConfig
  private resolutions: Resolution[] = []
  private logPath: string

  constructor(config: Partial<ResolverConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logPath = path.join(process.cwd(), '.cortex', 'merge-resolutions.log')
  }

  /**
   * Find all files with merge conflicts
   */
  async findConflicts(cwd: string = process.cwd()): Promise<Conflict[]> {
    const conflictFiles = await this.getConflictFiles(cwd)
    const conflicts: Conflict[] = []

    for (const file of conflictFiles) {
      const fileConflicts = await this.parseConflicts(file)
      conflicts.push(...fileConflicts)
    }

    return conflicts
  }

  /**
   * Get list of files with conflicts using git
   */
  private async getConflictFiles(cwd: string): Promise<string[]> {
    return new Promise((resolve) => {
      const git = spawn('git', ['diff', '--name-only', '--diff-filter=U'], { cwd })
      let output = ''

      git.stdout.on('data', (data) => {
        output += data.toString()
      })

      git.on('close', () => {
        const files = output
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean)
          .map((f) => path.join(cwd, f))
        resolve(files)
      })
    })
  }

  /**
   * Parse conflicts from a file
   */
  private async parseConflicts(filePath: string): Promise<Conflict[]> {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const conflicts: Conflict[] = []

    let inConflict = false
    let startLine = 0
    let ourVersion: string[] = []
    let theirVersion: string[] = []
    let inOurs = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.startsWith('<<<<<<<')) {
        inConflict = true
        startLine = i + 1
        inOurs = true
        ourVersion = []
        theirVersion = []
      } else if (line.startsWith('=======')) {
        inOurs = false
      } else if (line.startsWith('>>>>>>>')) {
        if (inConflict) {
          // Get context around conflict
          const contextStart = Math.max(0, startLine - 5)
          const contextEnd = Math.min(lines.length, i + 5)
          const context = lines.slice(contextStart, contextEnd).join('\n')

          conflicts.push({
            file: filePath,
            startLine,
            endLine: i + 1,
            ourVersion: ourVersion.join('\n'),
            theirVersion: theirVersion.join('\n'),
            context,
          })
        }
        inConflict = false
      } else if (inConflict) {
        if (inOurs) {
          ourVersion.push(line)
        } else {
          theirVersion.push(line)
        }
      }
    }

    return conflicts
  }

  /**
   * Resolve a conflict using AI
   */
  async resolveConflict(conflict: Conflict): Promise<Resolution> {
    // Try to intelligently merge based on patterns
    const resolution = await this.aiResolve(conflict)

    if (resolution.confidence >= this.config.minConfidence) {
      if (this.config.autoResolve && !this.config.reviewMode) {
        await this.applyResolution(resolution)
      }
    } else if (this.config.preserveUncertain) {
      // Preserve both versions as comments
      resolution.resolution = this.preserveBothVersions(conflict)
      resolution.preservedBoth = true
    }

    this.resolutions.push(resolution)
    this.emit('resolved', resolution)

    return resolution
  }

  /**
   * AI-based conflict resolution
   */
  private async aiResolve(conflict: Conflict): Promise<Resolution> {
    const { ourVersion, theirVersion, context } = conflict

    // Analyze the conflicts
    const analysis = this.analyzeConflict(ourVersion, theirVersion)

    // Determine resolution based on analysis
    let resolution: string
    let confidence: number
    let method: 'ai' | 'ours' | 'theirs' | 'manual'

    if (analysis.isIdentical) {
      // Same content on both sides
      resolution = ourVersion
      confidence = 1.0
      method = 'ai'
    } else if (analysis.oneIsEmpty) {
      // One side removed, keep non-empty
      resolution = analysis.oursIsEmpty ? theirVersion : ourVersion
      confidence = 0.9
      method = 'ai'
    } else if (analysis.isFormattingOnly) {
      // Only formatting differences, prefer our version (current branch)
      resolution = ourVersion
      confidence = 0.85
      method = 'ours'
    } else if (analysis.canMerge) {
      // Try to merge both versions
      resolution = this.mergeBoth(ourVersion, theirVersion, analysis)
      confidence = 0.7
      method = 'ai'
    } else {
      // Complex conflict, need manual review
      resolution = conflict.ourVersion // Default to ours
      confidence = 0.5
      method = 'manual'
    }

    return {
      file: conflict.file,
      conflict,
      resolution,
      confidence,
      method,
    }
  }

  /**
   * Analyze conflict to determine resolution strategy
   */
  private analyzeConflict(ours: string, theirs: string): {
    isIdentical: boolean
    oneIsEmpty: boolean
    oursIsEmpty: boolean
    isFormattingOnly: boolean
    canMerge: boolean
    importChanges?: { ours: string[]; theirs: string[] }
  } {
    const normalizedOurs = ours.trim().replace(/\s+/g, ' ')
    const normalizedTheirs = theirs.trim().replace(/\s+/g, ' ')

    return {
      isIdentical: ours.trim() === theirs.trim(),
      oneIsEmpty: ours.trim() === '' || theirs.trim() === '',
      oursIsEmpty: ours.trim() === '',
      isFormattingOnly: normalizedOurs === normalizedTheirs,
      canMerge: this.canAutoMerge(ours, theirs),
    }
  }

  /**
   * Check if versions can be auto-merged
   */
  private canAutoMerge(ours: string, theirs: string): boolean {
    // Check if both are import statements
    const oursIsImport = ours.includes('import ')
    const theirsIsImport = theirs.includes('import ')

    // Check if both are exports
    const oursIsExport = ours.includes('export ')
    const theirsIsExport = theirs.includes('export ')

    return (oursIsImport && theirsIsImport) || (oursIsExport && theirsIsExport)
  }

  /**
   * Merge both versions intelligently
   */
  private mergeBoth(ours: string, theirs: string, analysis: any): string {
    // For imports/exports, combine unique entries
    if (analysis.canMerge) {
      const ourLines = new Set(ours.split('\n').map(l => l.trim()).filter(Boolean))
      const theirLines = theirs.split('\n').map(l => l.trim()).filter(Boolean)

      for (const line of theirLines) {
        ourLines.add(line)
      }

      return Array.from(ourLines).join('\n')
    }

    // Default: concatenate with separator
    return `${ours}\n// === THEIR VERSION ===\n${theirs}`
  }

  /**
   * Preserve both versions as comments
   */
  private preserveBothVersions(conflict: Conflict): string {
    return (
      `// === CONFLICT RESOLUTION (both versions preserved) ===\n` +
      `// OUR VERSION:\n${conflict.ourVersion.split('\n').map(l => `// ${l}`).join('\n')}\n` +
      `// THEIR VERSION:\n${conflict.theirVersion.split('\n').map(l => `// ${l}`).join('\n')}\n` +
      `// === END CONFLICT ===\n`
    )
  }

  /**
   * Apply resolution to file
   */
  private async applyResolution(resolution: Resolution): Promise<void> {
    const { file, conflict } = resolution
    const content = await readFile(file, 'utf-8')

    // Remove conflict markers and replace with resolution
    const lines = content.split('\n')
    const newLines = [
      ...lines.slice(0, conflict.startLine - 1),
      ...resolution.resolution.split('\n'),
      ...lines.slice(conflict.endLine),
    ]

    await writeFile(file, newLines.join('\n'))

    if (this.config.logResolutions) {
      await this.logResolution(resolution)
    }
  }

  /**
   * Log resolution to file
   */
  private async logResolution(resolution: Resolution): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      file: resolution.file,
      confidence: resolution.confidence,
      method: resolution.method,
      preservedBoth: resolution.preservedBoth,
    }

    const { appendFile, mkdir } = await import('fs/promises')
    await mkdir(path.dirname(this.logPath), { recursive: true })
    await appendFile(this.logPath, JSON.stringify(logEntry) + '\n')
  }

  /**
   * Resolve all conflicts in repository
   */
  async resolveAll(cwd: string = process.cwd()): Promise<{
    resolved: Resolution[]
    failed: Conflict[]
  }> {
    const conflicts = await this.findConflicts(cwd)
    const resolved: Resolution[] = []
    const failed: Conflict[] = []

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict)
        if (resolution.confidence >= this.config.minConfidence) {
          resolved.push(resolution)
        } else {
          failed.push(conflict)
        }
      } catch (err) {
        failed.push(conflict)
      }
    }

    return { resolved, failed }
  }

  /**
   * Get resolution summary
   */
  getResolutions(): Resolution[] {
    return this.resolutions
  }

  /**
   * Clear resolutions log
   */
  clearResolutions(): void {
    this.resolutions = []
  }
}

// Convenience functions
export async function resolveConflicts(
  cwd?: string,
  options?: Partial<ResolverConfig>
): Promise<{ resolved: Resolution[]; failed: Conflict[] }> {
  const resolver = new MergeResolver(options)
  return resolver.resolveAll(cwd)
}

export async function findMergeConflicts(cwd?: string): Promise<Conflict[]> {
  const resolver = new MergeResolver()
  return resolver.findConflicts(cwd)
}
