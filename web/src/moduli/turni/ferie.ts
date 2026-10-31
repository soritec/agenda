import { giornoSettimana, istante } from '../../nucleo/calendario'
import { festivitaDel } from '../../nucleo/festivita'
import type { GiornataSpeciale } from '../../dati/modello'
import { giornoDaChiave } from './supporto'
import { tipoGiornataDa } from './tipi'

export const FERIE_ANNUE = 30

/** Un giorno scala dalle ferie solo se è dal lunedì al venerdì e non è festivo. */
export function contaComeFerie(giorno: string): boolean {
  const g = giornoDaChiave(giorno)
  return !!g && giornoSettimana(g) <= 5 && !festivitaDel(istante(g.anno, g.mese, g.giorno, 12))
}

/** Giorni di ferie usati nell'anno. */
export function ferieUsate(giornate: Pick<GiornataSpeciale, 'giorno' | 'tipo'>[], anno: number): number {
  return giornate.filter((f) => f.giorno.startsWith(`${anno}-`) && tipoGiornataDa(f.tipo) === 'ferie' && contaComeFerie(f.giorno)).length
}
