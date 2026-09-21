import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/*/{worker,shared,src}/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
})
