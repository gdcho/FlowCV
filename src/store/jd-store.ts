import { create } from 'zustand'
import type { JobContext } from '@/types/job'

interface JDState {
  jobContext: JobContext | null
  isLoading: boolean
  fetchError: string | null

  setJobContext: (jd: JobContext | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void

  // Fetches from chrome.storage.local via background SW
  fetch: () => Promise<void>
}

async function sendGetJD(): Promise<JobContext | null> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_JD' })
  return (response as { payload: JobContext | null }).payload ?? null
}

export const useJDStore = create<JDState>()((set) => ({
  jobContext: null,
  isLoading: false,
  fetchError: null,

  setJobContext: (jobContext) => set({ jobContext }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ jobContext: null }),

  fetch: async () => {
    set({ isLoading: true, fetchError: null })
    try {
      // MV3 service workers can be sleeping — retry once if the first attempt fails
      let jd: JobContext | null
      try {
        jd = await sendGetJD()
      } catch {
        await new Promise<void>((r) => setTimeout(r, 400))
        jd = await sendGetJD()
      }
      set({ jobContext: jd, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        fetchError: err instanceof Error ? err.message : 'Failed to load JD',
      })
    }
  },
}))
