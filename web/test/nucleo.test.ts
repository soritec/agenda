import { describe, expect, test } from 'vitest'
import { aggiungiGiorni, componenti, giornoSettimana, intervalloMese, istante } from '../src/nucleo/calendario'
import { eFestivo, festivitaDel, festivitaNazionali, NOME_PATRONO, pasqua } from '../src/nucleo/festivita'
import { dataBreve, dataEstesa, durata, importo, ora } from '../src/nucleo/formati'

// I test girano con TZ=America/New_York (vedi package.json): tutto deve restare in ora italiana.

describe('Calendario italiano', () => {
  test('istante e componenti sono in ora italiana', () => {
    const i = istante(2026, 10, 12, 8, 5)
    expect(new Date(i).toISOString()).toBe('2026-10-12T06:05:00.000Z') // ora legale: UTC+2
    expect(componenti(i)).toMatchObject({ anno: 2026, mese: 10, giorno: 12, ora: 8, minuto: 5, giornoSettimana: 1 })
    expect(new Date(istante(2026, 12, 25, 23, 30)).toISOString()).toBe('2026-12-25T22:30:00.000Z') // ora solare: UTC+1
  })

  test('cambio dell’ora legale', () => {
    // 29 marzo 2026: alle 02:00 si passa alle 03:00. Le 02:30 non esistono e diventano 03:30.
    expect(componenti(istante(2026, 3, 29, 2, 30))).toMatchObject({ ora: 3, minuto: 30 })
    expect(istante(2026, 3, 29, 3, 0) - istante(2026, 3, 29, 1, 0)).toBe(3_600_000)
  })

  test('settimana dal lunedì e mesi', () => {
    expect(giornoSettimana({ anno: 2026, mese: 10, giorno: 12 })).toBe(1)
    expect(giornoSettimana({ anno: 2026, mese: 10, giorno: 11 })).toBe(7)
    expect(intervalloMese(2028, 2).fine).toBe(istante(2028, 3, 1))
    expect(intervalloMese(2026, 12).fine).toBe(istante(2027, 1, 1))
    expect(aggiungiGiorni({ anno: 2026, mese: 12, giorno: 31 }, 1)).toEqual({ anno: 2027, mese: 1, giorno: 1 })
  })
})

describe('Pasqua', () => {
  test.each([
    [2008, 3, 23], [2019, 4, 21], [2024, 3, 31], [2025, 4, 20],
    [2026, 4, 5], [2027, 3, 28], [2038, 4, 25], [2285, 3, 22],
  ])('%i', (anno, mese, giorno) => {
    expect(pasqua(anno)).toEqual({ mese, giorno })
  })
})

describe('Festività', () => {
  test('Pasquetta, anche a cavallo di mese', () => {
    expect(festivitaDel(istante(2024, 4, 1))?.nome).toBe("Lunedì dell'Angelo")
    expect(festivitaDel(istante(2026, 4, 6))?.nome).toBe("Lunedì dell'Angelo")
  })

  test('elenco nazionale, 4 ottobre giorno normale', () => {
    expect(festivitaNazionali(2026)).toHaveLength(11)
    expect(festivitaDel(istante(2027, 10, 4))).toBeUndefined()
  })

  test('il giorno resta quello italiano anche a tarda sera', () => {
    expect(eFestivo(istante(2026, 12, 25, 23, 30))).toBe(true)
    expect(eFestivo(istante(2026, 12, 24, 23, 59))).toBe(false)
  })

  test('domenica sempre, sabato secondo l’impostazione', () => {
    expect(eFestivo(istante(2026, 10, 11), { sabatoFestivo: false })).toBe(true)
    expect(eFestivo(istante(2026, 10, 10), { sabatoFestivo: true })).toBe(true)
    expect(eFestivo(istante(2026, 10, 10), { sabatoFestivo: false })).toBe(false)
    expect(eFestivo(istante(2026, 10, 9))).toBe(false)
  })

  test('santo patrono della sede', () => {
    const sanGiovanni = istante(2026, 6, 24)
    const patronoSede = { mese: 6, giorno: 24 }
    expect(eFestivo(sanGiovanni)).toBe(false)
    expect(eFestivo(sanGiovanni, { patrono: patronoSede })).toBe(true)
    expect(festivitaDel(sanGiovanni, patronoSede)?.nome).toBe(NOME_PATRONO)
  })
})

describe('Formati', () => {
  const d = istante(2026, 10, 12, 8, 5)
  test('date e ore', () => {
    expect(ora(d)).toBe('08:05')
    expect(dataBreve(d)).toBe('lun 12 ott')
    expect(dataEstesa(d)).toBe('lunedì 12 ottobre 2026')
  })
  test('durate', () => {
    expect(durata(450)).toBe('7 h 30 min')
    expect(durata(720)).toBe('12 h')
    expect(durata(45)).toBe('45 min')
  })
  test('importi', () => {
    expect(importo(1_234_567)).toContain('12.345,67')
    expect(importo(1_234_567)).toContain('€')
  })
})
