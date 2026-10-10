/**
 * Valori salvati come stringhe. Se un dispositivo con una versione più recente dell'app ha scritto
 * un valore che questa versione non conosce, lo si mostra con il valore di ripiego ma il dato salvato
 * resta quello originale (vedi `tipoTurnoDa`).
 */

export const TIPI_TURNO = [
  'ambulatorio',
  'guardiaDiurna',
  'guardiaNotturna',
  'sostituzioneMMG',
  'festivo',
  'reperibilita',
  'domiciliare',
  'reparto',
] as const
export type TipoTurno = (typeof TIPI_TURNO)[number]

export const TITOLI_TIPO_TURNO: Record<TipoTurno, string> = {
  ambulatorio: 'Ambulatorio',
  guardiaDiurna: 'Guardia diurna',
  guardiaNotturna: 'Guardia notturna',
  sostituzioneMMG: 'Sostituzione MMG',
  festivo: 'Festivo',
  reperibilita: 'Reperibilità',
  domiciliare: 'Domiciliare',
  reparto: 'Reparto',
}

/** Tipi disattivati di default: compaiono solo se l'utente li attiva nelle Impostazioni. */
export const TIPI_OPZIONALI: ReadonlySet<TipoTurno> = new Set(['reperibilita'])

export function tipoTurnoDa(grezzo: string): TipoTurno {
  return (TIPI_TURNO as readonly string[]).includes(grezzo) ? (grezzo as TipoTurno) : 'ambulatorio'
}

export const STATI_TURNO = ['pianificato', 'svolto', 'pagato'] as const
export type StatoTurno = (typeof STATI_TURNO)[number]

export const TIPI_RAPPORTO = ['dipendente', 'convenzionato', 'liberaProfessione'] as const
export type TipoRapporto = (typeof TIPI_RAPPORTO)[number]

/** Fotografia di un turno usata da tutti i calcoli. Istanti in millisecondi da epoch. */
export interface DatiTurno {
  id: string
  inizio: number
  fine: number
  tipo: TipoTurno
  sedeId?: string
  enteId?: string
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
  return t.minutiManuali !== undefined ? Math.max(0, t.minutiManuali) : minutiDaOrari(t)
}
