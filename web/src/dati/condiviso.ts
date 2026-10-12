import { openDB, type IDBPDatabase } from 'idb'
import { useEffect, useState } from 'react'
import type { Base } from './modello'
import type { OrigineModifica } from './archivio'
import type { Istantanea } from './fusione'

/**
 * Archivio comune a tutti i profili: l'elenco dei profili, la chat e i promemoria che ci si manda.
 * Sul dispositivo è un database a parte; su GitHub un file cifrato a parte (`condiviso.cifrato.json`).
 */

export interface Profilo extends Base {
  nome: string
  colore: string
  /** Sezioni del menu visibili in questo profilo (assente = tutte). */
  moduli?: string[]
}

export interface Messaggio extends Base {
  da: string
  a: string
  testo: string
  /** Il destinatario l'ha visto. */
  letto?: boolean
}

export interface Promemoria extends Base {
  da: string
  a: string
  testo: string
  /** Giorno in cui va fatto ("2026-10-11"). */
  giorno: string
  fatto?: boolean
  fattoIl?: number
  /** Il destinatario l'ha visto in chat. */
  vistoIl?: number
}

export interface CollezioniCondivise {
  profili: Profilo
  messaggi: Messaggio
  promemoria: Promemoria
}
export type NomeCondivisa = keyof CollezioniCondivise
export const NOMI_CONDIVISE: NomeCondivisa[] = ['profili', 'messaggi', 'promemoria']

let db: Promise<IDBPDatabase> | undefined
const apri = () => (db ??= openDB('agenda-condiviso', 1, {
  upgrade(database, vecchia) {
    if (vecchia < 1) for (const nome of NOMI_CONDIVISE) database.createObjectStore(nome, { keyPath: 'id' })
  },
}))

type Ascoltatore = (origine: OrigineModifica) => void
const ascoltatori = new Set<Ascoltatore>()
const notifica = (origine: OrigineModifica = 'utente') => ascoltatori.forEach((a) => a(origine))
export function ascoltaCondivisi(a: Ascoltatore): () => void {
  ascoltatori.add(a)
  return () => ascoltatori.delete(a)
}

export async function elencaCondivisi<N extends NomeCondivisa>(nome: N): Promise<CollezioniCondivise[N][]> {
  return ((await (await apri()).getAll(nome)) as CollezioniCondivise[N][]).filter((r) => !r.eliminatoIl)
}

type Nuovo<N extends NomeCondivisa> = Omit<CollezioniCondivise[N], 'id' | 'creatoIl' | 'modificatoIl'> & { id?: string; creatoIl?: number }

export async function salvaCondiviso<N extends NomeCondivisa>(nome: N, dati: Nuovo<N> | CollezioniCondivise[N]): Promise<CollezioniCondivise[N]> {
  const database = await apri()
  const ora = Date.now()
  const esistente = dati.id ? ((await database.get(nome, dati.id)) as CollezioniCondivise[N] | undefined) : undefined
  const record = { ...dati, id: dati.id ?? crypto.randomUUID(), creatoIl: esistente?.creatoIl ?? dati.creatoIl ?? ora, modificatoIl: ora, eliminatoIl: undefined } as CollezioniCondivise[N]
  await database.put(nome, record)
  notifica()
  return record
}

export async function eliminaCondiviso(nome: NomeCondivisa, id: string): Promise<void> {
  const database = await apri()
  const r = (await database.get(nome, id)) as Base | undefined
  if (!r) return
  await database.put(nome, { ...r, eliminatoIl: Date.now(), modificatoIl: Date.now() })
  notifica()
}

export async function ripristinaCondiviso(nome: NomeCondivisa, id: string): Promise<void> {
  const database = await apri()
  const r = (await database.get(nome, id)) as Base | undefined
  if (!r) return
  await database.put(nome, { ...r, eliminatoIl: undefined, modificatoIl: Date.now() })
  notifica()
}

/** Tutto l'archivio comune (anche i record eliminati), per la sincronizzazione. */
export async function istantaneaCondivisa(): Promise<Istantanea> {
  const database = await apri()
  const collezioni: Record<string, Base[]> = {}
  for (const nome of NOMI_CONDIVISE) collezioni[nome] = (await database.getAll(nome)) as Base[]
  return { formato: 1, creataIl: Date.now(), collezioni: collezioni as Istantanea['collezioni'] }
}

export async function scriviCondivisi(record: Istantanea['collezioni'], origine: OrigineModifica = 'sincronizzazione'): Promise<void> {
  const database = await apri()
  for (const [nome, elenco] of Object.entries(record) as [string, Base[]][]) {
    if (!(NOMI_CONDIVISE as string[]).includes(nome) || !elenco.length) continue
    const tx = database.transaction(nome, 'readwrite')
    await Promise.all([...elenco.map((r) => tx.store.put(r)), tx.done])
  }
  notifica(origine)
}

/** Solo per i test. */
export async function chiudiCondivisoPerTest() {
  if (db) (await db).close()
  db = undefined
}

export function useCondivisi<N extends NomeCondivisa>(nome: N): CollezioniCondivise[N][] | undefined {
  const [dati, setDati] = useState<CollezioniCondivise[N][]>()
  useEffect(() => {
    let attivo = true
    const carica = () => void elencaCondivisi(nome).then((d) => attivo && setDati(d))
    carica()
    const smetti = ascoltaCondivisi(carica)
    return () => { attivo = false; smetti() }
  }, [nome])
  return dati
}
