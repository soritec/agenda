/**
 * Specializzazione: anno di corso, contatori del logbook.
 * Il logbook contiene solo dati anonimi.
 */

export const RUOLI = ['primo', 'secondo', 'osservatore'] as const
export type Ruolo = (typeof RUOLI)[number]
export const TITOLI_RUOLO: Record<Ruolo, string> = { primo: '1° operatore', secondo: '2° operatore', osservatore: 'Osservatore' }
export const ruoloDa = (grezzo: string): Ruolo => ((RUOLI as readonly string[]).includes(grezzo) ? (grezzo as Ruolo) : 'osservatore')

/** Elenco iniziale dei tipi di procedura (modificabile dall'utente). */
export const TIPI_PROCEDURA_PREDEFINITI = [
  'Parto spontaneo',
  'Parto operativo (ventosa)',
  'Taglio cesareo',
  'Revisione cavità uterina',
  'Sutura di lacerazione perineale',
  'Isteroscopia',
  'Laparoscopia',
  'Isterectomia',
  'Colposcopia',
  'Ecografia ostetrica',
  'Ecografia ginecologica',
  'Amniocentesi',
  'Villocentesi',
]

export const ANNI_PREDEFINITI = 5

/** Anno di corso (1…anni) in un giorno, dato l'inizio della specializzazione ("2024-11"). */
export function annoDiCorso(inizio: string | undefined, giorno: string, anni = ANNI_PREDEFINITI): number | undefined {
  const i = inizio?.match(/^(\d{4})-(\d{2})$/)
  const g = giorno.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!i || !g) return undefined
  const mesi = (Number(g[1]) - Number(i[1])) * 12 + (Number(g[2]) - Number(i[2]))
  if (mesi < 0) return undefined
  return Math.min(anni, Math.floor(mesi / 12) + 1)
}

export interface Conteggi {
  totale: number
  /** tipoId → ruolo → numero */
  perTipo: Map<string, Record<Ruolo, number>>
  perRuolo: Record<Ruolo, number>
  perAnno: Map<number, number>
}

export function conteggi(procedure: { tipoId: string; ruolo: string; annoCorso: number }[], anno?: number): Conteggi {
  const r: Conteggi = { totale: 0, perTipo: new Map(), perRuolo: { primo: 0, secondo: 0, osservatore: 0 }, perAnno: new Map() }
  for (const p of procedure) {
    r.perAnno.set(p.annoCorso, (r.perAnno.get(p.annoCorso) ?? 0) + 1)
    if (anno !== undefined && p.annoCorso !== anno) continue
    const ruolo = ruoloDa(p.ruolo)
    r.totale++
    r.perRuolo[ruolo]++
    const t = r.perTipo.get(p.tipoId) ?? { primo: 0, secondo: 0, osservatore: 0 }
    t[ruolo]++
    r.perTipo.set(p.tipoId, t)
  }
  return r
}

/** Settimane gestazionali scritte come "39+2" o "39": valide tra 4 e 44. */
export function settimaneValide(testo: string): boolean {
  const m = testo.trim().match(/^(\d{1,2})(?:\s*\+\s*([0-6]))?$/)
  return !!m && Number(m[1]) >= 4 && Number(m[1]) <= 44
}

/** Tipi predefiniti considerati chirurgici (modificabile per ogni procedura). */
export const CHIRURGICHE_PREDEFINITE = new Set([
  'Parto operativo (ventosa)', 'Taglio cesareo', 'Revisione cavità uterina', 'Sutura di lacerazione perineale',
  'Isteroscopia', 'Laparoscopia', 'Isterectomia',
])

export type FiltroCategoria = 'tutte' | 'chirurgiche' | 'nonChirurgiche'

export function nelFiltro(tipo: { chirurgica?: boolean } | undefined, filtro: FiltroCategoria): boolean {
  if (filtro === 'tutte') return true
  return filtro === 'chirurgiche' ? Boolean(tipo?.chirurgica) : !tipo?.chirurgica
}

/** Esami e lezioni: "passati" se completati o con data già trascorsa (si mostrano in trasparenza). */
export function eConcluso(e: { giorno: string; completato?: boolean }, oggi: string): boolean {
  return Boolean(e.completato) || e.giorno < oggi
}

export type StatoTassa = 'pagato' | 'scaduta' | 'inScadenza' | 'daPagare'
export const TITOLI_STATO_TASSA: Record<StatoTassa, string> = { pagato: 'Pagata', scaduta: 'Scaduta', inScadenza: 'In scadenza', daPagare: 'Da pagare' }

/** Stato con colore: scaduta se non pagata e oltre la scadenza, in scadenza entro 14 giorni. */
export function statoTassa(t: { stato: string; scadenza?: string }, oggi: string): StatoTassa {
  if (t.stato === 'pagato') return 'pagato'
  if (!t.scadenza) return 'daPagare'
  if (t.scadenza < oggi) return 'scaduta'
  const tra14 = new Date(`${oggi}T12:00:00Z`)
  tra14.setUTCDate(tra14.getUTCDate() + 14)
  return t.scadenza <= tra14.toISOString().slice(0, 10) ? 'inScadenza' : 'daPagare'
}
