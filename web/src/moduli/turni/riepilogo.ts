import { aggiungiGiorni, giornoDi, inizioGiorno, intervalloMese } from '../../nucleo/calendario'
import { eFestivo, SABATO_FESTIVO_PREDEFINITO } from '../../nucleo/festivita'
import { minuti, type DatiTurno, type TipoTurno } from './tipi'

/**
 * Riepilogo di un mese di turni. Regole:
 * - un turno appartiene al mese in cui **inizia**;
 * - "notte" = turno di tipo `guardiaNotturna`;
 * - turno festivo = tipo `festivo` oppure turno che inizia in un giorno festivo
 *   (domenica, sabato se impostato, festività nazionale);
 * - `minutiInGiorniFestivi` conta i minuti lavorati in giorni festivi (anche la parte festiva di una notte);
 * - le ore di un turno sono quelle inserite a mano, se presenti;
 * - i compensi sono solo la somma di quelli inseriti a mano: l'app non li calcola.
 */
export interface RiepilogoMensile {
  anno: number
  mese: number
  numeroTurni: number
  minutiTotali: number
  minutiPerSede: Map<string | undefined, number>
  minutiPerTipo: Map<TipoTurno, number>
  turniPerTipo: Map<TipoTurno, number>
  notti: number
  turniFestivi: number
  minutiInGiorniFestivi: number
  compensoCent: number
}

export interface OpzioniRiepilogo {
  sabatoFestivo?: boolean
}

function somma<K>(mappa: Map<K, number>, chiave: K, valore: number) {
  mappa.set(chiave, (mappa.get(chiave) ?? 0) + valore)
}

export function calcolaRiepilogo(turni: DatiTurno[], anno: number, mese: number, opzioni: OpzioniRiepilogo = {}): RiepilogoMensile {
  const sabatoFestivo = opzioni.sabatoFestivo ?? SABATO_FESTIVO_PREDEFINITO
  const periodo = intervalloMese(anno, mese)
  const r: RiepilogoMensile = {
    anno, mese, numeroTurni: 0, minutiTotali: 0,
    minutiPerSede: new Map(), minutiPerTipo: new Map(), turniPerTipo: new Map(),
    notti: 0, turniFestivi: 0, minutiInGiorniFestivi: 0, compensoCent: 0,
  }

  for (const turno of turni) {
    if (turno.inizio < periodo.inizio || turno.inizio >= periodo.fine) continue
    const m = minuti(turno)
    r.numeroTurni += 1
    r.minutiTotali += m
    somma(r.minutiPerSede, turno.sedeId, m)
    somma(r.minutiPerTipo, turno.tipo, m)
    somma(r.turniPerTipo, turno.tipo, 1)
    if (turno.compensoCent !== undefined) r.compensoCent += turno.compensoCent
    if (turno.tipo === 'guardiaNotturna') r.notti += 1
    if (turno.tipo === 'festivo' || eFestivo(turno.inizio, { sabatoFestivo })) r.turniFestivi += 1
    r.minutiInGiorniFestivi += minutiFestivi(turno, sabatoFestivo)
  }
  return r
}

/** Minuti del turno che cadono in giorni festivi, spezzando il turno a ogni mezzanotte. */
export function minutiFestivi(turno: DatiTurno, sabatoFestivo: boolean): number {
  let totale = 0
  let giorno = giornoDi(turno.inizio)
  let inizio = inizioGiorno(giorno)
  while (inizio < turno.fine) {
    const dopo = aggiungiGiorni(giorno, 1)
    const inizioDopo = inizioGiorno(dopo)
    if (eFestivo(inizio, { sabatoFestivo })) {
      const da = Math.max(inizio, turno.inizio), a = Math.min(inizioDopo, turno.fine)
      if (a > da) totale += a - da
    }
    giorno = dopo
    inizio = inizioDopo
  }
  // Con le ore inserite a mano, le ore festive non possono superare le ore del turno.
  return Math.min(Math.round(totale / 60_000), minuti(turno))
}
