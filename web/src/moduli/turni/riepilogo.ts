import { aggiungiGiorni, giornoDi, inizioGiorno, intervalloMese } from '../../nucleo/calendario'
import { eFestivo, SABATO_FESTIVO_PREDEFINITO, type GiornoMese } from '../../nucleo/festivita'
import { minuti, type DatiTurno, type TipoTurno } from './tipi'

/**
 * Riepilogo di un mese di turni. Regole (vedi CLAUDE.md):
 * - un turno appartiene al mese in cui **inizia**;
 * - "notte" = turno di tipo `guardiaNotturna`;
 * - turno festivo = tipo `festivo` oppure turno che inizia in un giorno festivo
 *   (domenica, sabato se impostato, festività nazionale, santo patrono della sede);
 * - `minutiInGiorniFestivi` conta i minuti lavorati in giorni festivi (anche la parte festiva di una notte);
 * - i tipi in `esclusiDalleOre` (di default la reperibilità) non entrano nei totali di ore, festivi e notti,
 *   ma compaiono in `turniPerTipo` e `minutiPerTipo`;
 * - le ore di un turno sono quelle inserite a mano, se presenti;
 * - i compensi sono solo la somma di quelli inseriti a mano: l'app non li calcola.
 */
export interface RiepilogoMensile {
  anno: number
  mese: number
  numeroTurni: number
  minutiTotali: number
  minutiPerSede: Map<string | undefined, number>
  minutiPerEnte: Map<string | undefined, number>
  minutiPerTipo: Map<TipoTurno, number>
  turniPerTipo: Map<TipoTurno, number>
  notti: number
  turniFestivi: number
  minutiInGiorniFestivi: number
  compensoCent: number
  compensoPerEnte: Map<string | undefined, number>
}

export const ESCLUSI_DALLE_ORE_PREDEFINITI: ReadonlySet<TipoTurno> = new Set(['reperibilita'])

export interface OpzioniRiepilogo {
  patronoPerSede?: Map<string, GiornoMese>
  sabatoFestivo?: boolean
  esclusiDalleOre?: ReadonlySet<TipoTurno>
}

function somma<K>(mappa: Map<K, number>, chiave: K, valore: number) {
  mappa.set(chiave, (mappa.get(chiave) ?? 0) + valore)
}

export function calcolaRiepilogo(turni: DatiTurno[], anno: number, mese: number, opzioni: OpzioniRiepilogo = {}): RiepilogoMensile {
  const sabatoFestivo = opzioni.sabatoFestivo ?? SABATO_FESTIVO_PREDEFINITO
  const esclusi = opzioni.esclusiDalleOre ?? ESCLUSI_DALLE_ORE_PREDEFINITI
  const periodo = intervalloMese(anno, mese)
  const r: RiepilogoMensile = {
    anno, mese, numeroTurni: 0, minutiTotali: 0,
    minutiPerSede: new Map(), minutiPerEnte: new Map(), minutiPerTipo: new Map(), turniPerTipo: new Map(),
    notti: 0, turniFestivi: 0, minutiInGiorniFestivi: 0, compensoCent: 0, compensoPerEnte: new Map(),
  }

  for (const turno of turni) {
    if (turno.inizio < periodo.inizio || turno.inizio >= periodo.fine) continue
    const m = minuti(turno)
    somma(r.minutiPerTipo, turno.tipo, m)
    somma(r.turniPerTipo, turno.tipo, 1)
    if (turno.compensoCent !== undefined) {
      r.compensoCent += turno.compensoCent
      somma(r.compensoPerEnte, turno.enteId, turno.compensoCent)
    }
    if (esclusi.has(turno.tipo)) continue

    const patrono = turno.sedeId ? opzioni.patronoPerSede?.get(turno.sedeId) : undefined
    r.numeroTurni += 1
    r.minutiTotali += m
    somma(r.minutiPerSede, turno.sedeId, m)
    somma(r.minutiPerEnte, turno.enteId, m)
    if (turno.tipo === 'guardiaNotturna') r.notti += 1
    if (turno.tipo === 'festivo' || eFestivo(turno.inizio, { patrono, sabatoFestivo })) r.turniFestivi += 1
    r.minutiInGiorniFestivi += minutiFestivi(turno, patrono, sabatoFestivo)
  }
  return r
}

/** Minuti del turno che cadono in giorni festivi, spezzando il turno a ogni mezzanotte. */
export function minutiFestivi(turno: DatiTurno, patrono: GiornoMese | undefined, sabatoFestivo: boolean): number {
  let totale = 0
  let giorno = giornoDi(turno.inizio)
  let inizio = inizioGiorno(giorno)
  while (inizio < turno.fine) {
    const dopo = aggiungiGiorni(giorno, 1)
    const inizioDopo = inizioGiorno(dopo)
    if (eFestivo(inizio, { patrono, sabatoFestivo })) {
      const da = Math.max(inizio, turno.inizio), a = Math.min(inizioDopo, turno.fine)
      if (a > da) totale += a - da
    }
    giorno = dopo
    inizio = inizioDopo
  }
  // Con le ore inserite a mano, le ore festive non possono superare le ore del turno.
  return Math.min(Math.round(totale / 60_000), minuti(turno))
}
