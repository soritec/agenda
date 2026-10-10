import { FUSO_ORARIO, LOCALE } from './calendario'

/** Formattazione per l'interfaccia, sempre in italiano e in ora italiana. Gli export usano formati propri. */

const fOra = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fBreve = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, weekday: 'short', day: 'numeric', month: 'short' })
const fEstesa = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fMese = new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO_ORARIO, month: 'long', year: 'numeric' })
const fEuro = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' })

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

/** Importo in euro da centesimi, es. "12.345,67 €". */
export const importo = (centesimi: number): string => fEuro.format(centesimi / 100)
