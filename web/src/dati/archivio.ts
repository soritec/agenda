import { openDB, type IDBPDatabase } from 'idb'
import { IMPOSTAZIONI_PREDEFINITE, NOMI_COLLEZIONI, type Base, type Collezioni, type Impostazioni, type NomeCollezione } from './modello'
import type { Istantanea } from './fusione'

/**
 * Archivio locale (IndexedDB) del dispositivo. È la fonte dei dati dell'app: funziona senza rete,
 * e la sincronizzazione con GitHub (passo successivo) fonderà questo archivio con quello remoto.
 */

const NOME_DB = 'agenda'
const VERSIONE_DB = 10

/** `sincronizzazione` = la modifica arriva da GitHub (non va rimandata indietro). */
export type OrigineModifica = 'utente' | 'sincronizzazione'
type Ascoltatore = (origine: OrigineModifica) => void
const ascoltatori = new Set<Ascoltatore>()

let db: Promise<IDBPDatabase> | undefined

function apri(): Promise<IDBPDatabase> {
  db ??= openDB(NOME_DB, VERSIONE_DB, {
    // Un'altra scheda con una versione più nuova dell'app deve aggiornare l'archivio: questa si ricarica.
    blocking() { if (typeof location !== 'undefined') location.reload() },
    upgrade(database, vecchiaVersione) {
      // Ogni nuova versione aggiunge qui i suoi passi, senza mai toccare quelli precedenti.
      if (vecchiaVersione < 1) {
        for (const nome of ['enti', 'sedi', 'modelliTurno', 'turni']) database.createObjectStore(nome, { keyPath: 'id' })
        database.createObjectStore('impostazioni')
      }
      if (vecchiaVersione < 2) {
        // Gli enti non si usano più: l'archivio resta (vuoto o con i vecchi dati) per non perdere nulla.
        database.createObjectStore('periodiRotazione', { keyPath: 'id' })
      }
      if (vecchiaVersione < 3) {
        database.createObjectStore('ferie', { keyPath: 'id' })
      }
      if (vecchiaVersione < 4) {
        database.createObjectStore('assegnazioni', { keyPath: 'id' })
      }
      if (vecchiaVersione < 5) {
        for (const nome of ['tipiProcedura', 'procedure', 'esami', 'collegamenti']) database.createObjectStore(nome, { keyPath: 'id' })
      }
      if (vecchiaVersione < 6) {
        database.createObjectStore('tasse', { keyPath: 'id' })
        database.createObjectStore('allegati', { keyPath: 'id' })
        // Contenuto dei file allegati (chiave = id dell'allegato): non fa parte dell'istantanea sincronizzata.
        database.createObjectStore('file')
      }
      if (vecchiaVersione < 7) {
        database.createObjectStore('eventi', { keyPath: 'id' })
      }
      if (vecchiaVersione < 8) {
        database.createObjectStore('attivita', { keyPath: 'id' })
      }
      if (vecchiaVersione < 9) {
        for (const nome of ['categorieBudget', 'movimenti', 'ricorrenti']) database.createObjectStore(nome, { keyPath: 'id' })
      }
      if (vecchiaVersione < 10) {
        database.createObjectStore('noteGiorno', { keyPath: 'id' })
      }
    },
  })
  return db
}

/** Solo per i test: chiude e dimentica la connessione. */
export async function chiudiPerTest() {
  if (db) (await db).close()
  db = undefined
}

function notifica(origine: OrigineModifica = 'utente') {
  for (const a of ascoltatori) a(origine)
}

/** Avvisa quando i dati cambiano; restituisce la funzione per smettere di ascoltare. */
export function ascolta(a: Ascoltatore): () => void {
  ascoltatori.add(a)
  return () => ascoltatori.delete(a)
}

export function nuovoId(): string {
  return crypto.randomUUID()
}

/** Tutti i record non eliminati della collezione. */
export async function elenca<N extends NomeCollezione>(nome: N): Promise<Collezioni[N][]> {
  const tutti = (await (await apri()).getAll(nome)) as Collezioni[N][]
  return tutti.filter((r) => r.eliminatoIl === undefined)
}

/** Tutti i record, compresi quelli eliminati (per backup e sincronizzazione). */
export async function elencaTutti<N extends NomeCollezione>(nome: N): Promise<Collezioni[N][]> {
  return (await (await apri()).getAll(nome)) as Collezioni[N][]
}

type DatiNuovi<N extends NomeCollezione> = Omit<Collezioni[N], 'id' | 'creatoIl' | 'modificatoIl' | 'eliminatoIl'> & { id?: string }

/** Crea o aggiorna un record; gestisce da solo id e date di modifica. */
export async function salva<N extends NomeCollezione>(nome: N, dati: DatiNuovi<N> | Collezioni[N]): Promise<Collezioni[N]> {
  const database = await apri()
  const ora = Date.now()
  const esistente = dati.id ? ((await database.get(nome, dati.id)) as Collezioni[N] | undefined) : undefined
  const record = {
    ...dati,
    id: dati.id ?? nuovoId(),
    creatoIl: esistente?.creatoIl ?? ora,
    modificatoIl: ora,
  } as Collezioni[N]
  await database.put(nome, record)
  notifica()
  return record
}

/** Salva più record in un'unica operazione (es. inserimento multiplo di turni). */
export async function salvaTanti<N extends NomeCollezione>(nome: N, elenco: DatiNuovi<N>[]): Promise<Collezioni[N][]> {
  const database = await apri()
  const tx = database.transaction(nome, 'readwrite')
  const ora = Date.now()
  const record = elenco.map((dati) => {
    const creatoIl = (dati as { creatoIl?: number }).creatoIl
    return { ...dati, id: dati.id ?? nuovoId(), creatoIl: creatoIl ?? ora, modificatoIl: ora } as Collezioni[N]
  })
  await Promise.all([...record.map((r) => tx.store.put(r)), tx.done])
  notifica()
  return record
}

/** Eliminazione "morbida": il record resta come lapide, così l'eliminazione si propaga agli altri dispositivi. */
export async function elimina(nome: NomeCollezione, id: string): Promise<void> {
  const database = await apri()
  const record = await database.get(nome, id)
  if (!record) return
  const ora = Date.now()
  await database.put(nome, { ...record, eliminatoIl: ora, modificatoIl: ora })
  notifica()
}

/** Annulla un'eliminazione (es. tasto "Annulla" dopo aver tolto un turno). */
export async function ripristina(nome: NomeCollezione, id: string): Promise<void> {
  const database = await apri()
  const record = await database.get(nome, id)
  if (!record) return
  const { eliminatoIl: _, ...resto } = record as { eliminatoIl?: number }
  await database.put(nome, { ...resto, modificatoIl: Date.now() })
  notifica()
}

export async function leggiImpostazioni(): Promise<Impostazioni> {
  const salvate = (await (await apri()).get('impostazioni', 'generali')) as Partial<Impostazioni> | undefined
  return { ...IMPOSTAZIONI_PREDEFINITE, ...salvate }
}

export async function salvaImpostazioni(modifiche: Partial<Impostazioni>): Promise<Impostazioni> {
  const nuove = { ...(await leggiImpostazioni()), ...modifiche, modificatoIl: Date.now() }
  await (await apri()).put('impostazioni', nuove, 'generali')
  notifica()
  return nuove
}

/** Tutti i dati del dispositivo, compresi i record eliminati (per sincronizzazione e backup). */
export async function istantaneaLocale(): Promise<Istantanea> {
  const database = await apri()
  const collezioni: Istantanea['collezioni'] = {}
  for (const nome of NOMI_COLLEZIONI) collezioni[nome] = (await database.getAll(nome)) as Base[]
  const impostazioni = (await database.get('impostazioni', 'generali')) as Istantanea['impostazioni']
  return { formato: 1, creataIl: Date.now(), collezioni, impostazioni }
}

/** Scrive record così come sono (senza toccare le date): usato per i dati arrivati da GitHub o da un backup. */
export async function scriviGrezzi(
  record: Partial<Record<NomeCollezione, Base[]>>,
  impostazioni?: Istantanea['impostazioni'],
  origine: OrigineModifica = 'sincronizzazione',
): Promise<void> {
  const database = await apri()
  for (const [nome, elenco] of Object.entries(record) as [NomeCollezione, Base[]][]) {
    if (!NOMI_COLLEZIONI.includes(nome) || !elenco.length) continue
    const tx = database.transaction(nome, 'readwrite')
    await Promise.all([...elenco.map((r) => tx.store.put(r)), tx.done])
  }
  if (impostazioni) await database.put('impostazioni', impostazioni, 'generali')
  notifica(origine)
}

/** Dati del collegamento con GitHub: solo su questo dispositivo, mai sincronizzati. */
export interface ConfigurazioneSincronizzazione {
  token: string
  proprietario: string
  repository: string
  /** Chiave AES non esportabile, ricavata dalla password: evita di riscriverla a ogni apertura. */
  chiave: CryptoKey
  sha?: string
  ultimaSincronizzazione?: number
}

export async function leggiConfigurazioneSincronizzazione(): Promise<ConfigurazioneSincronizzazione | undefined> {
  return (await (await apri()).get('impostazioni', 'sincronizzazione')) as ConfigurazioneSincronizzazione | undefined
}

export async function salvaConfigurazioneSincronizzazione(c: ConfigurazioneSincronizzazione | undefined): Promise<void> {
  const database = await apri()
  if (c) await database.put('impostazioni', c, 'sincronizzazione')
  else await database.delete('impostazioni', 'sincronizzazione')
}

/* Contenuto dei file allegati */

export async function leggiContenuto(id: string): Promise<Blob | undefined> {
  return (await (await apri()).get('file', id)) as Blob | undefined
}

export async function salvaContenuto(id: string, contenuto: Blob): Promise<void> {
  await (await apri()).put('file', contenuto, id)
}
