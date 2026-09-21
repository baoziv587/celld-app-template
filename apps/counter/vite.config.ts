import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

/** Dev server only: runs worker/index.ts in workerd. There is no frontend to build. */
export default defineConfig({
  plugins: [cloudflare()],
  server: { port: 8701 },
})
