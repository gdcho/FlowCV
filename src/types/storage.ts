export interface AppSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export const STORAGE_KEYS = {
  SETTINGS: "FlowCV-settings",
  JOB_CONTEXT: "FlowCV-jd",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
