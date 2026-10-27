import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/** Versione dell'app (momento della pubblicazione): serve a capire se il dispositivo ha in memoria una versione vecchia. */
const VERSIONE = new Date().toISOString()

// `base` relativo: l'app funziona sia in locale sia su GitHub Pages (utente.github.io/agenda/).
export default defineConfig({
  base: './',
  define: { __VERSIONE__: JSON.stringify(VERSIONE) },
  plugins: [
    react(),
    {
      name: 'versione',
      // Scrive versione.json accanto all'app: l'app lo rilegge per accorgersi delle pubblicazioni nuove.
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'versione.json', source: JSON.stringify({ versione: VERSIONE }) })
      },
    },
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
