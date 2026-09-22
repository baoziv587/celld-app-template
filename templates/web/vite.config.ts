import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * TanStack Start on Cloudflare's Vite plugin: `vite dev` runs the whole app in
 * workerd, `vite build` writes the browser assets and one self-contained worker
 * bundle to dist/template-web/, which is what celld deploys.
 */
export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    react(),
  ],
  resolve: { tsconfigPaths: true },
  // Use an explicit IPv4 loopback address for cloudflared's local origin.
  server: { host: '127.0.0.1', port: 8791 },
})
