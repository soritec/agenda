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
  /** Argomenti da ripassare per questo esame (sezione Studio). */
  argomenti?: { testo: string; fatto?: boolean }[]
}

/** Corso o congresso con crediti ECM (attestati come allegati "corso:<id>"). */
export interface Corso extends Base {
  /** 'corso' | 'congresso' (assente nei vecchi record = corso) */
  tipo?: string
  titolo: string
  giorno: string
  ente?: string
  crediti?: number
  ore?: number
  note?: string
}

/** Articolo da presentare al journal club (compare anche in Agenda). */
export interface JournalClub extends Base {
  titolo: string
  giorno: string
  rivista?: string
  link?: string
  presentato?: boolean
  note?: string
}

/* Studio e risorse */

export interface ArgomentoStudio extends Base {
  nome: string
  ordine: number
}

/** Linea guida, articolo, libro, video, corso o sito (allegati "risorsa:<id>"). */
export interface Risorsa extends Base {
  titolo: string
  /** 'lineaGuida' | 'articolo' | 'libro' | 'video' | 'sito' */
  tipo: string
  url?: string
  argomentoId?: string
  /** 'daLeggere' | 'inLettura' | 'letto' */
  stato: string
  /** 0–100, per i libri in lettura. */
  progresso?: number
  preferito?: boolean
  note?: string
}

export interface Appunto extends Base {
  titolo: string
  testo: string
  argomentoId?: string
}

/** Flashcard con ripetizione a scatole: più la sai, più tardi ritorna. */
export interface Flashcard extends Base {
  domanda: string
  risposta: string
  argomentoId?: string
  /** 1–5 */
  scatola: number
  /** Giorno del prossimo ripasso ("2026-10-12"). */
  prossima: string
}

/** Piano di studio (es. per un esame): argomenti con fonti e pagine, divisi in sessioni nei giorni. */
export interface PianoStudio extends Base {
  nome: string
  colore: string
  /** Primo giorno di studio. */
  inizio: string
  /** Giorno dell'esame o della scadenza (non si studia quel giorno). */
  fine: string
  esameId?: string
  /** Minuti di studio al giorno. */
  minutiAlGiorno: number
  /** Giorni della settimana in cui si studia (1 = lunedì … 7 = domenica). */
  giorniSettimana: number[]
  /** Ripassi automatici dopo 1, 7 e 30 giorni. */
  ripassi?: boolean
  syllabus?: string
  argomenti: ArgomentoPiano[]
}

export interface ArgomentoPiano {
  id: string
  nome: string
  /** Risorsa della libreria (facoltativa) oppure testo libero (es. "Williams cap. 40"). */
  risorsaId?: string
  fonte?: string
  paginaDa?: number
  paginaA?: number
}

/** Una sessione del piano in un giorno: studio di un argomento (pagine), ripasso o esame. */
export interface SessionePiano extends Base {
  pianoId: string
  giorno: string
  /** 'studio' | 'ripasso' | 'ripassoGenerale' */
  tipo: string
  argomentoId?: string
  titolo: string
  paginaDa?: number
  paginaA?: number
  minuti: number
  fatta?: boolean
  minutiFatti?: number
  /** L'utente ha scelto di tenerla anche se quel giorno sembra occupato. */
  tieni?: boolean
}

/* Journaling */

/** Taccuino del diario: copertina con colore, icona, trama o foto (allegato "copertina:<id>"); lucchetto facoltativo. */
export interface Taccuino extends Base {
  nome: string
  colore: string
  icona: string
  /** 'nessuna' | 'righe' | 'puntini' | 'quadretti' */
  trama?: string
  /** Codice del lucchetto, salvato solo come impronta (hash) con il suo sale. */
  lucchetto?: { sale: string; impronta: string }
  ordine: number
}

/** Umore di un giorno segnato direttamente dal calendario (senza scrivere una pagina). Id = giorno. */
export interface UmoreGiorno extends Base {
  giorno: string
  /** 'bene' | 'neutro' | 'cosi' | 'pesante' */
  umore: string
}

/* Habit tracker */

export interface Abitudine extends Base {
  nome: string
  colore: string
  /** 'fare' | 'evitare' (il pallino si riempie se ci sei riuscita) */
  tipo: string
  /** Volte a settimana (assente = ogni giorno). */
  volteSettimana?: number
  ordine: number
}

/** Abitudine fatta in un giorno. Id = "<abitudineId>:<giorno>". */
export interface SegnoAbitudine extends Base {
  abitudineId: string
  giorno: string
}

/** Post-it sulla pagina Oggi: posizione libera (x in percentuale della larghezza, y in pixel). */
export interface PostIt extends Base {
  /** Sezione dell'app dove sta (assente nei primi = oggi). */
  pagina?: string
  archiviato?: boolean
  testo: string
  colore: string
  x: number
  y: number
  z: number
}

/** Pagina di un taccuino (foto come allegati "pagina:<id>"). */
export interface PaginaDiario extends Base {
  taccuinoId: string
  giorno: string
  titolo: string
  /** Testo formattato (HTML ripulito: grassetto, corsivo, titoletti, elenchi, liste da spuntare, citazioni). */
  testo: string
  /** 'bene' | 'neutro' | 'cosi' | 'pesante' */
  umore?: string
  etichette?: string[]
}

/** Tempo di studio registrato dal timer (o a mano). */
export interface SessioneStudio extends Base {
  giorno: string
  minuti: number
  argomentoId?: string
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

/* Agenda */

/** Nota fissata su un giorno dell'agenda (es. "Inizia il 2° scorrimento"), anche per più giorni. */
export interface NotaGiorno extends Base {
  testo: string
  /** "2026-09-12" */
  giorno: string
  giornoFine?: string
}

/** Impegno dell'agenda che non è un turno (visita, riunione, appuntamento, viaggio…). */
export interface Evento extends Base {
  titolo: string
  /** "2026-10-21" */
  giorno: string
  /** Ultimo giorno, per gli impegni di più giorni (assente = un solo giorno). */
  giornoFine?: string
  /** Senza orari: occupa tutta la giornata. */
  tuttoIlGiorno?: boolean
  /** Minuti dalla mezzanotte (ora italiana). */
  minutoInizio?: number
  minutoFine?: number
  luogo?: string
  /** 'personale' | 'lavoro' | 'studio' | 'altro' */
  categoria: string
  note?: string
}

/* Task (nel codice "Attivita": "Task" è già un nome riservato in altri linguaggi) */

export interface Attivita extends Base {
  titolo: string
  note?: string
  /** "2026-10-21": giorno entro cui farla (facoltativo). */
  scadenza?: string
  /** Minuti dalla mezzanotte, solo se c'è una scadenza. */
  minuto?: number
  /** 'alta' | 'normale' */
  priorita: string
  /** 'personale' | 'lavoro' | 'specializzazione' | 'studio' | 'altro' */
  area: string
  /** 'mai' | 'giorno' | 'settimana' | 'mese' | 'anno': completandola si crea la successiva. */
  ripeti?: string
  /** Piccola lista di passi da spuntare. */
  passi?: { testo: string; fatto?: boolean }[]
  /** Istante in cui è stata completata. */
  completataIl?: number
}

/* Budget */

export interface CategoriaBudget extends Base {
  nome: string
  /** 'entrata' | 'uscita' */
  tipo: string
  /** Colore della categoria (esadecimale). */
  colore: string
  /** Tetto mensile di spesa, in centesimi (solo uscite, facoltativo). */
  tettoCent?: number
  /** Entrate da lavoro extra (sostituzioni, libera professione): nuove voci "da incassare". */
  extra?: boolean
  /** Uscite di formazione e lavoro, raggruppate nei riepiloghi. */
  lavoro?: boolean
  ordine: number
}

export interface Movimento extends Base {
  /** 'entrata' | 'uscita' | 'risparmio' (messo da parte) | 'prelievo' (ripreso dai risparmi) */
  tipo: string
  importoCent: number
  /** "2026-10-21" */
  giorno: string
  categoriaId: string
  nota?: string
  /** Entrata non ancora ricevuta. */
  daIncassare?: boolean
  /** Per risparmi e prelievi: l'obiettivo a cui vanno (assente = risparmi generici). */
  obiettivoId?: string
}

/** Obiettivo di risparmio (es. "Vacanza estate", 2000 € entro giugno 2027). */
export interface ObiettivoRisparmio extends Base {
  nome: string
  importoCent: number
  /** Mese entro cui raggiungerlo ("2027-06"), facoltativo. */
  entro?: string
}

/** Entrata o uscita che si ripete ogni mese o ogni anno: le singole volte si calcolano, non si salvano. */
export interface Ricorrente extends Base {
  tipo: string
  importoCent: number
  categoriaId: string
  descrizione: string
  /** 'mese' | 'anno' */
  frequenza: string
  /** Primo giorno ("2026-10-01"): fissa anche il giorno del mese (e il mese, se annuale). */
  inizio: string
  /** Ultimo mese compreso ("2027-06"), facoltativo. */
  fine?: string
  /** Mesi ("2026-11") in cui questa volta non vale. */
  saltati?: string[]
  obiettivoId?: string
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
  /** Obiettivo di studio settimanale, in minuti. */
  obiettivoStudioMinuti?: number
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
  eventi: Evento
  attivita: Attivita
  categorieBudget: CategoriaBudget
  movimenti: Movimento
  ricorrenti: Ricorrente
  noteGiorno: NotaGiorno
  obiettiviRisparmio: ObiettivoRisparmio
  corsi: Corso
  journalClub: JournalClub
  argomentiStudio: ArgomentoStudio
  risorse: Risorsa
  appunti: Appunto
  flashcard: Flashcard
  sessioniStudio: SessioneStudio
  pianiStudio: PianoStudio
  sessioniPiano: SessionePiano
  taccuini: Taccuino
  pagineDiario: PaginaDiario
  umoriGiorno: UmoreGiorno
  abitudini: Abitudine
  segniAbitudine: SegnoAbitudine
  postit: PostIt
}
export type NomeCollezione = keyof Collezioni
export const NOMI_COLLEZIONI: NomeCollezione[] = ['sedi', 'modelliTurno', 'turni', 'periodiRotazione', 'ferie', 'assegnazioni', 'tipiProcedura', 'procedure', 'esami', 'collegamenti', 'tasse', 'allegati', 'eventi', 'attivita', 'categorieBudget', 'movimenti', 'ricorrenti', 'noteGiorno', 'obiettiviRisparmio', 'corsi', 'journalClub', 'argomentiStudio', 'risorse', 'appunti', 'flashcard', 'sessioniStudio', 'pianiStudio', 'sessioniPiano', 'taccuini', 'pagineDiario', 'umoriGiorno', 'abitudini', 'segniAbitudine', 'postit']
