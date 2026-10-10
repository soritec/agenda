import type { GiornoMese } from '../nucleo/festivita'
import type { StatoTurno, TipoRapporto } from '../moduli/turni/tipi'

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

export interface Ente extends Base {
  nome: string
  tipoRapporto: TipoRapporto
  note?: string
}

export interface Sede extends Base {
  nome: string
  indirizzo?: string
  minutiViaggio?: number
  enteId?: string
  /** Santo patrono della città della sede: giorno festivo per i turni lì. */
  patrono?: GiornoMese
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
  enteId?: string
  ordine: number
}

export interface Turno extends Base {
  inizio: number
  fine: number
  tipo: string
  stato: StatoTurno
  sedeId?: string
  enteId?: string
  modelloId?: string
  /** Ore inserite a mano, in minuti. */
  minutiManuali?: number
  /** Compenso inserito a mano, in centesimi. L'app non lo calcola mai. */
  compensoCent?: number
  note?: string
  origine: 'manuale' | 'importato'
  importazioneId?: string
}

export interface Impostazioni {
  sabatoFestivo: boolean
  riposoMinimoMinuti: number
  /** Mostra il tipo "Reperibilità" (disattivato di default). */
  usaReperibilita: boolean
  /** Se usata, la reperibilità conta nelle ore del mese e nel riposo minimo. */
  reperibilitaContaComeLavoro: boolean
}

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  sabatoFestivo: true,
  riposoMinimoMinuti: 11 * 60,
  usaReperibilita: false,
  reperibilitaContaComeLavoro: false,
}

export interface Collezioni {
  enti: Ente
  sedi: Sede
  modelliTurno: ModelloTurno
  turni: Turno
}
export type NomeCollezione = keyof Collezioni
export const NOMI_COLLEZIONI: NomeCollezione[] = ['enti', 'sedi', 'modelliTurno', 'turni']
