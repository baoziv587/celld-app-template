import { useSuspenseQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDrafts } from './drafts'
import { notesQuery, useCreateNote, useDeleteNote } from './queries'

export function BoardPage({ board }: { board: string }) {
  const { data: notes } = useSuspenseQuery(notesQuery(board))
  const draft = useDrafts(state => state.drafts[board] ?? '')
  const setDraft = useDrafts(state => state.setDraft)
  const createNote = useCreateNote(board)
  const deleteNote = useDeleteNote(board)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    createNote.mutate(draft, { onSuccess: () => setDraft(board, '') })
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{board}</CardTitle>
          <CardDescription>One board is one celld cell with its own SQLite database.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={submit} className="flex gap-2">
            <Input
              value={draft}
              onChange={event => setDraft(board, event.target.value)}
              placeholder="Write a note"
              aria-label="Note text"
              aria-invalid={createNote.isError}
            />
            <Button type="submit" disabled={createNote.isPending || draft.trim().length === 0}>Add</Button>
          </form>
          {createNote.isError && <p role="alert" className="text-sm text-destructive">{createNote.error.message}</p>}

          {notes.length === 0
            ? <p className="text-sm text-muted-foreground">No notes yet. Add the first one above.</p>
            : (
                <ul className="flex flex-col divide-y">
                  {notes.map(note => (
                    <li key={note.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 break-words text-sm">{note.text}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete note: ${note.text}`}
                        disabled={deleteNote.isPending}
                        onClick={() => deleteNote.mutate(note.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
        </CardContent>
      </Card>
    </main>
  )
}
