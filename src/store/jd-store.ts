import { create } from 'zustand'
import type { JobContext } from '@/types/job'

interface JDState {
  jobContext: JobContext | null
  isLoading: boolean

  setJobContext: (jd: JobContext | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void

  // Fetches from chrome.storage.local via background SW
  fetch: () => Promise<void>
}

export const useJDStore = create<JDState>()((set) => ({
  jobContext: null,
  isLoading: false,

  setJobContext: (jobContext) => set({ jobContext }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ jobContext: null }),

  fetch: async () => {
    set({ isLoading: true })
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_JD' })
      set({
        jobContext: (response as { payload: JobContext | null }).payload ?? null,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },
}))
