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
  /** Turno senza orari: occupa la giornata, le ore contano solo se inserite a mano. */
  tuttoIlGiorno?: boolean
  sedeId?: string
  ordine: number
}

export interface Turno extends Base {
  inizio: number
  fine: number
  tipo: string
  stato: StatoTurno
  /** Senza orari: `inizio` = mezzanotte del giorno, `fine` = mezzanotte del giorno dopo. */
  tuttoIlGiorno?: boolean
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

/** Giornata senza turno: ferie, riposo, congresso, smonto notte (archivio "ferie" per compatibilità). */
export interface GiornataSpeciale extends Base {
  /** "2026-10-21" */
  giorno: string
  /** Assente nei record più vecchi = ferie. */
  tipo?: string
  /** Smonto notte creato in automatico dopo questa guardia notturna. */
  turnoId?: string
}

/** Ospedale di assegnazione per un periodo: la sede vale per tutti i turni del periodo che non ne hanno una propria. */
export interface Assegnazione extends Base {
  /** "2026-10" */
  meseInizio: string
  mesi: number
  sedeId: string
}

/* Specializzazione */

/** Voce dell'elenco (modificabile) dei tipi di procedura del logbook. */
export interface TipoProcedura extends Base {
  nome: string
  ordine: number
  /** Procedura chirurgica (per filtrare e raggruppare il logbook). */
  chirurgica?: boolean
  /** Link per studiare la procedura (es. video su WebSurg). */
  link?: { titolo: string; url: string }[]
  /** Appunti personali sulla procedura. */
  appunti?: string
}

/** Procedura del logbook. Solo dati anonimi: niente nomi, date di nascita, codici fiscali o indirizzi. */
export interface Procedura extends Base {
  /** "2026-10-21" */
  giorno: string
  tipoId: string
  /** 'primo' | 'secondo' | 'osservatore' */
  ruolo: string
  /** 1–5: anno di specializzazione in cui è stata fatta. */
  annoCorso: number
  sedeId?: string
  /** Dati anonimi facoltativi. */
  eta?: number
  settimane?: string
  esito?: string
  note?: string
}

export interface EsameOLezione extends Base {
  giorno: string
  /** 'esame' | 'lezione' */
  tipo: string
  titolo: string
  materia?: string
  /** Esito o voto. */
  esito?: string
  note?: string
  /** Segnato come completato (anche prima della data). */
  completato?: boolean
}

export interface Tassa extends Base {
  descrizione: string
  importoCent: number
  /** "2026-10-31" */
  scadenza?: string
  /** 'daPagare' | 'pagato' */
  stato: string
  pagatoIl?: string
  note?: string
}

/**
 * File allegato (es. appunti in PDF, referto anonimizzato). Il record si sincronizza con gli altri dati;
 * il contenuto sta in un archivio a parte e su GitHub in un file cifrato separato.
 */
export interface Allegato extends Base {
  nome: string
  tipoMime: string
  dimensione: number
  /** "tipoProcedura:<id>" oppure "procedura:<id>" */
  collegatoA: string
  /** Il contenuto cifrato è già su GitHub (gli altri dispositivi possono scaricarlo). */
  caricato?: boolean
}

export interface Collegamento extends Base {
  titolo: string
  url: string
  categoria: string
  ordine: number
}

export interface Impostazioni {
  sabatoFestivo: boolean
  /** Punto di partenza per il calcolo dei tempi di viaggio. */
  indirizzoCasa?: string
  /** Correzioni una tantum già applicate ai dati (vedi `manutenzione.ts`). */
  correzioniApplicate?: string[]
  /** Inizio della specializzazione ("2024-11"): serve a calcolare l'anno di corso. */
  inizioSpecializzazione?: string
  /** Durata della scuola in anni. */
  anniSpecializzazione?: number
  /** Per la sincronizzazione: vince l'impostazione modificata più di recente. */
  modificatoIl?: number
}

export const IMPOSTAZIONI_PREDEFINITE: Impostazioni = {
  sabatoFestivo: true,
}

export interface Collezioni {
  sedi: Sede
  modelliTurno: ModelloTurno
  turni: Turno
  periodiRotazione: PeriodoRotazione
  ferie: GiornataSpeciale
  assegnazioni: Assegnazione
  tipiProcedura: TipoProcedura
  procedure: Procedura
  esami: EsameOLezione
  collegamenti: Collegamento
  tasse: Tassa
  allegati: Allegato
}
export type NomeCollezione = keyof Collezioni
export const NOMI_COLLEZIONI: NomeCollezione[] = ['sedi', 'modelliTurno', 'turni', 'periodiRotazione', 'ferie', 'assegnazioni', 'tipiProcedura', 'procedure', 'esami', 'collegamenti', 'tasse', 'allegati']
