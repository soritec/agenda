import type { DatiTurno } from './tipi'

export interface Sovrapposizione {
  primo: string
  secondo: string
}

/** Avviso relativo a un singolo turno. Gli avvisi non bloccano mai il salvataggio. */
export interface AvvisoTurno {
  tipo: 'sovrapposizione'
  con: string
}

/** Coppie di turni che si accavallano (toccarsi agli estremi non è sovrapposizione). */
export function sovrapposizioni(turni: DatiTurno[]): Sovrapposizione[] {
  const ordinati = [...turni].sort((a, b) => a.inizio - b.inizio)
  const risultato: Sovrapposizione[] = []
  ordinati.forEach((a, i) => {
    for (const b of ordinati.slice(i + 1)) {
      if (b.inizio >= a.fine) break
      risultato.push({ primo: a.id, secondo: b.id })
    }
  })
  return risultato
}

/** Avvisi per un turno nuovo o modificato, rispetto agli altri turni salvati. */
export function avvisi(turno: DatiTurno, esistenti: DatiTurno[]): AvvisoTurno[] {
  const tutti = [...esistenti.filter((t) => t.id !== turno.id), turno]
  const risultato: AvvisoTurno[] = []
  for (const s of sovrapposizioni(tutti)) {
    if (s.primo === turno.id) risultato.push({ tipo: 'sovrapposizione', con: s.secondo })
    if (s.secondo === turno.id) risultato.push({ tipo: 'sovrapposizione', con: s.primo })
  }
  return risultato
}
