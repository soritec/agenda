import { giornoDi } from '../../nucleo/calendario'
import type { ModelloTurno, Turno } from '../../dati/modello'
import { intervallo, intervalloTuttoIlGiorno } from './orari'
import { tipoTurnoDa } from './tipi'

/**
 * Gli orari reali variano: tranne le guardie, i turni nascono "tutto il giorno"
 * e l'orario o le ore si scrivono, se si vuole, quando il turno è finito.
 */
export const conOrariFissi = (tipo: string) => ['guardiaDiurna', 'guardiaNotturna'].includes(tipoTurnoDa(tipo))

/** Turni tipo che hanno ancora un orario predefinito, resi "tutto il giorno". */
export function modelliSenzaOrari<T extends Pick<ModelloTurno, 'tipo' | 'tuttoIlGiorno'>>(modelli: T[]): T[] {
  return modelli.filter((m) => !conOrariFissi(m.tipo) && !m.tuttoIlGiorno).map((m) => ({ ...m, tuttoIlGiorno: true }))
}

/** Turni non ancora iniziati con l'orario predefinito del loro turno tipo: quelli con orari o ore scritti a mano non si toccano. */
export function turniFuturiSenzaOrari<T extends Pick<Turno, 'inizio' | 'fine' | 'tipo' | 'tuttoIlGiorno' | 'minutiManuali' | 'modelloId'>>(
  turni: T[], modelli: Pick<ModelloTurno, 'id' | 'minutoInizio' | 'minutoFine'>[], adesso: number,
): T[] {
  const perId = new Map(modelli.map((m) => [m.id, m]))
  return turni.flatMap((t) => {
    const m = t.modelloId ? perId.get(t.modelloId) : undefined
    if (!m || t.inizio < adesso || t.tuttoIlGiorno || t.minutiManuali !== undefined || conOrariFissi(t.tipo)) return []
    const g = giornoDi(t.inizio)
    const predefinito = intervallo(g, m.minutoInizio, m.minutoFine)
    if (t.inizio !== predefinito.inizio || t.fine !== predefinito.fine) return []
    return [{ ...t, ...intervalloTuttoIlGiorno(g), tuttoIlGiorno: true }]
  })
}
