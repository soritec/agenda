/**
 * Valori salvati come stringhe. Se un dispositivo con una versione più recente dell'app ha scritto
 * un valore che questa versione non conosce, lo si mostra con il valore di ripiego ma il dato salvato
 * resta quello originale (vedi `tipoTurnoDa`).
 */

export const TIPI_TURNO = [
  'ambulatorio',
  'guardiaDiurna',
  'guardiaNotturna',
  'ecografia',
  'salaOperatoria',
  'sostituzioneMMG',
  'festivo',
  'domiciliare',
  'reparto',
  'altro',
] as const
export type TipoTurno = (typeof TIPI_TURNO)[number]

export const TITOLI_TIPO_TURNO: Record<TipoTurno, string> = {
  ambulatorio: 'Ambulatorio',
  guardiaDiurna: 'Guardia diurna',
  guardiaNotturna: 'Guardia notturna',
  ecografia: 'Ecografia',
  salaOperatoria: 'Sala operatoria',
  sostituzioneMMG: 'Sostituzione MMG',
  festivo: 'Festivo',
  domiciliare: 'Domiciliare',
  reparto: 'Reparto',
  altro: 'Nessun tipo',
}

export function tipoTurnoDa(grezzo: string): TipoTurno {
  return (TIPI_TURNO as readonly string[]).includes(grezzo) ? (grezzo as TipoTurno) : 'ambulatorio'
}

export const STATI_TURNO = ['pianificato', 'svolto', 'pagato'] as const
export type StatoTurno = (typeof STATI_TURNO)[number]

/** Fotografia di un turno usata da tutti i calcoli. Istanti in millisecondi da epoch. */
export interface DatiTurno {
  id: string
  inizio: number
  fine: number
  tipo: TipoTurno
  sedeId?: string
  /** Turno senza orari specifici: le ore contano solo se inserite a mano. */
  tuttoIlGiorno?: boolean
  /** Ore inserite a mano (in minuti): se presenti sostituiscono la durata calcolata dagli orari. */
  minutiManuali?: number
  /** Compenso inserito a mano, se l'utente vuole. L'app non calcola mai compensi. */
  compensoCent?: number
}

/** Durata calcolata dagli orari (tiene conto del cambio dell'ora legale). */
export function minutiDaOrari(t: DatiTurno): number {
  return Math.max(0, Math.round((t.fine - t.inizio) / 60_000))
}

/** Ore che contano nei totali: quelle inserite a mano se ci sono, altrimenti quelle calcolate. */
export function minuti(t: DatiTurno): number {
  if (t.minutiManuali !== undefined) return Math.max(0, t.minutiManuali)
  return t.tuttoIlGiorno ? 0 : minutiDaOrari(t)
}

/** Giornate senza turno, segnate sul calendario. */
export const TIPI_GIORNATA = ['ferie', 'riposo', 'congresso', 'smontoNotte'] as const
export type TipoGiornata = (typeof TIPI_GIORNATA)[number]
export const TITOLI_GIORNATA: Record<TipoGiornata, string> = { ferie: 'Ferie', riposo: 'Riposo', congresso: 'Congresso', smontoNotte: 'Smonto notte' }
/** Etichetta corta nel calendario. */
export const ETICHETTE_GIORNATA: Record<TipoGiornata, string> = { ferie: 'Ferie', riposo: 'Riposo', congresso: 'Congr.', smontoNotte: 'Smonto' }

export function tipoGiornataDa(grezzo: string | undefined): TipoGiornata {
  return (TIPI_GIORNATA as readonly string[]).includes(grezzo ?? '') ? (grezzo as TipoGiornata) : 'ferie'
}
