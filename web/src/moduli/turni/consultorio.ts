import { aggiungiGiorni, giornoDi, giornoSettimana, type GiornoCivile } from '../../nucleo/calendario'
import type { ModelloTurno, Turno } from '../../dati/modello'
import { chiaveGiorno, minutiDaOrario } from './supporto'
import { normalizza } from './importaPdf'

/** Una possibilità per un giorno della settimana. Il testo si scrive nelle impostazioni dei turni, una riga per voce. */
export interface SedeConsultorio { giorno: number; nome: string; inizio?: number; fine?: number; nota?: string }

const GIORNI = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica']

/** "lunedì; Nome sede; 8:30; 16:00; nota": ora di inizio, fine e nota sono facoltative. */
export function leggiSediConsultorio(testo = ''): SedeConsultorio[] {
  return testo.split('\n').flatMap((riga) => {
    const [g, nome, da, a, nota] = riga.split(';').map((c) => c.trim())
    const giorno = GIORNI.findIndex((x) => x.startsWith(normalizza(g ?? '').slice(0, 3))) + 1
    return giorno && g && nome ? [{ giorno, nome, inizio: minutiDaOrario(da ?? ''), fine: minutiDaOrario(a ?? ''), nota: nota || undefined }] : []
  })
}

export const rigaSedeConsultorio = (giorno: number, nome: string, da: string, a: string) => `${GIORNI[giorno - 1]}; ${nome}; ${da}; ${a}`

/** Consultori di oggi e domani ancora senza sede, dal primo. */
export function consultoriDaScegliere<T extends Pick<Turno, 'id' | 'inizio' | 'sedeId' | 'modelloId'>>(
  turni: T[], modelli: Map<string, Pick<ModelloTurno, 'sigla' | 'nome'>>, oggi: GiornoCivile, nonChiesti: string[] = [],
): T[] {
  const giorni = [chiaveGiorno(oggi), chiaveGiorno(aggiungiGiorni(oggi, 1))]
  return turni.filter((t) => {
    const m = t.modelloId ? modelli.get(t.modelloId) : undefined
    return !!m && (normalizza(m.sigla) === 'cs' || normalizza(m.nome).includes('consultorio')) && !t.sedeId
      && giorni.includes(chiaveGiorno(giornoDi(t.inizio))) && !nonChiesti.includes(t.id)
  }).sort((a, b) => a.inizio - b.inizio)
}

export const giornoDellaSettimana = (ms: number) => giornoSettimana(giornoDi(ms))
