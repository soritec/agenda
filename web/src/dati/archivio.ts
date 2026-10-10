import { openDB, type IDBPDatabase } from 'idb'
import { IMPOSTAZIONI_PREDEFINITE, type Collezioni, type Impostazioni, type NomeCollezione } from './modello'

/**
 * Archivio locale (IndexedDB) del dispositivo. È la fonte dei dati dell'app: funziona senza rete,
 * e la sincronizzazione con GitHub (passo successivo) fonderà questo archivio con quello remoto.
 */

const NOME_DB = 'agenda'
const VERSIONE_DB = 3

type Ascoltatore = () => void
const ascoltatori = new Set<Ascoltatore>()

let db: Promise<IDBPDatabase> | undefined

function apri(): Promise<IDBPDatabase> {
  db ??= openDB(NOME_DB, VERSIONE_DB, {
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
    },
  })
  return db
}

/** Solo per i test: chiude e dimentica la connessione. */
export async function chiudiPerTest() {
  if (db) (await db).close()
  db = undefined
}

function notifica() {
  for (const a of ascoltatori) a()
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
  const record = elenco.map((dati) => ({ ...dati, id: dati.id ?? nuovoId(), creatoIl: ora, modificatoIl: ora }) as Collezioni[N])
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
  const nuove = { ...(await leggiImpostazioni()), ...modifiche }
  await (await apri()).put('impostazioni', nuove, 'generali')
  notifica()
  return nuove
}
