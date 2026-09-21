import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { createNote, deleteNote, listNotes } from './api'

export function notesQuery(board: string) {
  return queryOptions({
    queryKey: ['boards', board, 'notes'],
    queryFn: () => listNotes(board),
  })
}

export function useCreateNote(board: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => createNote(board, { text }),
    onSuccess: () => queryClient.invalidateQueries(notesQuery(board)),
  })
}

export function useDeleteNote(board: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteNote(board, id),
    onSuccess: () => queryClient.invalidateQueries(notesQuery(board)),
  })
}
