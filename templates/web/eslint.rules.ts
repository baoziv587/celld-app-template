import type { Linter } from 'eslint'

/**
 * Rules for this app only, on top of the root config. Globs are relative to the
 * app. Rules can be added or tightened here; the root config rejects "off".
 */
const rules: Linter.Config[] = [
  {
    files: ['src/**/*.{ts,tsx}'],
    // Pages talk to the server through server functions (src/server/), never raw fetch.
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Use a server function from src/server/ instead of fetch.' }],
    },
  },
]

export default rules
