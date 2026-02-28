import { describe, it, expect } from 'vitest'
import { validateAIOutput } from '../safety'
import type { ProposedChange } from '@/types/ai'

function makeChange(overrides: Partial<ProposedChange> = {}): ProposedChange {
  return {
    blockId: 'block_test',
    original: '\\resumeItem{Worked on backend services}',
    modified: '\\resumeItem{Engineered RESTful API services serving 50k+ daily active users}',
    reasoning: 'Added metrics and stronger verb',
    block: null,
    ...overrides,
  }
}

describe('validateAIOutput', () => {
  it('passes a valid change', () => {
    expect(validateAIOutput(makeChange())).toBe(true)
  })

  it('fails when modified has unmatched opening brace', () => {
    expect(
      validateAIOutput(makeChange({ modified: '\\resumeItem{unclosed brace' })),
    ).toBe(false)
  })

  it('fails when modified has extra closing brace', () => {
    expect(
      validateAIOutput(makeChange({ modified: '\\resumeItem{text}}' })),
    ).toBe(false)
  })

  it('ignores braces inside LaTeX comments', () => {
    // comment brace should not affect balance
    const modified = '\\resumeItem{Built APIs} % { ignored }'
    // resumeItem opens { closes } = balanced (comment part stripped)
    expect(validateAIOutput(makeChange({ modified }))).toBe(true)
  })

  it('fails when modified introduces an unknown LaTeX command', () => {
    expect(
      validateAIOutput(
        makeChange({
          original: '\\resumeItem{text}',
          modified: '\\resumeItem{\\customMacro{text}}',
        }),
      ),
    ).toBe(false)
  })

  it('passes when modified uses a command already present in original', () => {
    expect(
      validateAIOutput(
        makeChange({
          original: '\\resumeItem{\\myCmd{text}}',
          modified: '\\resumeItem{\\myCmd{updated text with more detail}}',
        }),
      ),
    ).toBe(true)
  })

  it('passes when modified uses an always-allowed command (\\textbf)', () => {
    expect(
      validateAIOutput(
        makeChange({
          original: '\\resumeItem{plain text}',
          modified: '\\resumeItem{\\textbf{strong} plain text with 50k users}',
        }),
      ),
    ).toBe(true)
  })

  it('passes when modified uses \\href which is always allowed', () => {
    expect(
      validateAIOutput(
        makeChange({
          original: '\\resumeItem{See project}',
          modified: '\\resumeItem{See \\href{https://example.com}{project} serving 10k users}',
        }),
      ),
    ).toBe(true)
  })

  it('fails when modified is less than 30% the length of original', () => {
    expect(
      validateAIOutput(
        makeChange({
          original: '\\resumeItem{' + 'x'.repeat(100) + '}',
          modified: '\\resumeItem{x}',
        }),
      ),
    ).toBe(false)
  })

  it('fails when original is blank/whitespace', () => {
    expect(validateAIOutput(makeChange({ original: '   ' }))).toBe(false)
  })

  it('fails when original is empty string', () => {
    expect(validateAIOutput(makeChange({ original: '' }))).toBe(false)
  })
})
