import type { Linter } from 'eslint'

/**
 * Rules for this app only, on top of the root config. Globs are relative to the
 * app. Rules can be added or tightened here; the root config rejects "off".
 */
const rules: Linter.Config[] = [
  {
    files: ['src/**/*.{ts,tsx}'],
    // src/api.ts is the one place allowed to call fetch: it parses every response.
    ignores: ['src/api.ts'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Call the helpers in src/api.ts so every response is schema-checked.' }],
    },
  },
]

export default rules
