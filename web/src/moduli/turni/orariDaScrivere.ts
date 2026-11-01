import { aggiungiGiorni, componenti, giornoDi, stessoGiorno, type GiornoCivile } from '../../nucleo/calendario'
import type { Turno } from '../../dati/modello'
import { conOrariFissi } from './senzaOrari'
import { tipoTurnoDa } from './tipi'
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

/**
 * Turni di oggi che si possono già chiudere, senza aspettare domani: quelli senza orari per tutto il giorno,
 * la guardia di giorno dalle 20. La notte no: se ne parla il mattino dopo.
 */
export function giornoDaChiudere<T extends TurnoMinimo>(turni: T[], adesso: number, nonChiesti: string[] = [], conDiario: string[] = []): GiornoDaCompilare<T> | undefined {
  const g = giornoDi(adesso)
  const diOggi = turni.filter((t) => {
    if (!stessoGiorno(giornoDi(t.inizio), g)) return false
    const tipo = tipoTurnoDa(t.tipo)
    return tipo !== 'guardiaNotturna' && (tipo !== 'guardiaDiurna' || componenti(adesso).ora >= 20)
  })
  return giorniDaCompilare(diOggi, aggiungiGiorni(g, 1), nonChiesti, conDiario)[0]
}

/** La notte iniziata ieri si chiede solo dalle 8 del mattino. */
export function nascondiNotteDiIeri<T extends TurnoMinimo>(giorno: GiornoDaCompilare<T>, adesso: number): boolean {
  return componenti(adesso).ora < 8 && giorno.giorno === chiaveGiorno(aggiungiGiorni(giornoDi(adesso), -1))
    && giorno.turni.length === 0 && giorno.guardie.every((t) => tipoTurnoDa(t.tipo) === 'guardiaNotturna')
}
