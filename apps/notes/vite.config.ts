import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Dev only: runs worker/index.ts in workerd next to the SPA, from wrangler.json.
    // The build stays a plain SPA build, because celld deploys from the source
    // wrangler.json and rejects the config this plugin would generate.
    command === 'serve' && cloudflare(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 8702 },
}))
