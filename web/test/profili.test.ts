import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { chiudiPerTest, elenca, salva } from '../src/dati/archivio'
import { daBase64, inBase64 } from '../src/dati/cifratura'
import { chiudiCondivisoPerTest, elencaCondivisi, salvaCondiviso } from '../src/dati/condiviso'
import { fileDati, nomeDatabase, PROFILO_PRINCIPALE } from '../src/dati/profili'

vi.mock('../src/dati/cifratura', async (originale) => {
  const vero = await originale<typeof import('../src/dati/cifratura')>()
  return { ...vero, nuovaChiave: (p: string) => vero.nuovaChiave(p, 1_000) }
})
const { collega, sincronizza } = await import('../src/dati/sincronizzazione')

const file = new Map<string, { testo: string; sha: string }>()
let versione = 0
async function githubFinto(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url))
  const json = (stato: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status: stato })
  if (u.pathname === '/repos/utente/dati') return json(200, {})
  const percorso = decodeURIComponent(u.pathname.replace('/repos/utente/dati/contents/', ''))
  if (!init?.method || init.method === 'GET') {
    const f = file.get(percorso)
    return f ? json(200, { content: inBase64(new TextEncoder().encode(f.testo)), sha: f.sha }) : json(404, {})
  }
  const corpo = JSON.parse(String(init.body)) as { content: string; sha?: string }
  if ((file.get(percorso)?.sha ?? undefined) !== corpo.sha) return json(409, {})
  const sha = `v${++versione}`
  file.set(percorso, { testo: new TextDecoder().decode(daBase64(corpo.content)), sha })
  return json(200, { content: { sha } })
}

/** Simula un altro dispositivo con un certo profilo attivo. */
const memoria = new Map<string, string>()
async function dispositivo(profilo: string) {
  await chiudiPerTest()
  await chiudiCondivisoPerTest()
  for (const nome of ['agenda', 'agenda-p2', 'agenda-condiviso']) await new Promise<void>((ok) => { const r = indexedDB.deleteDatabase(nome); r.onsuccess = () => ok() })
  memoria.set('agenda.profilo', profilo)
}

beforeAll(() => {
  vi.stubGlobal('fetch', githubFinto)
  vi.stubGlobal('localStorage', { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => memoria.set(k, v), removeItem: (k: string) => memoria.delete(k) })
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
afterAll(() => vi.unstubAllGlobals())

describe('Profili', () => {
  test('nomi di archivio e file', () => {
    expect(nomeDatabase(PROFILO_PRINCIPALE)).toBe('agenda')
    expect(fileDati(PROFILO_PRINCIPALE)).toBe('agenda.cifrato.json')
    expect(nomeDatabase('p2')).toBe('agenda-p2')
    expect(fileDati('p2')).toBe('agenda-p2.cifrato.json')
  })

  test('ogni profilo ha i suoi dati; chat e promemoria sono comuni', async () => {
    // Dispositivo 1, profilo principale
    await dispositivo(PROFILO_PRINCIPALE)
    await salva('attivita', { titolo: 'Task del principale', priorita: 'nessuna', area: 'altro' })
    await salvaCondiviso('profili', { id: 'p2', nome: 'Seconda persona', colore: '#7D8DA0' })
    await salvaCondiviso('messaggi', { da: PROFILO_PRINCIPALE, a: 'p2', testo: 'Ciao!' })
    await collega('token-di-prova-abbastanza-lungo', 'parola segreta 7', 'utente', 'dati')
    expect([...file.keys()].sort()).toEqual(['agenda.cifrato.json', 'chiave.json', 'condiviso.cifrato.json'])

    // Dispositivo 2, secondo profilo: vede chat e profili, non i task dell'altra
    await dispositivo('p2')
    await collega('token-di-prova-abbastanza-lungo', 'parola segreta 7', 'utente', 'dati')
    expect(await elenca('attivita')).toEqual([])
    expect((await elencaCondivisi('messaggi')).map((m) => m.testo)).toEqual(['Ciao!'])
    await salva('attivita', { titolo: 'Task del secondo profilo', priorita: 'nessuna', area: 'altro' })
    await salvaCondiviso('promemoria', { da: 'p2', a: PROFILO_PRINCIPALE, testo: 'Ricordati la domanda', giorno: '2026-10-11' })
    await sincronizza()
    expect(file.has('agenda-p2.cifrato.json')).toBe(true)

    // Di nuovo il primo dispositivo: arriva il promemoria, i task restano separati
    await dispositivo(PROFILO_PRINCIPALE)
    await collega('token-di-prova-abbastanza-lungo', 'parola segreta 7', 'utente', 'dati')
    expect((await elenca('attivita')).map((t) => t.titolo)).toEqual(['Task del principale'])
    expect((await elencaCondivisi('promemoria')).map((p) => p.testo)).toEqual(['Ricordati la domanda'])
  })
})

describe('Password copiata da un messaggio', () => {
  test('si provano anche le varianti con spazi e apostrofi del telefono', async () => {
    const { variantiPassword } = await import('../src/dati/sincronizzazione')
    expect(variantiPassword(' l’albero-2026 ')).toContain("l'albero-2026")
    expect(variantiPassword('esatta')).toEqual(['esatta'])
  })
})
