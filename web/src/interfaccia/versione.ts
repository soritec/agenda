import { useEffect, useState } from 'react'

declare const __VERSIONE__: string

/**
 * Controlla se è stata pubblicata una versione nuova dell'app (all'avvio, ogni 15 minuti e quando si torna sull'app).
 * Restituisce la versione nuova, se c'è. In sviluppo il file non esiste e non succede niente.
 */
export function useVersioneNuova(): string | undefined {
  const [nuova, setNuova] = useState<string>()
  useEffect(() => {
    let vivo = true
    async function controlla() {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}versione.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { versione } = (await r.json()) as { versione?: string }
        if (vivo && versione && versione !== __VERSIONE__) setNuova(versione)
      } catch { /* senza rete si riprova dopo */ }
    }
    void controlla()
    const t = setInterval(() => void controlla(), 15 * 60_000)
    const visibile = () => { if (document.visibilityState === 'visible') void controlla() }
    document.addEventListener('visibilitychange', visibile)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', visibile) }
  }, [])
  return nuova
}

/** Ricarica l'app con un indirizzo nuovo, così il browser non può usare la pagina vecchia che ha in memoria. */
export function aggiornaApp(versione: string) {
  location.href = `${location.pathname}?v=${encodeURIComponent(versione)}${location.hash}`
}

/** Data e ora della versione in uso (per confrontarla tra i dispositivi). */
export const versioneInUso = (): string => {
  try { return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(Date.parse(__VERSIONE__)) } catch { return '—' }
}
