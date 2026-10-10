import { describe, expect, test } from 'vitest'
import { apriChiave, cifra, daBase64, decifra, inBase64, nuovaChiave } from '../src/dati/cifratura'
import { differenze, fondi, haDifferenze, type Istantanea } from '../src/dati/fusione'
import { ErroreGitHub, leggiFile, scriviFile } from '../src/dati/github'

const POCHE = 1_000 // iterazioni ridotte solo per velocizzare i test

describe('Cifratura', () => {
  test('base64 andata e ritorno, anche con accenti', () => {
    const byte = new TextEncoder().encode('Città · àèìòù €')
    expect(new TextDecoder().decode(daBase64(inBase64(byte)))).toBe('Città · àèìòù €')
  })

  test('cifra e decifra; la password sbagliata non apre', async () => {
    const { chiave, descrittore } = await nuovaChiave('una password lunga', POCHE)
    const c = await cifra(chiave, '{"turni":[]}')
    expect(c.dati).not.toContain('turni')
    expect(await decifra(chiave, c)).toBe('{"turni":[]}')
    expect(await apriChiave('una password lunga', descrittore)).toBeDefined()
    expect(await apriChiave('sbagliata', descrittore)).toBeUndefined()
    const riaperta = (await apriChiave('una password lunga', descrittore))!
    expect(await decifra(riaperta, c)).toBe('{"turni":[]}')
  })

  test('ogni cifratura usa un IV diverso', async () => {
    const { chiave } = await nuovaChiave('x', POCHE)
    const a = await cifra(chiave, 'uguale'), b = await cifra(chiave, 'uguale')
    expect(a.iv).not.toBe(b.iv)
    expect(a.dati).not.toBe(b.dati)
  })
})

const r = (id: string, modificatoIl: number, extra: object = {}) => ({ id, creatoIl: 1, modificatoIl, ...extra })
const ist = (turni: ReturnType<typeof r>[], impostazioni?: Istantanea['impostazioni']): Istantanea =>
  ({ formato: 1, creataIl: 0, collezioni: { turni: turni as never }, impostazioni })

describe('Unione dei dati tra dispositivi', () => {
  test('vince la modifica più recente, nessun record perso', () => {
    const mac = ist([r('a', 10, { note: 'mac' }), r('b', 5)])
    const iphone = ist([r('a', 20, { note: 'iphone' }), r('c', 7)])
    const fusa = fondi(mac, iphone)
    const perId = new Map(fusa.collezioni.turni!.map((x) => [x.id, x]))
    expect([...perId.keys()].sort()).toEqual(['a', 'b', 'c'])
    expect((perId.get('a') as unknown as { note: string }).note).toBe('iphone')
  })

  test('le eliminazioni si propagano', () => {
    const mac = ist([r('a', 10)])
    const iphone = ist([r('a', 30, { eliminatoIl: 30 })])
    expect(fondi(mac, iphone).collezioni.turni![0]!.eliminatoIl).toBe(30)
  })

  test('differenze: solo ciò che è nuovo o più recente', () => {
    const vecchia = ist([r('a', 10), r('b', 5)])
    const nuova = ist([r('a', 10), r('b', 6), r('c', 1)])
    expect(differenze(nuova, vecchia).turni!.map((x) => x.id)).toEqual(['b', 'c'])
    expect(haDifferenze(vecchia, vecchia)).toBe(false)
    expect(haDifferenze(nuova, vecchia)).toBe(true)
  })

  test('impostazioni: vince la più recente', () => {
    const a = ist([], { sabatoFestivo: true, modificatoIl: 5 })
    const b = ist([], { sabatoFestivo: false, modificatoIl: 9 })
    expect(fondi(a, b).impostazioni?.sabatoFestivo).toBe(false)
    expect(fondi(b, a).impostazioni?.sabatoFestivo).toBe(false)
  })
})

describe('Accesso a GitHub', () => {
  const c = { token: 't', proprietario: 'utente', repository: 'dati' }
  const risposta = (stato: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status: stato })

  test('lettura: contenuto e sha; file assente', async () => {
    const f = (async () => risposta(200, { content: inBase64(new TextEncoder().encode('ciao')), sha: 'abc' })) as typeof fetch
    expect(await leggiFile(c, 'a.json', f)).toEqual({ testo: 'ciao', sha: 'abc' })
    const vuoto = (async () => risposta(404, {})) as typeof fetch
    expect(await leggiFile(c, 'a.json', vuoto)).toBeUndefined()
  })

  test('scrittura con sha e conflitto con un altro dispositivo', async () => {
    let corpoInviato: { content: string; sha?: string } | undefined
    const ok = (async (_: unknown, init?: RequestInit) => {
      corpoInviato = JSON.parse(String(init?.body))
      return risposta(200, { content: { sha: 'nuovo' } })
    }) as typeof fetch
    expect(await scriviFile(c, 'a.json', 'dati', 'vecchio', 'msg', ok)).toBe('nuovo')
    expect(corpoInviato?.sha).toBe('vecchio')
    expect(new TextDecoder().decode(daBase64(corpoInviato!.content))).toBe('dati')
    const conflitto = (async () => risposta(409, {})) as typeof fetch
    await expect(scriviFile(c, 'a.json', 'x', 'vecchio', 'msg', conflitto)).rejects.toMatchObject({ stato: 409 })
    const negato = (async () => risposta(401, {})) as typeof fetch
    await expect(scriviFile(c, 'a.json', 'x', undefined, 'msg', negato)).rejects.toBeInstanceOf(ErroreGitHub)
  })
})
