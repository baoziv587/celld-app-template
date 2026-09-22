import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

/** Dev server only: runs worker/index.ts in workerd. There is no frontend to build. */
export default defineConfig({
  plugins: [cloudflare()],
  // Use an explicit IPv4 loopback address for cloudflared's local origin.
  server: { host: '127.0.0.1', port: 8790 },
})
