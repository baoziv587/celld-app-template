import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { boardName } from '../shared/protocol'
import { BoardPage } from './board-page'
import { notesQuery } from './queries'

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  errorComponent: ({ error }) => <p role="alert" className="p-8 text-sm text-destructive">{error instanceof Error ? error.message : 'Something went wrong'}</p>,
  notFoundComponent: () => <p className="p-8 text-sm text-muted-foreground">Page not found.</p>,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/boards/$board', params: { board: 'default' } })
  },
})

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/boards/$board',
  params: { parse: raw => ({ board: boardName.parse(raw.board) }) },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(notesQuery(params.board)),
  pendingComponent: () => <p className="p-8 text-sm text-muted-foreground">Loading…</p>,
  component: function BoardRoute() {
    return <BoardPage board={boardRoute.useParams().board} />
  },
})

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, boardRoute]),
    context: { queryClient },
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
