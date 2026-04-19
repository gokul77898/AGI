/**
 * Persistent Memory - Cross-session context retention for CORTEX
 *
 * Enables the AI to remember user preferences, project context, and important
 * decisions across conversation sessions. Memory is stored in structured files
 * and loaded intelligently based on context relevance.
 */

import { EventEmitter } from 'events'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'
import { createHash } from 'crypto'

export type MemoryType =
  | 'user_preference'
  | 'project_context'
  | 'decision'
  | 'learning'
  | 'conversation_summary'
  | 'fact'

export interface Memory {
  id: string
  type: MemoryType
  content: string
  metadata: {
    createdAt: number
    updatedAt: number
    importance: number // 0-1, affects retrieval priority
    tags: string[]
    source: 'explicit' | 'extracted' | 'inferred'
  }
  context?: {
    project?: string
    conversationId?: string
    filePath?: string
    topic?: string
  }
}

export interface MemoryQuery {
  type?: MemoryType
  tags?: string[]
  search?: string
  project?: string
  importance?: { min: number; max: number }
  limit?: number
}

export interface MemoryConfig {
  enabled: boolean
  maxMemories: number
  maxAge: number // milliseconds
  autoExtract: boolean
  storagePath?: string
}

const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  maxMemories: 1000,
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  autoExtract: true,
}

export class PersistentMemory extends EventEmitter {
  private config: MemoryConfig
  private memoryPath: string
  private memories: Map<string, Memory> = new Map()
  private isLoaded: boolean = false

  constructor(projectRoot?: string, config: Partial<MemoryConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.memoryPath = config.storagePath || path.join(
      homedir(),
      '.cortex',
      'projects',
      projectRoot ? this.hashPath(projectRoot) : 'global',
      'persistent-memory.json'
    )
  }

  /**
   * Hash path for unique project storage
   */
  private hashPath(p: string): string {
    return createHash('md5').update(p).digest('hex').slice(0, 12)
  }

  /**
   * Initialize and load memories
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) return

    await mkdir(path.dirname(this.memoryPath), { recursive: true })
    await this.load()
    this.isLoaded = true
  }

  /**
   * Load memories from storage
   */
  private async load(): Promise<void> {
    try {
      const data = await readFile(this.memoryPath, 'utf-8')
      const parsed = JSON.parse(data)
      const memories = parsed.memories || []

      for (const mem of memories) {
        this.memories.set(mem.id, mem)
      }

      this.emit('loaded', { count: this.memories.size })
    } catch {
      // No existing memories
      this.memories.clear()
    }
  }

  /**
   * Save memories to storage
   */
  private async save(): Promise<void> {
    const data = {
      version: 1,
      lastUpdated: Date.now(),
      memories: Array.from(this.memories.values()),
    }
    await writeFile(this.memoryPath, JSON.stringify(data, null, 2))
    this.emit('saved', { count: this.memories.size })
  }

  /**
   * Add a new memory
   */
  async remember(
    content: string,
    type: MemoryType = 'fact',
    options: {
      importance?: number
      tags?: string[]
      source?: 'explicit' | 'extracted' | 'inferred'
      context?: Memory['context']
    } = {}
  ): Promise<Memory> {
    const memory: Memory = {
      id: this.generateId(),
      type,
      content,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        importance: options.importance ?? 0.5,
        tags: options.tags || [],
        source: options.source || 'explicit',
      },
      context: options.context,
    }

    this.memories.set(memory.id, memory)
    await this.save()
    this.emit('remembered', memory)

    return memory
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Query memories
   */
  async recall(query: MemoryQuery = {}): Promise<Memory[]> {
    let results = Array.from(this.memories.values())

    // Filter by type
    if (query.type) {
      results = results.filter(m => m.type === query.type)
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(m =>
        query.tags!.some(tag => m.metadata.tags.includes(tag))
      )
    }

    // Filter by importance
    if (query.importance) {
      results = results.filter(
        m =>
          m.metadata.importance >= query.importance!.min &&
          m.metadata.importance <= query.importance!.max
      )
    }

    // Filter by project context
    if (query.project) {
      results = results.filter(m => m.context?.project === query.project)
    }

    // Text search
    if (query.search) {
      const searchLower = query.search.toLowerCase()
      results = results.filter(m =>
        m.content.toLowerCase().includes(searchLower) ||
        m.metadata.tags.some(t => t.toLowerCase().includes(searchLower))
      )
    }

    // Sort by importance and recency
    results.sort((a, b) => {
      const importanceDiff = b.metadata.importance - a.metadata.importance
      if (importanceDiff !== 0) return importanceDiff
      return b.metadata.updatedAt - a.metadata.updatedAt
    })

    // Limit results
    if (query.limit) {
      results = results.slice(0, query.limit)
    }

    return results
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(id: string): Promise<Memory | null> {
    return this.memories.get(id) || null
  }

  /**
   * Update an existing memory
   */
  async updateMemory(
    id: string,
    updates: Partial<Pick<Memory, 'content' | 'metadata' | 'context'>>
  ): Promise<Memory | null> {
    const memory = this.memories.get(id)
    if (!memory) return null

    if (updates.content) memory.content = updates.content
    if (updates.metadata) {
      memory.metadata = { ...memory.metadata, ...updates.metadata }
    }
    if (updates.context) memory.context = { ...memory.context, ...updates.context }
    memory.metadata.updatedAt = Date.now()

    await this.save()
    this.emit('updated', memory)
    return memory
  }

  /**
   * Delete a memory
   */
  async forget(id: string): Promise<boolean> {
    const existed = this.memories.delete(id)
    if (existed) {
      await this.save()
      this.emit('forgotten', id)
    }
    return existed
  }

  /**
   * Clear all memories (with confirmation)
   */
  async clearAll(): Promise<void> {
    this.memories.clear()
    await this.save()
    this.emit('cleared')
  }

  /**
   * Extract and save important context from conversation
   */
  async extractFromConversation(
    conversation: { messages: Array<{ role: string; content: string }> },
    project?: string
  ): Promise<Memory[]> {
    if (!this.config.autoExtract) return []

    const extracted: Memory[] = []

    // Extract user preferences mentioned
    const preferencePatterns = [
      /I prefer (.+?)(?:\.|,|$)/gi,
      /I (?:always|never) (.+?)(?:\.|,|$)/gi,
      /Please (?:always|never) (.+?)(?:\.|,|$)/gi,
      /Make sure to (.+?)(?:\.|,|$)/gi,
    ]

    for (const msg of conversation.messages) {
      if (msg.role !== 'user') continue

      for (const pattern of preferencePatterns) {
        const matches = msg.content.matchAll(pattern)
        for (const match of matches) {
          const mem = await this.remember(match[1], 'user_preference', {
            importance: 0.7,
            source: 'extracted',
            context: { project },
          })
          extracted.push(mem)
        }
      }
    }

    // Store conversation summary
    const summary = this.summarizeConversation(conversation)
    if (summary) {
      const mem = await this.remember(summary, 'conversation_summary', {
        importance: 0.5,
        source: 'extracted',
        context: { project },
      })
      extracted.push(mem)
    }

    return extracted
  }

  /**
   * Summarize conversation for memory
   */
  private summarizeConversation(
    conversation: { messages: Array<{ role: string; content: string }> }
  ): string {
    const userMessages = conversation.messages
      .filter(m => m.role === 'user')
      .map(m => m.content.slice(0, 100))
      .join(' | ')

    return `Topics discussed: ${userMessages.slice(0, 500)}`
  }

  /**
   * Get relevant memories for a query (for context loading)
   */
  async getRelevantMemories(context: string, limit: number = 5): Promise<Memory[]> {
    return this.recall({
      search: context,
      limit,
    })
  }

  /**
   * Get memory statistics
   */
  getStats(): { total: number; byType: Record<MemoryType, number> } {
    const byType: Record<MemoryType, number> = {
      user_preference: 0,
      project_context: 0,
      decision: 0,
      learning: 0,
      conversation_summary: 0,
      fact: 0,
    }

    for (const mem of this.memories.values()) {
      byType[mem.type]++
    }

    return {
      total: this.memories.size,
      byType,
    }
  }

  /**
   * Cleanup old memories
   */
  async cleanup(): Promise<{ removed: number }> {
    const now = Date.now()
    let removed = 0

    for (const [id, mem] of this.memories) {
      const age = now - mem.metadata.updatedAt
      if (age > this.config.maxAge && mem.metadata.importance < 0.7) {
        this.memories.delete(id)
        removed++
      }
    }

    if (removed > 0) {
      await this.save()
      this.emit('cleanup', { removed })
    }

    return { removed }
  }
}

// Singleton
let memoryInstance: PersistentMemory | null = null

export function getPersistentMemory(projectRoot?: string): PersistentMemory {
  if (!memoryInstance) {
    memoryInstance = new PersistentMemory(projectRoot)
  }
  return memoryInstance
}

/**
 * Setup persistent memory
 */
export async function setupPersistentMemory(
  projectRoot?: string,
  config?: Partial<MemoryConfig>
): Promise<PersistentMemory> {
  const memory = new PersistentMemory(projectRoot, config)
  await memory.initialize()
  return memory
}
