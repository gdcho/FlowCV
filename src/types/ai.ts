import type { LaTeXBlock } from './latex'
import type { JobContext } from './job'

export interface ProposedChange {
  blockId: string
  original: string
  modified: string
  reasoning: string
  block: LaTeXBlock | null
}

export interface AIRequest {
  blocks: LaTeXBlock[]
  jd: JobContext
  apiKey: string
}

export interface AIStreamChunk {
  type: 'chunk' | 'complete' | 'error'
  text?: string
  changes?: ProposedChange[]
  error?: string
}
