import { create } from 'zustand'
import type { LaTeXBlock } from '@/types/latex'
import type { ProposedChange } from '@/types/ai'

export type AnalysisStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'applied' | 'error'

interface SidebarState {
  isOpen: boolean
  status: AnalysisStatus
  blocks: LaTeXBlock[]
  proposedChanges: ProposedChange[]
  streamingText: string
  errorMessage: string | null
  selectedChangeIds: Set<string>

  // Actions
  open: () => void
  close: () => void
  toggle: () => void
  setStatus: (s: AnalysisStatus) => void
  setBlocks: (b: LaTeXBlock[]) => void
  appendStreamChunk: (chunk: string) => void
  setProposedChanges: (c: ProposedChange[]) => void
  setError: (msg: string) => void
  toggleChangeSelection: (blockId: string) => void
  selectAllChanges: () => void
  deselectAllChanges: () => void
  reset: () => void
}

export const useSidebarStore = create<SidebarState>()((set, get) => ({
  isOpen: false,
  status: 'idle',
  blocks: [],
  proposedChanges: [],
  streamingText: '',
  errorMessage: null,
  selectedChangeIds: new Set(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setStatus: (status) => set({ status }),
  setBlocks: (blocks) => set({ blocks }),

  appendStreamChunk: (chunk) =>
    set((s) => ({ streamingText: s.streamingText + chunk })),

  setProposedChanges: (proposedChanges) =>
    set({
      proposedChanges,
      // Pre-select all changes by default
      selectedChangeIds: new Set(proposedChanges.map((c) => c.blockId)),
    }),

  setError: (errorMessage) => set({ status: 'error', errorMessage }),

  toggleChangeSelection: (blockId) =>
    set((s) => {
      const next = new Set(s.selectedChangeIds)
      next.has(blockId) ? next.delete(blockId) : next.add(blockId)
      return { selectedChangeIds: next }
    }),

  selectAllChanges: () =>
    set((s) => ({
      selectedChangeIds: new Set(s.proposedChanges.map((c) => c.blockId)),
    })),

  deselectAllChanges: () => set({ selectedChangeIds: new Set() }),

  reset: () =>
    set({
      status: 'idle',
      streamingText: '',
      proposedChanges: [],
      errorMessage: null,
      selectedChangeIds: new Set(),
    }),
}))
