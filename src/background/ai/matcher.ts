import type { LaTeXBlock } from '@/types/latex'
import type { JobContext } from '@/types/job'

// Block types that are worth modifying (skip section headers and preambles)
const MODIFIABLE_TYPES = new Set([
  'resumeItem',
  'resumeSubheading',
  'resumeProjectHeading',
  'environment',
])

// Maximum blocks to send to the AI at once to keep prompt size manageable
const MAX_BLOCKS = 12

export function matchBlocksToKeywords(
  blocks: LaTeXBlock[],
  jd: JobContext
): LaTeXBlock[] {
  const modifiable = blocks.filter((b) => MODIFIABLE_TYPES.has(b.type))

  if (modifiable.length <= MAX_BLOCKS) return modifiable

  // Score each block by keyword overlap with the JD
  const keywords = jd.keywords.map((k) => k.toLowerCase())
  const fullText = jd.fullText.toLowerCase()

  const scored = modifiable.map((block) => {
    const content = block.content.toLowerCase()
    let score = 0

    // Direct keyword match in block content
    for (const kw of keywords) {
      if (content.includes(kw)) score += 2
    }

    // Check for skill-adjacent terms from the JD
    const words = content.match(/\b\w{4,}\b/g) ?? []
    for (const word of words) {
      if (fullText.includes(word)) score += 0.5
    }

    return { block, score }
  })

  // Return top blocks by score, maintaining document order
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_BLOCKS)
    .sort((a, b) => a.block.range.start - b.block.range.start)
    .map((s) => s.block)
}
