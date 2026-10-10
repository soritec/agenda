import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { chiudiPerTest, elenca, elimina, istantaneaLocale, salva, scriviGrezzi } from '../src/dati/archivio'
import { daBase64, inBase64 } from '../src/dati/cifratura'

// La derivazione della chiave usa meno iterazioni nei test, per velocità.
vi.mock('../src/dati/cifratura', async (originale) => {
  const vero = await originale<typeof import('../src/dati/cifratura')>()
  return { ...vero, nuovaChiave: (p: string) => vero.nuovaChiave(p, 1_000) }
})
const { collega, scollega, sincronizza } = await import('../src/dati/sincronizzazione')

/** GitHub finto in memoria: file con sha, conflitto se lo sha non corrisponde. */
const file = new Map<string, { testo: string; sha: string }>()
let versione = 0
let scritture = 0
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
  const attuale = file.get(percorso)
  if ((attuale?.sha ?? undefined) !== corpo.sha) return json(409, {})
  const sha = `v${++versione}`
  scritture++
  file.set(percorso, { testo: new TextDecoder().decode(daBase64(corpo.content)), sha })
  return json(200, { content: { sha } })
}

async function nuovoDispositivo() {
  await chiudiPerTest()
  await new Promise<void>((ok) => { const r = indexedDB.deleteDatabase('agenda'); r.onsuccess = () => ok() })
}

beforeAll(() => {
  vi.stubGlobal('fetch', githubFinto)
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})
afterAll(() => vi.unstubAllGlobals())

describe('Sincronizzazione completa tra due dispositivi', () => {
  test('Mac crea la password, iPhone si collega, le modifiche si incontrano', async () => {
    // Mac
    await nuovoDispositivo()
    const notte = await salva('turni', { inizio: 1, fine: 2, tipo: 'guardiaNotturna', stato: 'pianificato', origine: 'manuale' })
    await collega('token-di-prova-abbastanza-lungo', 'tre parole e 7', 'utente', 'dati')
    expect(file.has('chiave.json')).toBe(true)
    expect(file.get('agenda.cifrato.json')!.testo).not.toContain('guardiaNotturna') // cifrato
    const macDopo = await istantaneaLocale()

    // iPhone: password sbagliata, poi giusta
    await nuovoDispositivo()
    await expect(collega('token-di-prova-abbastanza-lungo', 'sbagliata', 'utente', 'dati')).rejects.toThrow('Password sbagliata')
    await collega('token-di-prova-abbastanza-lungo', 'tre parole e 7', 'utente', 'dati')
    expect((await elenca('turni')).map((t) => t.id)).toEqual([notte.id])

    // iPhone aggiunge un turno ed elimina la notte
    const reparto = await salva('turni', { inizio: 3, fine: 4, tipo: 'reparto', stato: 'pianificato', origine: 'manuale' })
    await elimina('turni', notte.id)
    await sincronizza()

    // Torna il Mac (stessi dati locali di prima), con una sua modifica fatta senza rete
    await nuovoDispositivo()
    await scriviGrezzi(macDopo.collezioni)
    const ferie = await salva('ferie', { giorno: '2026-10-21', tipo: 'ferie' })
    await collega('token-di-prova-abbastanza-lungo', 'tre parole e 7', 'utente', 'dati')
    const turniMac = await elenca('turni')
    expect(turniMac.map((t) => t.id)).toEqual([reparto.id]) // la notte eliminata sull'iPhone sparisce anche qui
    expect((await elenca('ferie')).map((f) => f.id)).toEqual([ferie.id])

    // Ricollegando l'iPhone arrivano anche le ferie del Mac
    await nuovoDispositivo()
    await collega('token-di-prova-abbastanza-lungo', 'tre parole e 7', 'utente', 'dati')
    expect((await elenca('ferie')).map((f) => f.giorno)).toEqual(['2026-10-21'])

    // Senza modifiche non si riscrive su GitHub
    const prima = scritture
    await sincronizza()
    expect(scritture).toBe(prima)
    await scollega()
  })
})
