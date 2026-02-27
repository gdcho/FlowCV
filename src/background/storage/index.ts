import { STORAGE_KEYS } from './schema'
import type { AppSettings } from '@/types/storage'
import type { JobContext } from '@/types/job'

export async function getSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = result[STORAGE_KEYS.SETTINGS] as Partial<AppSettings> | undefined
  return {
    apiKey: stored?.apiKey ?? '',
    model: stored?.model ?? 'claude-sonnet-4-6',
    maxTokens: stored?.maxTokens ?? 4096,
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings()
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  })
}

export async function getJobContext(): Promise<JobContext | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.JOB_CONTEXT)
  return (result[STORAGE_KEYS.JOB_CONTEXT] as JobContext | undefined) ?? null
}

export async function saveJobContext(jd: JobContext): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.JOB_CONTEXT]: jd })
}
