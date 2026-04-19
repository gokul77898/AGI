/**
 * Auto Codebase Indexing - Background codebase indexing for instant semantic search
 *
 * Automatically indexes the codebase when a project is opened and keeps
 * the index updated when files change. Removes the /rag friction by making
 * semantic search always available.
 */

import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { watch } from 'fs'
import { readFile, stat, mkdir } from 'fs/promises'
import { createHash } from 'crypto'
import path from 'path'
import { homedir } from 'os'

export interface IndexConfig {
  enabled: boolean
  watchMode: boolean
  debounceMs: number
  maxFileSize: number
  excludePatterns: string[]
  includePatterns: string[]
  chunkSize: number
  chunkOverlap: number
}

export interface IndexedFile {
  path: string
  hash: string
  lastModified: number
  chunks: Chunk[]
}

export interface Chunk {
  id: string
  filePath: string
  content: string
  startLine: number
  endLine: number
  embedding?: number[]
  hash: string
}

export interface SearchResult {
  filePath: string
  content: string
  score: number
  startLine: number
  endLine: number
  context?: string
}

const DEFAULT_CONFIG: IndexConfig = {
  enabled: true,
  watchMode: true,
  debounceMs: 500,
  maxFileSize: 1024 * 1024, // 1MB
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '*.min.js',
    '*.min.css',
    '*.lock',
    'package-lock.json',
    'bun.lock',
  ],
  includePatterns: [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '**/*.py',
    '**/*.go',
    '**/*.rs',
    '**/*.java',
    '**/*.md',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
  ],
  chunkSize: 500,
  chunkOverlap: 50,
}

export class AutoIndexer extends EventEmitter {
  private config: IndexConfig
  private projectRoot: string
  private indexPath: string
  private index: Map<string, IndexedFile> = new Map()
  private watcher: ReturnType<typeof watch> | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private isIndexing: boolean = false
  private embeddings: Map<string, number[]> = new Map()

  constructor(projectRoot: string, config: Partial<IndexConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.projectRoot = projectRoot
    this.indexPath = path.join(
      homedir(),
      '.cortex',
      'indexes',
      this.getProjectSlug(),
      'index.json'
    )
  }

  /**
   * Get unique slug for project
   */
  private getProjectSlug(): string {
    const hash = createHash('md5')
    hash.update(this.projectRoot)
    return hash.digest('hex').slice(0, 8)
  }

  /**
   * Initialize and start indexing
   */
  async initialize(): Promise<void> {
    // Create index directory
    await mkdir(path.dirname(this.indexPath), { recursive: true })

    // Load existing index
    await this.loadIndex()

    // Start initial indexing
    await this.indexAll()

    // Start file watcher
    if (this.config.watchMode) {
      this.startWatcher()
    }
  }

  /**
   * Load existing index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const data = await readFile(this.indexPath, 'utf-8')
      const parsed = JSON.parse(data)
      for (const [path, file] of Object.entries(parsed.files || {})) {
        this.index.set(path, file as IndexedFile)
      }
      this.emit('loaded', { fileCount: this.index.size })
    } catch {
      // No existing index, start fresh
      this.index.clear()
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    const data = {
      version: 1,
      projectRoot: this.projectRoot,
      lastUpdated: Date.now(),
      files: Object.fromEntries(this.index),
    }
    await mkdir(path.dirname(this.indexPath), { recursive: true })
    const { writeFile } = await import('fs/promises')
    await writeFile(this.indexPath, JSON.stringify(data))
    this.emit('saved', { fileCount: this.index.size })
  }

  /**
   * Index all files in project
   */
  async indexAll(): Promise<{ indexed: number; skipped: number; errors: number }> {
    if (this.isIndexing) {
      return { indexed: 0, skipped: 0, errors: 0 }
    }

    this.isIndexing = true
    this.emit('start')

    const results = { indexed: 0, skipped: 0, errors: 0 }
    const files = await this.findFiles()

    for (const filePath of files) {
      try {
        const fileStat = await stat(filePath)
        if (fileStat.size > this.config.maxFileSize) {
          results.skipped++
          continue
        }

        const content = await readFile(filePath, 'utf-8')
        const hash = this.hashContent(content)
        const existing = this.index.get(filePath)

        // Skip if unchanged
        if (existing && existing.hash === hash) {
          continue
        }

        const chunks = await this.chunkFile(filePath, content)
        this.index.set(filePath, {
          path: filePath,
          hash,
          lastModified: fileStat.mtimeMs,
          chunks,
        })
        results.indexed++
      } catch (err) {
        results.errors++
        this.emit('error', { path: filePath, error: err })
      }
    }

    await this.saveIndex()
    this.isIndexing = false
    this.emit('complete', results)
    return results
  }

  /**
   * Find all files matching patterns
   */
  private async findFiles(): Promise<string[]> {
    const { glob } = await import('glob')
    const files: string[] = []

    for (const pattern of this.config.includePatterns) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        absolute: true,
        ignore: this.config.excludePatterns,
      })
      files.push(...matches)
    }

    return [...new Set(files)] // Deduplicate
  }

  /**
   * Chunk a file into searchable pieces
   */
  private async chunkFile(filePath: string, content: string): Promise<Chunk[]> {
    const lines = content.split('\n')
    const chunks: Chunk[] = []
    let currentChunk: string[] = []
    let startLine = 0
    let lineNum = 0

    for (const line of lines) {
      currentChunk.push(line)
      lineNum++

      const currentLength = currentChunk.join('\n').length
      if (currentLength >= this.config.chunkSize) {
        chunks.push({
          id: `${filePath}:${startLine}-${lineNum}`,
          filePath,
          content: currentChunk.join('\n'),
          startLine,
          endLine: lineNum - 1,
          hash: this.hashContent(currentChunk.join('\n')),
        })

        // Keep overlap
        const overlapLines = currentChunk.slice(-this.config.chunkOverlap)
        currentChunk = overlapLines
        startLine = lineNum - overlapLines.length
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        id: `${filePath}:${startLine}-${lineNum}`,
        filePath,
        content: currentChunk.join('\n'),
        startLine,
        endLine: lineNum - 1,
        hash: this.hashContent(currentChunk.join('\n')),
      })
    }

    return chunks
  }

  /**
   * Hash content for change detection
   */
  private hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex')
  }

  /**
   * Start file watcher for incremental updates
   */
  private startWatcher(): void {
    this.watcher = watch(
      this.projectRoot,
      { recursive: true },
      (event, filename) => {
        if (!filename) return
        if (this.shouldIgnoreFile(filename)) return

        // Debounce
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer)
        }
        this.debounceTimer = setTimeout(() => {
          this.indexFile(path.join(this.projectRoot, filename))
        }, this.config.debounceMs)
      }
    )
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnoreFile(filename: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
        if (regex.test(filename)) return true
      } else if (filename.includes(pattern)) {
        return true
      }
    }
    return false
  }

  /**
   * Index a single file
   */
  private async indexFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const hash = this.hashContent(content)
      const chunks = await this.chunkFile(filePath, content)

      this.index.set(filePath, {
        path: filePath,
        hash,
        lastModified: Date.now(),
        chunks,
      })

      await this.saveIndex()
      this.emit('indexed', { path: filePath, chunks: chunks.length })
    } catch (err) {
      // File might have been deleted
      if (this.index.has(filePath)) {
        this.index.delete(filePath)
        await this.saveIndex()
      }
    }
  }

  /**
   * Semantic search across indexed files
   */
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const queryLower = query.toLowerCase()

    // Simple text search for now
    // In production, would use vector similarity with embeddings
    for (const [filePath, file] of this.index) {
      for (const chunk of file.chunks) {
        const contentLower = chunk.content.toLowerCase()
        let score = 0

        // Exact match
        if (contentLower.includes(queryLower)) {
          score = 1.0
        }
        // Partial matches
        else {
          const terms = queryLower.split(/\s+/)
          for (const term of terms) {
            if (contentLower.includes(term)) {
              score += 0.2
            }
          }
        }

        if (score > 0) {
          results.push({
            filePath,
            content: chunk.content,
            score,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
          })
        }
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  /**
   * Get index statistics
   */
  getStats(): { files: number; chunks: number; size: number } {
    let chunks = 0
    let size = 0
    for (const file of this.index.values()) {
      chunks += file.chunks.length
      size += file.chunks.reduce((sum, c) => sum + c.content.length, 0)
    }
    return {
      files: this.index.size,
      chunks,
      size,
    }
  }

  /**
   * Stop indexing and cleanup
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
  }
}

// Singleton
let indexerInstance: AutoIndexer | null = null

export function getAutoIndexer(projectRoot?: string): AutoIndexer {
  const root = projectRoot || process.cwd()
  if (!indexerInstance) {
    indexerInstance = new AutoIndexer(root)
  }
  return indexerInstance
}

/**
 * Setup auto-indexing for a project
 */
export async function setupAutoIndexing(
  projectRoot: string,
  config?: Partial<IndexConfig>
): Promise<AutoIndexer> {
  const indexer = new AutoIndexer(projectRoot, config)
  await indexer.initialize()
  return indexer
}
