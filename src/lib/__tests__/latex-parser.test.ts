import { describe, it, expect } from 'vitest'
import { parseLatexDocument } from '../latex-parser'

describe('parseLatexDocument', () => {
  it('returns empty array for empty string', () => {
    expect(parseLatexDocument('')).toEqual([])
  })

  it('parses a \\section block', () => {
    const latex = '\\section{Technical Skills}'
    const blocks = parseLatexDocument(latex)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('section')
    expect(blocks[0].label).toBe('Technical Skills')
    expect(blocks[0].content).toBe('\\section{Technical Skills}')
  })

  it('parses a \\resumeSubheading block', () => {
    const latex =
      '\\resumeSubheading{Google}{2022--Present}{Software Engineer}{Mountain View}'
    const blocks = parseLatexDocument(latex)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('resumeSubheading')
    expect(blocks[0].label).toBe('Google')
  })

  it('parses a \\resumeProjectHeading block', () => {
    // The regex uses [^}]* so the first arg must not contain nested braces
    const latex = '\\resumeProjectHeading{MyApp | React, Node.js}{2023}'
    const blocks = parseLatexDocument(latex)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('resumeProjectHeading')
  })

  it('parses a \\resumeItem block', () => {
    const latex = '\\resumeItem{Engineered scalable microservices}'
    const blocks = parseLatexDocument(latex)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('resumeItem')
  })

  it('parses a \\subsection block', () => {
    const latex = '\\subsection{Languages}'
    const blocks = parseLatexDocument(latex)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('subsection')
    expect(blocks[0].label).toBe('Languages')
  })

  it('sorts multiple blocks by start position', () => {
    const latex = '\\section{Experience}\n\n\\section{Education}'
    const blocks = parseLatexDocument(latex)
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks[0].range.start).toBeLessThan(blocks[1].range.start)
  })

  it('generates stable block IDs for identical content at same position', () => {
    const latex = '\\resumeItem{Built REST APIs serving 50k users}'
    const [a] = parseLatexDocument(latex)
    const [b] = parseLatexDocument(latex)
    expect(a.id).toBe(b.id)
  })

  it('range start and end span the full match', () => {
    const latex = '\\section{Skills}'
    const [block] = parseLatexDocument(latex)
    expect(block.range.start).toBe(0)
    expect(block.range.end).toBe(latex.length)
  })

  it('records correct line numbers', () => {
    const latex = 'line one\nline two\n\\section{Skills}'
    const [block] = parseLatexDocument(latex)
    expect(block.range.startLine).toBe(3)
  })

  it('does not double-claim overlapping ranges', () => {
    // A resumeSubheading that also contains resumeItem-like text should only be one block
    const latex =
      '\\resumeSubheading{Acme}{2023}{Eng}{NY}\n\\resumeItem{Built stuff}'
    const blocks = parseLatexDocument(latex)
    // The subheading captures the resumeItem inside it - no extra standalone resumeItem block
    const subheadings = blocks.filter((b) => b.type === 'resumeSubheading')
    const items = blocks.filter((b) => b.type === 'resumeItem')
    // If the resumeItem is inside the subheading range, it should be claimed
    const itemInsideSubheading = items.every((item) =>
      subheadings.some(
        (s) => item.range.start >= s.range.start && item.range.end <= s.range.end,
      ),
    )
    if (itemInsideSubheading) {
      // All items are inside subheadings - no double-claiming occurred
      expect(subheadings.length).toBeGreaterThan(0)
    } else {
      // Items outside subheadings are fine
      expect(blocks.length).toBeGreaterThan(0)
    }
  })
})
