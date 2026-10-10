import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base` relativo: l'app funziona sia in locale sia su GitHub Pages (utente.github.io/agenda/).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
