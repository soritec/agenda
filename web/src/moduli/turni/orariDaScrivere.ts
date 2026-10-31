import { aggiungiGiorni, giornoDi, stessoGiorno, type GiornoCivile } from '../../nucleo/calendario'
import type { Turno } from '../../dati/modello'
import { conOrariFissi } from './senzaOrari'
import { chiaveGiorno } from './supporto'

/** Fin dove si torna indietro a chiedere gli orari, in giorni. */
const GIORNI_INDIETRO = 14
/** La richiesta degli orari parte da qui: i turni più vecchi non vengono chiesti. */
const INIZIO = '2026-11-01'

export interface GiornoDaCompilare<T> {
  giorno: string
  /** Turni senza orari né ore. */
  turni: T[]
  /** Guardie del giorno: hanno già l'orario, si chiedono solo gli appunti. */
  guardie: T[]
}

type TurnoMinimo = Pick<Turno, 'inizio' | 'tipo' | 'tuttoIlGiorno' | 'minutiManuali'>

/**
 * Giorni passati da compilare, dal più recente: quelli con turni senza orari, e quelli con una guardia
 * ancora senza appunti (`conDiario`: giorni già salvati, anche con gli appunti vuoti).
 */
export function giorniDaCompilare<T extends TurnoMinimo>(turni: T[], oggi: GiornoCivile, nonChiesti: string[] = [], conDiario: string[] = []): GiornoDaCompilare<T>[] {
  const limite = chiaveGiorno(aggiungiGiorni(oggi, -GIORNI_INDIETRO))
  const perGiorno = new Map<string, GiornoDaCompilare<T>>()
  for (const t of [...turni].sort((a, b) => a.inizio - b.inizio)) {
    const g = giornoDi(t.inizio)
    const giorno = chiaveGiorno(g)
    if (stessoGiorno(g, oggi) || giorno > chiaveGiorno(oggi) || giorno < limite || giorno < INIZIO || nonChiesti.includes(giorno)) continue
    const guardia = conOrariFissi(t.tipo)
    if (guardia ? conDiario.includes(giorno) : !t.tuttoIlGiorno || t.minutiManuali !== undefined) continue
    const voce = perGiorno.get(giorno) ?? { giorno, turni: [], guardie: [] }
    ;(guardia ? voce.guardie : voce.turni).push(t)
    perGiorno.set(giorno, voce)
  }
  return [...perGiorno.values()].sort((a, b) => b.giorno.localeCompare(a.giorno))
}
