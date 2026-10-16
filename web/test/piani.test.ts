import { describe, expect, test } from 'vitest'
import { argomentoFinito, dividiPagine, giorniDelPiano, leggiPianoAI, ripassiPer, riprogramma, riepilogoSessioni } from '../src/moduli/studio/piani'

const b = { creatoIl: 0, modificatoIl: 0 }
const piano = {
  inizio: '2026-10-05', fine: '2026-10-16', giorniSettimana: [1, 2, 3, 4, 5, 6], minutiAlGiorno: 120,
  argomenti: [
    { id: 'a1', nome: 'Preeclampsia', fonte: 'Williams', paginaDa: 710, paginaA: 749 },
    { id: 'a2', nome: 'Diabete', paginaDa: 1136, paginaA: 1175 },
    { id: 'a3', nome: 'Linee guida PPROM' },
  ],
}

describe('Piani di studio', () => {
  test('giorni del piano senza domeniche e senza il giorno dell’esame', () => {
    expect(giorniDelPiano(piano)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'])
  })

  test('divide le pagine in modo uniforme e lascia il ripasso generale', () => {
    const s = dividiPagine(piano, 'p')
    expect(s.at(-1)).toMatchObject({ giorno: '2026-10-15', tipo: 'ripassoGenerale' })
    const studio = s.filter((x) => x.tipo === 'studio')
    // tutte le pagine coperte, senza buchi
    const pre = studio.filter((x) => x.argomentoId === 'a1')
    expect(pre[0]!.paginaDa).toBe(710)
    expect(pre.at(-1)!.paginaA).toBe(749)
    for (let i = 1; i < pre.length; i++) expect(pre[i]!.paginaDa).toBe(pre[i - 1]!.paginaA! + 1)
    expect(studio.find((x) => x.argomentoId === 'a3')?.paginaDa).toBeUndefined()
    const giorni = new Set(studio.map((x) => x.giorno))
    expect(giorni.has('2026-10-11')).toBe(false)
    expect(Math.max(...[...giorni].map((g) => studio.filter((x) => x.giorno === g).length))).toBeLessThanOrEqual(3)
  })

  test('ripassi dopo 1, 7 e 30 giorni, solo prima della fine', () => {
    const r = ripassiPer([{ pianoId: 'p', giorno: '2026-10-06', tipo: 'studio', argomentoId: 'a1', titolo: 'Preeclampsia', minuti: 60 }], '2026-10-16', new Map([['a1', 'Preeclampsia']]))
    expect(r.map((x) => x.giorno)).toEqual(['2026-10-07', '2026-10-13'])
    expect(r[0]!.titolo).toBe('Ripasso: Preeclampsia')
  })

  test('riprogramma le sessioni mancate nei giorni liberi', () => {
    const s = [
      { ...b, id: 's1', pianoId: 'p', giorno: '2026-10-05', tipo: 'studio', titolo: 'x', minuti: 60 },
      { ...b, id: 's2', pianoId: 'p', giorno: '2026-10-06', tipo: 'studio', titolo: 'y', minuti: 60, fatta: true },
      { ...b, id: 's3', pianoId: 'p', giorno: '2026-10-12', tipo: 'studio', titolo: 'z', minuti: 90 },
    ]
    expect(riprogramma(s, piano, '2026-10-12', (g) => g === '2026-10-13')).toEqual([{ id: 's1', giorno: '2026-10-14' }])
  })

  test('riepilogo, argomento finito, piano proposto dall’AI', () => {
    const s = [
      { ...b, id: '1', pianoId: 'p', giorno: '2026-10-05', tipo: 'studio', argomentoId: 'a1', titolo: '', paginaDa: 710, paginaA: 729, minuti: 60, fatta: true, minutiFatti: 50 },
      { ...b, id: '2', pianoId: 'p', giorno: '2026-10-06', tipo: 'studio', argomentoId: 'a1', titolo: '', paginaDa: 730, paginaA: 749, minuti: 60 },
    ]
    expect(riepilogoSessioni(s)).toEqual({ minutiPrevisti: 120, minutiFatti: 50, paginePreviste: 40, pagineFatte: 20, sessioni: 2, fatte: 1 })
    expect(argomentoFinito(s, 'a1')).toBe(false)
    expect(argomentoFinito(s.map((x) => ({ ...x, fatta: true })), 'a1')).toBe(true)
    const ai = leggiPianoAI(JSON.stringify([
      { giorno: '2026-10-05', argomento: 'preeclampsia', paginaDa: 710, paginaA: 730, minuti: 70 },
      { giorno: '2026-10-11', argomento: 'Diabete' },
      { giorno: '2026-10-15', tipo: 'ripassoGenerale' },
      { giorno: '2026-10-06', argomento: 'Inventato' },
    ]), piano, 'p')
    expect(ai.map((x) => [x.giorno, x.titolo, x.minuti])).toEqual([['2026-10-05', 'Preeclampsia', 70], ['2026-10-15', 'Ripasso generale', 60]])
  })
})

describe('Ore al giorno per argomento', () => {
  test('un libro con i suoi minuti si studia ogni giorno, in parallelo agli altri', async () => {
    const { dividiPagine } = await import('../src/moduli/studio/piani')
    const piano = {
      inizio: '2026-10-12', fine: '2026-10-19', giorniSettimana: [1, 2, 3, 4, 5, 6, 7], minutiAlGiorno: 120,
      argomenti: [{ id: 'L', nome: 'Treitel', paginaDa: 1, paginaA: 60, minutiAlGiorno: 60 }, { id: 'A', nome: 'Tort', paginaDa: 1, paginaA: 40 }],
    }
    const s = dividiPagine(piano, 'p')
    const libro = s.filter((x) => x.argomentoId === 'L')
    // 60 minuti al giorno = 20 pagine: tre giorni di fila, 60 minuti ciascuno.
    expect(libro.map((x) => [x.giorno, x.paginaDa, x.paginaA, x.minuti])).toEqual([['2026-10-12', 1, 20, 60], ['2026-10-13', 21, 40, 60], ['2026-10-14', 41, 60, 60]])
    expect(s.filter((x) => x.argomentoId === 'A').reduce((t, x) => t + (x.paginaA! - x.paginaDa! + 1), 0)).toBe(40)
    expect(s.map((x) => x.giorno)).toEqual([...s.map((x) => x.giorno)].sort())
  })
})
