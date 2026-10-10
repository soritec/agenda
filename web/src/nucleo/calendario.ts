/**
 * Unico punto per date, giorni e fuso orario.
 * I turni si svolgono in Italia: giorni, mesi e festività si calcolano sempre in ora italiana,
 * qualunque sia il fuso del dispositivo. Nel resto del codice non usare `getDate()`, `getHours()`
 * e simili, che dipendono dal fuso del dispositivo.
 */

export const FUSO_ORARIO = 'Europe/Rome'
export const LOCALE = 'it-IT'

/** Un giorno del calendario, senza ora (mese 1–12). */
export interface GiornoCivile {
  anno: number
  mese: number
  giorno: number
}

export interface Componenti extends GiornoCivile {
  ora: number
  minuto: number
  /** 1 = lunedì … 7 = domenica (ISO 8601). */
  giornoSettimana: number
}

const MINUTO = 60_000
const GIORNI_SETTIMANA: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

const lettore = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_ORARIO,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  weekday: 'short',
})

/** Componenti in ora italiana di un istante (millisecondi da epoch). */
export function componenti(istante: number): Componenti {
  const parti: Record<string, string> = {}
  for (const p of lettore.formatToParts(istante)) parti[p.type] = p.value
  return {
    anno: Number(parti.year),
    mese: Number(parti.month),
    giorno: Number(parti.day),
    ora: Number(parti.hour),
    minuto: Number(parti.minute),
    giornoSettimana: GIORNI_SETTIMANA[parti.weekday ?? ''] ?? 0,
  }
}

/** Scarto dell'ora italiana rispetto a UTC, in millisecondi, in quell'istante. */
function scarto(istante: number): number {
  const c = componenti(istante)
  return Date.UTC(c.anno, c.mese - 1, c.giorno, c.ora, c.minuto) - (istante - (istante % MINUTO))
}

/**
 * Istante corrispondente a data e ora italiane.
 * Un orario che non esiste (cambio dell'ora legale, es. 02:30 dell'ultima domenica di marzo)
 * viene spostato in avanti di un'ora.
 */
export function istante(anno: number, mese: number, giorno: number, ora = 0, minuto = 0): number {
  const comeUtc = Date.UTC(anno, mese - 1, giorno, ora, minuto)
  let risultato = comeUtc - scarto(comeUtc)
  const corretto = comeUtc - scarto(risultato)
  if (corretto !== risultato) risultato = corretto
  return risultato
}

export function giornoDi(istanteMs: number): GiornoCivile {
  const { anno, mese, giorno } = componenti(istanteMs)
  return { anno, mese, giorno }
}

export function inizioGiorno(g: GiornoCivile): number {
  return istante(g.anno, g.mese, g.giorno)
}

export function aggiungiGiorni(g: GiornoCivile, n: number): GiornoCivile {
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno + n))
  return { anno: d.getUTCFullYear(), mese: d.getUTCMonth() + 1, giorno: d.getUTCDate() }
}

export function stessoGiorno(a: GiornoCivile, b: GiornoCivile): boolean {
  return a.anno === b.anno && a.mese === b.mese && a.giorno === b.giorno
}

/** 1 = lunedì … 7 = domenica. */
export function giornoSettimana(g: GiornoCivile): number {
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno)).getUTCDay()
  return d === 0 ? 7 : d
}

export function giorniNelMese(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate()
}

/** Intervallo semiaperto [primo giorno del mese, primo giorno del mese dopo), in ora italiana. */
export function intervalloMese(anno: number, mese: number): { inizio: number; fine: number } {
  const dopo = mese === 12 ? { anno: anno + 1, mese: 1 } : { anno, mese: mese + 1 }
  return { inizio: istante(anno, mese, 1), fine: istante(dopo.anno, dopo.mese, 1) }
}

/** Minuti interi tra due istanti. */
export function minutiTra(da: number, a: number): number {
  return Math.round((a - da) / MINUTO)
}
