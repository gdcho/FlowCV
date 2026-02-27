import type { JobContext } from '@/types/job'
import { extractKeywords } from './keywords'

export function extractIndeedJD(): JobContext | null {
  const titleEl =
    document.querySelector<HTMLElement>('[data-jk] h1') ??
    document.querySelector<HTMLElement>('h1.jobsearch-JobInfoHeader-title') ??
    document.querySelector<HTMLElement>('h1[class*="jobTitle"]')

  const companyEl =
    document.querySelector<HTMLElement>('[data-company-name]') ??
    document.querySelector<HTMLElement>('.jobsearch-InlineCompanyRating-companyName') ??
    document.querySelector<HTMLElement>('[class*="companyName"]')

  const descriptionEl =
    document.querySelector<HTMLElement>('#jobDescriptionText') ??
    document.querySelector<HTMLElement>('.jobsearch-jobDescriptionText') ??
    document.querySelector<HTMLElement>('[class*="jobDescription"]')

  if (!descriptionEl) return null

  const fullText = descriptionEl.innerText?.trim() ?? ''
  if (fullText.length < 100) return null

  return {
    fullText,
    title: titleEl?.innerText?.trim() ?? document.title,
    company: companyEl?.innerText?.trim() ?? null,
    url: window.location.href,
    keywords: extractKeywords(fullText),
    scrapedAt: Date.now(),
  }
}
