import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createChromeStorageAdapter } from "@/lib/storage-adapter";

interface SettingsState {
  apiKey: string;
  model: string;
  maxTokens: number;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setMaxTokens: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      model: "claude-sonnet-4-6",
      maxTokens: 4096,
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
    }),
    {
      name: "FlowCV-settings",
      storage: createChromeStorageAdapter<SettingsState>(),
    },
  ),
);
