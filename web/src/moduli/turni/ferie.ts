import { giornoSettimana, istante } from '../../nucleo/calendario'
import { festivitaDel } from '../../nucleo/festivita'
import type { GiornataSpeciale } from '../../dati/modello'
import { giornoDaChiave } from './supporto'
import { tipoGiornataDa } from './tipi'

export const FERIE_ANNUE = 30

/** Giorni di ferie usati nell'anno: contano solo quelli dal lunedì al venerdì non festivi. */
export function ferieUsate(giornate: Pick<GiornataSpeciale, 'giorno' | 'tipo'>[], anno: number): number {
  return giornate.filter((f) => {
    const g = giornoDaChiave(f.giorno)
    return g?.anno === anno && tipoGiornataDa(f.tipo) === 'ferie' && giornoSettimana(g) <= 5 && !festivitaDel(istante(g.anno, g.mese, g.giorno, 12))
  }).length
}
