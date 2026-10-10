import { minutiTra } from '../../nucleo/calendario'
import type { DatiTurno, TipoTurno } from './tipi'

export interface Sovrapposizione {
  primo: string
  secondo: string
}

export interface RiposoInsufficiente {
  precedente: string
  successivo: string
  minutiRiposo: number
}

/** Avviso relativo a un singolo turno. Gli avvisi non bloccano mai il salvataggio. */
export type AvvisoTurno =
  | { tipo: 'sovrapposizione'; con: string }
  | { tipo: 'riposoInsufficiente'; con: string; minutiRiposo: number }

/** 11 ore consecutive di riposo giornaliero (D.Lgs. 66/2003); modificabile nelle Impostazioni. */
export const RIPOSO_MINIMO_PREDEFINITO = 11 * 60
/** La reperibilità non interrompe il riposo, salvo diversa scelta nelle Impostazioni. */
export const ESCLUSI_DAL_RIPOSO_PREDEFINITI: ReadonlySet<TipoTurno> = new Set(['reperibilita'])

const perInizio = (a: DatiTurno, b: DatiTurno) => a.inizio - b.inizio

/** Coppie di turni che si accavallano (toccarsi agli estremi non è sovrapposizione). */
export function sovrapposizioni(turni: DatiTurno[]): Sovrapposizione[] {
  const ordinati = [...turni].sort(perInizio)
  const risultato: Sovrapposizione[] = []
  ordinati.forEach((a, i) => {
    for (const b of ordinati.slice(i + 1)) {
      if (b.inizio >= a.fine) break
      risultato.push({ primo: a.id, secondo: b.id })
    }
  })
  return risultato
}

/** Turni che iniziano meno di `minimoMinuti` dopo la fine del turno precedente. */
export function riposiInsufficienti(
  turni: DatiTurno[],
  minimoMinuti = RIPOSO_MINIMO_PREDEFINITO,
  esclusi: ReadonlySet<TipoTurno> = ESCLUSI_DAL_RIPOSO_PREDEFINITI,
): RiposoInsufficiente[] {
  const ordinati = turni.filter((t) => !esclusi.has(t.tipo)).sort(perInizio)
  const risultato: RiposoInsufficiente[] = []
  let ultimo: DatiTurno | undefined
  for (const turno of ordinati) {
    if (ultimo) {
      const riposo = minutiTra(ultimo.fine, turno.inizio)
      // Un riposo negativo è una sovrapposizione: la segnala l'altro controllo.
      if (riposo >= 0 && riposo < minimoMinuti) {
        risultato.push({ precedente: ultimo.id, successivo: turno.id, minutiRiposo: riposo })
      }
    }
    if (!ultimo || turno.fine > ultimo.fine) ultimo = turno
  }
  return risultato
}

/** Avvisi per un turno nuovo o modificato, rispetto agli altri turni salvati. */
export function avvisi(
  turno: DatiTurno,
  esistenti: DatiTurno[],
  minimoMinuti = RIPOSO_MINIMO_PREDEFINITO,
  esclusi: ReadonlySet<TipoTurno> = ESCLUSI_DAL_RIPOSO_PREDEFINITI,
): AvvisoTurno[] {
  const tutti = [...esistenti.filter((t) => t.id !== turno.id), turno]
  const risultato: AvvisoTurno[] = []
  for (const s of sovrapposizioni(tutti)) {
    if (s.primo === turno.id) risultato.push({ tipo: 'sovrapposizione', con: s.secondo })
    if (s.secondo === turno.id) risultato.push({ tipo: 'sovrapposizione', con: s.primo })
  }
  for (const r of riposiInsufficienti(tutti, minimoMinuti, esclusi)) {
    if (r.precedente === turno.id) risultato.push({ tipo: 'riposoInsufficiente', con: r.successivo, minutiRiposo: r.minutiRiposo })
    if (r.successivo === turno.id) risultato.push({ tipo: 'riposoInsufficiente', con: r.precedente, minutiRiposo: r.minutiRiposo })
  }
  return risultato
}
