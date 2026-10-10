import { useSyncExternalStore } from 'react'

/**
 * Navigazione con l'hash dell'indirizzo (#/turni?mese=2026-10): funziona su GitHub Pages
 * senza configurazione e con il tasto Indietro del browser.
 */
export interface Rotta {
  percorso: string[]
  parametri: URLSearchParams
}

function leggi(): Rotta {
  const [percorso = '', query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  return { percorso: percorso.split('/').filter(Boolean), parametri: new URLSearchParams(query) }
}

let corrente = leggi()
let chiave = window.location.hash

function iscriviti(avvisa: () => void) {
  const gestore = () => {
    if (window.location.hash !== chiave) {
      chiave = window.location.hash
      corrente = leggi()
    }
    avvisa()
  }
  window.addEventListener('hashchange', gestore)
  return () => window.removeEventListener('hashchange', gestore)
}

export function useRotta(): Rotta {
  return useSyncExternalStore(iscriviti, () => corrente)
}

export function vai(indirizzo: string) {
  window.location.hash = indirizzo.startsWith('#') ? indirizzo : `#${indirizzo}`
}

/** "2026-10" ↔ { anno, mese } */
export function meseDaParametro(valore: string | null, predefinito: { anno: number; mese: number }) {
  const m = valore?.match(/^(\d{4})-(\d{2})$/)
  if (!m) return predefinito
  const mese = Number(m[2])
  return mese >= 1 && mese <= 12 ? { anno: Number(m[1]), mese } : predefinito
}

export function parametroMese(anno: number, mese: number): string {
  return `${anno}-${String(mese).padStart(2, '0')}`
}
