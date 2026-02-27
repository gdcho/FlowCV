import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * Zustand persist storage adapter backed by chrome.storage.local.
 * Use this in any store that needs to survive extension restarts.
 */
export function createChromeStorageAdapter<T>(): PersistStorage<T> {
  return {
    getItem: async (name: string): Promise<StorageValue<T> | null> => {
      const result = await chrome.storage.local.get(name)
      const raw = result[name] as string | undefined
      if (!raw) return null
      try {
        return JSON.parse(raw) as StorageValue<T>
      } catch {
        return null
      }
    },
    setItem: async (name: string, value: StorageValue<T>): Promise<void> => {
      await chrome.storage.local.set({ [name]: JSON.stringify(value) })
    },
    removeItem: async (name: string): Promise<void> => {
      await chrome.storage.local.remove(name)
    },
  }
}
