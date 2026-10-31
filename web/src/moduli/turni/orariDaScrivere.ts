import { aggiungiGiorni, giornoDi, stessoGiorno, type GiornoCivile } from '../../nucleo/calendario'
import type { Turno } from '../../dati/modello'
import { conOrariFissi } from './senzaOrari'
import { chiaveGiorno } from './supporto'

/** Fin dove si torna indietro a chiedere gli orari, in giorni. */
const GIORNI_INDIETRO = 14
/** La richiesta degli orari parte da qui: i turni più vecchi non vengono chiesti. */
const INIZIO = '2026-11-01'

export interface GiornoDaCompilare<T> { giorno: string; turni: T[] }

/** Giorni passati con turni senza orari né ore, dal più recente. Le guardie hanno già il loro orario. */
export function giorniDaCompilare<T extends Pick<Turno, 'inizio' | 'tipo' | 'tuttoIlGiorno' | 'minutiManuali'>>(
  turni: T[], oggi: GiornoCivile, nonChiesti: string[] = [],
): GiornoDaCompilare<T>[] {
  const limite = chiaveGiorno(aggiungiGiorni(oggi, -GIORNI_INDIETRO))
  const perGiorno = new Map<string, T[]>()
  for (const t of turni) {
    const g = giornoDi(t.inizio)
    const giorno = chiaveGiorno(g)
    if (stessoGiorno(g, oggi) || giorno > chiaveGiorno(oggi) || giorno < limite || giorno < INIZIO) continue
    if (!t.tuttoIlGiorno || t.minutiManuali !== undefined || conOrariFissi(t.tipo) || nonChiesti.includes(giorno)) continue
    perGiorno.set(giorno, [...(perGiorno.get(giorno) ?? []), t])
  }
  return [...perGiorno.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([giorno, lista]) => ({ giorno, turni: lista.sort((x, y) => x.inizio - y.inizio) }))
}
