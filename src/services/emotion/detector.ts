/**
 * Emotion Layer — detects the user's emotional state from their latest message
 * and returns a short system-prompt hint so the LLM can adapt its tone.
 *
 * Two backends:
 *   1. Local heuristic (default, zero cost, ~0.1ms per call)
 *   2. HuggingFace classifier via HF Inference API — when CORTEX_EMOTION_LAYER=hf
 *
 * Controlled by env:
 *   CORTEX_EMOTION_LAYER=1      → enable with local heuristic
 *   CORTEX_EMOTION_LAYER=hf     → enable with HF classifier (adds ~200ms/turn)
 *   CORTEX_EMOTION_MODEL=...    → override HF model (default: j-hartmann/emotion-english-distilroberta-base)
 *   CORTEX_EMOTION_DEBUG=1      → print detected emotion to stderr each turn
 */

export type Emotion =
  | 'frustrated'
  | 'angry'
  | 'confused'
  | 'urgent'
  | 'happy'
  | 'curious'
  | 'sad'
  | 'anxious'
  | 'neutral'

export interface EmotionResult {
  label: Emotion
  confidence: number
  signals: string[]
  hint: string
  backend: 'local' | 'hf'
}

const PROFANITY = [
  'fuck', 'fucking', 'shit', 'wtf', 'damn', 'bs', 'bullshit',
  'stupid', 'garbage', 'crap', 'hell',
]
const FRUSTRATION_PHRASES = [
  "doesn't work", 'does not work', 'not working', 'still broken', 'still not',
  'why is', "why isn't", 'why doesnt', 'why cant', "can't get", 'cant get',
  'keeps failing', 'keep failing', 'failed again', "i'm stuck", 'im stuck',
  'useless', 'make it work', 'just do', 'just fucking',
  'wrong answer', 'thats wrong', "that's wrong", 'nope',
]
const URGENT_WORDS = [
  'urgent', 'asap', 'right now', 'immediately', 'quickly', 'hurry',
  'deadline', 'emergency',
]
const CONFUSED_PHRASES = [
  "don't understand", 'dont understand', "don't get it", 'dont get it',
  'what do you mean', 'what does that mean', "i'm lost", 'im lost',
  'no idea', 'unclear', 'confusing', 'confused', 'explain',
]
const HAPPY_PHRASES = [
  'thanks', 'thank you', 'thx', 'awesome', 'great', 'perfect', 'love it',
  'amazing', 'brilliant', 'nice work', 'nice job', 'well done',
  'worked', 'it works',
]
const CURIOUS_PREFIXES = [
  'how do i', 'how can i', 'how does', 'what is', "what's", 'whats',
  'why does', 'can you explain', 'what are', 'what happens if',
]
const SAD_WORDS = [
  'sad', 'depressed', 'tired', 'exhausted', 'i give up', 'giving up',
  'burnt out', 'burned out',
]
const ANXIOUS_PHRASES = [
  'worried', 'scared', 'nervous', "i'm worried", 'afraid', 'panic',
  'stress', 'stressed',
]

const HINTS: Record<Emotion, string> = {
  frustrated:
    "User is frustrated. Be empathetic in one short line ('got it — fixing now'), then solve directly. No lectures, no filler, no long preambles.",
  angry:
    "User is upset. Acknowledge briefly ('let me fix that'), then lead with the solution. Skip apology chains and qualifiers.",
  confused:
    'User is confused. Explain simply. Use concrete examples. Avoid jargon and abbreviations. If a concept needs a definition, give it in one line.',
  urgent:
    'User is in a hurry. Lead with the fix or answer in the first sentence. Put explanations below, in bullets. Skip ceremony.',
  happy:
    'User is in a good mood. Match their tone — warm and collaborative — but keep output efficient.',
  curious:
    'User is learning. Explain the WHY, not just the WHAT. Include a small example and one "gotcha" to watch for.',
  sad:
    'User sounds low-energy. Be gentle and encouraging. Lead with a tiny win, then the next concrete step.',
  anxious:
    'User is anxious. Be reassuring and concrete. State what is safe, what will happen, and what needs confirmation before any destructive action.',
  neutral: '',
}

function containsAny(haystack: string, needles: readonly string[]): string[] {
  const hits: string[] = []
  for (const n of needles) {
    if (haystack.includes(n)) hits.push(n)
  }
  return hits
}

// Word-boundary version for single tokens (profanity / sad words) so
// "hello" never matches "hell", "classify" never matches "ass", etc.
function containsWord(haystack: string, needles: readonly string[]): string[] {
  const hits: string[] = []
  for (const n of needles) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    if (re.test(haystack)) hits.push(n)
  }
  return hits
}

function capsRatio(s: string): number {
  const letters = s.match(/[A-Za-z]/g) ?? []
  if (letters.length < 4) return 0
  const upper = letters.filter(c => c >= 'A' && c <= 'Z').length
  return upper / letters.length
}

export function detectEmotionLocal(rawText: string): EmotionResult {
  const text = (rawText ?? '').trim()
  if (!text) {
    return { label: 'neutral', confidence: 0, signals: [], hint: '', backend: 'local' }
  }

  const lower = text.toLowerCase()
  const signals: string[] = []
  const scores: Partial<Record<Emotion, number>> = {}
  const add = (e: Emotion, w: number, sig: string) => {
    scores[e] = (scores[e] ?? 0) + w
    signals.push(sig)
  }

  const profHits = containsWord(lower, PROFANITY)
  if (profHits.length > 0) {
    const angryBump = profHits.some(p =>
      ['fuck', 'fucking', 'shit', 'bullshit'].includes(p),
    )
    add(angryBump ? 'angry' : 'frustrated', 3, `profanity:${profHits[0]}`)
  }
  const caps = capsRatio(text)
  if (caps > 0.6 && text.length > 6) add('angry', 2, `caps:${caps.toFixed(2)}`)
  else if (caps > 0.4 && text.length > 6) add('frustrated', 1, `caps:${caps.toFixed(2)}`)
  const bangs = (text.match(/!/g) ?? []).length
  if (bangs >= 3) add('frustrated', 1, `bangs:${bangs}`)
  if (/\?{2,}/.test(text)) add('frustrated', 1, 'multi-question-mark')

  const frHits = containsAny(lower, FRUSTRATION_PHRASES)
  if (frHits.length > 0) add('frustrated', 2, `frustration:${frHits[0]}`)
  const urgHits = containsAny(lower, URGENT_WORDS)
  if (urgHits.length > 0) add('urgent', 2, `urgent:${urgHits[0]}`)
  const confHits = containsAny(lower, CONFUSED_PHRASES)
  if (confHits.length > 0) add('confused', 2, `confused:${confHits[0]}`)
  const hapHits = containsAny(lower, HAPPY_PHRASES)
  if (hapHits.length > 0) add('happy', 2, `happy:${hapHits[0]}`)
  for (const p of CURIOUS_PREFIXES) {
    if (lower.startsWith(p)) { add('curious', 1, `curious:${p}`); break }
  }
  const sadHits = containsWord(lower, SAD_WORDS)
  if (sadHits.length > 0) add('sad', 2, `sad:${sadHits[0]}`)
  const anxHits = containsAny(lower, ANXIOUS_PHRASES)
  if (anxHits.length > 0) add('anxious', 1, `anxious:${anxHits[0]}`)

  let top: Emotion = 'neutral'
  let topScore = 0
  for (const [e, s] of Object.entries(scores) as [Emotion, number][]) {
    if (s > topScore) { top = e; topScore = s }
  }
  const confidence = Math.min(1, topScore / 4)

  return { label: top, confidence, signals, hint: HINTS[top], backend: 'local' }
}

export async function detectEmotionHF(text: string): Promise<EmotionResult> {
  const token = process.env.HF_TOKEN
  if (!token) return detectEmotionLocal(text)

  const model =
    process.env.CORTEX_EMOTION_MODEL ??
    'j-hartmann/emotion-english-distilroberta-base'
  const url = `https://api-inference.huggingface.co/models/${model}`

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text.slice(0, 512) }),
      signal: controller.signal,
    })
    clearTimeout(t)
    if (!res.ok) return detectEmotionLocal(text)
    const data = (await res.json()) as unknown
    const arr = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data
    if (!Array.isArray(arr) || arr.length === 0) return detectEmotionLocal(text)
    const top = (arr as Array<{ label?: string; score?: number }>).reduce(
      (best, cur) => ((cur.score ?? 0) > (best.score ?? 0) ? cur : best),
      arr[0] as { label?: string; score?: number },
    )
    const map: Record<string, Emotion> = {
      anger: 'angry',
      disgust: 'frustrated',
      fear: 'anxious',
      joy: 'happy',
      neutral: 'neutral',
      sadness: 'sad',
      surprise: 'curious',
    }
    const label = map[(top.label ?? 'neutral').toLowerCase()] ?? 'neutral'
    return {
      label,
      confidence: top.score ?? 0,
      signals: [`hf:${top.label}:${(top.score ?? 0).toFixed(2)}`],
      hint: HINTS[label],
      backend: 'hf',
    }
  } catch {
    return detectEmotionLocal(text)
  }
}

export function isEmotionLayerEnabled(): 'off' | 'local' | 'hf' {
  const v = (process.env.CORTEX_EMOTION_LAYER ?? '').toLowerCase()
  if (v === 'hf') return 'hf'
  if (v === '1' || v === 'true' || v === 'on' || v === 'local') return 'local'
  return 'off'
}

/**
 * Extracts the latest human-authored text from a messages array.
 */
export function extractLatestUserText(messages: unknown[]): string {
  if (!Array.isArray(messages)) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as {
      type?: string
      isMeta?: boolean
      message?: { role?: string; content?: unknown }
    }
    if (!m || m.isMeta) continue
    if (m.type !== 'user') continue
    const content = m.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      const texts: string[] = []
      for (const block of content) {
        if (
          block &&
          typeof block === 'object' &&
          (block as { type?: string }).type === 'text' &&
          typeof (block as { text?: string }).text === 'string'
        ) {
          texts.push((block as { text: string }).text)
        }
      }
      if (texts.length > 0) return texts.join('\n')
    }
  }
  return ''
}
