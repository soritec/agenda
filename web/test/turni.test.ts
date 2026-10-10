import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import { avvisi, riposiInsufficienti, sovrapposizioni } from '../src/moduli/turni/controlli'
import { intervalli, intervallo } from '../src/moduli/turni/orari'
import { calcolaRiepilogo } from '../src/moduli/turni/riepilogo'
import { minuti, minutiDaOrari, tipoTurnoDa, TIPI_OPZIONALI, type DatiTurno, type TipoTurno } from '../src/moduli/turni/tipi'

const d = (g: number, m: number, h = 0, min = 0, anno = 2026) => istante(anno, m, g, h, min)
let contatore = 0
function turno(inizio: number, fine: number, tipo: TipoTurno = 'ambulatorio', extra: Partial<DatiTurno> = {}): DatiTurno {
  return { id: `t${++contatore}`, inizio, fine, tipo, ...extra }
}

describe('Valori salvati', () => {
  test('ripiego per valori sconosciuti', () => {
    expect(tipoTurnoDa('guardiaNotturna')).toBe('guardiaNotturna')
    expect(tipoTurnoDa('tipoDiUnaVersioneFutura')).toBe('ambulatorio')
    expect([...TIPI_OPZIONALI]).toEqual(['reperibilita'])
  })
})

describe('Orari dai turni tipo', () => {
  const g = (giorno: number, mese = 10) => ({ anno: 2026, mese, giorno })
  test('turno nella giornata', () => {
    expect(intervallo(g(12), 8 * 60, 14 * 60)).toEqual({ inizio: d(12, 10, 8), fine: d(12, 10, 14) })
  })
  test('notte, fino a mezzanotte, 24 ore', () => {
    expect(intervallo(g(12), 20 * 60, 8 * 60).fine).toBe(d(13, 10, 8))
    expect(intervallo(g(12), 16 * 60, 0).fine).toBe(d(13, 10))
    const v = intervallo(g(12), 8 * 60, 8 * 60)
    expect(v.fine - v.inizio).toBe(24 * 3_600_000)
  })
  test('ora legale: 11 ore a marzo, 13 a ottobre', () => {
    const marzo = intervallo(g(28, 3), 20 * 60, 8 * 60)
    expect(minuti(turno(marzo.inizio, marzo.fine))).toBe(11 * 60)
    const ottobre = intervallo(g(24), 20 * 60, 8 * 60)
    expect(minuti(turno(ottobre.inizio, ottobre.fine))).toBe(13 * 60)
  })
  test('inserimento multiplo senza doppioni e in ordine', () => {
    const v = intervalli([g(15), g(13), g(15)], 8 * 60, 14 * 60)
    expect(v.map((x) => x.inizio)).toEqual([d(13, 10, 8), d(15, 10, 8)])
  })
  test('orari non validi', () => {
    expect(() => intervallo(g(1), -1, 60)).toThrow(RangeError)
    expect(() => intervallo(g(1), 0, 1440)).toThrow(RangeError)
  })
})

describe('Ore inserite a mano', () => {
  test('sostituiscono quelle calcolate, anche nel riepilogo', () => {
    const t = turno(d(12, 10, 8), d(12, 10, 14), 'ambulatorio', { minutiManuali: 450 })
    expect(minutiDaOrari(t)).toBe(360)
    expect(minuti(t)).toBe(450)
    const domenica = turno(d(11, 10, 8), d(11, 10, 20), 'guardiaDiurna', { minutiManuali: 600 })
    const r = calcolaRiepilogo([t, domenica], 2026, 10)
    expect(r.minutiTotali).toBe(450 + 600)
    expect(r.minutiInGiorniFestivi).toBe(600)
  })
})

describe('Sovrapposizioni', () => {
  const a = turno(d(12, 10, 8), d(12, 10, 14))
  const b = turno(d(12, 10, 13), d(12, 10, 18))
  const c = turno(d(12, 10, 18), d(12, 10, 20)) // tocca b all'estremo: non è sovrapposizione
  const lungo = turno(d(12, 10, 7), d(12, 10, 22))
  test('coppie', () => {
    expect(sovrapposizioni([c, b, a])).toEqual([{ primo: a.id, secondo: b.id }])
    expect(sovrapposizioni([a, b, c, lungo])).toHaveLength(4)
  })
  test('avvisi per un turno', () => {
    expect(avvisi(c, [a, b]).some((x) => x.tipo === 'sovrapposizione')).toBe(false)
    expect(avvisi(b, [a])[0]).toEqual({ tipo: 'sovrapposizione', con: a.id })
  })
})

describe('Riposo minimo', () => {
  const notte = turno(d(12, 10, 20), d(13, 10, 8), 'guardiaNotturna')
  const pomeriggio = turno(d(13, 10, 14), d(13, 10, 20))
  const giornoDopo = turno(d(14, 10, 8), d(14, 10, 14))
  test('meno di 11 ore', () => {
    expect(riposiInsufficienti([giornoDopo, pomeriggio, notte])).toEqual([
      { precedente: notte.id, successivo: pomeriggio.id, minutiRiposo: 360 },
    ])
  })
  test('soglia modificabile', () => {
    expect(riposiInsufficienti([notte, pomeriggio], 6 * 60)).toHaveLength(0)
  })
  test('reperibilità esclusa di default, includibile', () => {
    const rep = turno(d(13, 10, 9), d(13, 10, 13), 'reperibilita')
    expect(riposiInsufficienti([notte, rep])).toHaveLength(0)
    expect(riposiInsufficienti([notte, rep], undefined, new Set())).toHaveLength(1)
  })
  test('turno corto dentro uno lungo', () => {
    const lungo = turno(d(20, 10, 8), d(20, 10, 20))
    const dentro = turno(d(20, 10, 9), d(20, 10, 10))
    const sera = turno(d(20, 10, 22), d(20, 10, 23))
    expect(riposiInsufficienti([lungo, dentro, sera])).toEqual([
      { precedente: lungo.id, successivo: sera.id, minutiRiposo: 120 },
    ])
  })
  test('avvisi dal punto di vista del turno nuovo', () => {
    expect(avvisi(pomeriggio, [notte, giornoDopo])).toEqual([
      { tipo: 'riposoInsufficiente', con: notte.id, minutiRiposo: 360 },
    ])
  })
})

describe('Riepilogo mensile', () => {
  const sedeA = 'sedeA', sedeB = 'sedeB', enteA = 'enteA', enteB = 'enteB'
  const turni = [
    // Notte da sabato 31 ottobre a domenica 1° novembre (Ognissanti): conta in ottobre.
    turno(d(31, 10, 20), d(1, 11, 8), 'guardiaNotturna', { sedeId: sedeA, enteId: enteA }),
    turno(d(12, 10, 8), d(12, 10, 14), 'ambulatorio', { sedeId: sedeB, enteId: enteB, compensoCent: 30_000 }),
    turno(d(11, 10, 8), d(11, 10, 20), 'guardiaDiurna', { sedeId: sedeA, enteId: enteA }),
    turno(d(13, 10, 8), d(13, 10, 14), 'festivo', { sedeId: sedeB, enteId: enteB, compensoCent: 36_000 }),
    turno(d(30, 9, 20), d(1, 10, 8), 'guardiaNotturna', { sedeId: sedeA, enteId: enteA }), // settembre
    turno(d(1, 11, 8), d(1, 11, 14), 'ambulatorio', { sedeId: sedeB, enteId: enteB }), // novembre
    turno(d(17, 10, 8), d(17, 10, 20), 'reperibilita', { sedeId: sedeA, enteId: enteA }),
  ]

  test('totali con sabato festivo', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: true })
    expect(r.numeroTurni).toBe(4)
    expect(r.minutiTotali).toBe((12 + 6 + 12 + 6) * 60)
    expect(r.minutiPerSede.get(sedeA)).toBe(24 * 60)
    expect(r.minutiPerEnte.get(enteB)).toBe(12 * 60)
    expect(r.notti).toBe(1)
    expect(r.turniPerTipo.get('guardiaNotturna')).toBe(1)
    expect(r.turniFestivi).toBe(3)
    expect(r.minutiInGiorniFestivi).toBe((4 + 8 + 12) * 60)
    expect(r.compensoCent).toBe(66_000)
    expect(r.compensoPerEnte.get(enteB)).toBe(66_000)
    expect(r.compensoPerEnte.get(enteA)).toBeUndefined()
    expect(r.turniPerTipo.get('reperibilita')).toBe(1)
    expect(r.minutiPerTipo.get('reperibilita')).toBe(12 * 60)
  })

  test('reperibilità contata se l’utente lo sceglie', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: true, esclusiDalleOre: new Set() })
    expect(r.minutiTotali).toBe((36 + 12) * 60)
    expect(r.turniFestivi).toBe(4)
  })

  test('sabato feriale', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: false })
    expect(r.turniFestivi).toBe(2)
    expect(r.minutiInGiorniFestivi).toBe((8 + 12) * 60)
  })

  test('santo patrono della sede', () => {
    const patrono = turno(d(24, 6, 8), d(24, 6, 14), 'ambulatorio', { sedeId: sedeA })
    const altrove = turno(d(24, 6, 15), d(24, 6, 18), 'ambulatorio', { sedeId: sedeB })
    const r = calcolaRiepilogo([patrono, altrove], 2026, 6, { patronoPerSede: new Map([[sedeA, { mese: 6, giorno: 24 }]]) })
    expect(r.turniFestivi).toBe(1)
    expect(r.minutiInGiorniFestivi).toBe(6 * 60)
  })
})
