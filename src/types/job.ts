export interface JobContext {
  fullText: string
  title: string | null
  company: string | null
  url: string
  keywords: string[]
  summary?: string | null          // "About the role" / first paragraph
  qualifications?: string[]        // parsed requirements/qualifications bullets
  responsibilities?: string[]      // parsed responsibilities bullets
  seniority?: string | null        // e.g. "Senior", "Staff", "Lead", "Principal"
  scrapedAt: number
}
