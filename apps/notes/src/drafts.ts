import { create } from 'zustand'

interface DraftState {
  drafts: Record<string, string>
  setDraft: (board: string, text: string) => void
}

/**
 * Unsent text per board. It is client-only state, so it lives in zustand;
 * anything the server owns belongs in TanStack Query.
 */
export const useDrafts = create<DraftState>(set => ({
  drafts: {},
  setDraft: (board, text) => set(state => ({ drafts: { ...state.drafts, [board]: text } })),
}))
