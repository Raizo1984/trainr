/**
 * Dezelfde tests, maar met een vastgezette klok.
 *
 * Gebruikt door `npm run test:datum`. De gewone `vitest.config.ts` blijft
 * ongemoeid, zodat een normale testronde niets extra's doet.
 */

import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    setupFiles: [fileURLToPath(new URL('./scripts/klok.ts', import.meta.url))],
  },
})
