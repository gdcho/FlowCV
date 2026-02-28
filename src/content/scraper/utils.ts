/**
 * Pure utility functions for JD text cleaning and section parsing.
 * Exported separately so they can be unit-tested without Chrome runtime side-effects.
 */

const SUMMARY_RE =
  /^(about (the |this )?(role|job|position|opportunity|company|us)|role (overview|summary)|overview|position (summary|overview)|job (summary|overview)|the role|what (is|this) (the )?role|who we are|our (mission|vision|team))/i
const QUAL_RE =
  /^(requirements?|qualifications?|what (you('ll)?|we'?re? looking for|you bring|you have|you need)|must.?have|required|minimum qualifications?|basic qualifications?|about you|who you are|you are|you will have|you should have|preferred|nice.to.have|bonus)/i
const RESP_RE =
  /^(responsibilities|what you'?ll do|key responsibilities|your role|what you'?ll be doing|the work|day.to.day|what we('re| are) looking|your impact|you will|you'?ll|in this role)/i
const SENIORITY_RE =
  /\b(intern|junior|associate|mid.?level|senior|staff|principal|lead|director|manager|head of|vp|vice president|distinguished|fellow)\b/i

export function cleanJDText(raw: string): string {
  return (
    raw
      .replace(/^\s*(show more|see more|show less|read more|expand)\s*$/gim, '')
      .replace(
        /^\s*\d[\d,]*\s+(applicants?|people clicked apply|people applied|views?).*$/gim,
        '',
      )
      .replace(/^\s*over\s+\d[\d,]*\s+applicants?\s*$/gim, '')
      .replace(
        /^\s*(save|easy apply|apply now?|apply|report this job|report|share|follow|connect|message|send inmail)\s*$/gim,
        '',
      )
      .replace(/^\s*posted\s+\d+\s+\w+\s+ago\s*$/gim, '')
      .replace(
        /^\s*(promoted|actively recruiting|actively hiring|be an early applicant|actively reviewed)\s*$/gim,
        '',
      )
      .replace(/^\s*\d+\s+of\s+\d+\s+skills?\s+match.*$/gim, '')
      .replace(/^\s*add\s+(a\s+)?skills?\s*$/gim, '')
      .replace(/^[•·◦▪▸►●○‣⁃]\s*/gm, '- ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

export function extractBullets(lines: string[]): string[] {
  return lines
    .filter((l) => /^(-|\d+\.|•)/.test(l.trim()) || l.trim().length > 15)
    .map((l) =>
      l
        .replace(/^[-•]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .trim(),
    )
    .filter((l) => l.length > 10 && l.length < 200)
}

export function parseSections(text: string): {
  summary: string | null
  qualifications: string[]
  responsibilities: string[]
  seniority: string | null
} {
  const lines = text.split('\n')
  let currentSection: 'summary' | 'qualifications' | 'responsibilities' | 'other' = 'other'
  const summaryLines: string[] = []
  const qualLines: string[] = []
  const respLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.length < 90) {
      if (SUMMARY_RE.test(trimmed)) {
        currentSection = 'summary'
        continue
      }
      if (QUAL_RE.test(trimmed)) {
        currentSection = 'qualifications'
        continue
      }
      if (RESP_RE.test(trimmed)) {
        currentSection = 'responsibilities'
        continue
      }
    }

    if (currentSection === 'summary' && summaryLines.length < 8) summaryLines.push(trimmed)
    else if (currentSection === 'qualifications') qualLines.push(trimmed)
    else if (currentSection === 'responsibilities') respLines.push(trimmed)
  }

  let summary: string | null = null
  if (summaryLines.length > 0) {
    summary = summaryLines.join(' ').replace(/\s+/g, ' ').slice(0, 280).trimEnd()
    if (summary.length === 280) summary += '…'
  } else {
    const first = lines.find((l) => l.trim().length >= 80)
    if (first) {
      summary = first.trim().slice(0, 280)
      if (first.trim().length > 280) summary += '…'
    }
  }

  const seniorityMatch = text.slice(0, 600).match(SENIORITY_RE)
  const seniority = seniorityMatch
    ? seniorityMatch[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  return {
    summary,
    qualifications: extractBullets(qualLines).slice(0, 8),
    responsibilities: extractBullets(respLines).slice(0, 6),
    seniority,
  }
}
