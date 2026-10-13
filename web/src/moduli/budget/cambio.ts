/**
 * Cambio tra euro e sterline, dai dati ufficiali della Banca Centrale Europea (servizio gratuito Frankfurter, senza chiave).
 * Si legge solo quando serve e si ricorda sul dispositivo; senza rete l'utente lo scrive a mano.
 */
const CHIAVE = 'agenda.cambio'

function ricordati(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CHIAVE) ?? '{}') as Record<string, number> } catch { return {} }
}

/** Quanto vale 1 `da` in `a` nel giorno indicato ("2026-10-01"); per i giorni futuri usa l'ultimo cambio. */
export async function cambioDelGiorno(da: string, a: string, giorno: string, oggi: string): Promise<number | undefined> {
  if (da === a) return 1
  const quando = giorno < oggi ? giorno : 'latest'
  const chiave = `${da}-${a}-${quando === 'latest' ? oggi : quando}`
  const memoria = ricordati()
  if (memoria[chiave]) return memoria[chiave]
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${quando}?base=${da}&symbols=${a}`)
    if (!r.ok) return undefined
    const valore = ((await r.json()) as { rates?: Record<string, number> }).rates?.[a]
    if (!valore) return undefined
    try { localStorage.setItem(CHIAVE, JSON.stringify({ ...memoria, [chiave]: valore })) } catch { /* senza memoria si richiede la prossima volta */ }
    return valore
  } catch { return undefined }
}

/** Centesimi convertiti con il cambio (arrotondati al centesimo). */
export const converti = (centesimi: number, cambio: number) => Math.round(centesimi * cambio)

/** Il cambio scritto dall'utente ("0,86") → numero. */
export function cambioDaTesto(t: string): number | undefined {
  const n = Number(t.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}
export const testoCambio = (n?: number) => (n ? String(Math.round(n * 10000) / 10000).replace('.', ',') : '')
