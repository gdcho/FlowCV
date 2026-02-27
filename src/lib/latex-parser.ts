import type { LaTeXBlock, LaTeXBlockType, TextRange } from '@/types/latex'

function makeBlockId(content: string, start: number): string {
  let hash = start
  const sample = content.slice(0, 64)
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash * 31) + sample.charCodeAt(i)) >>> 0
  }
  return `block_${hash.toString(16)}`
}

function getRange(fullText: string, start: number, end: number): TextRange {
  const before = fullText.slice(0, start)
  const startLine = (before.match(/\n/g) ?? []).length + 1
  const snippet = fullText.slice(start, end)
  const endLine = startLine + (snippet.match(/\n/g) ?? []).length
  return { start, end, startLine, endLine }
}

// Maximum single block size to prevent catastrophic regex backtracking
const MAX_BLOCK_CHARS = 8000

export function parseLatexDocument(latex: string): LaTeXBlock[] {
  const blocks: LaTeXBlock[] = []
  // Track which character ranges have been claimed
  const claimed: Array<[number, number]> = []

  function isClaimed(start: number, end: number): boolean {
    return claimed.some(([s, e]) => start < e && end > s)
  }

  function claim(start: number, end: number): void {
    claimed.push([start, end])
  }

  const patterns: Array<{
    regex: RegExp
    type: LaTeXBlockType
    labelFn: (match: RegExpExecArray) => string
    metaFn?: (match: RegExpExecArray) => LaTeXBlock['metadata']
  }> = [
    // \resumeSubheading{Company}{Dates}{Title}{Location} ... (greedy to next similar cmd or section)
    {
      regex:
        /\\resumeSubheading\{[^}]*\}\{[^}]*\}\{[^}]*\}\{[^}]*\}[\s\S]{0,4000}?(?=\\resumeSubheading|\\resumeProjectHeading|\\end\{itemize\}|\\section|$)/g,
      type: 'resumeSubheading',
      labelFn: (m) => {
        const first = m[0].match(/\\resumeSubheading\{([^}]*)\}/)
        return first ? first[1] : 'Experience'
      },
    },
    // \resumeProjectHeading{\textbf{Name} | Stack}{Dates} ...
    {
      regex:
        /\\resumeProjectHeading\{[^}]*\}\{[^}]*\}[\s\S]{0,2000}?(?=\\resumeProjectHeading|\\resumeSubheading|\\end\{itemize\}|\\section|$)/g,
      type: 'resumeProjectHeading',
      labelFn: (m) => {
        const inner = m[0].match(/\\textbf\{([^}]*)\}/)
        return inner ? inner[1] : 'Project'
      },
    },
    // \resumeItem{...} standalone item
    {
      regex: /\\resumeItem\{(?:[^{}]|\{[^{}]*\})*\}/g,
      type: 'resumeItem',
      labelFn: () => 'Item',
    },
    // \section{...}
    {
      regex: /\\section\{([^}]+)\}/g,
      type: 'section',
      labelFn: (m) => m[1],
    },
    // \subsection{...}
    {
      regex: /\\subsection\{([^}]+)\}/g,
      type: 'subsection',
      labelFn: (m) => m[1],
    },
    // Generic \begin{env}...\end{env}
    {
      regex: /\\begin\{(\w+)\}[\s\S]{0,4000}?\\end\{\1\}/g,
      type: 'environment',
      labelFn: (m) => m[1],
      metaFn: (m) => ({ envName: m[1] }),
    },
  ]

  for (const { regex, type, labelFn, metaFn } of patterns) {
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(latex)) !== null) {
      const start = match.index
      const end = start + match[0].length

      if (end - start > MAX_BLOCK_CHARS) continue
      if (isClaimed(start, end)) continue
      claim(start, end)

      blocks.push({
        id: makeBlockId(match[0], start),
        type,
        label: labelFn(match),
        content: match[0],
        range: getRange(latex, start, end),
        metadata: metaFn?.(match),
      })
    }
  }

  return blocks.sort((a, b) => a.range.start - b.range.start)
}
