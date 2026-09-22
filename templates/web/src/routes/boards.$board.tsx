import { boardName } from '@shared/protocol'
import { createFileRoute } from '@tanstack/react-router'
import { BoardPage } from '@/components/board-page'
import { notesQuery } from '@/queries'

export const Route = createFileRoute('/boards/$board')({
  params: { parse: raw => ({ board: boardName.parse(raw.board) }) },
  head: ({ params }) => ({ meta: [{ title: `${params.board} · Notes` }] }),
  // Runs on the server for the first page and in the browser afterwards.
  loader: ({ context, params }) => context.queryClient.ensureQueryData(notesQuery(params.board)),
  pendingComponent: () => <p className="p-8 text-sm text-muted-foreground">Loading…</p>,
  component: BoardPage,
})
