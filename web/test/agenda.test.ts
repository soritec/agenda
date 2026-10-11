import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import type { EsameOLezione, Evento, GiornataSpeciale, Tassa, Turno } from '../src/dati/modello'
import { giorniTra, impegniTra, perGiorno, testoOrario } from '../src/moduli/agenda/impegni'

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
