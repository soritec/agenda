import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import { avvisi, sovrapposizioni } from '../src/moduli/turni/controlli'
import { intervalli, intervallo } from '../src/moduli/turni/orari'
import { calcolaRiepilogo } from '../src/moduli/turni/riepilogo'
import { areaDelMese } from '../src/moduli/turni/rotazione'
import { CATALOGO_SCUOLA, correzioniCatalogoV1, vociMancanti } from '../src/moduli/turni/catalogoScuola'
import { assegnazioneDelMese, ultimoMese } from '../src/moduli/turni/assegnazioni'
import { minuti, minutiDaOrari, tipoTurnoDa, TIPI_TURNO, type DatiTurno, type TipoTurno } from '../src/moduli/turni/tipi'

const d = (g: number, m: number, h = 0, min = 0, anno = 2026) => istante(anno, m, g, h, min)
let contatore = 0
function turno(inizio: number, fine: number, tipo: TipoTurno = 'ambulatorio', extra: Partial<DatiTurno> = {}): DatiTurno {
  return { id: `t${++contatore}`, inizio, fine, tipo, ...extra }
}

describe('Valori salvati', () => {
  test('ripiego per valori sconosciuti o non più usati', () => {
    expect(tipoTurnoDa('guardiaNotturna')).toBe('guardiaNotturna')
    expect(tipoTurnoDa('tipoDiUnaVersioneFutura')).toBe('ambulatorio')
    expect(tipoTurnoDa('reperibilita')).toBe('ambulatorio')
    expect(TIPI_TURNO).not.toContain('reperibilita')
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
    expect(avvisi(c, [a, b])).toEqual([])
    expect(avvisi(b, [a])).toEqual([{ tipo: 'sovrapposizione', con: a.id }])
  })
  test('turni ravvicinati senza sovrapposizione non danno avvisi', () => {
    const notte = turno(d(12, 10, 20), d(13, 10, 8), 'guardiaNotturna')
    const mattina = turno(d(13, 10, 8), d(13, 10, 14))
    expect(avvisi(mattina, [notte])).toEqual([])
  })
})

describe('Riepilogo mensile', () => {
  const sedeA = 'sedeA', sedeB = 'sedeB'
  const turni = [
    // Notte da sabato 31 ottobre a domenica 1° novembre (Ognissanti): conta in ottobre.
    turno(d(31, 10, 20), d(1, 11, 8), 'guardiaNotturna', { sedeId: sedeA }),
    turno(d(12, 10, 8), d(12, 10, 14), 'ambulatorio', { sedeId: sedeB, compensoCent: 30_000 }),
    turno(d(11, 10, 8), d(11, 10, 20), 'guardiaDiurna', { sedeId: sedeA }),
    turno(d(13, 10, 8), d(13, 10, 14), 'festivo', { sedeId: sedeB, compensoCent: 36_000 }),
    turno(d(30, 9, 20), d(1, 10, 8), 'guardiaNotturna', { sedeId: sedeA }), // settembre
    turno(d(1, 11, 8), d(1, 11, 14), 'ambulatorio', { sedeId: sedeB }), // novembre
  ]

  test('totali con sabato festivo', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: true })
    expect(r.numeroTurni).toBe(4)
    expect(r.minutiTotali).toBe((12 + 6 + 12 + 6) * 60)
    expect(r.minutiPerSede.get(sedeA)).toBe(24 * 60)
    expect(r.notti).toBe(1)
    expect(r.guardieGiorno).toBe(1)
    expect(r.turniPerTipo.get('guardiaNotturna')).toBe(1)
    expect(r.turniFestivi).toBe(3)
    expect(r.minutiInGiorniFestivi).toBe((4 + 8 + 12) * 60)
    expect(r.compensoCent).toBe(66_000)
  })

  test('sabato feriale', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: false })
    expect(r.turniFestivi).toBe(2)
    expect(r.minutiInGiorniFestivi).toBe((8 + 12) * 60)
  })
})

describe('Rotazione Ginecologia / Ostetricia', () => {
  test('senza scelte non c’è area', () => {
    expect(areaDelMese([], 2026, 10)).toBeUndefined()
  })
  test('6 mesi dall’ancora, poi alterna in avanti e all’indietro', () => {
    const ancore = [{ meseInizio: '2026-10', area: 'ostetricia' as const }]
    expect(areaDelMese(ancore, 2026, 10)).toEqual({ area: 'ostetricia', meseDellaRotazione: 1, scelto: true })
    expect(areaDelMese(ancore, 2027, 3)).toEqual({ area: 'ostetricia', meseDellaRotazione: 6, scelto: false })
    expect(areaDelMese(ancore, 2027, 4)?.area).toBe('ginecologia')
    expect(areaDelMese(ancore, 2027, 10)?.area).toBe('ostetricia')
    expect(areaDelMese(ancore, 2026, 9)).toEqual({ area: 'ginecologia', meseDellaRotazione: 6, scelto: false })
    expect(areaDelMese(ancore, 2026, 4)).toEqual({ area: 'ginecologia', meseDellaRotazione: 1, scelto: false })
  })
  test('una nuova scelta vale da quel mese in poi', () => {
    const ancore = [
      { meseInizio: '2026-10', area: 'ostetricia' as const },
      { meseInizio: '2027-02', area: 'ginecologia' as const },
    ]
    expect(areaDelMese(ancore, 2027, 1)?.area).toBe('ostetricia')
    expect(areaDelMese(ancore, 2027, 2)).toEqual({ area: 'ginecologia', meseDellaRotazione: 1, scelto: true })
    expect(areaDelMese(ancore, 2027, 8)?.area).toBe('ostetricia')
  })
})

describe('Turni tutto il giorno', () => {
  test('ore solo se inserite a mano, nessuna sovrapposizione', () => {
    const giorno = turno(d(12, 10), d(13, 10), 'ambulatorio', { tuttoIlGiorno: true })
    expect(minuti(giorno)).toBe(0)
    expect(minuti({ ...giorno, minutiManuali: 300 })).toBe(300)
    const notte = turno(d(12, 10, 20), d(13, 10, 8), 'guardiaNotturna')
    expect(avvisi(notte, [giorno])).toEqual([])
    const r = calcolaRiepilogo([giorno, notte], 2026, 10)
    expect(r.numeroTurni).toBe(2)
    expect(r.minutiTotali).toBe(12 * 60)
  })
})

describe('Sigle della scuola', () => {
  test('catalogo completo e senza doppioni', () => {
    expect(CATALOGO_SCUOLA).toHaveLength(51)
    expect(new Set(CATALOGO_SCUOLA.map((v) => v.sigla.toLowerCase())).size).toBe(51)
    expect(CATALOGO_SCUOLA.every((v) => TIPI_TURNO.includes(v.tipo))).toBe(true)
  })
  test('aggiunge solo le sigle mancanti', () => {
    expect(vociMancanti([{ sigla: 'N' }, { sigla: 'e pom' }]).map((v) => v.sigla)).not.toContain('E pom')
    expect(vociMancanti([{ sigla: 'N' }])).toHaveLength(50)
  })
})

describe('Orari predefiniti delle sigle', () => {
  test('ambulatori 8–18, sala operatoria 7–18, Tronco senza tipo', () => {
    const v = (s: string) => CATALOGO_SCUOLA.find((x) => x.sigla === s)!
    expect(v('AGI').orari).toEqual([480, 1080])
    expect(v('Sop').orari).toEqual([420, 1080])
    expect(v('Tro').tipo).toBe('altro')
  })
  test('correzione dei turni tipo caricati con la prima versione, solo se non modificati', () => {
    const vecchi = [
      { sigla: 'AGI', nome: 'Amb. Ginecologia generale', tipo: 'ambulatorio', tuttoIlGiorno: true },
      { sigla: 'Tro', nome: 'Tronco', tipo: 'salaOperatoria', tuttoIlGiorno: true },
      { sigla: 'E', nome: 'Ecografie (rinominato)', tipo: 'ecografia', tuttoIlGiorno: true },
      { sigla: 'N', nome: 'Guardia notte', tipo: 'guardiaNotturna' },
    ]
    const c = correzioniCatalogoV1(vecchi)
    expect(c.map((x) => [x.sigla, x.tipo, x.minutoInizio, x.minutoFine])).toEqual([['AGI', 'ambulatorio', 480, 1080], ['Tro', 'altro', 480, 1080]])
  })
})

describe('Ospedale di assegnazione', () => {
  const periodi = [
    { meseInizio: '2026-10', mesi: 18, sedeId: 'sedeA' },
    { meseInizio: '2028-04', mesi: 12, sedeId: 'sedeB' },
    { meseInizio: '2027-02', mesi: 1, sedeId: 'sedeC' },
  ]
  test('periodo e mese del periodo', () => {
    expect(assegnazioneDelMese(periodi, 2026, 9)).toBeUndefined()
    expect(assegnazioneDelMese(periodi, 2026, 10)).toMatchObject({ periodo: { sedeId: 'sedeA' }, meseDelPeriodo: 1 })
    expect(assegnazioneDelMese(periodi, 2028, 3)).toMatchObject({ periodo: { sedeId: 'sedeA' }, meseDelPeriodo: 18 })
    expect(assegnazioneDelMese(periodi, 2028, 4)?.periodo.sedeId).toBe('sedeB')
  })
  test('un periodo iniziato dopo prevale', () => {
    expect(assegnazioneDelMese(periodi, 2027, 2)?.periodo.sedeId).toBe('sedeC')
    expect(assegnazioneDelMese(periodi, 2027, 3)?.periodo.sedeId).toBe('sedeA')
  })
  test('ultimo mese', () => {
    expect(ultimoMese({ meseInizio: '2026-10', mesi: 18, sedeId: 'x' })).toBe('2028-03')
  })
})


describe('Smonto notte automatico', () => {
  test('il giorno in cui finisce la notte', async () => {
    const { giornoSmonto, smontiDaCreare } = await import('../src/moduli/turni/smonto')
    expect(giornoSmonto({ inizio: d(21, 10, 20), fine: d(22, 10, 8) })).toBe('2026-10-22')
    expect(giornoSmonto({ inizio: d(31, 10, 20), fine: d(1, 11, 8) })).toBe('2026-11-01')
    expect(giornoSmonto({ inizio: d(21, 10, 16), fine: d(22, 10) })).toBe('2026-10-22')
    const turni = [
      { id: 'n1', tipo: 'guardiaNotturna', inizio: d(21, 10, 20), fine: d(22, 10, 8) },
      { id: 'n2', tipo: 'guardiaNotturna', inizio: d(23, 10, 20), fine: d(24, 10, 8) },
      { id: 'r1', tipo: 'reparto', inizio: d(25, 10, 8), fine: d(25, 10, 18) },
    ]
    expect(smontiDaCreare(turni, [{ giorno: '2026-10-24' }])).toEqual([{ giorno: '2026-10-22', tipo: 'smontoNotte', turnoId: 'n1' }])
  })
})
