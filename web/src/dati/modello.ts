import type { AreaRotazione } from '../moduli/turni/rotazione'
import type { StatoTurno } from '../moduli/turni/tipi'

/**
 * Campi comuni a tutti i record. Pensati per la sincronizzazione futura con GitHub:
 * - `id` stabile (UUID) per fondere i dati tra dispositivi;
 * - `modificatoIl` per decidere quale versione vince;
 * - `eliminatoIl` invece della cancellazione fisica, così l'eliminazione arriva anche sugli altri dispositivi.
 */
export interface Base {
  id: string
  creatoIl: number
  modificatoIl: number
  eliminatoIl?: number
}

export interface Sede extends Base {
  nome: string
  indirizzo?: string
  /** Tempo di viaggio, calcolato dall'indirizzo di casa o inserito a mano. */
  minutiViaggio?: number
}

export interface ModelloTurno extends Base {
  nome: string
  /** Una o due lettere mostrate nel calendario (es. "N"). */
  sigla: string
  /** Tipo grezzo (vedi `tipoTurnoDa`), salvato come stringa. */
  tipo: string
  minutoInizio: number
  minutoFine: number
  sedeId?: string
  ordine: number
}

export interface Turno extends Base {
  inizio: number
  fine: number
  tipo: string
  stato: StatoTurno
  sedeId?: string
  modelloId?: string
  /** Ore inserite a mano, in minuti. */
  minutiManuali?: number
  /** Compenso inserito a mano, in centesimi. L'app non lo calcola mai. */
  compensoCent?: number
  note?: string
  origine: 'manuale' | 'importato'
  importazioneId?: string
}

/** Area della rotazione scelta dall'utente a partire da un mese (vedi `rotazione.ts`). */
export interface PeriodoRotazione extends Base {
  /** "2026-10" */
  meseInizio: string
  area: AreaRotazione
}

export interface Impostazioni {
  sabatoFestivo: boolean
  /** Punto di partenza per il calcolo dei tempi di viaggio. */
  indirizzoCasa?: string
}

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  sabatoFestivo: true,
}

export interface Collezioni {
  sedi: Sede
  modelliTurno: ModelloTurno
  turni: Turno
  periodiRotazione: PeriodoRotazione
}
export type NomeCollezione = keyof Collezioni
export const NOMI_COLLEZIONI: NomeCollezione[] = ['sedi', 'modelliTurno', 'turni', 'periodiRotazione']
