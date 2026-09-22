import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import appCss from '@/styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Notes' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  errorComponent: ({ error }) => <p role="alert" className="p-8 text-sm text-destructive">{error instanceof Error ? error.message : 'Something went wrong'}</p>,
  notFoundComponent: () => <p className="p-8 text-sm text-muted-foreground">Page not found.</p>,
})
