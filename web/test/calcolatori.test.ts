import { describe, expect, test } from 'vitest'
import * as C from '../src/moduli/calcolatori/formule'

describe('Calcolatori', () => {
  test('datazione da ultima mestruazione (Naegele)', () => {
    const r = C.daUltimaMestruazione('2026-01-01', '2026-03-26')
    expect(r.dpp).toBe('2026-10-08')
    expect(r.eg.testo).toBe('12+0')
    // Ciclo di 35 giorni: ovulazione 7 giorni dopo
    const c = C.daUltimaMestruazione('2026-01-01', '2026-03-26', 35)
    expect(c.dpp).toBe('2026-10-15')
    expect(c.eg.testo).toBe('11+0')
  })

  test('età gestazionale da CRL (Robinson)', () => {
    expect(C.egDaCrl(45).testo).toBe('11+2')
    expect(C.egDaCrl(10).testo).toBe('7+1')
    expect(C.egDaCrl(84).settimane).toBe(14)
  })

  test('età gestazionale da biometria (Hadlock)', () => {
    const r = C.egDaBiometria(9, 32.5, 31, 7)
    expect(r.settimane).toBe(35)
  })

  test('ridatazione secondo ACOG', () => {
    expect(C.sogliaRidatazione(8 * 7)).toBe(5)
    expect(C.sogliaRidatazione(12 * 7)).toBe(7)
    expect(C.sogliaRidatazione(20 * 7)).toBe(10)
    expect(C.sogliaRidatazione(25 * 7)).toBe(14)
    expect(C.sogliaRidatazione(30 * 7)).toBe(21)
    expect(C.ridatazione(12 * 7, 12 * 7 + 8).ridatare).toBe(true)
    expect(C.ridatazione(12 * 7, 12 * 7 + 7).ridatare).toBe(false)
    expect(C.dppDaEg('2026-03-26', 84)).toBe('2026-10-08')
  })

  test('peso fetale e percentile (Hadlock)', () => {
    expect(C.pesoHadlock(9, 32.5, 31, 7)).toBeGreaterThan(2650)
    expect(C.pesoHadlock(9, 32.5, 31, 7)).toBeLessThan(2750)
    expect(Math.round(C.pesoMedioHadlock(40))).toBe(3619)
    expect(C.percentilePeso(3619, 40)).toBe(50)
    expect(C.percentilePeso(2700, 40)).toBeLessThan(3)
  })

  test('liquido amniotico', () => {
    expect(C.classificaAfi(4.9)).toBe('oligoidramnios')
    expect(C.classificaAfi(12)).toBe('normale')
    expect(C.classificaAfi(25)).toBe('polidramnios')
    expect(C.classificaFalda(1.5)).toBe('oligoidramnios')
    expect(C.classificaFalda(8)).toBe('polidramnios')
  })

  test('Bishop e Apgar', () => {
    expect(C.bishop({ dilatazione: 2, cancellazione: 2, stazione: 1, consistenza: 2, posizione: 1 })).toEqual({ totale: 8, giudizio: 'Favorevole' })
    expect(C.bishop({ dilatazione: 0, cancellazione: 1, stazione: 0, consistenza: 1, posizione: 0 }).giudizio).toBe('Sfavorevole')
    expect(C.apgar([2, 2, 2, 1, 2]).totale).toBe(9)
    expect(C.apgar([1, 1, 0, 1, 0]).giudizio).toBe('Gravemente depresso')
  })

  test('Robson', () => {
    const base = { parita: 'nullipara', tcPrecedente: false, feti: 'singolo', presentazione: 'cefalica', settimane: 39, travaglio: 'spontaneo' } as const
    expect(C.robson(base).gruppo).toBe('1')
    expect(C.robson({ ...base, travaglio: 'indotto' }).gruppo).toBe('2a')
    expect(C.robson({ ...base, travaglio: 'tcPrimaDelTravaglio' }).gruppo).toBe('2b')
    expect(C.robson({ ...base, parita: 'multipara' }).gruppo).toBe('3')
    expect(C.robson({ ...base, parita: 'multipara', travaglio: 'indotto' }).gruppo).toBe('4a')
    expect(C.robson({ ...base, parita: 'multipara', tcPrecedente: true }).gruppo).toBe('5')
    expect(C.robson({ ...base, presentazione: 'podalica' }).gruppo).toBe('6')
    expect(C.robson({ ...base, parita: 'multipara', presentazione: 'podalica' }).gruppo).toBe('7')
    expect(C.robson({ ...base, feti: 'multipli' }).gruppo).toBe('8')
    expect(C.robson({ ...base, presentazione: 'trasversa' }).gruppo).toBe('9')
    expect(C.robson({ ...base, settimane: 34 }).gruppo).toBe('10')
  })

  test('shock index', () => {
    expect(C.shockIndex(80, 120).allarme).toBe(false)
    const r = C.shockIndex(120, 90, 70)
    expect(r.si).toBe(1.33)
    expect(r.grado).toBe('Moderata')
    expect(r.stimaMl).toEqual([1750, 2450])
  })

  test('rischio tromboembolico RCOG', () => {
    expect(C.rischioTev(new Set(['eta', 'obesita', 'fumo']), 'antepartum')).toMatchObject({ punti: 3, indicazione: 'EBPM dalla 28ª settimana.' })
    expect(C.rischioTev(new Set(['obesita', 'obesitaGrave', 'eta', 'parita']), 'antepartum').punti).toBe(4)
    expect(C.rischioTev(new Set(['tcTravaglio']), 'antepartum').punti).toBe(0)
    expect(C.rischioTev(new Set(['tcTravaglio']), 'postpartum').indicazione).toMatch(/10 giorni/)
    expect(C.rischioTev(new Set(['tcElettivo']), 'postpartum').indicazione).toMatch(/Mobilizzazione/)
  })

  test('RMI, β-hCG, BMI', () => {
    expect(C.rmi(2, true, 50)).toMatchObject({ u: 3, m: 3, valore: 450, rischio: 'Alto (≥ 200)' })
    expect(C.rmi(0, false, 300).valore).toBe(0)
    const raddoppio = C.betaHcg(1000, 2000, 48)
    expect(raddoppio.raddoppioOre).toBe(48)
    expect(raddoppio.variazione48).toBe(100)
    expect(C.betaHcg(1000, 1200, 48).sottoAtteso).toBe(true)
    expect(C.betaHcg(1000, 500, 24).dimezzamentoOre).toBe(24)
    expect(C.bmi(60, 165)).toEqual({ valore: 22, classe: 'Normopeso' })
    expect(C.aumentoPesoRaccomandato(22)).toEqual({ minimo: 11.5, massimo: 16 })
    expect(C.aumentoPesoRaccomandato(32, true)).toEqual({ minimo: 11, massimo: 19 })
  })
})
