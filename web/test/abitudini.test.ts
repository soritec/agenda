import { describe, expect, test } from 'vitest'
import { lunediDi, percentualeMese, serieGiornaliera, serieSettimanale, volteNellaSettimana } from '../src/moduli/abitudini/logica'

const s = (...g: string[]) => new Set(g)

describe('Habit tracker', () => {
  test('serie giornaliera: oggi non segnato non la rompe, i giorni di guardia la saltano', () => {
    const fatti = s('2026-10-07', '2026-10-08', '2026-10-10')
    expect(serieGiornaliera(fatti, '2026-10-11', s())).toBe(1)
    expect(serieGiornaliera(fatti, '2026-10-11', s('2026-10-09'))).toBe(3)
    expect(serieGiornaliera(s('2026-10-11', '2026-10-10'), '2026-10-11', s())).toBe(2)
    expect(serieGiornaliera(s(), '2026-10-11', s())).toBe(0)
  })

  test('settimane', () => {
    expect(lunediDi('2026-10-11')).toBe('2026-10-05')
    const fatti = s('2026-09-29', '2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08', '2026-10-09')
    expect(volteNellaSettimana(fatti, '2026-10-11')).toBe(3)
    expect(serieSettimanale(fatti, '2026-10-11', 3)).toBe(2)
    expect(serieSettimanale(fatti, '2026-10-11', 4)).toBe(0)
  })

  test('percentuale del mese', () => {
    const fatti = s('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05')
    expect(percentualeMese({}, fatti, '2026-10', '2026-10-05', s())).toBe(80)
    expect(percentualeMese({}, fatti, '2026-10', '2026-10-05', s('2026-10-04'))).toBe(100)
    expect(percentualeMese({ volteSettimana: 3 }, fatti, '2026-10', '2026-10-07', s())).toBe(133 > 100 ? 100 : 133)
    expect(percentualeMese({}, fatti, '2026-11', '2026-10-05', s())).toBeUndefined()
  })
})
