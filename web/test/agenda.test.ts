import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import type { EsameOLezione, Evento, GiornataSpeciale, Tassa, Turno } from '../src/dati/modello'
import { blocchiPerGiorno, disponi, giorniTra, impegniTra, lunediDi, perGiorno, spostaGiorni, testoOrario } from '../src/moduli/agenda/impegni'

const base = { creatoIl: 0, modificatoIl: 1 }
const adesso = istante(2026, 10, 15, 10)

const turno = (id: string, g: number, h1: number, h2: number, extra: Partial<Turno> = {}): Turno => ({
  ...base, id, inizio: istante(2026, 10, g, h1), fine: h2 > h1 ? istante(2026, 10, g, h2) : istante(2026, 10, g + 1, h2),
  tipo: 'guardiaNotturna', stato: 'pianificato', origine: 'manuale', ...extra,
})

describe('Agenda', () => {
  test('raccoglie le fonti e ordina per giorno e orario', () => {
    const eventi: Evento[] = [
      { ...base, id: 'e1', titolo: 'Dentista', giorno: '2026-10-20', minutoInizio: 9 * 60, minutoFine: 10 * 60, categoria: 'personale' },
      { ...base, id: 'e2', titolo: 'Corso', giorno: '2026-10-20', tuttoIlGiorno: true, categoria: 'studio' },
    ]
    const esami: EsameOLezione[] = [
      { ...base, id: 'x1', giorno: '2026-10-20', tipo: 'esame', titolo: 'Esame annuale' },
      { ...base, id: 'x2', giorno: '2026-10-10', tipo: 'lezione', titolo: 'Lezione passata' },
    ]
    const tasse: Tassa[] = [{ ...base, id: 'k1', descrizione: 'Seconda rata', importoCent: 50000, scadenza: '2026-10-20', stato: 'daPagare' }]
    const giornate: GiornataSpeciale[] = [{ ...base, id: 'f1', giorno: '2026-10-21', tipo: 'ferie' }]
    const turni = [turno('t1', 20, 20, 8), turno('t2', 1, 8, 18, { tipo: 'ambulatorio' })]

    const r = impegniTra({ turni, eventi, esami, tasse, giornate }, '2026-10-05', '2026-10-31', adesso)
    expect(r.map((i) => i.chiave)).toEqual(['lezione:x2', 'evento:e2:2026-10-20', 'esame:x1', 'tassa:k1', 'evento:e1:2026-10-20', 'turno:t1', 'giornata:f1'])
    expect(r.find((i) => i.fonte === 'lezione')!.concluso).toBe(true)
    expect(r.find((i) => i.fonte === 'tassa')!.colore).toBe('colore-inScadenza')
    const notte = r.find((i) => i.id === 't1')!
    expect(testoOrario(notte)).toBe('20:00–8:00')
    expect(notte.link).toBe('#/turni/t1')
    expect(perGiorno(r).get('2026-10-20')).toHaveLength(5)
  })

  test('impegni di più giorni compaiono in ogni giorno del periodo visibile', () => {
    const eventi: Evento[] = [{ ...base, id: 'c', titolo: 'Congresso', giorno: '2026-09-29', giornoFine: '2026-10-02', minutoInizio: 540, categoria: 'lavoro' }]
    const r = impegniTra({ eventi }, '2026-10-01', '2026-10-31', adesso)
    expect(r.map((i) => i.giorno)).toEqual(['2026-10-01', '2026-10-02'])
    expect(r[1]!.dettaglio).toBe('fine')
    expect(r[0]!.minutoInizio).toBeUndefined()
  })

  test('giorni tra due date, anche al cambio dell’ora legale', () => {
    expect(giorniTra('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
    expect(giorniTra('2026-10-27', '2026-10-24')).toEqual([])
  })
})

describe('Vista a settimana', () => {
  const imp = (chiave: string, giorno: string, a?: number, b?: number) =>
    ({ chiave, fonte: 'evento', id: chiave, giorno, titolo: chiave, minutoInizio: a, minutoFine: b, colore: '', link: '', modificatoIl: 0 }) as const

  test('la notte continua nel giorno dopo, tutto il giorno resta fuori', () => {
    const m = blocchiPerGiorno([imp('N', '2026-10-17', 20 * 60, 8 * 60), imp('ferie', '2026-10-17')], ['2026-10-17', '2026-10-18'])
    expect(m.get('2026-10-17')!.map((b) => [b.da, b.a, b.continuaDopo])).toEqual([[1200, 1440, true]])
    expect(m.get('2026-10-18')!.map((b) => [b.da, b.a, b.continuaPrima])).toEqual([[0, 480, true]])
  })

  test('impegni sovrapposti vanno affiancati', () => {
    const r = disponi([{ da: 480, a: 1080 }, { da: 900, a: 960 }, { da: 1000, a: 1100 }, { da: 1200, a: 1260 }])
    expect(r.map((b) => [b.corsia, b.corsie])).toEqual([[0, 2], [1, 2], [1, 2], [0, 1]])
  })

  test('lunedì della settimana e spostamenti', () => {
    expect(lunediDi('2026-10-18')).toBe('2026-10-12')
    expect(lunediDi('2026-10-12')).toBe('2026-10-12')
    expect(spostaGiorni('2026-10-26', 7)).toBe('2026-11-02')
  })
})

describe('Note del giorno', () => {
  test('compaiono per prime, anche su più giorni', () => {
    const r = impegniTra({
      note: [{ ...base, id: 'n1', testo: 'Inizia il 2° scorrimento', giorno: '2026-09-12' }, { ...base, id: 'n2', testo: 'Periodo esami', giorno: '2026-09-11', giornoFine: '2026-09-13' }],
      eventi: [{ ...base, id: 'e1', titolo: 'Corso', giorno: '2026-09-12', tuttoIlGiorno: true, categoria: 'studio' }],
    }, '2026-09-12', '2026-09-30', adesso)
    expect(r.map((i) => i.chiave)).toEqual(['nota:n1:2026-09-12', 'nota:n2:2026-09-12', 'evento:e1:2026-09-12', 'nota:n2:2026-09-13'])
    expect(r[1]!.dettaglio).toBe('fino al 13/9')
  })
})

describe('Spostare trascinando', () => {
  test('turni: stesso orario nel nuovo giorno, anche con il cambio dell’ora', async () => {
    const { turnoSpostato, differenzaGiorni, piuGiorniData } = await import('../src/moduli/agenda/sposta')
    const { componenti } = await import('../src/nucleo/calendario')
    const notte = { ...base, id: 'n', inizio: istante(2026, 10, 20, 20), fine: istante(2026, 10, 21, 8), tipo: 'guardiaNotturna', stato: 'pianificato', origine: 'manuale' } as const
    const r = turnoSpostato(notte, { giorno: '2026-10-24' })
    expect(componenti(r.inizio)).toMatchObject({ giorno: 24, ora: 20 })
    expect(componenti(r.fine)).toMatchObject({ giorno: 25, ora: 8 })
    expect((r.fine - r.inizio) / 3_600_000).toBe(13) // la notte del cambio dell'ora dura 13 ore
    const g = turnoSpostato(notte, { giorno: '2026-10-22', minuto: 21 * 60 + 30 })
    expect(componenti(g.inizio)).toMatchObject({ giorno: 22, ora: 21, minuto: 30 })
    const tutto = turnoSpostato({ ...notte, tuttoIlGiorno: true }, { giorno: '2026-10-25' })
    expect((tutto.fine - tutto.inizio) / 3_600_000).toBe(25)
    expect(differenzaGiorni('2026-10-30', '2026-11-02')).toBe(3)
    expect(piuGiorniData('2026-12-30', 3)).toBe('2027-01-02')
  })
})
