import { FUSO_ORARIO, LOCALE } from './calendario'

/** Formattazione per l'interfaccia, sempre in italiano e in ora italiana. Gli export usano formati propri. */

const fOra = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fBreve = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, weekday: 'short', day: 'numeric', month: 'short' })
const fEstesa = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fMese = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, month: 'long', year: 'numeric' })
export type Valuta = 'EUR' | 'GBP'
/** Valuta del profilo attivo: letta subito dalla memoria del dispositivo (vedi `ricordaValuta`), così gli importi non "saltano" all'apertura. */
const CHIAVE_VALUTA = 'agenda.valuta'
function valutaSalvata(): Valuta {
  try {
    const profilo = localStorage.getItem('agenda.profilo') || 'principale'
    return localStorage.getItem(`${CHIAVE_VALUTA}.${profilo}`) === 'GBP' ? 'GBP' : 'EUR'
  } catch { return 'EUR' }
}
let valutaAttiva: Valuta = valutaSalvata()
let fEuro = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: valutaAttiva })
export const valuta = (): Valuta => valutaAttiva
export const simboloValuta = (): string => (valutaAttiva === 'GBP' ? '£' : '€')
/** Imposta la valuta del profilo; restituisce true se è cambiata (la pagina va ridisegnata). */
export function ricordaValuta(v: Valuta | undefined, profilo: string): boolean {
  const nuova: Valuta = v === 'GBP' ? 'GBP' : 'EUR'
  try { localStorage.setItem(`${CHIAVE_VALUTA}.${profilo}`, nuova) } catch { /* niente memoria: vale solo per questa apertura */ }
  if (nuova === valutaAttiva) return false
  valutaAttiva = nuova
  fEuro = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: nuova })
  return true
}

/** "08:30" */
export const ora = (istante: number): string => fOra.format(istante)
/** "lun 12 ott" */
export const dataBreve = (istante: number): string => fBreve.format(istante)
/** "lunedì 12 ottobre 2026" */
export const dataEstesa = (istante: number): string => fEstesa.format(istante)
/** "ottobre 2026" */
export const mese = (istante: number): string => fMese.format(istante)

/** "7 h 30 min", "12 h", "45 min" */
export function durata(minuti: number): string {
  const segno = minuti < 0 ? '−' : ''
  const ore = Math.floor(Math.abs(minuti) / 60), resto = Math.abs(minuti) % 60
  if (ore === 0) return `${segno}${resto} min`
  if (resto === 0) return `${segno}${ore} h`
  return `${segno}${ore} h ${resto} min`
}

/** Importo da centesimi nella valuta del profilo, es. "12.345,67 €" o "850,00 £". */
export const importo = (centesimi: number): string => fEuro.format(centesimi / 100)
