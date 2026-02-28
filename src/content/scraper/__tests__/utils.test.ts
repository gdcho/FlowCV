import { describe, it, expect } from 'vitest'
import { cleanJDText, parseSections } from '../utils'

describe('cleanJDText', () => {
  it('removes "Show more" lines', () => {
    const text = 'About the role\nShow more\nwe build great software'
    expect(cleanJDText(text)).not.toMatch(/show more/i)
  })

  it('removes applicant count lines', () => {
    const text = 'Job description\n1,234 applicants\nwe are hiring'
    expect(cleanJDText(text)).not.toMatch(/\d+ applicants/i)
  })

  it('removes "over N applicants" lines', () => {
    const text = 'Great role\nOver 200 applicants\nApply today'
    expect(cleanJDText(text)).not.toMatch(/over \d+ applicants/i)
  })

  it('removes action button text (Easy Apply, Save)', () => {
    const text = 'Great role\nEasy Apply\nSave\nmore details here'
    const cleaned = cleanJDText(text)
    expect(cleaned).not.toMatch(/^Easy Apply$/im)
    expect(cleaned).not.toMatch(/^Save$/im)
  })

  it('removes "Posted X days ago" lines', () => {
    const text = 'Software Engineer\nPosted 3 days ago\nAbout the role'
    expect(cleanJDText(text)).not.toMatch(/posted \d+ \w+ ago/i)
  })

  it('normalizes fancy bullet characters to dashes', () => {
    const text = '• Python experience\n• React skills\n▸ TypeScript required'
    const cleaned = cleanJDText(text)
    expect(cleaned).toContain('- Python experience')
    expect(cleaned).toContain('- React skills')
    expect(cleaned).toContain('- TypeScript required')
  })

  it('collapses 3+ consecutive blank lines to at most 2', () => {
    const text = 'line one\n\n\n\n\nline two'
    const cleaned = cleanJDText(text)
    expect(cleaned).not.toMatch(/\n{3,}/)
  })

  it('trims leading and trailing whitespace', () => {
    const text = '  \n  some job description  \n  '
    expect(cleanJDText(text)).toBe('some job description')
  })
})

describe('parseSections', () => {
  it('extracts summary from "About the role" section', () => {
    const text =
      'About the role\nWe are building the future of AI-powered productivity tools for enterprise customers.\nRequirements\n- Python'
    const { summary } = parseSections(text)
    expect(summary).toBeTruthy()
    expect(summary).toContain('AI-powered')
  })

  it('extracts qualifications bullets', () => {
    const text =
      'Requirements\n- 3+ years of Python experience\n- Strong knowledge of SQL\n- Experience with cloud platforms'
    const { qualifications } = parseSections(text)
    expect(qualifications.length).toBeGreaterThan(0)
    expect(qualifications.some((q) => q.includes('Python'))).toBe(true)
  })

  it('extracts responsibilities bullets', () => {
    const text =
      'Responsibilities\n- Design and build scalable APIs\n- Mentor junior engineers\n- Lead architecture reviews'
    const { responsibilities } = parseSections(text)
    expect(responsibilities.length).toBeGreaterThan(0)
    expect(responsibilities.some((r) => r.includes('APIs'))).toBe(true)
  })

  it('detects Senior seniority level', () => {
    const { seniority } = parseSections('Senior Software Engineer at Acme Corp')
    expect(seniority).toBe('Senior')
  })

  it('detects Staff seniority level', () => {
    const { seniority } = parseSections('Staff Engineer, Infrastructure Team')
    expect(seniority).toBe('Staff')
  })

  it('detects mid-level seniority and normalizes hyphen to space', () => {
    const { seniority } = parseSections('Mid-level engineer role, 3+ years required')
    expect(seniority).toBe('Mid Level')
  })

  it('returns null seniority when no level is mentioned', () => {
    const { seniority } = parseSections('Software Engineer working on distributed systems')
    expect(seniority).toBeNull()
  })

  it('caps qualifications at 8', () => {
    const quals = Array.from(
      { length: 20 },
      (_, i) => `- Requirement number ${i + 1} with sufficient detail here`,
    ).join('\n')
    const { qualifications } = parseSections(`Requirements\n${quals}`)
    expect(qualifications.length).toBeLessThanOrEqual(8)
  })

  it('caps responsibilities at 6', () => {
    const resps = Array.from(
      { length: 15 },
      (_, i) => `- Responsibility number ${i + 1} with enough detail to pass filter`,
    ).join('\n')
    const { responsibilities } = parseSections(`Responsibilities\n${resps}`)
    expect(responsibilities.length).toBeLessThanOrEqual(6)
  })

  it('falls back to first long paragraph when no summary section heading found', () => {
    const text =
      'We are an early-stage startup building next-generation infrastructure tooling for developer productivity at scale across cloud environments.'
    const { summary } = parseSections(text)
    expect(summary).toBeTruthy()
    expect(summary!.length).toBeGreaterThan(10)
  })

  it('truncates long summary at 280 chars with ellipsis', () => {
    const longLine = 'About the role\n' + 'x'.repeat(300)
    const { summary } = parseSections(longLine)
    expect(summary).toBeTruthy()
    expect(summary!.length).toBeLessThanOrEqual(281) // 280 + '…'
    expect(summary!.endsWith('…')).toBe(true)
  })
})
